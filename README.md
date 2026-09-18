# 窑变 for Zotero

Puts the 窑变 palette into Zotero — **reader**, **library chrome**, and an
optional **wallpaper with frosted glass** — plus the light/dark switch the
reader is missing.

## Why a plugin at all

Zotero has two separate theming surfaces and they behave nothing alike:

| | 阅读器 (reader) | 界面 (library / sidenav) |
|---|---|---|
| Official extension point | **yes** — the `+` in 主题 | no |
| Requires a restart | no — hot | yes, if you do it by hand |
| Contract | 4 fields | ~24 `--material-*` / `--fill-*` vars |

The reader surface is a real API: a theme is
`{id, label, background, foreground, invertImages?}` stored in
`Zotero.SyncedSettings` under `readerCustomThemes`, with the selection in the
`reader.lightTheme` / `reader.darkTheme` prefs. But it has no *catalog* — every
theme you add becomes another swatch in that little popup, three per row. 36
families x 2 would be 24 rows of tiles.

So the plugin owns two slots and rewrites them when you pick a family. The
native swatch list always shows exactly the family you chose
(`青瓷·浅` / `青瓷·深`), while all 36 families live in the Tools menu.

The 界面 surface has no extension point, so this plugin does what a
`userChrome.css` does — injects a stylesheet — but it does it at **author
level, hot**, from inside the app, instead of at user level behind a restart.

## Two ways in

