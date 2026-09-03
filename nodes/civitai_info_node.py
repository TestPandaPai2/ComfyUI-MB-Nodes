"""Reads whatever Civitai knows about a model file on disk.

Three offline sources are tried before the network: the `.civitai.info`
sidecar (a raw Civitai model-version payload), the `.metadata.json` sidecar
written by model managers (the same payload under a `civitai` key), and the
safetensors header's own `__metadata__`. The Civitai API is only consulted
when the user turns it on.
"""

import hashlib
import html
import json
import os
import re
import struct
import urllib.error
import urllib.request

import folder_paths
from comfy_api.latest import io

MODEL_FOLDERS = ["checkpoints", "diffusion_models", "loras", "text_encoders", "vae"]

API_BY_HASH = "https://civitai.com/api/v1/model-versions/by-hash/{}"
API_TIMEOUT = 15
USER_AGENT = "ComfyUI-MB-Nodes"

_TAG_RE = re.compile(r"<[^>]+>")
_BLANK_RE = re.compile(r"\n{3,}")


def folder_table():
    """{folder: [filename, ...]} for the folders this node offers."""
    table = {}
    for folder in MODEL_FOLDERS:
        try:
            table[folder] = folder_paths.get_filename_list(folder)
        except Exception:
            table[folder] = []
    return table


def all_model_files(table=None):
    """Every filename across every folder, deduped. The `model` combo has to
    accept anything the frontend may have narrowed it down to."""
    table = folder_table() if table is None else table
    names = []
    for folder in MODEL_FOLDERS:
        names.extend(table.get(folder, []))
    return list(dict.fromkeys(names))


def model_path(folder, name):
    if not name:
        return None
    path = folder_paths.get_full_path(folder, name)
    if path:
        return path
    # The frontend narrows `model` to the chosen folder, but a graph loaded
    # from JSON can carry a name that has since moved to another folder.
    for other in MODEL_FOLDERS:
        if other == folder:
            continue
        path = folder_paths.get_full_path(other, name)
        if path:
            return path
    return None


def strip_html(text):
    """Civitai descriptions are HTML. Flatten to plain text without pulling in
    a parser dependency."""
    if not text:
        return ""
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</(p|div|li|h[1-6])>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<li[^>]*>", "- ", text, flags=re.IGNORECASE)
    text = _TAG_RE.sub("", text)
    text = html.unescape(text)
    text = _BLANK_RE.sub("\n\n", text)
    return text.strip()


