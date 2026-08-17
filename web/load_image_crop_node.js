import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, addButton, resizeToContent } from "./common.js";
import { openDialog } from "./dialog.js";
import { pasteImage } from "./clipboard_image.js";
import {
    MIN_FRACTION, snapSpan, fractionRatio, normalizeRect, refitRect, offRatio,
    resizeRect, newRect, frameOf, hitTest, drawCrop,
} from "./crop_geometry.js";

const SNAP = 8; // must match SNAP in nodes/load_image_node.py

// Widgets the crop dialog owns; the node body shows none of them.
const CROP_WIDGETS = ["aspect_ratio", "divisible_by", "crop_x", "crop_y", "crop_width", "crop_height"];

// Keyed the same as RATIOS in nodes/crop_image_node.py.
const RATIO_OPTIONS = [
    "free", "source",
    "1:1", "4:3", "3:2", "16:10", "16:9", "1.85:1", "2:1", "21:9",
    "3:4", "2:3", "10:16", "9:16", "1:1.85", "1:2", "9:21",
];
const DIVISOR_OPTIONS = ["1", "8", "16", "32", "64"];

const DIALOG_WIDTH = 700;
const CANVAS_W = 660;
const CANVAS_H = 440;
const EMPTY_BG = "#0d0d0d";

function targetSize(width, height, megapixels) {
    const scale = Math.sqrt((megapixels * 1e6) / (width * height));
    return [
        Math.max(SNAP, Math.round((width * scale) / SNAP) * SNAP),
        Math.max(SNAP, Math.round((height * scale) / SNAP) * SNAP),
    ];
}

function aspectRatio(width, height) {
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const d = gcd(width, height);
    const [w, h] = [width / d, height / d];
    if (w <= 64 && h <= 64) return `${w}:${h}`;
    const r = width / height;
    return r >= 1 ? `${r.toFixed(2)}:1` : `1:${(1 / r).toFixed(2)}`;
}

// "name [output]" style annotated paths carry their folder in brackets.
function viewURL(filename) {
    const match = /^(.*?)\s*\[(\w+)\]\s*$/.exec(filename);
    const [name, type] = match ? [match[1], match[2]] : [filename, "input"];
    return api.apiURL(`/view?${new URLSearchParams({ filename: name, subfolder: "", type })}`);
}

// The picked file is loaded straight from /view: it is on disk and servable
// before the node has ever run, so both the readout and the crop dialog work on
// a fresh graph. node.imgs is not used — the Nodes 2.0 renderer draws previews
// from the node output store rather than off the canvas.
const imageCache = new Map();

function loadFile(filename) {
    if (!filename) return Promise.resolve(null);
    if (imageCache.has(filename)) return Promise.resolve(imageCache.get(filename));

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(filename, img);
            resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = viewURL(filename);
    });
}

// ---------------------------------------------------------------- crop rect

function getRect(node) {
    const read = (name, fallback) => {
        const v = Number(getWidget(node, name)?.value);
        return Number.isFinite(v) ? v : fallback;
    };
    return {
        x: read("crop_x", 0),
        y: read("crop_y", 0),
        w: read("crop_width", 1),
        h: read("crop_height", 1),
    };
}

function setRect(node, rect) {
    const named = {
        crop_x: rect.x, crop_y: rect.y, crop_width: rect.w, crop_height: rect.h,
    };
    for (const [name, value] of Object.entries(named)) {
        const widget = getWidget(node, name);
        if (widget) widget.value = value;
    }
}

// The pixel box the backend will produce for this rect, snapped the same way
// crop_box()/snap_axis() do in nodes/crop_image_node.py.
function cropSize(rect, width, height, divisor) {
    return [
        snapSpan(rect.w * width, width, divisor),
        snapSpan(rect.h * height, height, divisor),
    ];
}

// ------------------------------------------------------------------ readout

