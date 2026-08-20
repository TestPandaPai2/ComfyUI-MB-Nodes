import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, setWidgetVisible, resizeToContent } from "./common.js";

const PLAYER_HEIGHT = 40;

// Hidden until save mode is on — matches the "buttons/preview only, options
// only when needed" style the other MB save nodes use.
const SAVE_WIDGETS = ["format", "quality", "filename", "filename_prefix", "output_folder"];

const AUDIO_FILE = /\.(wav|mp3|flac|ogg|opus|m4a|aac|webm)$/i;
// "name [output]" style annotated paths carry their folder in brackets.
const ANNOTATED = /^(.*?)\s*\[(\w+)\]\s*$/;

function viewURL(filename, subfolder, type) {
    const params = new URLSearchParams({ filename, subfolder: subfolder ?? "", type: type ?? "output" });
    return api.apiURL(`/view?${params}`);
}

// <audio>.volume tops out at 1 (100%); the widget's range above that exists
// for consistency with a "percent" label but has nothing left to give here.
function applyVolume(node) {
    const audio = node.__mbAudioEl;
    if (!audio) return;
    const pct = Number(getWidget(node, "volume")?.value ?? 100);
    audio.volume = Math.min(1, Math.max(0, pct / 100));
}

function setSrc(node, src) {
    if (!src || node.__mbAudioSrc === src) return;
    node.__mbAudioSrc = src;
    if (node.__mbAudioEl) node.__mbAudioEl.src = src;
}

// Anything a node already knows about its own audio, without running: the
// result of an earlier run still in the output store, or — the case that
// matters on a fresh graph — the file a loader has already picked in its
// widget, which is on disk and servable right now.
function nodeAudioSrc(node) {
    const stored = app.nodeOutputs?.[node.id]?.audio?.[0]
        ?? app.nodeOutputs?.[String(node.id)]?.audio?.[0];
    if (stored?.filename) return viewURL(stored.filename, stored.subfolder, stored.type ?? "output");

    const widget = node.widgets?.find(
        (w) => typeof w.value === "string" && AUDIO_FILE.test(w.value)
            && (w.name === "audio" || w.name === "audio_file")
    );
    if (widget) {
        const match = ANNOTATED.exec(widget.value);
        const [name, type] = match ? [match[1], match[2]] : [widget.value, "input"];
        return viewURL(name, "", type);
    }

    return null;
}

// Reroutes and the like hold no audio of their own, so the search keeps
// walking back through AUDIO links until it finds a node that does.
function upstreamAudioSrc(node, depth = 0, seen = new Set()) {
    if (!node || depth > 8 || seen.has(node.id)) return null;
    seen.add(node.id);

    if (depth > 0) {
        const src = nodeAudioSrc(node);
        if (src) return src;
    }

    for (const input of node.inputs ?? []) {
        if (input.link == null) continue;
        if (depth === 0 && input.name !== "audio") continue; // only our own dot
        const link = app.graph?.links?.[input.link];
        if (!link) continue;
        if (link.type && link.type !== "AUDIO" && link.type !== "*") continue;

        const found = upstreamAudioSrc(app.graph.getNodeById(link.origin_id), depth + 1, seen);
        if (found) return found;
    }

    return null;
}

// The preview the node cached the last time it ran. Only reached when nothing
// upstream can hand over audio directly, e.g. the node sits behind a
// generator on a freshly reopened workflow. The run token keeps the URL
// stable between runs so this does not refetch it every second.
async function loadFromCache(node) {
    const workflowId = app.graph?.id ?? "default";
    const query = `workflow_id=${encodeURIComponent(workflowId)}&node_id=${encodeURIComponent(node.id)}`;
    try {
        const response = await api.fetchApi(`/mbnodes/preview_audio_source?${query}`);
        const data = await response.json();
        if (!data.audio) return;
        const { filename, subfolder, type } = data.audio;
        setSrc(node, `${viewURL(filename, subfolder, type)}&run=${node.__mbAudioRun ?? 0}`);
    } catch (e) {
        console.error("[MBNodes] preview audio fetch failed", e);
    }
}

async function refreshSource(node) {
    const src = upstreamAudioSrc(node);
    if (src) {
        setSrc(node, src);
        return;
    }
    if (node.inputs?.[0]?.link == null) {
        node.__mbAudioSrc = null;
        if (node.__mbAudioEl) node.__mbAudioEl.removeAttribute("src");
        return;
    }
    await loadFromCache(node);
}

// Upstream selections change without any event the node can hook — a
// different file picked in a loader, a link rerouted. The walk is cheap and
// only touches the network when the resolved URL actually changed.
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

function updateSaveWidgets(node) {
    const on = getWidget(node, "save_to_file")?.value === true;
    let changed = false;
    for (const name of SAVE_WIDGETS) changed = setWidgetVisible(node, name, on) || changed;
    if (changed) resizeToContent(node);
}

function wireNode(node) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.style.width = "100%";
    audio.style.height = `${PLAYER_HEIGHT}px`;
    node.__mbAudioEl = audio;

    node.addDOMWidget("mb_audio_player", "mb_audio_player", audio, {
        serialize: false,
        hideOnZoom: false,
        getHeight: () => PLAYER_HEIGHT,
    });

    const volumeWidget = getWidget(node, "volume");
    if (volumeWidget) {
        const prev = volumeWidget.callback;
        volumeWidget.callback = function (...args) {
            const r = prev?.apply(this, args);
            applyVolume(node);
            return r;
        };
    }

    const saveWidget = getWidget(node, "save_to_file");
    if (saveWidget) {
        const prev = saveWidget.callback;
        saveWidget.callback = function (...args) {
            const r = prev?.apply(this, args);
            updateSaveWidgets(node);
            return r;
        };
    }

    // Connecting or rerouting the input dot should show the new audio at
    // once, ahead of the next tick of the watch.
    const onConnectionsChange = node.onConnectionsChange;
    node.onConnectionsChange = function (...args) {
        const r = onConnectionsChange?.apply(this, args);
        refreshSource(node);
        return r;
    };

    updateSaveWidgets(node);
    applyVolume(node);
    resizeToContent(node);
}

app.registerExtension({
    name: "MBNodes.PreviewAudio",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPreviewAudio") return;
        wireNode(node);
        setTimeout(() => {
            refreshSource(node);
            startWatch(node);
        }, 100);
    },

    async loadedGraphNode(node) {
        if (node.comfyClass !== "MBPreviewAudio") return;
        updateSaveWidgets(node);
        applyVolume(node);
        setTimeout(() => refreshSource(node), 200);
    },

    async setup() {
        // A non-output node emits no "executed" event, so the cached source is
        // picked up once the run as a whole is done. The token makes that a
        // new URL, which is what gets the fresh copy past the browser cache.
        api.addEventListener("execution_success", () => {
            for (const node of app.graph?._nodes ?? []) {
                if (node.comfyClass !== "MBPreviewAudio") continue;
                node.__mbAudioRun = (node.__mbAudioRun ?? 0) + 1;
                refreshSource(node);
            }
        });
    },
});
