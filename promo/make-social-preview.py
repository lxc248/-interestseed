from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

root = Path(r'C:\Users\30735\Desktop\interestseed')
W, H = 1280, 640
img = Image.new('RGB', (W, H), '#0b0d14')
d = ImageDraw.Draw(img)

# Vertical gradient.
for y in range(H):
    t = y / H
    r = int(11 + 10 * t)
    g = int(13 + 7 * t)
    b = int(20 + 22 * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))

# Soft accent glow.
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse((820, -180, 1420, 420), fill=(156, 140, 255, 38))
gd.ellipse((-220, 360, 420, 900), fill=(225, 128, 97, 34))
img = Image.alpha_composite(img.convert('RGBA'), glow).convert('RGB')
d = ImageDraw.Draw(img)

bold_path = Path(r'C:\Windows\Fonts\msyhbd.ttc')
regular_path = Path(r'C:\Windows\Fonts\msyh.ttc')
title_font = ImageFont.truetype(str(bold_path), 88)
sub_font = ImageFont.truetype(str(regular_path), 30)
small_font = ImageFont.truetype(str(regular_path), 20)
pill_font = ImageFont.truetype(str(bold_path), 18)
loop_font = ImageFont.truetype(str(bold_path), 22)

# Accent bar.
d.rounded_rectangle((64, 84, 74, 168), radius=5, fill='#e18061')

# Eyebrow pill.
d.rounded_rectangle((96, 82, 300, 122), radius=20, fill=(232, 200, 132, 28), outline=(232, 200, 132, 120), width=1)
d.text((116, 92), 'OBSIDIAN PLUGIN', font=pill_font, fill='#f0d6a0')

d.text((96, 148), 'InterestSeed', font=title_font, fill='#f4f6fb')
d.text((100, 262), '把一条收藏，变成 3 天真实行动。', font=sub_font, fill='#d7dcea')
d.text((100, 304), '再用证据决定：继续，还是放下。', font=sub_font, fill='#9aa6ba')

# Loop line.
loop = 'Capture  →  Decide  →  Connect  →  Verify'
d.text((100, 384), loop, font=loop_font, fill='#b9a7ff')

# Bottom badges.
badges = ['LOCAL-FIRST', 'HUMAN-IN-THE-LOOP', 'MCP-READY']
x = 100
for label in badges:
    w = d.textlength(label, font=pill_font) + 26
    d.rounded_rectangle((x, 466, x + w, 504), radius=19, fill=(255, 255, 255, 14), outline=(255, 255, 255, 40), width=1)
    d.text((x + 13, 476), label, font=pill_font, fill='#c7cfdd')
    x += w + 12

# Screenshot card on the right.
shot = Image.open(root / 'assets' / 'plugin-cosmic.png').convert('RGB')
target_w, target_h = 560, 350
shot = shot.resize((target_w, target_h), Image.LANCZOS)
mask = Image.new('L', (target_w, target_h), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle((0, 0, target_w, target_h), radius=22, fill=255)
card = Image.new('RGBA', (target_w + 8, target_h + 8), (0, 0, 0, 0))
cd = ImageDraw.Draw(card)
cd.rounded_rectangle((0, 0, target_w + 7, target_h + 7), radius=26, fill=(255, 255, 255, 30))
card.paste(shot, (4, 4), mask)
img.paste(card, (660, 132), card)

# Border glow on screenshot.
d.rounded_rectangle((656, 128, 1232, 494), radius=26, outline=(156, 140, 255, 90), width=2)

# Footer.
d.text((100, 568), 'github.com/lxc248/-interestseed', font=small_font, fill='#6f7b8c')

img.save(root / 'assets' / 'github-social-preview.png', optimize=True)
print('social preview written')
