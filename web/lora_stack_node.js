// LoRA Stack (MB): rows drawn on the canvas like stock widgets, saved as JSON
// in the hidden `loras` widget (Autogrow can only grow sockets, not rows).
// - Header: toggle all on/off, and how many rows are on.
// - Row: ⋮⋮ drag handle to reorder, on/off pill, file name ▾ (click for a
//   searchable list), ⓘ trigger words (tick which go out, add your own),
//   strength as ◀ 1.00 ▶ over a fill bar (arrows step, drag to scrub, click to type).
// - Right-click a row: move up / down, duplicate, remove.
// A row whose file isn't on disk is drawn red, with "missing file" in the
// title bar, like Load Models Combo.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { accentColor, getWidget, resizeToContent, setWidgetVisible } from "./common.js";
import { openDialog } from "./dialog.js";

const NODE_ID = "MBLoraStack";
const ROW_H = 22;
const MARGIN = 15;
const HANDLE_W = 14;
const PILL_W = 26;
const PILL_H = 12;
const STRENGTH_W = 84;
const ARROW_W = 16;
const INFO_W = 18;
const CARET_W = 12;
const FILL_MAX = 2; // strength that fills the bar
const NEGATIVE_COLOR = "#5b8def";
const STEP = 0.05;
const DRAG_STEP = 0.01;
const MIN_STRENGTH = -10;
const MAX_STRENGTH = 10;
const MISSING_COLOR = "#e5484d";
const OFF_COLOR = "#555";

let loraFiles = [];

async function fetchLoras() {
    const r = await api.fetchApi("/models/loras");
    if (r.ok) loraFiles = await r.json();
}

const basename = (path) => path.split(/[\\/]/).pop();
const clamp = (v) => Math.min(MAX_STRENGTH, Math.max(MIN_STRENGTH, Math.round(v * 100) / 100));
const isMissing = (row) => row.lora && !loraFiles.includes(row.lora);
const isDown = (event) => event.type === "pointerdown" || event.type === "mousedown";
const menuScale = () => Math.max(1, app.canvas.ds.scale);

function readRows(node) {
    try {
        const rows = JSON.parse(getWidget(node, "loras")?.value || "[]");
        return Array.isArray(rows) ? rows : [];
    } catch {
        return [];
    }
}

function save(node) {
    getWidget(node, "loras").value = JSON.stringify(node.__mbRows);
    node.__mbMissing = node.__mbRows.some((r) => r.on !== false && isMissing(r));
    node.setDirtyCanvas(true, true);
}

const PICKER_CSS = `
.mb-lora-picker { position: fixed; z-index: 10000; width: 320px; max-height: 360px; display: flex; flex-direction: column;
    background: var(--comfy-menu-bg); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.5); overflow: hidden;
    font: 12.5px system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--input-text); }
.mb-lora-picker input { margin: 8px; padding: 5px 10px; border-radius: 7px; border: 1px solid transparent; outline: none;
    background: var(--comfy-input-bg); color: var(--input-text); }
.mb-lora-picker input:focus { border-color: var(--mb-accent, #d4537e); }
.mb-lora-picker-list { overflow-y: auto; padding: 0 4px 6px; }
.mb-lora-picker-item { padding: 4px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-lora-picker-item:hover, .mb-lora-picker-item.mb-active { background: var(--border-color); }
.mb-lora-trigger { cursor: pointer; }
.mb-lora-trigger span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.mb-lora-trigger input[type="checkbox"] { accent-color: var(--mb-accent, #d4537e); margin: 0; flex: none; }
.mb-lora-custom-tag { color: var(--descrip-text); font-size: 11px; }
`;

function ensurePickerStyle() {
    if (document.getElementById("mb-lora-picker-style")) return;
    const style = document.createElement("style");
    style.id = "mb-lora-picker-style";
    style.textContent = PICKER_CSS;
    document.head.appendChild(style);
}

