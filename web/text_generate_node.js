import { app } from "../../scripts/app.js";
import { openDialog } from "./dialog.js";

const HOW_TO = [
    ["1. Pick a model", "Choose an LLM text encoder in clip_name (Qwen, Gemma, ...) and set type to match it, the same as on CLIP Loader. Plain CLIP or T5 encoders can't write text."],
    ["2. Write your request", "Type what you want in prompt. Use system_prompt to tell the model how to behave, e.g. \"Reply with one short image prompt.\""],
    ["3. Add media (optional)", "Connect images, a video or audio for the model to look at or listen to. A new image slot appears each time you connect one."],
    ["4. Choose a speed", "Fast gives quick, short answers. Balanced is a good default. Quality writes longer, more careful answers. Custom lets you set every option."],
    ["5. Run", "The answer comes out of the text output. The model stays loaded, so changing only the prompt runs faster the next time."],
];

function showHowTo() {
    openDialog({
        title: "Text Generate: How to Use",
        width: 460,
        applyLabel: "Got it",
        render(body) {
            for (const [head, text] of HOW_TO) {
                const p = document.createElement("p");
                const b = document.createElement("b");
                b.textContent = head;
                p.append(b, document.createElement("br"), text);
                body.appendChild(p);
            }
        },
        onApply() {},
    });
}

app.registerExtension({
    name: "MBNodes.TextGenerate",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MBNodesTextGenerate") return;
        const prev = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            prev?.apply(this, arguments);
            options.push(null, { content: "How to Use", callback: showHowTo });
        };
    },
});
