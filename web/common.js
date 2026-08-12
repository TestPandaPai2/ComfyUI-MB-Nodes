// Shared widget helpers for the MBNodes pack.

export function getWidget(node, name) {
    return node.widgets?.find((w) => w.name === name);
}

// The frontend skips widgets flagged `hidden` in both layout and computeSize
// (LGraphNode.isWidgetVisible). Swapping widget.type to "hidden" instead leaves
// the widget in the layout and it gets drawn past the bottom of the node.
// The value is kept either way, so it still round-trips through save/load.
export function setWidgetVisible(node, name, visible) {
    const w = getWidget(node, name);
    if (!w || w.hidden === !visible) return false;
    w.hidden = !visible;
    return true;
}

// Grow/shrink to fit the visible widgets without narrowing a node the user has
// widened by hand.
export function resizeToContent(node) {
    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), size[1]]);
    node.setDirtyCanvas(true, true);
}
