"""Covers Film Grain: shape and range are kept, seeds are deterministic, batch
frames differ, mono grain is equal across channels, and alpha passes through.

Run from the ComfyUI root:

    python_embeded\python.exe -m pytest custom_nodes/ComfyUI-MB-Nodes/tests -q
"""

import pytest
import torch

from mbnodes.nodes.film_grain_node import MBFilmGrain


def _run(image, **kwargs):
    args = dict(preset="Custom", intensity=0.5, grain_size=1.5, color_amount=0.0, luminance_response=0.0, seed=0)
    args.update(kwargs)
    return MBFilmGrain.execute(image, **args).result[0].cpu()


@pytest.mark.parametrize("shape", [(1, 1, 1, 3), (1, 7, 13, 3), (3, 32, 48, 3)])
def test_shape_dtype_and_range(shape):
    image = torch.rand(shape)
    out = _run(image)
    assert out.shape == image.shape and out.dtype == image.dtype
    assert out.min() >= 0 and out.max() <= 1


def test_seed_is_deterministic():
    image = torch.full((1, 16, 16, 3), 0.5)
    assert torch.equal(_run(image, seed=1), _run(image, seed=1))
    assert not torch.equal(_run(image, seed=1), _run(image, seed=2))


def test_batch_frames_get_different_grain():
    out = _run(torch.full((2, 16, 16, 3), 0.5))
    assert not torch.equal(out[0], out[1])


def test_zero_intensity_returns_input():
    image = torch.rand(1, 8, 8, 3)
    assert torch.equal(_run(image, intensity=0.0), image)


def test_mono_grain_is_equal_across_channels():
    out = _run(torch.full((1, 16, 16, 3), 0.5), color_amount=0.0)
    assert torch.allclose(out[..., 0], out[..., 1]) and torch.allclose(out[..., 1], out[..., 2])


def test_rgba_alpha_passes_through():
    image = torch.rand(1, 16, 16, 4)
    out = _run(image)
    assert torch.equal(out[..., 3], image[..., 3])


def test_preset_ignores_sliders():
    image = torch.full((1, 16, 16, 3), 0.5)
    assert torch.equal(_run(image, preset="Tri-X 400", intensity=0.0), _run(image, preset="Tri-X 400", intensity=2.0))
