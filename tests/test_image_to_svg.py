r"""Covers Image To SVG: one valid SVG per image with a viewBox, a preview batch
the size of the input, every preset and Custom, RGBA and odd sizes, and that
the Accurate preset renders close to the source, and saving writes one .svg
per image.

Run from the ComfyUI root:

    python_embeded\python.exe -m pytest custom_nodes/ComfyUI-MBNodes/tests -q
"""

import os
import xml.etree.ElementTree as ET

import pytest
import torch

import folder_paths

from mbnodes.nodes.image_to_svg_node import CUSTOM, CUSTOM_INPUTS, PRESETS, MBImageToSVG


def _shapes(batch=1, height=64, width=96):
    """Gradient background with a red square and a blue disc."""
    y, x = torch.meshgrid(torch.linspace(0, 1, height), torch.linspace(0, 1, width), indexing="ij")
    image = torch.stack([x, y, 1 - x], dim=-1)
    image[height // 4: height // 2, width // 4: width // 2] = torch.tensor([1.0, 0.0, 0.0])
    disc = (x - 0.7) ** 2 + (y - 0.6) ** 2 < 0.04
    image[disc] = torch.tensor([0.0, 0.0, 1.0])
    return image.unsqueeze(0).repeat(batch, 1, 1, 1)


def _run(image, preset="Accurate (photo)", save=False, **custom):
    return MBImageToSVG.execute(image, {"preset": preset, **custom}, save, "t")


def _check_svg(svg, width, height):
    root = ET.fromstring(svg)
    assert root.tag.endswith("svg")
    assert root.get("viewBox") == f"0 0 {width} {height}"


@pytest.mark.parametrize("batch", [1, 3])
def test_one_svg_per_image_and_preview_matches_input(batch):
    image = _shapes(batch)
    svgs, preview = _run(image).result
    assert len(svgs) == batch
    for svg in svgs:
        _check_svg(svg, 96, 64)
    assert preview.shape == (batch, 64, 96, 3)
    assert preview.dtype == torch.float32
    assert 0.0 <= preview.min() and preview.max() <= 1.0


@pytest.mark.parametrize("preset", list(PRESETS))
def test_each_preset_runs(preset):
    svgs, preview = _run(_shapes(), preset).result
    _check_svg(svgs[0], 96, 64)
    assert preview.shape == (1, 64, 96, 3)


def test_custom_uses_its_own_settings():
    custom = {inp.id: inp.default for inp in CUSTOM_INPUTS}
    coarse = _run(_shapes(), CUSTOM, **custom | {"mode": "polygon", "color_precision": 2}).result[0][0]
    fine = _run(_shapes(), CUSTOM, **custom | {"color_precision": 8, "layer_difference": 4}).result[0][0]
    assert "C" not in coarse.split("<path", 1)[1].split('"')[1]  # polygon: no curve commands
    assert len(fine) > len(coarse)


@pytest.mark.parametrize("shape", [(1, 53, 37, 4), (1, 1, 1, 3), (1, 17, 9, 3)])
def test_rgba_odd_and_tiny_sizes(shape):
    image = torch.rand(shape)
    svgs, preview = _run(image).result
    _check_svg(svgs[0], shape[2], shape[1])
    assert preview.shape == (1, shape[1], shape[2], 3)


def test_solid_color_image():
    image = torch.full((1, 32, 32, 3), 0.5)
    svgs, preview = _run(image).result
    _check_svg(svgs[0], 32, 32)
    assert (preview - 0.5).abs().mean() < 0.02


def test_accurate_preset_is_close_to_source():
    image = _shapes(height=256, width=384)
    _, preview = _run(image).result
    assert (preview - image).abs().mean() < 0.03


def test_ui_carries_the_svgs():
    output = _run(_shapes(2))
    assert output.ui["svg"] == output.result[0]


def test_save_writes_one_file_per_image(tmp_path, monkeypatch):
    monkeypatch.setattr(folder_paths, "get_output_directory", lambda: str(tmp_path))
    output = _run(_shapes(2), save=True)
    assert len(output.ui["saved"]) == 2
    for path, svg in zip(output.ui["saved"], output.result[0]):
        assert path.endswith(".svg")
        with open(os.path.join(tmp_path, path), encoding="utf-8") as f:
            assert f.read() == svg


def test_no_files_when_save_is_off(tmp_path, monkeypatch):
    monkeypatch.setattr(folder_paths, "get_output_directory", lambda: str(tmp_path))
    output = _run(_shapes())
    assert "saved" not in output.ui
    assert not any(tmp_path.iterdir())
