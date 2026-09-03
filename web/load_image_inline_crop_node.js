// Load Image & Crop (MB): the crop box is dragged on the node itself. A custom
// canvas widget draws the picked file under a rect, and the rect is written
// back into the four hidden fraction widgets the backend reads. The aspect
// preset lives in a normal (visible) combo, so "free" really is free drag.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";
import {
    MIN_FRACTION, fractionRatio, normalizeRect, refitRect,
    resizeRect, newRect, frameOf, hitTest, drawCrop,
} from "./crop_geometry.js";

const RECT_WIDGETS = ["crop_x", "crop_y", "crop_width", "crop_height"];

const CROP_HEIGHT = 300;   // canvas area reserved on the node body
const MARGIN = 12;         // matches the inset LiteGraph uses for its widgets
const EMPTY_BG = "#0d0d0d";
const EMPTY_TEXT = "#6a6a6a";
const FOOT_TEXT = "#8f8f8f";
const NO_RESIZE = "original";
const SNAP = 8;            // mirrors SNAP in nodes/load_image_node.py

const ANNOTATED = /^(.*?)\s*\[(\w+)\]\s*$/;

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
        node.__mbInlineValue = null;
        node.__mbInlineImage = null;
        return;
    }
    if (node.__mbInlineValue === value) return;
    node.__mbInlineValue = value;

    const img = new Image();
    img.onload = () => {
        node.__mbInlineImage = img;
        // Never node.imgs: the core loader preview would draw the same picture
        // a second time under the crop editor.
        node.setDirtyCanvas(true, true);
    };
    img.onerror = () => {
        node.__mbInlineImage = null;
        node.setDirtyCanvas(true, true);
    };
    img.src = viewURL(value);
}

// ------------------------------------------------------------------ readout

// Mirrors target_size() in nodes/load_image_node.py, dimensions only.
function resizedSize(w, h, megapixels) {
    const mp = parseFloat(megapixels);
    if (!Number.isFinite(mp) || w <= 0 || h <= 0) return [w, h];
    const scale = Math.sqrt((mp * 1e6) / (w * h));
    return [
        Math.max(SNAP, Math.round((w * scale) / SNAP) * SNAP),
        Math.max(SNAP, Math.round((h * scale) / SNAP) * SNAP),
    ];
}

// --------------------------------------------------------------- the widget

function addCropWidget(node) {
    const widget = {
        type: "mb_inline_crop",
        name: "crop",
        // Nothing to serialize: the rect lives in the four float widgets.
        options: { serialize: false },
        computeSize: (width) => [width, CROP_HEIGHT],
        // The rect is dragged here, so LiteGraph must not pan the node with it.
        computeLayoutSize: () => ({ minHeight: CROP_HEIGHT, minWidth: 200 }),
    };

    widget.draw = function (ctx, drawNode, widgetWidth, y) {
        // Where the canvas sits on the node, needed to turn a node-space
        // pointer position into a position inside the image.
        const boxX = MARGIN;
        const boxY = y;
        const boxW = Math.max(20, widgetWidth - MARGIN * 2);
        const boxH = CROP_HEIGHT;

        ctx.save();
        ctx.fillStyle = EMPTY_BG;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 8);
        ctx.fill();
        ctx.clip();

        const image = node.__mbInlineImage;
        if (!image) {
            ctx.fillStyle = EMPTY_TEXT;
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("pick or upload an image", boxX + boxW / 2, boxY + boxH / 2);
            ctx.restore();
            node.__mbInlineFrame = null;
            return;
        }

        const imgW = image.naturalWidth;
        const imgH = image.naturalHeight;
        // Room at the bottom for the "Full: w x h" line under the image.
        const frame = frameOf(boxX, boxY, boxW, boxH - 18, imgW / imgH);
        node.__mbInlineFrame = frame;

        const rect = getRect(node);
        const cropW = Math.max(1, Math.round(rect.w * imgW));
        const cropH = Math.max(1, Math.round(rect.h * imgH));
        drawCrop(ctx, frame, image, rect, `${cropW} x ${cropH}`);

        // Second label: what the megapixel target turns that crop into.
        const megapixels = getWidget(node, "megapixels")?.value ?? NO_RESIZE;
        if (megapixels !== NO_RESIZE) {
            const [outW, outH] = resizedSize(cropW, cropH, megapixels);
            const label = `Resized to: ${outW} x ${outH}`;
            ctx.font = "11px Arial";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            const textW = ctx.measureText(label).width;
            const ly = frame.y + frame.h - 4;
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(frame.x + 4, ly - 14, textW + 8, 16);
            ctx.fillStyle = "#dcdcdc";
            ctx.fillText(label, frame.x + 8, ly - 1);
        }

        ctx.fillStyle = FOOT_TEXT;
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`Full: ${imgW} x ${imgH}`, boxX + boxW / 2, boxY + boxH - 3);
        ctx.restore();
    };

    // LiteGraph hands widget mouse events node-relative coordinates in
    // `pos`; the frame stashed by draw() is in the same space.
    widget.mouse = function (event, pos, graphNode) {
        const image = node.__mbInlineImage;
        const frame = node.__mbInlineFrame;
        if (!image || !frame) return false;

        const [px, py] = pos;
        const ratio = fractionRatio(
            getWidget(node, "aspect_ratio")?.value ?? "free",
            image.naturalWidth / image.naturalHeight,
        );
        const fx = (px - frame.x) / frame.w;
        const fy = (py - frame.y) / frame.h;

        const apply = (next) => {
            setRect(node, normalizeRect(next, ratio));
            return true;
        };

        if (event.type === "pointerdown") {
            // Outside the image: let the click fall through to the node.
            if (fx < -0.05 || fx > 1.05 || fy < -0.05 || fy > 1.05) return false;
            const rect = getRect(node);
            node.__mbInlineDrag = {
                mode: hitTest(frame, rect, px, py),
                start: rect,
                from: [fx, fy],
            };
            if (node.__mbInlineDrag.mode === "new") {
                apply({ x: fx, y: fy, w: MIN_FRACTION, h: MIN_FRACTION });
            }
            graphNode?.setDirtyCanvas?.(true, true);
            return true;
        }

        const drag = node.__mbInlineDrag;
        if (!drag) return false;

        if (event.type === "pointermove") {
            const { mode, start, from } = drag;
            if (mode === "move") {
                return apply({ ...start, x: start.x + (fx - from[0]), y: start.y + (fy - from[1]) });
            }
            if (mode === "new") return apply(newRect(from, fx, fy, ratio));
            return apply(resizeRect(mode, start, fx - from[0], fy - from[1], ratio));
        }

        if (event.type === "pointerup" || event.type === "pointercancel") {
            node.__mbInlineDrag = null;
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

    // Re-fit the box when the preset changes, the way the dialog does on Apply.
    const aspect = getWidget(node, "aspect_ratio");
    if (aspect) {
        const prev = aspect.callback;
        aspect.callback = function (value, ...rest) {
            const r = prev?.call(this, value, ...rest);
            const image = node.__mbInlineImage;
            const ratio = fractionRatio(
                value,
                image ? image.naturalWidth / image.naturalHeight : 1,
            );
            setRect(node, refitRect(getRect(node), ratio));
            return r;
        };
    }

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
    name: "MBNodes.LoadImageInlineCrop",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBLoadImageInlineCrop") return;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBLoadImageInlineCrop") return;
        // The combo value only lands after the graph is configured.
        setTimeout(() => loadImage(node), 120);
    },
});
