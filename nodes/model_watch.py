"""Pushes model folder changes to open pages, so MB Load Models Combo and MB LoRA
Stack update without a reload. Only reads file names and sizes, so loaded models
are never touched. get_filename_list only rescans a folder whose mtime changed."""

import logging
import os
import threading
import time

import folder_paths

from .model_combo_node import _vae_list

POLL_SECONDS = 3
EVENT = "mbnodes.model_lists"

LISTS = {
    "unet_name": lambda: folder_paths.get_filename_list("diffusion_models"),
    "clip_name": lambda: folder_paths.get_filename_list("text_encoders"),
    "vae_name": _vae_list,
    "loras": lambda: folder_paths.get_filename_list("loras"),
}
FOLDERS = {"unet_name": "diffusion_models", "clip_name": "text_encoders", "vae_name": "vae", "loras": "loras"}


def _size(key, name):
    path = folder_paths.get_full_path(FOLDERS[key], name)
    if path is None:  # vae_list entries that are not files in the vae folder
        return -1
    try:
        return os.path.getsize(path)
    except OSError:
        return None


class Watcher:
    def __init__(self):
        self.current = {key: list(read()) for key, read in LISTS.items()}
        self.pending = {}  # (key, name) -> size at the last poll, while a file may still be downloading

    def poll(self):
        """Returns True when a list changed. A new file joins once its size holds
        for one poll, so a download writing to its final name stays out until done."""
        changed = False
        for key, read in LISTS.items():
            names = list(read())
            known = set(self.current[key])
            ready = []
            for name in names:
                if name in known:
                    ready.append(name)
                    continue
                size = _size(key, name)
                if size and self.pending.get((key, name)) == size:
                    ready.append(name)
                    self.pending.pop((key, name))
                else:
                    self.pending[(key, name)] = size
            if ready != self.current[key]:
                self.current[key] = ready
                changed = True
        return changed


def _run(watcher, server):
    while True:
        time.sleep(POLL_SECONDS)
        try:
            if watcher.poll():
                server.send_sync(EVENT, watcher.current)
        except Exception as e:
            logging.warning(f"[MBNodes] model folder watch: {e}")


try:
    from server import PromptServer
    from aiohttp import web

    _watcher = Watcher()

    @PromptServer.instance.routes.get("/mbnodes/model_lists")
    async def _mbnodes_model_lists(request):
        return web.json_response(_watcher.current)

    threading.Thread(target=_run, args=(_watcher, PromptServer.instance), daemon=True, name="MBNodes model watch").start()
except ImportError:  # server missing (unit runs)
    pass
