# 开发笔记

[README](../README.md) 面向使用者；这里记的是改这个插件时需要知道的东西：Zotero 的两套主题接口、偏好面板的加载机制、以及几个踩过的坑。大部分是从 Zotero 实际加载出来的源码和行为里读出来的，不是从文档。

## 为什么需要插件

Zotero 有两个互不相干的主题界面，行为完全不一样：

|  | 阅读器 | 界面（书库 / 侧栏） |
|---|---|---|
| 官方扩展点 | **有** —— 主题里的 `+` | 没有 |
| 改完要重启吗 | 不用，热生效 | 手改的话要 |
| 接口规模 | 4 个字段 | 约 24 个 `--material-*` / `--fill-*` 变量 |

阅读器那套是真接口：一套主题就是 `{id, label, background, foreground, invertImages?}`，存在 `Zotero.SyncedSettings` 的 `readerCustomThemes` 下，选中的那套记在 `reader.lightTheme` / `reader.darkTheme` 偏好里。但它没有**目录**——每加一套就多一个色块，那个小弹窗一行三个。36 套 × 2 就是 24 行。

所以插件占住两个槽位，选中家族时改写它们。Zotero 原生的主题列表里始终只有你选的那一套（`青瓷·浅` / `青瓷·深`），36 套则放在工具菜单里。

界面那套没有扩展点，插件做的事和 `userChrome.css` 一样——注入样式表——只是改成**author 层、热更新**，在应用内部完成，而不是 user 层、改完重启。

## 阅读器接口

- **`Zotero.Prefs.get/set` 默认会加 `extensions.zotero.` 前缀**，除非传 `global=true`（`xpcom/prefs.js`：`pref = global ? pref : PREF_BRANCH + pref`）。本插件的偏好都在 `extensions.yaobian.*` 下，所以一律走 `ybGet`/`ybSet`。搞错了是静默失败：v0.1/0.2 把家族偏好写深了一层却照样能用，因为读写两侧用的是同一个错键。`migratePhantomFamilyPref()` 负责清理一次。
- 主题存在 `Zotero.SyncedSettings`（不是偏好）里，所以**会同步到你的 Zotero 账号**；而「当前选中哪一套」是个偏好。
- 直接写 `reader.lightTheme` **到不了已经打开的阅读器**——只有 `customThemes` 上有 SyncedSettings 观察者。这就是 `pushToOpenReaders()` 里要显式调 `internalReader.setLightTheme()` 的原因。
- `internalReader.setCustomThemes()` 需要 `cloneInto(..., reader._iframeWindow)`——阅读器跑在独立的 iframe compartment 里。
- `Zotero.Prefs.set(name || false)` 是为什么没设过的主题偏好读回来是**字符串** `"false"` 而不是布尔值。
- 主窗口的样式表作用域写成 `#main-window` 而不是 `:root`：Zotero 会把主窗口的 `<style>` 复制进子文档，而 `#main-window` 匹配不到阅读器的 `<html>`。

## 第二个 chrome 窗口：设置

**设置不是主窗口的一部分，是第二个顶层 chrome 窗口**，有自己的 document（`preferences.xhtml`）和自己的根 id —— `#zotero-prefs`，不是 `#main-window`。所以一个只作用于主窗口的主题会把它留在 Zotero 的原始配色上，包括插件自己所在的那个面板。它需要自己的一份样式表，对着 `#zotero-prefs` 写。

那份样式表是**不透明**的，即使开着壁纸。半透明只有在背后有图的时候才像毛玻璃，而 `backdrop-filter` 只在单个窗口内采样——主窗口的壁纸从另一个顶层窗口里够不着。让设置窗口变透明只会露出桌面。菜单同理。

