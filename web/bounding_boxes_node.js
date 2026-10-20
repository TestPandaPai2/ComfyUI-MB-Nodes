// Create Bounding Boxes (MB): canvas editor for the legacy node UI, matching
// the core Create Bounding Boxes editor. Drag on empty canvas to draw a box,
// drag a box to move it, drag a corner grip to resize, Delete removes the
// selected box. The panel below edits the selected box's type, text,
// description and colour palette. Boxes are kept as fractions while editing
// and written to the hidden editor_state widget as pixel boxes of
// width x height, the same shape the core node stores.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { accentColor, getWidget, setWidgetVisible, resizeToContent } from "./common.js";

const NODE_CLASS = "MBCreateBoundingBoxes";
const STATE_WIDGETS = ["editor_state", "last_incoming"];

const EDITOR_MIN_HEIGHT = 560;
const GRID_STEPS = 32;       // grid lines and snap step, per side
const GRIP = 7;              // corner grip half-size in css px
const MIN_SIZE = 0.01;       // smaller drags are dropped (fraction of the canvas)
const MAX_SWATCHES = 5;      // the core node keeps five colours per element
const DEFAULT_STROKE = "#8c8c8c";

const STYLE = `
.mb-bbox { display:flex; flex-direction:column; gap:6px; width:100%; height:100%; box-sizing:border-box; font:12px Arial, sans-serif; color:#ddd; }
.mb-bbox-bar { display:flex; gap:6px; align-items:center; }
.mb-bbox-bar .mb-sp { flex:1; }
.mb-bbox button { background:#2a2a2e; color:#ddd; border:1px solid #3a3a40; border-radius:6px; padding:4px 10px; cursor:pointer; font:12px Arial, sans-serif; }
.mb-bbox button:hover { background:#34343a; }
.mb-bbox button.mb-on { background:var(--mb-accent, #d4537e); border-color:var(--mb-accent, #d4537e); color:#fff; }
.mb-bbox-stage { flex:1; min-height:120px; position:relative; border:1px solid #3a3a40; border-radius:6px; overflow:hidden; background:#111114; }
.mb-bbox-stage canvas { position:absolute; inset:0; width:100%; height:100%; outline:none; touch-action:none; }
.mb-bbox-panel { display:flex; flex-direction:column; gap:6px; background:#1c1c20; border-radius:6px; padding:6px; }
.mb-bbox-panel.mb-off > :not(.mb-hint) { opacity:.35; pointer-events:none; }
.mb-bbox-panel .mb-hint { color:#888; text-align:center; }
.mb-bbox-tabs { display:flex; background:#141418; border-radius:6px; padding:2px; }
.mb-bbox-tabs button { flex:1; border:none; background:transparent; }
.mb-bbox-tabs button.mb-on { background:#3a3a42; border:none; }
.mb-bbox-panel label { display:block; color:#888; font-size:11px; margin-bottom:2px; }
.mb-bbox-panel input[type=text], .mb-bbox-panel textarea { width:100%; box-sizing:border-box; background:#141418; color:#eee; border:1px solid #2e2e34; border-radius:6px; padding:5px 6px; font:12px monospace; resize:none; }
.mb-bbox-palette { display:flex; gap:5px; align-items:center; flex-wrap:wrap; }
.mb-bbox-palette .mb-sw { width:20px; height:20px; border-radius:4px; border:1px solid #555; cursor:pointer; padding:0; }
.mb-bbox-palette .mb-add { padding:0 7px; height:20px; line-height:18px; }
.mb-bbox-palette .mb-del { margin-left:auto; }
`;

function injectStyle() {
    if (document.getElementById("mb-bbox-style")) return;
    const style = document.createElement("style");
    style.id = "mb-bbox-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
}

function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    for (const child of children) node.append(child);
    return node;
}

// ------------------------------------------------------------------ state

function dims(node) {
    const w = Number(getWidget(node, "width")?.value) || 1024;
    const h = Number(getWidget(node, "height")?.value) || 1024;
    return [w, h];
}

