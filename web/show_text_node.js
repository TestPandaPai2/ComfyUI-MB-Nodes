// Renders the live text preview for MBShowText. ui.PreviewText on the Python
// side only ships the value up to the frontend (message.text) -- nothing in
// core turns that into a visible widget on its own, so this adds one.

import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { getWidget, resizeToContent } from "./common.js";

app.registerExtension({
    name: "MBNodes.ShowText",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MBShowText") return;

        const onExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            onExecuted?.apply(this, arguments);

            const value = message?.text?.[0] ?? "";
            let widget = getWidget(this, "preview");
            if (!widget) {
                widget = ComfyWidgets["STRING"](this, "preview", ["STRING", { multiline: true }], app).widget;
                widget.inputEl.readOnly = true;
                widget.inputEl.style.opacity = 0.7;
                widget.serialize = false; // shown value is re-derived from the run, not saved
            }
            widget.value = value;

            resizeToContent(this);
        };
    },
});
