# AstralHouse

Clone minimaliste d'AutoCAD (CAO / architecture), en HTML/CSS/JS pur (**Canvas 2D**), sans dependance ni build.

Application de la suite **Astral Studio** (depot `Astral-studio`, dossier `apps/AstralHouse`).

Dessin 2D technique au clic : lignes, polylignes, rectangles, cercles, arcs (3 points), cotation,
hachures et texte, avec calques, accrochage objet, mode ortho, unites reelles, grille et echelle.
Tout le rendu se fait sur un Canvas 2D (aucune dependance, aucun build).

## Lancer l'application

Deux methodes, sans installation :

1. Ouvrir `index.html` directement dans un navigateur moderne (double-clic).
2. Serveur local (recommande) :

```
npm run serve
```

Ouvre `http://localhost:8080/` automatiquement. Autre port : `set PORT=8090` puis `npm run serve` (Windows) ou `PORT=8090 npm run serve` (macOS/Linux). `NO_OPEN=1` empeche l'ouverture auto.

## Fonctionnalites

- **Outils de dessin** : ligne, polyligne, rectangle, cercle, arc 3 points, cotation lineaire, hachure, texte.
- **Accrochage objet (OSNAP)** : extremites, milieux, centres/quadrants, intersections, point proche, grille.
- **Mode ortho** (F8) et accrochage a la grille pour des segments horizontaux / verticaux.
- **Calques** : creer / supprimer, couleur, type de trait, visibilite et verrouillage ; calque courant.
- **Proprietes** : changer le calque, la couleur ou le type de trait de la selection.
- **Selection** : clic (Maj pour ajouter), fenetre de selection au glisser, tout selectionner (Ctrl+A), deplacer (outil M).
- **Vues** : panoramique (bouton du milieu, barre d'espace ou outil main), zoom molette, zoom etendu (Origine).
- **Mesure** (outil K) : distance et angle entre deux points.
- **Historique** Annuler / Retablir (Ctrl+Z / Ctrl+Maj+Z).
- **Unites reelles** (mm par defaut) et grille a pas reglable ; le zoom affiche l'echelle courante.
- **Export** : **SVG**, **DXF** (LINE, LWPOLYLINE, CIRCLE, ARC, TEXT) et capture **PNG** ; enregistrement / ouverture en **JSON**.

## Raccourcis

| Touche | Action |
| --- | --- |
| V | Selection |
| L / P / R / C / A | Ligne / Polyligne / Rectangle / Cercle / Arc 3 points |
| D / H / T | Cotation / Hachure / Texte |
| M / K | Deplacer / Mesurer |
| Entree | Terminer la polyligne / la hachure (ou valider le texte) |
| Echap | Annuler la commande en cours / deselectionner |
| Suppr / Retour arriere | Supprimer la selection |
| Bouton du milieu ou Espace | Panoramique |
| Molette | Zoom |
| Origine (Home) | Zoom etendu |
| + / - | Zoom avant / arriere |
| F7 / F8 / F9 | Grille / Ortho / Accrochage |
| Ctrl+A | Tout selectionner |
| Ctrl+Z / Ctrl+Maj+Z | Annuler / Retablir |
| Ctrl+N | Nouveau dessin |

## Structure

```
index.html          coque de l'interface
styles.css          theme (grayscale, style CAO)
js/
  utils.js          utilitaires (maths, id, formatage)
  geom.js           geometrie 2D (vecteurs, intersections, polygones, arcs)
  layers.js         calques (couleur, type de trait, visibilite, verrouillage)
  entities.js       entites (ligne, polyligne, rectangle, cercle, arc, cotation, hachure, texte)
  drawing.js        dessin (entites, calques, bornes, serialisation)
  snap.js           accrochage objet (extremites, milieux, centres, intersections...)
  tools.js          definitions des outils et construction des entites
  app.js            etat, selection, vue (pan/zoom), historique, accrochage/ortho
  render.js         rendu Canvas 2D (grille, entites, cotation, apercus, reperes d'accrochage)
  interaction.js    souris / clavier (outils, pan, zoom, selection, deplacement)
  ui.js             menus, barres, panneaux (calques, proprietes, reglages), statut
  export.js         export SVG / DXF / PNG, enregistrement / ouverture JSON
  main.js           demarrage et cablage
test/
  astralhouse-test.js  harnais de tests (Node, sans dependance)
scripts/
  check.js          verification syntaxique de tous les .js
  serve.js          serveur statique local (npm run serve)
```

## Tests

Sans dependance, via Node :

```
npm test      # harnais de tests (test/astralhouse-test.js)
npm run check # verification syntaxique de tous les fichiers .js
npm run verify
```

## Licence

MIT
