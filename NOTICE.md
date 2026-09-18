# 第三方来源与出处

窑变是 MIT 协议（见 [LICENSE](LICENSE)）。下面记的是其中**不是原创**的部分。

---

## 配色数据：窑变 VS Code 主题

`src/themes.js` 是**生成的**，不手写。它从 <https://github.com/Sum-su/yaobian-theme>
的 72 个 VS Code 主题里取角色色，投影成 Zotero 的两个契约：

- 阅读器的 4 字段主题（`background` / `foreground`）
- 主窗口的 `--material-*` / `--fill-*` / `--accent-*` 变量组

那个仓库也是 MIT，作者同为 Sum-su，所以同源同许可。

## 壁纸与毛玻璃：zotero-wallpaper

界面半透明 + 背景图层这套做法，**设计参考**：

> **Zotero Wallpaper** — <https://github.com/endoretic/zotero-wallpaper>
> Copyright (c) 2026 EndoReticulum — MIT

具体借了两样东西：

1. **`YB_GLASS_SURFACES` 那张选择器清单**（`src/bootstrap.js`）。
   Zotero 的窗格栈里有几十个元素**自己画不透明底**，不走 `--material-*`，
   光改变量是透不出背景图的。这张清单是原作者逐个试出来的，我沿用了。
2. **一个 `opacity` 旋钮同时驱动「面透明度」和「模糊半径」**的模型，
   以及工具栏比其余面**更不透明**（`1 - op/2` 而不是 `1 - op`）的思路。

**没有照搬的**：本插件是单张图 + `cover` 缩放；对方还支持深浅两套图、
文件夹洗牌轮换、Cover/Contain/Center/Stretch 布局、单图缩放与位移。
阅读器侧的壁纸适配也没做（阅读器已由插件的主题槽管着）。

`backdrop-filter: blur()` 与 `isolation: isolate` 是 CSS 标准，非其独创。

## 未使用的备选方案：Windows Mica

Zotero 10 的 Gecko 140 带 `widget.windows.mica` 代码路径（`-moz-windows-mica-popups`
媒体查询在 `omni.ja` 里），理论上能让窗口直接透出**桌面壁纸**的模糊。本插件
**没有**用它，原因：

- 它只在窗口创建时生效，**必须重启**，和插件「改完即生效」的设计冲突；
- 它是系统级材质，**不能跟着家族配色走**；
- 本机默认就是 `false`。

想要的话是一条 pref 的事，但它换来的是「重启才生效」。
