"""LoRA Stack: row skipping, trigger-word sources and their order, and no
network call unless online_lookup is on. LoRA patching is mocked out.

Run from the ComfyUI root:

    python_embeded\python.exe -m pytest custom_nodes/ComfyUI-MB-Nodes/tests -q
"""

import json

import pytest
import torch
from safetensors.torch import save_file

import folder_paths

from mbnodes.nodes import lora_stack_node
from mbnodes.nodes.lora_stack_node import MBLoraStack


@pytest.fixture
def loras(tmp_path, monkeypatch):
    tensor = {"w": torch.zeros(1)}
    save_file(tensor, str(tmp_path / "info.safetensors"))
    (tmp_path / "info.civitai.info").write_text(json.dumps({"trainedWords": ["red hat, smile", "red hat"]}))
    (tmp_path / "info.metadata.json").write_text(json.dumps({"civitai": {"trainedWords": ["ignored"]}}))

    save_file(tensor, str(tmp_path / "manager.safetensors"))
    (tmp_path / "manager.metadata.json").write_text(json.dumps({"civitai": {"trainedWords": ["mgr word"]}}))

    save_file(tensor, str(tmp_path / "header.safetensors"),
              metadata={"ss_tag_frequency": json.dumps({"set": {"a": 1, "b": 9, "c": 5, "d": 3}})})
    save_file(tensor, str(tmp_path / "bare.safetensors"))

    monkeypatch.setitem(folder_paths.folder_names_and_paths, "loras", ([str(tmp_path)], {".safetensors"}))
    folder_paths.filename_list_cache.pop("loras", None)

    applied = []
    def fake_apply(model, clip, lora, sm, sc, lora_metadata=None):
        applied.append((sm, sc))
        return model, clip
    monkeypatch.setattr(lora_stack_node.comfy.sd, "load_lora_for_models", fake_apply)
    monkeypatch.setattr(lora_stack_node, "_triggers", {})
    yield applied
    folder_paths.filename_list_cache.pop("loras", None)


def run(rows, clip=None, online=False, hashing=False):
    return MBLoraStack.execute("model", json.dumps(rows), ", ", online, hashing, clip=clip).args


def test_sources_in_order(loras):
    out = run([
        {"on": True, "lora": "info.safetensors", "strength": 0.8},
        {"on": True, "lora": "manager.safetensors", "strength": 1},
        {"on": True, "lora": "header.safetensors", "strength": 1},
    ])
    assert out[2] == "red hat, smile, mgr word, b, c, d"
    assert out[3] == "info.safetensors @ 0.80\nmanager.safetensors @ 1.00\nheader.safetensors @ 1.00"


def test_skipped_rows(loras):
    out = run([
        {"on": False, "lora": "info.safetensors", "strength": 1},
        {"on": True, "lora": "manager.safetensors", "strength": 0},
        {"on": True, "lora": "", "strength": 1},
    ])
    assert out == ("model", None, "", "")
    assert loras == []


def test_model_only_gets_zero_clip_strength(loras):
    run([{"on": True, "lora": "bare.safetensors", "strength": 0.5}])
    run([{"on": True, "lora": "bare.safetensors", "strength": 0.5}], clip="clip")
    assert loras == [(0.5, 0), (0.5, 0.5)]


def test_no_network_unless_enabled(loras, monkeypatch):
    calls = []
    monkeypatch.setattr(lora_stack_node, "_civitai_words", lambda sha: calls.append(sha) or ["online"])

    assert run([{"on": True, "lora": "bare.safetensors", "strength": 1}])[2] == ""
    assert run([{"on": True, "lora": "bare.safetensors", "strength": 1}], online=True)[2] == ""
    assert calls == []  # no hash known and hashing off

    out = run([{"on": True, "lora": "bare.safetensors", "strength": 1}], online=True, hashing=True)
    assert out[2] == "online" and len(calls) == 1


def test_missing_file_raises(loras):
    with pytest.raises(FileNotFoundError):
        run([{"on": True, "lora": "gone.safetensors", "strength": 1}])
