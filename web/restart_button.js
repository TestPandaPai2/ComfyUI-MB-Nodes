import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { hideButton, notify } from "./common.js";

// Power button in the top action bar: restarts the ComfyUI server this page is
// connected to, straight away. The page reconnects on its own once it is back.
app.registerExtension({
    name: "MBNodes.RestartButton",
    settings: [
        {
            id: "MBNodes.Feature.RestartButton",
            category: ["MB", "Features", "Restart button"],
            name: "Restart button",
            tooltip: "Power button in the top bar that restarts ComfyUI straight away.",
            type: "boolean",
            defaultValue: true,
            onChange: (on) => hideButton("mb-restart-button", on === false),
        },
    ],
    async setup() {
        hideButton("mb-restart-button", app.extensionManager?.setting?.get("MBNodes.Feature.RestartButton") === false);
    },
    actionBarButtons: [
        {
            class: "mb-restart-button",
            icon: "pi pi-power-off",
            tooltip: "Restart ComfyUI",
            onClick: async () => {
                const response = await api.fetchApi("/mbnodes/restart", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                });
                // A server started before this pack added the route answers 404.
                if (response.ok) notify("info", "Restarting ComfyUI");
                else notify("error", "Restart failed", `Server answered ${response.status}. Restart ComfyUI by hand once to load the restart route.`);
            },
        },
    ],
});
