import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = 'C:\\Users\\30735\\Desktop\\interestseed\\promo';
const sceneDir = join(root, 'promo-scenes');
const clipDir = join(root, 'promo-clips');
mkdirSync(clipDir, { recursive: true });

const D = 4.8;
const F = 0.4;
const FRAMES = Math.round(D * 30);
const run = (args) => {
  const res = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status ?? 1);
};

for (let i = 1; i <= 7; i += 1) {
  const src = join(sceneDir, `scene-${i}.png`);
  const out = join(clipDir, `scene-${i}.mp4`);
  const zoom = `min(1+0.00045*on,1.06)`;
  run([
    '-y',
    '-i', src,
    '-vf', `zoompan=z='${zoom}':d=${FRAMES}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,format=yuv420p`,
    '-t', String(D),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    out,
  ]);
  console.log(`clip ${i} ok`);
}

const inputs = [];
for (let i = 1; i <= 7; i += 1) {
  inputs.push('-i', join(clipDir, `scene-${i}.mp4`));
}
const filter = [];
let prev = '[0:v]';
for (let i = 1; i <= 6; i += 1) {
  const off = (i * (D - F)).toFixed(2);
  const outLabel = i === 6 ? '[vout]' : `[v${i}]`;
  filter.push(`${prev}[${i}:v]xfade=transition=fade:duration=${F}:offset=${off}${outLabel}`);
  prev = outLabel;
}
const filterComplex = filter.join(';');
const final = join(root, 'promo-video-noaudio.mp4');
run([
  '-y',
  ...inputs,
  '-filter_complex', filterComplex,
  '-map', '[vout]',
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '18',
  '-r', '30',
  final,
]);
console.log('video combined ok');
