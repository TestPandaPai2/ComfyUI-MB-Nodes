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

const DIALOG_WIDTH = 1000;
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
    const fillMode = getWidget(node, "fill_mode")?.value ?? "color";
    const transparent = !!getWidget(node, "transparent")?.value;

    let canvas;
    let readout;
    let sizeW;
    let sizeH;
    let snap;
    let view = null;
    let drag = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;

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
        const ratio = lockValue(choice, imgW, imgH);
        pad = ratio ? lockRatio(next, imgW, imgH, ratio, axis) : next;
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
        readout.textContent = `L ${pad.left}  T ${pad.top}  R ${pad.right}  B ${pad.bottom}  ·  ${Math.round(zoom * 100)}%`;
        if (document.activeElement !== sizeW) sizeW.value = outW;
        if (document.activeElement !== sizeH) sizeH.value = outH;
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
            canvas = document.createElement("canvas");
            canvas.className = "mb-dialog-canvas";
            const dpr = window.devicePixelRatio || 1;
            canvas.width = CANVAS_W * dpr;
            canvas.height = CANVAS_H * dpr;
            canvas.style.aspectRatio = `${CANVAS_W} / ${CANVAS_H}`;
            body.appendChild(canvas);

            const row = document.createElement("div");
            row.className = "mb-dialog-field";
            row.style.justifyContent = "space-between";

            const left = document.createElement("div");
            left.className = "mb-dialog-field";

            const lock = document.createElement("select");
            lock.className = "mb-dialog-select";
            for (const option of LOCK_OPTIONS) {
                const item = document.createElement("option");
                item.value = option;
                item.textContent = option;
                lock.appendChild(item);
            }
            lock.value = choice;
            lock.addEventListener("change", () => {
                choice = lock.value;
                const ratio = lockValue(choice, imgW, imgH);
                if (ratio) pad = lockRatio(pad, imgW, imgH, ratio, "x");
                draw();
            });

            const picker = document.createElement("input");
            picker.type = "color";
            picker.value = /^#[0-9a-f]{6}$/i.test(color) ? color : "#000000";
            picker.addEventListener("input", () => {
                color = picker.value;
                draw();
            });

            readout = document.createElement("span");
            readout.className = "mb-dialog-hint";
            readout.style.margin = "0";

            left.append(field("aspect lock", lock), field("colour", picker), readout);

            const reset = document.createElement("button");
            reset.className = "mb-dialog-button";
            reset.textContent = "Reset";
            reset.addEventListener("click", () => {
                pad = { left: 0, top: 0, right: 0, bottom: 0 };
                const ratio = lockValue(choice, imgW, imgH);
                if (ratio) pad = lockRatio(pad, imgW, imgH, ratio, "x");
                draw();
            });

            row.append(left, reset);
            body.appendChild(row);

            const sizeInput = (axis) => {
                const input = document.createElement("input");
                input.type = "number";
                input.min = "1";
                input.className = "mb-dialog-number";
                input.style.marginLeft = "0";
                input.addEventListener("change", () => setSize(axis));
                input.addEventListener("keydown", (event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") input.blur();
                });
                return input;
            };
            sizeW = sizeInput("x");
            sizeH = sizeInput("y");

            snap = document.createElement("select");
            snap.className = "mb-dialog-select";
            for (const option of SNAP_OPTIONS) {
                const item = document.createElement("option");
                item.value = option;
                item.textContent = option;
                snap.appendChild(item);
            }
            snap.value = node.properties?.mbPadSnap ?? "off";
            snap.addEventListener("change", () => {
                setSize("x");
                if (!lockValue(choice, imgW, imgH)) setSize("y");
            });

            const anchors = document.createElement("div");
            anchors.style.cssText = "display:grid;grid-template-columns:repeat(3,16px);gap:2px";
            for (const [fx, fy] of ANCHORS) {
                const cell = document.createElement("button");
                cell.className = "mb-dialog-button";
                cell.style.cssText = "width:16px;height:16px;padding:0;min-width:0";
                cell.title = "Place the image here";
                cell.addEventListener("click", () => {
                    const w = pad.left + pad.right;
                    const h = pad.top + pad.bottom;
                    pad = shifted(pad, Math.round(w * fx) - pad.left, Math.round(h * fy) - pad.top);
                    draw();
                });
                anchors.appendChild(cell);
            }

            const viewButton = (label, title, onClick) => {
                const button = document.createElement("button");
                button.className = "mb-dialog-button";
                button.textContent = label;
                button.title = title;
                button.addEventListener("click", onClick);
                return button;
            };
            const zoomCenter = (factor) => zoomAt(CANVAS_W / 2, CANVAS_H / 2, factor);
            const views = document.createElement("div");
            views.className = "mb-dialog-field";
            views.append(
                viewButton("−", "Zoom out", () => zoomCenter(1 / 1.25)),
                viewButton("+", "Zoom in", () => zoomCenter(1.25)),
                viewButton("Fit", "Reset zoom and pan", () => {
                    zoom = 1;
                    panX = 0;
                    panY = 0;
                    draw();
                }),
            );

            const controls = document.createElement("div");
            controls.className = "mb-dialog-field";
            controls.style.justifyContent = "space-between";
            const sizeFields = document.createElement("div");
            sizeFields.className = "mb-dialog-field";
            sizeFields.append(field("size", sizeW), field("x", sizeH), field("snap", snap), field("anchor", anchors));
            controls.append(sizeFields, views);
            body.appendChild(controls);

            const hint = document.createElement("div");
            hint.className = "mb-dialog-hint";
            hint.style.margin = "0";
            hint.textContent = "Drag an edge or corner to pad that side, drag inside to move the image (arrow keys nudge, Shift ×10), drag outside or middle-drag to pan, wheel to zoom.";
            body.appendChild(hint);

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
