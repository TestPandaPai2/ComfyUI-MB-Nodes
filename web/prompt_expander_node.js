// MB Prompt Expander: system prompt presets and the Ollama model list live in the
// right-click menu. Presets save to the same folder as MB Text Generate.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, notify, resizeToContent } from "./common.js";
import { openDialog } from "./dialog.js";
import { openPresetEditor, openPresetList } from "./text_generate_node.js";

// Workflows saved with the old preset and preset_name widgets.
const OLD_WIDGET_COUNT = 11;
const OLD_WIDGETS = [1, 3];

// Multiline widgets keep a DOM element of their own under Nodes 2.0, which does
// not follow widget.value on its own.
function setValue(node, name, value) {
    const widget = getWidget(node, name);
    if (!widget) return;
    widget.value = value;
    const element = widget.inputEl ?? widget.element;
    if (element && "value" in element) element.value = value;
    node.setDirtyCanvas(true, true);
}

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

async function pickModel(node) {
    const url = getWidget(node, "url")?.value ?? "";
    let models;
    try {
        const response = await api.fetchApi(`/mbnodes/ollama_models?url=${encodeURIComponent(url)}`);
        const data = await response.json();
        if (response.status >= 400) throw new Error(data?.error ?? `HTTP ${response.status}`);
        models = data.models ?? [];
    } catch (e) {
        notify("error", "No model list", e?.message ?? String(e));
        return;
    }
    if (!models.length) {
        notify("warn", "No models", "Ollama has no models installed. Run ollama pull <model> first.");
        return;
    }

    let list;
    const choose = () => {
        if (list.value) setValue(node, "model", list.value);
    };
    const close = openDialog({
        title: "Pick Ollama model",
        width: 360,
        applyLabel: "Use",
        render(body) {
            list = document.createElement("select");
            list.className = "mb-dialog-select";
            list.size = Math.min(12, Math.max(4, models.length));
            list.style.width = "100%";
            for (const name of models) {
                const item = document.createElement("option");
                item.value = name;
                item.textContent = name;
                list.appendChild(item);
            }
            const current = getWidget(node, "model")?.value;
            list.value = models.includes(current) ? current : models[0];
            list.addEventListener("dblclick", () => {
                choose();
                close();
            });
            body.appendChild(list);
        },
        onApply: choose,
    });
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
            return configure.call(this, info);
        };

        const prev = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            prev?.apply(this, arguments);
            options.push(
                null,
                { content: "Save System Prompt as Preset…", callback: () => openPresetEditor(this) },
                { content: "Load System Prompt Preset", has_submenu: true, callback: (v, o, event, menu) => loadPresets(this, event, menu) },
                { content: "Pick Ollama Model…", callback: () => pickModel(this) },
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

        resizeToContent(node);
        node.setSize([Math.max(node.size[0], 360), node.size[1]]);
    },
});
