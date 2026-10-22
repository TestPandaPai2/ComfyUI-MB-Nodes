// Prompt (MB): Save Tag stores the prompt under tag_name, @ in the text box
// pops up the saved tags, Manage Tags renames/deletes/loads them. Tags live in
// PromptTags.json via the routes in nodes/prompt_tags_node.py.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, notify } from "./common.js";
import { openDialog } from "./dialog.js";

const TAG_NAME = /^[A-Za-z0-9_-]+$/;

// One copy for every node on the page; refreshed after each change and when a
// text box gains focus, so tags saved in another tab show up.
let tags = {};

async function fetchTags() {
    const response = await api.fetchApi("/mbnodes/prompt_tags");
    tags = (await response.json()).tags ?? {};
    return tags;
}

async function post(route, body) {
    const response = await api.fetchApi(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
}

function setText(node, text) {
    const widget = getWidget(node, "text");
    if (!widget) return;
    widget.value = text;
    const element = widget.inputEl ?? widget.element;
    if (element && "value" in element) element.value = text;
    widget.callback?.(text);
    node.setDirtyCanvas(true, true);
}

// ------------------------------------------------------------------- saving

const SAVE_CSS = `
.mb-ts { display: flex; flex-direction: column; gap: 10px; }
.mb-ts-name { display: flex; align-items: center; background: var(--comfy-input-bg); border: 1px solid transparent; border-radius: 8px; }
.mb-ts-name:focus-within { border-color: var(--mb-accent); }
.mb-ts-name.mb-invalid { border-color: #e5484d; }
.mb-ts-name span { padding-left: 12px; color: var(--mb-accent); font-weight: 500; }
.mb-ts-name input { flex: 1; min-width: 0; padding: 8px 12px 8px 3px; background: transparent; color: var(--input-text); border: none; outline: none; font: inherit; }
.mb-ts-note { font-size: 12px; color: var(--descrip-text); min-height: 16px; }
.mb-ts-note.mb-warn { color: #e8a33d; }
.mb-ts-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mb-ts-compare div { background: var(--comfy-menu-secondary-bg); border-radius: 8px; padding: 8px 10px; font-size: 12.5px; line-height: 1.5; max-height: 160px; overflow-y: auto; white-space: pre-wrap; color: var(--input-text); }
.mb-ts-compare b { display: block; font-size: 11px; font-weight: 500; color: var(--descrip-text); margin-bottom: 4px; }
`;

function ensureSaveStyle() {
    if (document.getElementById("mb-ts-style")) return;
    const style = document.createElement("style");
    style.id = "mb-ts-style";
    style.textContent = SAVE_CSS;
    document.head.appendChild(style);
}

// Asks for the name (pre-filled from tag_name). Typing a name that is already
// saved shows the saved text next to the new one, and Apply then overwrites it.
async function saveTag(node) {
    const text = getWidget(node, "text")?.value ?? "";
    if (!text.trim()) {
        notify("warn", "Nothing to save", "The prompt is empty.");
        return;
    }
    await fetchTags().catch(() => {});
    ensureSaveStyle();

    let input;
    openDialog({
        title: "Save tag",
        applyLabel: "Save",
        width: 480,
        render(body) {
            const root = el("div", "mb-ts");
            const box = el("div", "mb-ts-name");
            input = el("input");
            input.value = (getWidget(node, "tag_name")?.value ?? "").trim().replace(/^@/, "").replace(/\s+/g, "_");
            box.append(el("span", "", "@"), input);
            const note = el("div", "mb-ts-note");
            const compare = el("div", "mb-ts-compare");

            const update = () => {
                const name = input.value.trim().replace(/^@/, "");
                const valid = TAG_NAME.test(name);
                box.classList.toggle("mb-invalid", !!name && !valid);
                const exists = valid && name in tags;
                const selfRef = valid && new RegExp(`@${name}(?![A-Za-z0-9_-])`).test(text);
                note.classList.toggle("mb-warn", exists || selfRef || (!!name && !valid));
                note.textContent = !name ? "Letters, digits, _ and -. Spaces become _."
                    : !valid ? "Use letters, digits, _ and - only."
                    : exists ? `@${name} already exists. Saving overwrites it.`
                    : selfRef ? `@${name} would stay unexpanded inside its own prompt.`
                    : `Saves as a new tag.`;
                compare.replaceChildren();
                if (exists) {
                    const saved = el("div");
                    saved.append(el("b", "", "Saved"), tags[name]);
                    const next = el("div");
                    next.append(el("b", "", "New"), text);
                    compare.append(saved, next);
                }
            };
            // A space would end the @name, so it turns into _ as it is typed.
            input.addEventListener("input", () => {
                if (/\s/.test(input.value)) {
                    const caret = input.selectionStart;
                    input.value = input.value.replace(/\s/g, "_");
                    input.setSelectionRange(caret, caret);
                }
                update();
            });
            root.append(box, note, compare);
            body.appendChild(root);
            update();
            setTimeout(() => input.select(), 0);
        },
        onApply() {
            const name = input.value.trim().replace(/^@/, "");
            if (!TAG_NAME.test(name)) {
                input.focus();
                return false;
            }
            // The dialog showed whether this overwrites, so saving is the confirmation.
            post("/mbnodes/prompt_tags/save", { name, text, overwrite: true })
                .then(({ status, data }) => {
                    if (status >= 400) throw new Error(data?.error ?? `HTTP ${status}`);
                    tags = data.tags;
                    markEdited([data.name]);
                    const tagName = getWidget(node, "tag_name");
                    if (tagName) tagName.value = data.name;
                    node.setDirtyCanvas(true, true);
                    notify("success", "Tag saved", `@${data.name}`);
                })
                .catch((e) => notify("error", "Save failed", e?.message ?? String(e)));
        },
    });
}

// ------------------------------------------------------------- autocomplete

const POPUP_CSS = `
.mb-tag-popup {
    position: fixed;
    z-index: 10001;
    min-width: 160px;
    max-width: 320px;
    max-height: 220px;
    overflow-y: auto;
    background: var(--comfy-menu-bg);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 4px;
    font: 12.5px system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--input-text);
}
.mb-tag-popup div { padding: 4px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-tag-popup div span { color: var(--descrip-text); margin-left: 8px; }
.mb-tag-popup div.mb-active { background: color-mix(in srgb, var(--mb-accent, #d4537e) 30%, var(--comfy-menu-bg)); }
`;

function ensurePopupStyle() {
    if (document.getElementById("mb-tag-popup-style")) return;
    const style = document.createElement("style");
    style.id = "mb-tag-popup-style";
    style.textContent = POPUP_CSS;
    document.head.appendChild(style);
}

const MIRRORED = ["boxSizing", "width", "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderLeftWidth", "tabSize"];

// Screen position of the caret: the text before it is laid out in a hidden
// copy of the textarea and a marker placed where the caret falls. The canvas
// zoom scales the textarea with a CSS transform, so offsets are scaled to match.
function caretPoint(textarea) {
    const style = getComputedStyle(textarea);
    const mirror = document.createElement("div");
    for (const key of MIRRORED) mirror.style[key] = style[key];
    Object.assign(mirror.style, {
        position: "absolute", visibility: "hidden", top: "0", left: "0",
        whiteSpace: "pre-wrap", overflowWrap: "break-word",
    });
    mirror.textContent = textarea.value.slice(0, textarea.selectionStart);
    const marker = document.createElement("span");
    marker.textContent = "​";
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const rect = textarea.getBoundingClientRect();
    const scale = rect.width / (textarea.offsetWidth || rect.width);
    const left = rect.left + (marker.offsetLeft - textarea.scrollLeft) * scale;
    const top = rect.top + (marker.offsetTop - textarea.scrollTop) * scale;
    const bottom = top + marker.offsetHeight * scale;
    mirror.remove();
    return { left, bottom: Math.min(Math.max(bottom, rect.top), rect.bottom) };
}

// `pick(text)` applies an accepted completion; `sync(text)` mirrors plain
// typing while an @word is open, since other listeners are stopped then.
function attachAutocomplete(textarea, { pick: applyPick, sync }) {
    ensurePopupStyle();
    const popup = document.createElement("div");
    popup.className = "mb-tag-popup";
    popup.style.display = "none";
    document.body.appendChild(popup);

    let matches = [];
    let active = 0;
    let start = -1; // index of the "@" being completed

    function hide() {
        popup.style.display = "none";
        matches = [];
    }

    // The "@word" right before the caret, if any.
    function query() {
        const before = textarea.value.slice(0, textarea.selectionStart);
        const m = before.match(/(^|[^A-Za-z0-9_-])@([A-Za-z0-9_-]*)$/);
        if (!m) return null;
        start = before.length - m[2].length - 1;
        return m[2].toLowerCase();
    }

    function render() {
        popup.replaceChildren();
        matches.forEach((name, i) => {
            const row = document.createElement("div");
            row.textContent = `@${name}`;
            const preview = document.createElement("span");
            preview.textContent = tags[name].slice(0, 60);
            row.appendChild(preview);
            if (i === active) row.className = "mb-active";
            row.addEventListener("mousedown", (event) => {
                event.preventDefault(); // keep focus in the textarea
                pick(name);
            });
            popup.appendChild(row);
        });
        popup.children[active]?.scrollIntoView({ block: "nearest" });
    }

    function update() {
        const q = query();
        if (q === null) return hide();
        matches = Object.keys(tags).filter((n) => n.toLowerCase().includes(q))
            .sort((a, b) => a.toLowerCase().startsWith(q) === b.toLowerCase().startsWith(q)
                ? a.localeCompare(b) : a.toLowerCase().startsWith(q) ? -1 : 1);
        if (!matches.length) return hide();
        active = Math.min(active, matches.length - 1);
        const caret = caretPoint(textarea);
        popup.style.left = `${Math.min(caret.left, window.innerWidth - 330)}px`;
        popup.style.top = `${caret.bottom + 4}px`;
        popup.style.display = "";
        render();
    }

    function pick(name) {
        const caret = textarea.selectionStart;
        const text = textarea.value.slice(0, start) + `@${name} ` + textarea.value.slice(caret);
        applyPick(text);
        const pos = start + name.length + 2;
        textarea.setSelectionRange(pos, pos);
        hide();
    }

    // Other packs (tag autocompleters) also listen for "@" on every textarea.
    // Window capture runs before any listener on the textarea itself, so while
    // an @tag is being typed the event stops here and only our list shows.
    // Their listeners would also have synced the value, so do that here.
    function onInput(event) {
        if (event.target !== textarea) return;
        active = 0;
        update();
        if (query() === null) return;
        event.stopImmediatePropagation();
        sync(textarea.value);
    }

    function onKeyUp(event) {
        if (event.target === textarea && query() !== null) event.stopImmediatePropagation();
    }

    function onKeyDown(event) {
        if (event.target !== textarea) return;
        if (query() !== null) event.stopImmediatePropagation();
        if (!matches.length) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            active = (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
            render();
        } else if (event.key === "Enter" || event.key === "Tab") {
            pick(matches[active]);
        } else if (event.key === "Escape") {
            hide();
        } else {
            return;
        }
        event.preventDefault();
    }

    window.addEventListener("input", onInput, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("keydown", onKeyDown, true);
    textarea.addEventListener("focus", () => fetchTags().catch(() => {}));
    textarea.addEventListener("blur", hide);

    return () => {
        window.removeEventListener("input", onInput, true);
        window.removeEventListener("keyup", onKeyUp, true);
        window.removeEventListener("keydown", onKeyDown, true);
        popup.remove();
    };
}

// ----------------------------------------------------------------- managing

const MANAGER_CSS = `
.mb-tm-dialog {
    display: flex; flex-direction: column; resize: both;
    width: 900px; height: min(680px, calc(100vh - 32px));
    min-width: 640px; min-height: 420px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px);
}
.mb-tm-dialog .mb-dialog-body { flex: 1; min-height: 0; }
.mb-tm { display: grid; grid-template-columns: 250px minmax(0, 1fr); flex: 1; min-height: 0; margin: -10px -16px -14px; }
.mb-tm-side { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: var(--comfy-menu-secondary-bg); border-right: 1px solid var(--comfy-input-bg); min-height: 0; }
.mb-tm-search { position: relative; }
.mb-tm-search::before { content: "⌕"; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--descrip-text); font-size: 15px; }
.mb-tm-search input { padding-left: 28px; }
.mb-tm-sort { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--descrip-text); }
.mb-tm-sort select { flex: 1; padding: 4px 8px; background: var(--comfy-input-bg); color: var(--input-text); border: 1px solid transparent; border-radius: 6px; font: inherit; outline: none; }
.mb-tm-list { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.mb-tm-group { display: flex; align-items: center; gap: 6px; padding: 6px 6px 2px; font-size: 11px; color: var(--descrip-text); cursor: pointer; user-select: none; flex: none; }
.mb-tm-group b { font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
.mb-tm-group .mb-tm-gcount { margin-left: auto; }
.mb-tm-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; white-space: nowrap; overflow: hidden; flex: none; }
.mb-tm-row:hover { background: var(--comfy-input-bg); }
.mb-tm-row.mb-selected { background: color-mix(in srgb, var(--mb-a) 24%, var(--comfy-menu-secondary-bg)); }
.mb-tm-row b { font-weight: 500; }
.mb-tm-row span { color: var(--descrip-text); overflow: hidden; text-overflow: ellipsis; }
.mb-tm-row i { width: 6px; height: 6px; border-radius: 50%; background: var(--mb-a); margin-left: auto; flex: none; }
.mb-tm-row mark { background: color-mix(in srgb, var(--mb-a) 45%, transparent); color: inherit; border-radius: 3px; }
.mb-tm-row.mb-deleted b, .mb-tm-row.mb-deleted span { text-decoration: line-through; opacity: 0.55; }
.mb-tm-undo { margin-left: auto; color: var(--mb-a); font-size: 11px; cursor: pointer; flex: none; }
.mb-tm-keys { font-size: 10.5px; color: var(--descrip-text); line-height: 1.6; }
.mb-tm-edit { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; overflow-y: auto; min-width: 0; min-height: 0; }
.mb-tm-grow { flex: 1; display: flex; flex-direction: column; min-height: 160px; }
.mb-tm-label { display: flex; justify-content: space-between; font-size: 11px; color: var(--descrip-text); margin-bottom: 5px; }
.mb-tm input, .mb-tm textarea {
    width: 100%; box-sizing: border-box; padding: 8px 12px; background: var(--comfy-input-bg); color: var(--input-text);
    border: 1px solid transparent; border-radius: 8px; font: inherit; line-height: 1.5; outline: none;
}
.mb-tm input:focus, .mb-tm textarea:focus { border-color: var(--mb-a); }
.mb-tm-field { position: relative; flex: 1; min-height: 0; background: var(--comfy-input-bg); border-radius: 8px; }
.mb-tm-field textarea { position: relative; z-index: 1; height: 100%; resize: none; background: transparent; overflow-y: scroll; }
.mb-tm-hl {
    position: absolute; inset: 0; box-sizing: border-box; padding: 8px 12px; border: 1px solid transparent;
    font: inherit; line-height: 1.5; white-space: pre-wrap; overflow-wrap: break-word; color: transparent;
    overflow-y: scroll; scrollbar-color: transparent transparent; pointer-events: none;
}
.mb-tm-hl mark { color: transparent; background: color-mix(in srgb, var(--mb-a) 35%, transparent); border-radius: 3px; }
.mb-tm-hl mark.mb-bad { background: rgba(229, 72, 77, 0.4); }
.mb-tm-name { display: flex; align-items: center; background: var(--comfy-input-bg); border: 1px solid transparent; border-radius: 8px; }
.mb-tm-name:focus-within { border-color: var(--mb-a); }
.mb-tm-name.mb-invalid { border-color: #e5484d; }
.mb-tm-name span { padding-left: 12px; color: var(--mb-a); font-weight: 500; }
.mb-tm-name input, .mb-tm-name input:focus { background: transparent; border-color: transparent; padding-left: 3px; }
.mb-tm-preview { background: var(--comfy-menu-secondary-bg); border-radius: 8px; padding: 10px 12px; color: var(--descrip-text); font-size: 12.5px; line-height: 1.6; min-height: 20px; max-height: 120px; overflow-y: auto; white-space: pre-wrap; }
.mb-tm-refs { font-size: 12px; color: var(--descrip-text); line-height: 1.9; }
.mb-tm-chip { display: inline-block; background: color-mix(in srgb, var(--mb-a) 22%, var(--comfy-menu-secondary-bg)); color: var(--input-text); border-radius: 5px; padding: 0 6px; margin-right: 4px; cursor: pointer; }
.mb-tm-chip:hover { filter: brightness(1.2); }
.mb-tm-banner { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; background: rgba(229, 72, 77, 0.15); color: var(--input-text); font-size: 12px; }
.mb-tm-banner .mb-dialog-button { margin-left: auto; }
.mb-tm-actions { display: flex; gap: 8px; }
.mb-tm-danger { color: #e5484d !important; margin-left: auto; }
.mb-tm-empty { color: var(--descrip-text); font-size: 12px; padding: 8px 10px; }
.mb-tm-count { font-size: 11px; color: var(--descrip-text); background: var(--comfy-input-bg); border-radius: 10px; padding: 2px 8px; }
.mb-tm-status { flex: 1; align-self: center; font-size: 12px; color: var(--descrip-text); }
.mb-tm-status.mb-tm-warn { color: #e8a33d; }
`;

function ensureManagerStyle() {
    if (document.getElementById("mb-tm-style")) return;
    const style = document.createElement("style");
    style.id = "mb-tm-style";
    style.textContent = MANAGER_CSS;
    document.head.appendChild(style);
}

// Same rules as expand() and tidy() in nodes/prompt_tags_node.py; only feeds
// the previews.
const TAG_REF = /@([A-Za-z0-9_-]+)(?::(\d+(?:\.\d+)?))?/g;
// Innermost {a|b|c} group, as CHOICE in nodes/prompt_tags_node.py.
const CHOICE = /\{[^{}]*\|[^{}]*\}/g;

function expandTags(text, all, chain = []) {
    return text.replace(TAG_REF, (match, name, weight) => {
        if (!(name in all) || chain.includes(name) || chain.length >= 16) return match;
        const expanded = expandTags(all[name], all, [...chain, name]);
        return weight ? `(${expanded.replace(/^[ ,]+|[ ,]+$/g, "")}:${weight})` : expanded;
    });
}

function tidy(text) {
    return text
        .replace(/[ \t]+/g, " ")
        .replace(/ ?,(?: ?,)+/g, ",")
        .replace(/ +,/g, ",")
        .replace(/^[ ,]+|[ ,]+$/gm, "")
        .trim();
}

// What the node outputs, plus any @names left unexpanded in it.
function resolve(text) {
    const output = tidy(expandTags(text, tags));
    return { output, unknown: referencedNames(output) };
}

function referencedNames(text) {
    return [...new Set([...text.matchAll(/@([A-Za-z0-9_-]+)/g)].map((m) => m[1]))];
}

function firstWords(text) {
    return text.trim().split(/\s+/).slice(0, 2).join(" ");
}

function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
}

// Per-browser record of when each tag was last saved, for "Recently edited".
const EDITED_KEY = "mb-tag-edited";
const SORT_KEY = "mb-tag-sort";
const SORTS = { name: "Name", recent: "Recently edited", used: "Most used" };
const DISCARD_MS = 4000; // window for the second close that discards edits

function editedTimes() {
    try {
        return JSON.parse(localStorage.getItem(EDITED_KEY)) ?? {};
    } catch {
        return {};
    }
}

function markEdited(names) {
    const times = editedTimes();
    for (const name of names) times[name] = Date.now();
    try {
        localStorage.setItem(EDITED_KEY, JSON.stringify(times));
    } catch {}
}

// "style_warm" and "style-cool" share the group "style".
function groupOf(name) {
    return /^([^_-]+)[_-]/.exec(name)?.[1] ?? null;
}

// `text` with every case-insensitive occurrence of `query` wrapped in <mark>.
function highlighted(text, query) {
    const fragment = document.createDocumentFragment();
    if (!query) {
        fragment.append(text);
        return fragment;
    }
    const lower = text.toLowerCase();
    let from = 0;
    for (let at = lower.indexOf(query); at >= 0; at = lower.indexOf(query, from)) {
        fragment.append(text.slice(from, at), el("mark", "", text.slice(at, at + query.length)));
        from = at + query.length;
    }
    fragment.append(text.slice(from));
    return fragment;
}

async function openManageDialog(node) {
    try {
        await fetchTags();
    } catch (e) {
        notify("error", "Could not load tags", e?.message ?? String(e));
        return;
    }
    ensureManagerStyle();

    // Edited locally, written back as changes on Save. `orig` is the saved
    // name, so edits, renames and deletes can be told apart from what is on
    // disk. Deleted tags stay in the list, struck through, until Save.
    const draft = Object.entries(tags).map(([name, text]) => ({ name, text, orig: name, deleted: false }));
    let current = null;
    let filter = "";
    let sort = SORTS[localStorage.getItem(SORT_KEY)] ? localStorage.getItem(SORT_KEY) : "name";
    let visible = []; // rows in list order, for the arrow keys
    let discardArmed = 0;
    const collapsed = new Set();
    let list, nameBox, nameInput, textInput, backdrop, words, preview, refs, editor, banner, count, status;

    const live = () => draft.filter((t) => !t.deleted);
    const asMap = () => Object.fromEntries(live().map((t) => [t.name.trim(), t.text]));
    const edited = (t) => t.orig === null || t.name.trim() !== t.orig || t.text !== tags[t.orig];
    const changeCount = () => live().filter(edited).length + draft.filter((t) => t.deleted && t.orig !== null).length;
    const usage = (name) => live().filter((t) => t.name.trim() !== name && referencedNames(t.text).includes(name)).length;
    const matches = (t) => !filter || t.name.toLowerCase().includes(filter) || t.text.toLowerCase().includes(filter);

    function uniqueName(base) {
        let name = base;
        for (let i = 2; live().some((t) => t.name.trim() === name); i++) name = `${base}_${i}`;
        return name;
    }

    function sorted(items) {
        const byName = (a, b) => a.name.localeCompare(b.name);
        if (sort === "recent") {
            const times = editedTimes();
            return [...items].sort((a, b) => (times[b.name.trim()] ?? 0) - (times[a.name.trim()] ?? 0) || byName(a, b));
        }
        if (sort === "used") {
            const uses = new Map(items.map((t) => [t, usage(t.name.trim())]));
            return [...items].sort((a, b) => uses.get(b) - uses.get(a) || byName(a, b));
        }
        return [...items].sort(byName);
    }

    function row(tag) {
        const r = el("div", "mb-tm-row" + (tag === current ? " mb-selected" : "") + (tag.deleted ? " mb-deleted" : ""));
        const name = el("b");
        name.append("@", highlighted(tag.name, filter));
        // A search hit inside the prompt shows the words around it instead of
        // the first two.
        const at = filter && !tag.name.toLowerCase().includes(filter) ? tag.text.toLowerCase().indexOf(filter) : -1;
        const snippet = el("span");
        if (at >= 0) snippet.append(at > 12 ? "…" : "", highlighted(tag.text.slice(Math.max(0, at - 12), at + filter.length + 30), filter));
        else snippet.textContent = firstWords(tag.text);
        r.append(name, snippet);
        if (tag.deleted) {
            const undo = el("span", "mb-tm-undo", "Undo");
            undo.addEventListener("click", (event) => {
                event.stopPropagation();
                restore(tag);
            });
            r.appendChild(undo);
        } else if (edited(tag)) {
            r.appendChild(el("i"));
        }
        r.addEventListener("click", () => select(tag));
        visible.push(tag);
        return r;
    }

    // Tags sharing a name prefix are grouped under a collapsible header; a
    // prefix used once stays a plain row. A search opens every group.
    function drawList() {
        list.replaceChildren();
        visible = [];
        const shown = sorted(draft.filter(matches));
        if (!shown.length) list.appendChild(el("div", "mb-tm-empty", draft.length ? "No matches." : "No tags saved yet."));

        const groups = new Map();
        for (const tag of shown) {
            const group = groupOf(tag.name.trim());
            if (!groups.has(group)) groups.set(group, []);
            groups.get(group).push(tag);
        }
        const loose = [];
        for (const [group, members] of [...groups].sort(([a], [b]) => (a ?? "").localeCompare(b ?? ""))) {
            if (!group || members.length < 2) {
                loose.push(...members);
                continue;
            }
            const open = filter || !collapsed.has(group);
            const head = el("div", "mb-tm-group");
            head.append(el("span", "", open ? "▾" : "▸"), el("b", "", group), el("span", "mb-tm-gcount", String(members.length)));
            head.addEventListener("click", () => {
                if (collapsed.has(group)) collapsed.delete(group);
                else collapsed.add(group);
                drawList();
            });
            list.appendChild(head);
            if (open) members.forEach((tag) => list.appendChild(row(tag)));
        }
        sorted(loose).forEach((tag) => list.appendChild(row(tag)));

        const total = live().length;
        count.textContent = `${total} tag${total === 1 ? "" : "s"}`;
        const changes = changeCount();
        if (status && !status.classList.contains("mb-tm-warn")) {
            status.textContent = changes ? `${changes} unsaved change${changes === 1 ? "" : "s"}` : "All changes saved";
        }
    }

    function chips(names) {
        const span = el("span");
        if (!names.length) span.textContent = "none";
        for (const name of names) {
            const chip = el("span", "mb-tm-chip", `@${name}`);
            chip.addEventListener("click", () => select(live().find((t) => t.name.trim() === name)));
            span.appendChild(chip);
        }
        return span;
    }

    // Behind the transparent textarea: the same text with @refs marked, known
    // ones in the accent, unknown ones in red.
    function drawHighlights() {
        const all = asMap();
        const text = textInput.value;
        backdrop.replaceChildren();
        let from = 0;
        for (const m of text.matchAll(TAG_REF)) {
            backdrop.append(text.slice(from, m.index), el("mark", m[1] in all ? "" : "mb-bad", m[0]));
            from = m.index + m[0].length;
        }
        // The trailing newline keeps a last empty line the same height as in the textarea.
        backdrop.append(text.slice(from) + "\n");
        backdrop.scrollTop = textInput.scrollTop;
    }

    function drawDetails() {
        if (!current) return;
        const all = asMap();
        const name = current.name.trim();
        words.textContent = `${current.text.trim().split(/\s+/).filter(Boolean).length} words`;
        preview.textContent = tidy(expandTags(current.text, all, [name]));
        banner.style.display = current.deleted ? "" : "none";
        nameInput.readOnly = textInput.readOnly = current.deleted;
        drawHighlights();

        const uses = referencedNames(current.text).filter((n) => n in all && n !== name);
        const usedBy = live().filter((t) => t !== current && referencedNames(t.text).includes(name)).map((t) => t.name.trim());
        const usesLine = el("div", "", "Uses ");
        usesLine.appendChild(chips(uses));
        const byLine = el("div", "", "Used by ");
        byLine.appendChild(chips(usedBy));
        refs.replaceChildren(usesLine, byLine);
    }

    function select(tag) {
        current = tag ?? null;
        editor.style.visibility = current ? "" : "hidden";
        nameInput.value = current?.name ?? "";
        nameBox.classList.remove("mb-invalid");
        textInput.value = current?.text ?? "";
        drawDetails();
        drawList();
        list.querySelector(".mb-selected")?.scrollIntoView({ block: "nearest" });
    }

    function addTag() {
        const tag = { name: uniqueName("new_tag"), text: "", orig: null, deleted: false };
        draft.push(tag);
        select(tag);
        nameInput.focus();
        nameInput.select();
    }

    // A blank tag that was never saved just goes; anything else is struck
    // through and can be restored until Save.
    function deleteCurrent() {
        if (!current || current.deleted) return;
        if (current.orig === null && !current.text.trim()) {
            draft.splice(draft.indexOf(current), 1);
            select(visible.find((t) => t !== current && !t.deleted) ?? null);
            return;
        }
        current.deleted = true;
        select(current);
    }

    function restore(tag) {
        tag.deleted = false;
        if (live().some((t) => t !== tag && t.name.trim() === tag.name.trim())) tag.name = uniqueName(tag.name.trim());
        select(tag);
    }

    function onText() {
        if (!current || current.deleted) return;
        current.text = textInput.value;
        drawList();
        drawDetails();
    }

    function button(label, onClick, extra = "") {
        const b = el("button", `mb-dialog-button ${extra}`, label);
        b.addEventListener("click", onClick);
        return b;
    }

    function labelled(text, field, aside, className = "") {
        const wrap = el("div", className);
        const label = el("div", "mb-tm-label");
        label.append(el("span", "", text), aside ?? el("span"));
        wrap.append(label, field);
        return wrap;
    }

    // Enter in the prompt box is a new line, not the dialog's Save. The dialog
    // listens on document capture, so this has to sit on window to run first.
    function keepEnter(event) {
        if (event.key === "Enter" && event.target === textInput) event.stopPropagation();
    }

    // Ctrl+S save, Ctrl+N new tag; outside the text fields ↑↓ move through
    // the list and Delete deletes.
    function onKeys(event) {
        const mod = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        const act = (fn) => {
            event.preventDefault();
            event.stopPropagation();
            fn();
        };
        if (mod && key === "s") return act(() => count.closest(".mb-dialog").querySelector(".mb-primary").click());
        if (mod && key === "n") return act(addTag);
        if (event.target === textInput || event.target === nameInput) return;
        if (key === "arrowdown" || key === "arrowup") {
            return act(() => {
                const at = visible.indexOf(current);
                const next = visible[Math.max(0, Math.min(visible.length - 1, at + (key === "arrowdown" ? 1 : -1)))];
                if (next) select(next);
            });
        }
        if (key === "delete" && event.target.tagName !== "INPUT") act(deleteCurrent);
    }

    window.addEventListener("keydown", keepEnter, true);
    window.addEventListener("keydown", onKeys, true);
    let detachAutocomplete = null;

    openDialog({
        title: "Tag manager",
        applyLabel: "Save changes",
        onClose: () => {
            window.removeEventListener("keydown", keepEnter, true);
            window.removeEventListener("keydown", onKeys, true);
            detachAutocomplete?.();
        },
        // With unsaved edits the first close only warns; closing again within
        // a few seconds discards them.
        canClose: () => {
            const changes = changeCount();
            if (!changes || Date.now() - discardArmed < DISCARD_MS) return true;
            discardArmed = Date.now();
            status.classList.add("mb-tm-warn");
            status.textContent = `${changes} unsaved change${changes === 1 ? "" : "s"}. Close again to discard.`;
            setTimeout(() => {
                status.classList.remove("mb-tm-warn");
                drawList();
            }, DISCARD_MS);
            return false;
        },
        render(body) {
            body.parentElement.classList.add("mb-tm-dialog");
            count = el("span", "mb-tm-count");
            body.parentElement.querySelector(".mb-dialog-title").after(count);
            body.parentElement.querySelector(".mb-dialog-title").style.flex = "0 1 auto";
            count.style.marginRight = "auto";

            const root = el("div", "mb-tm");

            const side = el("div", "mb-tm-side");
            const search = el("div", "mb-tm-search");
            const searchInput = el("input");
            searchInput.placeholder = "Search names and prompts";
            searchInput.addEventListener("input", () => {
                filter = searchInput.value.trim().toLowerCase();
                drawList();
            });
            search.appendChild(searchInput);

            const sortRow = el("label", "mb-tm-sort", "Sort");
            const sortSelect = el("select");
            for (const [value, label] of Object.entries(SORTS)) {
                const option = el("option", "", label);
                option.value = value;
                sortSelect.appendChild(option);
            }
            sortSelect.value = sort;
            sortSelect.addEventListener("change", () => {
                sort = sortSelect.value;
                try {
                    localStorage.setItem(SORT_KEY, sort);
                } catch {}
                drawList();
            });
            sortRow.appendChild(sortSelect);

            list = el("div", "mb-tm-list");
            const keys = el("div", "mb-tm-keys", "↑↓ move · Del delete · Ctrl+N new · Ctrl+S save");
            side.append(search, sortRow, list, button("+ New tag", addTag), keys);

            editor = el("div", "mb-tm-edit");

            banner = el("div", "mb-tm-banner");
            banner.append(el("span", "", "Deleted. Removed from disk when you save."), button("Undo", () => restore(current)));

            nameBox = el("div", "mb-tm-name");
            nameInput = el("input");
            nameInput.addEventListener("input", () => {
                if (current.deleted) return;
                if (/\s/.test(nameInput.value)) {
                    const caret = nameInput.selectionStart;
                    nameInput.value = nameInput.value.replace(/\s/g, "_");
                    nameInput.setSelectionRange(caret, caret);
                }
                current.name = nameInput.value;
                const name = nameInput.value.trim();
                const taken = live().some((t) => t !== current && t.name.trim() === name);
                nameBox.classList.toggle("mb-invalid", !TAG_NAME.test(name) || taken);
                drawList();
                drawDetails();
            });
            nameBox.append(el("span", "", "@"), nameInput);

            const field = el("div", "mb-tm-field");
            backdrop = el("div", "mb-tm-hl");
            textInput = el("textarea");
            textInput.addEventListener("input", onText);
            textInput.addEventListener("scroll", () => (backdrop.scrollTop = textInput.scrollTop));
            field.append(backdrop, textInput);
            detachAutocomplete = attachAutocomplete(textInput, {
                pick: (text) => {
                    textInput.value = text;
                    onText();
                },
                sync: onText,
            });
            words = el("span");

            preview = el("div", "mb-tm-preview");
            refs = el("div", "mb-tm-refs");

            const actions = el("div", "mb-tm-actions");
            actions.append(
                button("Load into node", () => {
                    setText(node, current.text);
                    getWidget(node, "tag_name").value = current.name.trim();
                    notify("success", "Tag loaded", `@${current.name.trim()}`);
                }),
                button("Duplicate", () => {
                    const tag = { name: uniqueName(`${current.name.trim()}_copy`), text: current.text, orig: null, deleted: false };
                    draft.push(tag);
                    select(tag);
                }),
                button("Delete", deleteCurrent, "mb-tm-danger"),
            );

            editor.append(
                banner,
                labelled("Name", nameBox),
                labelled("Prompt", field, words, "mb-tm-grow"),
                labelled("Expanded preview", preview),
                labelled("Uses / used by", refs),
                actions,
            );
            root.append(side, editor);
            body.appendChild(root);
            select(sorted(draft)[0]);
        },
        onApply() {
            const seen = new Set();
            for (const tag of live()) {
                const name = tag.name.trim();
                if (!TAG_NAME.test(name) || seen.has(name)) {
                    select(tag);
                    notify("warn", "Bad tag name", name ? `@${name} is invalid or used twice.` : "A tag name is empty.");
                    return false;
                }
                seen.add(name);
            }
            // Only the changes go to the server, so tags saved elsewhere while
            // this dialog was open survive.
            const remove = draft.filter((t) => t.deleted && t.orig !== null).map((t) => t.orig);
            const rename = {};
            const set = {};
            for (const tag of live()) {
                const name = tag.name.trim();
                if (tag.orig !== null && tag.orig !== name) rename[tag.orig] = name;
                if (tag.orig === null || tag.text !== tags[tag.orig]) set[name] = tag.text;
            }
            post("/mbnodes/prompt_tags/apply", { delete: remove, rename, set })
                .then(({ status: code, data }) => {
                    if (code >= 400) throw new Error(data?.error ?? `HTTP ${code}`);
                    tags = data.tags;
                    markEdited([...Object.values(rename), ...Object.keys(set)]);
                    notify("success", "Tags updated", `${Object.keys(tags).length} tag(s)`);
                })
                .catch((e) => notify("error", "Update failed", e?.message ?? String(e)));
        },
    });

    // The footer is built after render(), so the status line joins it here.
    status = el("span", "mb-tm-status");
    count.closest(".mb-dialog").querySelector(".mb-dialog-footer").prepend(status);
    drawList();
}

// ------------------------------------------------------------- button row

const ROW_H = 26;
const ROW_MARGIN = 15;
const ROW_GAP = 8;

// Buttons share one row; each takes an equal slice of the width.
function buttonRow(buttons) {
    function rects(width) {
        const w = (width - ROW_MARGIN * 2 - ROW_GAP * (buttons.length - 1)) / buttons.length;
        return buttons.map((_, i) => [ROW_MARGIN + i * (w + ROW_GAP), w]);
    }

    return {
        type: "mb_button_row",
        name: "buttons",
        width: 0,
        serialize: false,
        options: { serialize: false },

        computeSize(width) {
            return [width ?? 0, ROW_H];
        },

        computeLayoutSize() {
            return { minHeight: ROW_H, maxHeight: ROW_H, minWidth: 180 };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.width = widgetWidth || drawNode.size[0];
            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "12px Arial";
            rects(this.width).forEach(([x, w], i) => {
                ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
                ctx.beginPath();
                ctx.roundRect(x, y, w, ROW_H, 7);
                ctx.fill();
                ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
                ctx.fillText(buttons[i][0], x + w / 2, y + ROW_H / 2);
            });
            ctx.restore();
        },

        // Only x decides which button was hit; the widget only receives clicks
        // inside its own box, whatever origin the renderer measures y from.
        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            const hit = rects(this.width || mouseNode.size[0])
                .findIndex(([x, w]) => pos[0] >= x && pos[0] <= x + w);
            if (hit < 0) return false;
            buttons[hit][1](event);
            return true;
        },
    };
}

