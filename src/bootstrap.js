/* 窑变 (Yaobian) for Zotero -- bootstrap.js
 *
 * Four jobs, all riding on things Zotero already owns:
 *
 *   1. 主题家族 -- writes exactly two custom themes into Zotero's own
 *      reader-theme store (SyncedSettings "readerCustomThemes"): the picked
 *      family's light and dark pair. The reader's native swatch list then
 *      shows just those two, so it stays usable no matter how many families
 *      we ship. Themes we own are tagged with our own ids and are the only
 *      entries we ever touch -- hand-made ones ("绿", "青", ...) survive.
 *
 *   2. 深浅 -- sets Zotero's own appearance pref, browser.theme.toolbar-theme
 *      (2 = 跟随系统, 1 = 浅色, 0 = 深色). The reader resolves its scheme from
 *      the window's prefers-color-scheme media query, so flipping this one
 *      pref recolours the library AND every open reader, live.
 *
 *   3. 界面 -- injects a <style> into each main window that maps the picked
 *      family's VS Code role colours onto Zotero's --material-* / --fill-* /
 *      --accent-* variables. This is what used to need a hand-written
 *      userChrome.css plus a restart; here it is hot.
 *
 *   4. 壁纸与毛玻璃 -- optionally paints a user-chosen image behind the pane
 *      stack and turns the surfaces translucent so it shows through, with
 *      backdrop-filter on the toolbars for the frosted look. The design
 *      (layer element, the surface list, the single opacity knob) follows
 *      endoretic/zotero-wallpaper, MIT -- see NOTICE.md.
 *
 * The reader theme object is only ever {id, label, background, foreground}
 * plus an optional invertImages -- see ThemePopup.handleSave in
 * resource/reader/reader.js.
 */

var Yaobian;

const YB_FAMILY_PREF = "extensions.yaobian.family";
const YB_LIGHT_ID = "custom-yaobian-light";
const YB_DARK_ID = "custom-yaobian-dark";
const YB_SCHEME_PREF = "browser.theme.toolbar-theme"; // 2 auto / 1 light / 0 dark
const YB_MENU_ID = "yaobian-menu";
const YB_CHROME_ID = "yaobian-chrome";
const YB_WALLPAPER_ID = "yaobian-wallpaper";
const YB_PANE_ID = "yaobian-pane";
const YB_XHTML_NS = "http://www.w3.org/1999/xhtml";
// 设置 is its own top-level XUL window (windowtype "zotero:pref", root id
// #zotero-prefs), not a child of the main window. Everything here used to be
// scoped to #main-window, so that window got Zotero's stock palette -- even
// the pane this plugin lives in.
const YB_PREFS_ID = "zotero-prefs";
const YB_CHROME_ROOTS = ["main-window", YB_PREFS_ID];

const YB_WP_PATH = "extensions.yaobian.wallpaper.path";
const YB_WP_ON = "extensions.yaobian.wallpaper.enabled";
const YB_WP_OPACITY = "extensions.yaobian.wallpaper.opacity";
// One knob drives 界面半透明程度 and the blur radius together, like
// zotero-wallpaper's slider: 0 = 完全不透明（等于没开壁纸）, 90 = 几乎只剩图.
const YB_WP_STEPS = [0, 15, 30, 45, 60, 75, 90];
const YB_WP_DEFAULT_OPACITY = 30;

/* Zotero 自己那三项被接管的偏好：写进去之前先记原值（见 prefSnapshot()）。
 * 它们都不在 extensions.yaobian.* 下，也都不在 prefs.js 里声明 —— 声明了默认值
 * 就等于永远"记过"，快照再也存不进去。 */
const YB_SAVED_PREFIX = "extensions.yaobian.saved.";
const YB_OWNED_PREFS = [
	["extensions.zotero.reader.lightTheme", YB_SAVED_PREFIX + "reader.lightTheme"],
	["extensions.zotero.reader.darkTheme", YB_SAVED_PREFIX + "reader.darkTheme"],
	[YB_SCHEME_PREF, YB_SAVED_PREFIX + "toolbar-theme"],
];
// 禁用之后再启用要不要把配色接回来，看这个标记；退出/升级不置它。
const YB_REAPPLY_PREF = "extensions.yaobian.reapply";
// Firefox bootstrap API 的 reason（Zotero 传的是同一套数字，别的插件都用
// `reason === APP_SHUTDOWN` 这么判）：1 启动 / 2 退出 / 3 启用 / 4 禁用 /
// 5 安装 / 6 卸载 / 7 升级 / 8 降级。
const YB_REASON_DISABLE = 4;
const YB_REASON_UNINSTALL = 6;
// 禁用时把当时选的深浅也记下来，重新启用时接回；退出/升级不记。
const YB_REAPPLY_SCHEME_PREF = "extensions.yaobian.reapply-scheme";

function ybLog(msg) {
	Zotero.debug("[窑变] " + msg);
}

/* Zotero.Prefs.get/set do `pref = global ? pref : "extensions.zotero." + pref`
 * (xpcom/prefs.js). Ours live under extensions.yaobian.*, outside that branch,
 * so they MUST go through here -- a bare Zotero.Prefs.get() would silently read
 * a phantom key and return undefined. Same trap as browser.theme.toolbar-theme.
 * (Zotero's own reader.lightTheme / reader.darkTheme *are* under that branch,
 * so those keep the plain calls.) */
function ybGet(key) {
	return Zotero.Prefs.get(key, true);
}

function ybSet(key, value) {
	return Zotero.Prefs.set(key, value, true);
}

/* v0.1/0.2 read and wrote the family pref through Zotero.Prefs *without*
 * global=true, so it landed one level too deep, at
 * extensions.zotero.extensions.yaobian.family. That was self-consistent
 * (same wrong key on both sides) so it worked -- and hid the bug. Carry the
 * value over once, then drop the phantom. */
function migratePhantomFamilyPref() {
	let phantom = "extensions.zotero." + YB_FAMILY_PREF;
	if (!Services.prefs.prefHasUserValue(phantom)) {
		return;
	}
	let value = Services.prefs.getStringPref(phantom, "");
	if (value && !ybGet(YB_FAMILY_PREF)) {
		ybSet(YB_FAMILY_PREF, value);
		ybLog("migrated family pref from " + phantom + " -> " + value);
	}
	Services.prefs.clearUserPref(phantom);
}

/* ------------------------------- 接管 Zotero 自己的偏好（issue #1） */

