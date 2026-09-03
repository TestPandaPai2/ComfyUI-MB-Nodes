"""Covers the Civitai reader: sidecar precedence, embedded fallback, the
online lookup and the shape of the output tuple.

Run from the ComfyUI root:

    python_embeded\\python.exe -m pytest custom_nodes/ComfyUI-MB-Nodes/tests -q
"""

import json
import struct

import pytest
import folder_paths
from mbnodes.nodes import civitai_info_node as ci
from mbnodes.nodes.civitai_info_node import MBCivitaiInfo

# Positions in the output tuple, in schema order.
FOUND, SOURCE, MODEL_NAME, VERSION_NAME, MODEL_TYPE, BASE_MODEL, CREATOR = range(7)
TRAINED_WORDS, TAGS, DESCRIPTION, URL, DOWNLOAD_URL, IMAGE_URLS = range(7, 13)
AIR, SHA256, MODEL_ID, VERSION_ID, NSFW, FILE_NAME, JSON = range(13, 20)

VERSION = {
    "id": 2514310,
    "modelId": 827184,
    "name": "v160",
    "baseModel": "Illustrious",
    "nsfwLevel": 1,
    "air": "urn:air:sdxl:checkpoint:civitai:827184@2514310",
    "description": "<p>Line one</p><p>Two &amp; three</p>",
    "trainedWords": ["masterpiece", "masterpiece", "best quality"],
    "downloadUrl": "https://civitai.com/api/download/models/2514310",
    "creator": {"username": "WAI0731"},
    "model": {"name": "WAI-illustrious-SDXL", "type": "Checkpoint", "nsfw": True},
    "files": [{"hashes": {"SHA256": "A" * 64}}],
    "images": [{"url": "https://image.civitai.com/one.jpeg"}, {"nope": 1}],
}


def write_safetensors(path, metadata):
    header = json.dumps({"__metadata__": metadata}).encode("utf-8")
    with open(path, "wb") as f:
        f.write(struct.pack("<Q", len(header)))
        f.write(header)


@pytest.fixture
def loras(tmp_path, monkeypatch):
    monkeypatch.setitem(
        folder_paths.folder_names_and_paths, "loras", ([str(tmp_path)], {".safetensors"})
    )
    folder_paths.filename_list_cache.pop("loras", None)
    write_safetensors(tmp_path / "thing.safetensors", {"format": "pt"})
    yield tmp_path
    folder_paths.filename_list_cache.pop("loras", None)


def run(model="thing.safetensors", online=False, hashing=False):
    return MBCivitaiInfo.execute("loras", model, online, hashing).args


def test_html_becomes_plain_text():
    assert ci.strip_html("<p>Line one</p><p>Two &amp; three</p>") == "Line one\n\nTwo & three"


def test_lists_of_dicts_and_strings_both_flatten():
    assert ci.join_lines(["a", "a", "b"]) == "a\nb"
    assert ci.join_lines([{"name": "a"}, {"tag": "b"}]) == "a\nb"
    assert ci.join_lines(None) == ""


def test_the_file_hash_wins_over_the_wrapper_hash():
    assert ci.sha_from(VERSION, {"sha256": "b" * 64}) == "a" * 64
    assert ci.sha_from({}, {"sha256": "B" * 64}) == "b" * 64
    assert ci.sha_from({}, {}) == ""


def test_a_civitai_info_sidecar_is_read(loras):
    (loras / "thing.civitai.info").write_text(json.dumps(VERSION), encoding="utf-8")
    out = run()
    assert out[FOUND] is True
    assert out[SOURCE] == "civitai.info"
    assert out[MODEL_NAME] == "WAI-illustrious-SDXL"
    assert out[VERSION_NAME] == "v160"
    assert out[MODEL_TYPE] == "Checkpoint"
    assert out[BASE_MODEL] == "Illustrious"
    assert out[CREATOR] == "WAI0731"
    assert out[TRAINED_WORDS] == "masterpiece\nbest quality"
    assert out[DESCRIPTION] == "Line one\n\nTwo & three"
    assert out[URL] == "https://civitai.com/models/827184?modelVersionId=2514310"
    assert out[IMAGE_URLS] == "https://image.civitai.com/one.jpeg"
    assert out[SHA256] == "a" * 64
    assert out[MODEL_ID] == 827184
    assert out[VERSION_ID] == 2514310
    assert out[NSFW] is True
    assert json.loads(out[JSON])["id"] == 2514310


