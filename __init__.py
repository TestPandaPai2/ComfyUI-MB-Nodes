"""MB Nodes — a V3 (comfy_api.latest) node pack.

The pack is loaded through the V3 entrypoint, so ComfyUI reads the schema each
node declares in define_schema() rather than a NODE_CLASS_MAPPINGS dict.
"""

from typing_extensions import override

from comfy_api.latest import ComfyExtension, io

from .nodes.body_mod_prompt_node import NODES as _body_mod_prompt
from .nodes.branch_runner_node import NODES as _branch_runner
from .nodes.combine_text_node import NODES as _combine_text
from .nodes.control_panel_node import NODES as _control_panel
from .nodes.crop_image_node import NODES as _crop_image
from .nodes.get_lines_node import NODES as _get_lines
from .nodes.image_info import NODES as _image_info
from .nodes.krea_styles_node import NODES as _krea_styles
from .nodes.lighting_enhance_prompt_node import NODES as _lighting_enhance_prompt
from .nodes.load_folder_node import NODES as _load_folder
from .nodes.load_image_crop_area_node import NODES as _load_image_crop_area
from .nodes.load_image_node import NODES as _load_image
from .nodes.load_video_node import NODES as _load_video
from .nodes.makeup_mod_prompt_node import NODES as _makeup_mod_prompt
from .nodes.model_combo_node import NODES as _model_combo
from .nodes.pad_image_node import NODES as _pad_image
from .nodes.preview_anything_node import NODES as _preview_anything
from .nodes.preview_audio_node import NODES as _preview_audio
from .nodes.prompt_pad_node import NODES as _prompt_pad
from .nodes.random_line_node import NODES as _random_line
from .nodes.resolution_node import NODES as _resolution
from .nodes.rotate_image_node import NODES as _rotate_image
from .nodes.route66_node import NODES as _route66
from .nodes.sampler_node import NODES as _sampler
from .nodes.save_image_node import NODES as _save_image
from .nodes.save_mp4_node import NODES as _save_mp4
from .nodes.save_video_node import NODES as _save_video
from .nodes.saree_randomizer_node import NODES as _saree_randomizer
from .nodes.high_heels_randomizer_node import NODES as _high_heels_randomizer
from .nodes.bodycon_randomizer_node import NODES as _bodycon_randomizer
from .nodes.body_type_node import NODES as _body_type
from .nodes.show_text_node import NODES as _show_text
from .nodes.slider_node import NODES as _slider
from .nodes.system_prompt_node import NODES as _system_prompt
from .nodes.text_node import NODES as _text
from .nodes.upscale_latent_node import NODES as _upscale_latent
from .nodes.wildcard_select_node import NODES as _wildcard_select

NODES: list[type[io.ComfyNode]] = [
    *_text,
    *_resolution,
    *_slider,
    *_load_image,
    *_load_image_crop_area,
    *_image_info,
    *_load_video,
    *_load_folder,
    *_model_combo,
    *_save_image,
    *_save_mp4,
    *_save_video,
    *_prompt_pad,
    *_system_prompt,
    *_get_lines,
    *_combine_text,
    *_crop_image,
    *_upscale_latent,
    *_pad_image,
    *_rotate_image,
    *_branch_runner,
    *_preview_anything,
    *_preview_audio,
    *_random_line,
    *_show_text,
    *_sampler,
    *_route66,
    *_krea_styles,
    *_control_panel,
    *_wildcard_select,
    *_saree_randomizer,
    *_high_heels_randomizer,
    *_bodycon_randomizer,
    *_body_mod_prompt,
    *_makeup_mod_prompt,
    *_lighting_enhance_prompt,
    *_body_type,
]


class MBNodesExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return NODES


async def comfy_entrypoint() -> MBNodesExtension:
    return MBNodesExtension()


WEB_DIRECTORY = "./web"

__all__ = ["comfy_entrypoint", "WEB_DIRECTORY"]
