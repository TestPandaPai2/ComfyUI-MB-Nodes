// Load Image Crop (MB): crop area picked on the node's preview. Drag on the
// image to draw a box, drag inside it to move, drag a grip to resize,
// double-click to clear. Wheel zooms the preview, Alt-drag pans it. The chips
// in the corner fill, centre or flip the box. The aspect combo locks the box to
// a preset. The rect is written into the four hidden fraction widgets the
// backend reads; a zero-sized rect is "no crop" and the full image comes out.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";
import {
    FIXED_RATIOS, MIN_FRACTION, normalizeRect, resizeRect, newRect, refitRect, offRatio, fractionRatio,
    frameOf, hitTest, drawCrop,
} from "./crop_geometry.js";

const RECT_WIDGETS = ["crop_x", "crop_y", "crop_width", "crop_height"];
const ASPECT_DEFAULT_ID = "MBNodes.Defaults.LoadImageCropAspect";

const CROP_HEIGHT = 300;   // smallest preview; it grows with the node
const FOOT_HEIGHT = 18;    // footer line under the preview
const MARGIN = 12;         // matches the inset LiteGraph uses for its widgets
const CLICK_SLOP = 0.004;  // pointer travel (fraction of image) still counted as a click
const DOUBLE_CLICK_MS = 350;
const MAX_ZOOM = 16;
const ZOOM_STEP = 1.2;

const ANNOTATED = /^(.*?)\s*\[(\w+)\]\s*$/;
const EMPTY_RECT = { x: 0, y: 0, w: 0, h: 0 };
const FULL_VIEW = { z: 1, cx: 0.5, cy: 0.5 };

const CURSORS = {
    nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
    n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
    move: "move", new: "crosshair",
};

// Colours follow the active ComfyUI palette, with the old dark values as the
// fallback for frontends that do not publish these variables.
function theme() {
    const css = getComputedStyle(document.documentElement);
    const pick = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    return {
        bg: pick("--comfy-input-bg", "#18181a"),
        muted: pick("--descrip-text", "#8e8e95"),
        text: pick("--input-text", "#ececee"),
        chip: pick("--comfy-menu-bg", "#2a2a2e"),
    };
}

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
        node.__mbAreaZoom = { ...FULL_VIEW };
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

function drawLabel(ctx, colors, text, x, y) {
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const textW = ctx.measureText(text).width;
    ctx.fillStyle = colors.chip;
    ctx.beginPath();
    ctx.roundRect(x, y, textW + 10, 16, 5);
    ctx.fill();
    ctx.fillStyle = colors.text;
    ctx.fillText(text, x + 5, y + 2);
}

// ------------------------------------------------------------------- chips

// The aspect flipped on its side (16:9 -> 9:16), or null when there is no
// other orientation in the list.
function swappedAspect(node) {
    const widget = getWidget(node, "aspect");
    const value = widget?.value;
    if (!value?.includes(":")) return null;
    const [a, b] = value.split(":");
    const swapped = `${b}:${a}`;
    return swapped !== value && widget.options?.values?.includes(swapped) ? swapped : null;
}

function chipsFor(node) {
    const rect = getRect(node);
    const chips = [{ label: "Full", run: () => {
        const ratio = currentRatio(node);
        const full = { x: 0, y: 0, w: 1, h: 1 };
        setRect(node, ratio === null ? full : refitRect(full, ratio));
    } }];
    if (hasCrop(rect)) {
        chips.push({ label: "Center", run: () => setRect(node, { ...rect, x: (1 - rect.w) / 2, y: (1 - rect.h) / 2 }) });
    }
    const swapped = swappedAspect(node);
    if (swapped) {
        chips.push({ label: "Swap", run: () => {
            getWidget(node, "aspect").value = swapped;
            refitToAspect(node);
            node.setDirtyCanvas(true, true);
        } });
    }
    if (node.__mbAreaZoom.z > 1) {
        chips.push({ label: "Fit", run: () => {
            node.__mbAreaZoom = { ...FULL_VIEW };
            node.setDirtyCanvas(true, true);
        } });
    }
    return chips;
}

// Right-aligned pills along the top of the preview; the hit boxes are kept for
// the pointer handlers.
function drawChips(ctx, colors, node, view) {
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let x = view.x + view.w - 6;
    const y = view.y + 6;
    node.__mbAreaChips = [];
    for (const chip of chipsFor(node).reverse()) {
        const w = ctx.measureText(chip.label).width + 14;
        x -= w;
        ctx.fillStyle = colors.chip;
        ctx.beginPath();
        ctx.roundRect(x, y, w, 18, 9);
        ctx.fill();
        ctx.fillStyle = colors.text;
        ctx.fillText(chip.label, x + 7, y + 3);
        node.__mbAreaChips.push({ ...chip, x, y, w, h: 18 });
        x -= 4;
    }
}

const inside = (box, px, py) => box && px >= box.x && px <= box.x + box.w && py >= box.y && py <= box.y + box.h;

const chipAt = (node, px, py) => node.__mbAreaChips?.find((chip) => inside(chip, px, py));

