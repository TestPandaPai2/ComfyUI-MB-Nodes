from .nodes.text_node import NODE_CLASS_MAPPINGS as _m1, NODE_DISPLAY_NAME_MAPPINGS as _d1
from .nodes.resolution_node import NODE_CLASS_MAPPINGS as _m2, NODE_DISPLAY_NAME_MAPPINGS as _d2
from .nodes.slider_node import NODE_CLASS_MAPPINGS as _m3, NODE_DISPLAY_NAME_MAPPINGS as _d3
from .nodes.load_image_node import NODE_CLASS_MAPPINGS as _m4, NODE_DISPLAY_NAME_MAPPINGS as _d4
from .nodes.save_image_node import NODE_CLASS_MAPPINGS as _m5, NODE_DISPLAY_NAME_MAPPINGS as _d5
from .nodes.save_mp4_node import NODE_CLASS_MAPPINGS as _m6, NODE_DISPLAY_NAME_MAPPINGS as _d6
from .nodes.prompt_pad_node import NODE_CLASS_MAPPINGS as _m7, NODE_DISPLAY_NAME_MAPPINGS as _d7
from .nodes.get_lines_node import NODE_CLASS_MAPPINGS as _m8, NODE_DISPLAY_NAME_MAPPINGS as _d8

NODE_CLASS_MAPPINGS = {**_m1, **_m2, **_m3, **_m4, **_m5, **_m6, **_m7, **_m8}
NODE_DISPLAY_NAME_MAPPINGS = {**_d1, **_d2, **_d3, **_d4, **_d5, **_d6, **_d7, **_d8}

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
