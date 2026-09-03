import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible } from "./common.js";
import { openDialog } from "./dialog.js";

// Global (not per-node): the 7 ratios shown in the quick-pick row, shared by
// every Pad Image node, edited from the gear button's dialog.
const STORAGE_KEY = "MBNodes.PadImage.ratios";
const SLOTS = 7;

// Mirrors NO_RATIO and PAD_FROM in pad_image_node.py. Declared here rather than
// beside the migration code so every use below reads the same constant.
const NO_RATIO = "none";
const PAD_FROM_VALUES = ["both", "first", "second"];
const PAD_FROM_LABELS = ["Both", "First", "Second"];

const MARGIN = 14;
const GAP = 8;
const FIELD_H = 26;
// Slider drag range. The backend still accepts up to 8192 (see clamp/sanitize);
// the track maps 0..SLIDER_MAX, and a double-click types an exact/larger value.
const SLIDER_MAX = 2048;
// Mirrors MAX_PAD in pad_image_node.py: the largest padding either mode may
// produce on one side.
const MAX_PAD = 8192;
const RATIO_BOX_H = 34;
const TOGGLE_H = 26;
const PREVIEW_H = 132; // schematic pad-layout preview row
const FIELD_LABEL_W = 42;

// Selected controls tint toward the node's accent (theme.js sets node.color);
// this is the fallback before a node has been themed.
const ACCENT_FALLBACK = "#3f7cc6";

// '#rrggbb' shaded toward white (amt > 0) or black (amt < 0). Used for the
// subtle top-to-bottom gradient on the pill buttons.
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

function accentColor(node) {
    return typeof node?.color === "string" && node.color ? node.color : ACCENT_FALLBACK;
}

// One rounded "pill": a soft vertical gradient, brighter when selected, tinted
// to the node accent. Shared by the ratio boxes, the pad-from segments, the gear
// and the swatch so the whole node reads as one control set.
function drawPill(ctx, x, y, w, h, { selected = false, accent = ACCENT_FALLBACK, radius = 8 } = {}) {
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    if (selected) {
        grad.addColorStop(0, shade(accent, 0.28));
        grad.addColorStop(1, shade(accent, -0.08));
    } else {
        grad.addColorStop(0, "#3d3d3d");
        grad.addColorStop(1, "#242424");
    }
    ctx.fillStyle = grad;
    ctx.strokeStyle = selected ? shade(accent, 0.4) : "#151515";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
}

// Row geometry, shared by the draw code and by the minimum-width maths, so a
// node can never end up narrower than the boxes it has to paint.
const RATIO_LABEL_W = 46;
const GEAR_W = 24;
const RATIO_BOX_MIN_W = 30;
const PADFROM_LABEL_W = 50;
const COLOR_LABEL_W = 58;
const SWATCH_W = 46;
const SEG_MIN_W = 44;

// Floored to the full SLOTS row, never the current active count, so picking
// fewer/more ratios can't shift the node's minimum width and jog its size.
function ratioRowMinWidth() {
    return MARGIN * 2 + RATIO_LABEL_W + SLOTS * RATIO_BOX_MIN_W + SLOTS * GAP + GEAR_W;
}

function padFromRowMinWidth() {
    return MARGIN * 2 + PADFROM_LABEL_W + SEG_MIN_W * 3 + GAP * 3 + COLOR_LABEL_W + SWATCH_W;
}

// Trim a label to what fits in its box, so a squeezed row never bleeds text
// over its neighbour.
function fitText(ctx, text, maxWidth) {
    if (maxWidth <= 0) return "";
    if (ctx.measureText(text).width <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(cut + "…").width > maxWidth) cut = cut.slice(0, -1);
    return cut + "…";
}

// { ratios: [...], values: { name: w/h } }, fetched once — the same table
// resolution_node.js uses, so both nodes agree on names and order without
// duplicating the list. `values` is the backend's own RATIOS numbers, so the
// preview maths cannot drift from what execute() will do.
let ALL_RATIOS = [];
let RATIO_VALUES = {};
const READY = api
    .fetchApi("/mbnodes/resolutions")
    .then((response) => response.json())
    .then((data) => {
        ALL_RATIOS = data.ratios ?? [];
        RATIO_VALUES = data.values ?? {};
        invalidateRatioCache();
    })
    .catch((e) => console.error("[MBNodes] ratio table fetch failed", e));

