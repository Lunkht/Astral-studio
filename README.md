# Astral Studio

Suite de logiciels Astral.

## Applications

| Application | Description | Dossier |
| --- | --- | --- |
| AstralIon | Studio vectoriel (clone minimaliste d'Adobe Illustrator), HTML/CSS/JS pur, sans dependance ni build. | [`apps/AstralIon`](apps/AstralIon) |
| AstralPhoto | Editeur d'images raster (clone minimaliste d'Adobe Photoshop), HTML/CSS/JS pur, sans dependance ni build. | [`apps/AstralPhoto`](apps/AstralPhoto) |

## Structure

```
apps/
  AstralIon/        studio vectoriel (ouvrir apps/AstralIon/index.html, ou `npm run serve` dans apps/AstralIon)
  AstralPhoto/      editeur d'images (ouvrir apps/AstralPhoto/index.html, ou `npm run serve` dans apps/AstralPhoto)
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
| AstralAnimate | Adobe Animate | Animation 2D | [`apps/AstralAnimate`](apps/AstralAnimate) |
| AstralHouse | Autodesk (AutoCAD) | CAO / architecture | [`apps/AstralHouse`](apps/AstralHouse) |
| AstralBlender | Blender | 3D (rasterisation logicielle sur Canvas 2D) | [`apps/AstralBlender`](apps/AstralBlender) |
| AstralAdi | (audio) | Montage audio | [`apps/AstralAdi`](apps/AstralAdi) |