**在 chrome 窗口上 `location.reload()` 会换掉它的 global**，挂在 window 对象上的监听器和标记属性随之消失。Zotero 自己会重载设置窗口——`PreferencePanes.register()` 最后一行是 `_refreshPreferences()`——这就是 `startup()` 期间写进去的 `<style>` 转眼不见的原因。唯一能活过这次重载的通知（用一个探针把 `domwindowopened`、`chrome-document-global-created`、`document-loaded`、`xul-window-registered`、`xul-window-visible` 和 `nsIWindowMediator` 的三个回调全试了一遍，只有一个触发）：

```
chrome-document-global-created -> chrome://zotero/content/preferences/preferences.xhtml
```

`domwindowopened` **不会**触发：toplevel 被复用了，只有 global 是新的。

## 偏好面板（`Zotero.PreferencePanes`）

以下全部读自 `chrome/content/zotero/preferences/preferences.js` 的 `_loadPane` / `_initImportedNodesPostInsert`，不是文档：

- `src` 是一个 XHTML **片段**，由 `MozXULElement.parseXULToFragment` 解析。默认命名空间是 XUL，HTML 标签要加 `html:` 前缀。
- **只有 `[oncommand]` 属性会被转成真正的监听器。** 其它 `on*` 属性都是死的标记。所以 `initPane()` 自己挂监听器，不依赖标记里的 `onchange`/`oninput`。
- 唯一会触发的是片段根元素上的 `load`，带 `event.waitUntil` 供异步初始化。这就是根元素上有 `onload` 的原因。
- **不要传 `scripts`。** 面板脚本跑在一个 prototype 是 window 的 `Cu.Sandbox` 里，在那里声明的全局对标记里的内联处理器（编译在 *window* 作用域）不可见。通过 `Zotero.Yaobian` 中转可以绕开——它由 bootstrap.js 设置，而 bootstrap.js 能写真正的 `Zotero`。
- **不要给 int 偏好用 `preference="..."`。** Zotero 的加载器用 `Zotero.Prefs.set(key, value, true)` 绑它，而 `Prefs.set` 按**已有**的偏好类型分派（`xpcom/prefs.js`）：一个 int 偏好拿到 menulist 或 input 传来的字符串会抛错。`browser.theme.toolbar-theme` 和本插件的透明度都是 int，所以面板里先 `Number()`，再走和菜单一样的 apply 函数。
- `menulist` 的条目必须放在 **`menupopup` 子元素**里。直接把 `menuitem` 挂在 menulist 上会把它们全部内联渲染并溢出控件——看起来像样式 bug，其实是结构问题。（范本是 `preferences_export.js` 里的 `buildQuickCopyFormatDropDown`。）
- **`<scale>` 已经不存在了**——应用自己的 `omni.ja` 里既没有 `scale {}` 规则也没有 `MozXULScaleElement`，Zotero 自带面板里一个滑块都没有。透明度控件是 `html:input type="range"`。
- `register()` 传固定 `id` 是热重载不堆叠侧栏条目的原因：重载会再跑一次 startup，而 Zotero 的 shutdown 观察者在这条路径上不触发，不先 `unregister()` 的话每次重载都会多生一个 `plugin-pane-<random>-<pluginID>`。
- 不写 `label`/`image` 会让 Zotero 回退到清单里的插件名和图标——这就是面板侧栏图标是 `icons/icon-48.png` 的原因。

## 其它

- `Zotero.FilePicker` **不存在**。文件选择器只能通过 `ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs")` 拿到。
- 壁纸的 `pointer-events: none` 图层画在 `#zotero-pane-stack` 里；让窗口自身背景按同样比例变透明，遮罩才会均匀铺满整个窗口。

## 按键名读偏好（排查用）

在 Zotero 的「高级 → 开发者 → Run JavaScript」里：

```js
const p = k => Zotero.Prefs.get("extensions.yaobian." + k, true);
JSON.stringify({ family: p("family"), on: p("wallpaper.enabled"), path: p("wallpaper.path") });
```

注意 `wallpaper()` 只有在**启用且路径可读且透明度非 0** 时才真的画图；三个条件缺一个就当作没开。所以「启用了但没图」通常是路径空了或文件被移走了。
