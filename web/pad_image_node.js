import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible, addButton, resizeToContent, accentColor } from "./common.js";
import { openDialog } from "./dialog.js";
import { FIXED_RATIOS, HANDLES, HANDLE } from "./crop_geometry.js";
import { upstreamPreview } from "./crop_image_node.js";

// In manual mode the pad lives in these widgets (pixels per side), hidden from
// the node body and edited only inside the pad dialog along with the colour.
const SIDES = ["left", "top", "right", "bottom"];
// Mirrors MAX_PAD in nodes/pad_image_node.py.
const MAX_PAD = 8192;

const LOCK_OPTIONS = ["free", "source", ...Object.keys(FIXED_RATIOS)];

const DIALOG_WIDTH = 1180;
const CANVAS_W = 940;
const CANVAS_H = 600;
const VIEW_MARGIN = 24;
const EMPTY_BG = "#18181a";
const HANDLE_FILL = "#ffffff";
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 20;
const SNAP_OPTIONS = ["off", "8", "16", "32", "64"];
// [left share, top share] of the padding for each anchor cell, row by row.
const ANCHORS = [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [0.5, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]];
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const SIDE_LABELS = { left: "L", top: "T", right: "R", bottom: "B" };
const EXTENDS = [["left", "←"], ["right", "→"], ["top", "↑"], ["bottom", "↓"]];
const EXTEND_SHARE = 0.25;
// Target canvas sizes; null means 1.5× the source.
const PRESETS = { "1024×1024": [1024, 1024], "1344×768": [1344, 768], "768×1344": [768, 1344], "1920×1080": [1920, 1080], "source ×1.5": null };
const HISTORY_LIMIT = 100;

// Pad-dialog-only layout on top of the shared .mb-dialog-* styles.
const STYLE_ID = "mb-pad-style";
const STYLE = `
.mb-pad-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 12px; align-items: start; }
.mb-pad-stage { position: relative; }
.mb-pad-side { display: flex; flex-direction: column; gap: 10px; }
.mb-pad-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 9px; background: var(--comfy-input-bg); }
.mb-pad-tab {
    flex: 1; height: 26px; border: none; border-radius: 6px; background: transparent;
    color: var(--descrip-text); font-size: 12px; cursor: pointer;
}
.mb-pad-tab:hover { color: var(--input-text); }
.mb-pad-tab.mb-selected { background: var(--mb-a); color: #ffffff; }
.mb-pad-pane { display: flex; flex-direction: column; gap: 10px; }
.mb-pad-float {
    position: absolute; display: flex; align-items: center; gap: 4px; padding: 4px;
    border-radius: 9px; background: rgba(20, 20, 22, 0.78); backdrop-filter: blur(6px);
}
.mb-pad-top { top: 10px; left: 10px; }
.mb-pad-bottom { bottom: 10px; right: 10px; }
.mb-pad-readout { color: #c9c9cf; font-size: 11px; font-variant-numeric: tabular-nums; padding: 0 6px; }
.mb-pad-tool {
    min-width: 28px; height: 26px; padding: 0 8px; border: none; border-radius: 6px;
    background: var(--comfy-input-bg); color: var(--input-text); font-size: 12.5px; cursor: pointer;
}
.mb-pad-float .mb-pad-tool { background: transparent; color: #e8e8ec; }
.mb-pad-tool:hover, .mb-pad-float .mb-pad-tool:hover { background: var(--mb-a); color: #ffffff; }
.mb-pad-section {
    display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 10px;
    background: var(--comfy-menu-secondary-bg); border: 1px solid var(--border-color);
}
.mb-pad-heading { font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--descrip-text); }
.mb-pad-section .mb-dialog-field { justify-content: space-between; }
.mb-pad-section .mb-dialog-number { width: 64px; margin-left: 0; }
.mb-pad-section .mb-dialog-select { flex: 1; min-width: 0; max-width: 130px; }
.mb-pad-cross { display: grid; grid-template-columns: repeat(3, auto); justify-content: center; align-items: center; gap: 4px; }
.mb-pad-cross .mb-dialog-number { width: 58px; text-align: center; }
.mb-pad-link { display: flex; flex-direction: column; align-items: center; font-size: 10px; color: var(--descrip-text); cursor: pointer; }
.mb-pad-link input { accent-color: var(--mb-a); margin: 0; }
.mb-pad-anchors { display: grid; grid-template-columns: repeat(3, 14px); gap: 3px; padding: 4px; }
.mb-pad-anchor {
    width: 14px; height: 14px; padding: 0; border: none; border-radius: 3px;
    background: var(--comfy-input-bg); cursor: pointer;
}
.mb-pad-anchor:hover { background: var(--border-color); }
.mb-pad-anchor.mb-selected { background: var(--mb-a); }
.mb-pad-swatch { width: 40px; height: 24px; padding: 0; border: 1px solid var(--border-color); border-radius: 6px; background: none; cursor: pointer; }
`;

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
}

