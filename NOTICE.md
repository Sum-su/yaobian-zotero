# 第三方来源与出处

窑变是 MIT 协议（见 [LICENSE](LICENSE)）。下面记的是其中**不是原创**的部分。

---

## 配色数据：窑变 VS Code 主题

`src/themes.js` 是**生成的**，不手写。它从 <https://github.com/Sum-su/yaobian-theme>
的 72 个 VS Code 主题里取角色色，投影成 Zotero 的两个契约：

- 阅读器的 4 字段主题（`background` / `foreground`）
- 主窗口的 `--material-*` / `--fill-*` / `--accent-*` 变量组

那个仓库也是 MIT，作者同为 Sum-su，所以同源同许可。

### 这些配色的上游

36 套色板**几乎都不是原创**。逐条的出处记在 VS Code 仓库的
[NOTICE.md](https://github.com/Sum-su/yaobian-theme/blob/main/NOTICE.md) 里；
本仓库重新分发了同一批色值，所以把要点和必需的许可声明一并附在下面。

| 来源 | 作者 | 许可 | 对应家族 |
|---|---|---|---|
| **cherrycss** — <https://github.com/boilcy/cherrycss> | Caiyun Liu ([@boilcy](https://github.com/boilcy)) | MIT，© 2025 Caiyun Liu | 色板定义的总来源 |
| linux.do [t/325119](https://linux.do/t/topic/325119) | linux.do 用户 **imkekeaiai** | 未声明 | 25 款中国风，另有莫奈、奶茶、青花 |
| **Dracula** — <https://github.com/dracula/dracula-theme> | Dracula Theme, created by Zeno Rocha | **MIT**，© 2023 Dracula Theme | Dracula |
| **Vitesse Soft** — <https://github.com/antfu/vscode-theme-vitesse> | Anthony Fu ([@antfu](https://github.com/antfu))，基于 GitHub 的 Primer 主题 | **MIT**，© 2020 Primer、© 2021 Anthony Fu | Vitesse Soft |
| linux.do [t/432753](https://linux.do/t/topic/432753) | **404nyaFound**（深色版由 **LostMyHead** 提供） | 未声明 | 歌蕾蒂娅·返航 |
| linux.do [t/472763](https://linux.do/t/topic/472763) | **EDWINCHENC** | 未声明 | Claude |
| cherrycss [issue #28](https://github.com/boilcy/cherrycss/issues/28) | GitHub 用户 **hailey07** | 未单独声明（并入 cherrycss 的 MIT 仓库） | Peppa |
| cherrycss [PR #16](https://github.com/boilcy/cherrycss/pull/16) | GitHub 用户 **HPUhushicheng** | 同上 | 暮山紫 |
| cherrycss [PR #13](https://github.com/boilcy/cherrycss/pull/13) | GitHub 用户 **Lucas04-nhr** | 同上 | Pulse（脉动交互） |
| [Color Hunt](https://colorhunt.co/palette/519d9e58c9b99dc8c8d1b6e1) | — | Color Hunt 声明其色板为公共财产 | Mint |
| 未能查到 | — | 不明 | Dopamine |

本仓库**只取了颜色值**：源主题的 CSS、动画、字体、布局一概没用。若你是上述作者，
希望改署名或撤下某一款，开个 issue 即可。

同名主题的**名称**（Peppa、歌蕾蒂娅、Claude 等）只用于指认配色来源，不含任何关联或授权含义；
相关商标归各自权利人所有。

### 必需的许可全文

#### cherrycss

```text
MIT License

Copyright (c) 2025 Caiyun Liu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### Dracula Theme

```text
MIT License

Copyright (c) 2023 Dracula Theme

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

#### Vitesse Theme

```text
MIT License

Copyright (c) 2020 Primer
Copyright (c) 2021 Anthony Fu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

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
