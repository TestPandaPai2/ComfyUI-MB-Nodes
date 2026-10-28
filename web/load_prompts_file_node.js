import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { addButton, getWidget } from "./common.js";

// /upload/image stores any file type in input/, so it serves .txt uploads too.
async function uploadText(file) {
    const body = new FormData();
    body.append("image", file);
    body.append("type", "input");
    body.append("overwrite", "true");

    const response = await api.fetchApi("/upload/image", { method: "POST", body });
    if (response.status >= 400) {
        throw new Error(`Upload failed: HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

app.registerExtension({
    name: "MBNodes.LoadPromptsFromFile",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MBLoadPromptsFromFile") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);

            addButton(this, "Upload .txt", () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".txt,text/plain";
                input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    try {
                        const name = await uploadText(file);
                        const widget = getWidget(this, "file");
                        const values = widget.options.values;
                        if (!values.includes(name)) {
                            values.push(name);
                            values.sort();
                        }
                        widget.value = name;
                        widget.callback?.(name);
                        this.setDirtyCanvas(true, true);
                    } catch (error) {
                        console.error(error);
                        alert(error.message);
                    }
                };
                input.click();
            });
        };
    },
});