function getPad(node) {
    const pad = {};
    for (const side of SIDES) {
        const v = Number(getWidget(node, side)?.value);
        pad[side] = Number.isFinite(v) ? v : 0;
    }
    return pad;
}

const clampPad = (v) => Math.min(MAX_PAD, Math.max(0, Math.round(v)));

// Split `extra` pixels over two sides keeping their current proportion, evenly
// when both are still zero.
function share(extra, a, b) {
    const first = a + b > 0 ? Math.round(extra * a / (a + b)) : Math.floor(extra / 2);
    return [clampPad(first), clampPad(extra - first)];
}

// Grows the axis the user did not drag so the padded canvas meets `ratio`. If
// that would need negative padding, the dragged axis grows instead: the image
// itself is never cropped.
function lockRatio(pad, imgW, imgH, ratio, axis) {
    let w = imgW + pad.left + pad.right;
    let h = imgH + pad.top + pad.bottom;
    if (axis === "x") {
        h = w / ratio;
        if (h < imgH) { h = imgH; w = h * ratio; }
    } else {
        w = h * ratio;
        if (w < imgW) { w = imgW; h = w / ratio; }
    }
    const [left, right] = share(w - imgW, pad.left, pad.right);
    const [top, bottom] = share(h - imgH, pad.top, pad.bottom);
    return { left, right, top, bottom };
}

// Slides the image inside a canvas of the same size: padding moves from one
// side to the opposite one.
function shifted(base, dx, dy) {
    const w = base.left + base.right;
    const h = base.top + base.bottom;
    const left = Math.min(w, Math.max(0, Math.round(base.left + dx)));
    const top = Math.min(h, Math.max(0, Math.round(base.top + dy)));
    return { left, right: w - left, top, bottom: h - top };
}

function lockValue(choice, imgW, imgH) {
    if (choice === "source") return imgW / imgH;
    return FIXED_RATIOS[choice] ?? null;
}

function openPadDialog(node) {
    if (node.inputs?.[0]?.link == null) {
        alert("Connect an image first.");
        return;
    }
    const src = upstreamPreview(node);
    if (!src) {
        alert("No upstream image found to draw around.");
        return;
    }

    const image = new Image();
    image.onload = () => showDialog(node, image);
    image.onerror = () => alert("Could not load the upstream image.");
    image.src = src;
}