/* 主题插件改的不只是自己的东西。除 extensions.yaobian.*，它还写三项**属于
 * Zotero** 的偏好，而 Zotero 在插件没了以后照样照它们渲染：
 *
 *     extensions.zotero.reader.lightTheme     applyFamily()
 *     extensions.zotero.reader.darkTheme      applyFamily()
 *     browser.theme.toolbar-theme             applyScheme()
 *
 * 这就是 issue #1：禁用了、卸掉了，阅读器还是窑变的配色、界面还是深色，而且
 * 界面上没有任何地方能把它们改回去。所以每次写入之前先记一次原值，交还时把
 * 原值放回去 —— 不是挑一个"看起来正常"的值，是它原来的那一个。
 *
 * 记录存在一个字符串偏好里：没有 = 从没记过（不动），"none" = 原本就没有用户
 * 值（要从头上抹掉），其余是 "<类型>:<值>"。类型必须记：两个阅读器主题是
 * string，browser.theme.toolbar-theme 是 int，拿 getStringPref 读 int 会抛。 */
function prefSnapshot(name) {
	if (!Services.prefs.prefHasUserValue(name)) {
		return "none";
	}
	switch (Services.prefs.getPrefType(name)) {
		case 64: // nsIPrefBranch.PREF_INT
			return "int:" + Services.prefs.getIntPref(name);
		case 128: // nsIPrefBranch.PREF_BOOL
			return "bool:" + Services.prefs.getBoolPref(name);
		default: { // nsIPrefBranch.PREF_STRING
			let value = Services.prefs.getStringPref(name, "");
			// 指向我们自己的主题的那条不是"用户原来的"：从 0.4.x 升上来的人，
			// reader.lightTheme 里存的正是我们的 id，记下来等于把问题存成答案。
			if (value === YB_LIGHT_ID || value === YB_DARK_ID) {
				return "none";
			}
			return "string:" + value;
		}
	}
}

/* 先记先赢。从记下到交还之间，这三个偏好里看到的一直是我们的值；每次 apply 都
 * 重记一遍，就等于把窑变的配色归档成"用户原来用的"。 */
function rememberPref(name, savedKey) {
	if (ybGet(savedKey) !== undefined) {
		return;
	}
	ybSet(savedKey, prefSnapshot(name));
}

function rememberOwnedPref(name) {
	let pair = YB_OWNED_PREFS.find((p) => p[0] === name);
	if (!pair) {
		// 名字写错的话快照会静默地永不发生，问题要等到卸载那天才现形。
		throw new Error("not an owned preference: " + name);
	}
	rememberPref(pair[0], pair[1]);
}

function restorePref(name, savedKey) {
	let saved = ybGet(savedKey);
	if (saved === undefined) {
		return false;
	}
	Services.prefs.clearUserPref(savedKey);
	if (saved === "none") {
		Services.prefs.clearUserPref(name);
		return true;
	}
	let split = saved.indexOf(":");
	let type = saved.slice(0, split);
	let value = saved.slice(split + 1);
	if (type === "int") {
		Services.prefs.setIntPref(name, parseInt(value, 10));
	} else if (type === "bool") {
		Services.prefs.setBoolPref(name, value === "true");
	} else {
		Services.prefs.setStringPref(name, value);
	}
	return true;
}

/* 只删我们两个固定 id 的条目，用户自己手写的主题原样留着。不能拿
 * pushToOpenReaders() 干这个：它最后会无条件把我们的 id 重新选上，正好反着来。 */
function dropOwnedThemes() {
	let libraryID = Zotero.Libraries.userLibraryID;
	let existing = Zotero.SyncedSettings.get(libraryID, "readerCustomThemes");
	if (!Array.isArray(existing)) {
		return;
	}
	let next = existing.filter((t) => t.id !== YB_LIGHT_ID && t.id !== YB_DARK_ID);
	if (next.length === existing.length) {
		return;
	}
	for (let reader of Zotero.Reader._readers) {
		try {
			reader._internalReader.setCustomThemes(
				Components.utils.cloneInto(next, reader._iframeWindow)
			);
		} catch (e) {
			Zotero.logError(e);
		}
	}
	Zotero.SyncedSettings.set(libraryID, "readerCustomThemes", next).catch((e) =>
		Zotero.logError(e)
	);
}

/* 先还偏好，再删条目 —— 顺序有讲究。Zotero 自己会清理（reader.js
 * onSaveCustomThemes）：reader.lightTheme / darkTheme 指向的自定义主题一旦从
 * 列表里消失，它就把偏好 clear 掉。先删条目，刚还回去的用户原选择会被这一下
 * 正好盖掉。
 *
 * SyncedSettings.set 是异步的，而 shutdown() 不能 await。写库语句在第一个 await
 * 之前就排进 Zotero 的数据库队列，所以删条目照样落库；可能丢的是 _cache 更新和
 * Notifier 广播。因此**用户看得见的偏好还原必须同步做完**，不能指望这一段。 */
function revertZoteroPrefs() {
	for (let [name, savedKey] of YB_OWNED_PREFS) {
		try {
			restorePref(name, savedKey);
		} catch (e) {
			Zotero.logError(e);
		}
	}
	try {
		dropOwnedThemes();
	} catch (e) {
		Zotero.logError(e);
	}
}

/* 工具菜单和面板里的"恢复 Zotero 原始配色"：东西全交还，插件留着。清掉家族偏好
 * 之后 applyChrome() 会撤掉样式表和壁纸层，界面立刻回到 Zotero 自己的样子；
 * 再选一个家族就等于重新接管 —— 那时 applyFamily() 把当下的值记成新的"原来"。 */
function restoreOriginalColors() {
	ybSet(YB_FAMILY_PREF, "");
	revertZoteroPrefs();
	refreshChrome();
	syncMenu();
	ybLog("handed the colours back to Zotero");
}


/* 0.4.2 之前没有快照，但旧版早就在用户机器上写下了我们的值：从 0.4.1 升上来
 * 的人，reader.lightTheme / darkTheme 正指着我们两个 id。那不是"用户原来的"
 * 选择，记成 none —— 否则禁用那天什么都还不回去，正是 issue #1 里升级用户的
 * 处境。toolbar-theme 认不出是谁写的（1 也可能是用户自己选的深色），但它既然
 * 跟我们的两个 id 一起出现，就按"跟随系统"交还。 */
