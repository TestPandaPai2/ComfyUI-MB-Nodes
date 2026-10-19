"""Covers Compress Image: each format writes, target_kb is honoured, resize
never upscales, and the mask reaches png alpha while jpg is flattened.

Run from the ComfyUI root:

    python_embeded\python.exe -m pytest custom_nodes/ComfyUI-MBNodes/tests -q
"""

import os

import pytest
import torch
from PIL import Image

import folder_paths

from mbnodes.nodes.compress_image_node import MBCompressImage, _fit


@pytest.fixture
def output_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(folder_paths, "get_output_directory", lambda: str(tmp_path))
    return tmp_path


def _run(images, **kwargs):
    args = dict(format="jpg", quality=85, target_kb=0, max_dimension=0, webp_lossless=False, filename_prefix="t")
    args.update(kwargs)
    return MBCompressImage.execute(images, **args).ui


def _paths(result, output_dir):
    return [os.path.join(output_dir, r["subfolder"], r["filename"]) for r in result["images"]]


@pytest.mark.parametrize("fmt", ["jpg", "webp", "png"])
def test_each_format_writes_every_image(output_dir, fmt):
    result = _run(torch.rand(2, 33, 47, 3), format=fmt)
    paths = _paths(result, output_dir)
    assert len(paths) == 2
    for path in paths:
        assert path.endswith(f".{fmt}")
        with Image.open(path) as img:
            assert img.size == (47, 33)
    assert len(result["text"][0].splitlines()) == 2


def test_target_kb_is_respected(output_dir):
    result = _run(torch.rand(1, 256, 256, 3), format="jpg", quality=100, target_kb=20)
    assert os.path.getsize(_paths(result, output_dir)[0]) <= 20 * 1024


def test_resize_shrinks_longest_side_and_never_upscales():
    assert _fit(Image.new("RGB", (400, 200)), 100).size == (100, 50)
    assert _fit(Image.new("RGB", (40, 20)), 100).size == (40, 20)


def test_mask_becomes_png_alpha_and_jpg_is_flattened(output_dir):
    images = torch.zeros(1, 16, 16, 3)
    mask = torch.ones(1, 8, 8)  # other size: resized onto the image

    png = _paths(_run(images, format="png", mask=mask), output_dir)[0]
    with Image.open(png) as img:
        assert img.mode == "RGBA" and img.getpixel((0, 0))[3] == 0

    jpg = _paths(_run(images, format="jpg", mask=mask), output_dir)[0]
    with Image.open(jpg) as img:
        assert min(img.convert("RGB").getpixel((0, 0))) > 240