function parseList(text) {
    try {
        const data = JSON.parse(text || "[]");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

// Pixel boxes {x, y, width, height, metadata} -> editor boxes in fractions.
function fromPixels(boxes, w, h) {
    return boxes.filter((b) => b && typeof b === "object").map((b) => {
        const meta = b.metadata && typeof b.metadata === "object" ? b.metadata : {};
        return {
            x: (b.x ?? 0) / w,
            y: (b.y ?? 0) / h,
            w: (b.width ?? 0) / w,
            h: (b.height ?? 0) / h,
            type: meta.type === "text" ? "text" : "obj",
            text: meta.text ?? "",
            desc: meta.desc ?? "",
            palette: Array.isArray(meta.palette) ? meta.palette.filter(Boolean) : [],
        };
    });
}

function toPixels(boxes, w, h) {
    return boxes.map((b) => ({
        x: Math.round(b.x * w),
        y: Math.round(b.y * h),
        width: Math.round(b.w * w),
        height: Math.round(b.h * h),
        metadata: { type: b.type, text: b.type === "text" ? b.text : "", desc: b.desc, palette: b.palette },
    }));
}

function loadState(node) {
    const [w, h] = dims(node);
    node.__mbBoxes = fromPixels(parseList(getWidget(node, "editor_state")?.value), w, h);
    if (node.__mbSelected >= node.__mbBoxes.length) node.__mbSelected = -1;
}

function saveState(node) {
    const widget = getWidget(node, "editor_state");
    if (widget) widget.value = JSON.stringify(toPixels(node.__mbBoxes, ...dims(node)));
    node.setDirtyCanvas(true, true);
}

function changed(node) {
    saveState(node);
    node.__mbEditor?.refresh();
}

// -------------------------------------------------------------- geometry

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function snap(node, v) {
    return node.properties?.mbGrid ? Math.round(v * GRID_STEPS) / GRID_STEPS : v;
}

// Drawing area inside the canvas: the background's aspect when one is loaded,
// else width x height.
function frameOf(node, cw, ch) {
    const bg = node.__mbBgImage;
    const [w, h] = dims(node);
    const aspect = bg ? bg.naturalWidth / bg.naturalHeight : w / h;
    let fw = cw;
    let fh = cw / aspect;
    if (fh > ch) {
        fh = ch;
        fw = ch * aspect;
    }
    return { x: (cw - fw) / 2, y: (ch - fh) / 2, w: fw, h: fh };
}

const CORNERS = { nw: [0, 0], ne: [1, 0], sw: [0, 1], se: [1, 1] };

function hit(node, frame, px, py) {
    const boxes = node.__mbBoxes;
    const sel = boxes[node.__mbSelected];
    if (sel) {
        for (const [name, [cx, cy]] of Object.entries(CORNERS)) {
            const gx = frame.x + (sel.x + sel.w * cx) * frame.w;
            const gy = frame.y + (sel.y + sel.h * cy) * frame.h;
            if (Math.abs(px - gx) <= GRIP + 2 && Math.abs(py - gy) <= GRIP + 2) {
                return { index: node.__mbSelected, mode: name };
            }
        }
    }
    const fx = (px - frame.x) / frame.w;
    const fy = (py - frame.y) / frame.h;
    // Last box is drawn on top, so it wins the hit.
    for (let i = boxes.length - 1; i >= 0; i--) {
        const b = boxes[i];
        if (fx >= b.x && fx <= b.x + b.w && fy >= b.y && fy <= b.y + b.h) return { index: i, mode: "move" };
    }
    return null;
}

// ---------------------------------------------------------------- drawing

function wrap(ctx, text, maxW) {
    const lines = [];
    for (const para of text.split("\n")) {
        let line = "";
        for (const word of para.split(/\s+/).filter(Boolean)) {
            const test = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(test).width > maxW) {
                lines.push(line);
                line = word;
            } else line = test;
        }
        lines.push(line);
    }
    return lines;
}

function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return 140;
    const n = parseInt(m[1], 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

function draw(node, canvas) {
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const frame = frameOf(node, cw, ch);
    node.__mbFrame = frame;

    ctx.fillStyle = "#202024";
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
    const bg = node.__mbBgImage;
    if (bg) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(bg, frame.x, frame.y, frame.w, frame.h);
        ctx.globalAlpha = 1;
    }

    if (node.properties?.mbGrid) {
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < GRID_STEPS; i++) {
            const gx = Math.round(frame.x + (frame.w * i) / GRID_STEPS) + 0.5;
            const gy = Math.round(frame.y + (frame.h * i) / GRID_STEPS) + 0.5;
            ctx.moveTo(gx, frame.y);
            ctx.lineTo(gx, frame.y + frame.h);
            ctx.moveTo(frame.x, gy);
            ctx.lineTo(frame.x + frame.w, gy);
        }
        ctx.stroke();
    }

    const accent = accentColor();
    node.__mbBoxes.forEach((b, i) => {
        const x = frame.x + b.x * frame.w;
        const y = frame.y + b.y * frame.h;
        const w = b.w * frame.w;
        const h = b.h * frame.h;
        const color = b.palette[0] || DEFAULT_STROKE;
        const selected = i === node.__mbSelected;

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.fillStyle = selected ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.15)";
        ctx.fillRect(x, y, w, h);

        const swatches = b.palette.slice(0, MAX_SWATCHES);
        if (swatches.length) {
            const seg = w / swatches.length;
            swatches.forEach((c, p) => {
                ctx.fillStyle = c;
                ctx.fillRect(x + p * seg, y, seg + 0.5, 4);
            });
        }

        ctx.font = "bold 11px monospace";
        ctx.textBaseline = "top";
        const tag = String(i + 1).padStart(2, "0");
        const tw = ctx.measureText(tag).width;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, tw + 6, 15);
        ctx.fillStyle = luminance(color) > 140 ? "#000" : "#fff";
        ctx.fillText(tag, x + 3, y + 2);

        let body = b.desc || "";
        if (b.type === "text" && b.text) body = `"${b.text}"${body ? ` — ${body}` : ""}`;
        if (body && w > 12) {
            ctx.font = "12px monospace";
            ctx.fillStyle = "#e6e6e6";
            let ty = y + 19;
            for (const line of wrap(ctx, body, w - 8)) {
                if (ty > y + h) break;
                ctx.fillText(line, x + 4, ty);
                ty += 14;
            }
        }
        ctx.restore();

        ctx.strokeStyle = selected ? accent : color;
        ctx.lineWidth = selected ? 2 : 1.5;
        ctx.strokeRect(x, y, w, h);

        if (selected) {
            ctx.fillStyle = accent;
            for (const [cx, cy] of Object.values(CORNERS)) {
                ctx.fillRect(x + w * cx - GRIP / 2 - 1, y + h * cy - GRIP / 2 - 1, GRIP, GRIP);
            }
        }
    });

    if (!node.__mbBoxes.length) {
        ctx.fillStyle = "#777";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("drag to draw a box", frame.x + frame.w / 2, frame.y + frame.h / 2);
        ctx.textAlign = "left";
    }
}

