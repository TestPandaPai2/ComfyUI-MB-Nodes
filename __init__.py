"""MB Nodes — a V3 (comfy_api.latest) node pack.

The pack is loaded through the V3 entrypoint, so ComfyUI reads the schema each
node declares in define_schema() rather than a NODE_CLASS_MAPPINGS dict.
"""

import asyncio
import os
import sys
import tomllib

from typing_extensions import override

from comfy_api.latest import ComfyExtension, io

from .nodes.body_mod_prompt_node import NODES as _body_mod_prompt
from .nodes.branch_runner_node import NODES as _branch_runner
from .nodes.combine_text_node import NODES as _combine_text
from .nodes.compress_image_node import NODES as _compress_image
from .nodes.control_panel_node import NODES as _control_panel
from .nodes.crop_image_node import NODES as _crop_image
from .nodes.film_grain_node import NODES as _film_grain
from .nodes.get_lines_node import NODES as _get_lines
from .nodes.group_runner_node import NODES as _group_runner
from .nodes.image_to_svg_node import NODES as _image_to_svg
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
from .nodes.prompt_tags_node import NODES as _prompt_tags
from .nodes.prompt_expander_node import NODES as _prompt_expander
from .nodes.prompt_combiner_node import NODES as _prompt_combiner
from .nodes.random_line_node import NODES as _random_line
from .nodes.replace_text_advanced_node import NODES as _replace_text_advanced
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
from .nodes.dress_randomizer_node import NODES as _dress_randomizer
from .nodes.hairstyle_randomizer_node import NODES as _hairstyle_randomizer
from .nodes.background_randomizer_node import NODES as _background_randomizer
from .nodes.camera_angle_prompt_node import NODES as _camera_angle_prompt
from .nodes.expression_selector_node import NODES as _expression_selector
from .nodes.ethnicity_selector_node import NODES as _ethnicity_selector
from .nodes.style_modifier_node import NODES as _style_modifier
from .nodes.heel_randomizer_node import NODES as _heel_randomizer
from .nodes.body_type_node import NODES as _body_type
from .nodes.bounding_boxes_node import NODES as _bounding_boxes
from .nodes.pose_selector_node import NODES as _pose_selector
from .nodes.simple_standing_poses_node import NODES as _simple_standing_poses
from .nodes.wardrobe_selector_node import NODES as _wardrobe_selector
from .nodes.show_text_node import NODES as _show_text
from .nodes.slider_node import NODES as _slider
from .nodes.system_prompt_node import NODES as _system_prompt
from .nodes.text_node import NODES as _text
from .nodes.upscale_latent_node import NODES as _upscale_latent
from .nodes.wildcard_select_node import NODES as _wildcard_select
from .nodes.wildcard_view_all_node import NODES as _wildcard_view_all
from .nodes.word_remover_node import NODES as _word_remover

NODES: list[type[io.ComfyNode]] = [
    *_text,
    *_resolution,
    *_slider,
    *_load_image,
    *_load_image_crop_area,
    *_image_info,
    *_bounding_boxes,
    *_load_video,
    *_load_folder,
    *_model_combo,
    *_save_image,
    *_compress_image,
    *_image_to_svg,
    *_film_grain,
    *_save_mp4,
    *_save_video,
    *_prompt_pad,
    *_prompt_tags,
    *_system_prompt,
    *_prompt_expander,
    *_get_lines,
    *_combine_text,
    *_replace_text_advanced,
    *_word_remover,
    *_prompt_combiner,
    *_crop_image,
    *_upscale_latent,
    *_pad_image,
    *_rotate_image,
    *_branch_runner,
    *_group_runner,
    *_preview_anything,
    *_preview_audio,
    *_random_line,
    *_show_text,
    *_sampler,
    *_route66,
    *_krea_styles,
    *_control_panel,
    *_wildcard_select,
    *_wildcard_view_all,
    *_saree_randomizer,
    *_high_heels_randomizer,
    *_bodycon_randomizer,
    *_dress_randomizer,
    *_hairstyle_randomizer,
    *_background_randomizer,
    *_camera_angle_prompt,
    *_expression_selector,
    *_ethnicity_selector,
    *_style_modifier,
    *_heel_randomizer,
    *_body_mod_prompt,
    *_makeup_mod_prompt,
    *_lighting_enhance_prompt,
    *_body_type,
    *_pose_selector,
    *_simple_standing_poses,
    *_wardrobe_selector,
]


class MBNodesExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return NODES


async def comfy_entrypoint() -> MBNodesExtension:
    return MBNodesExtension()


def _restart():
    # comfy-cli watches for a .reboot marker and relaunches on exit.
    session = os.environ.get("__COMFY_CLI_SESSION__")
    if session:
        open(session + ".reboot", "w").close()
        os._exit(0)

    # Same relaunch command ComfyUI-Manager builds for a plain launch.
    argv = [a for a in sys.argv if a != "--windows-standalone-build"]
    if argv[0].endswith("__main__.py"):
        cmds = [sys.executable, "-m", os.path.basename(os.path.dirname(argv[0]))] + argv[1:]
    elif sys.platform.startswith("win32"):
        cmds = [f'"{sys.executable}"', f'"{argv[0]}"'] + argv[1:]
    else:
        cmds = [sys.executable] + argv
    print("\nRestarting...\n", flush=True)
    os.execv(sys.executable, cmds)


# Restart button in the top bar. Reading a JSON body keeps cross-origin
# <form> posts out: a browser won't send application/json without a CORS
# preflight, which this server does not answer.
try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.post("/mbnodes/restart")
    async def _mbnodes_restart(request):
        await request.json()
        # Reply first so the button's request completes, then relaunch.
        asyncio.get_running_loop().call_later(0.3, _restart)
        return web.json_response({"restarting": True})

    # Version and repo for the About row in the MB settings panel.
    @PromptServer.instance.routes.get("/mbnodes/about")
    async def _mbnodes_about(request):
        with open(os.path.join(os.path.dirname(__file__), "pyproject.toml"), "rb") as f:
            project = tomllib.load(f)["project"]
        return web.json_response({
            "version": project["version"],
            "repository": project["urls"]["Repository"],
            "nodes": len(NODES),
        })
except Exception:  # server missing (unit runs) or route already registered
    pass


WEB_DIRECTORY = "./web"

__all__ = ["comfy_entrypoint", "WEB_DIRECTORY"]
