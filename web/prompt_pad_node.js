import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget } from "./common.js";

function notify(severity, summary, detail) {
    const toast = app.extensionManager?.toast;
    if (toast) toast.add({ severity, summary, detail, life: 4000 });
    else console.log(`[MBNodes] ${summary}: ${detail ?? ""}`);
}

async function post(filename, text, overwrite) {
    const response = await api.fetchApi("/mbnodes/save_prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, text, overwrite }),
    });
    return { status: response.status, data: await response.json() };
}

async function savePrompt(node) {
    const text = getWidget(node, "text")?.value ?? "";
    const filename = getWidget(node, "filename")?.value ?? "";

    if (!filename.trim()) {
        notify("warn", "No filename", "Name the prompt before saving it.");
        return;
    }
    if (!text.trim()) {
        notify("warn", "Nothing to save", "The prompt is empty.");
        return;
    }

    try {
        let result = await post(filename, text, false);

        // Overwriting is the user's call, so the backend refuses it by default.
        if (result.status === 409) {
            if (!confirm(`${result.data.filename} already exists in SavedPrompts.\n\nOverwrite it?`)) {
                return;
            }
            result = await post(filename, text, true);
        }

        if (result.status >= 400) {
            notify("error", "Save failed", result.data?.error ?? `HTTP ${result.status}`);
            return;
        }
        notify("success", "Prompt saved", `SavedPrompts/${result.data.filename}`);
    } catch (e) {
        notify("error", "Save failed", e?.message ?? String(e));
    }
}

app.registerExtension({
    name: "MBNodes.PromptPad",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPromptPad") return;
        node.addWidget("button", "Save", null, () => savePrompt(node));
    },
});