// ----------------------------------------------------------------- pointer

function onPointer(node, canvas) {
    const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        // The node can be zoomed; map screen px back to the canvas' css px.
        return [((e.clientX - r.left) * canvas.clientWidth) / r.width, ((e.clientY - r.top) * canvas.clientHeight) / r.height];
    };

    canvas.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        canvas.focus();
        const frame = node.__mbFrame;
        if (!frame) return;
        const [px, py] = pos(e);
        const fx = (px - frame.x) / frame.w;
        const fy = (py - frame.y) / frame.h;
        const target = hit(node, frame, px, py);
        if (target) {
            node.__mbSelected = target.index;
            node.__mbDrag = { ...target, from: [fx, fy], start: { ...node.__mbBoxes[target.index] } };
        } else {
            if (fx < 0 || fx > 1 || fy < 0 || fy > 1) {
                node.__mbSelected = -1;
                node.__mbEditor.refresh();
                return;
            }
            const sx = snap(node, clamp01(fx));
            const sy = snap(node, clamp01(fy));
            node.__mbBoxes.push({ x: sx, y: sy, w: 0, h: 0, type: "obj", text: "", desc: "", palette: [] });
            node.__mbSelected = node.__mbBoxes.length - 1;
            node.__mbDrag = { index: node.__mbSelected, mode: "new", from: [sx, sy] };
        }
        canvas.setPointerCapture(e.pointerId);
        node.__mbEditor.refresh();
    });

    canvas.addEventListener("pointermove", (e) => {
        const drag = node.__mbDrag;
        const frame = node.__mbFrame;
        if (!drag || !frame) return;
        e.stopPropagation();
        const [px, py] = pos(e);
        const fx = clamp01((px - frame.x) / frame.w);
        const fy = clamp01((py - frame.y) / frame.h);
        const b = node.__mbBoxes[drag.index];

        if (drag.mode === "move") {
            const s = drag.start;
            b.x = Math.min(1 - s.w, Math.max(0, snap(node, s.x + fx - drag.from[0])));
            b.y = Math.min(1 - s.h, Math.max(0, snap(node, s.y + fy - drag.from[1])));
        } else {
            // "new" grows from the press point; a grip grows from the opposite corner.
            let ax = drag.from[0];
            let ay = drag.from[1];
            if (drag.mode !== "new") {
                const s = drag.start;
                const [cx, cy] = CORNERS[drag.mode];
                ax = cx ? s.x : s.x + s.w;
                ay = cy ? s.y : s.y + s.h;
            }
            const ex = snap(node, fx);
            const ey = snap(node, fy);
            b.x = Math.min(ax, ex);
            b.y = Math.min(ay, ey);
            b.w = Math.abs(ex - ax);
            b.h = Math.abs(ey - ay);
        }
        node.__mbEditor.redraw();
    });

    const end = (e) => {
        const drag = node.__mbDrag;
        if (!drag) return;
        e.stopPropagation();
        node.__mbDrag = null;
        const b = node.__mbBoxes[drag.index];
        if (b.w < MIN_SIZE || b.h < MIN_SIZE) {
            if (drag.mode === "new") {
                node.__mbBoxes.splice(drag.index, 1);
                node.__mbSelected = -1;
            } else Object.assign(b, drag.start);
        }
        changed(node);
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    canvas.addEventListener("keydown", (e) => {
        if ((e.key === "Delete" || e.key === "Backspace") && node.__mbSelected >= 0) {
            e.stopPropagation();
            e.preventDefault();
            deleteSelected(node);
        } else if (e.key === "Escape") {
            node.__mbSelected = -1;
            node.__mbEditor.refresh();
        }
    });
}