function render(node, image) {
    const info = node.__mbInfoWidget;
    if (!info) return;

    if (!image) {
        info.value = "no image loaded";
        node.setDirtyCanvas(true, false);
        return;
    }

    const [w, h] = [image.naturalWidth, image.naturalHeight];
    const rect = getRect(node);
    const divisor = Number(getWidget(node, "divisible_by")?.value ?? 1) || 1;
    const [cropW, cropH] = cropSize(rect, w, h, divisor);

    const resize = getWidget(node, "resize")?.value === true;
    const mp = parseFloat(getWidget(node, "megapixels")?.value ?? "1.0");
    const [outW, outH] = resize ? targetSize(cropW, cropH, mp) : [cropW, cropH];

    const chain = [`${w}x${h}`];
    if (cropW !== w || cropH !== h) chain.push(`${cropW}x${cropH}`);
    if (outW !== cropW || outH !== cropH) chain.push(`${outW}x${outH}`);

    const megapixels = ((outW * outH) / 1e6).toFixed(2);
    info.value = `${chain.join(" -> ")}  ${aspectRatio(outW, outH)}  ${megapixels} MP`;
    node.setDirtyCanvas(true, false);
}

async function updateInfo(node) {
    const image = await loadFile(getWidget(node, "image")?.value);
    node.__mbImage = image;
    // A locked ratio is a ratio of pixels, so the box stops matching when a
    // file of another shape is picked.
    if (image) {
        const ratio = fractionRatio(
            getWidget(node, "aspect_ratio")?.value ?? "free",
            image.naturalWidth / image.naturalHeight
        );
        if (offRatio(getRect(node), ratio)) setRect(node, refitRect(getRect(node), ratio));
    }
    render(node, image);
}

// ------------------------------------------------------------- crop dialog

function openCropDialog(node) {
    const image = node.__mbImage;
    if (!image) {
        alert("Pick an image first.");
        return;
    }

    const imgW = image.naturalWidth;
    const imgH = image.naturalHeight;
    const aspect = imgW / imgH;

    // Edited on a copy, so Cancel simply throws it away.
    let rect = getRect(node);
    let choice = getWidget(node, "aspect_ratio")?.value ?? "free";
    let divisor = getWidget(node, "divisible_by")?.value ?? "1";

    let canvas;
    let frame = null;
    let drag = null;

    const ratioNow = () => fractionRatio(choice, aspect);

    function draw() {
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = EMPTY_BG;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        frame = frameOf(0, 0, CANVAS_W, CANVAS_H, aspect);
        const [cw, ch] = cropSize(rect, imgW, imgH, Number(divisor) || 1);
        drawCrop(ctx, frame, image, rect, `${cw} x ${ch}`);
    }

    function apply(next) {
        rect = normalizeRect(next, ratioNow());
        draw();
    }

    function select(options, value, onChange) {
        const el = document.createElement("select");
        el.className = "mb-dialog-select";
        for (const option of options) {
            const item = document.createElement("option");
            item.value = option;
            item.textContent = option;
            el.appendChild(item);
        }
        el.value = value;
        el.addEventListener("change", () => onChange(el.value));
        return el;
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
        title: "Crop image",
        width: DIALOG_WIDTH,
        applyLabel: "Apply crop",
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
            left.append(
                field("aspect", select(RATIO_OPTIONS, choice, (value) => {
                    choice = value;
                    apply(refitRect(rect, ratioNow()));
                })),
                field("divisible by", select(DIVISOR_OPTIONS, divisor, (value) => {
                    divisor = value;
                    draw();
                })),
            );

            const reset = document.createElement("button");
            reset.className = "mb-dialog-button";
            reset.textContent = "Reset";
            reset.addEventListener("click", () => apply(refitRect({ x: 0, y: 0, w: 1, h: 1 }, ratioNow())));

            row.append(left, reset);
            body.appendChild(row);

            const hint = document.createElement("div");
            hint.className = "mb-dialog-hint";
            hint.style.margin = "0";
            hint.textContent = "Drag inside the box to move it, a corner or edge to resize, or on empty image to start a new one.";
            body.appendChild(hint);

            // The canvas is laid out in CSS pixels but drawn at device
            // resolution, so pointer coordinates are scaled back to the former.
            const pointAt = (event) => {
                const box = canvas.getBoundingClientRect();
                return [
                    ((event.clientX - box.left) / box.width) * CANVAS_W,
                    ((event.clientY - box.top) / box.height) * CANVAS_H,
                ];
            };

            canvas.addEventListener("pointerdown", (event) => {
                if (!frame) return;
                const [px, py] = pointAt(event);
                const from = [(px - frame.x) / frame.w, (py - frame.y) / frame.h];
                if (from[0] < -0.05 || from[0] > 1.05 || from[1] < -0.05 || from[1] > 1.05) return;

                canvas.setPointerCapture(event.pointerId);
                drag = { mode: hitTest(frame, rect, px, py), start: rect, from };
                if (drag.mode === "new") {
                    apply({ x: from[0], y: from[1], w: MIN_FRACTION, h: MIN_FRACTION });
                }
            });

            canvas.addEventListener("pointermove", (event) => {
                if (!drag || !frame) return;
                const [px, py] = pointAt(event);
                const fx = (px - frame.x) / frame.w;
                const fy = (py - frame.y) / frame.h;
                const ratio = ratioNow();
                const { mode, start, from } = drag;

                if (mode === "move") {
                    apply({ ...start, x: start.x + (fx - from[0]), y: start.y + (fy - from[1]) });
                } else if (mode === "new") {
                    apply(newRect(from, fx, fy, ratio));
                } else {
                    apply(resizeRect(mode, start, fx - from[0], fy - from[1], ratio));
                }
            });

            const end = (event) => {
                if (!drag) return;
                drag = null;
                canvas.releasePointerCapture?.(event.pointerId);
            };
            canvas.addEventListener("pointerup", end);
            canvas.addEventListener("pointercancel", end);

            draw();
        },
        onApply() {
            setRect(node, rect);
            const aspectWidget = getWidget(node, "aspect_ratio");
            if (aspectWidget) aspectWidget.value = choice;
            const divisorWidget = getWidget(node, "divisible_by");
            if (divisorWidget) divisorWidget.value = divisor;
            render(node, image);
        },
    });
}

