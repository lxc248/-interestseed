from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np

SR = 48_000
DURATION = 40.0
N = int(SR * DURATION)
t = np.arange(N, dtype=np.float64) / SR
rng = np.random.default_rng(20261029)


def env(start: float, length: float, attack: float = 0.01, release: float = 0.2) -> np.ndarray:
    x = np.zeros(N, dtype=np.float64)
    a = max(1, int(attack * SR))
    r = max(1, int(release * SR))
    s = max(0, min(N, int(start * SR)))
    e = min(N, s + int(length * SR))
    if e <= s:
        return x
    seg = np.ones(e - s)
    seg[: min(a, len(seg))] = np.linspace(0, 1, min(a, len(seg)))
    tail = min(r, len(seg))
    seg[-tail:] *= np.linspace(1, 0, tail)
    x[s:e] = seg
    return x


def sine(freq: float, phase: float = 0.0) -> np.ndarray:
    return np.sin(2 * np.pi * freq * t + phase)


def midi(note: int) -> float:
    return 440.0 * 2 ** ((note - 69) / 12)


def kick(start: float, gain: float = 0.55) -> np.ndarray:
    x = np.zeros(N)
    s = int(start * SR)
    length = int(0.22 * SR)
    if s >= N:
        return x
    tt = np.arange(min(length, N - s)) / SR
    freq = 120 * np.exp(-tt * 24) + 43
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-tt * 14)
    click = rng.normal(0, 1, len(tt)) * np.exp(-tt * 120) * 0.14
    x[s : s + len(tt)] = (body + click) * gain
    return x


def hat(start: float, gain: float = 0.12, length: float = 0.055) -> np.ndarray:
    x = np.zeros(N)
    s = int(start * SR)
    n = min(int(length * SR), N - s)
    if n <= 0:
        return x
    noise = rng.normal(0, 1, n)
    # simple high-pass: first difference
    noise = np.diff(np.concatenate([[0], noise]))
    tt = np.arange(n) / SR
    x[s : s + n] = noise * np.exp(-tt * 80) * gain
    return x


def snare(start: float, gain: float = 0.18) -> np.ndarray:
    x = np.zeros(N)
    s = int(start * SR)
    n = min(int(0.16 * SR), N - s)
    if n <= 0:
        return x
    tt = np.arange(n) / SR
    noise = rng.normal(0, 1, n) * np.exp(-tt * 26)
    tone = np.sin(2 * np.pi * 185 * tt) * np.exp(-tt * 22) * 0.5
    x[s : s + n] = (noise * 0.8 + tone) * gain
    return x


def bass_note(start: float, note: int, length: float, gain: float = 0.18) -> np.ndarray:
    x = np.zeros(N)
    s = int(start * SR)
    n = min(int(length * SR), N - s)
    if n <= 0:
        return x
    tt = np.arange(n) / SR
    freq = midi(note)
    sig = np.sin(2 * np.pi * freq * tt) * 0.72 + np.sin(2 * np.pi * freq * 2 * tt) * 0.15
    sig *= np.exp(-tt * 0.9)
    sig[: min(int(0.02 * SR), n)] *= np.linspace(0, 1, min(int(0.02 * SR), n))
    x[s : s + n] = sig * gain
    return x


def pad(start: float, notes: list[int], length: float, gain: float = 0.035) -> np.ndarray:
    x = np.zeros(N)
    s = int(start * SR)
    n = min(int(length * SR), N - s)
    if n <= 0:
        return x
    tt = np.arange(n) / SR
    sig = np.zeros(n)
    for i, note in enumerate(notes):
        freq = midi(note)
        sig += np.sin(2 * np.pi * freq * tt + i * 0.7) * 0.38
        sig += np.sin(2 * np.pi * freq * 1.005 * tt + i * 1.1) * 0.2
    attack = min(int(0.7 * SR), n)
    release = min(int(0.8 * SR), n)
    sig[:attack] *= np.linspace(0, 1, attack)
    sig[-release:] *= np.linspace(1, 0, release)
    x[s : s + n] = sig * gain
    return x


def pluck(start: float, note: int, gain: float = 0.08) -> np.ndarray:
    x = np.zeros(N)
    s = int(start * SR)
    n = min(int(0.42 * SR), N - s)
    if n <= 0:
        return x
    tt = np.arange(n) / SR
    freq = midi(note)
    sig = (
        np.sin(2 * np.pi * freq * tt) * 0.55
        + np.sin(2 * np.pi * freq * 2 * tt) * 0.2
        + np.sin(2 * np.pi * freq * 3 * tt) * 0.08
    )
    sig *= np.exp(-tt * 7.5)
    x[s : s + n] = sig * gain
    return x


