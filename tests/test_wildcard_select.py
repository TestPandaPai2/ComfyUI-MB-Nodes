"""Covers the wildcard picker: file listing, item parsing, seed wrapping and
weight formatting.

Run from the ComfyUI root:

    python_embeded\python.exe -m pytest custom_nodes/ComfyUI-MB-Nodes/tests -q
"""

import pytest
import folder_paths
from mbnodes.nodes import wildcard_select_node as ws
from mbnodes.nodes.wildcard_select_node import MBWildcardSelect


@pytest.fixture
def wildcard_dir(tmp_path, monkeypatch):
    monkeypatch.setitem(
        folder_paths.folder_names_and_paths, ws.WILDCARD_FOLDER, ([str(tmp_path)], {".txt"})
    )
    folder_paths.filename_list_cache.pop(ws.WILDCARD_FOLDER, None)
    (tmp_path / "colors.txt").write_text(
        "# a comment\nred\n\n  blue  \ngreen\n", encoding="utf-8"
    )
    (tmp_path / "notes.md").write_text("ignored\n", encoding="utf-8")
    yield tmp_path
    folder_paths.filename_list_cache.pop(ws.WILDCARD_FOLDER, None)


def test_only_txt_files_are_listed(wildcard_dir):
    assert ws.wildcard_files() == ["colors.txt"]


def test_comments_and_blank_lines_are_dropped(wildcard_dir):
    assert ws.read_items("colors.txt") == ["red", "blue", "green"]


def test_a_missing_file_gives_no_items(wildcard_dir):
    assert ws.read_items("nope.txt") == []


def test_the_seed_wraps_onto_a_real_item(wildcard_dir):
    for seed, expected in ((0, "red"), (1, "blue"), (2, "green"), (4, "blue")):
        out = MBWildcardSelect.execute("colors.txt", seed, 1.0, "auto", False)
        assert out.args[1] == expected


def test_weight_one_stays_unwrapped_on_auto(wildcard_dir):
    out = MBWildcardSelect.execute("colors.txt", 0, 1.0, "auto", False)
    assert out.args[0] == "red"


def test_weight_wraps_the_whole_item(wildcard_dir):
    out = MBWildcardSelect.execute("colors.txt", 0, 1.25, "auto", False)
    assert out.args[0] == "(red:1.25)"


def test_always_wraps_even_at_one(wildcard_dir):
    out = MBWildcardSelect.execute("colors.txt", 0, 1.0, "always", False)
    assert out.args[0] == "(red:1.00)"


def test_off_never_wraps(wildcard_dir):
    out = MBWildcardSelect.execute("colors.txt", 0, 3.0, "off", False)
    assert out.args[0] == "red"


def test_parentheses_in_an_item_are_escaped(wildcard_dir):
    (wildcard_dir / "tricky.txt").write_text("a (b) c\n", encoding="utf-8")
    folder_paths.filename_list_cache.pop(ws.WILDCARD_FOLDER, None)
    out = MBWildcardSelect.execute("tricky.txt", 0, 1.5, "auto", False)
    assert out.args[0] == r"(a \(b\) c:1.50)"


def test_counts_are_reported(wildcard_dir):
    out = MBWildcardSelect.execute("colors.txt", 1, 1.0, "auto", False)
    assert out.args[2] == 2
    assert out.args[3] == 3


def test_bypass_outputs_nothing(wildcard_dir):
    out = MBWildcardSelect.execute("colors.txt", 0, 2.0, "always", True)
    assert out.args == ("", "", 0, 0)


def test_editing_the_file_changes_the_fingerprint(wildcard_dir):
    import os, time

    before = MBWildcardSelect.fingerprint_inputs("colors.txt", 0, 1.0, "auto", False)
    path = wildcard_dir / "colors.txt"
    path.write_text("red\nblue\ngreen\nyellow\n", encoding="utf-8")
    os.utime(path, (time.time() + 10, time.time() + 10))
    after = MBWildcardSelect.fingerprint_inputs("colors.txt", 0, 1.0, "auto", False)
    assert before != after