def test_a_metadata_json_wrapper_is_unwrapped(loras):
    (loras / "thing.metadata.json").write_text(
        json.dumps({"civitai": VERSION, "tags": ["anime", "style"], "sha256": "c" * 64}),
        encoding="utf-8",
    )
    out = run()
    assert out[SOURCE] == "metadata.json"
    assert out[TAGS] == "anime\nstyle"
    # The version's own file hash still outranks the wrapper's cached one.
    assert out[SHA256] == "a" * 64


def test_the_civitai_info_sidecar_outranks_the_wrapper(loras):
    (loras / "thing.civitai.info").write_text(json.dumps(VERSION), encoding="utf-8")
    (loras / "thing.metadata.json").write_text(
        json.dumps({"civitai": {"id": 1, "name": "wrong"}}), encoding="utf-8"
    )
    assert run()[VERSION_NAME] == "v160"


def test_embedded_training_metadata_is_the_fallback(loras):
    write_safetensors(
        loras / "thing.safetensors",
        {
            "modelspec.title": "Snapshot",
            "ss_base_model_version": "sdxl_base_v1-0",
            "ss_tag_frequency": json.dumps({"set": {"photo": 40, "grain": 12}}),
        },
    )
    out = run()
    assert out[FOUND] is True
    assert out[SOURCE] == "embedded"
    assert out[MODEL_NAME] == "Snapshot"
    assert out[BASE_MODEL] == "sdxl_base_v1-0"
    assert out[TAGS] == "photo\ngrain"
    assert out[MODEL_ID] == 0


def test_a_bare_model_reports_nothing_found(loras):
    out = run()
    assert out[FOUND] is False
    assert out[SOURCE] == "none"
    assert out[FILE_NAME] == "thing.safetensors"
    assert out[JSON] == ""


def test_a_missing_file_reports_nothing_found(loras):
    assert run("gone.safetensors")[FOUND] is False


def test_the_api_is_not_called_unless_asked(loras, monkeypatch):
    monkeypatch.setattr(ci, "api_by_hash", lambda sha: pytest.fail("api was called"))
    monkeypatch.setattr(ci, "file_sha256", lambda path: pytest.fail("file was hashed"))
    assert run()[FOUND] is False


def test_the_api_fills_in_when_the_sidecars_miss(loras, monkeypatch):
    monkeypatch.setattr(ci, "file_sha256", lambda path: "d" * 64)
    monkeypatch.setattr(ci, "api_by_hash", lambda sha: VERSION if sha == "d" * 64 else None)
    out = run(online=True, hashing=True)
    assert out[SOURCE] == "api"
    assert out[MODEL_NAME] == "WAI-illustrious-SDXL"


def test_hashing_stays_off_unless_allowed(loras, monkeypatch):
    monkeypatch.setattr(ci, "file_sha256", lambda path: pytest.fail("file was hashed"))
    monkeypatch.setattr(ci, "api_by_hash", lambda sha: None)
    assert run(online=True)[FOUND] is False


def test_a_failed_lookup_is_not_an_error(loras, monkeypatch):
    monkeypatch.setattr(ci, "file_sha256", lambda path: "d" * 64)
    monkeypatch.setattr(ci, "api_by_hash", lambda sha: None)
    out = run(online=True, hashing=True)
    assert out[FOUND] is False
    assert out[SOURCE] == "none"


def test_the_hash_is_cached_between_calls(loras, tmp_path, monkeypatch):
    monkeypatch.setattr(folder_paths, "get_temp_directory", lambda: str(tmp_path / "temp"))
    path = str(loras / "thing.safetensors")
    first = ci.file_sha256(path)
    assert len(first) == 64

    def boom(*args, **kwargs):
        pytest.fail("the file was re-read instead of using the cache")

    monkeypatch.setattr(ci.hashlib, "sha256", boom)
    assert ci.file_sha256(path) == first


def test_a_dropped_sidecar_changes_the_fingerprint(loras):
    before = MBCivitaiInfo.fingerprint_inputs("loras", "thing.safetensors", False, False)
    (loras / "thing.civitai.info").write_text(json.dumps(VERSION), encoding="utf-8")
    after = MBCivitaiInfo.fingerprint_inputs("loras", "thing.safetensors", False, False)
    assert before != after
