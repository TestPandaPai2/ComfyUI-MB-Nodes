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

async function saveTag(node) {
    const text = getWidget(node, "text")?.value ?? "";
    const name = (getWidget(node, "tag_name")?.value ?? "").trim().replace(/^@/, "");

    if (!TAG_NAME.test(name)) {
        notify("warn", "Bad tag name", "Use letters, digits, _ and - only.");
        return;
    }
    if (!text.trim()) {
        notify("warn", "Nothing to save", "The prompt is empty.");
        return;
    }
    if (new RegExp(`@${name}(?![A-Za-z0-9_-])`).test(text)) {
        notify("warn", "Tag refers to itself", `@${name} would stay unexpanded inside its own prompt.`);
    }

    try {
        let result = await post("/mbnodes/prompt_tags/save", { name, text, overwrite: false });
        if (result.status === 409) {
            if (!confirm(`@${name} already exists.\n\nOverwrite it?`)) return;
            result = await post("/mbnodes/prompt_tags/save", { name, text, overwrite: true });
        }
        if (result.status >= 400) {
            notify("error", "Save failed", result.data?.error ?? `HTTP ${result.status}`);
            return;
        }
        tags = result.data.tags;
        notify("success", "Tag saved", `@${result.data.name}`);
    } catch (e) {
        notify("error", "Save failed", e?.message ?? String(e));
    }
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
    background: #212124;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 4px;
    font: 12.5px system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #ececee;
}
.mb-tag-popup div { padding: 4px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-tag-popup div span { color: #77777e; margin-left: 8px; }
.mb-tag-popup div.mb-active { background: color-mix(in srgb, var(--mb-accent, #d4537e) 30%, #212124); }
`;

function ensurePopupStyle() {
    if (document.getElementById("mb-tag-popup-style")) return;
    const style = document.createElement("style");
    style.id = "mb-tag-popup-style";
    style.textContent = POPUP_CSS;
    document.head.appendChild(style);
}

function attachAutocomplete(node, textarea) {
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
        const rect = textarea.getBoundingClientRect();
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 4}px`;
        popup.style.display = "";
        render();
    }

    function pick(name) {
        const caret = textarea.selectionStart;
        const text = textarea.value.slice(0, start) + `@${name} ` + textarea.value.slice(caret);
        setText(node, text);
        const pos = start + name.length + 2;
        textarea.setSelectionRange(pos, pos);
        hide();
    }

    // Other packs (tag autocompleters) also listen for "@" on every textarea.
    // Window capture runs before any listener on the textarea itself, so while
    // an @tag is being typed the event stops here and only our list shows.
    // Their listeners would also have synced widget.value, so do that here.
    function onInput(event) {
        if (event.target !== textarea) return;
        active = 0;
        update();
        if (query() === null) return;
        event.stopImmediatePropagation();
        const widget = getWidget(node, "text");
        if (widget) widget.value = textarea.value;
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
.mb-tm { display: grid; grid-template-columns: 230px minmax(0, 1fr); height: 520px; margin: -10px -16px -14px; }
.mb-tm-side { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #1c1c1f; border-right: 1px solid #2a2a2e; min-height: 0; }
.mb-tm-search { position: relative; }
.mb-tm-search::before { content: "⌕"; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #6e6e75; font-size: 15px; }
.mb-tm-search input { padding-left: 28px; }
.mb-tm-list { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
.mb-tm-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; white-space: nowrap; overflow: hidden; flex: none; }
.mb-tm-row:hover { background: #2a2a2e; }
.mb-tm-row.mb-selected { background: color-mix(in srgb, var(--mb-a) 24%, #1c1c1f); }
.mb-tm-row b { font-weight: 500; }
.mb-tm-row span { color: #6e6e75; overflow: hidden; text-overflow: ellipsis; }
.mb-tm-row i { width: 6px; height: 6px; border-radius: 50%; background: var(--mb-a); margin-left: auto; flex: none; }
.mb-tm-edit { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px; overflow-y: auto; min-width: 0; }
.mb-tm-label { display: flex; justify-content: space-between; font-size: 11px; color: #8e8e95; margin-bottom: 5px; }
.mb-tm input, .mb-tm textarea {
    width: 100%; box-sizing: border-box; padding: 8px 12px; background: #2a2a2e; color: #ececee;
    border: 1px solid transparent; border-radius: 8px; font: inherit; outline: none;
}
.mb-tm textarea { resize: vertical; min-height: 130px; line-height: 1.5; }
.mb-tm input:focus, .mb-tm textarea:focus { border-color: var(--mb-a); }
.mb-tm-name { display: flex; align-items: center; background: #2a2a2e; border: 1px solid transparent; border-radius: 8px; }
.mb-tm-name:focus-within { border-color: var(--mb-a); }
.mb-tm-name.mb-invalid { border-color: #e5484d; }
.mb-tm-name span { padding-left: 12px; color: var(--mb-a); font-weight: 500; }
.mb-tm-name input, .mb-tm-name input:focus { background: transparent; border-color: transparent; padding-left: 3px; }
.mb-tm-preview { background: #18181a; border-radius: 8px; padding: 10px 12px; color: #b4b2a9; font-size: 12.5px; line-height: 1.6; min-height: 20px; max-height: 120px; overflow-y: auto; white-space: pre-wrap; }
.mb-tm-refs { font-size: 12px; color: #6e6e75; line-height: 1.9; }
.mb-tm-chip { display: inline-block; background: color-mix(in srgb, var(--mb-a) 22%, #18181a); color: #f4c0d1; border-radius: 5px; padding: 0 6px; margin-right: 4px; cursor: pointer; }
.mb-tm-chip:hover { filter: brightness(1.2); }
.mb-tm-actions { display: flex; gap: 8px; margin-top: auto; }
.mb-tm-danger { color: #e5484d !important; margin-left: auto; }
.mb-tm-empty { color: #6e6e75; font-size: 12px; padding: 8px 10px; }
.mb-tm-count { font-size: 11px; color: #8e8e95; background: #2a2a2e; border-radius: 10px; padding: 2px 8px; }
.mb-tm-status { flex: 1; align-self: center; font-size: 12px; color: #8e8e95; }
`;

function ensureManagerStyle() {
    if (document.getElementById("mb-tm-style")) return;
    const style = document.createElement("style");
    style.id = "mb-tm-style";
    style.textContent = MANAGER_CSS;
    document.head.appendChild(style);
}

// Same rules as expand() in nodes/prompt_tags_node.py; only feeds the preview.
function expandTags(text, all, chain = []) {
    return text.replace(/@([A-Za-z0-9_-]+)/g, (match, name) =>
        name in all && !chain.includes(name) && chain.length < 16
            ? expandTags(all[name], all, [...chain, name])
            : match);
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

async function openManageDialog(node) {
    try {
        await fetchTags();
    } catch (e) {
        notify("error", "Could not load tags", e?.message ?? String(e));
        return;
    }
    ensureManagerStyle();

    // Edited locally, written back as a whole on Save changes. `orig` is the
    // saved name, so edits and deletes can be counted against what is on disk.
    const draft = Object.entries(tags).map(([name, text]) => ({ name, text, orig: name }));
    let removed = 0;
    let current = null;
    let filter = "";
    let list, nameBox, nameInput, textInput, words, preview, refs, editor, count, status;

    const asMap = () => Object.fromEntries(draft.map((t) => [t.name.trim(), t.text]));
    const edited = (t) => t.orig === null || t.name.trim() !== t.orig || t.text !== tags[t.orig];

    function uniqueName(base) {
        let name = base;
        for (let i = 2; draft.some((t) => t.name.trim() === name); i++) name = `${base}_${i}`;
        return name;
    }

    function drawList() {
        list.replaceChildren();
        const shown = draft
            .filter((t) => t.name.toLowerCase().includes(filter))
            .sort((a, b) => a.name.localeCompare(b.name));
        if (!shown.length) list.appendChild(el("div", "mb-tm-empty", draft.length ? "No matches." : "No tags saved yet."));
        for (const tag of shown) {
            const row = el("div", "mb-tm-row" + (tag === current ? " mb-selected" : ""));
            row.append(el("b", "", `@${tag.name}`), el("span", "", firstWords(tag.text)));
            if (edited(tag)) row.appendChild(el("i"));
            row.addEventListener("click", () => select(tag));
            list.appendChild(row);
        }
        count.textContent = `${draft.length} tag${draft.length === 1 ? "" : "s"}`;
        const changes = draft.filter(edited).length + removed;
        if (status) status.textContent = changes ? `${changes} unsaved change${changes === 1 ? "" : "s"}` : "All changes saved";
    }

    function chips(names) {
        const span = el("span");
        if (!names.length) span.textContent = "none";
        for (const name of names) {
            const chip = el("span", "mb-tm-chip", `@${name}`);
            chip.addEventListener("click", () => select(draft.find((t) => t.name.trim() === name)));
            span.appendChild(chip);
        }
        return span;
    }

    function drawDetails() {
        if (!current) return;
        const all = asMap();
        const name = current.name.trim();
        words.textContent = `${current.text.trim().split(/\s+/).filter(Boolean).length} words`;
        preview.textContent = expandTags(current.text, all, [name]);

        const uses = referencedNames(current.text).filter((n) => n in all && n !== name);
        const usedBy = draft.filter((t) => t !== current && referencedNames(t.text).includes(name)).map((t) => t.name.trim());
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
    }

    function button(label, onClick, extra = "") {
        const b = el("button", `mb-dialog-button ${extra}`, label);
        b.addEventListener("click", onClick);
        return b;
    }

    function labelled(text, field, aside) {
        const wrap = el("div");
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
    window.addEventListener("keydown", keepEnter, true);

    openDialog({
        title: "Tag manager",
        width: 900,
        applyLabel: "Save changes",
        onClose: () => window.removeEventListener("keydown", keepEnter, true),
        render(body) {
            count = el("span", "mb-tm-count");
            body.parentElement.querySelector(".mb-dialog-title").after(count);
            body.parentElement.querySelector(".mb-dialog-title").style.flex = "0 1 auto";
            count.style.marginRight = "auto";

            const root = el("div", "mb-tm");

            const side = el("div", "mb-tm-side");
            const search = el("div", "mb-tm-search");
            const searchInput = el("input");
            searchInput.placeholder = "Search tags";
            searchInput.addEventListener("input", () => {
                filter = searchInput.value.trim().toLowerCase();
                drawList();
            });
            search.appendChild(searchInput);
            list = el("div", "mb-tm-list");
            const add = button("+ New tag", () => {
                const tag = { name: uniqueName("new_tag"), text: "", orig: null };
                draft.push(tag);
                select(tag);
                nameInput.focus();
                nameInput.select();
            });
            side.append(search, list, add);

            editor = el("div", "mb-tm-edit");

            nameBox = el("div", "mb-tm-name");
            nameInput = el("input");
            nameInput.addEventListener("input", () => {
                current.name = nameInput.value;
                const name = nameInput.value.trim();
                const taken = draft.some((t) => t !== current && t.name.trim() === name);
                nameBox.classList.toggle("mb-invalid", !TAG_NAME.test(name) || taken);
                drawList();
                drawDetails();
            });
            nameBox.append(el("span", "", "@"), nameInput);

            textInput = el("textarea");
            textInput.addEventListener("input", () => {
                current.text = textInput.value;
                drawList();
                drawDetails();
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
                    const tag = { name: uniqueName(`${current.name.trim()}_copy`), text: current.text, orig: null };
                    draft.push(tag);
                    select(tag);
                }),
                button("Delete", () => {
                    if (current.orig !== null) removed++;
                    draft.splice(draft.indexOf(current), 1);
                    select(draft[0]);
                }, "mb-tm-danger"),
            );

            editor.append(
                labelled("Name", nameBox),
                labelled("Prompt", textInput, words),
                labelled("Expanded preview", preview),
                labelled("Uses / used by", refs),
                actions,
            );
            root.append(side, editor);
            body.appendChild(root);
            select([...draft].sort((a, b) => a.name.localeCompare(b.name))[0]);
        },
        onApply() {
            const next = {};
            for (const tag of draft) {
                const name = tag.name.trim();
                if (!TAG_NAME.test(name) || name in next) {
                    select(tag);
                    notify("warn", "Bad tag name", name ? `@${name} is invalid or used twice.` : "A tag name is empty.");
                    return false;
                }
                next[name] = tag.text;
            }
            post("/mbnodes/prompt_tags/replace", { tags: next })
                .then(({ status: code, data }) => {
                    if (code >= 400) throw new Error(data?.error ?? `HTTP ${code}`);
                    tags = data.tags;
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
                ctx.fillStyle = "#2a2a2e";
                ctx.beginPath();
                ctx.roundRect(x, y, w, ROW_H, 7);
                ctx.fill();
                ctx.fillStyle = "#ececee";
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
            buttons[hit][1]();
            return true;
        },
    };
}

app.registerExtension({
    name: "MBNodes.PromptTags",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPromptTags") return;
        node.addCustomWidget(buttonRow([
            ["Save Tag", () => saveTag(node)],
            ["Manage Tags", () => openManageDialog(node)],
        ]));

        const widget = getWidget(node, "text");
        const textarea = widget?.inputEl ?? widget?.element;
        if (textarea instanceof HTMLTextAreaElement) {
            const detach = attachAutocomplete(node, textarea);
            const onRemoved = node.onRemoved;
            node.onRemoved = function () {
                detach();
                return onRemoved?.apply(this, arguments);
            };
        }
        fetchTags().catch(() => {});
    },
});
