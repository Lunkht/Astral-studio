# AstralMovie

Clone minimaliste d'Adobe Premiere Pro (montage video), en HTML/CSS/JS pur (**Canvas 2D**), sans dependance ni build.

Application de la suite **Astral Studio** (depot `Astral-studio`, dossier `apps/AstralMovie`).

L'application importe de vrais medias via les API du navigateur (File API, elements
`<video>` / `<audio>` / `<img>`), les dispose sur des pistes, puis compose l'image courante
sur un Canvas 2D. L'export video s'appuie sur `MediaRecorder` (WebM).

## Lancer l'application

Deux methodes, sans installation :

1. Ouvrir `index.html` directement dans un navigateur moderne (double-clic). L'import de medias
   locaux fonctionne en `file://` (objets `blob:`) ; un serveur local reste recommande.
2. Serveur local (recommande) :

```
npm run serve
```

Ouvre `http://localhost:8080/` automatiquement. Autre port : `set PORT=8090` puis `npm run serve` (Windows) ou `PORT=8090 npm run serve` (macOS/Linux). `NO_OPEN=1` empeche l'ouverture auto.

## Fonctionnalites

- **Import de medias** : videos, images et sons (bouton « Importer… » ou glisser-deposer dans le panneau Medias).
- **Pistes** : plusieurs pistes video et audio, ajout/suppression, muet et verrouillage par piste.
- **Timeline** : regle temporelle, clips positionnes dans le temps, playhead.
- **Montage** : deplacer un clip (glisser), rogner les bords (poignees), **diviser** au playhead (S), dupliquer (Ctrl+D), supprimer (Suppr), **aimantation** aux bords/playhead.
- **Lecteur** : lecture / pause (Espace), pas a pas image par image, debut / fin, cadence (IPS) reglable.
- **Moniteur programme** : composition Canvas 2D de l'image courante (video, image, titres), opacite et vitesse par clip.
- **Titres** : clip de texte (T) avec contenu, couleur et taille.
- **Proprietes** : nom, piste, duree, point d'entree source, vitesse, opacite par clip.
- **Historique** Annuler / Retablir (Ctrl+Z / Ctrl+Maj+Z).
- **Export** : image courante en **PNG**, projet en **JSON**, sequence complete en **video WebM** (`MediaRecorder`).

## Raccourcis

| Touche | Action |
| --- | --- |
| Espace | lecture / pause |
| fleches gauche / droite (+Maj) | image precedente / suivante (10 images) |
| Origine / Fin | debut / fin de la sequence |
| S | diviser le clip au playhead |
| T | ajouter un titre |
| Suppr | supprimer la selection |
| Ctrl+D | dupliquer |
| Ctrl+Z / Ctrl+Maj+Z | annuler / retablir |
| Ctrl+0 / Ctrl+ +/- | echelle par defaut / zoom timeline |
| clic sur la regle | deplacer le playhead |

## Structure

```
index.html          coque de l'interface
styles.css          theme (grayscale)
js/
  utils.js          utilitaires (temps, timecode, aimantation, maths)
  asset.js          medias importes (video / audio / image) et sondage des metadonnees
  clip.js           modele de clip (position, entree source, duree, division)
  project.js        sequence : pistes, clips, requetes temporelles, montage
  app.js            etat, assets, selection, playhead, historique
  player.js         lecture (requestAnimationFrame) et synchronisation des medias
  render.js         composition Canvas 2D (video, image, titres)
  interaction.js    clavier et moniteur
  ui.js             menus, barres, panneau medias, proprietes, timeline
  export.js         export PNG / JSON / WebM
  main.js           demarrage et cablage
test/
  astralmovie-test.js  harnais de tests (Node, sans dependance)
scripts/
  check.js          verification syntaxique de tous les .js
  serve.js          serveur statique local (npm run serve)
```

## Tests

Sans dependance, via Node :

```
npm test      # harnais de tests (test/astralmovie-test.js)
npm run check # verification syntaxique de tous les fichiers .js
npm run verify
```

## Licence

MIT
