import { app } from "../../scripts/app.js";
import { addButton, getWidget, resizeToContent } from "./common.js";
import { savePrompt, openLoadDialog } from "./prompt_store.js";

const FOLDER = "system"; // the pack's SystemPrompts folder
const MIN_HEIGHT = 260;  // system prompts are long, so the box starts tall

app.registerExtension({
    name: "MBNodes.SystemPrompt",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBSystemPrompt") return;

        addButton(node, "Save", () => savePrompt(node, FOLDER));
        addButton(node, "Load", () => openLoadDialog(node, FOLDER));

        const text = getWidget(node, "text");
        if (text) {
            if (!text.options) text.options = {};
            text.options.placeholder = "You are a helpful assistant...";
        }

        resizeToContent(node);
        node.setSize([Math.max(node.size[0], 320), Math.max(node.size[1], MIN_HEIGHT)]);
    },
});