function showDialog(node, image) {
    const imgW = image.naturalWidth;
    const imgH = image.naturalHeight;

    // Edited on a copy, so Cancel simply throws it away.
    let pad = getPad(node);
    let color = getWidget(node, "color")?.value || "#000000";
    let choice = node.properties?.mbPadLock ?? "free";
    const fillWidget = getWidget(node, "fill_mode");
    let fillMode = fillWidget?.value ?? "color";
    const transparent = !!getWidget(node, "transparent")?.value;

    let canvas;
    let readout;
    let sizeW;
    let sizeH;
    let snap;
    let lock;
    const sideInputs = {};
    const anchorCells = [];
    let view = null;
    let drag = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;

    // Pad snapshots for Ctrl+Z / Ctrl+Y, kept only while the dialog is open.
    const undoStack = [];
    const redoStack = [];
    let nudging = false;

    // Call before every edit. Consecutive arrow nudges share one entry.
    function remember(nudge = false) {
        if (nudge && nudging) return;
        nudging = nudge;
        undoStack.push({ ...pad });
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        redoStack.length = 0;
    }

    function stepHistory(from, to) {
        if (!from.length) return;
        to.push({ ...pad });
        pad = from.pop();
        nudging = false;
        draw();
    }

    function applyLock(next, axis) {
        const ratio = lockValue(choice, imgW, imgH);
        return ratio ? lockRatio(next, imgW, imgH, ratio, axis) : next;
    }
    // Room for half the image again on every side, or the current pad if that
    // is bigger, centred on the padded canvas, then the user's zoom and pan on
    // top. Frozen while resizing or moving so the view does not shift under the cursor.
    function fitView() {
        const outW = imgW + pad.left + pad.right;
        const outH = imgH + pad.top + pad.bottom;
        const spanW = Math.max(imgW * 2, imgW + 2 * Math.max(pad.left, pad.right));
        const spanH = Math.max(imgH * 2, imgH + 2 * Math.max(pad.top, pad.bottom));
        const scale = Math.min((CANVAS_W - VIEW_MARGIN * 2) / spanW, (CANVAS_H - VIEW_MARGIN * 2) / spanH) * zoom;
        view = {
            scale,
            x: (CANVAS_W - outW * scale) / 2 + pad.left * scale + panX,
            y: (CANVAS_H - outH * scale) / 2 + pad.top * scale + panY,
        };
    }

    // Keeps the point under the cursor still while zooming.
    function zoomAt(px, py, factor) {
        const ux = (px - view.x) / view.scale;
        const uy = (py - view.y) / view.scale;
        zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
        fitView();
        panX += px - (view.x + ux * view.scale);
        panY += py - (view.y + uy * view.scale);
        draw();
    }

    function inside(px, py) {
        const box = outer();
        return px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h;
    }

    // Typed canvas size, rounded up to the snap and never smaller than the
    // image. The padding is split keeping the current anchor.
    function setSize(axis) {
        const step = Number(snap.value) || 1;
        const fit = (value, min) => Math.ceil(Math.max(Number(value) || 0, min) / step) * step;
        const next = { ...pad };
        if (axis === "x") [next.left, next.right] = share(fit(sizeW.value, imgW) - imgW, pad.left, pad.right);
        else [next.top, next.bottom] = share(fit(sizeH.value, imgH) - imgH, pad.top, pad.bottom);
        remember();
        pad = applyLock(next, axis);
        draw();
    }

    // Both axes at once from a preset; the lock goes to free since the preset
    // fixes the ratio itself.
    function setPreset(name) {
        const step = Number(snap.value) || 1;
        const fit = (value, min) => Math.ceil(Math.max(value, min) / step) * step;
        const [w, h] = PRESETS[name] ?? [Math.round(imgW * 1.5), Math.round(imgH * 1.5)];
        remember();
        const [left, right] = share(fit(w, imgW) - imgW, pad.left, pad.right);
        const [top, bottom] = share(fit(h, imgH) - imgH, pad.top, pad.bottom);
        pad = { left, right, top, bottom };
        choice = "free";
        lock.value = choice;
        draw();
    }

    // Grows one side by a share of the image, rounding the canvas up to the snap.
    function extend(side) {
        const horizontal = side === "left" || side === "right";
        const step = Number(snap.value) || 1;
        const next = { ...pad };
        next[side] = clampPad(next[side] + (horizontal ? imgW : imgH) * EXTEND_SHARE);
        const total = horizontal ? imgW + next.left + next.right : imgH + next.top + next.bottom;
        next[side] = clampPad(next[side] + Math.ceil(total / step) * step - total);
        remember();
        pad = applyLock(next, horizontal ? "x" : "y");
        draw();
    }

    function setSide(side, value, linked) {
        const v = clampPad(Number(value) || 0);
        const next = linked ? { left: v, top: v, right: v, bottom: v } : { ...pad, [side]: v };
        remember();
        pad = applyLock(next, side === "left" || side === "right" ? "x" : "y");
        draw();
    }

    function outer() {
        const s = view.scale;
        return {
            x: view.x - pad.left * s,
            y: view.y - pad.top * s,
            w: (imgW + pad.left + pad.right) * s,
            h: (imgH + pad.top + pad.bottom) * s,
        };
    }

    // Stretch the edge pixels over each side; corners take the corner pixel.
    function drawReplicate(ctx, box) {
        const s = view.scale;
        const x0 = box.x, x1 = view.x, x2 = view.x + imgW * s, x3 = box.x + box.w;
        const y0 = box.y, y1 = view.y, y2 = view.y + imgH * s, y3 = box.y + box.h;
        const cols = [[0, 1, x0, x1], [0, imgW, x1, x2], [imgW - 1, 1, x2, x3]];
        const rows = [[0, 1, y0, y1], [0, imgH, y1, y2], [imgH - 1, 1, y2, y3]];
        for (const [sx, sw, dx0, dx1] of cols) {
            for (const [sy, sh, dy0, dy1] of rows) {
                if (dx1 > dx0 && dy1 > dy0) ctx.drawImage(image, sx, sy, sw, sh, dx0, dy0, dx1 - dx0, dy1 - dy0);
            }
        }
    }

    // Approximate preview of the node's fill; the exact result comes from Python.
    function drawFill(ctx, box) {
        if (transparent) {
            const cell = 10;
            for (let y = 0; y * cell < box.h; y++) {
                for (let x = 0; x * cell < box.w; x++) {
                    ctx.fillStyle = (x + y) % 2 ? "#3a3a3d" : "#5a5a5e";
                    ctx.fillRect(box.x + x * cell, box.y + y * cell, cell, cell);
                }
            }
            return;
        }
        if (fillMode === "color") {
            ctx.fillStyle = color;
            ctx.fillRect(box.x, box.y, box.w, box.h);
            return;
        }
        if (fillMode === "blur edge") {
            ctx.filter = `blur(${Math.max(2, Math.max(pad.left, pad.right, pad.top, pad.bottom) / 8 * view.scale)}px)`;
        }
        drawReplicate(ctx, box);
        ctx.filter = "none";
        if (fillMode !== "reflect") return;

        const w = imgW * view.scale;
        const h = imgH * view.scale;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                ctx.save();
                ctx.translate(view.x + dx * w + (dx ? w : 0), view.y + dy * h + (dy ? h : 0));
                ctx.scale(dx ? -1 : 1, dy ? -1 : 1);
                ctx.drawImage(image, 0, 0, w, h);
                ctx.restore();
            }
        }
    }

    function draw() {
        if (!drag || drag.mode === "pan") fitView();
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = EMPTY_BG;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const box = outer();
        ctx.save();
        ctx.beginPath();
        ctx.rect(box.x, box.y, box.w, box.h);
        ctx.clip();
        drawFill(ctx, box);
        ctx.restore();
        ctx.drawImage(image, view.x, view.y, imgW * view.scale, imgH * view.scale);

        ctx.strokeStyle = accentColor();
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.w, box.h);

        ctx.fillStyle = HANDLE_FILL;
        for (const [, fx, fy] of HANDLES) {
            ctx.fillRect(box.x + box.w * fx - 4, box.y + box.h * fy - 4, 8, 8);
        }

        const outW = imgW + pad.left + pad.right;
        const outH = imgH + pad.top + pad.bottom;
        readout.textContent = `${imgW}×${imgH} → ${outW}×${outH}  ·  ${Math.round(zoom * 100)}%`;
        if (document.activeElement !== sizeW) sizeW.value = outW;
        if (document.activeElement !== sizeH) sizeH.value = outH;
        for (const side of SIDES) {
            if (document.activeElement !== sideInputs[side]) sideInputs[side].value = pad[side];
        }
        // An axis with no padding counts as centred.
        const at = (share, before, total) => (total ? Math.abs(Math.round(total * share) - before) <= 1 : share === 0.5);
        for (const [cell, fx, fy] of anchorCells) {
            cell.classList.toggle("mb-selected", at(fx, pad.left, pad.left + pad.right) && at(fy, pad.top, pad.top + pad.bottom));
        }
    }

    function hitHandle(px, py) {
        const box = outer();
        for (const [mode, fx, fy] of HANDLES) {
            if (Math.abs(px - (box.x + box.w * fx)) <= HANDLE && Math.abs(py - (box.y + box.h * fy)) <= HANDLE) return mode;
        }
        // Anywhere along an edge works too, not just its middle grip.
        const inY = py >= box.y && py <= box.y + box.h;
        const inX = px >= box.x && px <= box.x + box.w;
        if (inY && Math.abs(px - box.x) <= HANDLE) return "w";
        if (inY && Math.abs(px - (box.x + box.w)) <= HANDLE) return "e";
        if (inX && Math.abs(py - box.y) <= HANDLE) return "n";
        if (inX && Math.abs(py - (box.y + box.h)) <= HANDLE) return "s";
        return null;
    }

    function dragTo(mode, px, py) {
        const s = view.scale;
        const next = { ...pad };
        if (mode.includes("w")) next.left = clampPad((view.x - px) / s);
        if (mode.includes("e")) next.right = clampPad((px - view.x) / s - imgW);
        if (mode.includes("n")) next.top = clampPad((view.y - py) / s);
        if (mode.includes("s")) next.bottom = clampPad((py - view.y) / s - imgH);

        const ratio = lockValue(choice, imgW, imgH);
        if (ratio) {
            // A corner follows whichever axis moved further; an edge its own.
            let axis = mode === "n" || mode === "s" ? "y" : "x";
            if (mode.length === 2) {
                const dx = Math.abs(next.left + next.right - pad.left - pad.right);
                const dy = Math.abs(next.top + next.bottom - pad.top - pad.bottom);
                axis = dy > dx ? "y" : "x";
            }
            pad = lockRatio(next, imgW, imgH, ratio, axis);
        } else {
            pad = next;
        }
        draw();
    }

    function field(label, control) {
        const wrapper = document.createElement("div");
        wrapper.className = "mb-dialog-field";
        const text = document.createElement("span");
        text.textContent = label;
        wrapper.append(text, control);
        return wrapper;
    }

    openDialog({
        title: "Pad image",
        width: DIALOG_WIDTH,
        applyLabel: "Apply pad",
        render(body) {
            injectStyle();
            const select = (options, value, onChange) => {
                const element = document.createElement("select");
                element.className = "mb-dialog-select";
                for (const option of options) {
                    const item = document.createElement("option");
                    item.value = option;
                    item.textContent = option;
                    element.appendChild(item);
                }
                element.value = value;
                element.addEventListener("change", () => onChange(element));
                return element;
            };
            const button = (label, title, onClick, className = "mb-pad-tool") => {
                const element = document.createElement("button");
                element.className = className;
                element.textContent = label;
                element.title = title;
                element.addEventListener("click", onClick);
                return element;
            };
            const numberInput = (min, onChange) => {
                const input = document.createElement("input");
                input.type = "number";
                input.min = String(min);
                input.className = "mb-dialog-number";
                input.addEventListener("change", onChange);
                input.addEventListener("keydown", (event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") input.blur();
                });
                return input;
            };
            const section = (title, ...children) => {
                const box = document.createElement("div");
                box.className = "mb-pad-section";
                const heading = document.createElement("div");
                heading.className = "mb-pad-heading";
                heading.textContent = title;
                box.append(heading, ...children);
                return box;
            };
            // 3×3 grid with the given elements at their cell index.
            const cross = (cells) => {
                const grid = document.createElement("div");
                grid.className = "mb-pad-cross";
                for (let i = 0; i < 9; i++) grid.append(cells[i] ?? document.createElement("span"));
                return grid;
            };

            canvas = document.createElement("canvas");
            canvas.className = "mb-dialog-canvas";
            const dpr = window.devicePixelRatio || 1;
            canvas.width = CANVAS_W * dpr;
            canvas.height = CANVAS_H * dpr;
            canvas.style.aspectRatio = `${CANVAS_W} / ${CANVAS_H}`;

            readout = document.createElement("span");
            readout.className = "mb-pad-readout";

            const history = document.createElement("div");
            history.className = "mb-pad-float mb-pad-top";
            history.append(
                button("↶", "Undo (Ctrl+Z)", () => stepHistory(undoStack, redoStack)),
                button("↷", "Redo (Ctrl+Y)", () => stepHistory(redoStack, undoStack)),
                button("Reset", "Remove all padding", () => {
                    remember();
                    pad = applyLock({ left: 0, top: 0, right: 0, bottom: 0 }, "x");
                    draw();
                }),
            );

            const zoomCenter = (factor) => zoomAt(CANVAS_W / 2, CANVAS_H / 2, factor);
            const views = document.createElement("div");
            views.className = "mb-pad-float mb-pad-bottom";
            views.append(
                readout,
                button("−", "Zoom out", () => zoomCenter(1 / 1.25)),
                button("+", "Zoom in", () => zoomCenter(1.25)),
                button("Fit", "Reset zoom and pan", () => {
                    zoom = 1;
                    panX = 0;
                    panY = 0;
                    draw();
                }),
            );

            const stage = document.createElement("div");
            stage.className = "mb-pad-stage";
            stage.append(canvas, history, views);

            const linkAll = document.createElement("input");
            linkAll.type = "checkbox";
            for (const side of SIDES) {
                sideInputs[side] = numberInput(0, () => setSide(side, sideInputs[side].value, linkAll.checked));
                sideInputs[side].max = String(MAX_PAD);
                sideInputs[side].title = `${side} padding`;
            }
            const link = document.createElement("label");
            link.className = "mb-pad-link";
            link.title = "Set all four sides together";
            link.append(linkAll, "link");
            const padding = section("Padding (px)", cross({ 1: sideInputs.top, 3: sideInputs.left, 4: link, 5: sideInputs.right, 7: sideInputs.bottom }));

            const anchors = document.createElement("div");
            anchors.className = "mb-pad-anchors";
            for (const [fx, fy] of ANCHORS) {
                const cell = button("", "Place the image here", () => {
                    const w = pad.left + pad.right;
                    const h = pad.top + pad.bottom;
                    remember();
                    pad = shifted(pad, Math.round(w * fx) - pad.left, Math.round(h * fy) - pad.top);
                    draw();
                }, "mb-pad-anchor");
                anchorCells.push([cell, fx, fy]);
                anchors.appendChild(cell);
            }
            const arrows = {};
            for (const [side, label] of EXTENDS) arrows[side] = button(label, `Extend ${side} by a quarter of the image`, () => extend(side));
            const position = section("Extend +25% · anchor", cross({ 1: arrows.top, 3: arrows.left, 4: anchors, 5: arrows.right, 7: arrows.bottom }));

            sizeW = numberInput(1, () => setSize("x"));
            sizeH = numberInput(1, () => setSize("y"));
            const size = document.createElement("div");
            size.className = "mb-dialog-field";
            const times = document.createElement("span");
            times.textContent = "×";
            size.append(sizeW, times, sizeH);

            const presets = select(["preset…", ...Object.keys(PRESETS)], "preset…", () => {
                setPreset(presets.value);
                presets.value = "preset…";
            });
            snap = select(SNAP_OPTIONS, node.properties?.mbPadSnap ?? "off", () => {
                setSize("x");
                if (!lockValue(choice, imgW, imgH)) setSize("y");
            });
            lock = select(LOCK_OPTIONS, choice, () => {
                choice = lock.value;
                remember();
                pad = applyLock(pad, "x");
                draw();
            });
            const canvasSection = section("Canvas", field("preset", presets), field("snap", snap), field("aspect", lock));
            const output = section("Output size", size);

            const picker = document.createElement("input");
            picker.type = "color";
            picker.className = "mb-pad-swatch";
            picker.value = /^#[0-9a-f]{6}$/i.test(color) ? color : "#000000";
            picker.addEventListener("input", () => {
                color = picker.value;
                draw();
            });
            const colorField = field("colour", picker);
            colorField.hidden = fillMode !== "color";
            const fill = select(fillWidget?.options?.values ?? ["color"], fillMode, () => {
                fillMode = fill.value;
                colorField.hidden = fillMode !== "color";
                draw();
            });
            const fillSection = section("Fill", field("mode", fill), colorField);

            const tabs = document.createElement("div");
            tabs.className = "mb-pad-tabs";
            const pane = document.createElement("div");
            pane.className = "mb-pad-pane";
            const groups = { Pad: [padding, position], Canvas: [canvasSection], Fill: [fillSection] };
            const showTab = (name) => {
                for (const tab of tabs.children) tab.classList.toggle("mb-selected", tab.textContent === name);
                pane.replaceChildren(...groups[name]);
                node.properties.mbPadTab = name;
            };
            for (const name of Object.keys(groups)) tabs.appendChild(button(name, `${name} controls`, () => showTab(name), "mb-pad-tab"));
            showTab(groups[node.properties?.mbPadTab] ? node.properties.mbPadTab : "Pad");

            const side = document.createElement("div");
            side.className = "mb-pad-side";
            side.append(tabs, pane, output);

            const layout = document.createElement("div");
            layout.className = "mb-pad-layout";
            layout.append(stage, side);
            body.appendChild(layout);

            const hint = document.createElement("div");
            hint.className = "mb-dialog-hint";
            hint.style.margin = "0";
            hint.textContent = "Drag edges to pad · drag inside to move (arrows nudge, Shift ×10) · drag outside to pan · wheel to zoom · Ctrl+Z / Ctrl+Y undo / redo";
            body.appendChild(hint);

            // Kept inside the dialog so ComfyUI's graph undo does not fire.
            body.addEventListener("keydown", (event) => {
                if (!(event.ctrlKey || event.metaKey) || drag) return;
                const key = event.key.toLowerCase();
                const redo = key === "y" || (key === "z" && event.shiftKey);
                if (key !== "z" && !redo) return;
                event.preventDefault();
                event.stopPropagation();
                if (redo) stepHistory(redoStack, undoStack);
                else stepHistory(undoStack, redoStack);
            });

            const pointAt = (event) => {
                const box = canvas.getBoundingClientRect();
                return [
                    ((event.clientX - box.left) / box.width) * CANVAS_W,
                    ((event.clientY - box.top) / box.height) * CANVAS_H,
                ];
            };

            canvas.tabIndex = 0;
            canvas.style.outline = "none";

            canvas.addEventListener("pointerdown", (event) => {
                const [px, py] = pointAt(event);
                const mode = event.button === 1 ? "pan" : hitHandle(px, py) ?? (inside(px, py) ? "move" : "pan");
                event.preventDefault();
                canvas.focus();
                canvas.setPointerCapture(event.pointerId);
                if (mode !== "pan") remember();
                drag = { mode, x0: px, y0: py, pad0: { ...pad }, view0: { ...view }, panX0: panX, panY0: panY };
                if (mode === "pan") canvas.style.cursor = "grabbing";
            });
            // Stops the browser's middle-click autoscroll.
            canvas.addEventListener("mousedown", (event) => {
                if (event.button === 1) event.preventDefault();
            });

            canvas.addEventListener("pointermove", (event) => {
                const [px, py] = pointAt(event);
                if (drag?.mode === "pan") {
                    panX = drag.panX0 + px - drag.x0;
                    panY = drag.panY0 + py - drag.y0;
                    draw();
                    return;
                }
                if (drag?.mode === "move") {
                    const s = drag.view0.scale;
                    pad = shifted(drag.pad0, (px - drag.x0) / s, (py - drag.y0) / s);
                    // The canvas holds still and the image follows the cursor.
                    view = {
                        scale: s,
                        x: drag.view0.x + (pad.left - drag.pad0.left) * s,
                        y: drag.view0.y + (pad.top - drag.pad0.top) * s,
                    };
                    draw();
                    return;
                }
                if (drag) {
                    dragTo(drag.mode, px, py);
                    return;
                }
                const mode = hitHandle(px, py);
                canvas.style.cursor = mode ? `${mode}-resize` : inside(px, py) ? "move" : "grab";
            });

            canvas.addEventListener("wheel", (event) => {
                event.preventDefault();
                if (drag) return;
                const [px, py] = pointAt(event);
                zoomAt(px, py, event.deltaY < 0 ? 1.15 : 1 / 1.15);
            }, { passive: false });

            canvas.addEventListener("keydown", (event) => {
                const arrow = ARROWS[event.key];
                if (!arrow || drag) return;
                event.preventDefault();
                event.stopPropagation();
                const step = event.shiftKey ? 10 : 1;
                remember(true);
                pad = shifted(pad, arrow[0] * step, arrow[1] * step);
                draw();
            });

            const end = (event) => {
                if (!drag) return;
                drag = null;
                canvas.releasePointerCapture?.(event.pointerId);
                canvas.style.cursor = "default";
                draw();
            };
            canvas.addEventListener("pointerup", end);
            canvas.addEventListener("pointercancel", end);

            draw();
        },
        onApply() {
            for (const side of SIDES) {
                const widget = getWidget(node, side);
                if (widget) widget.value = pad[side];
            }
            const colorWidget = getWidget(node, "color");
            if (colorWidget) colorWidget.value = color;
            if (fillWidget) fillWidget.value = fillMode;
            node.properties.mbPadLock = choice;
            node.properties.mbPadSnap = snap.value;
            node.setDirtyCanvas(true, true);
        },
    });
}

app.registerExtension({
    name: "MBNodes.PadImage",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPadImage") return;
        for (const name of SIDES) setWidgetVisible(node, name, false);
        const button = addButton(node, "Pad Image", () => openPadDialog(node));

        // The dialog only drives manual mode; the other modes size the pad in
        // Python, so the button goes and the colour shows on the node instead.
        const sync = () => {
            const manual = (getWidget(node, "size_mode")?.value ?? "manual") === "manual";
            button.hidden = !manual;
            button.options = { ...button.options, hidden: !manual };
            setWidgetVisible(node, "color", !manual);
            resizeToContent(node);
        };
        const modeWidget = getWidget(node, "size_mode");
        if (modeWidget) {
            const prev = modeWidget.callback;
            modeWidget.callback = function (...args) {
                const result = prev?.apply(this, args);
                sync();
                return result;
            };
        }
        const onConfigure = node.onConfigure;
        node.onConfigure = function (...args) {
            const result = onConfigure?.apply(this, args);
            sync();
            return result;
        };
        sync();
    },
});