// --------------------------------------------------------------------- node

// The node face stays down to the image options; everything about the crop is
// edited in the dialog. Called again after a load and on the next tick, since a
// widget the frontend rebuilds comes back visible.
function hideCropWidgets(node) {
    let changed = false;
    for (const name of CROP_WIDGETS) changed = setWidgetVisible(node, name, false) || changed;
    if (changed) resizeToContent(node);
}

function wireNode(node) {
    hideCropWidgets(node);

    addButton(node, "📋 Paste from clipboard", () => pasteImage(node));
    addButton(node, "Crop...", () => openCropDialog(node));

    const info = node.addWidget("text", "output", "no image loaded", () => {}, {
        serialize: false,
        // disabled is what the canvas renderer reads, read_only what Nodes 2.0 does.
        disabled: true,
        read_only: true,
    });
    info.disabled = true; // read-only readout
    info.serialize = false; // the serializer checks this, not options.serialize
    node.__mbInfoWidget = info;
    resizeToContent(node); // the node was sized before the button and readout existed

    for (const name of ["image", "resize", "megapixels"]) {
        const w = getWidget(node, name);
        if (!w) continue;
        const prev = w.callback;
        w.callback = function (...args) {
            const r = prev?.apply(this, args);
            updateInfo(node);
            return r;
        };
    }

    updateInfo(node);
}

app.registerExtension({
    name: "MBNodes.LoadImageCrop",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBLoadImageCrop") return;
        wireNode(node);
        setTimeout(() => hideCropWidgets(node), 100);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBLoadImageCrop") return;
        setTimeout(() => {
            hideCropWidgets(node);
            updateInfo(node);
        }, 100);
    },
});