def read_json(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def safetensors_metadata(path):
    """The `__metadata__` dict out of a safetensors header, or {}."""
    if not path or not path.lower().endswith(".safetensors"):
        return {}
    try:
        with open(path, "rb") as f:
            length = struct.unpack("<Q", f.read(8))[0]
            if length <= 0 or length > 100 * 1024 * 1024:
                return {}
            header = json.loads(f.read(length))
    except (OSError, ValueError, struct.error):
        return {}
    meta = header.get("__metadata__")
    return meta if isinstance(meta, dict) else {}


def hash_cache_path(path):
    """Hashes live in ComfyUI's temp dir, never next to the model."""
    stat = os.stat(path)
    key = f"{os.path.abspath(path)}|{stat.st_size}|{stat.st_mtime}"
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()
    cache_dir = os.path.join(folder_paths.get_temp_directory(), "mbnodes_hashes")
    return cache_dir, os.path.join(cache_dir, digest + ".sha256")


def file_sha256(path):
    """SHA256 of a model file, cached against its size and mtime — hashing a
    multi-gigabyte checkpoint is slow enough that repeats must not re-read it."""
    try:
        cache_dir, cache_file = hash_cache_path(path)
    except OSError:
        cache_dir = cache_file = None

    if cache_file and os.path.isfile(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cached = f.read().strip()
            if len(cached) == 64:
                return cached
        except OSError:
            pass

    digest = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
    except OSError:
        return ""
    result = digest.hexdigest()

    if cache_file:
        try:
            os.makedirs(cache_dir, exist_ok=True)
            with open(cache_file, "w", encoding="utf-8") as f:
                f.write(result)
        except OSError:
            pass
    return result


def api_by_hash(sha256):
    if not sha256:
        return None
    request = urllib.request.Request(
        API_BY_HASH.format(sha256), headers={"User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(request, timeout=API_TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, ValueError, OSError):
        return None
    return payload if isinstance(payload, dict) else None


def sidecar_paths(path):
    """`foo.safetensors` -> its metadata siblings, both with and without the
    model's own extension (managers disagree on which form to write)."""
    stem = os.path.splitext(path)[0]
    return [
        (stem + ".civitai.info", "civitai.info"),
        (path + ".civitai.info", "civitai.info"),
        (stem + ".metadata.json", "metadata.json"),
        (path + ".metadata.json", "metadata.json"),
        (stem + ".json", "json"),
    ]


def load_offline(path):
    """(version_payload, wrapper, source) from the first sidecar that parses.
    `wrapper` is the manager-written outer object when there is one."""
    for sidecar, kind in sidecar_paths(path):
        if not os.path.isfile(sidecar):
            continue
        data = read_json(sidecar)
        if not isinstance(data, dict):
            continue
        inner = data.get("civitai")
        if isinstance(inner, dict) and inner:
            return inner, data, kind
        if kind == "civitai.info" or "modelId" in data or "trainedWords" in data:
            return data, data, kind
    return None, None, ""


def first_str(*values):
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def join_lines(values):
    """Tag/word lists arrive as strings, lists of strings or lists of dicts."""
    if isinstance(values, str):
        values = [values]
    if not isinstance(values, (list, tuple)):
        return ""
    out = []
    for value in values:
        if isinstance(value, dict):
            value = value.get("name") or value.get("tag") or ""
        if isinstance(value, str) and value.strip():
            out.append(value.strip())
    return "\n".join(dict.fromkeys(out))


def sha_from(version, wrapper):
    """Civitai stores hashes per file; the wrapper usually caches one too."""
    for entry in (version or {}).get("files") or []:
        if not isinstance(entry, dict):
            continue
        hashes = entry.get("hashes") or {}
        value = hashes.get("SHA256") or hashes.get("sha256")
        if isinstance(value, str) and len(value) == 64:
            return value.lower()
    value = (wrapper or {}).get("sha256")
    if isinstance(value, str) and len(value) == 64:
        return value.lower()
    return ""


def embedded_tags(meta):
    """kohya writes ss_tag_frequency as {dataset: {tag: count}}."""
    raw = meta.get("ss_tag_frequency")
    if not isinstance(raw, str):
        return ""
    try:
        parsed = json.loads(raw)
    except ValueError:
        return ""
    tags = []
    if isinstance(parsed, dict):
        for value in parsed.values():
            if isinstance(value, dict):
                tags.extend(value.keys())
            elif isinstance(value, str):
                tags.append(value)
    return join_lines(tags)


def from_embedded(meta):
    """Best effort identity out of kohya/modelspec training metadata. This
    never yields Civitai ids — only names a human would recognise."""
    return {
        "model_name": first_str(meta.get("modelspec.title"), meta.get("ss_output_name")),
        "base_model": first_str(
            meta.get("modelspec.architecture"), meta.get("ss_base_model_version")
        ),
        "creator": first_str(meta.get("modelspec.author")),
        "description": strip_html(first_str(meta.get("modelspec.description"))),
        "tags": embedded_tags(meta),
    }


class MBCivitaiInfo(io.ComfyNode):
    """Pulls Civitai metadata for a model file. `folder` picks which model
    directory to browse; the frontend narrows `model` to that folder's files."""

    @classmethod
    def define_schema(cls) -> io.Schema:
        files = all_model_files()
        return io.Schema(
            node_id="MBNodesCivitaiInfo",
            display_name="Civitai Info (MB)",
            category="MBNodes",
            description="Read Civitai metadata for a checkpoint, diffusion model, lora, text encoder or vae.",
            search_aliases=["civitai", "model info", "trigger words", "metadata"],
            inputs=[
                io.Combo.Input(
                    "folder",
                    options=MODEL_FOLDERS,
                    default=MODEL_FOLDERS[0],
                    socketless=True,
                ),
                io.Combo.Input(
                    "model",
                    options=files,
                    default=files[0] if files else None,
                    socketless=True,
                    tooltip="File inside the selected folder.",
                ),
                io.Boolean.Input(
                    "online_lookup",
                    default=False,
                    tooltip="If the sidecars come up empty, ask civitai.com about this file's SHA256. Sends the hash to civitai.com.",
                ),
                io.Boolean.Input(
                    "allow_hashing",
                    default=False,
                    tooltip="Let the lookup hash the file when no hash is known yet. Reading a multi-gigabyte model takes a while; the result is cached.",
                ),
            ],
            outputs=[
                io.Boolean.Output("found"),
                io.String.Output("source"),
                io.String.Output("model_name"),
                io.String.Output("version_name"),
                io.String.Output("model_type"),
                io.String.Output("base_model"),
                io.String.Output("creator"),
                io.String.Output("trained_words"),
                io.String.Output("tags"),
                io.String.Output("description"),
                io.String.Output("url"),
                io.String.Output("download_url"),
                io.String.Output("image_urls"),
                io.String.Output("air"),
                io.String.Output("sha256"),
                io.Int.Output("model_id"),
                io.Int.Output("version_id"),
                io.Boolean.Output("nsfw"),
                io.String.Output("file_name"),
                io.String.Output("json"),
            ],
        )

    @classmethod
    def execute(cls, folder, model, online_lookup, allow_hashing) -> io.NodeOutput:
        path = model_path(folder, model)
        if not path:
            return cls._empty(model)

        version, wrapper, source = load_offline(path)
        sha256 = sha_from(version, wrapper)

        if version is None and online_lookup:
            if not sha256 and allow_hashing:
                sha256 = file_sha256(path)
            fetched = api_by_hash(sha256)
            if fetched:
                version, wrapper, source = fetched, fetched, "api"
                sha256 = sha_from(version, wrapper) or sha256

        if version is None:
            return cls._from_embedded_only(model, safetensors_metadata(path), sha256)

        return cls._from_version(model, version, wrapper, source, sha256)

    @classmethod
    def _empty(cls, model):
        return io.NodeOutput(
            False, "none", "", "", "", "", "", "", "", "", "", "", "", "", "",
            0, 0, False, model or "", "",
        )

    @classmethod
    def _from_embedded_only(cls, model, embedded, sha256):
        fields = from_embedded(embedded) if embedded else {}
        if not any(fields.values()):
            return cls._empty(model)
        return io.NodeOutput(
            True,
            "embedded",
            fields["model_name"],
            "",
            "",
            fields["base_model"],
            fields["creator"],
            "",
            fields["tags"],
            fields["description"],
            "",
            "",
            "",
            "",
            sha256,
            0,
            0,
            False,
            model or "",
            json.dumps(embedded, indent=2, ensure_ascii=False),
        )

    @classmethod
    def _from_version(cls, model, version, wrapper, source, sha256):
        parent = version.get("model") if isinstance(version.get("model"), dict) else {}
        creator = version.get("creator") if isinstance(version.get("creator"), dict) else {}
        wrapper = wrapper or {}

        model_id = version.get("modelId") or parent.get("id") or wrapper.get("modelId") or 0
        version_id = version.get("id") or wrapper.get("modelVersionId") or 0

        url = ""
        if model_id:
            url = "https://civitai.com/models/{}".format(model_id)
            if version_id:
                url += "?modelVersionId={}".format(version_id)

        images = [
            image.get("url")
            for image in (version.get("images") or [])
            if isinstance(image, dict) and image.get("url")
        ]

        nsfw = bool(parent.get("nsfw") or (version.get("nsfwLevel") or 0) > 1)

        return io.NodeOutput(
            True,
            source or "sidecar",
            first_str(parent.get("name"), wrapper.get("model_name"), model),
            first_str(version.get("name")),
            first_str(parent.get("type"), wrapper.get("sub_type")),
            first_str(version.get("baseModel"), wrapper.get("base_model")),
            first_str(creator.get("username")),
            join_lines(version.get("trainedWords")),
            join_lines(wrapper.get("tags") or parent.get("tags")),
            strip_html(
                first_str(
                    version.get("description"),
                    parent.get("description"),
                    wrapper.get("modelDescription"),
                )
            ),
            url,
            first_str(version.get("downloadUrl")),
            "\n".join(images),
            first_str(version.get("air")),
            sha256,
            int(model_id or 0),
            int(version_id or 0),
            nsfw,
            model or "",
            json.dumps(version, indent=2, ensure_ascii=False),
        )

    @classmethod
    def fingerprint_inputs(cls, folder, model, online_lookup, allow_hashing):
        # A sidecar dropped next to the model has to invalidate the cache.
        path = model_path(folder, model)
        stamps = []
        if path:
            for candidate in [path] + [side for side, _kind in sidecar_paths(path)]:
                try:
                    stamps.append(str(os.path.getmtime(candidate)))
                except OSError:
                    stamps.append("-")
        return "{}|{}|{}|{}|{}".format(
            folder, model, online_lookup, allow_hashing, "|".join(stamps)
        )


try:
    from server import PromptServer
    from aiohttp import web

    @PromptServer.instance.routes.get("/mbnodes/model_files")
    async def _mbnodes_model_files(request):
        return web.json_response({"folders": MODEL_FOLDERS, "table": folder_table()})
except Exception:  # server missing (unit runs) or route already registered
    pass


NODES = [MBCivitaiInfo]
