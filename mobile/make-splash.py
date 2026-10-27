# 生成 iOS / Android 自定义启动图（深色底 + DISI 图标）
# 用法：E:\python\python.exe mobile\make-splash.py
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

APPS = {
    'forum': {
        'icon': os.path.join(ROOT, 'assets', 'icon.png'),
        'bg': (13, 17, 23),      # #0d1117
        'ratio': 0.26,           # 图标占画面宽度比例
    },
    'insist': {
        'icon': os.path.join(ROOT, 'assets', 'insist-icon.png'),
        'bg': (5, 5, 5),         # #050505
        'ratio': 0.24,
    },
}

# Android 各密度尺寸（竖屏 / 横屏）
ANDROID_SIZES = {
    'drawable': (512, 512),
    'drawable-port-mdpi': (320, 480),
    'drawable-port-hdpi': (480, 800),
    'drawable-port-xhdpi': (720, 1280),
    'drawable-port-xxhdpi': (960, 1600),
    'drawable-port-xxxhdpi': (1280, 1920),
    'drawable-land-mdpi': (480, 320),
    'drawable-land-hdpi': (800, 480),
    'drawable-land-xhdpi': (1280, 720),
    'drawable-land-xxhdpi': (1600, 960),
    'drawable-land-xxxhdpi': (1920, 1280),
}

IOS_SIZES = {
    'splash-2732x2732-2.png': (667, 667),     # 1x
    'splash-2732x2732-1.png': (1334, 1334),   # 2x
    'splash-2732x2732.png': (2732, 2732),     # 3x
}


def compose(icon_path, bg, ratio, size):
    w, h = size
    canvas = Image.new('RGB', (w, h), bg)
    icon = Image.open(icon_path).convert('RGBA')
    target = int(min(w, h) * ratio)
    if target < 8:
        target = 8
    icon = icon.resize((target, target), Image.LANCZOS)
    canvas.paste(icon, ((w - target) // 2, (h - target) // 2), icon)
    return canvas


def build_ios(app, conf):
    d = os.path.join(ROOT, 'mobile', app, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset')
    if not os.path.isdir(d):
        print(f'  跳过 iOS {app}：没有目录')
        return
    for name, size in IOS_SIZES.items():
        compose(conf['icon'], conf['bg'], conf['ratio'], size).save(os.path.join(d, name))
    print(f'  iOS {app}: 启动图 3 张')


def build_android(app, conf):
    base = os.path.join(ROOT, 'mobile', app, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(base):
        print(f'  跳过 Android {app}：没有目录')
        return
    n = 0
    for folder, size in ANDROID_SIZES.items():
        d = os.path.join(base, folder)
        os.makedirs(d, exist_ok=True)
        compose(conf['icon'], conf['bg'], conf['ratio'], size).save(os.path.join(d, 'splash.png'))
        n += 1
    print(f'  Android {app}: 启动图 {n} 张')


def fix_launch_storyboard(app, hex_bg):
    p = os.path.join(ROOT, 'mobile', app, 'ios', 'App', 'App', 'Base.lproj', 'LaunchScreen.storyboard')
    if not os.path.exists(p):
        return
    s = open(p, encoding='utf-8').read()
    # 把白底换成应用底色，避免启动瞬间白屏闪烁
    s = s.replace(
        '<color key="backgroundColor" systemColor="systemBackgroundColor"/>',
        f'<color key="backgroundColor" red="{int(hex_bg[1:3], 16) / 255:.3f}" '
        f'green="{int(hex_bg[3:5], 16) / 255:.3f}" blue="{int(hex_bg[5:7], 16) / 255:.3f}" '
        f'alpha="1" colorSpace="custom" customColorSpace="sRGB"/>'
    )
    s = s.replace('contentMode="scaleAspectFill"', 'contentMode="scaleAspectFit"')
    open(p, 'w', encoding='utf-8').write(s)
    print(f'  LaunchScreen {app}: 背景 {hex_bg}')


if __name__ == '__main__':
    for app, conf in APPS.items():
        print(f'生成 {app} 启动图…')
        build_ios(app, conf)
        build_android(app, conf)
        fix_launch_storyboard(app, '#0d1117' if app == 'forum' else '#050505')
    print('完成')
