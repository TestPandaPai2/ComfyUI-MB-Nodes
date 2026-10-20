"""Covers Pad Image: manual colour pads, the outpaint mask and its feather, the
fill modes, target size / aspect ratio / multiple-of sizing, transparency, the
seam blend, and the image_info mask growing with zeros.

Run from the ComfyUI root:

    python_embeded\python.exe -m pytest custom_nodes/ComfyUI-MB-Nodes/tests -q
"""

import pytest
import torch

from mbnodes.nodes.pad_image_node import MBPadImage

MANUAL = {"size_mode": "manual"}


def _run(image, left=0, right=0, top=0, bottom=0, **kwargs):
    args = dict(
        color="#ff0000", size_mode=MANUAL, fill_mode="color", multiple_of="off",
        transparent=False, mask_feather=0, seam_blend=0,
    )
    args.update(kwargs)
    return MBPadImage.execute(image, left, right, top, bottom, **args).result


def test_manual_color_matches_old_behaviour():
    image = torch.rand(2, 5, 7, 3)
    out, _, mask = _run(image, left=2, right=1, top=3, bottom=0)
    assert out.shape == (2, 8, 10, 3)
    assert torch.equal(out[:, 3:, 2:9], image)
    assert torch.equal(out[:, 0, 0], torch.tensor([[1.0, 0.0, 0.0]] * 2))
    assert mask.shape == (2, 8, 10)
    assert mask[:, 3:, 2:9].sum() == 0
    assert mask.sum() == 2 * (80 - 35)


def test_no_pad_returns_input():
    image = torch.rand(1, 4, 4, 3)
    out, _, mask = _run(image)
    assert out is image
    assert mask.sum() == 0


@pytest.mark.parametrize("channels", [1, 3, 4])
@pytest.mark.parametrize("fill_mode", ["color", "replicate", "reflect", "blur edge"])
def test_fill_modes_keep_original_and_channels(channels, fill_mode):
    image = torch.rand(2, 5, 3, channels)
    out, _, _ = _run(image, left=4, right=9, top=1, bottom=6, fill_mode=fill_mode)
    assert out.shape == (2, 12, 16, channels)
    assert torch.equal(out[:, 1:6, 4:7], image)
    assert out.min() >= 0 and out.max() <= 1


def test_replicate_and_reflect_values():
    image = torch.arange(3.0).view(1, 1, 3, 1).expand(1, 2, 3, 1) / 2
    rep, _, _ = _run(image, left=2, fill_mode="replicate")
    assert rep[0, 0, :, 0].tolist() == [0.0, 0.0, 0.0, 0.5, 1.0]
    ref, _, _ = _run(image, left=2, right=5, fill_mode="reflect")
    assert ref[0, 0, :, 0].tolist() == [1.0, 0.5, 0.0, 0.5, 1.0, 0.5, 0.0, 0.5, 1.0, 0.5]


def test_reflect_single_pixel_does_not_crash():
    out, _, _ = _run(torch.rand(1, 1, 1, 3), left=5, top=5, fill_mode="reflect")
    assert out.shape == (1, 6, 6, 3)


def test_mask_feather_ramps_into_original():
    image = torch.rand(1, 4, 8, 3)
    _, _, mask = _run(image, left=2, mask_feather=3)
    row = mask[0, 0].tolist()
    assert row[:2] == [1.0, 1.0]
    assert row[2:6] == pytest.approx([0.75, 0.5, 0.25, 0.0])
    assert row[6:] == [0.0, 0.0]


def test_target_size_anchors_and_never_crops():
    image = torch.rand(1, 10, 20, 3)
    size = {"size_mode": "target size", "width": 31, "height": 6, "anchor": "center"}
    out, _, _ = _run(image, size_mode=size)
    assert out.shape == (1, 10, 31, 3)
    assert torch.equal(out[:, :, 5:25], image)

    size["anchor"] = "top-right"
    size["height"] = 14
    out, _, _ = _run(image, size_mode=size)
    assert torch.equal(out[:, :10, 11:], image)


def test_manual_pads_ignored_outside_manual_mode():
    image = torch.rand(1, 10, 10, 3)
    out, _, _ = _run(image, left=50, size_mode={"size_mode": "target size", "width": 10, "height": 10, "anchor": "center"})
    assert out is image


@pytest.mark.parametrize("ratio,shape", [("16:9", (10, 18)), ("1:1", (10, 10)), ("9:16", (18, 10))])
def test_aspect_ratio(ratio, shape):
    image = torch.rand(1, 10, 10, 3)
    out, _, _ = _run(image, size_mode={"size_mode": "aspect ratio", "ratio": ratio, "anchor": "center"})
    assert out.shape[1:3] == shape


@pytest.mark.parametrize("multiple", ["8", "64"])
def test_multiple_of(multiple):
    n = int(multiple)
    out, _, _ = _run(torch.rand(1, 37, 50, 3), left=3, multiple_of=multiple)
    assert out.shape[1] % n == 0 and out.shape[2] % n == 0
    assert out.shape[1] >= 37 and out.shape[2] >= 53


def test_transparent_adds_alpha():
    image = torch.rand(1, 4, 4, 3)
    out, _, _ = _run(image, right=3, transparent=True, fill_mode="replicate")
    assert out.shape[3] == 4
    assert out[0, :, :4, 3].eq(1).all()
    assert out[0, :, 4:, 3].eq(0).all()
    assert torch.equal(out[0, :, 4:, :3], image[0, :, 3:4].expand(4, 3, 3))


def test_seam_blend_fades_and_keeps_inside():
    image = torch.ones(1, 3, 4, 3)
    out, _, _ = _run(image, right=6, color="#000000", seam_blend=3)
    assert torch.equal(out[:, :, :4], image)
    assert out[0, 0, 4:, 0].tolist() == pytest.approx([0.75, 0.5, 0.25, 0.0, 0.0, 0.0])


def test_info_mask_grows_with_zeros():
    image = torch.rand(1, 4, 4, 3)
    info = {"mask": torch.ones(1, 4, 4), "filename": "a.png"}
    _, info, _ = _run(image, left=2, image_info=info)
    assert info["mask"].shape == (1, 4, 6)
    assert info["mask"][:, :, :2].sum() == 0 and info["mask"][:, :, 2:].eq(1).all()
