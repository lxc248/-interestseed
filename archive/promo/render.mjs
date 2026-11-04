import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chromePath = process.env.CHROME_PATH ||
  'C:\\Users\\30735\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';
const ffmpegPath = process.env.FFMPEG_PATH ||
  'C:\\Users\\30735\\Documents\\deepseek-harness\\default-workspace\\tools\\ffmpeg\\bin\\ffmpeg.exe';
const fps = 30;
const duration = 40;
const frames = duration * fps;
const output = path.join(__dirname, '..', 'assets', 'interestseed-launch.mp4');
const stillsDir = path.join(__dirname, 'stills');

await mkdir(stillsDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => console.error('PAGE ERROR', error.message));
await page.goto('file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/'), { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });

for (const t of [0.5, 6.5, 12.5, 20.5, 27.5, 32.5, 38.5]) {
  const data = await page.evaluate((time) => {
    window.renderFrame(time);
    return document.getElementById('stage').toDataURL('image/jpeg', 0.92).split(',')[1];
  }, t);
  await writeFile(path.join(stillsDir, `still-${t.toFixed(1)}.jpg`), Buffer.from(data, 'base64'));
}

// ffmpeg is not allowed to open output files in this Windows sandbox.
// Encode to stdout, then let Node's fs stream write the file.
const ffmpeg = spawn(ffmpegPath, [
  '-y',
  '-f', 'image2pipe',
  '-vcodec', 'mjpeg',
  '-framerate', String(fps),
  '-i', '-',
  '-i', path.join(__dirname, 'audio.wav'),
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '18',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-shortest',
  '-movflags', 'frag_keyframe+empty_moov+faststart',
  '-f', 'mp4',
  'pipe:1',
], { stdio: ['pipe', 'pipe', 'pipe'] });
const out = createWriteStream(output);
ffmpeg.stdout.pipe(out);
let ffmpegError = '';
ffmpeg.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  if (text.includes('error') || text.includes('Error')) ffmpegError += text;
});
ffmpeg.on('error', (error) => {
  ffmpegError += error.message;
});
ffmpeg.on('close', (code) => {
  if (code !== 0) console.error('ffmpeg close', code, ffmpegError);
});

for (let i = 0; i < frames; i += 1) {
  const frame = await page.evaluate((time) => {
    window.renderFrame(time);
    return document.getElementById('stage').toDataURL('image/jpeg', 0.92).split(',')[1];
  }, i / fps);
  const buffer = Buffer.from(frame, 'base64');
  if (!ffmpeg.stdin.write(buffer)) await once(ffmpeg.stdin, 'drain');
  if (i % 120 === 0) console.log(`frame ${i}/${frames}`);
}
ffmpeg.stdin.end();
const [code] = await once(ffmpeg, 'close');
await browser.close();
await once(out, 'close');
if (code !== 0) {
  console.error(ffmpegError);
  throw new Error(`ffmpeg exited ${code}`);
}
console.log(output);
