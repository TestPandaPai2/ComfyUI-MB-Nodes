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

// Mirrors snap_axis() in nodes/crop_image_node.py, so the readout on the node
// shows the size that actually comes out.
function snapSpan(span, limit, multiple) {
    const rounded = Math.max(1, Math.round(span));
    if (multiple <= 1 || multiple > limit) return rounded;
    return Math.max(multiple, Math.floor(rounded / multiple) * multiple);
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

// Clamping the two sides on their own is what silently breaks a locked ratio:
// the side that hit the edge gets cut and the other one keeps its length. With
// a ratio in hand the whole box is scaled down instead, so its shape holds.
function fitRatio(rect, ratio) {
    if (ratio === null) return rect;
    let w = Math.max(MIN_FRACTION, rect.w);
    let h = w / ratio;
    if (h > 1) {
        h = 1;
        w = h * ratio;
    }
    if (w > 1) {
        w = 1;
        h = w / ratio;
    }
    return { ...rect, w, h };
}

function setRect(node, rect, ratio = null) {
    const fitted = fitRatio(rect, ratio);
    const w = Math.min(1, Math.max(MIN_FRACTION, fitted.w));
    const h = Math.min(1, Math.max(MIN_FRACTION, fitted.h));
    rect = fitted;
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
    setRect(node, { x: cx - w / 2, y: cy - h / 2, w, h }, ratio);
}

function resetRect(node, imageAspect) {
    setRect(node, { x: 0, y: 0, w: 1, h: 1 });
    refit(node, imageAspect);
}

// A locked ratio is a ratio of pixels, so the same box stops matching when an
// image of a different shape arrives. Called whenever one loads, which also
// repairs a rect saved by an older version that let the box go off-ratio.
function enforceRatio(node) {
    const aspect = imageAspect(node);
    const ratio = fractionRatio(node, aspect);
    if (ratio === null) return;

    const rect = getRect(node);
    if (Math.abs(rect.w / rect.h - ratio) > ratio * 0.005) refit(node, aspect);
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
        enforceRatio(node);
        node.__mbCropEditor?.triggerDraw?.();
        resizeToContent(node);
        node.setDirtyCanvas(true, true);
    };
    // The URL is kept on failure, so the once-a-second watch does not sit there
    // retrying an image that is not there.
    img.onerror = () => {
        node.__mbCropImage = null;
        node.__mbCropEditor?.triggerDraw?.();
        node.setDirtyCanvas(true, true);
    };
    img.src = src;
}

function viewURL(filename, subfolder, type) {
    const params = new URLSearchParams({
        filename,
        subfolder: subfolder ?? "",
        type: type ?? "input",
    });
    return api.apiURL(`/view?${params}`);
}

const IMAGE_FILE = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;
// "name [output]" style annotated paths carry their folder in brackets.
const ANNOTATED = /^(.*?)\s*\[(\w+)\]\s*$/;

// Anything a node already knows about its own image, without running: the
// preview it is drawing, the result of an earlier run still in the output
// store, or — the case that matters on a fresh graph — the file a loader has
// selected in its widget, which is on disk and servable right now.
function nodeImageSrc(node) {
    if (node.imgs?.[0]?.src) return node.imgs[0].src;

    const stored = app.nodeOutputs?.[node.id]?.images?.[0]
        ?? app.nodeOutputs?.[String(node.id)]?.images?.[0];
    if (stored?.filename) return viewURL(stored.filename, stored.subfolder, stored.type ?? "output");

    const widget = node.widgets?.find(
        (w) => typeof w.value === "string" && IMAGE_FILE.test(w.value)
            && (w.name === "image" || w.name === "images")
    );
    if (widget) {
        const match = ANNOTATED.exec(widget.value);
        const [name, type] = match ? [match[1], match[2]] : [widget.value, "input"];
        return viewURL(name, "", type);
    }

    return null;
}