function deleteSelected(node) {
    node.__mbBoxes.splice(node.__mbSelected, 1);
    node.__mbSelected = -1;
    changed(node);
}

// ------------------------------------------------------------------ editor

function buildEditor(node) {
    injectStyle();

    const gridBtn = el("button", { textContent: "▦ Grid", title: "Show the grid and snap boxes to it" });
    const clearBtn = el("button", { textContent: "↶ Clear all", title: "Remove every box" });
    const canvas = el("canvas", { tabIndex: 0 });
    const stage = el("div", { className: "mb-bbox-stage" }, [canvas]);

    const objTab = el("button", { textContent: "obj" });
    const textTab = el("button", { textContent: "text" });
    const textInput = el("input", { type: "text", placeholder: "text to render" });
    const textRow = el("div", {}, [el("label", { textContent: "text" }), textInput]);
    const descInput = el("textarea", { rows: 3, placeholder: "describe this element" });
    const swatches = el("span", { className: "mb-bbox-palette" });
    const addBtn = el("button", { className: "mb-add", textContent: "+", title: "Add a colour" });
    const delBtn = el("button", { className: "mb-del", textContent: "Delete box" });
    const picker = el("input", { type: "color" });
    picker.style.cssText = "position:absolute; width:0; height:0; opacity:0; pointer-events:none;";
    const hint = el("div", { className: "mb-hint", textContent: "Select a box to edit it" });

    const panel = el("div", { className: "mb-bbox-panel" }, [
        hint,
        el("div", { className: "mb-bbox-tabs" }, [objTab, textTab]),
        textRow,
        el("div", {}, [el("label", { textContent: "description" }), descInput]),
        el("div", { className: "mb-bbox-palette" }, [el("span", { textContent: "color_palette" }), swatches, addBtn, delBtn, picker]),
    ]);

    const root = el("div", { className: "mb-bbox" }, [
        el("div", { className: "mb-bbox-bar" }, [gridBtn, el("span", { className: "mb-sp" }), clearBtn]),
        stage,
        panel,
    ]);
    // Keep typing and wheel inside the editor instead of driving the graph.
    for (const type of ["keydown", "keyup", "wheel"]) root.addEventListener(type, (e) => e.stopPropagation());
    for (const input of [textInput, descInput]) input.addEventListener("pointerdown", (e) => e.stopPropagation());

    const selected = () => node.__mbBoxes[node.__mbSelected];
    // Which swatch the colour picker is editing; -1 adds a new one.
    let pickIndex = -1;

    const editor = {
        redraw: () => draw(node, canvas),
        refresh() {
            gridBtn.classList.toggle("mb-on", !!node.properties?.mbGrid);
            const b = selected();
            panel.classList.toggle("mb-off", !b);
            hint.style.display = b ? "none" : "";
            const type = b?.type ?? "obj";
            objTab.classList.toggle("mb-on", type === "obj");
            textTab.classList.toggle("mb-on", type === "text");
            textRow.style.display = type === "text" ? "" : "none";
            if (document.activeElement !== textInput) textInput.value = b?.text ?? "";
            if (document.activeElement !== descInput) descInput.value = b?.desc ?? "";
            swatches.replaceChildren(...(b?.palette ?? []).map((c, i) => {
                const sw = el("button", { className: "mb-sw", title: `${c} — click to change, right-click to remove` });
                sw.style.background = c;
                sw.addEventListener("click", () => {
                    pickIndex = i;
                    picker.value = c;
                    picker.click();
                });
                sw.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    b.palette.splice(i, 1);
                    changed(node);
                });
                return sw;
            }));
            addBtn.style.display = b && b.palette.length >= MAX_SWATCHES ? "none" : "";
            draw(node, canvas);
        },
    };
    node.__mbEditor = editor;

    gridBtn.addEventListener("click", () => {
        node.properties.mbGrid = !node.properties.mbGrid;
        editor.refresh();
    });
    clearBtn.addEventListener("click", () => {
        node.__mbBoxes = [];
        node.__mbSelected = -1;
        changed(node);
    });
    const setType = (type) => {
        const b = selected();
        if (!b || b.type === type) return;
        b.type = type;
        changed(node);
    };
    objTab.addEventListener("click", () => setType("obj"));
    textTab.addEventListener("click", () => setType("text"));
    textInput.addEventListener("input", () => {
        const b = selected();
        if (!b) return;
        b.text = textInput.value;
        saveState(node);
        draw(node, canvas);
    });
    descInput.addEventListener("input", () => {
        const b = selected();
        if (!b) return;
        b.desc = descInput.value;
        saveState(node);
        draw(node, canvas);
    });
    addBtn.addEventListener("click", () => {
        pickIndex = -1;
        picker.value = "#ffffff";
        picker.click();
    });
    picker.addEventListener("change", () => {
        const b = selected();
        if (!b) return;
        const color = picker.value.toUpperCase();
        if (pickIndex >= 0) b.palette[pickIndex] = color;
        else if (b.palette.length < MAX_SWATCHES) b.palette.push(color);
        changed(node);
    });
    delBtn.addEventListener("click", () => {
        if (selected()) deleteSelected(node);
    });

    onPointer(node, canvas);
    new ResizeObserver(() => draw(node, canvas)).observe(stage);

    node.addDOMWidget("mb_bbox_editor", "mb_bbox_editor", root, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => EDITOR_MIN_HEIGHT,
    });
}

