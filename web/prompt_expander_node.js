// Prompt Expander (MB): picking a preset fills the system prompt box, Save
// Preset stores the box under preset_name, Delete Preset removes a custom one,
// Pick Model lists the models Ollama has installed. Presets live in
// ExpanderPresets.json via the routes in nodes/prompt_expander_node.py.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { addButton, getWidget, notify, resizeToContent } from "./common.js";
import { openDialog } from "./dialog.js";

let builtin = {};
let custom = {};

async function fetchPresets() {
    const data = await (await api.fetchApi("/mbnodes/expander_presets")).json();
    builtin = data.builtin ?? {};
    custom = data.custom ?? {};
}

async function post(route, body) {
    const response = await api.fetchApi(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
}

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

// Every Prompt Expander on the page shares one preset list.
function refreshCombos(select) {
    const names = [...Object.keys(builtin), ...Object.keys(custom)];
    for (const node of app.graph.nodes) {
        if (node.comfyClass !== "MBPromptExpander") continue;
        const widget = getWidget(node, "preset");
        if (!widget) continue;
        widget.options.values = names;
        if (node === select?.node) widget.value = select.name;
        else if (!names.includes(widget.value)) widget.value = names[0];
        node.setDirtyCanvas(true, true);
    }
}

function applyPreset(node, name) {
    const text = custom[name] ?? builtin[name];
    if (text === undefined) return;
    setValue(node, "system_prompt", text);
    if (name in custom) setValue(node, "preset_name", name);
}

async function savePreset(node) {
    const name = (getWidget(node, "preset_name")?.value ?? "").trim();
    const text = getWidget(node, "system_prompt")?.value ?? "";

    if (!name) {
        notify("warn", "No preset name", "Type a name in preset_name first.");
        return;
    }
    if (!text.trim()) {
        notify("warn", "Nothing to save", "The system prompt is empty.");
        return;
    }

    try {
        let result = await post("/mbnodes/expander_presets/save", { name, text, overwrite: false });
        if (result.status === 409) {
            if (!confirm(`"${name}" already exists.\n\nOverwrite it?`)) return;
            result = await post("/mbnodes/expander_presets/save", { name, text, overwrite: true });
        }
        if (result.status >= 400) {
            notify("error", "Save failed", result.data?.error ?? `HTTP ${result.status}`);
            return;
        }
        custom = result.data.custom;
        refreshCombos({ node, name });
        notify("success", "Preset saved", name);
    } catch (e) {
        notify("error", "Save failed", e?.message ?? String(e));
    }
}

async function deletePreset(node) {
    const name = getWidget(node, "preset")?.value;
    if (!(name in custom)) {
        notify("warn", "Built-in preset", "Only custom presets can be deleted.");
        return;
    }
    if (!confirm(`Delete the preset "${name}"?`)) return;

    try {
        const result = await post("/mbnodes/expander_presets/delete", { name });
        if (result.status >= 400) {
            notify("error", "Delete failed", result.data?.error ?? `HTTP ${result.status}`);
            return;
        }
        custom = result.data.custom;
        refreshCombos();
        notify("success", "Preset deleted", name);
    } catch (e) {
        notify("error", "Delete failed", e?.message ?? String(e));
    }
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

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPromptExpander") return;

        const preset = getWidget(node, "preset");
        if (preset) {
            const original = preset.callback;
            preset.callback = function (value, ...rest) {
                applyPreset(node, value);
                return original?.call(this, value, ...rest);
            };
        }

        addButton(node, "Save Preset", () => savePreset(node));
        addButton(node, "Delete Preset", () => deletePreset(node));
        addButton(node, "Pick Model", () => pickModel(node));

        const prompt = getWidget(node, "prompt");
        if (prompt) {
            if (!prompt.options) prompt.options = {};
            prompt.options.placeholder = "woman in red dress on a rooftop";
        }

        resizeToContent(node);
        node.setSize([Math.max(node.size[0], 360), node.size[1]]);

        try {
            await fetchPresets();
            refreshCombos();
        } catch (e) {
            notify("error", "Presets not loaded", e?.message ?? String(e));
        }
    },
});
