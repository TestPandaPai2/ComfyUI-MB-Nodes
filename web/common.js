// Shared widget helpers for the MBNodes pack.

import { app } from "../../scripts/app.js";

// A toast when the frontend offers one, the console when it does not.
export function notify(severity, summary, detail) {
    const toast = app.extensionManager?.toast;
    if (toast) toast.add({ severity, summary, detail, life: 4000 });
    else console.log(`[MBNodes] ${summary}: ${detail ?? ""}`);
}

// The pack-wide accent, published by theme.js as a CSS variable so DOM styles
// and canvas drawing follow the same setting.
export function accentColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--mb-accent").trim() || "#d4537e";
}

export function getWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
}

// Two flags, because two renderers ask different questions: the canvas one
// skips widgets flagged `hidden` (LGraphNode.isWidgetVisible / getLayoutWidgets)
// while the DOM node body and the properties panel filter on
// `options.hidden`. Swapping widget.type to "hidden" instead leaves the widget
// in the layout and it gets drawn past the bottom of the node.
// The value is kept either way, so it still round-trips through save/load.
export function setWidgetVisible(node, name, visible) {
    const w = getWidget(node, name);
    if (!w) return false;

    const hidden = !visible;
    if (w.hidden === hidden && w.options?.hidden === hidden) return false;

    w.hidden = hidden;
    if (!w.options) w.options = {};
    w.options.hidden = hidden;
    return true;
}

export function addButton(node, label, callback) {
    const widget = node.addWidget("button", label, null, callback);
    widget.serialize = false; // buttons hold no value worth saving
    return widget;
}

// Grow/shrink to fit the visible widgets without narrowing a node the user has
// widened by hand.
export function resizeToContent(node) {
    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), size[1]]);
    node.setDirtyCanvas(true, true);
}
