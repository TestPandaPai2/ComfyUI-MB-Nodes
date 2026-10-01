"""Lighting Enhance Prompt picker: one combo of lighting styles, outputs that style's edit prompt."""

from comfy_api.latest import io

LIGHTING_TYPES = {
    "Soft natural window light": "Enhance the overall lighting of the image attached to soft natural window light, with gentle diffused illumination from one side, smooth gradual shadows, and a calm, airy feel.",
    "Golden hour": "Enhance the overall lighting of the image attached to golden hour sunlight, with warm amber tones, a low sun angle, long soft shadows, and a glowing rim light on the edges of the subject.",
    "Blue hour": "Enhance the overall lighting of the image attached to blue hour twilight, with cool blue ambient tones, soft even illumination, and gentle warm accents from distant lights.",
    "Overcast daylight": "Enhance the overall lighting of the image attached to soft overcast daylight, with even, shadowless illumination, muted contrast, and natural, true-to-life color.",
    "Harsh midday sun": "Enhance the overall lighting of the image attached to harsh midday sun, with strong direct overhead light, crisp defined shadows, high contrast, and bright vivid highlights.",
    "Rembrandt lighting": "Enhance the overall lighting of the image attached to Rembrandt lighting, with a key light at 45 degrees creating a small triangle of light on the shadowed cheek, deep dramatic shadows, and a moody classical feel.",
    "Butterfly (paramount) lighting": "Enhance the overall lighting of the image attached to butterfly lighting, with a high frontal key light creating a soft shadow under the nose, defined cheekbones, and a polished glamour look.",
    "Loop lighting": "Enhance the overall lighting of the image attached to loop lighting, with a slightly raised side key light casting a small loop-shaped shadow beside the nose and a flattering, natural dimension.",
    "Split lighting": "Enhance the overall lighting of the image attached to split lighting, with a hard side light illuminating exactly half the subject and leaving the other half in deep shadow for a dramatic effect.",
    "Broad lighting": "Enhance the overall lighting of the image attached to broad lighting, with the key light illuminating the side of the subject facing the camera, creating a wide, open, soft look.",
    "Short lighting": "Enhance the overall lighting of the image attached to short lighting, with the key light on the side turned away from the camera, adding contour, depth, and a slimming, sculpted effect.",
    "Rim / backlight": "Enhance the overall lighting of the image attached to strong rim lighting, with a bright light from behind creating a glowing outline around the subject and a gentle separation from the background.",
    "Silhouette backlighting": "Enhance the overall lighting of the image attached to dramatic silhouette backlighting, with a bright background glow and the subject rendered in deep shadow with a crisp outline.",
    "Softbox studio lighting": "Enhance the overall lighting of the image attached to softbox studio lighting, with large, even, diffused light from the front-side, smooth skin gradients, and clean controlled shadows.",
    "Ring light": "Enhance the overall lighting of the image attached to ring light illumination, with even frontal light, minimal shadows, and a distinctive circular catchlight in the eyes.",
    "High-key lighting": "Enhance the overall lighting of the image attached to high-key lighting, with bright, even illumination, minimal shadows, a clean airy look, and a light, cheerful mood.",
    "Low-key lighting": "Enhance the overall lighting of the image attached to low-key lighting, with a dark moody atmosphere, a single focused light source, deep shadows, and strong contrast.",
    "Chiaroscuro": "Enhance the overall lighting of the image attached to chiaroscuro lighting, with extreme contrast between bright highlights and deep shadows, painterly drama, and a single directional light source.",
    "Cinematic teal and orange": "Enhance the overall lighting of the image attached to cinematic teal and orange lighting, with warm orange key light on the subject, cool teal shadows and background, and film-like contrast.",
    "Neon glow": "Enhance the overall lighting of the image attached to vibrant neon lighting, with pink, blue, and purple light spilling across the subject, glowing highlights, and a nighttime urban feel.",
    "Cyberpunk": "Enhance the overall lighting of the image attached to cyberpunk lighting, with saturated magenta and cyan light sources, reflective highlights, atmospheric haze, and high-contrast futuristic shadows.",
    "Candlelight": "Enhance the overall lighting of the image attached to warm candlelight, with a soft flickering orange glow, gentle falloff into darkness, intimate shadows, and a romantic mood.",
    "Fireplace glow": "Enhance the overall lighting of the image attached to fireplace lighting, with warm, dancing orange light from one side, soft red-gold highlights, and cozy, dim surroundings.",
    "Warm tungsten indoor": "Enhance the overall lighting of the image attached to warm tungsten lighting, with cozy amber tones from household lamps, soft gentle shadows, and a homey atmosphere.",
    "Cool fluorescent": "Enhance the overall lighting of the image attached to cool fluorescent lighting, with flat, slightly greenish-white overhead illumination, even brightness, and a utilitarian feel.",
    "Moonlight": "Enhance the overall lighting of the image attached to moonlight, with cool silvery-blue illumination, soft shadows, subtle highlights, and a quiet, mysterious night mood.",
    "Dappled sunlight": "Enhance the overall lighting of the image attached to dappled sunlight filtering through leaves, with patches of warm light and soft shadow playing across the subject and scene.",
    "Sun flare": "Enhance the overall lighting of the image attached to a sun-flare look, with the sun partly in frame, soft hazy flare, warm glow, and a dreamy, lifted-contrast atmosphere.",
    "Volumetric light rays": "Enhance the overall lighting of the image attached to volumetric lighting, with visible beams of light cutting through haze or dust, glowing shafts, and a dramatic, atmospheric depth.",
    "God rays": "Enhance the overall lighting of the image attached to god rays, with radiant beams streaming down from above, a warm golden glow, and a spiritual, awe-inspiring mood.",
    "Foggy diffused": "Enhance the overall lighting of the image attached to foggy diffused lighting, with soft, milky light, low contrast, muted colors, and a quiet, dreamlike atmosphere.",
    "Rainy day moody": "Enhance the overall lighting of the image attached to rainy day lighting, with cool gray ambient light, soft reflections, subtle wet highlights, and a melancholic, cinematic tone.",
    "Sunset silhouette glow": "Enhance the overall lighting of the image attached to a vivid sunset glow, with rich orange, pink, and purple tones, a bright horizon light, and warm color wash across the subject.",
    "Sunrise soft light": "Enhance the overall lighting of the image attached to soft sunrise light, with pale pink and gold tones, gentle low-angle illumination, and a fresh, peaceful mood.",
    "Film noir": "Enhance the overall lighting of the image attached to film noir lighting, with hard directional light, venetian blind shadow stripes, deep blacks, and a mysterious, dramatic mood.",
    "Spotlight": "Enhance the overall lighting of the image attached to a focused spotlight, with a bright circular pool of light on the subject, dark surroundings, and crisp theatrical contrast.",
    "Stage concert lighting": "Enhance the overall lighting of the image attached to stage concert lighting, with colorful beams, backlit haze, bright highlights, and an energetic, performance atmosphere.",
    "Studio flash with hard shadows": "Enhance the overall lighting of the image attached to hard studio flash, with crisp, defined shadows, punchy contrast, and a bold, editorial fashion look.",
    "Beauty dish lighting": "Enhance the overall lighting of the image attached to beauty dish lighting, with crisp yet soft frontal light, defined cheekbones, luminous skin highlights, and a polished beauty-editorial finish.",
    "Clamshell lighting": "Enhance the overall lighting of the image attached to clamshell lighting, with one soft light above and a reflector below, minimizing shadows, flattering the face, and creating bright, even skin tones.",
    "Dreamy soft glow": "Enhance the overall lighting of the image attached to a dreamy soft glow, with gentle bloom around highlights, lifted shadows, pastel warmth, and an ethereal, romantic feel.",
    "Warm sunlit room": "Enhance the overall lighting of the image attached to warm sunlight streaming into a room, with golden window light, soft shadow patterns on the walls, and a cozy, nostalgic ambiance.",
    "Colored gel lighting": "Enhance the overall lighting of the image attached to colored gel lighting, with contrasting red, blue, or purple lights on opposite sides, vivid color separation, and a bold, creative look.",
    "Underlighting": "Enhance the overall lighting of the image attached to dramatic underlighting, with light coming from below, upward-cast shadows, and an eerie, theatrical mood.",
    "Top-down lighting": "Enhance the overall lighting of the image attached to top-down lighting, with a strong overhead source, deep shadows under the brow and chin, and a stark, dramatic feel.",
    "Street lamp night": "Enhance the overall lighting of the image attached to street lamp lighting, with warm pools of light, dark surroundings, soft glow in the air, and a quiet urban night mood.",
    "City bokeh night": "Enhance the overall lighting of the image attached to city night lighting, with colorful bokeh lights in the background, a soft glow on the subject, and cinematic urban ambiance.",
    "Studio gradient backdrop glow": "Enhance the overall lighting of the image attached to studio lighting with a soft gradient backdrop glow, with a subtle halo of light behind the subject, even front lighting, and clean subject separation.",
    "Magic hour haze": "Enhance the overall lighting of the image attached to magic hour haze, with soft, low-angle golden light, atmospheric glow, gentle warm shadows, and a cinematic, nostalgic tone.",
    "Natural outdoor shade": "Enhance the overall lighting of the image attached to open shade lighting, with soft, even light reflected from the sky, gentle shadows, flattering skin tones, and a clean natural look.",
}


class MBLightingEnhancePrompt(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="MBNodesLightingEnhancePrompt",
            display_name="Lighting Enhance Prompt (MB)",
            category="MBNodes",
            description="Pick a lighting style; outputs its lighting enhancement prompt.",
            search_aliases=["lighting", "light", "lighting style", "relight"],
            inputs=[
                io.Combo.Input("types", options=list(LIGHTING_TYPES), default="Soft natural window light"),
            ],
            outputs=[
                io.String.Output("prompt"),
            ],
        )

    @classmethod
    def execute(cls, types) -> io.NodeOutput:
        return io.NodeOutput(LIGHTING_TYPES[types])


NODES = [MBLightingEnhancePrompt]