function shortLabel(name) {
    return name.split(" (")[0];
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Numeric W/H for a ratio name, straight from the backend table. Unknown names
// return null, which is exactly what execute() now treats as "no padding", so
// the preview and the run agree.
function ratioValue(name) {
    const value = RATIO_VALUES[String(name ?? "")];
    return typeof value === "number" && value > 0 ? value : null;
}

// The split + ratio-padding maths from pad_image_node.py, kept in lockstep so
// the schematic preview shows exactly what the backend will produce.
function splitExtra(extra, padFrom) {
    extra = clamp(extra, 0, MAX_PAD * 2);
    if (padFrom === "first") return [Math.min(extra, MAX_PAD), 0];
    if (padFrom === "second") return [0, Math.min(extra, MAX_PAD)];
    const first = Math.floor(extra / 2);
    return [first, extra - first];
}

function ratioPadding(w, h, ratio, padFrom) {
    if (w / h < ratio) {
        const extra = Math.max(0, Math.round(h * ratio) - w);
        const [left, right] = splitExtra(extra, padFrom);
        return { top: 0, bottom: 0, left, right };
    }
    const extra = Math.max(0, Math.round(w / ratio) - h);
    const [top, bottom] = splitExtra(extra, padFrom);
    return { top, bottom, left: 0, right: 0 };
}

// Source dimensions for the preview: the real upstream image when a run has
// already produced one, otherwise a neutral square so ratio padding still reads.
const PLACEHOLDER_DIMS = { w: 512, h: 512, real: false };

function sourceDims(node) {
    const graph = node.graph ?? app.graph;
    const link = node.inputs?.find((i) => i.name === "image")?.link;
    const info = link != null ? graph?.links?.[link] : null;
    const src = info ? graph?.getNodeById?.(info.origin_id) : null;
    const img = src?.imgs?.[0];
    if (img && img.naturalWidth > 0) {
        return { w: img.naturalWidth, h: img.naturalHeight, real: true };
    }
    return PLACEHOLDER_DIMS;
}

// The padding the current widget values imply, in image pixels.
function currentPadding(node, sw, sh) {
    const ratioName = getWidget(node, "aspect_ratio")?.value ?? NO_RATIO;
    if (ratioName !== NO_RATIO) {
        const ratio = ratioValue(ratioName);
        // Unknown name: the backend skips padding entirely, so the preview does too.
        if (!ratio) return { top: 0, bottom: 0, left: 0, right: 0 };
        const padFrom = getWidget(node, "pad_from")?.value ?? "both";
        return ratioPadding(sw, sh, ratio, padFrom);
    }
    const px = (name) => Math.max(0, Math.round(Number(getWidget(node, name)?.value) || 0));
    return { top: px("top"), bottom: px("bottom"), left: px("left"), right: px("right") };
}

// draw() runs every frame for every Pad node, so the parsed list is cached and
// only rebuilt when the stored set or the ratio table changes.
let activeRatiosCache = null;

function loadActiveRatios() {
    if (activeRatiosCache) return activeRatiosCache;
    let stored = [];
    try {
        stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
        stored = [];
    }
    const valid = stored.filter((name) => ALL_RATIOS.includes(name));
    activeRatiosCache = valid.length ? valid.slice(0, SLOTS) : ALL_RATIOS.slice(0, SLOTS);
    return activeRatiosCache;
}

// Called whenever the stored ratios or the fetched table change.
function invalidateRatioCache() {
    activeRatiosCache = null;
}

function saveActiveRatios(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    invalidateRatioCache();
    for (const node of app.graph?._nodes ?? []) {
        if (node.comfyClass === "MBPadImage") relayout(node);
    }
}

function subColRect(width, colIndex, cols) {
    const usable = width - MARGIN * 2;
    const colW = (usable - GAP * (cols - 1)) / cols;
    return [MARGIN + colIndex * (colW + GAP), colW];
}

// --- slider pair: Left/Right or Top/Bottom, each a labelled draggable track ---

// Where a field's slider track sits inside its column, given the column origin.
function trackRect(x, colW) {
    return { tx: x + FIELD_LABEL_W, tw: colW - FIELD_LABEL_W };
}

function drawSliderField(ctx, x, y, w, h, label, value, { min = 0, max = SLIDER_MAX, accent = ACCENT_FALLBACK } = {}) {
    ctx.fillStyle = "#c8c8c8";
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y + h / 2);

    const { tx, tw } = trackRect(x, w);
    const cy = y + h / 2;

    // Track groove.
    ctx.fillStyle = "#1b1b1b";
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx, y, tw, h, 6);
    ctx.fill();
    ctx.stroke();

    // Filled portion up to the current value, clipped to the rounded groove.
    const frac = clamp((Number(value) - min) / (max - min || 1), 0, 1);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tx, y, tw, h, 6);
    ctx.clip();
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, shade(accent, 0.28));
    grad.addColorStop(1, shade(accent, -0.08));
    ctx.fillStyle = grad;
    ctx.fillRect(tx, y, tw * frac, h);
    ctx.restore();

    // Value text, centred over the track.
    ctx.fillStyle = "#f0f0f0";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(String(value), tx + tw / 2, cy);
}

