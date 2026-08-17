// Paste the image on the clipboard into a loader's file widget: read it from
// the clipboard, upload it to the input folder, then select it. Shared by
// Load Image (MB) and Load Image with Crop (MB).

import { api } from "../../scripts/api.js";
import { getWidget, notify } from "./common.js";

const EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

function stamp() {
    // Local time, so the newest paste sorts last in the picker.
    const d = new Date();
    const pad = (n, width = 2) => String(n).padStart(width, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
        + `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
        + `-${pad(d.getMilliseconds(), 3)}`;
}

/** The first image on the clipboard, or null when there is none. */
async function readClipboardImage() {
    if (!navigator.clipboard?.read) {
        throw new Error("This browser will not hand a page the clipboard. Paste the image into the canvas instead.");
    }

    const items = await navigator.clipboard.read();
    for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) return { blob: await item.getType(type), type };
    }
    return null;
}

async function upload(blob, type) {
    const name = `clipboard-${stamp()}.${EXTENSIONS[type] ?? "png"}`;
    const body = new FormData();
    body.append("image", new File([blob], name, { type }));
    body.append("type", "input");
    // Names carry a timestamp, so nothing of the user's is ever landed on.
    body.append("overwrite", "false");

    const response = await api.fetchApi("/upload/image", { method: "POST", body });
    if (response.status >= 400) {
        throw new Error(`Upload failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

/** Reads the clipboard, uploads what it finds and points `widgetName` at it. */
export async function pasteImage(node, widgetName = "image") {
    const widget = getWidget(node, widgetName);
    if (!widget) return;

    try {
        const image = await readClipboardImage();
        if (!image) {
            notify("warn", "Nothing to paste", "There is no image on the clipboard.");
            return;
        }

        const filename = await upload(image.blob, image.type);

        // The uploaded file is new to the picker, so it has to be offered
        // before it can be selected.
        const options = widget.options ?? (widget.options = {});
        const values = options.values ?? (options.values = []);
        if (!values.includes(filename)) values.push(filename);

        widget.value = filename;
        widget.callback?.(filename);
        node.setDirtyCanvas(true, true);
        notify("success", "Image pasted", filename);
    } catch (e) {
        // A denied clipboard permission arrives here too, hence the hint.
        notify("error", "Paste failed", e?.message ?? String(e));
    }
}
