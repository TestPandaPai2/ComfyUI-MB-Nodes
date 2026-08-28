// Load Image Mini (MB): a compact custom face for the loader. The stock file
// combo is kept (hidden) as the serialized source of truth for `image`, while
// canvas-drawn pill/segment widgets (matching the pattern pad_image_node.js
// pioneered) draw the toolbar, file browser, resize-mode picker and toggles
// directly on the node face — no gear-panel dialog. A DOM `<img>` widget still
// carries the real preview bitmap, since canvas re-drawing a photo every frame
// is more code for no visual benefit over a plain <img>.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, resizeToContent, notify } from "./common.js";
import { openDialog } from "./dialog.js";
import { pasteImage } from "./clipboard_image.js";

// Keep in step with nodes/load_image_mini_node.py.
const MODES = ["none", "max megapixels", "longest side", "scale by", "fit inside", "crop to fill", "match ratio"];
const MODE_LABELS = { "none": "Off", "max megapixels": "Max MP", "longest side": "Longest side", "scale by": "Scale by ×", "fit inside": "Fit inside", "crop to fill": "Crop to fill", "match ratio": "Match ratio" };
const MEGAPIXELS = ["0.25", "0.5", "1.0", "1.25", "1.5", "2.0", "3.0", "4.0"];
const MATCH_RATIOS = ["1:1", "4:3", "3:2", "16:10", "16:9", "1.85:1", "2:1", "21:9", "3:4", "2:3", "10:16", "9:16", "1:1.85", "1:2", "9:21"];
const QUICK_SNAPS = ["1", "8", "16", "32", "64"]; // "1" reads as "Off"
const RESAMPLES = ["lanczos", "bicubic", "bilinear", "area", "nearest-exact"];

// Gear widgets: hidden from the body, still serialize/drive execute().
const HIDDEN_WIDGETS = [
    "resize_mode", "megapixels", "longest_side", "scale_by", "fit_width", "fit_height",
    "fill_width", "fill_height", "match_ratio", "snap", "resample", "allow_upscale", "accent",
];

// --- palette -----------------------------------------------------------------
// This node's own two-tone experiment (see plan): pink for the primary/active
// state, purple for chrome (arrows, borders, the node title via `accent`).
const ACCENT_PINK = "#e0399c";
const ACCENT_PURPLE = "#9d4edd";
const BODY_BG = "#141414";
const FIELD_BG = "#0d0d0d";
const TEXT_DIM = "#9a9a9a";
const TEXT_BRIGHT = "#f0f0f0";

const MARGIN = 14;
const GAP = 6;
const ROW_H = 30;
const BOX_H = 46;
const SEG_H = 26;
const ARROW_W = 26;
const SEG_COLS = 4;
const SEG_MIN_W = 62;

function shade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const mix = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
    const r = mix((n >> 16) & 255);
    const g = mix((n >> 8) & 255);
    const b = mix(n & 255);
    return `rgb(${r}, ${g}, ${b})`;
}

function drawPill(ctx, x, y, w, h, { selected = false, accent = ACCENT_PINK, radius = 8 } = {}) {
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    if (selected) {
        grad.addColorStop(0, shade(accent, 0.28));
        grad.addColorStop(1, shade(accent, -0.08));
    } else {
        grad.addColorStop(0, "#3d3d3d");
        grad.addColorStop(1, "#242424");
    }
    ctx.fillStyle = grad;
    ctx.strokeStyle = selected ? shade(accent, 0.4) : `${accent}55`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
}

function fitText(ctx, text, maxWidth) {
    if (maxWidth <= 0) return "";
    if (ctx.measureText(text).width <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(cut + "…").width > maxWidth) cut = cut.slice(0, -1);
    return cut + "…";
}

function hit(pos, x, y, w, h) {
    return pos[0] >= x && pos[0] <= x + w && pos[1] >= y && pos[1] <= y + h;
}

const STYLE_ID = "mb-mini-style";
const ANNOTATED = /^(.*?)\s*\[(\w+)\]\s*$/;