function makeSliderPairWidget(node, widgetName, aName, bName, labelA, labelB, { min = 0, max = MAX_PAD } = {}) {
    return {
        type: "mb_slider_pair",
        name: widgetName,
        y: 0,
        width: 0,
        _drag: null, // name of the field currently being dragged
        serialize: false,
        options: { serialize: false },

        computeSize() {
            return [node.size[0], FIELD_H];
        },
        computeLayoutSize() {
            const h = this.computeSize()[1];
            return { minHeight: h, maxHeight: h, minWidth: 180 };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidth || drawNode.size[0];
            const active = getWidget(drawNode, "aspect_ratio")?.value ?? NO_RATIO;
            const accent = accentColor(drawNode);

            ctx.save();
            ctx.globalAlpha = active !== NO_RATIO ? 0.4 : 1;
            [[0, aName, labelA], [1, bName, labelB]].forEach(([col, name, text]) => {
                const [x, colW] = subColRect(this.width, col, 2);
                const value = Number(getWidget(drawNode, name)?.value ?? 0);
                drawSliderField(ctx, x, y, colW, FIELD_H, text, value, { accent });
            });
            ctx.restore();
        },

        // Map an x position on a field's track to a clamped, rounded value.
        _valueFromX(px, x, colW) {
            const { tx, tw } = trackRect(x, colW);
            const frac = clamp((px - tx) / (tw || 1), 0, 1);
            return clamp(Math.round(frac * SLIDER_MAX), min, max);
        },

        mouse(event, pos, mouseNode) {
            // In aspect-ratio mode the pixel fields are ignored by the backend and
            // drawn dimmed, so they must not respond to input either.
            if ((getWidget(mouseNode, "aspect_ratio")?.value ?? NO_RATIO) !== NO_RATIO) return false;
            const width = this.width || mouseNode.size[0];

            const setFrom = (name, px, x, colW) => {
                const widget = getWidget(mouseNode, name);
                if (!widget) return;
                widget.value = this._valueFromX(px, x, colW);
                widget.callback?.(widget.value);
                mouseNode.setDirtyCanvas(true, true);
            };

            // The two renderers measure pos differently: the canvas one gives it
            // relative to the node, so a row starts at the widget's y, while
            // Nodes 2.0 hands the widget its own canvas and starts at 0. Every
            // hit test below tries both origins, which is safe because a widget
            // only receives clicks that landed inside its own box.

            // Continue an in-progress drag regardless of vertical position, so the
            // knob keeps tracking the cursor even if it strays off the row.
            if ((event.type === "pointermove" || event.type === "mousemove") && this._drag) {
                const col = this._drag === aName ? 0 : 1;
                const [x, colW] = subColRect(width, col, 2);
                setFrom(this._drag, pos[0], x, colW);
                return true;
            }
            if (event.type === "pointerup" || event.type === "mouseup") {
                const wasDragging = this._drag != null;
                this._drag = null;
                return wasDragging;
            }
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;

            for (const originY of [this.y, 0]) {
                if (pos[1] < originY || pos[1] > originY + FIELD_H) continue;

                for (const [col, name] of [[0, aName], [1, bName]]) {
                    const [x, colW] = subColRect(width, col, 2);
                    const { tx, tw } = trackRect(x, colW);
                    if (pos[0] < tx || pos[0] > tx + tw) continue;

                    // Double-click types an exact value (also the way past SLIDER_MAX).
                    if (event.type === "pointerdown" && (event.detail ?? 0) >= 2) {
                        const widget = getWidget(mouseNode, name);
                        if (!widget) return true;
                        const typed = window.prompt(`${name === aName ? labelA : labelB} (${min}-${max})`, widget.value);
                        if (typed !== null) {
                            widget.value = clamp(Math.round(Number(typed)) || 0, min, max);
                            widget.callback?.(widget.value);
                            mouseNode.setDirtyCanvas(true, true);
                        }
                        return true;
                    }

                    this._drag = name;
                    setFrom(name, pos[0], x, colW);
                    return true;
                }
            }
            return false;
        },
    };
}

