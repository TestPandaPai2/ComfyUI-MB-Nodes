"""Helpers shared by the prompt picker nodes."""

MAX_SEED = 0xFFFFFFFFFFFFFFFF


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