// Reroutes, upscalers and the like hold no image of their own, so the search
// keeps walking back through IMAGE links until it finds a node that does.
function upstreamPreview(node, depth = 0, seen = new Set()) {
    if (!node || depth > 8 || seen.has(node.id)) return null;
    seen.add(node.id);

    if (depth > 0) {
        const src = nodeImageSrc(node);
        if (src) return src;
    }

    for (const input of node.inputs ?? []) {
        if (input.link == null) continue;
        if (depth === 0 && input.name !== "image") continue; // only our own dot
        const link = app.graph?.links?.[input.link];
        if (!link) continue;
        if (link.type && link.type !== "IMAGE" && link.type !== "*") continue;

        const found = upstreamPreview(app.graph.getNodeById(link.origin_id), depth + 1, seen);
        if (found) return found;
    }

    return null;
}

// The preview the node cached the last time it ran. Only reached when nothing
// upstream can hand over an image, e.g. the crop sits behind a sampler on a
// freshly reopened workflow. The run token keeps the URL stable between runs so
// the poll below does not refetch it every second.
async function loadFromCache(node) {
    const workflowId = app.graph?.id ?? "default";
    const query = `workflow_id=${encodeURIComponent(workflowId)}&node_id=${encodeURIComponent(node.id)}`;
    try {
        const response = await api.fetchApi(`/mbnodes/crop_source?${query}`);
        const data = await response.json();
        if (!data.image) return false;
        const { filename, subfolder, type } = data.image;
        const src = `${viewURL(filename, subfolder, type)}&run=${node.__mbCropRun ?? 0}`;
        loadImage(node, src, data);
        return true;
    } catch (e) {
        console.error("[MBNodes] crop source fetch failed", e);
        return false;
    }
}

async function refreshSource(node) {
    const src = upstreamPreview(node);
    if (src) {
        loadImage(node, src, null);
        return;
    }
    // Nothing connected any more: drop the stale image rather than keep
    // offering a crop of something that is no longer the input.
    if (node.inputs?.[0]?.link == null) {
        node.__mbCropSrc = null;
        node.__mbCropImage = null;
        node.__mbCropEditor?.triggerDraw?.();
        node.setDirtyCanvas(true, true);
        return;
    }
    await loadFromCache(node);
}