// --- aspect ratio quick-pick grid + gear settings ---

function openRatioSettings() {
    let draft = new Set(loadActiveRatios());

    openDialog({
        title: "Pad Image (MB) — Aspect Ratios",
        applyLabel: "Done",
        render(body) {
            const hint = document.createElement("div");
            hint.className = "mb-dialog-hint";
            hint.style.margin = "0";
            hint.textContent = `Pick up to ${SLOTS} ratios for the quick-pick row. Shared by every Pad Image node.`;

            const list = document.createElement("div");
            list.className = "mb-dialog-list";

            function render() {
                list.replaceChildren();
                for (const name of ALL_RATIOS) {
                    const row = document.createElement("div");
                    row.className = "mb-dialog-row" + (draft.has(name) ? " mb-selected" : "");

                    const box = document.createElement("input");
                    box.type = "checkbox";
                    box.checked = draft.has(name);
                    box.disabled = !draft.has(name) && draft.size >= SLOTS;

                    const text = document.createElement("span");
                    text.textContent = name;

                    row.append(box, text);
                    row.addEventListener("click", (event) => {
                        if (box.disabled && !draft.has(name)) return;
                        if (event.target !== box) box.checked = !box.checked;
                        if (box.checked) draft.add(name);
                        else draft.delete(name);
                        render();
                    });
                    list.appendChild(row);
                }
            }
            render();
            body.append(hint, list);
        },
        onApply() {
            saveActiveRatios([...draft]);
            return true;
        },
    });
}

function makeRatioGridWidget(node) {
    return {
        type: "mb_ratio_grid",
        name: "ratio_grid",
        y: 0,
        width: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() {
            return [node.size[0], RATIO_BOX_H];
        },
        computeLayoutSize() {
            const h = this.computeSize()[1];
            return { minHeight: h, maxHeight: h, minWidth: ratioRowMinWidth() };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidth || drawNode.size[0];
            const h = RATIO_BOX_H;
            const active = getWidget(drawNode, "aspect_ratio")?.value ?? NO_RATIO;
            const ratios = loadActiveRatios();
            const gearW = GEAR_W;
            const accent = accentColor(drawNode);

            ctx.save();
            ctx.font = "10px Arial";
            ctx.fillStyle = "#c8c8c8";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("Aspect", MARGIN, y + h / 2 - 6);
            ctx.fillText("Ratios", MARGIN, y + h / 2 + 6);

            const labelW = RATIO_LABEL_W;
            const x0 = MARGIN + labelW;
            const boxesW = this.width - MARGIN - labelW - gearW - GAP - MARGIN;
            const count = Math.max(1, ratios.length);
            const boxW = Math.max(8, (boxesW - GAP * (count - 1)) / count);

            ratios.forEach((name, i) => {
                const bx = x0 + i * (boxW + GAP);
                const selected = name === active;
                drawPill(ctx, bx, y, boxW, h, { selected, accent });

                ctx.fillStyle = selected ? "#ffffff" : "#c8c8c8";
                ctx.font = (selected ? "bold " : "") + "10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(fitText(ctx, shortLabel(name), boxW - 6), bx + boxW / 2, y + h / 2);
            });

            const gearX = this.width - MARGIN - gearW;
            drawPill(ctx, gearX, y, gearW, h, { accent });
            ctx.fillStyle = "#dcdcdc";
            ctx.font = "13px Arial";
            ctx.textAlign = "center";
            ctx.fillText("⚙", gearX + gearW / 2, y + h / 2 + 1);
            ctx.restore();

            this._ratios = ratios;
            this._boxW = boxW;
            this._x0 = x0;
            this._gearX = gearX;
            this._gearW = gearW;
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            const h = RATIO_BOX_H;

            for (const originY of [this.y, 0]) {
                if (pos[1] < originY || pos[1] > originY + h) continue;

                if (pos[0] >= this._gearX && pos[0] <= this._gearX + this._gearW) {
                    openRatioSettings();
                    return true;
                }

                const ratios = this._ratios || [];
                for (let i = 0; i < ratios.length; i++) {
                    const bx = this._x0 + i * (this._boxW + GAP);
                    if (pos[0] >= bx && pos[0] <= bx + this._boxW) {
                        const widget = getWidget(mouseNode, "aspect_ratio");
                        if (widget) {
                            const next = widget.value === ratios[i] ? NO_RATIO : ratios[i];
                            widget.value = next;
                            widget.callback?.(next);
                            mouseNode.setDirtyCanvas(true, true);
                        }
                        return true;
                    }
                }
            }
            return false;
        },
    };
}

