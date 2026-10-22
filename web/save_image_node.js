import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, resizeToContent, accentColor } from "./common.js";

// Widgets that only matter for one format, so the node stays readable.
const FORMAT_WIDGETS = {
    png: ["png_compress_level"],
    jpg: ["quality"],
    webp: ["quality", "webp_lossless"],
    avif: ["quality"],
};
const OPTIONAL = ["quality", "png_compress_level", "webp_lossless"];
// Changing any of these re-encodes the cached run for the live preview.
const ENCODE_WIDGETS = ["format", "preset", ...OPTIONAL];

function refresh(node) {
    const format = getWidget(node, "format")?.value ?? "png";
    const mode = getWidget(node, "mode")?.value ?? "save";
    const custom = (getWidget(node, "preset")?.value ?? "custom") === "custom";
    const shown = new Set(custom ? FORMAT_WIDGETS[format] ?? [] : []);

    let changed = false;
    for (const name of OPTIONAL) {
        changed = setWidgetVisible(node, name, shown.has(name)) || changed;
    }
    // Nothing is written to the save folder in preview mode.
    for (const name of ["filename_prefix", "output_folder"]) {
        changed = setWidgetVisible(node, name, mode !== "preview") || changed;
    }

    if (changed) resizeToContent(node);
}

// The node output store keeps two copies of every result: app.nodeOutputs, which
// the canvas renderer reads, and a reactive one that Nodes 2.0 renders from.
// Writing app.nodeOutputs directly only fills the first, so the output is fed
// in through the same "executed" event the backend uses, which fills both and
// also reaches onExecuted below.
function publishOutputs(node, output) {
    const id = String(node.id);
    api.dispatchEvent(
        new CustomEvent("executed", {
            detail: { node: id, display_node: id, output },
        })
    );
}

function cacheQuery(node) {
    return { workflow_id: app.graph?.id ?? "default", node_id: String(node.id) };
}

// After a restart there is no execution history, so the node asks the backend
// for the copy it cached in output/MBNodesCache the last time it ran.
async function restorePreview(node) {
    if (node.imgs?.length || node.mbCompare?.after.length) return;

    const query = new URLSearchParams(cacheQuery(node)).toString();
    try {
        const response = await api.fetchApi(`/mbnodes/preview_cache?${query}`);
        const data = await response.json();
        if (!data.mb_stats?.length || node.imgs?.length) return;

        publishOutputs(node, data);
        node.setDirtyCanvas(true, true);
    } catch (e) {
        console.error("[MBNodes] preview cache restore failed", e);
    }
}

