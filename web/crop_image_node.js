import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, addButton, resizeToContent } from "./common.js";

// The crop rect lives in these four widgets as fractions of the image, so it
// stays valid whatever resolution turns up on the input dot.
const RECT_WIDGETS = ["crop_x", "crop_y", "crop_width", "crop_height"];

const MARGIN = 15;      // matches the inset LiteGraph uses for its own widgets
const MIN_HEIGHT = 140; // the editor never collapses below this
const MAX_HEIGHT = 420;
const HANDLE = 8;       // hit radius of a corner/edge grip, in widget pixels
const MIN_FRACTION = 0.02;

const FILL_OUTSIDE = "rgba(0, 0, 0, 0.55)";
const LINE = "#e01010";
const LINE_SOFT = "rgba(255, 255, 255, 0.35)";
const HANDLE_FILL = "#ffffff";
const EMPTY_BG = "#1a1a1a";
const TEXT = "#dcdcdc";

// Fixed presets, keyed the same as RATIOS in nodes/crop_image_node.py.
const FIXED_RATIOS = {
    "1:1": 1, "4:3": 4 / 3, "3:2": 3 / 2, "16:10": 16 / 10, "16:9": 16 / 9,
    "1.85:1": 1.85, "2:1": 2, "21:9": 21 / 9,
    "3:4": 3 / 4, "2:3": 2 / 3, "10:16": 10 / 16, "9:16": 9 / 16,
    "1:1.85": 1 / 1.85, "1:2": 0.5, "9:21": 9 / 21,
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

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
    const w = Math.min(1, Math.max(MIN_FRACTION, rect.w));
    const h = Math.min(1, Math.max(MIN_FRACTION, rect.h));
    const values = {
        crop_x: clamp01(Math.min(rect.x, 1 - w)),
        crop_y: clamp01(Math.min(rect.y, 1 - h)),
        crop_width: w,
        crop_height: h,
    };
    for (const [name, value] of Object.entries(values)) {
        const widget = getWidget(node, name);
        if (widget) widget.value = value;
    }
}

// Target aspect as a *pixel* ratio, or null when the box is unconstrained.
function targetRatio(node) {
    const choice = getWidget(node, "aspect_ratio")?.value ?? "free";
    if (choice === "free") return null;
    if (choice === "source") return 1; // in fraction space that is the full frame
    return FIXED_RATIOS[choice] ?? null;
}

// Pixel ratios have to be expressed against the image's own aspect before they
// can be applied to a rect measured in fractions of that image.
function fractionRatio(node, imageAspect) {
    const ratio = targetRatio(node);
    if (ratio === null) return null;
    if ((getWidget(node, "aspect_ratio")?.value ?? "") === "source") return 1;
    return ratio / (imageAspect || 1);
}

// Largest rect of the wanted shape that fits, centred on the current one.
function refit(node, imageAspect) {
    const ratio = fractionRatio(node, imageAspect);
    const rect = getRect(node);
    if (ratio === null) return;

    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;

    let w = rect.w;
    let h = w / ratio;
    if (h > 1) {
        h = 1;
        w = h * ratio;
    }
    if (w > 1) {
        w = 1;
        h = w / ratio;
    }
    setRect(node, { x: cx - w / 2, y: cy - h / 2, w, h });
}

function resetRect(node, imageAspect) {
    setRect(node, { x: 0, y: 0, w: 1, h: 1 });
    refit(node, imageAspect);
}

// ------------------------------------------------------------ source image

function loadImage(node, src, size) {
    if (!src || node.__mbCropSrc === src) return;
    node.__mbCropSrc = src;

    const img = new Image();
    img.onload = () => {
        node.__mbCropImage = img;
        node.__mbCropSize = size?.width && size?.height
            ? [size.width, size.height]
            : [img.naturalWidth, img.naturalHeight];
        node.__mbCropEditor?.triggerDraw?.();
        resizeToContent(node);
        node.setDirtyCanvas(true, true);
    };
    img.onerror = () => {
        node.__mbCropSrc = null;
    };
    img.src = src;
}

