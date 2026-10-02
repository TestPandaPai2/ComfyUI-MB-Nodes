// Load Image Crop (MB): crop area picked on the node's preview. Drag on the
// image to draw a box, drag inside it to move, drag a grip to resize, click to
// clear. The aspect combo locks the box to a preset. The rect is written into the four hidden fraction widgets the backend
// reads; a zero-sized rect is "no crop" and the full image comes out.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";
import {
    MIN_FRACTION, normalizeRect, resizeRect, newRect, refitRect, offRatio, fractionRatio,
    frameOf, hitTest, drawCrop,
} from "./crop_geometry.js";

const RECT_WIDGETS = ["crop_x", "crop_y", "crop_width", "crop_height"];

const CROP_HEIGHT = 300;   // canvas area reserved on the node body
const MARGIN = 12;         // matches the inset LiteGraph uses for its widgets
const EMPTY_BG = "#18181a";
const EMPTY_TEXT = "#77777e";
const FOOT_TEXT = "#8e8e95";
const LABEL_TEXT = "#ececee";
const LABEL_BG = "#2a2a2e";
const CLICK_SLOP = 0.004;  // pointer travel (fraction of image) still counted as a click

const ANNOTATED = /^(.*?)\s*\[(\w+)\]\s*$/;
const EMPTY_RECT = { x: 0, y: 0, w: 0, h: 0 };

// ---------------------------------------------------------------- crop rect

function getRect(node) {
    const read = (name) => {
        const v = Number(getWidget(node, name)?.value);
        return Number.isFinite(v) ? v : 0;
    };
    return { x: read("crop_x"), y: read("crop_y"), w: read("crop_width"), h: read("crop_height") };
}

const hasCrop = (rect) => rect.w > 0 && rect.h > 0;

function setRect(node, rect) {
    const named = {
        crop_x: rect.x, crop_y: rect.y, crop_width: rect.w, crop_height: rect.h,
    };
    for (const [name, value] of Object.entries(named)) {
        const widget = getWidget(node, name);
        if (widget) widget.value = value;
    }
    node.setDirtyCanvas(true, true);
}

// ------------------------------------------------------------ source image

function viewURL(value) {
    if (!value) return null;
    const match = ANNOTATED.exec(value);
    const [name, type] = match ? [match[1], match[2]] : [value, "input"];
    return api.apiURL(`/view?${new URLSearchParams({ filename: name, subfolder: "", type })}`);
}

// Loads the picked file once per value. The failed value is remembered too, so
// a missing file is not refetched on every redraw.
function loadImage(node) {
    const value = getWidget(node, "image")?.value;
    if (!value) {
        node.__mbAreaValue = null;
        node.__mbAreaImage = null;
        return;
    }
    if (node.__mbAreaValue === value) return;
    node.__mbAreaValue = value;

    const img = new Image();
    img.onload = () => {
        node.__mbAreaImage = img;
        refitToAspect(node);
        node.setDirtyCanvas(true, true);
    };
    img.onerror = () => {
        node.__mbAreaImage = null;
        node.setDirtyCanvas(true, true);
    };
    img.src = viewURL(value);
}

// ------------------------------------------------------------------ readout

// The locked ratio in fraction space for the loaded image, or null for free.
function currentRatio(node) {
    const image = node.__mbAreaImage;
    if (!image) return null;
    return fractionRatio(getWidget(node, "aspect")?.value, image.naturalWidth / image.naturalHeight);
}

// Keeps a drawn box on the chosen aspect after the preset or the image changes.
function refitToAspect(node) {
    const rect = getRect(node);
    const ratio = currentRatio(node);
    if (hasCrop(rect) && offRatio(rect, ratio)) setRect(node, refitRect(rect, ratio));
}

const snapStep = (v, step) => Math.max(step, Math.round(v / step) * step);

// Mirrors output_size() in nodes/load_image_crop_area_node.py.
function outputSize(w, h, maxMp, steps) {
    const mp = parseFloat(maxMp);
    const step = Math.max(1, parseInt(steps) || 1);
    if (Number.isFinite(mp) && mp > 0) {
        const scale = Math.sqrt((mp * 1e6) / (w * h));
        w *= scale;
        h *= scale;
    }
    return [snapStep(w, step), snapStep(h, step)];
}

function drawLabel(ctx, text, x, y) {
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const textW = ctx.measureText(text).width;
    ctx.fillStyle = LABEL_BG;
    ctx.beginPath();
    ctx.roundRect(x, y, textW + 10, 16, 5);
    ctx.fill();
    ctx.fillStyle = LABEL_TEXT;
    ctx.fillText(text, x + 5, y + 2);
}

// --------------------------------------------------------------- the widget