const CSS = `
.mb-mini-preview-wrap { width: 100%; box-sizing: border-box; }
.mb-mini-preview {
    width: 100%; height: 150px; border-radius: 10px; background: ${FIELD_BG};
    border: 1px solid ${ACCENT_PURPLE}55; object-fit: contain; display: block;
}
.mb-mini-empty {
    width: 100%; height: 150px; border-radius: 10px; background: ${FIELD_BG};
    border: 1px dashed #3a2a3a; display: flex; align-items: center; justify-content: center;
    color: #6a6a6a; font-size: 11px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    box-sizing: border-box;
}
.mb-mini-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
    gap: 6px; max-height: 340px; overflow-y: auto; padding: 2px;
}
.mb-mini-tile {
    position: relative; aspect-ratio: 1 / 1; border: 2px solid #2a2a2a;
    border-radius: 6px; overflow: hidden; background: #161616; cursor: pointer;
}
.mb-mini-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mb-mini-tile.mb-on { border-color: ${ACCENT_PINK}; }
.mb-mini-tile .mb-mini-cap {
    position: absolute; left: 0; right: 0; bottom: 0; padding: 2px 4px; font-size: 9px;
    color: #e8e8e8; background: rgba(0,0,0,0.65); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------- file helpers

function viewURL(value) {
    if (!value) return null;
    const match = ANNOTATED.exec(value);
    const [name, type] = match ? [match[1], match[2]] : [value, "input"];
    return api.apiURL(`/view?${new URLSearchParams({ filename: name, subfolder: "", type })}`);
}

const sizeCache = new Map();

function measure(value) {
    if (!value) return Promise.resolve(null);
    if (sizeCache.has(value)) return Promise.resolve(sizeCache.get(value));
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const size = [img.naturalWidth, img.naturalHeight];
            sizeCache.set(value, size);
            resolve(size);
        };
        img.onerror = () => resolve(null);
        img.src = viewURL(value);
    });
}

function fileList(node) {
    return getWidget(node, "image")?.options?.values ?? [];
}

// The uploaded/pasted file is new to the picker, so it is offered before select.
function selectFile(node, filename) {
    const widget = getWidget(node, "image");
    if (!widget) return;
    const values = widget.options?.values ?? (widget.options = { ...widget.options, values: [] }).values;
    if (!values.includes(filename)) values.push(filename);
    widget.value = filename;
    widget.callback?.(filename);
    refresh(node);
}

async function uploadFile(node, file) {
    try {
        const body = new FormData();
        body.append("image", file);
        body.append("type", "input");
        body.append("overwrite", "false");
        const response = await api.fetchApi("/upload/image", { method: "POST", body });
        if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        selectFile(node, data.subfolder ? `${data.subfolder}/${data.name}` : data.name);
        notify("success", "Image uploaded", data.name);
    } catch (e) {
        notify("error", "Upload failed", e?.message ?? String(e));
    }
}

function openUpload(node) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.display = "none";
    input.addEventListener("change", () => {
        if (input.files?.[0]) uploadFile(node, input.files[0]);
        input.remove();
    });
    document.body.appendChild(input);
    input.click();
}

function stepFile(node, dir) {
    const list = fileList(node);
    if (!list.length) return;
    const current = getWidget(node, "image")?.value;
    const index = Math.max(0, list.indexOf(current));
    const next = (index + dir + list.length) % list.length;
    selectFile(node, list[next]);
}

// ---------------------------------------------------------------- resize mirror

function snapTo(value, multiple) {
    const m = Math.max(1, Number(multiple) || 1);
    return Math.max(m, Math.round(value / m) * m);
}

function ratioValue(name) {
    const [w, h] = String(name).split(":").map(Number);
    return h ? w / h : 1;
}

// Output dimensions for the given input size and the node's gear settings.
// Mirrors _resize() in the Python backend (dimensions only).
function computeOut(node, w, h) {
    const g = (name) => getWidget(node, name)?.value;
    const mode = g("resize_mode") ?? "none";
    const up = g("allow_upscale") === true;
    const s = Number(g("snap")) || 8;
    if (!w || !h || mode === "none") return [w, h];

    if (mode === "max megapixels") {
        const f = Math.sqrt((parseFloat(g("megapixels")) * 1e6) / (w * h));
        if (f > 1 && !up) return [w, h];
        return [snapTo(w * f, s), snapTo(h * f, s)];
    }
    if (mode === "longest side") {
        const f = (Number(g("longest_side")) || 1024) / Math.max(w, h);
        if (f > 1 && !up) return [w, h];
        return [snapTo(w * f, s), snapTo(h * f, s)];
    }
    if (mode === "scale by") {
        const f = Number(g("scale_by")) || 1;
        return [snapTo(w * f, s), snapTo(h * f, s)];
    }
    if (mode === "fit inside") {
        const f = Math.min((Number(g("fit_width")) || 1024) / w, (Number(g("fit_height")) || 1024) / h);
        if (f > 1 && !up) return [w, h];
        return [snapTo(w * f, s), snapTo(h * f, s)];
    }
    if (mode === "crop to fill") {
        return [Number(g("fill_width")) || 1024, Number(g("fill_height")) || 1024];
    }
    if (mode === "match ratio") {
        const t = ratioValue(g("match_ratio"));
        return w / h > t ? [Math.round(h * t), h] : [w, Math.round(w / t)];
    }
    return [w, h];
}

function aspect(w, h) {
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const d = gcd(w, h) || 1;
    const [rw, rh] = [w / d, h / d];
    if (rw <= 64 && rh <= 64) return `${rw}:${rh}`;
    const r = w / h;
    return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

// ---------------------------------------------------------------- accent

function applyAccent(node) {
    const widget = getWidget(node, "accent");
    if (widget && !widget.value) {
        widget.value = ACCENT_PURPLE; // this node defaults to the purple/pink experiment
    }
    if (widget?.value) {
        node.color = widget.value;
        node.setDirtyCanvas(true, true);
    }
}

// ---------------------------------------------------------------- thumbnail picker

function openPicker(node) {
    ensureStyle();
    const list = fileList(node);
    let chosen = getWidget(node, "image")?.value;

    openDialog({
        title: "Pick an image",
        applyLabel: "Select",
        width: 520,
        render(body) {
            const grid = document.createElement("div");
            grid.className = "mb-mini-grid";
            if (!list.length) {
                const empty = document.createElement("div");
                empty.textContent = "No images in the input folder yet.";
                empty.style.cssText = "color:#8f8f8f;font-size:12px;padding:10px;";
                body.appendChild(empty);
                return;
            }
            for (const name of list) {
                const tile = document.createElement("div");
                tile.className = "mb-mini-tile" + (name === chosen ? " mb-on" : "");
                tile.title = name;
                const img = document.createElement("img");
                img.loading = "lazy";
                img.src = viewURL(name);
                const cap = document.createElement("div");
                cap.className = "mb-mini-cap";
                cap.textContent = name;
                tile.append(img, cap);
                tile.addEventListener("click", () => {
                    chosen = name;
                    for (const t of grid.children) t.classList.toggle("mb-on", t.title === name);
                });
                tile.addEventListener("dblclick", () => { chosen = name; body.__apply?.(); });
                grid.appendChild(tile);
            }
            body.appendChild(grid);
        },
        onApply() {
            if (chosen) selectFile(node, chosen);
        },
    });
}

// ---------------------------------------------------------------- shared widget bits

// Row geometry a widget can use to know how wide it has to paint, and to keep a
// minimum width so segmented rows never overlap.
function widgetWidthOf(node, widgetWidth) {
    return widgetWidth || node.size[0];
}

function modeGridRows() {
    return Math.ceil(MODES.length / SEG_COLS);
}

function modeGridMinWidth() {
    return MARGIN * 2 + SEG_COLS * SEG_MIN_W + (SEG_COLS - 1) * GAP;
}

// ---------------------------------------------------------------- size row widget

function makeSizeRowWidget(node) {
    return {
        type: "mb_size_row",
        name: "mb_size_row",
        y: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() { return [node.size[0], BOX_H]; },
        computeLayoutSize() { return { minHeight: BOX_H, maxHeight: BOX_H, minWidth: 220, maxWidth: Infinity }; },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            const width = widgetWidthOf(drawNode, widgetWidth);
            const boxW = (width - MARGIN * 2 - 28) / 2;

            const info = drawNode.__mbMiniInfo ?? null;

            const drawBox = (x, label, line1, line2) => {
                ctx.save();
                ctx.fillStyle = "#161616";
                ctx.strokeStyle = `${ACCENT_PURPLE}55`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(x, y, boxW, BOX_H, 8);
                ctx.fill();
                ctx.stroke();

                ctx.textAlign = "center";
                ctx.fillStyle = TEXT_DIM;
                ctx.font = "9px Arial";
                ctx.fillText(label, x + boxW / 2, y + 11);

                ctx.fillStyle = TEXT_BRIGHT;
                ctx.font = "bold 13px Arial";
                ctx.fillText(fitText(ctx, line1, boxW - 8), x + boxW / 2, y + 26);

                ctx.fillStyle = TEXT_DIM;
                ctx.font = "9px Arial";
                ctx.fillText(fitText(ctx, line2, boxW - 8), x + boxW / 2, y + 38);
                ctx.restore();
            };

            const inX = MARGIN;
            const outX = MARGIN + boxW + 28;
            if (info) {
                drawBox(inX, "INPUT", `${info.w}×${info.h}`, `~${aspect(info.w, info.h)}`);
                drawBox(outX, "OUTPUT", `${info.ow}×${info.oh}`, `${((info.ow * info.oh) / 1e6).toFixed(2)} MP`);
            } else {
                drawBox(inX, "INPUT", "—", "");
                drawBox(outX, "OUTPUT", "—", "");
            }

            ctx.save();
            ctx.fillStyle = ACCENT_PURPLE;
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("›", inX + boxW + 14, y + BOX_H / 2);
            ctx.restore();
        },
    };
}

// ---------------------------------------------------------------- action row (upload/paste)

function makeActionRowWidget(node) {
    return {
        type: "mb_actions",
        name: "mb_actions",
        y: 0,
        width: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() { return [node.size[0], ROW_H]; },
        computeLayoutSize() { return { minHeight: ROW_H, maxHeight: ROW_H, minWidth: 200, maxWidth: Infinity }; },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidthOf(drawNode, widgetWidth);
            const uploadW = this.width - MARGIN * 2 - 90;
            const uploadX = MARGIN;
            const pasteX = uploadX + uploadW + GAP;
            const pasteW = 90 - GAP;

            drawPill(ctx, uploadX, y, uploadW, ROW_H, { selected: true, accent: ACCENT_PINK });
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("⬆ Upload Image", uploadX + uploadW / 2, y + ROW_H / 2);

            drawPill(ctx, pasteX, y, pasteW, ROW_H, { accent: ACCENT_PURPLE });
            ctx.fillStyle = "#dcdcdc";
            ctx.font = "11px Arial";
            ctx.fillText("📋 Paste", pasteX + pasteW / 2, y + ROW_H / 2);

            this._uploadRect = [uploadX, y, uploadW, ROW_H];
            this._pasteRect = [pasteX, y, pasteW, ROW_H];
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            for (const originY of [this.y, 0]) {
                if (!this._uploadRect) continue;
                const [ux, , uw] = this._uploadRect;
                if (hit(pos, ux, originY, uw, ROW_H)) { openUpload(mouseNode); return true; }
                const [px, , pw] = this._pasteRect;
                if (hit(pos, px, originY, pw, ROW_H)) {
                    pasteImage(mouseNode).then?.(() => refresh(mouseNode)) ?? refresh(mouseNode);
                    return true;
                }
            }
            return false;
        },
    };
}

// ---------------------------------------------------------------- file browser row

function makeFileRowWidget(node) {
    return {
        type: "mb_file_row",
        name: "mb_file_row",
        y: 0,
        width: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() { return [node.size[0], ROW_H]; },
        computeLayoutSize() { return { minHeight: ROW_H, maxHeight: ROW_H, minWidth: 160, maxWidth: Infinity }; },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidthOf(drawNode, widgetWidth);
            const prevX = MARGIN;
            const nextX = this.width - MARGIN - ARROW_W;
            const nameX = prevX + ARROW_W + GAP;
            const nameW = nextX - GAP - nameX;

            drawPill(ctx, prevX, y, ARROW_W, ROW_H, { accent: ACCENT_PURPLE });
            drawPill(ctx, nextX, y, ARROW_W, ROW_H, { accent: ACCENT_PURPLE });
            ctx.fillStyle = "#dcdcdc";
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("◀", prevX + ARROW_W / 2, y + ROW_H / 2);
            ctx.fillText("▶", nextX + ARROW_W / 2, y + ROW_H / 2);

            ctx.fillStyle = FIELD_BG;
            ctx.strokeStyle = "#3a3a3a";
            ctx.beginPath();
            ctx.roundRect(nameX, y, nameW, ROW_H, 8);
            ctx.fill();
            ctx.stroke();

            const value = getWidget(drawNode, "image")?.value;
            const list = fileList(drawNode);
            const index = value ? list.indexOf(value) : -1;
            const counter = list.length ? `${index + 1}/${list.length}` : "";
            const counterW = counter ? ctx.measureText(counter).width + 10 : 0;

            ctx.fillStyle = "#e8e8e8";
            ctx.font = "12px Arial";
            ctx.textAlign = "left";
            ctx.fillText(fitText(ctx, value || "no image", nameW - 16 - counterW), nameX + 8, y + ROW_H / 2);

            if (counter) {
                ctx.fillStyle = TEXT_DIM;
                ctx.font = "10px Arial";
                ctx.textAlign = "right";
                ctx.fillText(counter, nameX + nameW - 8, y + ROW_H / 2);
            }

            this._prevRect = [prevX, y, ARROW_W, ROW_H];
            this._nextRect = [nextX, y, ARROW_W, ROW_H];
            this._nameRect = [nameX, y, nameW, ROW_H];
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            for (const originY of [this.y, 0]) {
                if (!this._prevRect) continue;
                const [px, , pw] = this._prevRect;
                if (hit(pos, px, originY, pw, ROW_H)) { stepFile(mouseNode, -1); return true; }
                const [nx, , nw] = this._nextRect;
                if (hit(pos, nx, originY, nw, ROW_H)) { stepFile(mouseNode, 1); return true; }
                const [mx, , mw] = this._nameRect;
                if (hit(pos, mx, originY, mw, ROW_H)) { openPicker(mouseNode); return true; }
            }
            return false;
        },
    };
}

// ---------------------------------------------------------------- resize mode grid

function makeModeGridWidget(node) {
    return {
        type: "mb_mode_grid",
        name: "mb_mode_grid",
        y: 0,
        width: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() {
            const rows = modeGridRows();
            return [node.size[0], rows * SEG_H + (rows - 1) * GAP];
        },
        computeLayoutSize() {
            const [, h] = this.computeSize();
            return { minHeight: h, maxHeight: h, minWidth: modeGridMinWidth(), maxWidth: Infinity };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidthOf(drawNode, widgetWidth);
            const active = getWidget(drawNode, "resize_mode")?.value ?? "none";
            const usable = this.width - MARGIN * 2;
            const segW = (usable - (SEG_COLS - 1) * GAP) / SEG_COLS;

            this._rects = [];
            MODES.forEach((mode, i) => {
                const col = i % SEG_COLS;
                const row = Math.floor(i / SEG_COLS);
                const x = MARGIN + col * (segW + GAP);
                const by = y + row * (SEG_H + GAP);
                const selected = mode === active;
                drawPill(ctx, x, by, segW, SEG_H, { selected, accent: ACCENT_PINK });
                ctx.fillStyle = selected ? "#ffffff" : "#c8c8c8";
                ctx.font = (selected ? "bold " : "") + "10px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(fitText(ctx, MODE_LABELS[mode], segW - 6), x + segW / 2, by + SEG_H / 2);
                this._rects.push([x, by, segW, SEG_H, mode]);
            });
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            for (const originY of [this.y, 0]) {
                if (!this._rects) continue;
                for (const [x, by, w, h, mode] of this._rects) {
                    if (hit(pos, x, originY + (by - this.y), w, h)) {
                        const widget = getWidget(mouseNode, "resize_mode");
                        if (widget) {
                            widget.value = mode;
                            widget.callback?.(mode);
                            mouseNode.setDirtyCanvas(true, true);
                            refresh(mouseNode);
                        }
                        return true;
                    }
                }
            }
            return false;
        },
    };
}

// ---------------------------------------------------------------- mode-specific field

// A pager row: "<  Label: value  >" cycling through `options`.
function drawPager(ctx, x, y, w, h, label, value, accent) {
    const arrowW = ARROW_W;
    drawPill(ctx, x, y, arrowW, h, { accent });
    drawPill(ctx, x + w - arrowW, y, arrowW, h, { accent });
    ctx.fillStyle = "#dcdcdc";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◀", x + arrowW / 2, y + h / 2);
    ctx.fillText("▶", x + w - arrowW / 2, y + h / 2);

    const midX = x + arrowW + GAP;
    const midW = w - arrowW * 2 - GAP * 2;
    ctx.fillStyle = FIELD_BG;
    ctx.strokeStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.roundRect(midX, y, midW, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#e8e8e8";
    ctx.font = "11px Arial";
    ctx.fillText(fitText(ctx, `${label}: ${value}`, midW - 10), midX + midW / 2, y + h / 2);

    return { prev: [x, y, arrowW, h], next: [x + w - arrowW, y, arrowW, h] };
}

function drawNumberBox(ctx, x, y, w, h, label, value) {
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "10px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + h / 2);
    const boxX = x + 78;
    const boxW = w - 78;
    ctx.fillStyle = FIELD_BG;
    ctx.strokeStyle = "#3a3a3a";
    ctx.beginPath();
    ctx.roundRect(boxX, y, boxW, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = TEXT_BRIGHT;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(String(value), boxX + boxW / 2, y + h / 2);
    return [boxX, y, boxW, h];
}

function makeModeFieldWidget(node) {
    return {
        type: "mb_mode_field",
        name: "mb_mode_field",
        y: 0,
        width: 0,
        serialize: false,
        options: { serialize: false },

        _mode() { return getWidget(node, "resize_mode")?.value ?? "none"; },

        computeSize() {
            return [node.size[0], this._mode() === "none" ? 0 : ROW_H];
        },
        computeLayoutSize() {
            const h = this.computeSize()[1];
            return { minHeight: h, maxHeight: h, minWidth: 200, maxWidth: Infinity };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidthOf(drawNode, widgetWidth);
            const mode = getWidget(drawNode, "resize_mode")?.value ?? "none";
            this._hits = null;
            if (mode === "none") return;

            const w = this.width - MARGIN * 2;
            const x = MARGIN;

            if (mode === "max megapixels") {
                const value = getWidget(drawNode, "megapixels")?.value ?? "1.0";
                this._hits = { type: "pager", name: "megapixels", options: MEGAPIXELS, ...drawPager(ctx, x, y, w, ROW_H, "Megapixels", value, ACCENT_PURPLE) };
            } else if (mode === "match ratio") {
                const value = getWidget(drawNode, "match_ratio")?.value ?? "1:1";
                this._hits = { type: "pager", name: "match_ratio", options: MATCH_RATIOS, ...drawPager(ctx, x, y, w, ROW_H, "Ratio", value, ACCENT_PURPLE) };
            } else if (mode === "longest side") {
                const value = getWidget(drawNode, "longest_side")?.value ?? 1024;
                const rect = drawNumberBox(ctx, x, y, w, ROW_H, "Longest side", value);
                this._hits = { type: "number", name: "longest_side", min: 8, max: 16384, step: 1, rect };
            } else if (mode === "scale by") {
                const value = getWidget(drawNode, "scale_by")?.value ?? 1.0;
                const rect = drawNumberBox(ctx, x, y, w, ROW_H, "Scale by", value);
                this._hits = { type: "number", name: "scale_by", min: 0.05, max: 8, step: 0.05, rect };
            } else if (mode === "fit inside" || mode === "crop to fill") {
                const wName = mode === "fit inside" ? "fit_width" : "fill_width";
                const hName = mode === "fit inside" ? "fit_height" : "fill_height";
                const half = (w - GAP) / 2;
                const rectW = drawNumberBox(ctx, x, y, half, ROW_H, "Width", getWidget(drawNode, wName)?.value ?? 1024);
                const rectH = drawNumberBox(ctx, x + half + GAP, y, half, ROW_H, "Height", getWidget(drawNode, hName)?.value ?? 1024);
                this._hits = {
                    type: "twoNumber",
                    fields: [
                        { name: wName, min: 8, max: 16384, step: 1, rect: rectW },
                        { name: hName, min: 8, max: 16384, step: 1, rect: rectH },
                    ],
                };
            }
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            if (!this._hits) return false;

            for (const originY of [this.y, 0]) {
                if (this._hits.type === "pager") {
                    const { name, options, prev, next } = this._hits;
                    const [px, , pw, ph] = prev;
                    const [nx, , nw] = next;
                    let dir = 0;
                    if (hit(pos, px, originY, pw, ph)) dir = -1;
                    else if (hit(pos, nx, originY, nw, ph)) dir = 1;
                    if (dir) {
                        const widget = getWidget(mouseNode, name);
                        if (widget) {
                            const idx = Math.max(0, options.indexOf(widget.value));
                            const value = options[(idx + dir + options.length) % options.length];
                            widget.value = value;
                            widget.callback?.(value);
                            refresh(mouseNode);
                        }
                        return true;
                    }
                } else if (this._hits.type === "number") {
                    const { name, min, max, rect } = this._hits;
                    const [bx, , bw, bh] = rect;
                    if (hit(pos, bx, originY, bw, bh)) {
                        const widget = getWidget(mouseNode, name);
                        if (!widget) return true;
                        const typed = window.prompt(name.replace(/_/g, " "), widget.value);
                        if (typed !== null && !Number.isNaN(Number(typed))) {
                            const clamped = Math.min(max, Math.max(min, Number(typed)));
                            widget.value = clamped;
                            widget.callback?.(clamped);
                            refresh(mouseNode);
                        }
                        return true;
                    }
                } else if (this._hits.type === "twoNumber") {
                    for (const { name, min, max, rect } of this._hits.fields) {
                        const [bx, , bw, bh] = rect;
                        if (hit(pos, bx, originY, bw, bh)) {
                            const widget = getWidget(mouseNode, name);
                            if (!widget) return true;
                            const typed = window.prompt(name.replace(/_/g, " "), widget.value);
                            if (typed !== null && !Number.isNaN(Number(typed))) {
                                const clamped = Math.min(max, Math.max(min, Number(typed)));
                                widget.value = clamped;
                                widget.callback?.(clamped);
                                refresh(mouseNode);
                            }
                            return true;
                        }
                    }
                }
            }
            return false;
        },
    };
}

// ---------------------------------------------------------------- snap row

function makeSnapRowWidget(node) {
    return {
        type: "mb_snap_row",
        name: "mb_snap_row",
        y: 0,
        width: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() { return [node.size[0], ROW_H]; },
        computeLayoutSize() { return { minHeight: ROW_H, maxHeight: ROW_H, minWidth: 220, maxWidth: Infinity }; },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidthOf(drawNode, widgetWidth);
            const labelW = 40;
            const active = String(getWidget(drawNode, "snap")?.value ?? "8");

            ctx.fillStyle = TEXT_DIM;
            ctx.font = "10px Arial";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("SNAP", MARGIN, y + ROW_H / 2);

            const x0 = MARGIN + labelW;
            const usable = this.width - MARGIN - labelW - MARGIN;
            const segW = (usable - (QUICK_SNAPS.length - 1) * GAP) / QUICK_SNAPS.length;

            this._rects = [];
            QUICK_SNAPS.forEach((value, i) => {
                const x = x0 + i * (segW + GAP);
                const selected = value === active;
                drawPill(ctx, x, y, segW, ROW_H, { selected, accent: ACCENT_PINK });
                ctx.fillStyle = selected ? "#ffffff" : "#c8c8c8";
                ctx.font = (selected ? "bold " : "") + "10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(value === "1" ? "Off" : value, x + segW / 2, y + ROW_H / 2);
                this._rects.push([x, y, segW, ROW_H, value]);
            });
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            for (const originY of [this.y, 0]) {
                if (!this._rects) continue;
                for (const [x, , w, h, value] of this._rects) {
                    if (hit(pos, x, originY, w, h)) {
                        const widget = getWidget(mouseNode, "snap");
                        if (widget) {
                            widget.value = value;
                            widget.callback?.(value);
                            refresh(mouseNode);
                        }
                        return true;
                    }
                }
            }
            return false;
        },
    };
}

// ---------------------------------------------------------------- resample pager row

function makeResampleRowWidget(node) {
    return {
        type: "mb_resample_row",
        name: "mb_resample_row",
        y: 0,
        width: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() { return [node.size[0], ROW_H]; },
        computeLayoutSize() { return { minHeight: ROW_H, maxHeight: ROW_H, minWidth: 160, maxWidth: Infinity }; },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidthOf(drawNode, widgetWidth);
            const value = getWidget(drawNode, "resample")?.value ?? "lanczos";
            this._hits = drawPager(ctx, MARGIN, y, this.width - MARGIN * 2, ROW_H, "Resample", value, ACCENT_PURPLE);
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            if (!this._hits) return false;
            for (const originY of [this.y, 0]) {
                const [px, , pw, ph] = this._hits.prev;
                const [nx, , nw] = this._hits.next;
                let dir = 0;
                if (hit(pos, px, originY, pw, ph)) dir = -1;
                else if (hit(pos, nx, originY, nw, ph)) dir = 1;
                if (dir) {
                    const widget = getWidget(mouseNode, "resample");
                    if (widget) {
                        const idx = Math.max(0, RESAMPLES.indexOf(widget.value));
                        const value = RESAMPLES[(idx + dir + RESAMPLES.length) % RESAMPLES.length];
                        widget.value = value;
                        widget.callback?.(value);
                        mouseNode.setDirtyCanvas(true, true);
                    }
                    return true;
                }
            }
            return false;
        },
    };
}

// ---------------------------------------------------------------- upscaling toggle

function makeUpscaleToggleWidget(node) {
    return {
        type: "mb_upscale_toggle",
        name: "mb_upscale_toggle",
        y: 0,
        width: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() { return [node.size[0], ROW_H]; },
        computeLayoutSize() { return { minHeight: ROW_H, maxHeight: ROW_H, minWidth: 160, maxWidth: Infinity }; },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidthOf(drawNode, widgetWidth);
            const on = getWidget(drawNode, "allow_upscale")?.value === true;
            const x = MARGIN;
            const w = this.width - MARGIN * 2;

            drawPill(ctx, x, y, w, ROW_H, { selected: on, accent: ACCENT_PINK });
            ctx.fillStyle = on ? "#ffffff" : "#c8c8c8";
            ctx.font = "bold 12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`Upscaling: ${on ? "On" : "Off"}`, x + w / 2, y + ROW_H / 2);

            this._rect = [x, y, w, ROW_H];
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            for (const originY of [this.y, 0]) {
                if (!this._rect) continue;
                const [x, , w, h] = this._rect;
                if (hit(pos, x, originY, w, h)) {
                    const widget = getWidget(mouseNode, "allow_upscale");
                    if (widget) {
                        widget.value = !(widget.value === true);
                        widget.callback?.(widget.value);
                        mouseNode.setDirtyCanvas(true, true);
                    }
                    return true;
                }
            }
            return false;
        },
    };
}

// ---------------------------------------------------------------- panel refresh

async function refresh(node) {
    const panel = node.__mbMiniPreview;
    const value = getWidget(node, "image")?.value;

    const size = await measure(value);
    if (!size) {
        node.__mbMiniInfo = null;
        if (panel) {
            panel.preview.style.display = "none";
            panel.empty.style.display = "flex";
        }
        node.imgs = undefined;
        node.setDirtyCanvas(true, true);
        return;
    }

    const [w, h] = size;
    const [ow, oh] = computeOut(node, w, h);
    node.__mbMiniInfo = { w, h, ow, oh };

    if (panel) {
        panel.preview.src = viewURL(value);
        panel.preview.style.display = "block";
        panel.empty.style.display = "none";
    }

    // node.imgs is deliberately left untouched here: LiteGraph auto-draws it as
    // a second on-node preview, duplicating the DOM one above. It is only
    // populated just-in-time, for MaskEditor/Clipspace (see loadImgs()).
    node.setDirtyCanvas(true, true);
}

// Loads the current image into node.imgs right before a MaskEditor/Clipspace
// call needs it, and only then — see the comment in refresh().
function loadImgs(node) {
    const value = getWidget(node, "image")?.value;
    if (!value) return Promise.resolve(false);
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { node.imgs = [img]; resolve(true); };
        img.onerror = () => resolve(false);
        img.src = viewURL(value);
    });
}

// ---------------------------------------------------------------- preview DOM widget

function buildPreview(node) {
    ensureStyle();
    const wrap = document.createElement("div");
    wrap.className = "mb-mini-preview-wrap";

    const preview = document.createElement("img");
    preview.className = "mb-mini-preview";
    preview.style.display = "none";
    const empty = document.createElement("div");
    empty.className = "mb-mini-empty";
    empty.textContent = "drop an image here, or upload / paste / pick";
    wrap.append(preview, empty);

    wrap.addEventListener("dragover", (e) => { e.preventDefault(); wrap.style.opacity = "0.7"; });
    wrap.addEventListener("dragleave", () => { wrap.style.opacity = "1"; });
    wrap.addEventListener("drop", (e) => {
        e.preventDefault();
        wrap.style.opacity = "1";
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type.startsWith("image/")) uploadFile(node, file);
    });

    node.__mbMiniPreview = { wrap, preview, empty };
    return wrap;
}

// ---------------------------------------------------------------- MaskEditor / Clipspace

function clipspaceApp() {
    return app?.constructor; // ComfyApp class carries the static clipspace helpers
}

async function copyClipspace(node) {
    try {
        await loadImgs(node);
        clipspaceApp()?.copyToClipspace?.(node);
        notify("success", "Copied", "Image sent to Clipspace.");
    } catch (e) {
        notify("error", "Copy failed", e?.message ?? String(e));
    } finally {
        // One-shot: don't leave node.imgs around to trigger the native preview.
        node.imgs = undefined;
        node.setDirtyCanvas(true, true);
    }
}

function pasteClipspace(node) {
    try { clipspaceApp()?.pasteFromClipspace?.(node); refresh(node); }
    catch (e) { notify("error", "Paste failed", e?.message ?? String(e)); }
}

async function openMaskEditor(node) {
    if (!(await loadImgs(node))) {
        notify("warn", "No image", "Pick an image before opening the mask editor.");
        return;
    }
    const App = clipspaceApp();
    try {
        App?.copyToClipspace?.(node);
        if (App) App.clipspace_return_node = node;
        if (App?.open_maskeditor) { App.open_maskeditor(); return; }
        // Newer frontends expose it as a command instead of a static.
        const ran = app.extensionManager?.command?.execute?.("Comfy.MaskEditor.OpenMaskEditor");
        if (ran === undefined && !App?.open_maskeditor) {
            notify("warn", "MaskEditor", "This ComfyUI build did not expose the mask editor here.");
        }
    } catch (e) {
        notify("error", "MaskEditor failed", e?.message ?? String(e));
    }
}

// ---------------------------------------------------------------- wiring

function wireNode(node) {
    for (const name of HIDDEN_WIDGETS) setWidgetVisible(node, name, false);

    const widgets = [
        makeSizeRowWidget(node),
        makeActionRowWidget(node),
        makeFileRowWidget(node),
        makeModeGridWidget(node),
        makeModeFieldWidget(node),
        makeSnapRowWidget(node),
        makeResampleRowWidget(node),
        makeUpscaleToggleWidget(node),
    ];
    for (const widget of widgets) node.addCustomWidget(widget);
    // addCustomWidget appends; move them to the top, in display order.
    for (const widget of [...widgets].reverse()) {
        node.widgets.splice(node.widgets.indexOf(widget), 1);
        node.widgets.unshift(widget);
    }

    const element = buildPreview(node);
    node.addDOMWidget("mb_mini_panel", "mb_mini_panel", element, {
        serialize: false,
        hideOnZoom: false,
        getHeight: () => 158,
    });

    // Keep the (hidden) stock combo as the source of truth; mirror its changes.
    const image = getWidget(node, "image");
    if (image) {
        setWidgetVisible(node, "image", false);
        const prev = image.callback;
        image.callback = function (...args) {
            const r = prev?.apply(this, args);
            refresh(node);
            return r;
        };
    }

    // Right-click extras, the way stock Load Image offers them.
    const prevMenu = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        options.unshift(
            { content: "Open in MaskEditor", callback: () => openMaskEditor(node) },
            { content: "Copy (Clipspace)", callback: () => copyClipspace(node) },
            { content: "Paste (Clipspace)", callback: () => pasteClipspace(node) },
            null,
        );
        return prevMenu?.apply(this, arguments);
    };

    applyAccent(node);
    resizeToContent(node);
    refresh(node);
}

// PageUp / PageDown step the file on the selected Mini node.
let keysBound = false;
function bindKeys() {
    if (keysBound) return;
    keysBound = true;
    window.addEventListener("keydown", (e) => {
        if (e.key !== "PageUp" && e.key !== "PageDown") return;
        const target = e.target;
        if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
        const node = Object.values(app.canvas?.selected_nodes ?? {})
            .find((n) => n.comfyClass === "MBLoadImageMini");
        if (!node) return;
        e.preventDefault();
        stepFile(node, e.key === "PageUp" ? -1 : 1);
    });
}

app.registerExtension({
    name: "MBNodes.LoadImageMini",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBLoadImageMini") return;
        wireNode(node);
        bindKeys();
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBLoadImageMini") return;
        applyAccent(node);
        setTimeout(() => refresh(node), 120);
    },
});