// The preview the node cached the last time it ran. Nothing has been through
// the node before its first run, hence the upstream fallback below.
async function loadFromCache(node) {
    const workflowId = app.graph?.id ?? "default";
    const query = `workflow_id=${encodeURIComponent(workflowId)}&node_id=${encodeURIComponent(node.id)}`;
    try {
        const response = await api.fetchApi(`/mbnodes/crop_source?${query}`);
        const data = await response.json();
        if (!data.image) return false;
        const { filename, subfolder, type } = data.image;
        const params = new URLSearchParams({ filename, subfolder, type, rand: String(Date.now()) });
        loadImage(node, api.apiURL(`/view?${params}`), data);
        return true;
    } catch (e) {
        console.error("[MBNodes] crop source fetch failed", e);
        return false;
    }
}

// Nodes that show a preview of their own (Load Image (MB), Preview Image, …)
// already hold one, so the editor can fill in before the first run.
function upstreamPreview(node) {
    const link = app.graph?.links?.[node.inputs?.[0]?.link];
    const source = link ? app.graph.getNodeById(link.origin_id) : null;
    return source?.imgs?.[0]?.src ?? null;
}

async function refreshSource(node) {
    if (await loadFromCache(node)) return;
    const src = upstreamPreview(node);
    if (src) loadImage(node, src, null);
}

// ------------------------------------------------------------------ widget

function imageAspect(node) {
    const size = node.__mbCropSize;
    return size ? size[0] / size[1] : 1;
}

// The image is letterboxed inside the widget, so the box the user drags is the
// image and nothing else.
function frameOf(widget, widgetWidth, y, height, node) {
    const boxW = Math.max(1, widgetWidth - MARGIN * 2);
    const boxH = Math.max(1, height);
    const aspect = node.__mbCropImage ? imageAspect(node) : boxW / boxH;

    let w = boxW;
    let h = w / aspect;
    if (h > boxH) {
        h = boxH;
        w = h * aspect;
    }
    return { x: MARGIN + (boxW - w) / 2, y: y + (boxH - h) / 2, w, h };
}

