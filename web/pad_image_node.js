import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible, addButton, resizeToContent, accentColor } from "./common.js";
import { openDialog } from "./dialog.js";
import { FIXED_RATIOS, HANDLES, HANDLE } from "./crop_geometry.js";
import { upstreamPreview } from "./crop_image_node.js";

// The pad lives in these widgets (pixels per side + colour), hidden from the
// node body and edited only inside the pad dialog.
const SIDES = ["left", "top", "right", "bottom"];
const DIALOG_WIDGETS = [...SIDES, "color"];
// Mirrors MAX_PAD in nodes/pad_image_node.py.
const MAX_PAD = 8192;

const LOCK_OPTIONS = ["free", "source", ...Object.keys(FIXED_RATIOS)];

const DIALOG_WIDTH = 1000;
const CANVAS_W = 940;
const CANVAS_H = 600;
const VIEW_MARGIN = 24;
const EMPTY_BG = "#18181a";
const HANDLE_FILL = "#ffffff";

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

    let canvas;
    let readout;
    let view = null;
    let drag = null;

    // Room for half the image again on every side, or the current pad if that
    // is bigger. Frozen while dragging so the view does not zoom under the cursor.
    function fitView() {
        const spanW = Math.max(imgW * 2, imgW + 2 * Math.max(pad.left, pad.right));
        const spanH = Math.max(imgH * 2, imgH + 2 * Math.max(pad.top, pad.bottom));
        const scale = Math.min((CANVAS_W - VIEW_MARGIN * 2) / spanW, (CANVAS_H - VIEW_MARGIN * 2) / spanH);
        view = {
            scale,
            x: (CANVAS_W - imgW * scale) / 2,
            y: (CANVAS_H - imgH * scale) / 2,
        };
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

    function draw() {
        if (!drag) fitView();
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = EMPTY_BG;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const box = outer();
        ctx.fillStyle = color;
        ctx.fillRect(box.x, box.y, box.w, box.h);
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
        readout.textContent = `${outW} x ${outH}  ·  L ${pad.left}  T ${pad.top}  R ${pad.right}  B ${pad.bottom}`;
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

            const hint = document.createElement("div");
            hint.className = "mb-dialog-hint";
            hint.style.margin = "0";
            hint.textContent = "Drag any edge or corner of the red box outward to pad that side.";
            body.appendChild(hint);

            const pointAt = (event) => {
                const box = canvas.getBoundingClientRect();
                return [
                    ((event.clientX - box.left) / box.width) * CANVAS_W,
                    ((event.clientY - box.top) / box.height) * CANVAS_H,
                ];
            };

            canvas.addEventListener("pointerdown", (event) => {
                const [px, py] = pointAt(event);
                const mode = hitHandle(px, py);
                if (!mode) return;
                canvas.setPointerCapture(event.pointerId);
                drag = mode;
            });

            canvas.addEventListener("pointermove", (event) => {
                const [px, py] = pointAt(event);
                if (drag) {
                    dragTo(drag, px, py);
                    return;
                }
                const mode = hitHandle(px, py);
                canvas.style.cursor = mode ? `${mode}-resize` : "default";
            });

            const end = (event) => {
                if (!drag) return;
                drag = null;
                canvas.releasePointerCapture?.(event.pointerId);
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
            node.setDirtyCanvas(true, true);
        },
    });
}

app.registerExtension({
    name: "MBNodes.PadImage",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPadImage") return;
        for (const name of DIALOG_WIDGETS) setWidgetVisible(node, name, false);
        addButton(node, "Pad Image", () => openPadDialog(node));
        resizeToContent(node);
    },
});