function addCropWidget(node) {
    const widget = {
        type: "mb_area_crop",
        name: "crop",
        // Nothing to serialize: the rect lives in the four float widgets.
        options: { serialize: false },
        computeSize: (width) => [width, CROP_HEIGHT],
        computeLayoutSize: () => ({ minHeight: CROP_HEIGHT, minWidth: 200 }),
    };

    widget.draw = function (ctx, drawNode, widgetWidth, y) {
        const boxX = MARGIN;
        const boxY = y;
        const boxW = Math.max(20, widgetWidth - MARGIN * 2);
        const boxH = CROP_HEIGHT;

        ctx.save();
        ctx.fillStyle = EMPTY_BG;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 10);
        ctx.fill();
        ctx.clip();

        const image = node.__mbAreaImage;
        if (!image) {
            ctx.fillStyle = EMPTY_TEXT;
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("pick or upload an image", boxX + boxW / 2, boxY + boxH / 2);
            ctx.restore();
            node.__mbAreaFrame = null;
            return;
        }

        const imgW = image.naturalWidth;
        const imgH = image.naturalHeight;
        // Room at the bottom for the footer line under the image.
        const frame = frameOf(boxX, boxY, boxW, boxH - 18, imgW / imgH);
        node.__mbAreaFrame = frame;

        const rect = getRect(node);
        let outW = imgW;
        let outH = imgH;
        if (hasCrop(rect)) {
            outW = Math.max(1, Math.round(rect.w * imgW));
            outH = Math.max(1, Math.round(rect.h * imgH));
        }
        // The size that actually comes out, after megapixels and steps.
        const [finalW, finalH] = outputSize(
            outW, outH,
            getWidget(node, "max_megapixels")?.value ?? 0,
            getWidget(node, "resolution_steps")?.value ?? 1,
        );
        if (hasCrop(rect)) {
            drawCrop(ctx, frame, image, rect, `${finalW} x ${finalH}`);
        } else {
            ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h);
            drawLabel(ctx, `Output: ${finalW} x ${finalH}`, frame.x + 4, frame.y + frame.h - 20);
        }

        const foot = hasCrop(rect)
            ? `Full: ${imgW} x ${imgH}  ·  click to clear`
            : `Full: ${imgW} x ${imgH}  ·  drag to crop`;
        ctx.fillStyle = FOOT_TEXT;
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(foot, boxX + boxW / 2, boxY + boxH - 3);
        ctx.restore();
    };

    // LiteGraph hands widget mouse events node-relative coordinates in
    // `pos`; the frame stashed by draw() is in the same space.
    widget.mouse = function (event, pos, graphNode) {
        const image = node.__mbAreaImage;
        const frame = node.__mbAreaFrame;
        if (!image || !frame) return false;

        const [px, py] = pos;
        const fx = (px - frame.x) / frame.w;
        const fy = (py - frame.y) / frame.h;

        const ratio = currentRatio(node);
        const apply = (next) => {
            setRect(node, normalizeRect(next, ratio));
            return true;
        };

        if (event.type === "pointerdown") {
            // Outside the image: let the click fall through to the node.
            if (fx < -0.05 || fx > 1.05 || fy < -0.05 || fy > 1.05) return false;
            const rect = getRect(node);
            node.__mbAreaDrag = {
                // Without a box every press starts a new one.
                mode: hasCrop(rect) ? hitTest(frame, rect, px, py) : "new",
                start: rect,
                from: [fx, fy],
                moved: false,
            };
            graphNode?.setDirtyCanvas?.(true, true);
            return true;
        }

        const drag = node.__mbAreaDrag;
        if (!drag) return false;

        if (event.type === "pointermove") {
            const { mode, start, from } = drag;
            const dx = fx - from[0];
            const dy = fy - from[1];
            if (!drag.moved && Math.hypot(dx, dy) < CLICK_SLOP) return true;
            drag.moved = true;

            if (mode === "move") return apply({ ...start, x: start.x + dx, y: start.y + dy });
            if (mode === "new") return apply(newRect(from, fx, fy, ratio));
            return apply(resizeRect(mode, start, dx, dy, ratio));
        }

        if (event.type === "pointerup" || event.type === "pointercancel") {
            node.__mbAreaDrag = null;
            // A press with no drag is a click: clear the crop.
            if (!drag.moved && event.type === "pointerup") setRect(node, { ...EMPTY_RECT });
            // A drag too small to be a real box is treated as cleared too.
            else if (drag.moved) {
                const rect = getRect(node);
                if (rect.w < MIN_FRACTION || rect.h < MIN_FRACTION) setRect(node, { ...EMPTY_RECT });
            }
            return true;
        }

        return false;
    };

    node.addCustomWidget(widget);
    return widget;
}

// ------------------------------------------------------------------ wiring

// Must run synchronously from nodeCreated: a workflow restores widget values by
// position, so every widget added here has to already be in place — appended at
// the end, which leaves the indices of the real inputs untouched.
function wireNode(node) {
    for (const name of RECT_WIDGETS) setWidgetVisible(node, name, false);

    // Picking another file swaps the preview; the rect is in fractions, so it
    // stays where it was on the new image.
    const image = getWidget(node, "image");
    if (image) {
        const prev = image.callback;
        image.callback = function (...args) {
            const r = prev?.apply(this, args);
            loadImage(node);
            return r;
        };
    }

    const aspect = getWidget(node, "aspect");
    if (aspect) {
        const prev = aspect.callback;
        aspect.callback = function (...args) {
            const r = prev?.apply(this, args);
            refitToAspect(node);
            return r;
        };
    }

    addCropWidget(node);

    // The stock loader face draws its own preview from node.imgs; the crop
    // editor is that preview here, so the core one is kept empty.
    Object.defineProperty(node, "imgs", {
        get: () => undefined,
        set: () => {},
        configurable: true,
    });

    resizeToContent(node);
    loadImage(node);
}

app.registerExtension({
    name: "MBNodes.LoadImageCropArea",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBLoadImageCropArea") return;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBLoadImageCropArea") return;
        // The combo value only lands after the graph is configured.
        setTimeout(() => loadImage(node), 120);
    },
});