function adoptLegacyPrefs() {
	if (ybGet(YB_SAVED_PREFIX + "reader.lightTheme") !== undefined) {
		return; // 0.4.2 之后的生命周期，快照由 apply* 负责
	}
	let light = Services.prefs.getStringPref("extensions.zotero.reader.lightTheme", "");
	let dark = Services.prefs.getStringPref("extensions.zotero.reader.darkTheme", "");
	if (light !== YB_LIGHT_ID && dark !== YB_DARK_ID) {
		return; // 我们没在这台机器上留下过配色
	}
	ybSet(YB_SAVED_PREFIX + "reader.lightTheme", prefSnapshot("extensions.zotero.reader.lightTheme"));
	ybSet(YB_SAVED_PREFIX + "reader.darkTheme", prefSnapshot("extensions.zotero.reader.darkTheme"));
	ybSet(YB_SAVED_PREFIX + "toolbar-theme", "none");
	ybLog("adopted the prefs 0.4.1 left behind");
}

function install() {}

/* 卸载时 uninstall 是第二次机会（禁用那条路在 shutdown 里已经还过一遍）。清掉
 * extensions.yaobian.*：下一次安装不该继承上一个安装的家族和壁纸。 */
function uninstall() {
	try {
		revertZoteroPrefs();
		for (let name of Services.prefs.getChildList("extensions.yaobian.")) {
			Services.prefs.clearUserPref(name);
		}
	} catch (e) {
		Zotero.logError(e);
	}
}

async function startup({ id, version, rootURI }) {
	Yaobian = { id, version, rootURI, themes: [] };

	// themes.js is generated by gen_themes.py; load it into our own scope so
	// YAOBIAN_THEMES lands on Yaobian rather than on the global window.
	let scope = { Yaobian };
	try {
		Services.scriptloader.loadSubScript(rootURI + "themes.js", scope);
		Yaobian.themes = scope.YAOBIAN_THEMES || [];
	} catch (e) {
		Zotero.logError(e);
	}
	ybLog("started, " + Yaobian.themes.length + " families loaded");
	migratePhantomFamilyPref();
	// 从 0.4.1 升上来的人，pref 里还留着我们的值：先认领成"原本没有"，
	// 这样禁用/卸载时才还得回去。
	adoptLegacyPrefs();

	for (let win of Zotero.getMainWindows()) {
		if (!win.ZoteroPane) {
			continue;
		}
		addToWindow(win);
	}
	// 设置 opens later than we do and is not a main window, so nothing else
	// would ever style it.
	Services.obs.addObserver(onChromeDocumentCreated, "chrome-document-global-created");
	refreshChrome();
	ybLog("chrome layer: " + (currentFamily() ? currentFamily().name : "none"));

	// The preferences pane reaches us through Zotero.Yaobian -- the pane's
	// inline handlers are compiled in the *window* scope, while bootstrap.js
	// runs in the bootstrap scope, so nothing here is visible to them
	// otherwise. (Contrast the pane's own script sandbox, which Zotero creates
	// with the window as prototype; that one is reachable from here, not there.)
	exposeAPI();
	await registerPane();

	// 禁用之后再启用：把配色接回来。这个标记就是为此存在的 —— 每次启动都
	// applyFamily() 会覆盖掉用户在交还之后自己手选的阅读器主题。
	if (ybGet(YB_REAPPLY_PREF)) {
		ybSet(YB_REAPPLY_PREF, false);
		let familyId = ybGet(YB_FAMILY_PREF);
		if (familyId) {
			await applyFamily(familyId);
		}
		// applyFamily 只管家族；深/浅是另一条偏好，要单独接回。
		let scheme = ybGet(YB_REAPPLY_SCHEME_PREF);
		if (scheme === "0" || scheme === "1") {
			applyScheme(Number(scheme));
			ybSet(YB_REAPPLY_SCHEME_PREF, "");
		}
	}
}

function shutdown({ id, version, rootURI } = {}, reason) {
	Services.obs.removeObserver(onChromeDocumentCreated, "chrome-document-global-created");
	// chromeWindows() 而不是 getMainWindows()：设置窗口里也有我们贴的样式表，
	// 只清主窗口会让它在禁用之后继续是窑变的颜色。
	for (let win of chromeWindows()) {
		try {
			removeFromWindow(win);
		} catch (e) {
			Zotero.logError(e);
		}
	}
	ybPaneDocs.clear();
	delete Zotero.Yaobian;
	Yaobian = undefined;

	// 禁用（4）和卸载（6）要把 Zotero 自己的东西还回去 —— 那正是 issue #1：
	// 插件没了，pref 还在，界面和阅读器照旧是窑变的颜色。退出（2）和升级（7）
	// 不动：下一次启动还是我们，交还再接管只会闪一下。
	if (reason === YB_REASON_DISABLE || reason === YB_REASON_UNINSTALL) {
		if (reason === YB_REASON_DISABLE) {
			ybSet(YB_REAPPLY_PREF, true);
			// 深/浅是用户选的，重新启用时接回来；2 是"跟随系统"，不用记。
			let scheme = Number(ybGet(YB_SCHEME_PREF));
			ybSet(YB_REAPPLY_SCHEME_PREF, scheme === 0 || scheme === 1 ? String(scheme) : "");
		}
		revertZoteroPrefs();
	}
}

function onMainWindowLoad({ window }) {
	addToWindow(window);
}

function onMainWindowUnload({ window }) {
	removeFromWindow(window);
}

/* ------------------------------------------------------------------ menu */