// --- pad-from toggle + pad color swatch, one row ---

function openColorPicker(node) {
    const widget = getWidget(node, "color");
    if (!widget) return;

    const input = document.createElement("input");
    input.type = "color";
    input.value = /^#[0-9a-f]{6}$/i.test(widget.value) ? widget.value : "#000000";
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);

    // Dismissing the native picker does not fire "change" in every browser, so
    // the element is also cleaned up on blur — which is why it is focused
    // explicitly first. Removing it twice is harmless.
    const cleanup = () => input.remove();

    input.addEventListener("input", () => {
        widget.value = input.value;
        widget.callback?.(input.value);
        node.setDirtyCanvas(true, true);
    });
    input.addEventListener("change", cleanup);
    input.addEventListener("blur", cleanup);
    input.focus();
    input.click();
}

function makePadFromColorWidget(node) {
    return {
        type: "mb_padfrom_color",
        name: "pad_from_color",
        y: 0,
        width: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() {
            return [node.size[0], TOGGLE_H];
        },
        computeLayoutSize() {
            const h = this.computeSize()[1];
            return { minHeight: h, maxHeight: h, minWidth: padFromRowMinWidth() };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            this.width = widgetWidth || drawNode.size[0];
            const h = TOGGLE_H;
            const labels = PAD_FROM_LABELS;
            const values = PAD_FROM_VALUES;
            const active = getWidget(drawNode, "pad_from")?.value ?? "both";
            const colorWidget = getWidget(drawNode, "color");
            const accent = accentColor(drawNode);
            // pad_from only biases the aspect-ratio split; in pixel mode it does
            // nothing, so it is drawn dimmed and ignores clicks (see mouse()).
            const ratioActive = (getWidget(drawNode, "aspect_ratio")?.value ?? NO_RATIO) !== NO_RATIO;

            ctx.save();
            ctx.font = "10px Arial";
            ctx.fillStyle = "#c8c8c8";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.globalAlpha = ratioActive ? 1 : 0.4;
            ctx.fillText("Pad from", MARGIN, y + h / 2);

            const segStartX = MARGIN + PADFROM_LABEL_W;
            const colorLabelW = COLOR_LABEL_W;
            const swatchW = SWATCH_W;
            const segEndX = this.width - MARGIN - colorLabelW - swatchW - GAP;
            const segW = Math.max(8, (segEndX - segStartX - GAP * 2) / 3);

            labels.forEach((text, i) => {
                const bx = segStartX + i * (segW + GAP);
                const selected = values[i] === active;
                drawPill(ctx, bx, y, segW, h, { selected, accent });
                ctx.fillStyle = selected ? "#ffffff" : "#c8c8c8";
                ctx.font = (selected ? "bold " : "") + "10px Arial";
                ctx.textAlign = "center";
                ctx.fillText(fitText(ctx, text, segW - 6), bx + segW / 2, y + h / 2);
            });
            ctx.globalAlpha = 1;

            const colorLabelX = segEndX + GAP;
            ctx.fillStyle = "#c8c8c8";
            ctx.font = "10px Arial";
            ctx.textAlign = "left";
            ctx.fillText("Pad Color", colorLabelX, y + h / 2);

            const swatchX = this.width - MARGIN - swatchW;
            // A checker under the swatch so a black/transparent colour still reads
            // as a swatch and not a hole in the node.
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(swatchX, y, swatchW, h, 8);
            ctx.clip();
            for (let cy = 0; cy < h; cy += 6) {
                for (let cx = 0; cx < swatchW; cx += 6) {
                    ctx.fillStyle = ((cx + cy) / 6) % 2 ? "#2a2a2a" : "#1a1a1a";
                    ctx.fillRect(swatchX + cx, y + cy, 6, 6);
                }
            }
            ctx.fillStyle = String(colorWidget?.value ?? "#000000");
            ctx.fillRect(swatchX, y, swatchW, h);
            ctx.restore();
            ctx.strokeStyle = "#151515";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(swatchX, y, swatchW, h, 8);
            ctx.stroke();
            ctx.restore();

            this._segStartX = segStartX;
            this._segW = segW;
            this._swatchX = swatchX;
            this._swatchW = swatchW;
        },

        mouse(event, pos, mouseNode) {
            if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
            const h = TOGGLE_H;
            const values = PAD_FROM_VALUES;

            const ratioActive = (getWidget(mouseNode, "aspect_ratio")?.value ?? NO_RATIO) !== NO_RATIO;

            for (const originY of [this.y, 0]) {
                if (pos[1] < originY || pos[1] > originY + h) continue;

                // The segments only matter in aspect-ratio mode; the colour
                // swatch below is always live.
                for (let i = 0; ratioActive && i < 3; i++) {
                    const bx = this._segStartX + i * (this._segW + GAP);
                    if (pos[0] >= bx && pos[0] <= bx + this._segW) {
                        const widget = getWidget(mouseNode, "pad_from");
                        if (widget) {
                            widget.value = values[i];
                            widget.callback?.(values[i]);
                            mouseNode.setDirtyCanvas(true, true);
                        }
                        return true;
                    }
                }

                if (pos[0] >= this._swatchX && pos[0] <= this._swatchX + this._swatchW) {
                    openColorPicker(mouseNode);
                    return true;
                }
            }
            return false;
        },
    };
}

