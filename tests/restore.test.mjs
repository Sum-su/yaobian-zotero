// Lifecycle tests for the "hand the colours back" behaviour (issue #1).
//
// Loads src/bootstrap.js into a vm context with a fake Zotero + fake
// nsIPrefBranch, then simulates what Zotero does to a bootstrap plugin on
// disable (reason 4) / quit (2) / uninstall (6).
//
//   node tests/restore.test.mjs
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import vm from "node:vm"

const SRC = readFileSync(new URL("../src/bootstrap.js", import.meta.url), "utf8")
const PREFS_JS = readFileSync(new URL("../src/prefs.js", import.meta.url), "utf8")

const PREF_STRING = 32
const PREF_INT = 64
const PREF_BOOL = 128

const LIGHT_ID = "custom-yaobian-light"
const DARK_ID = "custom-yaobian-dark"
const P_LIGHT = "extensions.zotero.reader.lightTheme"
const P_DARK = "extensions.zotero.reader.darkTheme"
const P_TOOLBAR = "browser.theme.toolbar-theme"
const S_LIGHT = "extensions.yaobian.saved.reader.lightTheme"
const S_DARK = "extensions.yaobian.saved.reader.darkTheme"
const S_TOOLBAR = "extensions.yaobian.saved.toolbar-theme"
const REAPPLY = "extensions.yaobian.reapply"
const FAMILY = "extensions.yaobian.family"

const QINGCI = {
	id: "qing-ci",
	name: "青瓷",
	nameEn: "Celadon",
	light: { background: "#f3f6f4", foreground: "#232b28" },
	dark: { background: "#1d2320", foreground: "#d7e0db" },
}
const RUYAO = {
	id: "ru-yao-lan",
	name: "汝窑蓝",
	light: { background: "#eef2f6", foreground: "#1f2a33" },
	dark: { background: "#161d24", foreground: "#cfdae4" },
}

function makeEnv({ prefs = {}, themes = [], readers = [], readerThemes = [] } = {}) {
	const store = new Map()
	for (const [k, v] of Object.entries(prefs)) {
		store.set(
			k,
			typeof v === "number"
				? { t: "int", v }
				: typeof v === "boolean"
					? { t: "bool", v }
					: { t: "string", v }
		)
	}
	const prefsApi = {
		getPrefType: (n) => {
			const e = store.get(n)
			if (!e) return 0
			return e.t === "int" ? PREF_INT : e.t === "bool" ? PREF_BOOL : PREF_STRING
		},
		prefHasUserValue: (n) => store.has(n),
		getIntPref: (n) => {
			const e = store.get(n)
			if (!e || e.t !== "int") throw new Error("no int pref " + n)
			return e.v
		},
		getBoolPref: (n) => {
			const e = store.get(n)
			if (!e || e.t !== "bool") throw new Error("no bool pref " + n)
			return e.v
		},
		getStringPref: (n, d) => {
			const e = store.get(n)
			if (!e) {
				if (d === undefined) throw new Error("no string pref " + n)
				return d
			}
			if (e.t !== "string") throw new Error("not a string pref " + n)
			return e.v
		},
		setIntPref: (n, v) => void store.set(n, { t: "int", v: Number(v) }),
		setBoolPref: (n, v) => void store.set(n, { t: "bool", v: Boolean(v) }),
		setStringPref: (n, v) => void store.set(n, { t: "string", v: String(v) }),
		clearUserPref: (n) => void store.delete(n),
		getChildList: (b) => [...store.keys()].filter((k) => k.startsWith(b)),
	}
	// state.themes is Zotero's reader custom theme list; `themes` is the plugin's palette list.
	const state = { themes: readerThemes.map((t) => ({ ...t })), log: [], syncSets: 0 }
	const branch = (pref, global) => (global ? pref : "extensions.zotero." + pref)
	const Zotero = {
		Prefs: {
			get(pref, global) {
				const n = branch(pref, global)
				const t = prefsApi.getPrefType(n)
				if (t === PREF_INT) return prefsApi.getIntPref(n)
				if (t === PREF_BOOL) return prefsApi.getBoolPref(n)
				if (t === PREF_STRING) return prefsApi.getStringPref(n)
				return undefined
			},
			set(pref, value, global) {
				const n = branch(pref, global)
				const t = prefsApi.getPrefType(n)
				if (t === PREF_INT) return prefsApi.setIntPref(n, value)
				if (t === PREF_BOOL) return prefsApi.setBoolPref(n, value)
				if (t === PREF_STRING) return prefsApi.setStringPref(n, value)
				if (typeof value === "boolean") return prefsApi.setBoolPref(n, value)
				if (typeof value === "string") return prefsApi.setStringPref(n, value)
				if (parseInt(value) == value) return prefsApi.setIntPref(n, value)
				throw new Error("Invalid preference value for '" + n + "'")
			},
			clear(pref, global) {
				prefsApi.clearUserPref(branch(pref, global))
			},
		},
		Libraries: { userLibraryID: 1 },
		SyncedSettings: {
			get(lib, key) {
				return key === "readerCustomThemes" ? state.themes : null
			},
			set(lib, key, value) {
				if (key === "readerCustomThemes") state.themes = value
				state.syncSets++
				return Promise.resolve()
			},
		},
		Reader: { _readers: readers },
		logError(e) {
			state.log.push(String((e && e.message) || e))
		},
		debug() {},
		getMainWindows: () => [],
	}
	const Services = {
		prefs: prefsApi,
		obs: { addObserver() {}, removeObserver() {} },
		wm: {
			// Gecko's nsISimpleEnumerator is iterable, and chromeWindows() does
			// `for (let win of Services.wm.getEnumerator(null))`.
			getEnumerator: () => ({
				hasMoreElements: () => false,
				getNext: () => null,
				[Symbol.iterator]: function* () {},
			}),
		},
	}
	const Components = { utils: { cloneInto: (o) => o }, classes: {}, interfaces: {} }
	const ctx = vm.createContext({
		Services,
		Components,
		ChromeUtils: { importESModule: () => ({}) },
		Zotero,
		console,
	})
	vm.runInContext(SRC, ctx, { filename: "bootstrap.js" })
	ctx.Yaobian = { id: "yaobian@zotero", version: "0.4.2-test", rootURI: "", themes }
	return { ctx, store, state, prefsApi }
}

