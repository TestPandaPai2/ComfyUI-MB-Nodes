import { app } from "../../scripts/app.js";
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

// The image widget's preview lives in node.imgs; its natural size is the source
// resolution, so the readout can be computed without touching the backend.
function sourceSize(node) {
    const img = node.imgs?.[0];
    if (!img?.naturalWidth) return null;
    return [img.naturalWidth, img.naturalHeight];
}

function updateInfo(node) {
    const info = node.__mbInfoWidget;
    if (!info) return;

    const size = sourceSize(node);
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

function wireNode(node) {
    const info = node.addWidget("text", "output", "no image loaded", () => {}, {
        serialize: false,
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
            // The preview image loads asynchronously after the widget changes.
            setTimeout(() => updateInfo(node), 60);
            return r;
        };
    }

    // node.imgs is replaced whenever a new preview finishes loading.
    let lastImg = null;
    const prevDraw = node.onDrawBackground;
    node.onDrawBackground = function (ctx) {
        const r = prevDraw?.apply(this, arguments);
        if (this.imgs?.[0] !== lastImg) {
            lastImg = this.imgs?.[0] ?? null;
            updateInfo(this);
        }
        return r;
    };

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