// Searchable file list at the pointer: type to filter, arrows + Enter to pick.
function pickLora(event, callback) {
    if (!loraFiles.length) return;
    ensurePickerStyle();
    document.querySelector(".mb-lora-picker")?.remove();

    const box = document.createElement("div");
    box.className = "mb-lora-picker";
    const search = document.createElement("input");
    search.placeholder = "Search LoRAs…";
    const list = document.createElement("div");
    list.className = "mb-lora-picker-list";
    box.append(search, list);
    document.body.appendChild(box);
    box.style.left = `${Math.min(event.clientX, window.innerWidth - 330)}px`;
    box.style.top = `${Math.min(event.clientY, window.innerHeight - 370)}px`;

    let matches = [];
    let active = 0;
    const close = () => {
        window.removeEventListener("pointerdown", outside, true);
        box.remove();
    };
    const choose = (value) => {
        close();
        callback(value);
    };
    const render = () => {
        const terms = search.value.toLowerCase().split(/\s+/).filter(Boolean);
        matches = loraFiles.filter((f) => terms.every((t) => f.toLowerCase().includes(t)));
        active = Math.min(active, Math.max(0, matches.length - 1));
        list.replaceChildren(...matches.map((file, i) => {
            const item = document.createElement("div");
            item.className = "mb-lora-picker-item" + (i === active ? " mb-active" : "");
            item.textContent = file;
            item.title = file;
            item.addEventListener("click", () => choose(file));
            return item;
        }));
        list.children[active]?.scrollIntoView({ block: "nearest" });
    };
    const outside = (e) => {
        if (!box.contains(e.target)) close();
    };

    search.addEventListener("input", () => {
        active = 0;
        render();
    });
    search.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") close();
        else if (e.key === "Enter" && matches[active]) choose(matches[active]);
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            active = Math.max(0, Math.min(matches.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)));
            render();
        }
    });
    window.addEventListener("pointerdown", outside, true);
    render();
    search.focus();
}

async function openTriggers(node, row) {
    const response = await api.fetchApi(`/mbnodes/lora_triggers?${new URLSearchParams({ lora: row.lora })}`);
    if (!response.ok) return;
    const data = await response.json();
    let custom = [...data.custom];
    const selected = new Set(row.triggers ?? [...data.triggers, ...data.custom]);
    ensurePickerStyle();

    let list;
    const render = () => {
        const words = [...data.triggers, ...custom.filter((w) => !data.triggers.includes(w))];
        if (!words.length) {
            const empty = document.createElement("div");
            empty.className = "mb-dialog-hint";
            empty.style.margin = "0";
            empty.textContent = "No trigger words found. Add your own below.";
            list.replaceChildren(empty);
            return;
        }
        list.replaceChildren(...words.map((word) => {
            const item = document.createElement("label");
            item.className = "mb-dialog-item mb-lora-trigger";
            const box = document.createElement("input");
            box.type = "checkbox";
            box.checked = selected.has(word);
            box.addEventListener("change", () => (box.checked ? selected.add(word) : selected.delete(word)));
            const text = document.createElement("span");
            text.textContent = word;
            item.append(box, text);
            if (custom.includes(word) && !data.triggers.includes(word)) {
                const tag = document.createElement("span");
                tag.className = "mb-lora-custom-tag";
                tag.style.flex = "none";
                tag.textContent = "custom";
                const remove = document.createElement("button");
                remove.className = "mb-dialog-remove";
                remove.textContent = "×";
                remove.addEventListener("click", (e) => {
                    e.preventDefault();
                    custom = custom.filter((w) => w !== word);
                    selected.delete(word);
                    render();
                });
                item.append(tag, remove);
            }
            return item;
        }));
    };

    openDialog({
        title: basename(row.lora),
        width: 380,
        render(body) {
            list = document.createElement("div");
            list.className = "mb-dialog-list";

            const add = document.createElement("div");
            add.className = "mb-dialog-item";
            const input = document.createElement("input");
            input.placeholder = "Add a trigger (commas add several)";
            const button = document.createElement("button");
            button.className = "mb-dialog-button";
            button.textContent = "Add";
            const addWords = () => {
                for (const word of input.value.split(",").map((w) => w.trim()).filter(Boolean)) {
                    if (!custom.includes(word) && !data.triggers.includes(word)) custom.push(word);
                    selected.add(word);
                }
                input.value = "";
                render();
            };
            button.addEventListener("click", addWords);
            input.addEventListener("keydown", (e) => {
                if (e.key !== "Enter") return;
                e.stopPropagation(); // Enter adds here instead of applying the dialog
                addWords();
            });
            add.append(input, button);

            body.append(list, add);
            render();
        },
        onApply() {
            const words = new Set([...data.triggers, ...custom]);
            row.triggers = [...selected].filter((w) => words.has(w));
            save(node);
            if (custom.join("\n") !== data.custom.join("\n")) {
                api.fetchApi("/mbnodes/lora_triggers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ lora: row.lora, custom }),
                });
            }
        },
    });
}

