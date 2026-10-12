# AstralIon

Clone minimaliste d'Adobe Illustrator, en HTML/CSS/JS pur (Canvas 2D), sans dependance ni build.

Application de la suite **Astral Studio** (voir le depot `Astral-studio`, dossier `apps/AstralIon`).

## Lancer l'application

Ouvrir `index.html` dans un navigateur moderne. Aucune installation requise.

## Fonctionnalites

- Outils : selection, selection directe, plume, crayon, rectangle, ellipse, rectangle arrondi, polygone, etoile, segment, texte, pipette, main, zoom.
- Formes avec remplissage, contour, largeur de contour, opacite, rotation, visibilite, verrouillage.
- Chemins (Bezier) : edition des ancres et des poignees, ajout/suppression d'ancre, sous-tracages multiples (resultats de Pathfinder).
- Pathfinder : unite, soustraction, intersection, exclusion ; alignement et repartition.
- Panneaux : calques, proprietes, apparence, nuancier, alignement, transform.
- Calques, ordre Z, duplication, suppression.
- Plans de travail et dialogue "Nouveau document" (categories et prereglages, orientations, unites mm/cm/in/pt/px).
- Regles (en unites), grille de fond, zoom/panoramique, ajustement a la fenetre.
- Export SVG et PNG.

## Raccourcis clavier

| Touche | Outil / action |
| --- | --- |
| `V` | Selection |
| `A` | Selection directe |
| `P` | Plume |
| `=` / `-` | Ajouter / supprimer une ancre |
| `N` | Crayon |
| `M` | Rectangle |
| `L` | Ellipse |
| `R` | Rectangle arrondi |
| `G` | Polygone |
| `S` | Etoile |
| `\` | Segment |
| `T` | Texte |
| `I` | Pipette |
| `H` | Main |
| `Z` | Zoom |
| Fleches | Deplacer la selection (Shift : pas de 10) |

## Structure

```
index.html        coque de l'interface
styles.css        theme
js/
  utils.js        utilitaires + unites
  shapes.js       modele de forme, geometrie, sous-tracages
  app.js          etat global, historique (undo/redo), camera
  tools.js        constructeurs de formes, crayon, mesure de texte
  align.js        alignement, repartition, pathfinder
  document.js     dialogue Nouveau document / configuration
  render.js       rendu Canvas + regles
  interaction.js  routage des outils, ancres, evenements pointeur/clavier
  ui.js           menus, barre de controle, panneaux, nuancier
  export.js       export SVG / PNG
  main.js         demarrage et cablage
test/
  ion-test.js     harnais de tests (Node, sans dependance)
scripts/
  check.js        verification syntaxique de tous les .js
```

## Tests

Sans dependance, via Node :

```
npm test      # harnais de tests (test/ion-test.js)
npm run check # verification syntaxique de tous les fichiers .js
npm run verify
```

## Licence

MIT
