# AstralAudi

Clone minimaliste d'Audacity (edition audio multipiste), en HTML/CSS/JS pur (**Canvas 2D** + **Web Audio**), sans dependance ni build.

Application de la suite **Astral Studio** (depot `Astral-studio`, dossier `apps/AstralAudi`).

L'application importe de vrais fichiers audio via la File API et `decodeAudioData`, les dispose
sur des pistes sous forme de clips editables, affiche les formes d'onde sur un Canvas 2D, joue la
session via Web Audio, et exporte un mixage en **WAV**. Tout le modele (donnees audio, clips,
pistes, montage, effets) est en JavaScript pur et testable sans navigateur ; seul `engine.js`
touche au Web Audio.

## Lancer l'application

Deux methodes, sans installation :

1. Ouvrir `index.html` directement dans un navigateur moderne (double-clic). Un serveur local reste recommande pour l'import de fichiers.
2. Serveur local (recommande) :

```
npm run serve
```

Ouvre `http://localhost:8080/` automatiquement. Autre port : `set PORT=8090` puis `npm run serve` (Windows) ou `PORT=8090 npm run serve` (macOS/Linux). `NO_OPEN=1` empeche l'ouverture auto.

## Fonctionnalites

- **Import audio** : bouton « Importer... » ou glisser (formats supportes par le navigateur : WAV, MP3, OGG, M4A, FLAC...).
- **Generation** : sinus 440 / 880 Hz et bruit blanc, directement sur la piste courante.
- **Pistes** : plusieurs pistes, ajout / suppression, muet, solo, **gain** par piste.
- **Timeline** : regle temporelle, formes d'onde dessinees a l'ecran, clips positionnes dans le temps, curseur (tete de lecture).
- **Selection** : cliquer-glisser sur une piste pour definir une **region** temporelle ; selection d'un clip par clic.
- **Edition de region** : couper, copier, coller, **supprimer** (referme le trou) ou **silence** (conserve la duree).
- **Effets** : amplifier (+/- 3 dB), **normaliser**, **inverser** (reverse), **fonds** entrant / sortant, insertion de silence.
- **Lecture** : lecture / stop (Espace), recul / avance, debut / fin, pas de 10 ms (Maj = 100 ms).
- **Proprietes de clip** : nom, debut, duree, gain (dB), fondus.
- **Historique** : Annuler / Retablir (Ctrl+Z / Ctrl+Y).
- **Export** : mixage complet en **WAV** (16 bits PCM) et projet en **JSON**.

## Raccourcis

| Touche | Action |
| --- | --- |
| Espace | lecture / stop |
| fleches gauche / droite (+Maj) | reculer / avancer de 10 ms (100 ms) |
| Origine / Fin | debut / fin de la session |
| Suppr | supprimer la region (ou le clip selectionne) |
| Ctrl+C / Ctrl+X / Ctrl+V | copier / couper / coller la region |
| Ctrl+Z / Ctrl+Y | annuler / retablir |
| M / S | muet / solo de la piste courante |
| I | inserer 1 s de silence |
| + / - | zoom de la timeline |
| clic sur la regle | deplacer le curseur |
| glisser sur une piste | selectionner une region |
| molette / Maj+molette | zoom / defilement |

## Structure

```
index.html          coque de l'interface
styles.css          theme (grayscale)
js/
  utils.js          utilitaires (temps, dB, maths)
  audiodata.js      representation audio pure JS (canaux Float32), slices, peaks, encodage WAV
  asset.js          medias audio importes / generes
  clip.js           modele de clip (position, offset source, duree, gain, fondus, division)
  track.js          piste (clips, gain, muet, solo, panoramique)
  project.js        session multipiste (pistes, duree)
  edits.js          operations de montage et transformations pures
  app.js            etat, assets, selection, curseur, historique
  engine.js         lecture Web Audio (AudioBufferSource, gain, panoramique)
  render.js         formes d'onde et timeline sur Canvas 2D
  interaction.js    souris, molette et clavier
  ui.js             menus, barres, panneau pistes, proprietes
  export.js         mixage et export WAV / JSON
  main.js           demarrage et cablage
test/
  astralaudi-test.js   harnais de tests (Node, sans dependance)
scripts/
  check.js          verification syntaxique de tous les .js
  serve.js          serveur statique local (npm run serve)
```

## Tests

Sans dependance, via Node :

```
npm test      # harnais de tests (test/astralaudi-test.js)
npm run check # verification syntaxique de tous les fichiers .js
npm run verify
```

Le modele audio etant en JavaScript pur (les donnees sont des `Float32Array` independants du
navigateur), la logique de montage et les effets sont couverts par les tests sans Web Audio.

## Licence

MIT