// ------------------------------------------------------------- insert tag

// Searchable list of saved tags (ComfyUI adds its type-to-filter box to dark
// menus); the pick goes in at the caret.
async function insertTag(node, textarea, event) {
    await fetchTags().catch(() => {});
    const names = Object.keys(tags).sort((a, b) => a.localeCompare(b));
    if (!names.length) {
        notify("info", "No tags yet", "Save a prompt as a tag first.");
        return;
    }
    const items = names.map((name) => ({
        content: `@${name}  ·  ${firstWords(tags[name])}`,
        callback: () => {
            const start = textarea?.selectionStart ?? 0;
            const end = textarea?.selectionEnd ?? start;
            const text = getWidget(node, "text")?.value ?? "";
            const before = text.slice(0, start);
            const insert = `${before && !/\s$/.test(before) ? " " : ""}@${name} `;
            setText(node, before + insert + text.slice(end));
            textarea?.focus();
            textarea?.setSelectionRange(start + insert.length, start + insert.length);
        },
    }));
    new LiteGraph.ContextMenu(items, { event, className: "dark", scale: Math.max(1, app.canvas.ds.scale) });
}

// ---------------------------------------------------------------- preview

function openPreview(node) {
    const { output, unknown } = resolve(getWidget(node, "text")?.value ?? "");
    openDialog({
        title: "Expanded prompt",
        applyLabel: "Copy",
        width: 640,
        render(body) {
            ensureManagerStyle();
            const box = el("div", "mb-tm-preview", output || "(empty)");
            box.style.maxHeight = "360px";
            body.appendChild(box);
            if (getWidget(node, "dynamic_prompts")?.value && output.search(CHOICE) >= 0) {
                const note = el("div", "", "{a|b} choices are picked with the seed when the graph runs.");
                note.style.cssText = "color:var(--descrip-text);font-size:12px;margin-top:8px";
                body.appendChild(note);
            }
            if (unknown.length) {
                const warn = el("div", "", `Unresolved (unknown or self-referencing): ${unknown.map((n) => `@${n}`).join(", ")}`);
                warn.style.cssText = "color:#e5484d;font-size:12px;margin-top:8px";
                body.appendChild(warn);
            }
        },
        onApply() {
            navigator.clipboard.writeText(output)
                .then(() => notify("success", "Copied", `${output.length} characters`))
                .catch((e) => notify("error", "Copy failed", e?.message ?? String(e)));
        },
    });
}

