import { app } from "../../scripts/app.js";
import { addButton, getWidget, resizeToContent } from "./common.js";
import { fetchFiles, fetchText, notify, savePrompt, setText } from "./prompt_store.js";

const FOLDER = "system"; // the pack's SystemPrompts folder
const MIN_HEIGHT = 260;  // system prompts are long, so the box starts tall
const NONE = "(none)";
const REFRESH = "Refresh list"; // files dropped in the folder by hand need this

// Only the text box is saved with the workflow, so a deleted prompt file cannot
// break a graph.
function addPromptPicker(node) {
    let current = NONE;

    const picker = node.addWidget("combo", "prompt", NONE, async (name) => {
        if (name === REFRESH) {
            picker.value = current;
            await refresh();
            return;
        }
        current = name;
        if (name === NONE) return;
        try {
            setText(node, await fetchText(FOLDER, name));
            // .md stays spelled out: without an extension Save would write .txt.
            setText(node, name.replace(/\.txt$/i, ""), "filename");
        } catch (e) {
            notify("error", "Load failed", e?.message ?? String(e));
        }
    }, { values: [NONE, REFRESH] });
    picker.serialize = false;

    async function refresh(selected = current) {
        try {
            const { files = [] } = await fetchFiles(FOLDER);
            picker.options.values = [NONE, ...files, REFRESH];
            current = files.includes(selected) ? selected : NONE;
            picker.value = current;
            node.setDirtyCanvas(true, true);
        } catch (e) {
            notify("error", "Could not list prompts", e?.message ?? String(e));
        }
    }

    refresh();
    return refresh;
}

app.registerExtension({
    name: "MBNodes.SystemPrompt",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBSystemPrompt") return;

        const refresh = addPromptPicker(node);
        addButton(node, "Save", async () => {
            const saved = await savePrompt(node, FOLDER);
            if (saved) refresh(saved);
        });

        const text = getWidget(node, "text");
        if (text) {
            if (!text.options) text.options = {};
            text.options.placeholder = "You are a helpful assistant...";
        }

        resizeToContent(node);
        node.setSize([Math.max(node.size[0], 320), Math.max(node.size[1], MIN_HEIGHT)]);
    },
});
