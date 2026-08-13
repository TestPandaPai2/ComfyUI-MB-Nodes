import os
import re

from comfy_api.latest import io

PACK_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAVED_PROMPTS_DIR = os.path.join(PACK_ROOT, "SavedPrompts")
UNSAFE = re.compile(r"[^A-Za-z0-9 _.-]")


def saved_prompts_dir():
    os.makedirs(SAVED_PROMPTS_DIR, exist_ok=True)
    return SAVED_PROMPTS_DIR


def safe_filename(filename):
    """Basename only, harmless characters only, always .txt. Returns None when
    nothing usable is left."""
    name = UNSAFE.sub("_", os.path.basename((filename or "").strip())).strip(" .")
    if not name:
        return None
    if not name.lower().endswith(".txt"):
        name += ".txt"
    return name


class MBPromptPad(io.ComfyNode):
    """A prompt scratchpad. Type a prompt, name it, and save it to the pack's
    SavedPrompts folder with the Save button."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBPromptPad",
            display_name="Prompt Pad (MB)",
            category="MBNodes",
            description="Write prompts, keep them, and save them to SavedPrompts as .txt files.",
            search_aliases=["prompt pad", "save prompt", "prompt notes"],
            inputs=[
                io.String.Input("text", multiline=True, default=""),
                io.String.Input(
                    "filename",
                    default="prompt",
                    socketless=True,
                    tooltip="Name the Save button writes to, inside the pack's SavedPrompts folder.",
                ),
                io.String.Input(
                    "text_in",
                    optional=True,
                    force_input=True,
                    tooltip="When connected, this replaces the typed text on the output.",
                ),
            ],
            outputs=[io.String.Output("text")],
        )

    @classmethod
    def execute(cls, text, filename, text_in=None) -> io.NodeOutput:
        incoming = text_in if isinstance(text_in, str) else ("" if text_in is None else str(text_in))
        return io.NodeOutput(incoming if incoming.strip() else (text or ""))


# The Save button posts here; writing files is a frontend action, not part of
# running the graph.
try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.post("/mbnodes/save_prompt")
    async def _mbnodes_save_prompt(request):
        data = await request.json()
        name = safe_filename(data.get("filename"))
        if not name:
            return web.json_response({"error": "A filename is required."}, status=400)

        path = os.path.join(saved_prompts_dir(), name)
        if os.path.exists(path) and not data.get("overwrite"):
            return web.json_response({"error": "exists", "filename": name}, status=409)

        with open(path, "w", encoding="utf-8") as f:
            f.write(data.get("text") or "")
        return web.json_response({"filename": name, "path": path})

    @PromptServer.instance.routes.get("/mbnodes/saved_prompts")
    async def _mbnodes_saved_prompts(request):
        files = sorted(
            f for f in os.listdir(saved_prompts_dir())
            if f.lower().endswith(".txt") and os.path.isfile(os.path.join(SAVED_PROMPTS_DIR, f))
        )
        return web.json_response({"files": files})
except Exception:  # server missing (unit runs) or route already registered
    pass


NODES = [MBPromptPad]
