# 用项目自带的 icon.png 生成 Android 各密度图标
# 用法：E:\python\python.exe mobile\make-icons.py
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

APPS = [
    ('forum', os.path.join(ROOT, 'assets', 'icon.png')),
    ('insist', os.path.join(ROOT, 'assets', 'insist-icon.png')),
]

# mipmap 密度 -> 尺寸
DENSITIES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

for app, icon_path in APPS:
    res = os.path.join(ROOT, 'mobile', app, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(res):
        print(f'跳过 {app}：还没生成 android 工程')
        continue
    src = Image.open(icon_path).convert('RGBA')
    # 1024 母版
    master = src.resize((1024, 1024), Image.LANCZOS)
    for folder, size in DENSITIES.items():
        d = os.path.join(res, folder)
        os.makedirs(d, exist_ok=True)
        img = master.resize((size, size), Image.LANCZOS)
        img.save(os.path.join(d, 'ic_launcher.png'))
        # 圆形图标：加圆形蒙版
        round_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        mask = Image.new('L', (size * 4, size * 4), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
        mask = mask.resize((size, size), Image.LANCZOS)
        round_img.paste(img, (0, 0), mask)
        round_img.save(os.path.join(d, 'ic_launcher_round.png'))
        # 自适应前台（108dp -> 按 1.5 倍尺寸）
        fg_size = int(size * 1.5)
        fg = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        scaled = master.resize((size, size), Image.LANCZOS)
        fg.paste(scaled, ((fg_size - size) // 2, (fg_size - size) // 2), scaled)
        fg.save(os.path.join(d, 'ic_launcher_foreground.png'))
    print(f'{app}: 图标已生成（5 个密度）')
