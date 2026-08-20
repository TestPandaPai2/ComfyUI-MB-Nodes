import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, addButton, resizeToContent } from "./common.js";
import { openDialog } from "./dialog.js";
import {
    MIN_FRACTION, snapSpan, fractionRatio, normalizeRect, refitRect,
    resizeRect, newRect, frameOf, hitTest, drawCrop,
} from "./crop_geometry.js";

// The crop rect lives in these four widgets as fractions of the image, so it
// stays valid whatever resolution turns up on the input dot. Along with the
// aspect/divisor widgets, they are hidden from the node body and edited only
// inside the crop dialog.
const RECT_WIDGETS = ["crop_x", "crop_y", "crop_width", "crop_height"];
const DIALOG_WIDGETS = ["aspect_ratio", "divisible_by", ...RECT_WIDGETS];

// Keyed the same as RATIOS in nodes/crop_image_node.py.
const RATIO_OPTIONS = [
    "free", "source",
    "1:1", "4:3", "3:2", "16:10", "16:9", "1.85:1", "2:1", "21:9",
    "3:4", "2:3", "10:16", "9:16", "1:1.85", "1:2", "9:21",
];
const DIVISOR_OPTIONS = ["1", "8", "16", "32", "64"];

const DIALOG_WIDTH = 1000;
const CANVAS_W = 940;
const CANVAS_H = 600;
const EMPTY_BG = "#0d0d0d";

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
    };
    // The URL is kept on failure, so the once-a-second watch does not sit there
    // retrying an image that is not there.
    img.onerror = () => {
        node.__mbCropImage = null;
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

// ------------------------------------------------------------- crop dialog

function openCropDialog(node) {
    const image = node.__mbCropImage;
    if (!image) {
        alert(node.inputs?.[0]?.link == null ? "Connect an image first." : "No preview yet — run once.");
        return;
    }

    const [imgW, imgH] = node.__mbCropSize ?? [image.naturalWidth, image.naturalHeight];
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
        const step = Number(divisor) || 1;
        const label = `${snapSpan(rect.w * imgW, imgW, step)} x ${snapSpan(rect.h * imgH, imgH, step)}`;
        drawCrop(ctx, frame, image, rect, label);
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
            node.setDirtyCanvas(true, true);
        },
    });
}

// ------------------------------------------------------------------ widget

// Must run synchronously from nodeCreated: a workflow restores widget values by
// position, so every widget this adds has to already be in place — appended at
// the end, which leaves the indices of the real inputs untouched.
function wireNode(node) {
    for (const name of DIALOG_WIDGETS) setWidgetVisible(node, name, false);

    addButton(node, "Crop Image", () => openCropDialog(node));

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
