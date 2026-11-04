import { app } from "../../scripts/app.js";
import { getWidget, notify } from "./common.js";
import { openDialog } from "./dialog.js";
import { fetchFiles, fetchText, post, setText } from "./prompt_store.js";

const FOLDER = "system"; // the pack's SystemPrompts folder, shared with System Prompt (MB)

const HOW_TO = [
    ["1. Pick a model", "Choose an LLM text encoder in clip_name (Qwen, Gemma, ...) and set type to match it, the same as on CLIP Loader. Plain CLIP or T5 encoders can't write text."],
    ["2. Write your request", "Type what you want in prompt. Use system_prompt to tell the model how to behave, e.g. \"Reply with one short image prompt.\" Right-click the node to save a system prompt as a preset or load one you saved."],
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

function openPresetEditor(node) {
    const initial = getWidget(node, "system_prompt")?.value ?? "";
    let name, text, close;
    let saving = false;

    async function save(use) {
        if (saving) return;
        if (!name.value.trim()) return notify("warn", "No name", "Name the preset before saving it.");
        if (!text.value.trim()) return notify("warn", "Nothing to save", "The system prompt is empty.");
        saving = true;
        try {
            let result = await post(FOLDER, name.value, text.value, false);
            if (result.status === 409) {
                if (!confirm(`${result.data.filename} already exists.\n\nOverwrite it?`)) return;
                result = await post(FOLDER, name.value, text.value, true);
            }
            if (result.status >= 400) return notify("error", "Save failed", result.data?.error ?? `HTTP ${result.status}`);
            if (use) setText(node, text.value, "system_prompt");
            notify("success", "Preset saved", result.data.filename);
            close();
        } catch (e) {
            notify("error", "Save failed", e?.message ?? String(e));
        } finally {
            saving = false;
        }
    }

    close = openDialog({
        title: "Save System Prompt as Preset",
        width: 720,
        fullHeight: true,
        applyLabel: "Save & Use",
        extraLabel: "Save Preset",
        onExtra: () => save(false),
        render(body) {
            name = document.createElement("input");
            name.className = "mb-dialog-editor";
            name.placeholder = "Preset name";
            text = document.createElement("textarea");
            text.className = "mb-dialog-editor";
            text.placeholder = "You are a helpful assistant...";
            text.value = initial;
            body.append(name, text);
        },
        onApply() {
            save(true);
            return false; // the save closes the dialog once it succeeds
        },
        canClose: () => text.value === initial || confirm("Discard your changes?"),
    });
    text.focus();
}

async function openPresetList(node, event, menu) {
    let files;
    try {
        files = (await fetchFiles(FOLDER)).files ?? [];
    } catch (e) {
        return notify("error", "Load failed", e?.message ?? String(e));
    }
    const items = files.map((file) => ({
        content: file,
        callback: async () => {
            try {
                setText(node, await fetchText(FOLDER, file), "system_prompt");
            } catch (e) {
                notify("error", "Load failed", e?.message ?? String(e));
            }
        },
    }));
    new LiteGraph.ContextMenu(items.length ? items : [{ content: "(none saved)", disabled: true }], { event, parentMenu: menu });
}

app.registerExtension({
    name: "MBNodes.TextGenerate",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MBNodesTextGenerate") return;
        const prev = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            prev?.apply(this, arguments);
            options.push(
                null,
                { content: "Save System Prompt as Preset…", callback: () => openPresetEditor(this) },
                { content: "Load System Prompt Preset", has_submenu: true, callback: (v, o, event, menu) => openPresetList(this, event, menu) },
                { content: "How to Use", callback: showHowTo },
            );
        };
    },
});
