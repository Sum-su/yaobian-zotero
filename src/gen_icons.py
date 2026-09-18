# -*- coding: utf-8 -*-
"""从源图派生插件图标，写进 src/icons/。

**不挂在 build.py 里**：图标只在换图时才变，没必要每次打包都依赖仓库外的
源图（build.py 要是缺了它就跑不动了）。换图标时手动跑一次：

    python src/gen_icons.py

源图是仓库外的照片，故意不放进版本库（1.8 MB 的原作，对插件没有用）。
绝对路径跟 gen_themes.py 读 C:/temp/yaobian-vscode/themes 是同一个做法。

源图 1212×1233，先居中裁方再缩，不然碗会被压扁 1.7%。缩完补一道轻 unsharp：
冰裂纹是发丝级线条，1212 → 48 直接 LANCZOS 会糊成一片——而 48 正是 Zotero
插件列表真正显示的那一档。
"""
import os

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
# 源图不在版本库里，路径只能外置。跟 gen_themes.py 的 YAOBIAN_THEMES 一样，
# 默认值是本机那份，别人要用就设环境变量。
SRC = os.environ.get("YAOBIAN_ICON_SRC", r"D:\tombliboo\Pictures\Saved Pictures\窑变.png")

# 文件名带尺寸，manifest.json 里一一对应。以前叫 favicon.png / favicon@0.5x.png，
# 两个名字都看不出哪张是多大，而且 manifest 把 "48" 也指向了那张 96px 的图。
# 设置侧栏那格要 24px（Zotero.Plugins.getIconURI(pluginID, 24)），48 缩到 24
# 正好是整数倍，所以 48 那张就是它的来源。
TARGETS = [("icons/icon-96.png", 96, 70), ("icons/icon-48.png", 48, 85)]


def main():
    if not os.path.exists(SRC):
        raise SystemExit("找不到源图：%s" % SRC)

    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    side = min(w, h)
    im = im.crop(((w - side) // 2, (h - side) // 2,
                  (w + side) // 2, (h + side) // 2))

    for rel, size, sharpen in TARGETS:
        out = im.resize((size, size), Image.LANCZOS)
        out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=sharpen, threshold=2))
        path = os.path.join(HERE, rel)
        out.save(path, "PNG", optimize=True)
        print("%-24s %dx%d -> %d bytes" % (rel, size, size, os.path.getsize(path)))


if __name__ == "__main__":
    main()