// --- live schematic preview -------------------------------------------------

// A diagram, not a render: the padded canvas drawn in the actual pad colour with
// the source image's footprint inside it, sized to the current ratio/pixel
// settings. Redraws every frame from the live widget values, so the effect is
// visible before the workflow ever runs.
function makePreviewWidget(node) {
    return {
        type: "mb_preview",
        name: "pad_preview",
        y: 0,
        serialize: false,
        options: { serialize: false },

        computeSize() {
            return [node.size[0], PREVIEW_H];
        },
        computeLayoutSize() {
            return { minHeight: PREVIEW_H, maxHeight: PREVIEW_H, minWidth: 180 };
        },

        draw(ctx, drawNode, widgetWidth, y) {
            this.y = y;
            const width = widgetWidth || drawNode.size[0];
            const accent = accentColor(drawNode);
            const src = sourceDims(drawNode);
            const pad = currentPadding(drawNode, src.w, src.h);
            const paddedW = src.w + pad.left + pad.right;
            const paddedH = src.h + pad.top + pad.bottom;

            const areaX = MARGIN;
            const areaY = y + 6;
            const areaW = width - MARGIN * 2;
            const areaH = PREVIEW_H - 30;

            ctx.save();
            ctx.fillStyle = "#141414";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(areaX, areaY, areaW, areaH, 8);
            ctx.fill();
            ctx.stroke();
            ctx.clip();

            // Letterbox the padded canvas into the panel with a little breathing room.
            const scale = Math.min((areaW * 0.86) / paddedW, (areaH * 0.86) / paddedH);
            const dw = paddedW * scale;
            const dh = paddedH * scale;
            const dx = areaX + (areaW - dw) / 2;
            const dy = areaY + (areaH - dh) / 2;

            // The padded canvas, in the real pad colour.
            ctx.fillStyle = String(getWidget(drawNode, "color")?.value ?? "#000000");
            ctx.fillRect(dx, dy, dw, dh);

            // The source image's footprint.
            const sx = dx + pad.left * scale;
            const sy = dy + pad.top * scale;
            const sdw = src.w * scale;
            const sdh = src.h * scale;
            ctx.fillStyle = "#565656";
            ctx.fillRect(sx, sy, sdw, sdh);
            // Two faint diagonals mark it as an image placeholder.
            ctx.strokeStyle = "#6f6f6f";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + sdw, sy + sdh);
            ctx.moveTo(sx + sdw, sy);
            ctx.lineTo(sx, sy + sdh);
            ctx.stroke();

            // Outlines: accent for the padded canvas, light for the source.
            ctx.strokeStyle = "#9a9a9a";
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, sdw, sdh);
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(dx, dy, dw, dh);
            ctx.restore();

            // Caption: source -> padded size, flagged when the source size is a stand-in.
            ctx.save();
            ctx.fillStyle = "#8f8f8f";
            ctx.font = "10px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const tag = src.real ? "" : "  ·  sample size until first run";
            ctx.fillText(
                `${src.w}×${src.h}  →  ${paddedW}×${paddedH}${tag}`,
                width / 2,
                areaY + areaH + 12,
            );
            ctx.restore();
        },
    };
}

