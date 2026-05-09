"""
Génère les assets de l'app (icône, splash, adaptive icon, favicon) à partir du
logo Boa stocké en base64 dans src/theme/logo.ts.

Usage : python scripts/generate-assets.py

Ré-exécute ce script si tu changes le logo source.
"""
import base64
import io
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parent.parent
LOGO_TS = ROOT / "src" / "theme" / "logo.ts"
ASSETS = ROOT / "assets"

BLACK = (26, 26, 26)
RED = (220, 38, 38)
WHITE = (255, 255, 255)


def load_logo() -> Image.Image:
    """Lit le base64 dans logo.ts et renvoie l'image PIL."""
    text = LOGO_TS.read_text(encoding="utf-8")
    match = re.search(r"data:image/jpeg;base64,([A-Za-z0-9+/=]+)", text)
    if not match:
        raise RuntimeError("base64 introuvable dans logo.ts")
    raw = base64.b64decode(match.group(1))
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def make_icon(logo: Image.Image, size: int, bg: tuple, padding_ratio: float = 0.18) -> Image.Image:
    """Logo centré sur fond plein, avec padding configurable."""
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    inner = int(size * (1 - 2 * padding_ratio))
    resized = logo.resize((inner, inner), Image.LANCZOS)
    pos = ((size - inner) // 2, (size - inner) // 2)
    canvas.paste(resized, pos, resized)
    return canvas


def make_splash(logo: Image.Image, size: int = 1024) -> Image.Image:
    """Splash screen : logo centré + 'BOA CLUB' dessous, fond noir."""
    canvas = Image.new("RGBA", (size, size), BLACK + (255,))
    # Logo plus gros sur le splash
    inner = int(size * 0.35)
    resized = logo.resize((inner, inner), Image.LANCZOS)
    pos = ((size - inner) // 2, (size - inner) // 2 - int(size * 0.04))
    canvas.paste(resized, pos, resized)

    # Texte "BOA CLUB" sous le logo (police par défaut, c'est OK pour V1).
    try:
        from PIL import ImageDraw, ImageFont

        draw = ImageDraw.Draw(canvas)
        # On essaye d'utiliser une police système ; sinon fallback default.
        font = None
        for path in [
            "C:/Windows/Fonts/segoeuib.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ]:
            try:
                font = ImageFont.truetype(path, int(size * 0.06))
                break
            except OSError:
                continue
        text = "BOA CLUB"
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        tx = (size - tw) // 2
        ty = pos[1] + inner + int(size * 0.04)
        draw.text((tx, ty), text, fill=WHITE, font=font)
    except Exception:
        pass

    return canvas


def main() -> None:
    print("→ Lecture du logo source…")
    logo = load_logo()
    print(f"  logo source : {logo.size}")

    ASSETS.mkdir(exist_ok=True)

    # Icône principale (iOS + générique). Fond noir, padding modéré.
    icon = make_icon(logo, 1024, BLACK, padding_ratio=0.16)
    icon.convert("RGB").save(ASSETS / "icon.png", optimize=True)
    print("  ✓ icon.png 1024x1024")

    # Adaptive icon Android : foreground avec plus de padding (la zone safe est centrale).
    adaptive = make_icon(logo, 1024, BLACK, padding_ratio=0.27)
    adaptive.convert("RGB").save(ASSETS / "adaptive-icon.png", optimize=True)
    print("  ✓ adaptive-icon.png 1024x1024")

    # Splash : logo + texte sur fond noir.
    splash = make_splash(logo, 1024)
    splash.convert("RGB").save(ASSETS / "splash-icon.png", optimize=True)
    print("  ✓ splash-icon.png 1024x1024")

    # Favicon web (48x48 suffit pour le browser).
    fav = make_icon(logo, 64, BLACK, padding_ratio=0.10)
    fav.save(ASSETS / "favicon.png", optimize=True)
    print("  ✓ favicon.png 64x64")

    print("\n✅ Assets générés. Pour mettre un vrai logo HD plus tard :")
    print("   - Place ton PNG/SVG haute résolution dans src/theme/logo-source.png")
    print("   - Modifie load_logo() pour lire ce fichier au lieu du base64")
    print("   - Relance ce script")


if __name__ == "__main__":
    main()