// Follows the pointer outside the node until release; dx is in canvas units.
// Listens on window in the capture phase: the canvas stops pointerup from
// bubbling, which left the drag running after release.
function trackPointer(event, onMove, onUp) {
    const startX = event.clientX;
    let moved = false;
    const move = (e) => {
        if (e.buttons === 0) return up(e);
        const dx = (e.clientX - startX) / app.canvas.ds.scale;
        if (Math.abs(dx) > 3) moved = true;
        if (moved) onMove?.(e, dx);
    };
    const up = (e) => {
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", up, true);
        window.removeEventListener("pointercancel", up, true);
        onUp?.(e, moved);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
}

// --------------------------------------------------------------- drawing

function drawPill(ctx, x, cy, state) {
    const y = cy - PILL_H / 2;
    ctx.fillStyle = state === false ? OFF_COLOR : accentColor();
    ctx.globalAlpha = state === "mixed" ? 0.5 : 1;
    ctx.beginPath();
    ctx.roundRect(x, y, PILL_W, PILL_H, PILL_H / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    const knobX = state === true ? x + PILL_W - PILL_H / 2 : state === false ? x + PILL_H / 2 : x + PILL_W / 2;
    ctx.fillStyle = "#eee";
    ctx.beginPath();
    ctx.arc(knobX, cy, PILL_H / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
}

function background(ctx, x, y, w, outline) {
    ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
    ctx.strokeStyle = outline ?? LiteGraph.WIDGET_OUTLINE_COLOR;
    ctx.beginPath();
    ctx.roundRect(x, y, w, ROW_H, ROW_H / 2);
    ctx.fill();
    ctx.stroke();
}

function ellipsize(ctx, text, width) {
    if (ctx.measureText(text).width <= width) return text;
    while (text.length && ctx.measureText(text + "…").width > width) text = text.slice(0, -1);
    return text + "…";
}

// --------------------------------------------------------------- widgets

function baseWidget(type, name) {
    return {
        type,
        name,
        serialize: false,
        options: { serialize: false },
        computeSize(width) {
            return [width ?? 0, ROW_H];
        },
        computeLayoutSize() {
            return { minHeight: ROW_H, maxHeight: ROW_H, minWidth: 220 };
        },
    };
}

function headerWidget(node) {
    const widget = baseWidget("mb_lora_header", "lora_header");

    widget.draw = function (ctx, drawNode, widgetWidth, y) {
        const rows = node.__mbRows;
        const on = rows.filter((r) => r.on !== false).length;
        const state = !rows.length || on === rows.length ? true : on === 0 ? false : "mixed";
        ctx.save();
        drawPill(ctx, MARGIN, y + ROW_H / 2, state);
        ctx.font = "12px Arial";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        ctx.fillText("Toggle all", MARGIN + PILL_W + 8, y + ROW_H / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR ?? "#999";
        ctx.fillText(`${on} / ${rows.length} on`, (widgetWidth || drawNode.size[0]) - MARGIN, y + ROW_H / 2);
        ctx.restore();
    };

    widget.mouse = function (event, pos) {
        if (!isDown(event) || pos[0] > MARGIN + PILL_W + 80) return false;
        const allOn = node.__mbRows.every((r) => r.on !== false);
        for (const row of node.__mbRows) row.on = !allOn;
        save(node);
        return true;
    };

    return widget;
}

function rowWidget(node, index) {
    const widget = baseWidget("mb_lora_row", `lora_${index}`);
    widget.mbRowIndex = index;
    Object.defineProperty(widget, "tooltip", { get: () => node.__mbRows[index]?.lora || undefined });

    // x ranges of the parts, from the widget width.
    const layout = (width) => {
        const strengthX = width - MARGIN - STRENGTH_W;
        const infoX = strengthX - 4 - INFO_W;
        const pillX = MARGIN + HANDLE_W + 4;
        const nameX = pillX + PILL_W + 8;
        return { pillX, nameX, nameW: infoX - 4 - CARET_W - nameX, infoX, strengthX };
    };

    widget.draw = function (ctx, drawNode, widgetWidth, y) {
        const width = widgetWidth || drawNode.size[0];
        const row = node.__mbRows[index];
        const { pillX, nameX, nameW, infoX, strengthX } = layout(width);
        const missing = isMissing(row);
        const on = row.on !== false;
        const cy = y + ROW_H / 2;
        this.mbY = y;
        this.mbWidth = width;

        ctx.save();
        background(ctx, MARGIN, y, width - MARGIN * 2, missing ? MISSING_COLOR : undefined);
        ctx.textBaseline = "middle";
        ctx.font = "12px Arial";

        // handle
        ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR ?? "#999";
        ctx.textAlign = "center";
        ctx.fillText("⋮⋮", MARGIN + 4 + HANDLE_W / 2, cy);

        drawPill(ctx, pillX, cy, on);

        // name
        ctx.globalAlpha = on ? 1 : 0.45;
        ctx.textAlign = "left";
        ctx.fillStyle = missing ? MISSING_COLOR : LiteGraph.WIDGET_TEXT_COLOR;
        const label = ellipsize(ctx, row.lora ? basename(row.lora) : "(pick a LoRA)", nameW);
        ctx.fillText(label, nameX, cy);
        const caretX = nameX + ctx.measureText(label).width + 4;
        ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR ?? "#999";
        ctx.font = "9px Arial";
        ctx.fillText("▾", caretX, cy);
        ctx.font = "12px Arial";

        // trigger words
        if (row.lora) {
            ctx.strokeStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR ?? "#999";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(infoX + INFO_W / 2, cy, 6.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = "bold 10px Arial";
            ctx.textAlign = "center";
            ctx.fillText("i", infoX + INFO_W / 2, cy + 0.5);
            ctx.font = "12px Arial";
        }

        // strength: fill bar, then ◀ value ▶
        const strength = Number(row.strength ?? 1);
        const fill = Math.min(1, Math.abs(strength) / FILL_MAX) * (STRENGTH_W - 4);
        if (fill > 0) {
            ctx.fillStyle = strength < 0 ? NEGATIVE_COLOR : accentColor();
            ctx.globalAlpha *= 0.3;
            ctx.beginPath();
            ctx.roundRect(strengthX + 2, y + 3, fill, ROW_H - 6, (ROW_H - 6) / 2);
            ctx.fill();
            ctx.globalAlpha = on ? 1 : 0.45;
        }
        ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR ?? "#999";
        ctx.textAlign = "center";
        ctx.fillText("◀", strengthX + ARROW_W / 2, cy);
        ctx.fillText("▶", strengthX + STRENGTH_W - ARROW_W / 2, cy);
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        ctx.fillText(Number(row.strength ?? 1).toFixed(2), strengthX + STRENGTH_W / 2, cy);
        ctx.globalAlpha = 1;

        // drop marker while a row is being dragged
        if (node.__mbDrop?.target === index || node.__mbDrop?.target === index + 1) {
            const lineY = node.__mbDrop.target === index ? y - 2 : y + ROW_H + 2;
            ctx.strokeStyle = accentColor();
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(MARGIN, lineY);
            ctx.lineTo(width - MARGIN, lineY);
            ctx.stroke();
        }
        ctx.restore();
    };

    widget.mouse = function (event, pos) {
        if (!isDown(event) || event.button === 2) return false;
        const row = node.__mbRows[index];
        const { pillX, nameX, infoX, strengthX } = layout(this.mbWidth || node.size[0]);
        const x = pos[0];

        if (x < pillX) {
            startReorder(node, index, event);
        } else if (x < nameX) {
            row.on = row.on === false;
            save(node);
        } else if (x < infoX) {
            pickLora(event, (value) => {
                if (!value || value === row.lora) return;
                row.lora = value;
                delete row.triggers; // picks belonged to the old file
                save(node);
            });
        } else if (x < strengthX) {
            if (row.lora && !isMissing(row)) openTriggers(node, row);
        } else if (x < strengthX + ARROW_W) {
            row.strength = clamp((row.strength ?? 1) - STEP);
            save(node);
        } else if (x > strengthX + STRENGTH_W - ARROW_W) {
            row.strength = clamp((row.strength ?? 1) + STEP);
            save(node);
        } else {
            const start = row.strength ?? 1;
            trackPointer(event, (e, dx) => {
                row.strength = clamp(start + Math.round(dx) * DRAG_STEP);
                save(node);
            }, (e, moved) => {
                if (moved) return;
                app.canvas.prompt("Strength", start, (value) => {
                    const n = Number(value);
                    if (Number.isFinite(n)) {
                        row.strength = clamp(n);
                        save(node);
                    }
                }, e);
            });
        }
        return true;
    };

    return widget;
}

function addWidget(node) {
    const widget = baseWidget("mb_lora_add", "lora_add");

    widget.draw = function (ctx, drawNode, widgetWidth, y) {
        const width = widgetWidth || drawNode.size[0];
        ctx.save();
        background(ctx, MARGIN, y, width - MARGIN * 2);
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        ctx.fillText("+ Add LoRA", width / 2, y + ROW_H / 2);
        ctx.restore();
    };

    widget.mouse = function (event) {
        if (!isDown(event)) return false;
        pickLora(event, (value) => {
            if (!value) return;
            node.__mbRows.push({ on: true, lora: value, strength: 1 });
            save(node);
            rebuild(node);
        });
        return true;
    };

    return widget;
}

// ------------------------------------------------------------ row actions

function rowAt(node, canvasY) {
    const y = canvasY - node.pos[1];
    return node.widgets.find((w) => w.type === "mb_lora_row" && w.mbY != null && y >= w.mbY && y <= w.mbY + ROW_H)?.mbRowIndex;
}

function moveRow(node, from, to) {
    const rows = node.__mbRows;
    if (from === to || to < 0 || to >= rows.length) return;
    rows.splice(to, 0, rows.splice(from, 1)[0]);
    save(node);
}

function startReorder(node, index, event) {
    node.__mbDrop = { target: index };
    trackPointer(event, (e) => {
        const [, y] = app.canvas.convertEventToCanvasOffset(e);
        const rows = node.widgets.filter((w) => w.type === "mb_lora_row");
        const local = y - node.pos[1];
        let target = rows.length;
        for (const w of rows) {
            if (local < w.mbY + ROW_H / 2) {
                target = w.mbRowIndex;
                break;
            }
        }
        node.__mbDrop.target = target;
        node.setDirtyCanvas(true, true);
    }, () => {
        const target = node.__mbDrop.target;
        node.__mbDrop = null;
        // Dropping below the dragged row shifts every later index down by one.
        moveRow(node, index, target > index ? target - 1 : target);
        node.setDirtyCanvas(true, true);
    });
}

function rowMenu(node, index) {
    const rows = node.__mbRows;
    return [
        { content: "Move up", disabled: index === 0, callback: () => moveRow(node, index, index - 1) },
        { content: "Move down", disabled: index === rows.length - 1, callback: () => moveRow(node, index, index + 1) },
        {
            content: "Duplicate",
            callback: () => {
                rows.splice(index + 1, 0, { ...rows[index] });
                save(node);
                rebuild(node);
            },
        },
        {
            content: "Remove",
            callback: () => {
                rows.splice(index, 1);
                save(node);
                rebuild(node);
            },
        },
        null,
    ];
}

// --------------------------------------------------------------- wiring

// One widget per row, so the node sizes itself through the normal layout.
function rebuild(node) {
    for (let i = node.widgets.length - 1; i >= 0; i--) {
        if (node.widgets[i].type?.startsWith?.("mb_lora_")) node.widgets.splice(i, 1);
    }
    node.addCustomWidget(headerWidget(node));
    node.__mbRows.forEach((_, i) => node.addCustomWidget(rowWidget(node, i)));
    node.addCustomWidget(addWidget(node));
    node.__mbMissing = node.__mbRows.some((r) => r.on !== false && isMissing(r));
    resizeToContent(node);
}

function load(node) {
    node.__mbRows = readRows(node);
    rebuild(node);
}

function wireNode(node) {
    setWidgetVisible(node, "loras", false);
    load(node);

    const prevConfigure = node.onConfigure;
    node.onConfigure = function () {
        const r = prevConfigure?.apply(this, arguments);
        load(this);
        return r;
    };

    const prevMenu = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        prevMenu?.apply(this, arguments);
        const index = rowAt(this, canvas.graph_mouse[1]);
        if (index != null) options.unshift(...rowMenu(this, index));
    };

    const prevDraw = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
        const r = prevDraw?.apply(this, arguments);
        if (this.__mbMissing && !this.flags?.collapsed) {
            ctx.save();
            ctx.font = "11px Arial";
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillStyle = MISSING_COLOR;
            ctx.fillText("missing file", this.size[0] - 10, -LiteGraph.NODE_TITLE_HEIGHT / 2);
            ctx.restore();
        }
        return r;
    };

    // Fetched per node so files added since the page loaded show up.
    fetchLoras().finally(() => {
        node.__mbMissing = node.__mbRows.some((r) => r.on !== false && isMissing(r));
        node.setDirtyCanvas(true, true);
    });
}

app.registerExtension({
    name: "MBNodes.LoraStack",

    nodeCreated(node) {
        if (node.comfyClass !== NODE_ID) return;
        wireNode(node);
    },
});
