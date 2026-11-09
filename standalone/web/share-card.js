function wrapText(ctx, text, fontSize, maxWidth) {
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function createShareCard({ openModal }) {
  function draw(text) {
    const canvas = document.getElementById('share-card-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0f1420');
    gradient.addColorStop(1, '#080b12');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(167,139,250,.16)';
    ctx.beginPath();
    ctx.arc(1020, 120, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c4b5fd';
    ctx.font = '700 42px system-ui, sans-serif';
    ctx.fillText('InterestSeed', 70, 96);
    ctx.fillStyle = '#8b96ad';
    ctx.font = '400 22px system-ui, sans-serif';
    ctx.fillText('把收藏变成一次真实行动', 70, 138);
    ctx.fillStyle = '#eef2ff';
    ctx.font = '600 40px system-ui, sans-serif';
    const lines = wrapText(ctx, text, 46, 1060);
    let y = 270;
    for (const line of lines.slice(0, 6)) {
      ctx.fillText(line, 70, y);
      y += 62;
    }
    ctx.fillStyle = '#8b96ad';
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillText(new Date().toLocaleDateString(), 70, 560);
    ctx.fillStyle = '#34d399';
    ctx.fillText('3 天实验 · 本地优先', 70, 590);
  }

  function open(item) {
    openModal('share-card-modal');
    draw(item.text);
  }

  function download() {
    const canvas = document.getElementById('share-card-canvas');
    const anchor = document.createElement('a');
    anchor.download = `interestseed-${new Date().toISOString().slice(0, 10)}.png`;
    anchor.href = canvas.toDataURL('image/png');
    anchor.click();
  }

  return { draw, open, download };
}
