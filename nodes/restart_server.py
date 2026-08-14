"""Restart endpoint behind the sidebar's Restart button.

No node is defined here — the module only registers the route, the same way the
other nodes register their small helper endpoints.
"""

import asyncio
import json
import logging
import os
import subprocess
import sys

RESTART_DELAY = 0.4  # seconds, long enough for the response to reach the browser

# Handing the relaunch to a detached helper rather than calling os.execv here:
# the new process has to wait for this one to die, otherwise it races it for the
# server port and exits with "address already in use" instead of coming back.
_LAUNCHER = r"""
import json, os, socket, subprocess, sys, time

cfg = json.loads(sys.argv[1])
deadline = time.time() + 60

while time.time() < deadline:
    with socket.socket() as probe:
        probe.settimeout(0.5)
        try:
            probe.connect((cfg["host"], cfg["port"]))
        except OSError:
            break  # nothing listening any more, the old process is gone
    time.sleep(0.5)

kwargs = {"cwd": cfg["cwd"]}
if os.name == "nt":
    kwargs["creationflags"] = subprocess.CREATE_NEW_CONSOLE
subprocess.Popen(cfg["cmd"], **kwargs)
"""


def _restart():
    """Start the relaunch helper, then quit so it can take the port."""
    from comfy.cli_args import args

    host = args.listen if args.listen not in ("0.0.0.0", "::") else "127.0.0.1"
    config = json.dumps(
        {
            "cmd": [sys.executable] + sys.argv,
            "cwd": os.getcwd(),
            "host": host,
            "port": args.port,
        }
    )

    logging.info("[MBNodes] restarting ComfyUI")
    sys.stdout.flush()
    sys.stderr.flush()

    kwargs = {"cwd": os.getcwd()}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    else:
        kwargs["start_new_session"] = True
    subprocess.Popen([sys.executable, "-c", _LAUNCHER, config], **kwargs)

    os._exit(0)


try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.post("/mbnodes/restart")
    async def _mbnodes_restart(request):
        logging.info("[MBNodes] restart requested from the sidebar")
        loop = asyncio.get_event_loop()
        loop.call_later(RESTART_DELAY, _restart)
        return web.json_response({"restarting": True})
except Exception as error:  # server missing (unit runs) or route already registered
    logging.warning("[MBNodes] restart route not registered: %s", error)


NODES = []
