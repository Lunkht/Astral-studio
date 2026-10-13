# Astral Studio

Suite de logiciels Astral.

## Applications

| Application | Description | Dossier |
| --- | --- | --- |
| AstralIon | Studio vectoriel (clone minimaliste d'Adobe Illustrator), HTML/CSS/JS pur, sans dependance ni build. | [`apps/AstralIon`](apps/AstralIon) |
| AstralPhoto | Editeur d'images raster (clone minimaliste d'Adobe Photoshop), HTML/CSS/JS pur, sans dependance ni build. | [`apps/AstralPhoto`](apps/AstralPhoto) |
| AstralAnimate | Animation 2D (clone minimaliste d'Adobe Animate) : images cles, interpolation, timeline. | [`apps/AstralAnimate`](apps/AstralAnimate) |
| AstralBlender | Modelisation 3D (clone minimaliste de Blender), rasterisation logicielle sur Canvas 2D. | [`apps/AstralBlender`](apps/AstralBlender) |

## Structure

```
apps/
  AstralIon/        studio vectoriel (ouvrir apps/AstralIon/index.html, ou `npm run serve` dans apps/AstralIon)
  AstralPhoto/      editeur d'images (ouvrir apps/AstralPhoto/index.html, ou `npm run serve` dans apps/AstralPhoto)
  AstralAnimate/    animation 2D (ouvrir apps/AstralAnimate/index.html, ou `npm run serve` dans apps/AstralAnimate)
  AstralBlender/    3D logicielle (ouvrir apps/AstralBlender/index.html, ou `npm run serve` dans apps/AstralBlender)
```

Chaque application est autonome : voir son propre `README.md` pour l'utilisation, les raccourcis
et les tests.

## Roadmap

Applications prevues (toutes en HTML/CSS/JS pur, rendu Canvas 2D, sans dependance ni build).
Chaque dossier est cree avec un `README.md` decrivant le perimetre envisage.

| Application | Inspiration | Type | Dossier |
| --- | --- | --- | --- |
| AstralEffet | Adobe After Effects | Compositing / motion graphics | [`apps/AstralEffet`](apps/AstralEffet) |
| AstralMovie | Adobe Premiere Pro | Montage video | [`apps/AstralMovie`](apps/AstralMovie) |
| AstralHouse | Autodesk (AutoCAD) | CAO / architecture | [`apps/AstralHouse`](apps/AstralHouse) |
| AstralAdi | (audio) | Montage audio | [`apps/AstralAdi`](apps/AstralAdi) |
