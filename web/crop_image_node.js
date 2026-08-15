import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, addButton, resizeToContent } from "./common.js";
import {
    MIN_FRACTION, HANDLES, snapSpan, fractionRatio, normalizeRect, refitRect,
    offRatio, resizeRect, newRect, frameOf, hitTest, drawCrop,
} from "./crop_geometry.js";

// The crop rect lives in these four widgets as fractions of the image, so it
// stays valid whatever resolution turns up on the input dot.
const RECT_WIDGETS = ["crop_x", "crop_y", "crop_width", "crop_height"];

const MARGIN = 15;      // matches the inset LiteGraph uses for its own widgets
const MIN_HEIGHT = 140; // the editor never collapses below this
const MAX_HEIGHT = 420;

const EMPTY_BG = "#1a1a1a";
const TEXT = "#dcdcdc";

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

function setRect(node, rect, ratio = null) {
    const values = normalizeRect(rect, ratio);
    const named = {
        crop_x: values.x,
        crop_y: values.y,
        crop_width: values.w,
        crop_height: values.h,
    };
    for (const [name, value] of Object.entries(named)) {
        const widget = getWidget(node, name);
        if (widget) widget.value = value;
    }
}

// Target aspect in fraction space, or null when the box is unconstrained.
function ratioOf(node, aspect) {
    return fractionRatio(getWidget(node, "aspect_ratio")?.value ?? "free", aspect);
}

function refit(node, imageAspect) {
    const ratio = ratioOf(node, imageAspect);
    if (ratio === null) return;
    setRect(node, refitRect(getRect(node), ratio), ratio);
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
    const ratio = ratioOf(node, aspect);
    if (offRatio(getRect(node), ratio)) refit(node, aspect);
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
            const image = drawNode.__mbCropImage;
            const frame = frameOf(
                MARGIN, y, this.width - MARGIN * 2, height,
                image ? imageAspect(drawNode) : 0
            );
            this.frame = frame;

            if (!image) {
                ctx.save();
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

            const rect = getRect(drawNode);
            const [sw, sh] = drawNode.__mbCropSize ?? [image.naturalWidth, image.naturalHeight];
            const step = Number(getWidget(drawNode, "divisible_by")?.value ?? 1) || 1;
            const label = `${snapSpan(rect.w * sw, sw, step)} x ${snapSpan(rect.h * sh, sh, step)}`;
            drawCrop(ctx, frame, image, rect, label);
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
                    const ratio = ratioOf(mouseNode, imageAspect(mouseNode));
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
            const ratio = ratioOf(mouseNode, imageAspect(mouseNode));
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