// --- wiring -----------------------------------------------------------------

// --- legacy workflow migration ----------------------------------------------

// Workflows saved before the rewrite carry nine positional values:
//   [mode, top, bottom, left, right, aspect_ratio, portrait, color, all_sides]
// The node now takes [left, right, top, bottom, aspect_ratio, pad_from, color],
// so a positional restore drops "pixels"/"16:9"/"#rrggbb" into the integer
// fields and leaves pad_from unset — which the backend rejects at queue time.
const LEGACY_MODES = ["pixels", "aspect ratio"];

function isLegacyValues(values) {
    return Array.isArray(values) && values.length >= 8 && LEGACY_MODES.includes(values[0]);
}

// Old saves used bare names ("16:9"); the table now spells them out
// ("16:9 (Widescreen)"). Match on the "W:H" prefix, and on the flipped ratio
// when the old `portrait` toggle was on.
function matchRatio(name, portrait) {
    const wanted = shortLabel(String(name ?? ""));
    const direct = ALL_RATIOS.find((r) => shortLabel(r) === wanted);
    if (!portrait) return direct ?? NO_RATIO;

    const flipped = wanted.split(":").reverse().join(":");
    return ALL_RATIOS.find((r) => shortLabel(r) === flipped) ?? direct ?? NO_RATIO;
}

function migrateRatio(name, portrait) {
    const match = matchRatio(name, portrait);
    if (match === NO_RATIO) {
        // e.g. an old 16:10 save: the ratio table no longer offers it, so the
        // node loads with no ratio rather than a silently different one.
        console.warn(`[MBNodes] Pad Image: ratio "${name}" is no longer offered; set to none.`);
    }
    return match;
}

function migrateLegacyValues(node, values) {
    const [mode, top, bottom, left, right, ratio, portrait, color, allSides] = values;
    const pad = Number(allSides) || 0;

    const next = {
        left: 0, right: 0, top: 0, bottom: 0,
        aspect_ratio: NO_RATIO,
        pad_from: "both",
        color: typeof color === "string" ? color : "#000000",
    };

    if (pad > 0) {
        // all_sides won over everything else, so it becomes four equal fields.
        next.left = next.right = next.top = next.bottom = pad;
    } else if (mode === "aspect ratio") {
        next.aspect_ratio = migrateRatio(ratio, Boolean(portrait));
    } else {
        next.left = Number(left) || 0;
        next.right = Number(right) || 0;
        next.top = Number(top) || 0;
        next.bottom = Number(bottom) || 0;
    }

    for (const [name, value] of Object.entries(next)) {
        const widget = getWidget(node, name);
        if (widget) widget.value = value;
    }
}

