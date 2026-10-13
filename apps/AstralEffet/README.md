# AstralEffet

Clone minimaliste d'Adobe After Effects (compositing et motion graphics), en HTML/CSS/JS pur (**Canvas 2D**), sans dependance ni build.

Application de la suite **Astral Studio** (depot `Astral-studio`, dossier `apps/AstralEffet`).

Une composition est rendue sur un Canvas 2D. Les calques disposent de proprietes
transformables animees par **images cles** (position, echelle, rotation, opacite) et
d'une pile d'**effets** (flou, reglages couleur) rendus via le filtre Canvas natif.

## Lancer l'application

Deux methodes, sans installation :

1. Ouvrir `index.html` directement dans un navigateur moderne (double-clic).
   L'import de medias locaux fonctionne en `file://` (objets `blob:`) ; un serveur local reste recommande.
2. Serveur local (recommande) :

```
npm run serve
```

Ouvre `http://localhost:8080/` automatiquement. Autre port : `set PORT=8090` puis `npm run serve` (Windows) ou `PORT=8090 npm run serve` (macOS/Linux). `NO_OPEN=1` empeche l'ouverture auto.

## Fonctionnalites

- **Compositions** : dimension, cadence (IPS), duree, couleur de fond.
- **Calques** : solides, textes, formes (rectangle, ellipse, etoile), images et videos importees.
  Empilement, visibilite et verrouillage par calque, ordre modifiable.
- **Transformations** : position, echelle, rotation, opacite ; directement sur le canevas (deplacement, poignees d'echelle, poignee de rotation) ou par valeurs numeriques.
- **Images cles** : par propriete (bouton stopwatch) ; interpolation lineaire ou attenuee (entree/sortie/entree-sortie/maintien). Mode **Auto** pour creer une cle a chaque modification.
- **Effets** : Flou, Luminosite, Contraste, Saturation, Teinte, Noir et blanc, Sepia, Negatif ; parametres animables, activation/desactivation, empilement.
- **Modes de fusion** : normal, produit, superposition, incrustation, eclaircir, difference.
- **Lecture** : transport (debut, image precedente/suivante, lecture, fin), navigation au timecode, synchronisation des vidéos.
- **Chronologie** : regle, pistes de calques, lignes de proprietes et losanges d'images cles ; edition des cles par clic.
- **Vue** : zoom (molette centree sur le curseur) et deplacement (outil Main ou bouton milieu).
- **Historique** Annuler / Retablir (Ctrl+Z / Ctrl+Maj+Z).
- **Export** : image courante en **PNG**, projet en **JSON**, rendu video **WebM** (`MediaRecorder`).

## Raccourcis

| Touche | Action |
| --- | --- |
| Espace | lecture / pause |
| fleches gauche / droite (+Maj) | image precedente / suivante (10 images) |
| fleches haut / bas (+Maj) | deplacer le calque selectionne de 1 px (10 px) |
| Origine / Fin | debut / fin de composition |
| V / H | outil selection / main |
| T / S | nouveau texte / solide |
| E / R / Y | nouvelle forme : ellipse / rectangle / etoile |
| P / O / N | image cle position / opacite / rotation |
| Suppr | supprimer la selection |
| Ctrl+D / Ctrl+A | dupliquer / tout selectionner |
| Ctrl+Z / Ctrl+Maj+Z | annuler / retablir |

## Structure

```
index.html          coque de l'interface
styles.css          theme (grayscale)
js/
  utils.js          utilitaires (temps, timecode, couleurs, maths)
  keyframe.js       proprietes animees et interpolation (courbes d'acceleration)
  effects.js        registre d'effets et construction des filtres Canvas
  asset.js          medias importes (image / video) et sondage des metadonnees
  layer.js          calques (types, transformation, dessin du contenu)
  comp.js           composition : dimension, duree, pile de calques
  app.js            etat, selection, temps, historique
  player.js         lecture (requestAnimationFrame) et synchronisation des medias
  render.js         composition sur Canvas 2D + surcouche (selection, poignees)
  interaction.js    souris / clavier sur le canevas
  ui.js             menus, barres, panneaux calques / proprietes, chronologie
  export.js         export PNG / JSON / WebM
  main.js           demarrage et cablage
test/
  astraleffet-test.js  harnais de tests (Node, sans dependance)
scripts/
  check.js          verification syntaxique de tous les .js
  serve.js          serveur statique local (npm run serve)
```

## Tests

Sans dependance, via Node :

```
npm test      # harnais de tests (test/astraleffet-test.js)
npm run check # verification syntaxique de tous les fichiers .js
npm run verify
```

## Licence

MIT
