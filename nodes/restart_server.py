"""Restart endpoint behind the sidebar's Restart button.

No node is defined here — the module only registers the route, the same way the
other nodes register their small helper endpoints.
"""

import asyncio
import logging
import os
import sys

RESTART_DELAY = 0.4  # seconds, long enough for the response to reach the browser


def _restart():
    """Replace this process with a fresh copy of the same command line."""
    logging.info("[MBNodes] restarting ComfyUI")
    sys.stdout.flush()
    sys.stderr.flush()
    os.execv(sys.executable, [sys.executable] + sys.argv)


try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.post("/mbnodes/restart")
    async def _mbnodes_restart(request):
        loop = asyncio.get_event_loop()
        loop.call_later(RESTART_DELAY, _restart)
        return web.json_response({"restarting": True})
except Exception:  # server missing (unit runs) or route already registered
    pass


NODES = []
