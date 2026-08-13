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

const BUTTON_RADIUS = 10;
const BUTTON_MARGIN = 15; // matches the inset LiteGraph uses for its own widgets
const BUTTON_FILL = "#353535";
const BUTTON_BORDER = "#1a1a1a";
const BUTTON_TEXT = "#dcdcdc";

// Buttons are drawn square by the canvas renderer, so ours paint themselves as a
// rounded rect instead. Hit testing is done by LiteGraph from the widget bounds
// and is unaffected by the custom draw.
export function addButton(node, label, callback, radius = BUTTON_RADIUS) {
    const widget = node.addWidget("button", label, null, callback);
    widget.serialize = false; // buttons hold no value worth saving

    widget.draw = function (ctx, drawNode, widgetWidth, y, height) {
        const x = BUTTON_MARGIN;
        const width = widgetWidth - BUTTON_MARGIN * 2;

        ctx.save();
        ctx.fillStyle = BUTTON_FILL;
        ctx.strokeStyle = BUTTON_BORDER;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = BUTTON_TEXT;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "12px Arial";
        ctx.fillText(this.label ?? this.name, x + width / 2, y + height / 2);
        ctx.restore();
    };

    return widget;
}

// Grow/shrink to fit the visible widgets without narrowing a node the user has
// widened by hand.
export function resizeToContent(node) {
    const size = node.computeSize();
    node.setSize([Math.max(node.size[0], size[0]), size[1]]);
    node.setDirtyCanvas(true, true);
}