const HANDLES = [
    ["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0],
    ["w", 0, 0.5], ["e", 1, 0.5],
    ["sw", 0, 1], ["s", 0.5, 1], ["se", 1, 1],
];

function hitTest(frame, rect, px, py) {
    const rx = frame.x + rect.x * frame.w;
    const ry = frame.y + rect.y * frame.h;
    const rw = rect.w * frame.w;
    const rh = rect.h * frame.h;

    for (const [name, fx, fy] of HANDLES) {
        const hx = rx + fx * rw;
        const hy = ry + fy * rh;
        if (Math.abs(px - hx) <= HANDLE && Math.abs(py - hy) <= HANDLE) return name;
    }
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return "move";
    return "new";
}

// Resize driven by one grip. `ratio` is in fraction space; the edge opposite the
// grip stays put, and a locked ratio grows the box to cover the pointer.
function resizeRect(mode, start, dx, dy, ratio) {
    let { x, y, w, h } = start;
    const right = x + w;
    const bottom = y + h;

    if (mode.includes("w")) { x = Math.min(x + dx, right - MIN_FRACTION); w = right - x; }
    if (mode.includes("e")) { w = Math.max(MIN_FRACTION, w + dx); }
    if (mode.includes("n")) { y = Math.min(y + dy, bottom - MIN_FRACTION); h = bottom - y; }
    if (mode.includes("s")) { h = Math.max(MIN_FRACTION, h + dy); }

    if (ratio !== null) {
        const horizontal = mode === "w" || mode === "e";
        if (horizontal || mode.length === 2) {
            h = w / ratio;
        } else {
            w = h * ratio;
        }
        // Grips keep their anchor; edge grips stay centred on the free axis.
        if (mode.includes("n")) y = bottom - h;
        else if (!mode.includes("s")) y = start.y + start.h / 2 - h / 2;
        if (mode.includes("w")) x = right - w;
        else if (!mode.includes("e")) x = start.x + start.w / 2 - w / 2;
    }

    return { x, y, w, h };
}

// A drag started outside the box draws a fresh one from the press point.
function newRect(anchor, px, py, ratio) {
    let w = Math.abs(px - anchor[0]);
    let h = Math.abs(py - anchor[1]);
    if (ratio !== null) {
        w = Math.max(w, h * ratio);
        h = w / ratio;
    }
    return {
        x: px < anchor[0] ? anchor[0] - w : anchor[0],
        y: py < anchor[1] ? anchor[1] - h : anchor[1],
        w: Math.max(MIN_FRACTION, w),
        h: Math.max(MIN_FRACTION, h),
    };
}

function makeEditorWidget(node) {
    return {
        type: "mb_crop_editor",
        name: "crop_editor",
        // draw() records the geometry it used; mouse() hit tests against the
        // same numbers, so the two agree in either renderer.
        y: 0,
        width: 0,
        frame: null,
        drag: null,
        // The serializer checks widget.serialize, not options.serialize.
        serialize: false,
        options: { serialize: false },

        computeSize(width) {
            const boxW = Math.max(1, (width || node.size[0]) - MARGIN * 2);
            const wanted = node.__mbCropImage ? boxW / imageAspect(node) : boxW * 0.6;
            return [width || node.size[0], Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, wanted))];
        },

        draw(ctx, drawNode, widgetWidth, y, height) {
            this.y = y;
            this.width = widgetWidth || drawNode.size[0];
            const frame = frameOf(this, this.width, y, height, drawNode);
            this.frame = frame;

            const image = drawNode.__mbCropImage;
            ctx.save();

            if (!image) {
                ctx.fillStyle = EMPTY_BG;
                ctx.beginPath();
                ctx.roundRect(frame.x, frame.y, frame.w, frame.h, 6);
                ctx.fill();
                ctx.fillStyle = TEXT;
                ctx.font = "12px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("connect an image and run once", frame.x + frame.w / 2, frame.y + frame.h / 2);
                ctx.restore();
                return;
            }

            ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h);

            const rect = getRect(drawNode);
            const rx = frame.x + rect.x * frame.w;
            const ry = frame.y + rect.y * frame.h;
            const rw = rect.w * frame.w;
            const rh = rect.h * frame.h;

            // Everything outside the crop is dimmed, drawn as four bands so no
            // compositing mode is needed.
            ctx.fillStyle = FILL_OUTSIDE;
            ctx.fillRect(frame.x, frame.y, frame.w, ry - frame.y);
            ctx.fillRect(frame.x, ry + rh, frame.w, frame.y + frame.h - (ry + rh));
            ctx.fillRect(frame.x, ry, rx - frame.x, rh);
            ctx.fillRect(rx + rw, ry, frame.x + frame.w - (rx + rw), rh);

            ctx.strokeStyle = LINE_SOFT;
            ctx.lineWidth = 1;
            for (let i = 1; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(rx + (rw * i) / 3, ry);
                ctx.lineTo(rx + (rw * i) / 3, ry + rh);
                ctx.moveTo(rx, ry + (rh * i) / 3);
                ctx.lineTo(rx + rw, ry + (rh * i) / 3);
                ctx.stroke();
            }

            ctx.strokeStyle = LINE;
            ctx.lineWidth = 2;
            ctx.strokeRect(rx, ry, rw, rh);

            ctx.fillStyle = HANDLE_FILL;
            for (const [, fx, fy] of HANDLES) {
                ctx.fillRect(rx + fx * rw - 3, ry + fy * rh - 3, 6, 6);
            }

            const [sw, sh] = drawNode.__mbCropSize ?? [image.naturalWidth, image.naturalHeight];
            const label = `${Math.max(1, Math.round(rect.w * sw))} x ${Math.max(1, Math.round(rect.h * sh))}`;
            ctx.font = "11px Arial";
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            const textW = ctx.measureText(label).width;
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(frame.x + 4, frame.y + 4, textW + 8, 16);
            ctx.fillStyle = TEXT;
            ctx.fillText(label, frame.x + 8, frame.y + 6);

            ctx.restore();
        },

        // LiteGraph keeps forwarding move/up to whichever widget claimed the
        // pointerdown, which is what makes the drag work.
        mouse(event, pos, mouseNode) {
            const frame = this.frame;
            if (!frame || !mouseNode.__mbCropImage) return false;

            const fx = (pos[0] - frame.x) / frame.w;
            const fy = (pos[1] - frame.y) / frame.h;
            const type = event.type;

            if (type === "pointerdown" || type === "mousedown") {
                const mode = hitTest(frame, getRect(mouseNode), pos[0], pos[1]);
                if (mode === "new" && (fx < -0.05 || fx > 1.05 || fy < -0.05 || fy > 1.05)) {
                    return false; // outside the image altogether, let the node have it
                }
                this.drag = { mode, start: getRect(mouseNode), from: [fx, fy] };
                if (mode === "new") setRect(mouseNode, { x: fx, y: fy, w: MIN_FRACTION, h: MIN_FRACTION });
                this.triggerDraw?.();
                return true;
            }

            if (!this.drag) return false;

            if (type === "pointerup" || type === "mouseup") {
                this.drag = null;
                mouseNode.setDirtyCanvas(true, true);
                return true;
            }

            if (type !== "pointermove" && type !== "mousemove") return false;

            const { mode, start, from } = this.drag;
            const ratio = fractionRatio(mouseNode, imageAspect(mouseNode));
            const dx = fx - from[0];
            const dy = fy - from[1];

            let rect;
            if (mode === "move") {
                rect = { ...start, x: start.x + dx, y: start.y + dy };
            } else if (mode === "new") {
                rect = newRect(from, fx, fy, ratio);
            } else {
                rect = resizeRect(mode, start, dx, dy, ratio);
            }

            setRect(mouseNode, rect);
            // Under Nodes 2.0 the widget owns its own canvas and only repaints
            // when asked; setDirtyCanvas alone is not enough.
            this.triggerDraw?.();
            mouseNode.setDirtyCanvas(true, true);
            return true;
        },
    };
}

