"""Covers the image_info bundle: alpha extraction, and the mask staying lined up
with the image through a crop, a resize and a save.

Run from the ComfyUI root:

    python_embeded\python.exe -m pytest custom_nodes/ComfyUI-MB-Nodes/tests -q
"""

import os
import tempfile

import numpy as np
import pytest
import torch
from PIL import Image

import folder_paths

from mbnodes.nodes import image_info
from mbnodes.nodes.crop_image_node import MBImageCrop
from mbnodes.nodes.image_info import MBImageInfo
from mbnodes.nodes.load_image_crop_node import MBLoadImageCrop
from mbnodes.nodes.load_image_node import MBLoadImage
from mbnodes.nodes.save_image_node import MBSaveImage


@pytest.fixture
def rgba_file():
    """128x64 RGBA, left half transparent, in the ComfyUI input folder."""
    name = "_mb_test_alpha.png"
    path = os.path.join(folder_paths.get_input_directory(), name)
    array = np.zeros((64, 128, 4), dtype=np.uint8)
    array[..., :3] = 200
    array[:, 64:, 3] = 255
    Image.fromarray(array, "RGBA").save(path)
    yield name
    os.remove(path)


class _Hidden:
    prompt = None
    extra_pnginfo = None
    unique_id = "test"


def test_alpha_becomes_a_mask(rgba_file):
    out = MBLoadImage.execute(rgba_file, False, "1.0").args
    info = out[4]

    assert (info["width"], info["height"]) == (128, 64)
    assert info["filename"] == rgba_file
    assert info["mask"].shape == (1, 64, 128)
    assert info["mask"][0, 0, 0] == 1.0    # transparent half
    assert info["mask"][0, 0, 100] == 0.0  # opaque half


def test_no_alpha_gives_no_mask(tmp_path):
    name = "_mb_test_rgb.png"
    path = os.path.join(folder_paths.get_input_directory(), name)
    Image.fromarray(np.full((32, 32, 3), 128, dtype=np.uint8), "RGB").save(path)
    try:
        assert MBLoadImage.execute(name, False, "1.0").args[4]["mask"] is None
    finally:
        os.remove(path)


def test_resize_keeps_the_mask_in_step(rgba_file):
    image, _, _, _, info = MBLoadImage.execute(rgba_file, True, "0.25").args
    assert info["mask"].shape[1:] == image.shape[1:3]


def test_crop_selects_the_right_half_of_the_mask(rgba_file):
    # Right half of the source is opaque, so its mask is all zeros.
    info = MBLoadImageCrop.execute(
        rgba_file, False, "1.0", "free", "1", 0.5, 0.0, 0.5, 1.0
    ).args[4]
    assert info["mask"].shape == (1, 64, 64)
    assert float(info["mask"].max()) == 0.0

    # Left half is transparent, so its mask is all ones.
    info = MBLoadImageCrop.execute(
        rgba_file, False, "1.0", "free", "1", 0.0, 0.0, 0.5, 1.0
    ).args[4]
    assert float(info["mask"].min()) == 1.0


def test_a_mismatched_mask_is_resized_not_sliced_blindly():
    """The regression this guards: a mask at another resolution used to be
    sliced with image-space coordinates and came out misaligned."""
    image = torch.zeros(1, 64, 64, 3)
    mask = torch.zeros(1, 16, 16)
    mask[:, :8, :] = 1.0  # top half masked, at a quarter of the image size

    fitted = image_info.fit_mask(mask, image)
    assert fitted.shape == (1, 64, 64)
    assert float(fitted[0, :32, :].min()) == 1.0   # top half still masked
    assert float(fitted[0, 32:, :].max()) == 0.0   # bottom half still clear


def test_an_unbroadcastable_batch_is_dropped_rather_than_misaligned():
    image = torch.zeros(3, 8, 8, 3)
    assert image_info.fit_mask(torch.zeros(2, 8, 8), image) is None
    assert image_info.fit_mask(torch.zeros(1, 8, 8), image).shape == (3, 8, 8)


def test_crop_inherits_the_filename_from_the_bundle():
    image = torch.zeros(1, 32, 32, 3)
    MBImageCrop.hidden = _Hidden()
    source = image_info.make(image, None, "source.png")

    out = MBImageCrop.execute(image, "free", "1", 0.0, 0.0, 0.5, 1.0, None, source).args
    assert out[1] == 16
    assert out[3]["filename"] == "source.png"


def test_unpack_substitutes_a_zero_mask():
    image = torch.zeros(2, 8, 16, 3)
    out = MBImageInfo.execute(image_info.make(image, None, "")).args
    assert out[1].shape == (2, 8, 16)
    assert float(out[1].max()) == 0.0


def test_save_writes_alpha_and_reports_every_filename():
    MBSaveImage.hidden = _Hidden()
    images = torch.rand(2, 16, 24, 3)
    mask = torch.zeros(2, 16, 24)
    mask[:, :, :12] = 1.0  # left half transparent

    folder = tempfile.mkdtemp()
    info = MBSaveImage.execute(
        images, "save", "png", "MBTest", folder, 90, 4, False, mask
    ).args[0]

    assert len(info["filenames"]) == 2
    assert info["filename"] == info["filenames"][0]
    assert all(os.path.isfile(p) for p in info["filenames"])

    saved = Image.open(info["filenames"][0])
    assert saved.mode == "RGBA"
    alpha = np.array(saved.getchannel("A"))
    assert alpha[0, 0] == 0      # masked pixel is transparent
    assert alpha[0, 20] == 255   # unmasked pixel is opaque


def test_preview_mode_reports_no_filename():
    MBSaveImage.hidden = _Hidden()
    info = MBSaveImage.execute(
        torch.rand(1, 8, 8, 3), "preview", "png", "MBTest", tempfile.mkdtemp(), 90, 4, False, None
    ).args[0]
    assert info["filename"] == ""
    assert info["filenames"] == []
