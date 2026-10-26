# 生成 iOS AppIcon（1024x1024 单一尺寸，Xcode 14+ 规范）
# 用法：E:\python\python.exe mobile\make-ios-icons.py
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

APPS = [
    ('forum', os.path.join(ROOT, 'assets', 'icon.png')),
    ('insist', os.path.join(ROOT, 'assets', 'insist-icon.png')),
]

for app, icon_path in APPS:
    target_dir = os.path.join(
        ROOT, 'mobile', app, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset'
    )
    if not os.path.isdir(target_dir):
        print(f'跳过 {app}：没有 iOS 工程')
        continue

    src = Image.open(icon_path).convert('RGBA')
    # iOS 图标不能有 alpha 通道（App Store 会拒），这里铺到底色上
    bg = (13, 17, 23) if app == 'forum' else (5, 5, 5)
    canvas = Image.new('RGB', (1024, 1024), bg)
    icon = src.resize((1024, 1024), Image.LANCZOS)
    canvas.paste(icon, (0, 0), icon)
    out = os.path.join(target_dir, 'AppIcon-512@2x.png')
    canvas.save(out, format='PNG')
    print(f'{app}: {out}')