// ------------------------------------------------------------------- zoom

// Keeps the zoomed image covering the letterboxed frame, so panning never
// shows an empty gap where the image used to be.
function clampZoom(zoom) {
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom.z));
    const half = 0.5 / z;
    const keep = (c) => Math.min(1 - half, Math.max(half, c));
    return { z, cx: keep(zoom.cx), cy: keep(zoom.cy) };
}

function zoomedFrame(base, zoom) {
    const w = base.w * zoom.z;
    const h = base.h * zoom.z;
    return { x: base.x + base.w / 2 - zoom.cx * w, y: base.y + base.h / 2 - zoom.cy * h, w, h };
}

// One wheel notch, keeping the image point under the cursor where it is.
function zoomAt(node, px, py, deltaY) {
    const base = node.__mbAreaBase;
    const frame = node.__mbAreaFrame;
    if (!node.__mbAreaImage || !frame || !inside(node.__mbAreaView, px, py)) return false;

    const zoom = node.__mbAreaZoom;
    const z = Math.min(MAX_ZOOM, Math.max(1, zoom.z * (deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)));
    const fx = (px - frame.x) / frame.w;
    const fy = (py - frame.y) / frame.h;
    node.__mbAreaZoom = clampZoom({
        z,
        cx: fx - (px - base.x - base.w / 2) / (base.w * z),
        cy: fy - (py - base.y - base.h / 2) / (base.h * z),
    });
    node.setDirtyCanvas(true, true);
    return true;
}

// LiteGraph has no per-widget wheel hook, so one capture listener on the
// canvas claims wheel events over a preview before the graph pans or zooms.
// Ctrl/Cmd-wheel is left to the graph.
function onCanvasWheel(event) {
    if (event.ctrlKey || event.metaKey) return;
    const canvas = app.canvas;
    canvas.adjustMouseEvent(event);
    const node = canvas.graph?.getNodeOnPos(event.canvasX, event.canvasY);
    if (node?.comfyClass !== "MBLoadImageCropArea" || node.flags?.collapsed) return;
    if (!zoomAt(node, event.canvasX - node.pos[0], event.canvasY - node.pos[1], event.deltaY)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
}

// --------------------------------------------------------------- the widget

function addCropWidget(node) {
    const widget = {
        type: "mb_area_crop",
        name: "crop",
        // Nothing to serialize: the rect lives in the four float widgets.
        options: { serialize: false },
        // No computeSize: LiteGraph only hands spare node height to widgets
        // that size themselves through computeLayoutSize.
        computeLayoutSize: () => ({ minHeight: CROP_HEIGHT, maxHeight: 1e6, minWidth: 200 }),
    };

    widget.draw = function (ctx, drawNode, widgetWidth, y) {
        const colors = theme();
        const boxX = MARGIN;
        const boxY = y;
        const boxW = Math.max(20, widgetWidth - MARGIN * 2);
        const boxH = Math.max(CROP_HEIGHT, (this.computedHeight ?? CROP_HEIGHT) - 4);

        ctx.save();
        ctx.fillStyle = colors.bg;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 10);
        ctx.fill();
        ctx.clip();

        const image = node.__mbAreaImage;
        if (!image) {
            ctx.fillStyle = colors.muted;
            ctx.font = "12px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("pick or upload an image", boxX + boxW / 2, boxY + boxH / 2);
            ctx.restore();
            node.__mbAreaFrame = null;
            node.__mbAreaChips = null;
            return;
        }

        const imgW = image.naturalWidth;
        const imgH = image.naturalHeight;
        const view = { x: boxX, y: boxY, w: boxW, h: boxH - FOOT_HEIGHT };
        const base = frameOf(view.x, view.y, view.w, view.h, imgW / imgH);
        node.__mbAreaZoom = clampZoom(node.__mbAreaZoom ?? FULL_VIEW);
        const frame = zoomedFrame(base, node.__mbAreaZoom);
        node.__mbAreaView = view;
        node.__mbAreaBase = base;
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

        ctx.save();
        ctx.beginPath();
        ctx.rect(view.x, view.y, view.w, view.h);
        ctx.clip();
        const dragging = node.__mbAreaDrag?.moved && node.__mbAreaDrag.mode !== "pan";
        if (hasCrop(rect)) drawCrop(ctx, frame, image, rect, null, dragging);
        else ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h);

        drawLabel(ctx, colors, `Output: ${finalW} x ${finalH}`, view.x + 6, view.y + 6);
        if (dragging && hasCrop(rect)) {
            const at = `x ${Math.round(rect.x * imgW)}  y ${Math.round(rect.y * imgH)}  ·  ${outW} x ${outH}`;
            drawLabel(ctx, colors, at, view.x + 6, view.y + 26);
        }
        drawChips(ctx, colors, node, view);
        ctx.restore();

        const zoom = node.__mbAreaZoom.z;
        const hint = hasCrop(rect) ? "double-click to clear" : "drag to crop";
        const zoomHint = zoom > 1 ? `${zoom.toFixed(1)}x · alt-drag to pan` : "wheel to zoom";
        ctx.fillStyle = colors.muted;
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(`Full: ${imgW} x ${imgH}  ·  ${hint}  ·  ${zoomHint}`, boxX + boxW / 2, boxY + boxH - 3);
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
            const chip = chipAt(node, px, py);
            if (chip) {
                chip.run();
                return true;
            }
            // Outside the preview or the image: let the click fall through to the node.
            if (!inside(node.__mbAreaView, px, py)) return false;
            if (fx < -0.05 || fx > 1.05 || fy < -0.05 || fy > 1.05) return false;
            const rect = getRect(node);
            let mode = hasCrop(rect) ? hitTest(frame, rect, px, py) : "new";
            if (event.altKey && node.__mbAreaZoom.z > 1) mode = "pan";
            node.__mbAreaDrag = {
                mode,
                start: rect,
                from: [fx, fy],
                fromPx: [px, py],
                zoom: node.__mbAreaZoom,
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

            if (mode === "pan") {
                node.__mbAreaZoom = clampZoom({
                    ...drag.zoom,
                    cx: drag.zoom.cx - (px - drag.fromPx[0]) / frame.w,
                    cy: drag.zoom.cy - (py - drag.fromPx[1]) / frame.h,
                });
                node.setDirtyCanvas(true, true);
                return true;
            }
            if (mode === "move") return apply({ ...start, x: start.x + dx, y: start.y + dy });
            if (mode === "new") return apply(newRect(from, fx, fy, ratio));
            return apply(resizeRect(mode, start, dx, dy, ratio));
        }

        if (event.type === "pointerup" || event.type === "pointercancel") {
            node.__mbAreaDrag = null;
            if (!drag.moved && event.type === "pointerup") {
                // Two clicks in quick succession clear the crop; one does nothing.
                const now = performance.now();
                if (now - (node.__mbAreaLastClick ?? 0) < DOUBLE_CLICK_MS) {
                    setRect(node, { ...EMPTY_RECT });
                    node.__mbAreaLastClick = 0;
                } else {
                    node.__mbAreaLastClick = now;
                }
            } else if (drag.moved && drag.mode !== "pan") {
                // A drag too small to be a real box is treated as cleared.
                const rect = getRect(node);
                if (rect.w < MIN_FRACTION || rect.h < MIN_FRACTION) setRect(node, { ...EMPTY_RECT });
            }
            node.setDirtyCanvas(true, true);
            return true;
        }

        return false;
    };

    node.addCustomWidget(widget);
    return widget;
}