def whoosh(start: float, length: float = 0.9, gain: float = 0.16) -> np.ndarray:
    x = np.zeros(N)
    s = int(start * SR)
    n = min(int(length * SR), N - s)
    if n <= 0:
        return x
    tt = np.arange(n) / n
    noise = rng.normal(0, 1, n)
    # smooth noise by cumulative average
    k = np.hanning(n)
    envelope = np.sin(np.pi * tt) ** 2
    x[s : s + n] = noise * k * envelope * gain
    return x


mix = np.zeros((N, 2), dtype=np.float64)


def add(sig: np.ndarray, pan: float = 0.0, gain: float = 1.0) -> None:
    left = math.sqrt((1 - pan) / 2)
    right = math.sqrt((1 + pan) / 2)
    mix[:, 0] += sig * left * gain
    mix[:, 1] += sig * right * gain


# Intro pulse / tension
for beat_index in range(19):
    start = 0.5 + beat_index * 0.5
    if start >= 35.0:
        break
    if start < 4.2:
        add(kick(start, 0.18), 0, 0.7)
    else:
        add(kick(start, 0.42), 0, 1.0)
    if start >= 9.5:
        add(hat(start + 0.25, 0.1), 0.2, 1.0)
    if start >= 16.5 and beat_index % 2 == 1:
        add(snare(start, 0.12), -0.05, 1.0)

# Bass progression: A minor -> F -> C -> G, 4 bars x 4s
progression = [
    [45, 45, 48, 45],
    [41, 41, 44, 41],
    [48, 48, 52, 48],
    [43, 43, 47, 43],
]
for bar in range(9):
    start = bar * 4.0
    if start >= 40.0:
        break
    notes = progression[bar % len(progression)]
    for i, note in enumerate(notes):
        add(bass_note(start + i * 1.0, note, 0.85, 0.14 if start < 9.5 else 0.2), 0, 1.0)

# Pads / chords
chords = [
    [57, 60, 64],
    [53, 57, 60],
    [60, 64, 67],
    [55, 59, 62],
]
for bar in range(10):
    start = bar * 4.0
    if start >= 40.0:
        break
    add(pad(start, chords[bar % len(chords)], 3.8, 0.03 if start < 9.5 else 0.05), 0, 1.0)

# Arpeggio from onboarding section onward
arp_notes = [69, 72, 76, 81, 76, 72, 69, 72]
for i in range(70):
    start = 9.5 + i * 0.5
    if start >= 35.0:
        break
    add(pluck(start, arp_notes[i % len(arp_notes)], 0.055), math.sin(i * 0.8) * 0.25, 1.0)

# Transitions
for at in [4.2, 9.5, 16.5, 23.5, 29.5, 35.0]:
    add(whoosh(at - 0.45, 0.8, 0.11), -0.1, 1.0)

# Final chord swell
add(pad(35.0, [45, 57, 60, 64, 69], 4.8, 0.075), 0, 1.0)
for i, note in enumerate([57, 60, 64, 69, 72]):
    add(pluck(35.2 + i * 0.12, note, 0.07), (i - 2) * 0.12, 1.0)

# gentle high shelf / de-ess style smoothing
# simple one-pole low-pass for harsh noise
alpha = 0.22
for ch in range(2):
    y = np.zeros(N)
    prev = 0.0
    for i in range(N):
        prev = prev + alpha * (mix[i, ch] - prev)
        y[i] = prev
    mix[:, ch] = y

# fade in/out
fade = int(0.5 * SR)
mix[:fade] *= np.linspace(0, 1, fade)[:, None]
mix[-int(2.0 * SR):] *= np.linspace(1, 0, int(2.0 * SR))[:, None]

# normalize to -1.0 dBFS
peak = float(np.max(np.abs(mix)))
if peak > 0:
    mix *= 0.891 / peak

out = (mix * 32767).astype(np.int16)
out_path = Path(__file__).with_name("audio.wav")
with wave.open(str(out_path), "wb") as fh:
    fh.setnchannels(2)
    fh.setsampwidth(2)
    fh.setframerate(SR)
    fh.writeframes(out.tobytes())
print(out_path, out.shape, out_path.stat().st_size)
