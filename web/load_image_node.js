import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, resizeToContent } from "./common.js";

const SNAP = 8; // must match SNAP in nodes/load_image_node.py

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

// The selected file is loaded straight from /view to read its natural size.
// node.imgs is not used for this: the Nodes 2.0 renderer draws previews from the
// node output store rather than off the canvas, so it is not reliably populated.
const sizeCache = new Map();

function measure(filename) {
    if (!filename) return Promise.resolve(null);
    if (sizeCache.has(filename)) return Promise.resolve(sizeCache.get(filename));

    // "name [output]" style annotated paths carry their folder in brackets.
    const match = /^(.*?)\s*\[(\w+)\]\s*$/.exec(filename);
    const [name, type] = match ? [match[1], match[2]] : [filename, "input"];
    const query = new URLSearchParams({ filename: name, subfolder: "", type });

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const size = [img.naturalWidth, img.naturalHeight];
            sizeCache.set(filename, size);
            resolve(size);
        };
        img.onerror = () => resolve(null);
        img.src = api.apiURL(`/view?${query}`);
    });
}

function render(node, size) {
    const info = node.__mbInfoWidget;
    if (!info) return;

    if (!size) {
        info.value = "no image loaded";
        node.setDirtyCanvas(true, false);
        return;
    }

    const [w, h] = size;
    const resize = getWidget(node, "resize")?.value === true;
    const mp = parseFloat(getWidget(node, "megapixels")?.value ?? "1.0");
    const [outW, outH] = resize ? targetSize(w, h, mp) : [w, h];

    const megapixels = ((outW * outH) / 1e6).toFixed(2);
    const prefix = resize && (outW !== w || outH !== h) ? `${w}x${h} -> ` : "";
    info.value = `${prefix}${outW}x${outH}  ${aspectRatio(outW, outH)}  ${megapixels} MP`;
    node.setDirtyCanvas(true, false);
}

async function updateInfo(node) {
    render(node, await measure(getWidget(node, "image")?.value));
}

function wireNode(node) {
    const info = node.addWidget("text", "output", "no image loaded", () => {}, {
        serialize: false,
        // disabled is what the canvas renderer reads, read_only what Nodes 2.0 does.
        disabled: true,
        read_only: true,
    });
    info.disabled = true; // read-only readout
    info.serialize = false; // the serializer checks this, not options.serialize
    node.__mbInfoWidget = info;
    resizeToContent(node); // the node was sized before the readout existed

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
    name: "MBNodes.LoadImage",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBLoadImage") return;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBLoadImage") return;
        setTimeout(() => updateInfo(node), 100);
    },
});
