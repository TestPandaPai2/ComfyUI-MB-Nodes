// MB Load Two Images: two side-by-side panels over the hidden image1/image2
// combos. Each panel takes a picker choice, an upload, or a dropped file. Ctrl+V
// fills the clicked panel, else the first empty one, else Image1.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { getWidget, notify, resizeToContent, setWidgetVisible } from "./common.js";
import { upload } from "./clipboard_image.js";

const NODE_CLASS = "MBLoadTwoImages";
const SLOTS = ["image1", "image2"];
const HIDDEN = [...SLOTS, "pad_color"];
const MIN_WIDTH = 420;
const MIN_HEIGHT = 220;

function viewUrl(value) {
    // "name [output]" style annotated paths carry their folder in brackets.
    const match = /^(.*?)\s*\[(\w+)\]\s*$/.exec(value);
    const [path, type] = match ? [match[1], match[2]] : [value, "input"];
    const cut = path.lastIndexOf("/");
    const query = new URLSearchParams({
        filename: path.slice(cut + 1),
        subfolder: cut < 0 ? "" : path.slice(0, cut),
        type,
    });
    return api.apiURL(`/view?${query}`);
}

function setImage(node, slot, filename) {
    const widget = getWidget(node, slot);
    if (!widget) return;
    const options = widget.options ?? (widget.options = {});
    const values = options.values ?? (options.values = []);
    if (!values.includes(filename)) values.push(filename);
    widget.value = filename;
    node.__mbTwoRefresh?.();
    node.setDirtyCanvas(true, true);
}

async function uploadTo(node, slot, file, name) {
    if (!file.type.startsWith("image/")) {
        notify("warn", "Not an image", file.name);
        return;
    }
    try {
        setImage(node, slot, await upload(file, file.type, name));
    } catch (e) {
        notify("error", "Upload failed", e?.message ?? String(e));
    }
}

function fillSelect(select, values, current) {
    const wanted = current && !values.includes(current) ? [current, ...values] : values;
    const same = select.options.length === wanted.length + 1
        && wanted.every((v, i) => select.options[i + 1].value === v);
    if (!same) {
        select.replaceChildren(new Option("Choose an image", ""), ...wanted.map((v) => new Option(v, v)));
    }
    select.value = current ?? "";
}

function buildPanel(node, slot) {
    const root = document.createElement("div");
    root.style.cssText = "display:flex;flex-direction:column;gap:4px;min-width:0;flex:1 1 0";

    const control = "box-sizing:border-box;width:100%;min-height:24px;font-size:12px;border-radius:4px;"
        + "border:1px solid var(--border-color,#555);background:var(--comfy-input-bg,#222);"
        + "color:var(--input-text,#ddd)";

    const select = document.createElement("select");
    select.style.cssText = control;
    select.title = `${slot === "image1" ? "Image1" : "Image2"} file`;
    select.addEventListener("pointerdown", () => {
        const widget = getWidget(node, slot);
        fillSelect(select, widget?.options?.values ?? [], widget?.value);
    });
    select.addEventListener("change", () => setImage(node, slot, select.value));

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.hidden = true;
    input.addEventListener("change", () => {
        if (input.files[0]) uploadTo(node, slot, input.files[0], input.files[0].name);
        input.value = "";
    });

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Upload";
    button.style.cssText = control + ";cursor:pointer";
    button.addEventListener("click", () => input.click());

    const preview = document.createElement("div");
    preview.tabIndex = -1;
    preview.style.cssText = "position:relative;flex:1 1 auto;min-height:120px;border-radius:4px;cursor:pointer;"
        + "overflow:hidden;background:var(--comfy-input-bg,#222);outline-offset:-2px";

    const img = document.createElement("img");
    img.alt = "";
    img.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain";

    const hint = document.createElement("div");
    hint.textContent = "Drop or paste an image";
    hint.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"
        + "padding:8px;text-align:center;font-size:12px;color:var(--descrip-text,#999)";

    img.addEventListener("error", () => {
        img.hidden = true;
        hint.textContent = "Image not found";
        hint.style.display = "flex";
    });

    preview.append(img, hint);
    preview.addEventListener("click", () => {
        node.__mbTwoTarget = slot;
        app.canvas?.selectNode?.(node);
        node.__mbTwoRefresh?.();
    });

    root.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.stopPropagation();
        preview.style.outline = "2px dashed var(--mb-accent,#d4537e)";
    });
    root.addEventListener("dragleave", (e) => {
        if (!root.contains(e.relatedTarget)) node.__mbTwoRefresh?.();
    });
    root.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        node.__mbTwoRefresh?.();
        const file = e.dataTransfer?.files?.[0];
        if (file) uploadTo(node, slot, file, file.name);
        else notify("warn", "Nothing to load", "Drop an image file.");
    });

    root.append(select, button, input, preview);

    root.refresh = () => {
        const widget = getWidget(node, slot);
        const value = widget?.value || "";
        fillSelect(select, widget?.options?.values ?? [], value);
        const url = value ? viewUrl(value) : "";
        if (img.dataset.url !== url) {
            img.dataset.url = url;
            if (url) img.src = url;
            else img.removeAttribute("src");
            img.hidden = !url;
            hint.textContent = "Drop or paste an image";
            hint.style.display = url ? "none" : "flex";
        }
        preview.style.outline = node.__mbTwoTarget === slot ? "2px solid var(--mb-accent,#d4537e)" : "none";
    };
    return root;
}

