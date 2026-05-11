#!/usr/bin/env python3
"""
fit-app-icon.py — Régénère mobile/assets/app-icon.png pour qu'il remplisse
correctement l'icône iOS (et Android adaptiveIcon foreground).

Problème courant : un logo exporté avec des bords transparents apparaît
"flottant" dans un carré gris une fois installé sur l'iPhone, parce que
iOS ne sait pas quoi faire des pixels alpha de l'icône.

Ce script :
  1. Lit le PNG existant.
  2. Auto-trim les bords transparents (auto-crop sur le bounding box du contenu).
  3. Compose le logo centré sur un canvas carré opaque (couleur configurable
     via BACKGROUND_COLOR).
  4. Resize à 1024×1024 (la taille requise par Apple).
  5. Écrase le fichier d'origine.

Usage :
    cd mobile
    pip3 install Pillow      # première fois uniquement
    python3 scripts/fit-app-icon.py

Si tu veux changer la couleur de fond (par défaut noir Boa), modifie la
constante BACKGROUND_COLOR ci-dessous.
"""
from pathlib import Path
from PIL import Image

# ─── Configuration ─────────────────────────────────────────────

INPUT_PATH = Path(__file__).parent.parent / "assets" / "app-icon.png"

# Couleur de fond opaque qui remplit tout le carré. Noir Boa par défaut.
# Variantes proposées :
#   "#1a1a1a" → noir Boa (recommandé, look "fight brand")
#   "#FFFFFF" → blanc (look minimal)
#   "#DC2626" → rouge Boa (très énergique)
BACKGROUND_COLOR = "#1a1a1a"

# Pourcentage de "respiration" autour du logo (0 = colle aux bords).
# Apple recommande 5-10% pour éviter que le logo touche les bords arrondis.
PADDING_PCT = 0.06

# Taille finale (Apple veut 1024×1024 minimum pour l'App Store).
OUTPUT_SIZE = 1024


def main() -> None:
    if not INPUT_PATH.exists():
        raise SystemExit(
            f"✗ Fichier introuvable : {INPUT_PATH}\n"
            f"  Place ton logo PNG à cet emplacement avant de lancer le script."
        )

    print(f"→ Lecture de {INPUT_PATH.name}…")
    img = Image.open(INPUT_PATH).convert("RGBA")
    print(f"  Taille originale : {img.size[0]} × {img.size[1]}")

    # Auto-trim : on garde uniquement la zone non-transparente du logo.
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        print(f"  Auto-crop → {img.size[0]} × {img.size[1]} (zone du logo)")

    # Calcul de la taille de canvas avec padding.
    logo_max_side = max(img.size)
    canvas_side = int(logo_max_side * (1 + PADDING_PCT * 2))

    # Création d'un canvas carré opaque (la couleur de fond remplit TOUT).
    canvas = Image.new("RGB", (canvas_side, canvas_side), BACKGROUND_COLOR)

    # Centrage du logo sur le canvas. mask=img.split()[3] préserve les zones
    # transparentes du logo (notamment l'intérieur du triangle).
    offset = (
        (canvas_side - img.size[0]) // 2,
        (canvas_side - img.size[1]) // 2,
    )
    canvas.paste(img, offset, img)

    # Resize à 1024×1024 avec un bon filtre.
    canvas = canvas.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)

    # Sauvegarde en PNG (RGB, donc PAS d'alpha → conforme App Store).
    canvas.save(INPUT_PATH, "PNG", optimize=True)
    print(
        f"✓ Icône régénérée : {OUTPUT_SIZE} × {OUTPUT_SIZE}, "
        f"fond {BACKGROUND_COLOR}, sans alpha"
    )
    print(f"  Fichier : {INPUT_PATH}")
    print()
    print("Étapes suivantes :")
    print("  1. git add mobile/assets/app-icon.png")
    print("  2. git commit -m \"chore: régénère app-icon avec fond plein\"")
    print("  3. git push")
    print("  4. cd mobile && npx expo run:ios --device --configuration Release")
    print("  5. Désinstalle l'app de l'iPhone avant la réinstallation pour")
    print("     forcer iOS à refresh le cache d'icône.")


if __name__ == "__main__":
    main()