const val = (env, k) => {
	const e = env.store.get(k)
	return e ? e.v : undefined
}
const has = (env, k) => env.store.has(k)

const tests = []
const test = (name, fn) => tests.push([name, fn])

test("disable on a machine that never had a choice -> prefs back to not-set", async () => {
	const env = makeEnv({ themes: [QINGCI] })
	await env.ctx.applyFamily("qing-ci")
	env.ctx.applyScheme(0)
	assert.equal(val(env, P_LIGHT), LIGHT_ID)
	assert.equal(val(env, P_TOOLBAR), 0)
	env.ctx.shutdown({}, 4)
	assert.equal(has(env, P_LIGHT), false)
	assert.equal(has(env, P_DARK), false)
	assert.equal(has(env, P_TOOLBAR), false)
	assert.equal(has(env, S_LIGHT), false)
	assert.equal(has(env, S_TOOLBAR), false)
	assert.equal(val(env, REAPPLY), true)
	assert.equal(env.state.themes.some((t) => t.id === LIGHT_ID), false)
	assert.equal(env.state.themes.some((t) => t.id === DARK_ID), false)
})

test("disable restores the values the user actually had (type included)", async () => {
	const env = makeEnv({
		themes: [QINGCI],
		prefs: {
			[P_TOOLBAR]: 1,
			[P_LIGHT]: "solarized-light",
			[P_DARK]: "solarized-dark",
		},
	})
	await env.ctx.applyFamily("qing-ci")
	env.ctx.applyScheme(0)
	env.ctx.shutdown({}, 4)
	assert.equal(val(env, P_TOOLBAR), 1)
	assert.equal(env.prefsApi.getPrefType(P_TOOLBAR), PREF_INT)
	assert.equal(val(env, P_LIGHT), "solarized-light")
	assert.equal(val(env, P_DARK), "solarized-dark")
	assert.equal(has(env, REAPPLY), true, "disable must ask for a re-apply on re-enable")
})

test("quitting does not hand anything back", async () => {
	const env = makeEnv({ themes: [QINGCI] })
	await env.ctx.applyFamily("qing-ci")
	env.ctx.applyScheme(0)
	env.ctx.shutdown({}, 2)
	assert.equal(val(env, P_LIGHT), LIGHT_ID)
	assert.equal(val(env, P_TOOLBAR), 0)
	assert.equal(has(env, REAPPLY), false)
	assert.equal(env.state.themes.some((t) => t.id === LIGHT_ID), true)
})