// Belt and braces: whatever a workflow restored, every widget ends up holding a
// value its own input will accept, so the node can always be queued.
function sanitize(node) {
    for (const name of ["left", "right", "top", "bottom"]) {
        const widget = getWidget(node, name);
        if (!widget) continue;
        const value = Math.round(Number(widget.value));
        widget.value = Number.isFinite(value) ? clamp(value, 0, MAX_PAD) : 0;
    }

    const ratio = getWidget(node, "aspect_ratio");
    if (ALL_RATIOS.length && ratio && ratio.value !== NO_RATIO && !ALL_RATIOS.includes(ratio.value)) {
        ratio.value = matchRatio(ratio.value, false);
    }

    const padFrom = getWidget(node, "pad_from");
    if (padFrom && !PAD_FROM_VALUES.includes(padFrom.value)) padFrom.value = "both";

    const color = getWidget(node, "color");
    if (color && typeof color.value !== "string") color.value = "#000000";
}

function hideDefaults(node) {
    for (const name of ["left", "right", "top", "bottom", "aspect_ratio", "pad_from", "color"]) {
        setWidgetVisible(node, name, false);
    }
}

// The four custom rows paint at fixed widths, so the node needs a width floor:
// any narrower and the ratio boxes run under the gear. Above the floor the node
// is free to be dragged wider, which is the only way to read all seven ratio
// labels in full. Height stays computed, since every row is a fixed height.
function relayout(node) {
    node.resizable = true;
    const minWidth = Math.max(ratioRowMinWidth(), padFromRowMinWidth());
    const width = Math.max(minWidth, node.size?.[0] ?? 0);
    const height = node.computeSize()[1];
    node.setSize([width, height]);
    node.setDirtyCanvas(true, true);
}

function wireNode(node) {
    hideDefaults(node);

    const pairLR = makeSliderPairWidget(node, "pair_lr", "left", "right", "Left", "Right");
    const pairTB = makeSliderPairWidget(node, "pair_tb", "top", "bottom", "Top", "Bottom");
    const ratioGrid = makeRatioGridWidget(node);
    const padFromColor = makePadFromColorWidget(node);
    const preview = makePreviewWidget(node);

    for (const widget of [pairLR, pairTB, ratioGrid, padFromColor, preview]) node.addCustomWidget(widget);

    // addCustomWidget appends; move the five to the top, in display order.
    for (const widget of [preview, padFromColor, ratioGrid, pairTB, pairLR]) {
        node.widgets.splice(node.widgets.indexOf(widget), 1);
        node.widgets.unshift(widget);
    }

    // configure() has already spread the saved array over the widgets by the
    // time onConfigure runs, so the raw values are re-read from `info` and the
    // widgets rewritten from them.
    const onConfigure = node.onConfigure;
    node.onConfigure = function (info) {
        onConfigure?.apply(this, arguments);
        // Kept for a second pass: the ratio table may still be in flight, and
        // the old ratio name can only be matched once it has arrived.
        this.__mbLegacyValues = isLegacyValues(info?.widgets_values) ? info.widgets_values : null;
        if (this.__mbLegacyValues) migrateLegacyValues(this, this.__mbLegacyValues);
        sanitize(this);
    };

    relayout(node);
}

app.registerExtension({
    name: "MBNodes.PadImage",

    async setup() {
        await READY;
        for (const node of app.graph?._nodes ?? []) {
            if (node.comfyClass === "MBPadImage") relayout(node);
        }
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPadImage") return;
        wireNode(node);
        READY.then(() => relayout(node));
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBPadImage") return;
        // The second migration pass: onConfigure ran before the ratio table had
        // arrived, so the old ratio name can only be matched now. Awaiting READY
        // is the actual wait, so no timer is needed.
        await READY;
        if (node.__mbLegacyValues) {
            migrateLegacyValues(node, node.__mbLegacyValues);
            node.__mbLegacyValues = null;
        }
        sanitize(node);
        hideDefaults(node);
        relayout(node);
    },
});