**设置 → 窑变** — a full pane: the family drop-down (with a live swatch strip of
the current scheme's role colours), the light/dark switch, and the wallpaper
controls with the image path and the opacity slider.

**工具 → 窑变** — the same controls as a menu, for when the settings window is
not open. Both are views onto the same prefs, and either one updates the other
immediately; neither owns the state.

Everything below applies to both.

The 设置 window is themed too — it is a separate top-level window, and it was
left on Zotero's stock palette until this was noticed. It follows the family,
but never the wallpaper: see the API notes for why it stays opaque.

## What it does

**工具 → 窑变 → \<family\>** — three things at once, hot:

1. writes that family's light/dark pair into Zotero's own reader-theme store
   and switches the reader to it (open readers update, no reload);
2. recolours the library chrome by mapping the family's VS Code role colours
   onto Zotero's variables;
3. if a wallpaper is on, re-tints the translucent surfaces to match.

**工具 → 窑变 → 深浅 → 跟随系统 / 浅色 / 深色** sets
`browser.theme.toolbar-theme` (2 / 1 / 0), which is Zotero's own appearance
preference. The reader derives its scheme from the window's
`prefers-color-scheme`, so this recolours the library *and* every open reader
at once, and it is the same setting as 设置 → 外观.

**工具 → 窑变 → 壁纸** — 选择图片… / 清除 / 启用 / 透明度 (0–90%).

| 透明度 | 效果 |
|---|---|
| 0% | 等于关掉（图片不显示，界面不透明） |
| 30% | 默认。界面 70% 不透明，工具栏额外加一层并 `backdrop-filter` |
| 90% | 几乎只剩图 |

The image is drawn on a `pointer-events: none` layer inside
`#zotero-pane-stack`; the window's own background goes translucent by the same
amount, so the veil is uniform across the whole window, and the toolbars get a
blur on top of it. One knob drives veil and blur radius together.

Only `cover` sizing, one image shared by both schemes.

## What it does not touch

- Custom reader themes you made by hand. The plugin only ever rewrites entries
  whose id is `custom-yaobian-light` / `custom-yaobian-dark`.
- `userContent.css` (reader / pdf.js / note editor) — still yours, still works.
- Windows' own window material (Mica). See NOTICE.md for why.

### If you have a userChrome.css

**Remove the colour mappings from it, or the plugin's 界面 layer will do
nothing.** User-level `!important` beats author-level `!important` in Gecko, so
a `userChrome.css` that sets the same variables wins unconditionally and the
plugin's stylesheet becomes dead code. That is what the shipped stub in the
profile says. Everything is hot once it is gone.

## Files

```
src/gen_themes.py    reads the 72 generated VS Code themes -> src/themes.js
src/gen_icons.py     regenerates src/icons/ from a source photo (not run by build.py)
src/themes.js        generated; do not hand-edit
src/manifest.json    id yaobian@zotero
src/bootstrap.js     menu, pane controller, applyFamily, applyScheme, chromeCSS, wallpaper
src/prefs.xhtml      the 设置 -> 窑变 pane (an XHTML fragment, not a document)
src/prefs.js         extensions.yaobian.* defaults
src/icons/           icon-48.png / icon-96.png, declared in manifest.json
build.py             regenerates themes.js, then zips src/ -> yaobian.xpi
updates.json         the update manifest Zotero fetches (repo root, NOT packed into the xpi)
NOTICE.md            third-party provenance (the wallpaper design)
CONTRIBUTORS.md      who wrote what
```

`updates.json` is what `applications.zotero.update_url` in the manifest points at. It is
written by hand and lives outside `src/`, so `build.py` never packs it and editing it cannot
invalidate the `update_hash` it contains. Whenever a release is published, its
`update_link` / `update_hash` are updated to the new asset.

`gen_icons.py` is deliberately not part of `build.py`: the icons only change when
the artwork does, and wiring it in would make every build depend on a file that
lives outside the repo.

The palette source of truth is `C:/temp/yaobian-vscode/themes`, the output of
the same `cherry.py -> roles.py -> gen.py` pipeline that produces the VS Code
extension. The reader takes two of those colours; the chrome layer takes ten
role colours and derives the rest with `color-mix`, so all 36 families work
without per-family tuning.

## Build and install

```
python build.py
```

Then in Zotero: 工具 → 插件 → ⚙ → Install Plugin From File… → `yaobian.xpi`.

## API notes worth keeping

- **`Zotero.Prefs.get/set` prepend `extensions.zotero.` unless you pass
  `global=true`** (`xpcom/prefs.js`: `pref = global ? pref : PREF_BRANCH + pref`).
  Ours live under `extensions.yaobian.*`, so they all go through `ybGet`/`ybSet`.
  Getting this wrong is silent: v0.1/0.2 wrote the family pref one level too
  deep and it still worked, because both sides used the same wrong key.
  `migratePhantomFamilyPref()` cleans that up once.
- `Zotero.SyncedSettings` (not a pref) holds the themes, so they **sync to your
  Zotero account**. Selecting one is a pref.
- Writing `reader.lightTheme` directly does **not** reach already-open readers —
  only `customThemes` has a SyncedSettings observer. Hence the explicit
  `internalReader.setLightTheme()` push in `pushToOpenReaders()`.
- `internalReader.setCustomThemes()` needs a `cloneInto(..., reader._iframeWindow)`
  — the reader runs in an iframe compartment.
- `Zotero.Prefs.set(name || false)` is why an unset theme pref reads back as
  the *string* `"false"`, not a boolean.
- The main-window stylesheet is scoped to `#main-window`, not `:root`: Zotero
  copies main-window `<style>` elements into sub-documents, and `#main-window`
  does not match a reader's `<html>`.
- **设置 is a second chrome window, not part of the main one.** It has its own
  document (`preferences.xhtml`) and its own root id — `#zotero-prefs`, not
  `#main-window` — so a theme scoped to the main window leaves it on Zotero's
  stock palette, including the pane this plugin itself lives in. It gets its
  own stylesheet, written against `#zotero-prefs`.
- That stylesheet is written **opaque**, even while a wallpaper is showing.
  Translucency only reads as frosted when there is an image behind it, and
  `backdrop-filter` samples within one window; nothing of the main window's
  wallpaper is reachable from another toplevel. A translucent 设置 would show
  the desktop, not the image. (Same reasoning as the menus.)
- **`location.reload()` on a chrome window replaces its global**, so a listener
  or a marker property parked on the window object is gone when it comes back.
  Zotero reloads 设置 itself — `PreferencePanes.register()` ends in
  `_refreshPreferences()` — which is how a stylesheet written during `startup()`
  disappears moments later. The one notification that survives it, measured
  with a probe across `domwindowopened`, `document-loaded`,
  `xul-window-registered`, `xul-window-visible` and `nsIWindowMediator`'s three
  callbacks:

  ```
  chrome-document-global-created -> chrome://zotero/content/preferences/preferences.xhtml
  ```

  `domwindowopened` does **not** fire: the toplevel is reused, only the global
  is new.
- `Zotero.FilePicker` **does not exist**. The picker is only reachable as
  `ChromeUtils.importESModule("chrome://zotero/content/modules/filePicker.mjs")`.

### Preference panes (`Zotero.PreferencePanes`)

All of this is read out of `chrome/content/zotero/preferences/preferences.js`
(`_loadPane` / `_initImportedNodesPostInsert`), not from docs:

- `src` is an XHTML **fragment**, parsed by `MozXULElement.parseXULToFragment`.
  XUL is the default namespace; HTML tags need the `html:` prefix.
- **Only `[oncommand]` attributes are converted into real listeners.** Every
  other `on*` attribute is inert markup. So `initPane()` attaches its own
  listeners rather than relying on `onchange`/`oninput` in the markup.
- The one hook that does fire is `load` on the fragment root, carrying
  `event.waitUntil` for async init. That is why the root element has `onload`.
- **Do not pass `scripts`.** Pane scripts run in a `Cu.Sandbox` whose prototype
  is the window, so a global declared there is invisible to the markup's inline
  handlers (compiled in the *window* scope). Going through `Zotero.Yaobian` --
  set by bootstrap.js, which can write to the real `Zotero` -- sidesteps it.
- **Do not use `preference="..."` on int prefs.** Zotero's loader binds it with
  `Zotero.Prefs.set(key, value, true)`, and `Prefs.set` dispatches on the
  *existing* pref type (`xpcom/prefs.js`): an int pref handed the string from a
  menulist or input throws. `browser.theme.toolbar-theme` and our opacity are
  both ints, so the pane calls `Number()` and goes through the same apply
  functions as the menu.
- A `menulist` must hold its items in a **`menupopup` child**. Appending
  `menuitem`s straight to the menulist renders all of them inline and spilling
  out of the control -- it reads like a styling bug but it is structural.
  (`buildQuickCopyFormatDropDown` in `preferences_export.js` is the model.)
- **`<scale>` does not exist any more** -- no `scale {}` rule and no
  `MozXULScaleElement` anywhere in the app's `omni.ja`, and Zotero's own panes
  contain no slider at all. The opacity control is an `html:input type="range"`.
- `register()` with a fixed `id` is what keeps hot reloads from stacking
  duplicate sidebar entries: startup runs again on reload, and Zotero's shutdown
  observer does not fire on that path, so without the `unregister()` first each
  reload would mint another `plugin-pane-<random>-<pluginID>`.
- Leaving out `label`/`image` makes Zotero fall back to the manifest's plugin
  name and icon -- which is why the pane's sidebar icon is `icons/icon-48.png`.