const PREVIEW_H = 18;
const UNKNOWN_COLOR = "#e5484d";

// One line under the buttons: word count of what the node will output, and any
// @names that won't expand. Click it for the full text.
function previewLine(node) {
    return {
        type: "mb_tag_preview",
        name: "preview",
        serialize: false,
        options: { serialize: false },

        computeSize(width) {
            return [width ?? 0, PREVIEW_H];
        },

        computeLayoutSize() {
            return { minHeight: PREVIEW_H, maxHeight: PREVIEW_H, minWidth: 180 };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            const { output, unknown } = resolve(getWidget(node, "text")?.value ?? "");
            node.__mbUnknown = unknown;
            const words = output.split(/\s+/).filter(Boolean).length;
            const main = `→ ${words} word${words === 1 ? "" : "s"}`;
            ctx.save();
            ctx.font = "11px Arial";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            // Python's seeded picks can't be reproduced here, so with dynamic
            // prompts on the line counts the choice groups instead.
            const choices = getWidget(node, "dynamic_prompts")?.value ? (output.match(CHOICE) ?? []).length : 0;
            const label = choices ? `${main}  ·  ${choices} choice${choices === 1 ? "" : "s"} picked by seed` : main;
            ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR ?? "#999";
            ctx.fillText(label, ROW_MARGIN, y + PREVIEW_H / 2);
            if (unknown.length) {
                ctx.fillStyle = UNKNOWN_COLOR;
                ctx.fillText(`  ·  unresolved: ${unknown.map((n) => `@${n}`).join(", ")}`,
                    ROW_MARGIN + ctx.measureText(label).width, y + PREVIEW_H / 2);
            }
            ctx.restore();
        },

        mouse(event) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            openPreview(node);
            return true;
        },
    };
}