// The cursor says what a press would do. LiteGraph only resets the cursor when
// its own hover state changes, so it is set straight on the canvas element.
function hoverCursor(node, event, pos) {
    const frame = node.__mbAreaFrame;
    const [px, py] = pos;
    if (!node.__mbAreaImage || !frame || !inside(node.__mbAreaView, px, py)) return "";
    if (chipAt(node, px, py)) return "pointer";
    if (event.altKey && node.__mbAreaZoom.z > 1) return "grab";
    const rect = getRect(node);
    return CURSORS[hasCrop(rect) ? hitTest(frame, rect, px, py) : "new"];
}

function setCursor(node, cursor) {
    if (node.__mbAreaCursor === cursor) return;
    node.__mbAreaCursor = cursor;
    app.canvas.canvas.style.cursor = cursor || "default";
}

// ------------------------------------------------------------------ wiring

// Must run synchronously from nodeCreated: a workflow restores widget values by
// position, so every widget added here has to already be in place — appended at
// the end, which leaves the indices of the real inputs untouched.
function wireNode(node) {
    for (const name of RECT_WIDGETS) setWidgetVisible(node, name, false);
    node.__mbAreaZoom = { ...FULL_VIEW };

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
        // New nodes start on the aspect picked in MB settings; a loaded
        // workflow restores its own value afterwards.
        aspect.value = app.extensionManager?.setting?.get(ASPECT_DEFAULT_ID) ?? aspect.value;
        const prev = aspect.callback;
        aspect.callback = function (...args) {
            const r = prev?.apply(this, args);
            refitToAspect(node);
            return r;
        };
    }

    addCropWidget(node);

    const prevMove = node.onMouseMove;
    node.onMouseMove = function (event, pos, canvas) {
        const r = prevMove?.apply(this, arguments);
        if (!node.__mbAreaDrag) setCursor(node, hoverCursor(node, event, pos));
        return r;
    };
    const prevLeave = node.onMouseLeave;
    node.onMouseLeave = function () {
        const r = prevLeave?.apply(this, arguments);
        setCursor(node, "");
        return r;
    };

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

    settings: [
        {
            id: ASPECT_DEFAULT_ID,
            category: ["MB", "Node defaults", "Load Image Crop aspect"],
            name: "Load Image Crop: aspect",
            tooltip: "aspect value on newly added Load Image Crop (MB) nodes.",
            type: "combo",
            options: ["free", "source", ...Object.keys(FIXED_RATIOS)],
            defaultValue: "free",
        },
    ],

    async setup() {
        app.canvas.canvas.addEventListener("wheel", onCanvasWheel, { capture: true, passive: false });
    },

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
