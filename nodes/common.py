"""Helpers shared by the prompt picker nodes."""

import json
import os
import random

import folder_paths

MAX_SEED = 0xFFFFFFFFFFFFFFFF

# Starred values per node class, written by web/pick_search.js through the
# frontend's user-data API, so it lives in the default user's folder.
FAVORITES = "★ Favorites"
FAVORITES_PATH = os.path.join(folder_paths.get_user_directory(), "default", "mbnodes_favorites.json")


def load_favorites(node_id):
    try:
        with open(FAVORITES_PATH, "r", encoding="utf-8") as f:
            return json.load(f).get(node_id, [])
    except (OSError, ValueError):
        return []


def all_names(table):
    """Every item name across a {category: {name: ...}} table, in order."""
    return list(dict.fromkeys(name for items in table.values() for name in items))


def pick_favorite(node_id, value, choices, seed):
    """Plain-combo nodes: ★ Favorites becomes a seeded pick from the starred
    values, or from every choice when none are starred."""
    if value != FAVORITES:
        return value
    favs = [v for v in load_favorites(node_id) if v in choices] or list(choices)
    return random.Random(seed).choice(favs)


def from_favorites(node_id, table, category, child, rng, randomize):
    """DynamicCombo nodes: map a ★ Favorites pick back to its real category so
    the rest of execute runs unchanged. Returns (category, randomize)."""
    if category["category"] != FAVORITES:
        return category, randomize
    names = all_names(table)
    favs = [n for n in load_favorites(node_id) if n in names] or [category[child]]
    name = rng.choice(favs) if randomize else category[child]
    group = next(g for g, items in table.items() if name in items)
    return {**category, "category": group, child: name}, False


def weighted(text, weight):
    return text if weight == 1.0 or not text else f"({text}:{weight:.2f})"


def split_lines(block):
    return [line.strip() for line in block.strip().splitlines() if line.strip()]


# Each family holds clearly different shades; near-identical names are merged.
COLOR_FAMILIES = {
    "Neutrals": ["black", "white", "ivory", "cream", "beige", "sand", "taupe", "khaki"],
    "Browns": ["chocolate brown", "camel", "caramel", "cognac", "rust", "terracotta"],
    "Pinks": ["blush pink", "baby pink", "hot pink", "rani pink", "dusty rose", "bubblegum pink", "fuchsia", "magenta"],
    "Reds": ["red", "cherry red", "scarlet", "brick red", "burgundy", "raspberry"],
    "Oranges": ["coral", "peach", "apricot", "tangerine", "burnt orange", "saffron"],
    "Yellows": ["lemon yellow", "butter yellow", "canary yellow", "mustard yellow", "marigold", "honey"],
    "Greens": ["mint green", "sage green", "lime green", "olive green", "emerald green", "forest green", "pistachio green", "chartreuse"],
    "Blue-Greens": ["teal", "turquoise", "aqua", "seafoam green", "jade"],
    "Blues": ["baby blue", "sky blue", "cornflower blue", "denim blue", "cobalt", "royal blue", "navy blue", "peacock blue"],
    "Purples": ["lavender", "lilac", "periwinkle", "violet", "orchid", "royal purple", "plum", "eggplant"],
    "Greys": ["dove grey", "heather grey", "slate grey", "charcoal grey"],
}
COLORS = [color for shades in COLOR_FAMILIES.values() for color in shades]
NEUTRALS = COLOR_FAMILIES["Neutrals"]

METALLICS = ["gold", "silver", "rose gold", "bronze", "copper", "pewter", "gunmetal", "champagne gold"]

PATTERNS = [
    "polka dot", "pinstripe", "striped", "floral print", "gingham", "plaid", "tartan",
    "houndstooth", "leopard print", "zebra print", "snakeskin print", "paisley", "tie-dye",
    "chevron", "herringbone", "checkered", "abstract print", "geometric print", "tropical print",
    "camouflage", "argyle", "damask", "toile", "ditsy floral", "color block", "ombre",
]