// Upstream selections change without any event the node can hook — a different
// file picked in a loader, a link rerouted. The walk is cheap and only touches
// the network when the resolved URL actually changed.
function startWatch(node) {
    const timer = setInterval(() => {
        if (!app.graph?.getNodeById?.(node.id)) {
            clearInterval(timer);
            return;
        }
        refreshSource(node);
    }, 1000);

    const onRemoved = node.onRemoved;
    node.onRemoved = function (...args) {
        clearInterval(timer);
        return onRemoved?.apply(this, args);
    };
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

// Every resize holds something still: the edge opposite the grip, or — for a
// grip on an edge with a locked ratio — the centre of the free axis. `at` is
// that fixed coordinate and `side` says which way the box grows from it.
function anchorOf(mode, start, axis) {
    const [low, high, pos, size] = axis === "x"
        ? ["w", "e", start.x, start.w]
        : ["n", "s", start.y, start.h];

    if (mode.includes(low)) return { side: "back", at: pos + size };   // grows left/up
    if (mode.includes(high)) return { side: "front", at: pos };        // grows right/down
    return { side: "center", at: pos + size / 2 };
}

// How far the box may run from its anchor before it leaves the image. A centred
// axis is limited by the nearer of the two edges, hence the doubling.
function room(anchor) {
    if (anchor.side === "front") return 1 - anchor.at;
    if (anchor.side === "back") return anchor.at;
    return 2 * Math.min(anchor.at, 1 - anchor.at);
}

function place(anchor, size) {
    if (anchor.side === "front") return anchor.at;
    if (anchor.side === "back") return anchor.at - size;
    return anchor.at - size / 2;
}

// Fit a wanted width/height around its anchors. Without a ratio each axis is
// capped on its own; with one, both are scaled by the same factor, so the box
// stops at the edge of the image with its shape intact instead of flattening
// into a free crop.
function fitToBounds(w, h, ax, ay, ratio) {
    const maxW = Math.max(MIN_FRACTION, room(ax));
    const maxH = Math.max(MIN_FRACTION, room(ay));

    if (ratio === null) {
        w = Math.min(w, maxW);
        h = Math.min(h, maxH);
    } else {
        const scale = Math.min(1, maxW / w, maxH / h);
        w *= scale;
        h *= scale;
    }

    w = Math.max(MIN_FRACTION, w);
    h = Math.max(MIN_FRACTION, h);
    return { x: place(ax, w), y: place(ay, h), w, h };
}

// Resize driven by one grip. `ratio` is in fraction space; a locked ratio grows
// the box to cover the pointer on whichever axis moved furthest.
function resizeRect(mode, start, dx, dy, ratio) {
    const ax = anchorOf(mode, start, "x");
    const ay = anchorOf(mode, start, "y");

    let w = start.w;
    let h = start.h;
    if (mode.includes("w")) w = start.w - dx;
    else if (mode.includes("e")) w = start.w + dx;
    if (mode.includes("n")) h = start.h - dy;
    else if (mode.includes("s")) h = start.h + dy;

    w = Math.max(MIN_FRACTION, w);
    h = Math.max(MIN_FRACTION, h);

    if (ratio !== null) {
        // A corner follows the axis the pointer pushed harder; an edge grip
        // only has the one axis to go on.
        if (mode.length === 2) w = Math.max(w, h * ratio);
        else if (mode === "n" || mode === "s") w = h * ratio;
        h = w / ratio;
    }

    return fitToBounds(w, h, ax, ay, ratio);
}

// A drag started outside the box draws a fresh one from the press point, which
// is the corner that stays put.
function newRect(anchor, px, py, ratio) {
    const ax = { side: px < anchor[0] ? "back" : "front", at: anchor[0] };
    const ay = { side: py < anchor[1] ? "back" : "front", at: anchor[1] };

    let w = Math.abs(px - anchor[0]);
    let h = Math.abs(py - anchor[1]);
    if (ratio !== null) {
        w = Math.max(w, h * ratio);
        h = w / ratio;
    }

    return fitToBounds(w, h, ax, ay, ratio);
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
                const hint = drawNode.inputs?.[0]?.link == null
                    ? "connect an image"
                    : "no preview yet — run once";
                ctx.fillText(hint, frame.x + frame.w / 2, frame.y + frame.h / 2);
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
            const step = Number(getWidget(drawNode, "divisible_by")?.value ?? 1) || 1;
            const label = `${snapSpan(rect.w * sw, sw, step)} x ${snapSpan(rect.h * sh, sh, step)}`;
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
                if (mode === "new") {
                    const ratio = fractionRatio(mouseNode, imageAspect(mouseNode));
                    setRect(mouseNode, { x: fx, y: fy, w: MIN_FRACTION, h: MIN_FRACTION }, ratio);
                }
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

            setRect(mouseNode, rect, ratio);
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

    for (const name of ["aspect_ratio", "divisible_by"]) {
        const widget = getWidget(node, name);
        if (!widget) continue;
        const prev = widget.callback;
        widget.callback = function (...args) {
            const r = prev?.apply(this, args);
            // Only the aspect changes the box; the divisor just changes the
            // size that is reported for it.
            if (name === "aspect_ratio") refit(node, imageAspect(node));
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

    // Connecting or rerouting the input dot should show the new image at once,
    // ahead of the next tick of the watch.
    const onConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function (...args) {
        const r = onConnectionsChange?.apply(this, args);
        refreshSource(node);
        return r;
    };

    resizeToContent(node);
}

app.registerExtension({
    name: "MBNodes.CropImage",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBImageCrop") return;
        wireNode(node);
        setTimeout(() => {
            refreshSource(node);
            startWatch(node);
        }, 100);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBImageCrop") return;
        setTimeout(() => refreshSource(node), 200);
    },

    async setup() {
        // A non-output node emits no "executed" event, so the cached source is
        // picked up once the run as a whole is done. The token makes that a new
        // URL, which is what gets the fresh copy past the browser cache.
        api.addEventListener("execution_success", () => {
            for (const node of app.graph?._nodes ?? []) {
                if (node.comfyClass !== "MBImageCrop") continue;
                node.__mbCropRun = (node.__mbCropRun ?? 0) + 1;
                refreshSource(node);
            }
        });
    },
});