app.registerExtension({
    name: "MBNodes.PromptTags",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPromptTags") return;
        const widget = getWidget(node, "text");
        const textarea = widget?.inputEl ?? widget?.element;

        node.addCustomWidget(buttonRow([
            ["Save Tag", () => saveTag(node)],
            ["Insert Tag", (event) => insertTag(node, textarea, event)],
            ["Manage Tags", () => openManageDialog(node)],
        ]));
        node.addCustomWidget(previewLine(node));

        const prevDraw = node.onDrawForeground;
        node.onDrawForeground = function (ctx) {
            const r = prevDraw?.apply(this, arguments);
            const count = node.__mbUnknown?.length ?? 0;
            if (count && !this.flags?.collapsed) {
                ctx.save();
                ctx.font = "11px Arial";
                ctx.textAlign = "right";
                ctx.textBaseline = "middle";
                ctx.fillStyle = UNKNOWN_COLOR;
                ctx.fillText(`${count} unresolved tag${count === 1 ? "" : "s"}`, this.size[0] - 10, -LiteGraph.NODE_TITLE_HEIGHT / 2);
                ctx.restore();
            }
            return r;
        };

        if (textarea instanceof HTMLTextAreaElement) {
            const detach = attachAutocomplete(textarea, {
                pick: (text) => setText(node, text),
                sync: (text) => {
                    if (widget) widget.value = text;
                },
            });
            const onRemoved = node.onRemoved;
            node.onRemoved = function () {
                detach();
                return onRemoved?.apply(this, arguments);
            };
        }
        fetchTags().catch(() => {});
    },
});
