"""Helpers shared by the prompt picker nodes."""

MAX_SEED = 0xFFFFFFFFFFFFFFFF


def weighted(text, weight):
    return text if weight == 1.0 else f"({text}:{weight:.2f})"


def split_lines(block):
    return [line.strip() for line in block.strip().splitlines() if line.strip()]


COLORS = [
    "black", "white", "ivory", "pearl white", "champagne", "nude", "beige", "tan", "camel",
    "chocolate brown", "rust", "blush pink", "baby pink", "hot pink", "rani pink",
    "fuchsia", "magenta", "red", "crimson", "ruby red", "burgundy", "maroon", "wine",
    "coral", "peach", "orange", "marigold orange", "saffron", "mustard yellow",
    "lemon yellow", "sage green", "mint green", "olive green", "emerald green",
    "bottle green", "teal", "turquoise", "sky blue", "peacock blue", "cobalt", "royal blue",
    "navy blue", "lavender", "lilac", "purple", "royal purple", "plum", "gold", "silver",
    "rose gold", "bronze", "charcoal grey", "heather grey", "off-white", "cream", "taupe",
    "mocha", "espresso", "cognac", "caramel", "terracotta", "brick red", "cherry red",
    "scarlet", "raspberry", "cranberry", "oxblood", "dusty rose", "mauve", "salmon pink",
    "bubblegum pink", "apricot", "tangerine", "burnt orange", "amber", "honey",
    "canary yellow", "butter yellow", "pistachio green", "lime green", "chartreuse",
    "forest green", "hunter green", "jade", "seafoam green", "khaki", "aqua", "cyan",
    "powder blue", "baby blue", "cornflower blue", "steel blue", "denim blue",
    "sapphire blue", "midnight blue", "indigo", "periwinkle", "violet", "amethyst",
    "orchid", "eggplant", "copper", "pewter", "gunmetal grey", "slate grey", "dove grey",
]