function addToWindow(win) {
	let doc = win.document;
	if (doc.getElementById(YB_MENU_ID)) {
		return;
	}
	let toolsPopup = doc.getElementById("menu_ToolsPopup");
	if (!toolsPopup) {
		ybLog("no menu_ToolsPopup in this window, skipping menu");
		return;
	}

	let menu = doc.createXULElement("menu");
	menu.id = YB_MENU_ID;
	menu.setAttribute("label", "窑变");

	let popup = doc.createXULElement("menupopup");
	popup.id = YB_MENU_ID + "-popup";

	for (let family of Yaobian.themes) {
		let item = doc.createXULElement("menuitem");
		item.setAttribute("type", "radio");
		item.setAttribute("data-yaobian-family", family.id);
		item.setAttribute(
			"label",
			family.nameEn ? family.name + "  " + family.nameEn : family.name
		);
		item.addEventListener("command", () => applyFamily(family.id));
		popup.appendChild(item);
	}

	popup.appendChild(doc.createXULElement("menuseparator"));

	let submenu = (label) => {
		let menu = doc.createXULElement("menu");
		menu.setAttribute("label", label);
		let sub = doc.createXULElement("menupopup");
		menu.appendChild(sub);
		popup.appendChild(menu);
		return sub;
	};

	let schemePopup = submenu("深浅");
	for (let [label, value] of [["跟随系统", 2], ["浅色", 1], ["深色", 0]]) {
		let item = doc.createXULElement("menuitem");
		item.setAttribute("type", "radio");
		item.setAttribute("label", label);
		item.setAttribute("data-yaobian-scheme", String(value));
		item.addEventListener("command", () => applyScheme(value));
		schemePopup.appendChild(item);
	}

	let wpPopup = submenu("壁纸");
	let choose = doc.createXULElement("menuitem");
	choose.setAttribute("label", "选择图片…");
	choose.addEventListener("command", () => chooseWallpaper());
	wpPopup.appendChild(choose);

	let clear = doc.createXULElement("menuitem");
	clear.setAttribute("label", "清除");
	clear.addEventListener("command", () => clearWallpaper());
	wpPopup.appendChild(clear);

	wpPopup.appendChild(doc.createXULElement("menuseparator"));

	let enabled = doc.createXULElement("menuitem");
	enabled.setAttribute("type", "checkbox");
	enabled.setAttribute("label", "启用");
	enabled.setAttribute("data-yaobian-wp-enabled", "1");
	enabled.addEventListener("command", () => setWallpaperEnabled(!ybGet(YB_WP_ON)));
	wpPopup.appendChild(enabled);

	wpPopup.appendChild(doc.createXULElement("menuseparator"));

	let opacityMenu = doc.createXULElement("menu");
	opacityMenu.setAttribute("label", "透明度");
	let opacityPopup = doc.createXULElement("menupopup");
	for (let value of YB_WP_STEPS) {
		let item = doc.createXULElement("menuitem");
		item.setAttribute("type", "radio");
		item.setAttribute("label", value + "%");
		item.setAttribute("data-yaobian-wp-opacity", String(value));
		item.addEventListener("command", () => setWallpaperOpacity(value));
		opacityPopup.appendChild(item);
	}
	opacityMenu.appendChild(opacityPopup);
	wpPopup.appendChild(opacityMenu);

	popup.appendChild(doc.createXULElement("menuseparator"));

	// 交还 Zotero 自己的配色。东西全还回去，插件留着 —— 想再接管就再选一个
	// 家族。issue #1 里的人要的正是这个：他们的界面已经改不回去了。
	let restore = doc.createXULElement("menuitem");
	restore.setAttribute("label", "恢复 Zotero 原始配色");
	restore.addEventListener("command", () => restoreOriginalColors());
	popup.appendChild(restore);

	menu.appendChild(popup);
	toolsPopup.appendChild(menu);
	syncMenu(win);
	applyChrome(win);
}

function removeFromWindow(win) {
	let menu = win.document.getElementById(YB_MENU_ID);
	if (menu) {
		menu.remove();
	}
	let style = win.document.getElementById(YB_CHROME_ID);
	if (style) {
		style.remove();
	}
	let layer = win.document.getElementById(YB_WALLPAPER_ID);
	if (layer) {
		layer.remove();
	}
}

function syncMenu(win) {
	let family = ybGet(YB_FAMILY_PREF);
	// Second arg = global: Zotero.Prefs prefixes with extensions.zotero. by
	// default, and browser.theme.toolbar-theme lives outside that branch.
	let scheme = String(ybGet(YB_SCHEME_PREF));
	let wins = win ? [win] : Zotero.getMainWindows();
	for (let w of wins) {
		if (!w.ZoteroPane) {
			continue;
		}
		for (let item of w.document.querySelectorAll("[data-yaobian-family]")) {
			item.setAttribute(
				"checked",
				String(item.getAttribute("data-yaobian-family") === family)
			);
		}
		for (let item of w.document.querySelectorAll("[data-yaobian-scheme]")) {
			item.setAttribute(
				"checked",
				String(item.getAttribute("data-yaobian-scheme") === scheme)
			);
		}
		let on = String(!!ybGet(YB_WP_ON));
		let opacity = String(ybGet(YB_WP_OPACITY));
		for (let item of w.document.querySelectorAll("[data-yaobian-wp-enabled]")) {
			item.setAttribute("checked", on);
		}
		for (let item of w.document.querySelectorAll("[data-yaobian-wp-opacity]")) {
			item.setAttribute(
				"checked",
				String(item.getAttribute("data-yaobian-wp-opacity") === opacity)
			);
		}
	}
	// Every mutator already ends in syncMenu(), so this is the one place that
	// keeps the preferences pane in step with the Tools menu. Both are views
	// onto the same prefs; neither owns the state.
	notifyPane();
}

/* ------------------------------------------------------------ wallpaper */

async function chooseWallpaper() {
	// Zotero.FilePicker does not exist -- the picker is only reachable as an
	// ES module (Zotero 10's replacement for the old nsIFilePicker).
	let { FilePicker } = ChromeUtils.importESModule(
		"chrome://zotero/content/modules/filePicker.mjs"
	);
	let picker = new FilePicker();
	picker.init(
		Zotero.getMainWindows().find((w) => w.ZoteroPane),
		"选择背景图片",
		picker.modeOpen
	);
	picker.appendFilter("图片", "*.avif; *.bmp; *.gif; *.jpg; *.jpeg; *.png; *.webp");
	if ((await picker.show()) !== picker.returnOK) {
		return;
	}
	ybSet(YB_WP_PATH, picker.file);
	ybSet(YB_WP_ON, true);
	if (!ybGet(YB_WP_OPACITY)) {
		ybSet(YB_WP_OPACITY, YB_WP_DEFAULT_OPACITY);
	}
	refreshChrome();
	syncMenu();
	ybLog("wallpaper -> " + picker.file);
}

function clearWallpaper() {
	ybSet(YB_WP_PATH, "");
	ybSet(YB_WP_ON, false);
	refreshChrome();
	syncMenu();
}

function setWallpaperEnabled(on) {
	ybSet(YB_WP_ON, !!on);
	refreshChrome();
	syncMenu();
}

function setWallpaperOpacity(value) {
	ybSet(YB_WP_OPACITY, value);
	refreshChrome();
	syncMenu();
}

/* --------------------------------------------------------------- chrome */

/* The main window's colour contract, reverse-engineered in
 * zotero-usertheme-chrome-css: ~20 variables on the root element drive
 * everything, and they inherit through shadow roots, so overriding the root
 * is enough. --material-border is a whole shorthand, not a width.
 *
 * This lives at author level (a <style> in the window) rather than user
 * level (userChrome.css). Zotero's own root rules are author-normal, so
 * coming later in document order wins. Anything left in a userChrome.css
 * is user level and would still beat us -- hence the note in README.md.
 *
 * Scoped to #main-window, not :root: Zotero copies main-window <style>
 * elements into sub-documents (readers, note editor), and those documents
 * have their own --color-* palette we must not stomp on. #main-window does
 * not match them.
 */