test("first snapshot wins, however often the family changes", async () => {
	const env = makeEnv({ themes: [QINGCI, RUYAO], prefs: { [P_TOOLBAR]: 1 } })
	env.ctx.applyScheme(0)
	env.ctx.applyScheme(2)
	await env.ctx.applyFamily("qing-ci")
	await env.ctx.applyFamily("ru-yao-lan")
	assert.equal(val(env, S_TOOLBAR), "int:1")
	env.ctx.shutdown({}, 4)
	assert.equal(val(env, P_TOOLBAR), 1)
	assert.equal(has(env, P_TOOLBAR), true)
})

test("uninstall is the second pass: extension prefs are gone too", async () => {
	const env = makeEnv({ themes: [QINGCI], prefs: { [P_TOOLBAR]: 1 } })
	await env.ctx.applyFamily("qing-ci")
	env.ctx.applyScheme(0)
	env.ctx.shutdown({}, 6)
	env.ctx.uninstall()
	assert.deepEqual(env.prefsApi.getChildList("extensions.yaobian."), [])
	assert.equal(val(env, P_TOOLBAR), 1)
	assert.equal(env.state.themes.length, 0)
})

test("hand-made reader themes survive the hand-back", async () => {
	const mine = { id: "custom-green", label: "绿", background: "#e8f0e6", foreground: "#22301f" }
	const env = makeEnv({ themes: [QINGCI], readerThemes: [mine] })
	await env.ctx.applyFamily("qing-ci")
	env.ctx.restoreOriginalColors()
	assert.equal(val(env, FAMILY), "")
	assert.deepEqual(env.state.themes.map((t) => t.id), ["custom-green"])
	assert.equal(has(env, P_LIGHT), false)
})

test("a machine already pointing at our id is snapshotted as not-set", async () => {
	const env = makeEnv({ themes: [QINGCI], prefs: { [P_LIGHT]: LIGHT_ID, [P_DARK]: DARK_ID } })
	await env.ctx.applyFamily("qing-ci")
	assert.equal(val(env, S_LIGHT), "none")
	env.ctx.shutdown({}, 4)
	assert.equal(has(env, P_LIGHT), false)
	assert.equal(has(env, P_DARK), false)
})

test("restoreOriginalColors leaves the plugin loaded and re-appliable", async () => {
	const env = makeEnv({ themes: [QINGCI, RUYAO], prefs: { [P_TOOLBAR]: 1 } })
	await env.ctx.applyFamily("qing-ci")
	env.ctx.applyScheme(0)
	env.ctx.restoreOriginalColors()
	assert.equal(val(env, P_TOOLBAR), 1)
	assert.equal(val(env, FAMILY), "")
	await env.ctx.applyFamily("ru-yao-lan")
	// applyFamily never touches the scheme; that is applyScheme's job.
	env.ctx.applyScheme(0)
	assert.equal(val(env, P_TOOLBAR), 0)
	assert.equal(val(env, S_TOOLBAR), "int:1")
	env.ctx.shutdown({}, 4)
	assert.equal(val(env, P_TOOLBAR), 1)
})

test("0.4.1 leftovers are adopted as not-set before the hand-back", async () => {
	const env = makeEnv({
		themes: [QINGCI],
		prefs: { [P_LIGHT]: LIGHT_ID, [P_DARK]: DARK_ID, [P_TOOLBAR]: 0 },
	})
	env.ctx.adoptLegacyPrefs()
	assert.equal(val(env, S_LIGHT), "none")
	assert.equal(val(env, S_DARK), "none")
	assert.equal(val(env, S_TOOLBAR), "none")
	env.ctx.shutdown({}, 4)
	assert.equal(has(env, P_LIGHT), false)
	assert.equal(has(env, P_DARK), false)
	assert.equal(has(env, P_TOOLBAR), false)
	assert.equal(val(env, "extensions.yaobian.reapply-scheme"), "0")
})

test("prefs.js must not declare the snapshot keys", () => {
	assert.equal(/saved\./.test(PREFS_JS), false)
	assert.equal(/saved\./.test(SRC), true)
})

let failed = 0
for (const [name, fn] of tests) {
	try {
		await fn()
		console.log("PASS  " + name)
	} catch (e) {
		failed++
		console.log("FAIL  " + name + "\n      " + String((e && e.stack) || e).split("\n").slice(0, 4).join("\n      "))
	}
}
console.log(failed ? failed + " failed" : "all " + tests.length + " passed")
process.exitCode = failed ? 1 : 0