// Live preview: once the node has a cached run, changing the encode settings
// re-encodes it on the backend and swaps the preview and size badge in place.
async function reencode(node) {
    if (!node.mbHasRun) return;
    const body = { ...cacheQuery(node) };
    for (const name of ENCODE_WIDGETS) body[name] = getWidget(node, name)?.value;

    try {
        const response = await api.fetchApi("/mbnodes/save_image/reencode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? response.statusText);
        if (data.mb_stats?.length) publishOutputs(node, data);
    } catch (e) {
        console.error("[MBNodes] live re-encode failed", e);
    }
}

function scheduleReencode(node) {
    clearTimeout(node.mbReencodeTimer);
    node.mbReencodeTimer = setTimeout(() => reencode(node), 300);
}

function imageUrl(image) {
    const params = new URLSearchParams({
        filename: image.filename,
        subfolder: image.subfolder,
        type: image.type,
        rand: Math.random(), // the re-encode reuses file names, so skip the browser cache
    });
    return api.apiURL(`/view?${params}`);
}

function formatBytes(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function statsText(stats, index) {
    const s = stats[index];
    if (!s) return "";
    let text = `${s.format} · ${formatBytes(s.bytes)}`;
    if (s.format !== "png" && s.png_bytes) {
        const saved = Math.round((1 - s.bytes / s.png_bytes) * 100);
        text += ` · ${saved >= 0 ? "−" : "+"}${Math.abs(saved)}% vs png`;
    }
    if (stats.length > 1) text += ` · ${index + 1} / ${stats.length}`;
    return text;
}

function ensureBadge(node) {
    if (node.mbBadge) return node.mbBadge;
    const badge = document.createElement("div");
    badge.style.cssText = "font-size:11px;opacity:0.75;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    const widget = node.addDOMWidget("mb_size_badge", "mb_size_badge", badge, { serialize: false, hideOnZoom: false });
    widget.computeSize = (width) => [width, 18];
    node.mbBadge = badge;
    resizeToContent(node);
    return badge;
}

// Before/after slider: the compare image underneath, the node's image on top,
// clipped at the mouse. Click steps through a batch.
function renderCompare(state) {
    const { before, after, index, imgBefore, imgAfter } = state;
    imgBefore.src = before[index % before.length] ?? "";
    imgAfter.src = after[index] ?? "";
}

function setSplit(state, fraction) {
    state.split = Math.min(1, Math.max(0, fraction));
    const percent = `${state.split * 100}%`;
    state.imgAfter.style.clipPath = `inset(0 0 0 ${percent})`;
    state.line.style.left = percent;
}

const COMPARE_MIN_H = 160;
const PREVIEW_MIN_H = 80;
const STOCK_PREVIEW = "$$canvas-image-preview"; // the frontend's own image preview widget
const SIZE_LABEL_H = 15; // the frontend's "W × H" line under its preview

// The image the preview shows and how its box relates to the node: padX is
// node width minus box width, padY is widget height minus box height.
// null while there is nothing to keep in proportion (no image, or a batch
// shown as a grid).
function aspectTarget(node) {
    const compare = node.mbCompare;
    const compareWidget = node.widgets?.find((w) => w.name === "mb_compare");
    if (compare && compareWidget && !compareWidget.hidden) {
        const { naturalWidth: iw, naturalHeight: ih } = compare.imgAfter;
        if (!iw || !ih) return null;
        return { widget: compareWidget, iw, ih, padX: node.mbPadX ?? 20, padY: node.mbPadY ?? 0 };
    }
    const widget = node.widgets?.find((w) => w.name === STOCK_PREVIEW);
    const imgs = node.imgs;
    if (!widget || !imgs?.length) return null;
    const image = imgs[imgs.length === 1 ? 0 : node.imageIndex];
    if (!image?.naturalWidth) return null;
    const label = app.extensionManager?.setting?.get("Comfy.Node.AllowImageSizeDraw") ? SIZE_LABEL_H : 0;
    return { widget, iw: image.naturalWidth, ih: image.naturalHeight, padX: 0, padY: label };
}

// Height follows width while the node is resized, so the preview box always
// has the image's shape and no empty bars.
function lockAspect(node, size) {
    const target = aspectTarget(node);
    if (!target || node.mbChrome == null) return;
    const boxH = Math.max(PREVIEW_MIN_H, ((size[0] - target.padX) * target.ih) / target.iw);
    size[1] = Math.round(node.mbChrome + boxH + target.padY);
}

// Measured after layout: everything above and below the preview (mbChrome),
// and the compare box's inset inside its widget. A new image shape snaps the
// node to it once.
function trackLayout(node) {
    const target = aspectTarget(node);
    if (!target?.widget.computedHeight) return;
    node.mbChrome = node.size[1] - target.widget.computedHeight;
    const root = node.mbCompare?.root;
    if (target.widget.name === "mb_compare" && root?.clientWidth) {
        node.mbPadX = node.size[0] - root.clientWidth;
        node.mbPadY = target.widget.computedHeight - root.clientHeight;
    }
    const shape = `${target.iw}x${target.ih}`;
    if (node.mbLockedTo !== shape) {
        node.mbLockedTo = shape;
        node.setSize([node.size[0], node.size[1]]);
        node.setDirtyCanvas(true, true);
    }
}

function ensureCompare(node) {
    if (node.mbCompare) return node.mbCompare;

    // `root` fills the widget area; `frame` is the image's own box inside it,
    // shaped to the image's aspect ratio so the checkerboard and the split
    // line cover the image and nothing beside it.
    const root = document.createElement("div");
    root.style.cssText =
        "width:100%;height:100%;min-height:160px;display:flex;align-items:center;justify-content:center;container-type:size;";
    const frame = document.createElement("div");
    frame.style.cssText =
        "position:relative;width:100%;height:100%;overflow:hidden;cursor:ew-resize;" +
        "background:repeating-conic-gradient(#8884 0% 25%, transparent 0% 50%) 50% / 16px 16px;";
    const layer = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;";
    const imgBefore = document.createElement("img");
    const imgAfter = document.createElement("img");
    imgBefore.style.cssText = layer;
    imgAfter.style.cssText = layer;
    const line = document.createElement("div");
    line.style.cssText = `position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;pointer-events:none;background:${accentColor()};`;
    frame.append(imgBefore, imgAfter, line);
    root.append(frame);

    const state = { root, imgBefore, imgAfter, line, before: [], after: [], index: 0, split: 0.5 };
    imgAfter.addEventListener("load", () => {
        const { naturalWidth: w, naturalHeight: h } = imgAfter;
        if (w && h) {
            frame.style.aspectRatio = `${w} / ${h}`;
            frame.style.width = `min(100cqw, calc(100cqh * ${w / h}))`;
            frame.style.height = "auto";
        }
        node.setDirtyCanvas(true, true);
    });
    frame.addEventListener("pointermove", (e) => {
        const rect = frame.getBoundingClientRect();
        if (rect.width) setSplit(state, (e.clientX - rect.left) / rect.width);
    });
    frame.addEventListener("click", () => {
        if (state.after.length < 2) return;
        state.index = (state.index + 1) % state.after.length;
        renderCompare(state);
        if (node.mbBadge) node.mbBadge.textContent = statsText(node.mbStats ?? [], state.index);
    });

    // No computeSize: a fixed height there keeps the frontend from handing the
    // widget the node's spare height, so the preview never grew with the node.
    const widget = node.addDOMWidget("mb_compare", "mb_compare", root, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => COMPARE_MIN_H,
    });
    setSplit(state, 0.5);
    node.mbCompare = state;
    return state;
}

function showCompare(node, visible) {
    if (!node.mbCompare && !visible) return;
    const state = ensureCompare(node);
    state.root.style.display = visible ? "" : "none";
    if (setWidgetVisible(node, "mb_compare", visible)) resizeToContent(node);
}

function onOutput(node, message) {
    const stats = message?.mb_stats;
    if (!stats?.length) return;
    node.mbHasRun = true;
    node.mbStats = stats;

    const compare = message.mb_compare_images;
    if (compare?.length) {
        // The stock preview gets no "images" in compare mode; clear what an
        // earlier plain run left on the canvas.
        node.imgs = undefined;
        const state = ensureCompare(node);
        state.before = compare.map(imageUrl);
        state.after = (message.mb_images ?? []).map(imageUrl);
        state.index = Math.min(state.index, Math.max(0, state.after.length - 1));
        renderCompare(state);
        showCompare(node, true);
        ensureBadge(node).textContent = statsText(stats, state.index);
    } else {
        showCompare(node, false);
        ensureBadge(node).textContent = statsText(stats, 0);
    }
    node.setDirtyCanvas(true, true);
}

function wireNode(node) {
    for (const name of ENCODE_WIDGETS.concat("mode")) {
        const w = getWidget(node, name);
        if (!w) continue;
        const prev = w.callback;
        w.callback = function (...args) {
            const r = prev?.apply(this, args);
            refresh(node);
            if (name !== "mode") scheduleReencode(node);
            return r;
        };
    }
    refresh(node);
}

app.registerExtension({
    name: "MBNodes.SaveImage",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MBSaveImage") return;
        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);
            onOutput(this, message);
        };

        const onResize = nodeType.prototype.onResize;
        nodeType.prototype.onResize = function (size) {
            const r = onResize?.apply(this, arguments);
            lockAspect(this, size);
            return r;
        };

        const onDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function () {
            const r = onDrawForeground?.apply(this, arguments);
            trackLayout(this);
            return r;
        };
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "MBSaveImage") return;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBSaveImage") return;
        setTimeout(() => {
            refresh(node);
            restorePreview(node);
        }, 60);
    },
});
