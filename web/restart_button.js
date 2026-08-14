import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// The sidebar's bottom group. The class has been stable across the Vue frontend,
// but the fallbacks keep the button somewhere sane if it is ever renamed.
const BOTTOM_SELECTORS = [
    ".side-tool-bar-end",
    ".side-tool-bar-container .p-buttongroup:last-child",
    ".side-tool-bar-container",
];
const BUTTON_ID = "mb-restart-button";
const STYLE_ID = "mb-restart-style";
const POLL_MS = 1000;
const POLL_TIMEOUT_MS = 120000;

// The button copies the class list of a neighbouring sidebar button so it picks
// up the frontend's own size, spacing and hover chrome; only the red tint and
// the spinner below are ours.
const CSS = `
#${BUTTON_ID} {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #e01010;
    cursor: pointer;
}
#${BUTTON_ID}:hover { background: rgba(224, 16, 16, 0.16); color: #ff3b3b; }
#${BUTTON_ID}:disabled { opacity: 0.5; cursor: default; }
#${BUTTON_ID} svg { width: 1.25rem; height: 1.25rem; fill: currentColor; }
#${BUTTON_ID}.mb-spinning svg { animation: mb-restart-spin 1s linear infinite; }
@keyframes mb-restart-spin { to { transform: rotate(360deg); } }
`;

// A circular arrow, drawn inline so nothing depends on the icon font in use.
const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>`;

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

function toast(severity, summary, detail, life = 4000) {
    app.extensionManager?.toast?.add?.({ severity, summary, detail, life });
}

// Waits for the new process to answer, then reloads so the page is talking to it.
async function waitForServer(button) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        try {
            const response = await api.fetchApi("/system_stats", { cache: "no-store" });
            if (response.ok) {
                location.reload();
                return;
            }
        } catch (e) {
            // still down, keep waiting
        }
    }
    button.disabled = false;
    button.classList.remove("mb-spinning");
    toast("warn", "Restart", "ComfyUI has not come back yet — reload once it does.", 8000);
}

async function restart(button) {
    button.disabled = true;
    button.classList.add("mb-spinning");
    toast("info", "Restarting ComfyUI", "The page reloads once the server is back.", 6000);

    try {
        const response = await api.fetchApi("/mbnodes/restart", { method: "POST" });
        // The endpoint ships with this pack, so a 404 means the running server
        // predates it and has to be started again by hand this once.
        if (response.status === 404) {
            button.disabled = false;
            button.classList.remove("mb-spinning");
            toast("error", "Restart", "Restart endpoint missing — start ComfyUI again by hand once to load it.", 8000);
            return;
        }
    } catch (e) {
        // The server usually dies mid-request, so a network error here is expected.
    }
    waitForServer(button);
}

function makeButton(sibling) {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.title = "Restart ComfyUI";
    button.setAttribute("aria-label", "Restart ComfyUI");
    // Same chrome as the icons above it, whatever the frontend styles them with.
    if (sibling?.className) button.className = sibling.className;
    button.innerHTML = ICON;
    button.addEventListener("click", () => restart(button));
    return button;
}

// The sidebar is a Vue component that mounts after the extension loads and can
// re-render, so the button is re-attached whenever it goes missing.
function mount() {
    if (document.getElementById(BUTTON_ID)) return;

    let host = null;
    for (const selector of BOTTOM_SELECTORS) {
        host = document.querySelector(selector);
        if (host) break;
    }
    if (!host) return;

    const sibling =
        host.querySelector("button") ??
        document.querySelector(".side-tool-bar-container button");

    ensureStyle();
    host.appendChild(makeButton(sibling));
}

app.registerExtension({
    name: "MBNodes.RestartButton",

    setup() {
        mount();
        const observer = new MutationObserver(() => mount());
        observer.observe(document.body, { childList: true, subtree: true });
    },
});