function mix(color, percent) {
	return "color-mix(in srgb, " + color + " " + percent + "%, transparent)";
}

function blend(color, percent, into) {
	return "color-mix(in srgb, " + color + " " + percent + "%, " + into + ")";
}

function palette(role, wp) {
	// wp = { opacity } while a wallpaper is showing; surfaces then go
	// translucent so the image comes through, and toolbars stay twice as
	// opaque as the rest so text on them keeps its contrast.
	//
	// Popups deliberately do NOT go translucent: XUL menupopups are separate
	// native windows, so there is no wallpaper behind them to blend with --
	// they would just show the desktop through the menu.
	let surface = (c) => (wp ? mix(c, 100 - wp.opacity) : c);
	let bar = (c) => (wp ? mix(c, 100 - wp.opacity / 2) : c);
	return [
		// -- 调色板：全部来自该家族的 VS Code 角色色
		"--yb-bg: " + surface(role.background),
		"--yb-side: " + surface(role.side),
		"--yb-toolbar: " + bar(role.side),
		"--yb-tab: " + surface(role.tab),
		"--yb-surface: " + role.surface,
		"--yb-ink: " + role.foreground,
		"--yb-ink-2: " + role.ink2,
		"--yb-ink-3: " + role.ink3,
		"--yb-line: " + role.line,
		"--yb-accent: " + role.accent,
		"--yb-select: " + role.select,
		// -- 派生：让 36 个家族不必逐个手调
		"--yb-menu: " + mix(role.surface, 92),
		"--yb-azure: " + blend(role.accent, 70, role.background),
		"--yb-quaternary: " + blend(role.foreground, 16, role.background),
		"--yb-quinary: " + blend(role.foreground, 9, role.background),
	];
}

const YB_MAPPING = [
	// -- 面
	"--material-background: var(--yb-bg)",
	"--material-sidepane: var(--yb-side)",
	"--material-toolbar: var(--yb-toolbar)",
	"--material-tabbar: var(--yb-tab)",
	"--material-menu: var(--yb-menu)",
	"--material-border: 1px solid var(--yb-line)",
	"--material-accent: var(--yb-accent)",
	// -- 字
	"--fill-primary: var(--yb-ink)",
	"--fill-secondary: var(--yb-ink-2)",
	"--fill-tertiary: var(--yb-ink-3)",
	"--fill-quaternary: var(--yb-quaternary)",
	"--fill-quinary: var(--yb-quinary)",
	// -- 强调色：选中 / 链接 / 进度
	"--color-accent: var(--yb-accent)",
	"--color-background: var(--yb-bg)",
	"--accent-blue: var(--yb-accent)",
	"--accent-azure: var(--yb-azure)",
	// -- Firefox 侧：弹窗与窗口底色
	"--arrowpanel-background: var(--yb-surface)",
	"--arrowpanel-color: var(--yb-ink)",
	"--arrowpanel-border-color: var(--yb-line)",
	"--toolbar-bgcolor: var(--yb-toolbar)",
	"--toolbar-color: var(--yb-ink)",
	"--lwt-accent-color: var(--yb-toolbar)",
	"--lwt-selected-tab-background-color: var(--yb-bg)",
	"--tabpanel-background-color: var(--yb-bg)",
];

/* Everything that paints its own opaque background instead of following
 * --material-*. Without this the wallpaper is simply hidden behind these.
 * Selector list adapted from endoretic/zotero-wallpaper (MIT) -- see
 * NOTICE.md. Kept as-is rather than re-derived: it is the empirically
 * tested answer for Zotero 10's pane stack. */
const YB_GLASS_SURFACES = [
	"#tabs-deck", "#tabs-deck > browser", "#tabs-deck > iframe", "#zotero-pane",
	"#zotero-pane #zotero-trees", "#zotero-pane #zotero-layout-switcher",
	"#zotero-pane #zotero-collections-pane",
	"#zotero-pane #zotero-collections-tree-container",
	"#zotero-pane #zotero-tag-selector-container",
	"#zotero-pane #zotero-items-pane-container", "#zotero-pane #zotero-items-pane",
	"#zotero-pane #zotero-items-tree", "#zotero-pane #zotero-item-pane",
	"#zotero-pane #zotero-item-pane-content",
	"#zotero-pane .virtualized-table-container", "#zotero-pane .virtualized-table",
	"#zotero-pane .virtualized-table-header", "#zotero-pane .virtualized-table .body",
	"#zotero-pane .item-pane-content", "#zotero-pane .zotero-view-item-main",
	"#zotero-pane .item-details", "#zotero-pane item-details",
];

function wallpaperCSS(wp) {
	// The frosted part. depth scales with the transparency knob so the two
	// feel like one control: 30% -> 4px (the value zotero-wallpaper ships).
	let blur = Math.max(2, Math.round(wp.opacity / 7));
	let list = (sels, body) => sels.map((s) => "#main-window " + s).join(",\n") + " {\n" + body + "\n}\n";
	return (
		list(YB_GLASS_SURFACES, "\tbackground-color: transparent !important;\n\tbackground-image: none !important;") +
		list(
			[
				"#zotero-pane .virtualized-table .row:not(.selected):not(:hover)",
				"#zotero-pane .virtualized-table .row:not(.selected):not(:hover) .cell",
			],
			"\tbackground-color: transparent !important;"
		) +
		list(
			[".zotero-toolbar", "#zotero-context-pane-sidenav"],
			"\tbackdrop-filter: blur(" + blur + "px);"
		)
	);
}

/* The wallpaper layer itself. #zotero-pane-stack is already position:relative
 * in Zotero 10, so all this adds is the isolation that gives backdrop-filter
 * something of its own to sample. */
const YB_LAYER_CSS =
	"#main-window #zotero-pane-stack {\n\tisolation: isolate;\n}\n" +
	"#main-window #" + YB_WALLPAPER_ID + " {\n" +
	"\tposition: absolute;\n\tinset: 0;\n\tz-index: 0;\n" +
	"\toverflow: hidden;\n\tpointer-events: none;\n}\n" +
	"#main-window #" + YB_WALLPAPER_ID + " > div {\n\tposition: absolute;\n\tinset: 0;\n}\n" +
	// Lift the siblings above the layer. The tooltip is deliberately left
	// out: it is position:fixed, and forcing `relative` onto it (which a
	// blanket :not() rule does) breaks where the native tooltip lands.
	"#main-window #zotero-pane-stack > :not(#" + YB_WALLPAPER_ID + "):not(#html-tooltip) {\n" +
	"\tposition: relative;\n\tz-index: 1;\n}\n";

