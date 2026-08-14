import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// The top bar's action area, at the right-hand end of its controls. The
// fallbacks keep the button somewhere sane if the classes are renamed.
const HOST_SELECTORS = [".actionbar-container", ".comfyui-menu-right", ".comfyui-menu"];
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
#${BUTTON_ID} svg { width: 1rem; height: 1rem; fill: currentColor; }
#${BUTTON_ID}.mb-spinning svg { animation: mb-restart-spin 1s linear infinite; }
@keyframes mb-restart-spin { to { transform: rotate(360deg); } }
`;

// A circular arrow, drawn inline so nothing depends on the icon font in use,
// wrapped in the same content divs the sidebar's own buttons use.
const ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>`;
const CONTENT = `<div class="side-bar-button-content flex flex-col items-center gap-2"><div class="sidebar-icon-wrapper relative">${ICON}</div></div>`;

// Classes that tie a sibling button to its own tab or panel; everything else in
// the copied class list is the shared sidebar-button chrome.
// ("side-bar-button" is the shared chrome, so it stays.)
const OWN_CLASS = /(-btn|-tab-button)$/;

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
    if (sibling?.className) {
        button.className = String(sibling.className)
            .split(/\s+/)
            .filter((name) => name && name !== "side-bar-button" && !OWN_CLASS.test(name))
            .concat("side-bar-button")
            .join(" ");
    }
    button.innerHTML = CONTENT;

    // Half the sidebar button's look (its 56x48 box included) comes from Vue's
    // scoped styles, which only apply to elements carrying the component's
    // data-v-* marker, so the markers are copied over from the neighbour.
    const scopes = [...(sibling?.attributes ?? [])]
        .map((attribute) => attribute.name)
        .filter((name) => name.startsWith("data-v-"));
    for (const element of [button, ...button.querySelectorAll("*")]) {
        for (const name of scopes) element.setAttribute(name, "");
    }
    button.addEventListener("click", () => restart(button));
    return button;
}

// The sidebar is a Vue component that mounts after the extension loads and can
// re-render, so the button is re-attached whenever it goes missing.
function mount() {
    if (document.getElementById(BUTTON_ID)) return;

    let host = null;
    for (const selector of HOST_SELECTORS) {
        host = document.querySelector(selector);
        if (host) break;
    }
    if (!host) return;

    const sibling = host.querySelector("button") ?? document.querySelector("button.side-bar-button");

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