// Must run synchronously from nodeCreated: a workflow restores widget values by
// position, so every widget this adds has to already be in place — appended at
// the end, which leaves the indices of the real inputs untouched.
function wireNode(node) {
    for (const name of RECT_WIDGETS) setWidgetVisible(node, name, false);

    const ratio = getWidget(node, "aspect_ratio");
    if (ratio) {
        const prev = ratio.callback;
        ratio.callback = function (...args) {
            const r = prev?.apply(this, args);
            refit(node, imageAspect(node));
            node.__mbCropEditor?.triggerDraw?.();
            node.setDirtyCanvas(true, true);
            return r;
        };
    }

    addButton(node, "Reset crop", () => {
        resetRect(node, imageAspect(node));
        node.__mbCropEditor?.triggerDraw?.();
        node.setDirtyCanvas(true, true);
    });

    const editor = makeEditorWidget(node);
    node.__mbCropEditor = editor;
    node.addCustomWidget(editor);

    resizeToContent(node);
}

app.registerExtension({
    name: "MBNodes.CropImage",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBImageCrop") return;
        wireNode(node);
        setTimeout(() => refreshSource(node), 100);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBImageCrop") return;
        setTimeout(() => refreshSource(node), 200);
    },

    async setup() {
        // A non-output node emits no "executed" event, so the cached source is
        // picked up once the run as a whole is done.
        api.addEventListener("execution_success", () => {
            for (const node of app.graph?._nodes ?? []) {
                if (node.comfyClass === "MBImageCrop") refreshSource(node);
            }
        });
    },
});
