# AstralBlender

Clone minimaliste de Blender, en HTML/CSS/JS pur (**Canvas 2D**, rasterisation logicielle), sans dependance ni build.

Application de la suite **Astral Studio** (voir le depot `Astral-studio`, dossier `apps/AstralBlender`).

Le rendu 3D est entierement logiciel : aucune API WebGL/WebGPU. Les sommets sont transformes
(matrices 4x4 maison), projetes en perspective, puis les faces sont triees par profondeur
(algorithme du peintre) et remplies avec un eclairage lambertien.

## Lancer l'application

Deux methodes, sans installation :

1. Ouvrir `index.html` directement dans un navigateur moderne (double-clic).
2. Serveur local (recommande) :

```
npm run serve
```

Ouvre `http://localhost:8080/` automatiquement. Autre port : `set PORT=8090` puis `npm run serve` (Windows) ou `PORT=8090 npm run serve` (macOS/Linux). `NO_OPEN=1` empeche l'ouverture auto.

## Fonctionnalites

- **Primitives** : cube, plan, sphere, cylindre, cone, tore (ajout par le panneau ou le menu).
- **Pose au sol** automatique : chaque primitive est placee sur la grille a l'ajout.
- **Camera orbitale** : orbite (bouton du milieu ou Alt+clic gauche), panoramique (Maj + bouton du milieu, ou outil main), zoom (molette).
- **Vues** : face (1), cote (3), dessus (7), perspective (5) et **Cadrer** (Origine) pour recadrer la scene.
- **Selection** : clic (Maj pour ajouter/retirer), deplacement a la souris dans le plan camera, fleches pour deplacer sur la grille, Suppr pour supprimer, Ctrl+D pour dupliquer.
- **Transform** : position, rotation (degres), echelle par axe + couleur et nom, edites dans le panneau.
- **Affichage** : solide, solide + aretes ou filaire ; grille et axes affichables/masquables.
- **Historique** Annuler / Retablir (Ctrl+Z / Ctrl+Maj+Z).
- **Export** : rendu courant en **PNG**, scene en **OBJ** (sommets et faces en coordonnees monde).

## Raccourcis

| Touche | Action |
| --- | --- |
| V / G / O / H / Z | selection / deplacer / orbite / main / zoom (outils) |
| 1 / 3 / 7 / 5 | vue de face / de cote / de dessus / perspective |
| Origine (Home) | cadrer la scene |
| Souris bouton du milieu | orbite (Maj : panoramique) |
| Molette | zoom |
| Fleches (+Maj) | deplacer de 0.5 (2.0) sur la grille |
| [ / ] | deplacer vers le bas / le haut |
| Ctrl+D | dupliquer |
| Suppr / Retour arriere | supprimer |
| Ctrl+Z / Ctrl+Maj+Z | annuler / retablir |

## Structure

```
index.html          coque de l'interface
styles.css          theme (grayscale)
js/
  utils.js          utilitaires (maths, id, clone)
  vec.js            vecteurs 3D
  mat4.js           matrices 4x4 (translation, rotation, echelle, perspective, lookAt, compose)
  mesh.js           primitives et geometrie (sommets, faces, aretes, bornes, normales)
  scene.js          objets de la scene (creation, ajout, suppression, recherche)
  tools.js          fabrication des maillages et couleurs
  app.js            etat, camera orbitale, selection, historique
  render.js         rasteriseur logiciel (transformation, projection, peintre, eclairage)
  interaction.js    souris / clavier (orbite, panoramique, zoom, selection, deplacement)
  ui.js             menus, barres, panneaux, listes
  export.js         export PNG / OBJ
  main.js           demarrage et cablage
test/
  astralblender-test.js  harnais de tests (Node, sans dependance)
scripts/
  check.js          verification syntaxique de tous les .js
  serve.js          serveur statique local (npm run serve)
```

## Tests

Sans dependance, via Node :

```
npm test      # harnais de tests (test/astralblender-test.js)
npm run check # verification syntaxique de tous les fichiers .js
npm run verify
```

## Licence

MIT
