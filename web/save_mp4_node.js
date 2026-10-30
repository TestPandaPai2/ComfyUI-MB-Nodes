import { app } from "../../scripts/app.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";

function audioConnected(node) {
    const slot = node.inputs?.find((i) => i.name === "audio");
    return !!slot && slot.link !== null && slot.link !== undefined;
}

function refresh(node) {
    const preview = getWidget(node, "preview_only")?.value === true;

    let changed = false;
    // Preview encodes to the temp folder, so the save target is meaningless.
    for (const name of ["format", "codec", "preset", "filename_prefix", "output_folder"]) {
        changed = setWidgetVisible(node, name, !preview) || changed;
    }
    changed = setWidgetVisible(node, "trim_to_audio", audioConnected(node)) || changed;

    if (changed) resizeToContent(node);
}

// Own player instead of the stock preview: one clean video box, no image strip.
function ensurePlayer(node) {
    if (node.mbPlayer) return node.mbPlayer;

    const wrap = document.createElement("div");
    wrap.style.cssText =
        "display:flex;flex-direction:column;gap:4px;width:100%;height:100%;box-sizing:border-box;padding:4px;";

    const video = document.createElement("video");
    video.controls = true;
    video.loop = true;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.cssText =
        "flex:1;min-height:0;width:100%;object-fit:contain;background:#000;border-radius:6px;";

    const caption = document.createElement("div");
    caption.style.cssText =
        "font-size:11px;opacity:0.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;";

    wrap.append(video, caption);
    wrap.style.display = "none";

    const widget = node.addDOMWidget("mb_player", "mb_player", wrap, { serialize: false, hideOnZoom: false });
    widget.computeSize = (width) => [width, wrap.style.display === "none" ? 0 : Math.max(200, width * 0.6)];

    video.addEventListener("loadedmetadata", () => {
        caption.textContent += `  ·  ${video.videoWidth}×${video.videoHeight}  ·  ${video.duration.toFixed(1)}s`;
    });

    node.mbPlayer = { wrap, video, caption };
    return node.mbPlayer;
}

function showVideo(node, file) {
    const { wrap, video, caption } = ensurePlayer(node);
    const params = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder, type: file.type });
    video.src = `/view?${params}&t=${Date.now()}`;
    caption.textContent = file.filename;
    wrap.style.display = "flex";
    resizeToContent(node);
}

function wireNode(node) {
    const prevOnExecuted = node.onExecuted;
    node.onExecuted = function (message) {
        prevOnExecuted?.apply(this, arguments);
        const file = message?.mb_video?.[0];
        if (file) showVideo(this, file);
    };

    const prevOnConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function (type, slotIndex, connected, link, ioSlot) {
        prevOnConnectionsChange?.apply(this, arguments);
        if (type === 1) refresh(this); // 1 = LiteGraph.INPUT
    };

    const w = getWidget(node, "preview_only");
    if (w) {
        const prev = w.callback;
        w.callback = function (...args) {
            const r = prev?.apply(this, args);
            refresh(node);
            return r;
        };
    }

    refresh(node);
}

app.registerExtension({
    name: "MBNodes.SaveMP4",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBSaveMP4") return;
        wireNode(node);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBSaveMP4") return;
        setTimeout(() => refresh(node), 40);
    },
});
