"""Reading and writing prompt .txt files for Prompt Pad (MB) and System Prompt
(MB). Saving and loading are frontend actions — buttons on the node — so they
run over these routes rather than as part of a graph run."""

import os
import re

PACK_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Named slots the frontend asks for by key, so the pack's own folders are never
# spelled out client side.
FOLDERS = {
    "prompts": os.path.join(PACK_ROOT, "SavedPrompts"),
    "system": os.path.join(PACK_ROOT, "SystemPrompts"),
}
LABELS = {"prompts": "SavedPrompts", "system": "SystemPrompts"}

TEXT_EXTENSIONS = (".txt", ".md")
MAX_BYTES = 1_000_000  # a prompt file that big is a mistake, not a prompt
UNSAFE = re.compile(r"[^A-Za-z0-9 _.-]")


def pack_folder(key):
    """One of the pack's own folders, created on first use."""
    path = FOLDERS[key]
    os.makedirs(path, exist_ok=True)
    return path


def resolve_folder(folder, create=False):
    """A named slot, or any directory the user pointed the loader at. Returns
    None when the folder is not a directory that exists."""
    if not folder:
        folder = "prompts"
    if folder in FOLDERS:
        return pack_folder(folder)

    path = os.path.abspath(os.path.expanduser(folder))
    if create:
        os.makedirs(path, exist_ok=True)
    return path if os.path.isdir(path) else None


def folder_label(folder):
    return LABELS.get(folder, folder)


def safe_filename(filename, extension=".txt"):
    """Basename only, harmless characters only, always a text extension.
    Returns None when nothing usable is left."""
    name = UNSAFE.sub("_", os.path.basename((filename or "").strip())).strip(" .")
    if not name:
        return None
    if not name.lower().endswith(TEXT_EXTENSIONS):
        name += extension
    return name


def list_files(path):
    return sorted(
        f for f in os.listdir(path)
        if f.lower().endswith(TEXT_EXTENSIONS) and os.path.isfile(os.path.join(path, f))
    )


# ------------------------------------------------------------------- routes

try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.post("/mbnodes/save_prompt")
    async def _mbnodes_save_prompt(request):
        data = await request.json()
        name = safe_filename(data.get("filename"))
        if not name:
            return web.json_response({"error": "A filename is required."}, status=400)

        folder = data.get("folder") or "prompts"
        path = resolve_folder(folder, create=True)
        if not path:
            return web.json_response({"error": f"No such folder: {folder}"}, status=400)

        target = os.path.join(path, name)
        if os.path.exists(target) and not data.get("overwrite"):
            return web.json_response({"error": "exists", "filename": name}, status=409)

        with open(target, "w", encoding="utf-8") as f:
            f.write(data.get("text") or "")
        return web.json_response({
            "filename": name,
            "folder": folder_label(folder),
            "path": target,
        })

    @PromptServer.instance.routes.get("/mbnodes/prompt_files")
    async def _mbnodes_prompt_files(request):
        folder = request.query.get("folder") or "prompts"
        path = resolve_folder(folder)
        if not path:
            return web.json_response({"error": f"No such folder: {folder}"}, status=404)
        return web.json_response({"folder": folder_label(folder), "path": path,
                                  "files": list_files(path)})

    @PromptServer.instance.routes.get("/mbnodes/prompt_text")
    async def _mbnodes_prompt_text(request):
        folder = request.query.get("folder") or "prompts"
        path = resolve_folder(folder)
        name = safe_filename(request.query.get("filename"))
        if not path or not name:
            return web.json_response({"error": "Unknown file."}, status=404)

        # safe_filename() has already reduced the request to a basename, so the
        # read cannot climb out of the folder it was pointed at.
        target = os.path.join(path, name)
        if not os.path.isfile(target):
            return web.json_response({"error": f"No such file: {name}"}, status=404)
        if os.path.getsize(target) > MAX_BYTES:
            return web.json_response({"error": f"{name} is too big to load."}, status=413)

        with open(target, "r", encoding="utf-8", errors="replace") as f:
            return web.json_response({"filename": name, "text": f.read()})

except Exception:  # server missing (unit runs) or routes already registered
    pass