/* The colour contract is the same in every chrome window, so it is written
 * once per window against that window's own root. `wp` is the one thing that
 * is NOT shared: only the main window has a wallpaper layer, and translucent
 * surfaces with no image behind them just show the desktop. */
function paletteBlock(family, wp, selector) {
	let decls = (list) => list.map((d) => "\t" + d + " !important;").join("\n");
	return (
		selector + " {\n" +
		decls(palette(family.light, wp).concat(YB_MAPPING)) +
		"\n}\n" +
		// Deep/shallow is Zotero's own 外观 setting; it drives this media query.
		"@media (prefers-color-scheme: dark) {\n" +
		selector + " {\n" +
		decls(palette(family.dark, wp)) +
		"\n}\n}\n"
	);
}

function cssHeader(family, wp) {
	let header =
		"/* 窑变 · " + family.name + (wp ? " + 壁纸 " + wp.opacity + "%" : "") +
		" -- generated by bootstrap.js, do not edit */\n";
	header +=
		"/* 只要这个 <style> 还在，界面就归插件管；userChrome.css 里别再写同一批变量 */\n";
	return header;
}

function chromeCSS(family, wp) {
	if (!family) {
		return "";
	}
	return (
		cssHeader(family, wp) +
		YB_LAYER_CSS +
		paletteBlock(family, wp, "#main-window") +
		// The one structural rule: Zotero's selected rows are neutral grey.
		"#main-window #zotero-items-tree .selected,\n" +
		"#main-window #zotero-collections-tree .selected {\n" +
		"\tbackground-color: var(--yb-select) !important;\n}\n" +
		(wp ? wallpaperCSS(wp) : "")
	);
}

/* 设置窗口。这里没有壁纸层可透，所以永远拿不透明的那一套——同一批颜色，
 * 只是 surface() 不掺透明。毛玻璃在这边也无从谈起：它是独立的顶层窗口，
 * backdrop-filter 只能采样同一个窗口里的内容，而窗口里没有图。 */
function prefsCSS(family) {
	if (!family) {
		return "";
	}
	return (
		cssHeader(family, null) +
		paletteBlock(family, null, "#" + YB_PREFS_ID)
	);
}

/* ------------------------------------------------------------ wallpaper */

function wallpaper() {
	// Returns { opacity } only when a wallpaper should actually be painted;
	// null means "no wallpaper", which is also how the pref defaults read.
	if (!ybGet(YB_WP_ON)) {
		return null;
	}
	let path = ybGet(YB_WP_PATH);
	if (!path || !isReadableFile(path)) {
		return null;
	}
	let opacity = Number(ybGet(YB_WP_OPACITY));
	if (!Number.isFinite(opacity)) {
		opacity = YB_WP_DEFAULT_OPACITY;
	}
	opacity = Math.min(90, Math.max(0, opacity));
	if (!opacity) {
		// 0% must mean "off", not "surfaces opaque but the content area still
		// forced transparent" -- the content-area overrides in wallpaperCSS
		// are unconditional, so nothing else would hide the image.
		return null;
	}
	return { path, opacity };
}

function isReadableFile(path) {
	try {
		let file = Zotero.File.pathToFile(path);
		return file.exists() && file.isFile();
	} catch (e) {
		return false;
	}
}

function applyWallpaper(win) {
	let doc = win.document;
	let wp = wallpaper();
	let layer = doc.getElementById(YB_WALLPAPER_ID);

	if (!wp) {
		if (layer) {
			layer.remove();
		}
		return;
	}
	let stack = doc.getElementById("zotero-pane-stack");
	if (!stack) {
		return;
	}
	if (!layer || layer.parentNode !== stack) {
		if (layer) {
			layer.remove();
		}
		layer = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
		layer.id = YB_WALLPAPER_ID;
		let image = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
		layer.appendChild(image);
		stack.prepend(layer);
	}
	let image = layer.firstElementChild;
	let uri = Services.io.newFileURI(Zotero.File.pathToFile(wp.path)).spec;
	if (image.style.backgroundImage !== 'url("' + uri + '")') {
		image.style.backgroundImage = 'url("' + uri + '")';
		image.style.backgroundSize = "cover";
		image.style.backgroundPosition = "center";
		image.style.backgroundRepeat = "no-repeat";
	}
}

/* A <style> we write into a window dies with that window's document, and
 * Zotero reloads the preferences window on its own schedule -- notably from
 * inside our own startup(), where PreferencePanes.register() ends in
 * _refreshPreferences() -> location.reload(). Writing the style once is not
 * enough; the window has to restyle itself when it comes back. Attached
 * once per window and never removed, because the point is to outlive the
 * document. */
function watchWindow(win) {
	if (win.__yaobianWatched) {
		return;
	}
	win.__yaobianWatched = true;
	win.addEventListener("load", () => {
		if (!isThemedWindow(win)) {
			return;
		}
		try {
			applyChrome(win);
		} catch (e) {
			Zotero.logError(e);
		}
	});
}

function applyChrome(win) {
	watchWindow(win);
	let family = currentFamily();
	let isMain = win.document.documentElement.id === "main-window";
	let style = win.document.getElementById(YB_CHROME_ID);
	if (!family) {
		if (style) {
			style.remove();
		}
		// 交还之后壁纸层也不能留：没有我们的半透明规则，它只会被压在内容后面
		// 白画，还继续跟着窗口 resize。
		let layer = win.document.getElementById(YB_WALLPAPER_ID);
		if (layer) {
			layer.remove();
		}
		return;
	}
	if (!style) {
		style = win.document.createElementNS(YB_XHTML_NS, "style");
		style.id = YB_CHROME_ID;
		win.document.documentElement.appendChild(style);
	}
	// The layer and the glass both need #zotero-pane-stack, which only the
	// main window has -- applyWallpaper() bails on its own if it is missing.
	style.textContent = isMain ? chromeCSS(family, wallpaper()) : prefsCSS(family);
	if (isMain) {
		applyWallpaper(win);
	}
}

function isThemedWindow(win) {
	try {
		let root = win.document && win.document.documentElement;
		return !!root && YB_CHROME_ROOTS.includes(root.id);
	} catch (e) {
		// A window whose document is gone or not yet created.
		return false;
	}
}

/* Zotero.getMainWindows() is main windows only, so it can never return 设置.
 * Walking the window mediator gets both, and the id check keeps everything
 * else (devtools, other extensions' windows) out. */
