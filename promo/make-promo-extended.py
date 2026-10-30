import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(r'C:\Users\30735\Desktop\interestseed\promo')
SCENE_DIR = ROOT / 'promo-scenes'
CLIP_DIR = ROOT / 'promo-clips-ext'
CLIP_DIR.mkdir(exist_ok=True)

D = 4.8
F = 0.4
FPS = 30
FRAMES = int(round(D * FPS))
N = 10
DUR = N * D - (N - 1) * F


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
    for i in range(1, N + 1):
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
    for i in range(1, N + 1):
        inputs += ['-i', str(CLIP_DIR / f'scene-{i}.mp4')]
    filter_parts = []
    prev = '[0:v]'
    for i in range(1, N):
        off = i * (D - F)
        label = '[vout]' if i == N - 1 else f'[v{i}]'
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
    run_ffmpeg(args, ROOT / 'promo-extended-noaudio.mp4')


def synth_audio():
    sr = 48000
    t = np.arange(int(sr * DUR)) / sr
    f0 = np.array([110.0, 130.81, 164.81])
    pad = sum(np.sin(2 * np.pi * f * t) for f in f0) / 3.0
    pad *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.08 * t)
    pulse = np.zeros_like(t)
    for k in range(int(DUR // 2) + 1):
        start = k * 2.0
        idx = (t >= start) & (t < start + 1.0)
        env = np.exp(-3.0 * (t[idx] - start))
        pulse[idx] += np.sin(2 * np.pi * 55.0 * (t[idx] - start)) * env
    pluck = np.zeros_like(t)
    for start in np.arange(0.0, DUR, D):
        idx = (t >= start) & (t < start + 0.6)
        env = np.exp(-5.0 * (t[idx] - start))
        pluck[idx] += np.sin(2 * np.pi * 220.0 * (t[idx] - start)) * env
    mix = 0.55 * pad + 0.26 * pulse + 0.12 * pluck
    stereo = np.stack([mix, 0.92 * mix + 0.08 * np.roll(mix, 120)], axis=1)
    fade = int(sr * 1.4)
    ramp = np.linspace(0, 1, fade)
    stereo[:fade] *= ramp[:, None]
    stereo[-fade:] *= ramp[::-1, None]
    peak = np.max(np.abs(stereo))
    if peak > 0:
        stereo *= 0.6 / peak
    wav = (stereo * 32767).astype(np.int16)
    import wave
    with wave.open(str(ROOT / 'promo-extended-audio.wav'), 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(wav.tobytes())
    print('audio ok')


def mux_final():
    args = [
        '-i', str(ROOT / 'promo-extended-noaudio.mp4'),
        '-i', str(ROOT / 'promo-extended-audio.wav'),
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-shortest',
    ]
    run_ffmpeg(args, ROOT / 'interestseed-launch-extended.mp4')


if __name__ == '__main__':
    make_clips()
    combine_clips()
    synth_audio()
    mux_final()
    print('done', DUR)
