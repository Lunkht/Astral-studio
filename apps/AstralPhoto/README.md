# AstralPhoto

Clone minimaliste d'Adobe Photoshop, en HTML/CSS/JS pur (Canvas 2D), sans dependance ni build.

Application de la suite **Astral Studio** (voir le depot `Astral-studio`, dossier `apps/AstralPhoto`).

## Lancer l'application

Deux methodes, sans installation :

1. Ouvrir `index.html` directement dans un navigateur moderne (double-clic).
2. Serveur local (recommande) :

```
npm run serve
```

Ouvre `http://localhost:8080/` automatiquement. Autre port : `set PORT=8090` puis `npm run serve` (Windows) ou `PORT=8090 npm run serve` (macOS/Linux). `NO_OPEN=1` empeche l'ouverture auto.

## Fonctionnalites

- Documents raster multi-calques : creation (categories de prereglages, unites px/mm/cm/in, fond blanc/transparent/noir), ouverture d'une image, redimensionnement, recadrage, rotations 90/180, symetries H/V.
- Calques : ajout, duplication, suppression, reordonnancement, visibilite, verrouillage, opacite, modes de fusion (produit, ecran, incrustation, etc.), renommage, fusion vers le bas, aplatissement. Vignettes de calque.
- Outils : deplacement, rectangle de selection, selection elliptique, lasso, pinceau (diametre/durete/opacite), crayon, gomme, pot de peinture (tolerance), degrade, formes (rectangle/ellipse), texte, pipette, recadrage, main, zoom.
- Selection utilisee comme masque pour le dessin, le remplissage, les degrades, les filtres et l'effacement ; contours "marching ants".
- Reglages : luminosite/contraste, teinte/saturation (avec apercu), noir et blanc, inverser, sepia.
- Filtres : flou gaussien, nettete, detection de contours, estampage, seuil, posteriser.
- Couleur de premier plan / arriere-plan, inverseur, valeurs par defaut, nuancier.
- Historique Annuler/Retablir (30 etapes), camera zoom/panoramique, grille.
- Export PNG (canal alpha) et JPEG.

## Raccourcis clavier

| Touche | Outil / action |
| --- | --- |
| `V` | Deplacement |
| `M` / `Maj+M` | Rectangle de selection / selection elliptique |
| `L` | Lasso |
| `B` | Pinceau |
| `N` | Crayon |
| `E` | Gomme |
| `W` / `Maj+G` | Pot de peinture |
| `G` | Degrade |
| `U` / `Maj+U` | Rectangle / ellipse |
| `T` | Texte |
| `I` | Pipette |
| `C` | Recadrage (Entree pour appliquer) |
| `H` | Main (ou barre Espace) |
| `Z` | Zoom (Alt : dezoom) |
| `X` | Inverser premier plan / arriere-plan |
| `D` | Couleurs par defaut |
| `[` / `]` | Diminuer / augmenter le diametre |
| Fleches | Deplacer le calque actif (Maj : pas de 10) |
| `Suppr` | Effacer la selection |
| `Ctrl+Z` / `Ctrl+Maj+Z` | Annuler / Retablir |
| `Ctrl+A` / `Ctrl+D` | Tout selectionner / Deselectionner |
| `Ctrl+C` / `Ctrl+V` | Copier / Coller |
| `Ctrl+0` | Ajuster a la fenetre |
| `Ctrl++` / `Ctrl+-` | Zoom avant / arriere |
| `Entree` | Appliquer le recadrage |
| `Echap` | Annuler recadrage / deselectionner |

Molette : defilement ; `Ctrl`/`Alt` + molette : zoom au curseur.

## Structure

```
index.html        coque de l'interface
styles.css        theme
js/
  utils.js        utilitaires (couleurs, geometrie, unites)
  pixels.js       operations pixel pures (flood fill, remplissage)
  layer.js        modele de calque raster + canvas
  selection.js    modele de selection (rect/ellipse/lasso), masque, clip
  filters.js      reglages et filtres (fonctions pures sur ImageData)
  app.js          etat global, document, historique, camera
  render.js       composition des calques, damier, marching ants, apercus
  tools.js        pinceau, remplissage, degrade, formes, texte
  document.js     dialogue Nouveau document (categories + prereglages)
  interaction.js  routage des outils, evenements pointeur/clavier
  ui.js           menus, barre de controle, panneaux, calques, historique
  export.js       export PNG / JPEG
  main.js         demarrage et cablage
test/
  astralphoto-test.js  harnais de tests (Node, sans dependance)
scripts/
  check.js        verification syntaxique de tous les .js
  serve.js        serveur statique local (npm run serve)
```

## Tests

Sans dependance, via Node :

```
npm test      # harnais de tests
npm run check # verification syntaxique de tous les fichiers .js
npm run verify
```

## Licence

MIT
