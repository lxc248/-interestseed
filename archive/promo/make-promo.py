import json
import os
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(r'C:\Users\30735\Desktop\interestseed\promo')
SCENE_DIR = ROOT / 'promo-scenes'
CLIP_DIR = ROOT / 'promo-clips'
CLIP_DIR.mkdir(exist_ok=True)

D = 4.8
F = 0.4
FPS = 30
FRAMES = int(round(D * FPS))


def run_ffmpeg(args, out_path):
    cmd = ['ffmpeg', '-y', *args, '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1']
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        tail = proc.stderr.decode('utf-8', 'replace')[-3000:]
        raise SystemExit(f'ffmpeg failed ({proc.returncode}):\n{tail}')
    out_path.write_bytes(proc.stdout)
    print(f'wrote {out_path.name} ({len(proc.stdout)} bytes)')


def make_clips():
    zoom = 'min(1+0.00045*on,1.06)'
    for i in range(1, 8):
        src = SCENE_DIR / f'scene-{i}.png'
        out = CLIP_DIR / f'scene-{i}.mp4'
        args = [
            '-i', str(src),
            '-vf', f"zoompan=z='{zoom}':d={FRAMES}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps={FPS},format=yuv420p",
            '-t', str(D),
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '18',
            '-r', str(FPS),
        ]
        run_ffmpeg(args, out)


def combine_clips():
    inputs = []
    for i in range(1, 8):
        inputs += ['-i', str(CLIP_DIR / f'scene-{i}.mp4')]
    filter_parts = []
    prev = '[0:v]'
    for i in range(1, 7):
        off = i * (D - F)
        label = '[vout]' if i == 6 else f'[v{i}]'
        filter_parts.append(f"{prev}[{i}:v]xfade=transition=fade:duration={F}:offset={off:.2f}{label}")
        prev = label
    args = [
        *inputs,
        '-filter_complex', ';'.join(filter_parts),
        '-map', '[vout]',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '18',
        '-r', str(FPS),
    ]
    run_ffmpeg(args, ROOT / 'promo-video-noaudio.mp4')


def synth_audio():
    sr = 48000
    dur = 31.2
    t = np.arange(int(sr * dur)) / sr
    # A minor pad: A2, C3, E3 with slow movement.
    f0 = np.array([110.0, 130.81, 164.81])
    pad = sum(np.sin(2 * np.pi * f * t) for f in f0) / 3.0
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.1 * t)
    pad *= lfo
    # Soft pulse every 2 s (120 BPM bar), no aggressive attack.
    pulse = np.zeros_like(t)
    for k in range(int(dur // 2) + 1):
        start = k * 2.0
        idx = (t >= start) & (t < start + 1.0)
        env = np.exp(-3.0 * (t[idx] - start))
        pulse[idx] += np.sin(2 * np.pi * 55.0 * (t[idx] - start)) * env
    # Gentle pluck on scene changes (every D seconds after 0).
    pluck = np.zeros_like(t)
    for start in np.arange(0.0, dur, D):
        idx = (t >= start) & (t < start + 0.6)
        env = np.exp(-5.0 * (t[idx] - start))
        pluck[idx] += np.sin(2 * np.pi * 220.0 * (t[idx] - start)) * env
    mix = 0.55 * pad + 0.28 * pulse + 0.12 * pluck
    # Stereo width: slight detune on right channel.
    stereo = np.stack([mix, 0.92 * mix + 0.08 * np.roll(mix, 120)], axis=1)
    fade = int(sr * 1.2)
    ramp = np.linspace(0, 1, fade)
    stereo[:fade] *= ramp[:, None]
    stereo[-fade:] *= ramp[::-1, None]
    peak = np.max(np.abs(stereo))
    if peak > 0:
        stereo *= 0.6 / peak
    wav = (stereo * 32767).astype(np.int16)
    out = ROOT / 'promo-audio.wav'
    import wave
    with wave.open(str(out), 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(wav.tobytes())
    print(f'wrote {out.name} ({wav.nbytes} bytes)')


def mux_final():
    args = [
        '-i', str(ROOT / 'promo-video-noaudio.mp4'),
        '-i', str(ROOT / 'promo-audio.wav'),
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-shortest',
    ]
    run_ffmpeg(args, ROOT / 'interestseed-launch.mp4')


if __name__ == '__main__':
    make_clips()
    combine_clips()
    synth_audio()
    mux_final()
    print('done')