function pickPadColor(node) {
    const widget = getWidget(node, "pad_color");
    if (!widget) return;

    const input = document.createElement("input");
    input.type = "color";
    input.value = /^#[0-9a-f]{6}$/i.test(widget.value ?? "") ? widget.value : "#000000";
    // The browser opens its picker beside the input, so it stays in the page.
    input.style.cssText = "position:fixed;left:50%;top:50%;width:0;height:0;opacity:0";
    input.addEventListener("input", () => {
        widget.value = input.value;
        node.setDirtyCanvas(true, false);
    });
    input.addEventListener("change", () => input.remove());
    input.addEventListener("cancel", () => input.remove());
    document.body.appendChild(input);
    input.click();
}

function wireNode(node) {
    for (const slot of SLOTS) {
        // A new node starts empty so paste can fill the panels in order.
        // Saved values arrive afterwards through configure.
        const widget = getWidget(node, slot);
        if (widget) widget.value = "";
    }
    for (const name of HIDDEN) setWidgetVisible(node, name, false);

    const prevMenu = node.getExtraMenuOptions;
    node.getExtraMenuOptions = function (canvas, options) {
        prevMenu?.apply(this, arguments);
        options.unshift({ content: "Pad color…", callback: () => pickPadColor(this) });
    };

    const root = document.createElement("div");
    root.style.cssText = "display:flex;gap:8px;width:100%;height:100%;box-sizing:border-box";
    const panels = SLOTS.map((slot) => buildPanel(node, slot));
    root.append(...panels);

    node.addDOMWidget("mb_two_images", "mb_two_images", root, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => MIN_HEIGHT,
    });

    node.__mbTwoRefresh = () => panels.forEach((panel) => panel.refresh());

    const onConfigure = node.onConfigure;
    node.onConfigure = function (...args) {
        const result = onConfigure?.apply(this, args);
        for (const name of HIDDEN) setWidgetVisible(node, name, false);
        node.__mbTwoRefresh();
        return result;
    };

    node.__mbTwoRefresh();
    resizeToContent(node);
    node.setSize([Math.max(node.size[0], MIN_WIDTH), node.size[1]]);
}

function pasteTarget(node) {
    if (node.__mbTwoTarget) return node.__mbTwoTarget;
    return SLOTS.find((slot) => !getWidget(node, slot)?.value) ?? SLOTS[0];
}

function onPaste(event) {
    const active = document.activeElement;
    if (active?.matches?.("input, textarea, [contenteditable='true']")) return;

    const selected = Object.values(app.canvas?.selected_nodes ?? {});
    if (selected.length !== 1 || selected[0].comfyClass !== NODE_CLASS) return;

    const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
    if (!file) return;

    // Without this the frontend turns the paste into a new Load Image node.
    event.preventDefault();
    event.stopImmediatePropagation();
    uploadTo(selected[0], pasteTarget(selected[0]), file);
}

app.registerExtension({
    name: "MBNodes.LoadTwoImages",

    setup() {
        document.addEventListener("paste", onPaste, true);
    },

    async nodeCreated(node) {
        if (node.comfyClass === NODE_CLASS) wireNode(node);
    },
});
