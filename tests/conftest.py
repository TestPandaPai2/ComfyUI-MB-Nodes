"""The pack folder has a hyphen in its name, so it cannot be imported as a
package. Load it under the name `mbnodes` the way ComfyUI loads it, with the
ComfyUI root on the path so `comfy_api` and `folder_paths` resolve.
"""

import importlib.util
import os
import sys

PACK_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COMFY_ROOT = os.path.dirname(os.path.dirname(PACK_DIR))

if COMFY_ROOT not in sys.path:
    sys.path.insert(0, COMFY_ROOT)

if "mbnodes" not in sys.modules:
    spec = importlib.util.spec_from_file_location(
        "mbnodes",
        os.path.join(PACK_DIR, "__init__.py"),
        submodule_search_locations=[PACK_DIR],
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["mbnodes"] = module
    spec.loader.exec_module(module)
