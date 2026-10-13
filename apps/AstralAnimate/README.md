# AstralAnimate

Clone minimaliste d'Adobe Animate, en HTML/CSS/JS pur (Canvas 2D), sans dependance ni build.

Application de la suite **Astral Studio** (voir le depot `Astral-studio`, dossier `apps/AstralAnimate`).

## Lancer l'application

Deux methodes, sans installation :

1. Ouvrir `index.html` directement dans un navigateur moderne (double-clic).
2. Serveur local (recommande) :

```
npm run serve
```

Ouvre `http://localhost:8080/` automatiquement. Autre port : `set PORT=8090` puis `npm run serve` (Windows) ou `PORT=8090 npm run serve` (macOS/Linux). `NO_OPEN=1` empeche l'ouverture auto.

## Fonctionnalites

- Document parametrable : nom, largeur, hauteur, images/seconde, nombre d'images, fond (dialogue « Nouveau document »).
- Dessin de formes vectorielles : rectangle, ellipse, ligne, trace au crayon, texte.
- **Timeline** : un calque = une suite d'images cles. Insertion / suppression d'images cles (F6 / Maj+F6), clic sur une image pour s'y placer.
- **Interpolation** (motion tween) automatique entre deux images cles : position, taille, rotation, echelle, opacite, trace — avec courbe d'attenuation.
- **Lecture** de l'animation a la cadence definie, boucle sur la plage d'images.
- **Peaux d'oignon** (frames precedentes/suivantes en transparence) et grille.
- Calques : ajout, suppression, reordonnancement, visibilite, verrouillage.
- Selection, deplacement (souris ou fleches), duplication (Ctrl+D), suppression.
- Panneaux Proprietes et Calques, barre d'etat (image, zoom, coordonnees).
- Historique Annuler / Retablir (Ctrl+Z / Ctrl+Maj+Z).
- Camera : zoom (molette, Z, +/-) et panoramique (H ou bouton du milieu).
- Export : image courante en **SVG** ou **PNG**.

## Raccourcis

| Touche | Action |
| --- | --- |
| V / R / O / L / P / T | selection / rectangle / ellipse / ligne / crayon / texte |
| H / Z | main / zoom |
| , / . | image precedente / suivante |
| Entree ou Espace | lecture / pause |
| F6 / Maj+F6 | inserer / supprimer une image cle |
| Fleches (+Maj) | deplacer de 1 px (10 px) |
| Ctrl+D | dupliquer |
| Suppr | supprimer |
| Ctrl+Z / Ctrl+Maj+Z | annuler / retablir |
| Ctrl+0 / Ctrl+ +/- | ajuster / zoom avant / arriere |

## Structure

```
index.html          coque de l'interface
styles.css          theme (grayscale)
js/
  utils.js          utilitaires (maths, easing, interpolation)
  shapes.js         modele de forme, geometrie, dessin, interpolation
  layer.js          calques et images cles (renderAt / interpolation)
  app.js            etat de l'application, document, historique, selection
  timeline.js       lecture (play / pause) a la cadence definie
  tools.js          fabrication des formes (rectangle, ligne, crayon, texte)
  render.js         rendu Canvas 2D (scene, peaux d'oignon, grille, selection)
  interaction.js    souris / clavier, routage des outils, camera
  ui.js             menus, barres, panneaux, timeline
  export.js         export SVG / PNG
  main.js           demarrage et cablage
test/
  astralanimate-test.js  harnais de tests (Node, sans dependance)
scripts/
  check.js          verification syntaxique de tous les .js
  serve.js          serveur statique local (npm run serve)
```

## Tests

Sans dependance, via Node :

```
npm test      # harnais de tests (test/astralanimate-test.js)
npm run check # verification syntaxique de tous les fichiers .js
npm run verify
```

## Licence

MIT