// -------------------------------------------------------------- background

function loadBackground(node) {
    const url = node.properties?.mbBackground;
    if (!url) {
        node.__mbBgImage = null;
        node.__mbEditor?.redraw();
        return;
    }
    const img = new Image();
    // A slower earlier fetch must not overwrite a newer pick.
    const current = () => node.properties.mbBackground === url;
    img.onload = () => {
        if (!current()) return;
        node.__mbBgImage = img;
        node.__mbEditor?.redraw();
    };
    img.onerror = () => {
        if (!current()) return;
        node.__mbBgImage = null;
        node.__mbEditor?.redraw();
    };
    img.src = url;
}

const ANNOTATED = /^(.*?)\s*\[(\w+)\]\s*$/;

// /view URL of the file picked on the node wired into `background`, when that
// node has an image combo (Load Image and friends); null otherwise.
function linkedImageURL(node) {
    const slot = node.findInputSlot("background");
    const source = slot >= 0 ? node.getInputNode(slot) : null;
    const value = source ? getWidget(source, "image")?.value : null;
    if (typeof value !== "string" || !value) return null;
    const match = ANNOTATED.exec(value);
    const [path, type] = match ? [match[1], match[2]] : [value, "input"];
    const cut = path.lastIndexOf("/");
    return api.apiURL(`/view?${new URLSearchParams({
        filename: path.slice(cut + 1),
        subfolder: cut >= 0 ? path.slice(0, cut) : "",
        type,
    })}`);
}

