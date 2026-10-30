import subprocess
from pathlib import Path

root = Path(r'C:\Users\30735\Desktop\interestseed')
cmd = [
    'ffmpeg', '-y', '-ss', '1', '-t', '7',
    '-i', str(root / 'assets/interestseed-launch.mp4'),
    '-vf', 'fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer',
    '-loop', '0', '-f', 'gif', 'pipe:1',
]
result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
if result.returncode != 0:
    raise SystemExit(result.stderr.decode('utf-8', errors='replace')[-2000:])
out = root / 'assets/interestseed-demo.gif'
out.write_bytes(result.stdout)
print(out, out.stat().st_size)

