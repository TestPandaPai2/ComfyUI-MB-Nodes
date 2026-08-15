import { app } from "../../scripts/app.js";
import { addButton } from "./common.js";
import { savePrompt, openLoadDialog } from "./prompt_store.js";

const FOLDER = "prompts"; // the pack's SavedPrompts folder

app.registerExtension({
    name: "MBNodes.PromptPad",

    async nodeCreated(node) {
        if (node.comfyClass !== "MBPromptPad") return;
        addButton(node, "Save", () => savePrompt(node, FOLDER));
        addButton(node, "Load", () => openLoadDialog(node, FOLDER));
    },
});