function chromeWindows() {
	let wins = [];
	for (let win of Services.wm.getEnumerator(null)) {
		if (isThemedWindow(win)) {
			wins.push(win);
		}
	}
	return wins;
}

function refreshChrome() {
	for (let win of chromeWindows()) {
		try {
			applyChrome(win);
		} catch (e) {
			Zotero.logError(e);
		}
	}
}

/* What actually catches 设置, both when it opens and when its document is
 * replaced. Measured rather than assumed -- with a probe listening on
 * domwindowopened, chrome-document-global-created, document-loaded,
 * xul-window-registered, xul-window-visible and nsIWindowMediator's three
 * callbacks, a preferences reload fired exactly one of them:
 *
 *     chrome-document-global-created -> preferences.xhtml
 *
 * domwindowopened does NOT fire: reload() reuses the same toplevel, so the
 * window is never reopened -- it just gets a new global, which is also why
 * anything we park on the old window object (a listener, a marker property)
 * is gone by the time it comes back. Every path therefore goes through
 * watchWindow(), which attaches to whatever window object is current and
 * lets the load handler decide whether it is ours. */
function onChromeDocumentCreated(win) {
	try {
		watchWindow(win);
	} catch (e) {
		// Not a window we can listen on; nothing to style either.
	}
}

function currentFamily() {
	let id = ybGet(YB_FAMILY_PREF);
	return Yaobian.themes.find((f) => f.id === id) || null;
}

/* --------------------------------------------------------------- apply  */

async function applyFamily(familyId) {
	let family = Yaobian.themes.find((f) => f.id === familyId);
	if (!family) {
		ybLog("unknown family " + familyId);
		return;
	}

	let light = {
		id: YB_LIGHT_ID,
		label: family.name + "·浅",
		background: family.light.background,
		foreground: family.light.foreground,
	};
	let dark = {
		id: YB_DARK_ID,
		label: family.name + "·深",
		background: family.dark.background,
		foreground: family.dark.foreground,
	};

	let libraryID = Zotero.Libraries.userLibraryID;
	let existing = Zotero.SyncedSettings.get(libraryID, "readerCustomThemes") || [];
	// Drop only what we own; anything hand-made stays put.
	let next = existing.filter((t) => t.id !== YB_LIGHT_ID && t.id !== YB_DARK_ID);
	next.push(light, dark);

	await Zotero.SyncedSettings.set(libraryID, "readerCustomThemes", next);

	// 先记原值，再写 —— 这三项是 Zotero 的，交还时按记录放回去。
	rememberOwnedPref("extensions.zotero.reader.lightTheme");
	rememberOwnedPref("extensions.zotero.reader.darkTheme");
	ybSet(YB_FAMILY_PREF, familyId);
	Zotero.Prefs.set("reader.lightTheme", YB_LIGHT_ID);
	Zotero.Prefs.set("reader.darkTheme", YB_DARK_ID);

	pushToOpenReaders(next, true);
	refreshChrome();
	syncMenu();
	ybLog("applied " + family.name + " (" + familyId + ")");
}

function applyScheme(value) {
	// Zotero's own 外观 preference; the reader follows it via
	// prefers-color-scheme, so this needs no per-reader plumbing.
	// Third arg = global (see syncMenu).
	rememberOwnedPref(YB_SCHEME_PREF);
	ybSet(YB_SCHEME_PREF, value);
	syncMenu();
	ybLog("scheme -> " + value + " (2 auto / 1 light / 0 dark)");
}

/* ------------------------------------------------- 设置里的管理面板 */

/* The pane (src/prefs.xhtml) is a XHTML *fragment* loaded by Zotero's own
 * preference code -- XUL is the default namespace, HTML needs the html: prefix.
 *
 * Three things about that loader shaped the code below (all read out of
 * chrome/content/zotero/preferences/preferences.js, not guessed):
 *
 *   1. It converts ONLY [oncommand] attributes into real listeners
 *      (_initImportedNodesPostInsert). Every other on* attribute is left as
 *      inert markup, so the range input's input/change handlers have to be
 *      attached by hand. Those are attached in initPane(), not in the markup,
 *      precisely so there is one mechanism instead of two.
 *
 *   2. It dispatches a `load` event on the fragment root, with event.waitUntil
 *      as the async-init hook. That IS reliable, and it is the only hook --
 *      hence onload on the root element in the markup.
 *
 *   3. It converts a `preference="..."` attribute into two-way pref binding,
 *      but Zotero.Prefs.set dispatches on the EXISTING pref type
 *      (xpcom/prefs.js): an int pref handed a string from a menulist/input
 *      throws. browser.theme.toolbar-theme and our opacity are both ints, so
 *      no control here uses `preference` -- everything goes through the same
 *      apply* functions the Tools menu uses. That also keeps the two views
 *      from drifting.
 *
 * There is deliberately no `scripts` entry: pane scripts run in a sandbox
 * whose prototype is the window, so a global declared there is invisible to
 * the markup's inline handlers (they are compiled in the window scope). Going
 * through Zotero.Yaobian sidesteps the whole question.
 */

const ybPaneDocs = new Set();

function exposeAPI() {
	Zotero.Yaobian = {
		version: Yaobian.version,
		initPane,
		// 交还配色也走 API：面板、菜单和 zotero-js-bridge 用同一条路。
		restoreOriginalColors,
		state: () => ({
			family: ybGet(YB_FAMILY_PREF),
			scheme: Number(ybGet(YB_SCHEME_PREF)),
			wallpaper: {
				enabled: !!ybGet(YB_WP_ON),
				path: ybGet(YB_WP_PATH) || "",
				opacity: Number(ybGet(YB_WP_OPACITY)),
			},
		}),
	};
}

async function registerPane() {
	try {
		if (
			!Zotero.PreferencePanes ||
			typeof Zotero.PreferencePanes.register !== "function"
		) {
			ybLog("no PreferencePanes here, skipping the preferences pane");
			return;
		}
		// Unregister first. A hot reload runs startup() again, and Zotero's
		// shutdown observer does not fire on that path -- without a fixed id
		// each register() mints a fresh random one (plugin-pane-<random>-<id>)
		// and the sidebar grows another 窑变 entry per reload. unregister() on
		// an unknown id is just a filter, so it needs no guard.
		//
		// No label/image on purpose: Zotero falls back to the manifest's name
		// and icon, which is one less place to keep in sync.
		Zotero.PreferencePanes.unregister(YB_PANE_ID);
		await Zotero.PreferencePanes.register({
			pluginID: Yaobian.id,
			id: YB_PANE_ID,
			src: Yaobian.rootURI + "prefs.xhtml",
		});
		ybLog("preferences pane registered");
	} catch (e) {
		Zotero.logError(e);
	}
}

