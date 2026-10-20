r"""Covers Save Image (MB): preset mapping, avif with alpha, the pass-through
output, size stats, the compare payload and the live re-encode.

Run from the ComfyUI root:

    python_embeded\python.exe -m pytest custom_nodes/ComfyUI-MB-Nodes/tests -q
"""

import pytest
import torch
from PIL import Image, features

import folder_paths

from mbnodes.nodes import save_image_node
from mbnodes.nodes.save_image_node import MBSaveImage, _params, _reencode, _read_manifest


class _Hidden:
    prompt = None
    extra_pnginfo = None
    unique_id = "savetest"


@pytest.fixture
def output_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(folder_paths, "get_output_directory", lambda: str(tmp_path))
    MBSaveImage.hidden = _Hidden()
    return tmp_path


def _run(images, **kwargs):
    args = dict(
        mode="save", format="png", filename_prefix="t", output_folder="", quality=90,
        png_compress_level=4, webp_lossless=False, mask=None, preset="custom", compare_image=None,
    )
    args.update(kwargs)
    return MBSaveImage.execute(images, **args)


def test_custom_preset_uses_the_widgets():
    assert _params("webp", "custom", 70, 3, True) == (70, 3, True)


def test_presets_map_per_format():
    assert _params("avif", "visually_lossless", 10, 0, False) == (90, 9, False)
    assert _params("jpg", "small", 10, 0, False) == (78, 9, False)
    assert _params("webp", "lossless", 10, 0, False)[2] is True
    assert _params("png", "balanced", 10, 0, False)[1] == 9


def test_images_output_is_the_input(output_dir):
    images = torch.rand(2, 8, 8, 3)
    out = _run(images, mode="preview")
    assert out.args[0] is images


@pytest.mark.skipif(not features.check("avif"), reason="Pillow built without AVIF")
def test_avif_keeps_alpha(output_dir):
    mask = torch.zeros(1, 16, 16)
    mask[:, :, :8] = 1.0
    info = _run(torch.rand(1, 16, 16, 3), format="avif", preset="visually_lossless", mask=mask).args[1]
    saved = Image.open(info["filename"])
    assert saved.format == "AVIF"
    assert saved.mode == "RGBA"


def test_stats_report_size_and_png_baseline(output_dir):
    stats = _run(torch.rand(2, 32, 32, 3), mode="preview", format="webp", preset="small").ui["mb_stats"]
    assert len(stats) == 2
    assert stats[0]["format"] == "webp"
    assert 0 < stats[0]["bytes"] < stats[0]["png_bytes"]


def test_compare_moves_previews_off_the_stock_key(output_dir):
    node_ui = _run(torch.rand(3, 8, 8, 3), mode="preview", compare_image=torch.rand(2, 8, 8, 3)).ui
    assert "images" not in node_ui
    assert len(node_ui["mb_images"]) == 3
    assert len(node_ui["mb_compare_images"]) == 3  # wrapped by batch index


def test_reencode_switches_format_without_a_run(output_dir):
    _run(torch.rand(1, 16, 16, 3), mode="preview", format="png")
    key = save_image_node._cache_key(None, "savetest")
    manifest = _reencode(key, "jpg", 80, 6, False)
    assert manifest["stats"][0]["format"] == "jpg"
    assert manifest["images"][0].endswith(".jpg")
    assert _read_manifest(key)["images"] == manifest["images"]


def test_reencode_without_a_run_returns_none(output_dir):
    assert _reencode("never_ran", "png", 90, 4, False) is None
