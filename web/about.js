import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// About row at the top of the MB settings panel: pack version, node count and
// a link to the README, read from the server once and reused.

let about = null;

async function loadAbout() {
    about ??= api.fetchApi("/mbnodes/about").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return about;
}

function renderAbout() {
    const row = document.createElement("div");
    row.style.cssText = "font-size:13px;line-height:1.6;color:var(--input-text)";
    row.textContent = "MB Nodes";
    loadAbout().then((info) => {
        if (!info) {
            row.textContent = "MB Nodes · restart ComfyUI to load version info";
            return;
        }
        row.textContent = `MB Nodes v${info.version} · ${info.nodes} nodes · `;
        const link = document.createElement("a");
        link.href = `${info.repository}#readme`;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "README";
        link.style.color = "var(--mb-accent)";
        row.appendChild(link);
    });
    return row;
}

app.registerExtension({
    name: "MBNodes.About",

    settings: [
        {
            id: "MBNodes.About",
            category: ["MB", "About", "About"],
            name: "About",
            type: () => renderAbout(),
            defaultValue: "",
        },
    ],
});
