// Notify on finish: a sound after every finished prompt, and a different one
// when a prompt fails. A cancel stays silent. Each sound is a built-in Web
// Audio chime unless an mp3 is attached in the MB settings panel; attached
// files live in the user's ComfyUI user data (mbnodes/), and the setting only
// keeps the original file name for display.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const ENABLED_ID = "MBNodes.Feature.NotifyFinish";
const VOLUME_ID = "MBNodes.NotifyFinish.Volume";
const SOUNDS = {
    success: { id: "MBNodes.NotifyFinish.SuccessSound", file: "mbnodes/notify_success.mp3", name: "Success sound" },
    error: { id: "MBNodes.NotifyFinish.ErrorSound", file: "mbnodes/notify_error.mp3", name: "Error sound" },
};
// [frequency Hz, seconds] per note.
const CHIMES = {
    success: { wave: "sine", notes: [[659.25, 0.12], [880, 0.12]] },
    error: { wave: "triangle", notes: [[220, 0.18], [164.81, 0.18]] },
};
// Full volume on the chime is loud enough; more just clips.
const CHIME_GAIN = 0.35;

const setting = (id) => app.extensionManager?.setting?.get(id);
const volume = () => (setting(VOLUME_ID) ?? 60) / 100;

let audioContext = null;
const fileUrls = {};

function playChime(kind) {
    try {
        audioContext ??= new AudioContext();
    } catch {
        return;
    }
    if (audioContext.state === "suspended") audioContext.resume();

    const { wave, notes } = CHIMES[kind];
    let t = audioContext.currentTime;
    for (const [freq, length] of notes) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = wave;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume() * CHIME_GAIN, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
        osc.connect(gain).connect(audioContext.destination);
        osc.start(t);
        osc.stop(t + length);
        t += length;
    }
}

async function playFile(kind) {
    fileUrls[kind] ??= api.getUserData(SOUNDS[kind].file)
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => (blob ? URL.createObjectURL(blob) : null));
    const url = await fileUrls[kind];
    if (!url) return playChime(kind);
    const audio = new Audio(url);
    audio.volume = volume();
    audio.play().catch(() => {});
}

function play(kind) {
    if (setting(SOUNDS[kind].id)) playFile(kind);
    else playChime(kind);
}

async function attach(kind, file) {
    await api.storeUserData(SOUNDS[kind].file, file, { overwrite: true, stringify: false, throwOnError: true });
    delete fileUrls[kind];
    await app.extensionManager.setting.set(SOUNDS[kind].id, file.name);
}

async function reset(kind) {
    delete fileUrls[kind];
    await app.extensionManager.setting.set(SOUNDS[kind].id, "");
}

// --------------------------------------------------------------- settings

function button(label, onClick) {
    const el = document.createElement("button");
    el.textContent = label;
    el.style.cssText =
        "padding:2px 10px;border-radius:4px;cursor:pointer;font-size:12px;" +
        "border:1px solid var(--border-color,#4e4e4e);background:var(--comfy-input-bg,#222);color:var(--input-text,#ddd);";
    el.addEventListener("click", onClick);
    return el;
}

// Shows the attached file (or the built-in chime) with Choose / Reset / Test.
function renderSound(kind) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:6px;font-size:13px;color:var(--input-text)";

    const label = document.createElement("span");
    label.style.cssText = "max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    const refresh = () => {
        label.textContent = setting(SOUNDS[kind].id) || "Built-in chime";
        label.title = label.textContent;
    };
    refresh();

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp3,audio/mpeg";
    input.style.display = "none";
    input.addEventListener("change", async () => {
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        try {
            await attach(kind, file);
        } catch (e) {
            app.extensionManager?.toast?.add({ severity: "error", summary: "Couldn't attach sound", detail: e?.message ?? String(e), life: 4000 });
        }
        refresh();
    });

    row.append(
        label,
        input,
        button("Choose mp3", () => input.click()),
        button("Reset", async () => {
            await reset(kind);
            refresh();
        }),
        button("Test", () => play(kind)),
    );
    return row;
}

app.registerExtension({
    name: "MBNodes.NotifyFinish",

    settings: [
        {
            id: ENABLED_ID,
            category: ["MB", "Features", "Notify on finish"],
            name: "Notify on finish",
            tooltip: "Play a sound when a prompt finishes or fails.",
            type: "boolean",
            defaultValue: true,
        },
        {
            id: VOLUME_ID,
            category: ["MB", "Notify on finish", "Volume"],
            name: "Volume",
            type: "slider",
            attrs: { min: 0, max: 100, step: 5 },
            defaultValue: 60,
        },
        ...Object.entries(SOUNDS).map(([kind, sound]) => ({
            id: sound.id,
            category: ["MB", "Notify on finish", sound.name],
            name: sound.name,
            tooltip: "An mp3 to play instead of the built-in chime.",
            type: () => renderSound(kind),
            defaultValue: "",
        })),
    ],

    setup() {
        api.addEventListener("execution_success", () => {
            if (setting(ENABLED_ID) !== false) play("success");
        });
        api.addEventListener("execution_error", () => {
            if (setting(ENABLED_ID) !== false) play("error");
        });
    },
});