/* The prefs window can be opened and closed repeatedly; there is no unload
 * hook we can rely on (see the note above), so the set is pruned on notify
 * instead -- a closed window's document has no defaultView. */
function notifyPane() {
	for (let doc of Array.from(ybPaneDocs)) {
		if (!doc.defaultView) {
			ybPaneDocs.delete(doc);
			continue;
		}
		try {
			syncPane(doc);
		} catch (e) {
			Zotero.logError(e);
		}
	}
}

function initPane(root) {
	let doc = root.ownerDocument;
	ybPaneDocs.add(doc);

	let list = doc.getElementById("yb-family");
	// The items go in a menupopup CHILD, not on the menulist itself. Putting
	// them straight on the menulist renders all 36 labels inline, spilling out
	// of the control -- it looks like a styling bug but it is a structural one.
	// Zotero's own drop-downs do it this way (preferences_export.js
	// buildQuickCopyFormatDropDown).
	if (list && !list.querySelector("menupopup")) {
		let popup = doc.createXULElement("menupopup");
		list.appendChild(popup);
		for (let family of Yaobian.themes) {
			let item = doc.createXULElement("menuitem");
			item.setAttribute("value", family.id);
			item.setAttribute(
				"label",
				family.nameEn ? family.name + "  " + family.nameEn : family.name
			);
			popup.appendChild(item);
		}
	}

	let on = (id, type, fn) => {
		let el = doc.getElementById(id);
		if (el) {
			el.addEventListener(type, fn);
		}
	};
	on("yb-family", "command", (e) => applyFamily(e.target.value));
	on("yb-scheme", "command", () => {
		applyScheme(Number(doc.getElementById("yb-scheme").value));
	});
	on("yb-wp-on", "command", (e) => setWallpaperEnabled(e.target.checked));
	on("yb-wp-choose", "command", () => chooseWallpaper());
	on("yb-wp-clear", "command", () => clearWallpaper());
	// Live readout while dragging, commit on release. The value is a string
	// from the input; Number() here is what keeps the int pref an int.
	on("yb-wp-opacity", "input", (e) => showOpacity(doc, Number(e.target.value)));
	on("yb-wp-opacity", "change", (e) => setWallpaperOpacity(Number(e.target.value)));
	on("yb-restore", "command", () => restoreOriginalColors());

	syncPane(doc);
}

function showOpacity(doc, value) {
	let out = doc.getElementById("yb-wp-opacity-value");
	if (out) {
		out.setAttribute("value", value + "%");
	}
}

function syncPane(doc) {
	let list = doc.getElementById("yb-family");
	if (!list) {
		return;
	}
	let family = currentFamily();
	list.value = family ? family.id : "";

	let scheme = doc.getElementById("yb-scheme");
	if (scheme) {
		scheme.value = String(ybGet(YB_SCHEME_PREF));
	}

	let enabled = doc.getElementById("yb-wp-on");
	if (enabled) {
		enabled.checked = !!ybGet(YB_WP_ON);
	}
	let path = ybGet(YB_WP_PATH) || "";
	let pathLabel = doc.getElementById("yb-wp-path");
	if (pathLabel) {
		// A bare filename is useless here -- two pictures called 壁纸.png are
		// indistinguishable -- so show the whole path and let crop=center chew
		// the middle out when it does not fit.
		pathLabel.setAttribute("value", path || "（未选择）");
		pathLabel.setAttribute("tooltiptext", path || "（未选择）");
	}
	let clear = doc.getElementById("yb-wp-clear");
	if (clear) {
		clear.disabled = !path;
	}
	let opacity = Number(ybGet(YB_WP_OPACITY));
	if (!Number.isFinite(opacity)) {
		opacity = YB_WP_DEFAULT_OPACITY;
	}
	let slider = doc.getElementById("yb-wp-opacity");
	if (slider && doc.activeElement !== slider) {
		slider.value = String(opacity);
	}
	showOpacity(doc, opacity);

	renderSwatches(doc, family);

	let status = doc.getElementById("yb-status");
	if (status) {
		let exists = path ? isReadableFile(path) : false;
		let bits = [
			"插件 v" + Yaobian.version + " · Zotero " + Zotero.version,
			Yaobian.themes.length + " 个家族",
			"壁纸：" + (!path ? "未选择" : exists ? "已就绪" : "文件找不到了"),
		];
		status.setAttribute("value", bits.join("　·　"));
	}
}

/* The role names a user sees, in the order the chips are drawn. These are also
 * the tooltips, which is why they are not the internal keys -- "surface" means
 * nothing to anyone who has not read themes.js. */
const YB_ROLE_ORDER = [
	["background", "底色"],
	["side", "侧栏"],
	["tab", "标签栏"],
	["surface", "浮层"],
	["accent", "强调色"],
	["foreground", "文字"],
];

/* A row of chips: the picked family's role colours for whichever scheme is
 * actually in effect. matchMedia, not a second read of the pref -- "跟随系统"
 * is a real case and only the media query knows how it resolved. */
function renderSwatches(doc, family) {
	let host = doc.getElementById("yb-swatches");
	if (!host) {
		return;
	}
	host.textContent = "";
	if (!family) {
		return;
	}
	let win = doc.defaultView;
	let dark = !!(win && win.matchMedia && win.matchMedia("(prefers-color-scheme: dark)").matches);
	let role = dark ? family.dark : family.light;
	for (let [key, label] of YB_ROLE_ORDER) {
		let chip = doc.createElementNS(YB_XHTML_NS, "div");
		chip.setAttribute(
			"style",
			"width:20px;height:20px;border-radius:4px;margin-inline-end:4px;" +
				"box-shadow:inset 0 0 0 1px rgba(128,128,128,.45);" +
				"background:" + role[key] + ";"
		);
		chip.setAttribute("title", label + " " + role[key]);
		host.appendChild(chip);
	}
}

function pushToOpenReaders(themes, alsoThemes) {
	for (let reader of Zotero.Reader._readers) {
		let internal = reader._internalReader;
		if (!internal) {
			continue;
		}
		try {
			if (alsoThemes) {
				// SyncedSettings has an observer that does this too, but it is
				// async -- doing it here means the swatch list is right the
				// moment the menu closes.
				internal.setCustomThemes(
					Components.utils.cloneInto(themes, reader._iframeWindow)
				);
			}
			internal.setLightTheme(YB_LIGHT_ID);
			internal.setDarkTheme(YB_DARK_ID);
		} catch (e) {
			Zotero.logError(e);
		}
	}
}
