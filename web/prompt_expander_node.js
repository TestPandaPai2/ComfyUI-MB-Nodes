// MB Prompt Expander: the model dropdown lists what Ollama has installed, and system
// prompt presets live in the right-click menu. Presets save to the same folder as MB Text Generate.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, notify, resizeToContent } from "./common.js";
import { openPresetEditor, openPresetList } from "./text_generate_node.js";

// Workflows saved with the old preset and preset_name widgets.
const OLD_WIDGET_COUNT = 11;
const OLD_WIDGETS = [1, 3];

async function loadPresets(node, event, menu) {
    let extra = [];
    try {
        const data = await (await api.fetchApi("/mbnodes/expander_presets")).json();
        extra = Object.entries({ ...data.builtin, ...data.custom });
    } catch (e) {
        notify("error", "Presets not loaded", e?.message ?? String(e));
    }
    openPresetList(node, event, menu, extra);
}

// Keeps the current model in the list, so a missing one stays selected and a
// stopped Ollama changes nothing.
async function refreshModels(node) {
    const widget = getWidget(node, "model");
    if (!widget) return;
    const url = getWidget(node, "url")?.value ?? "";
    let models = [];
    try {
        const response = await api.fetchApi(`/mbnodes/ollama_models?url=${encodeURIComponent(url)}`);
        if (response.ok) models = (await response.json()).models ?? [];
    } catch (e) {
        console.warn("[MBNodes] Ollama model list not loaded", e);
    }
    widget.options.values = models.includes(widget.value) ? models : [widget.value, ...models];
    node.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "MBNodes.PromptExpander",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MBPromptExpander") return;

        const configure = nodeType.prototype.configure;
        nodeType.prototype.configure = function (info) {
            if (info.widgets_values?.length === OLD_WIDGET_COUNT) {
                info.widgets_values = info.widgets_values.filter((_, i) => !OLD_WIDGETS.includes(i));
            }
            const values = info.widgets_values;
            // Workflows saved with model after url.
            if (/^https?:\/\//.test(values?.[2])) values.unshift(values.splice(3, 1)[0]);
            const result = configure.call(this, info);
            refreshModels(this);
            return result;
        };

        const prev = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            prev?.apply(this, arguments);
            options.push(
                null,
                { content: "Save System Prompt as Preset…", callback: () => openPresetEditor(this) },
                { content: "Load System Prompt Preset", has_submenu: true, callback: (v, o, event, menu) => loadPresets(this, event, menu) },
            );
        };
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPromptExpander") return;

        const prompt = getWidget(node, "prompt");
        if (prompt) {
            if (!prompt.options) prompt.options = {};
            prompt.options.placeholder = "woman in red dress on a rooftop";
        }

        const url = getWidget(node, "url");
        if (url) {
            const prev = url.callback;
            url.callback = function (...args) {
                const result = prev?.apply(this, args);
                refreshModels(node);
                return result;
            };
        }
        refreshModels(node);

        resizeToContent(node);
        node.setSize([Math.max(node.size[0], 360), node.size[1]]);
    },
});
