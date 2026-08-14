"""MB Nodes — a V3 (comfy_api.latest) node pack.

The pack is loaded through the V3 entrypoint, so ComfyUI reads the schema each
node declares in define_schema() rather than a NODE_CLASS_MAPPINGS dict.
"""

from typing_extensions import override

from comfy_api.latest import ComfyExtension, io

from .nodes.crop_image_node import NODES as _crop_image
from .nodes.get_lines_node import NODES as _get_lines
from .nodes.load_image_node import NODES as _load_image
from .nodes.prompt_pad_node import NODES as _prompt_pad
from .nodes.resolution_node import NODES as _resolution
from .nodes.save_image_node import NODES as _save_image
from .nodes.save_mp4_node import NODES as _save_mp4
from .nodes.slider_node import NODES as _slider
from .nodes.text_node import NODES as _text
from .nodes.upscale_latent_node import NODES as _upscale_latent

NODES: list[type[io.ComfyNode]] = [
    *_text,
    *_resolution,
    *_slider,
    *_load_image,
    *_save_image,
    *_save_mp4,
    *_prompt_pad,
    *_get_lines,
    *_crop_image,
    *_upscale_latent,
]


class MBNodesExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return NODES


async def comfy_entrypoint() -> MBNodesExtension:
    return MBNodesExtension()


WEB_DIRECTORY = "./web"

__all__ = ["comfy_entrypoint", "WEB_DIRECTORY"]