// Fetches only when the linked pick differs from what is already shown.
function syncLinkedBackground(node) {
    const url = linkedImageURL(node);
    if (!url || url === node.properties.mbBackground) return;
    node.properties.mbBackground = url;
    loadBackground(node);
}

// ------------------------------------------------------------------ wiring

function wireNode(node) {
    for (const name of STATE_WIDGETS) setWidgetVisible(node, name, false);
    node.properties ??= {};
    node.__mbBoxes = [];
    node.__mbSelected = -1;

    // Boxes live as fractions, so a new pixel grid keeps them in place.
    for (const name of ["width", "height"]) {
        const widget = getWidget(node, name);
        if (!widget) continue;
        const prev = widget.callback;
        widget.callback = function (...args) {
            const r = prev?.apply(this, args);
            saveState(node);
            node.__mbEditor?.refresh();
            return r;
        };
    }

    buildEditor(node);
    node.setSize([Math.max(node.size[0], 420), node.size[1]]);
    resizeToContent(node);
    node.__mbEditor.refresh();
}

app.registerExtension({
    name: "MBNodes.CreateBoundingBoxes",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_CLASS) return;

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);

            // A linked Load Image is already shown from its own file; the run's
            // copy is only needed for other image sources.
            const image = message?.background_images?.[0];
            if (!linkedImageURL(this)) {
                const url = image
                    ? api.apiURL(`/view?${new URLSearchParams({ filename: image.filename, subfolder: image.subfolder ?? "", type: image.type })}&t=${Date.now()}`)
                    : "";
                if (url || this.properties.mbBackground) {
                    this.properties.mbBackground = url;
                    loadBackground(this);
                }
            }

            // A new upstream value replaces the canvas, as the backend did for
            // this run; remembering it keeps later edits until it changes again.
            const incoming = message?.input_bboxes;
            const last = getWidget(this, "last_incoming");
            if (Array.isArray(incoming) && incoming.length && last && JSON.stringify(incoming) !== JSON.stringify(parseList(last.value))) {
                last.value = JSON.stringify(incoming);
                const state = getWidget(this, "editor_state");
                if (state) state.value = JSON.stringify(incoming);
                loadState(this);
                this.__mbSelected = -1;
                this.__mbEditor?.refresh();
            }
        };

        // Picking, uploading or rewiring an image redraws the graph, so a
        // string compare per frame catches every change; the fetch itself
        // happens only when the pick differs.
        const onDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function () {
            const r = onDrawForeground?.apply(this, arguments);
            syncLinkedBackground(this);
            return r;
        };

        // Saved widget values and properties land after nodeCreated, on load
        // and on paste alike.
        const onConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConfigure?.apply(this, arguments);
            loadState(this);
            loadBackground(this);
            this.__mbEditor?.refresh();
            return r;
        };
    },

    nodeCreated(node) {
        if (node.comfyClass !== NODE_CLASS) return;
        wireNode(node);
    },
});
