# AREPROG — Gestion

Outil professionnel complet de gestion : devis, factures, RDV, statistiques et fiscalité.
Refonte modulaire de `gestion.html` du repo [areprog](https://github.com/uziaq/areprog),
isolant le HTML, le CSS et le JS dans des fichiers séparés.

Les données sont synchronisées en temps réel avec le projet Firebase d'AREPROG
(`areprog-devis`) — ce repo partage donc les mêmes documents, clients et RDV
que `areprog/gestion.html`.

## Fonctionnalités

- **Authentification** : Firebase Auth (email + mot de passe)
- **Devis & factures** : création, édition, conversion devis → facture, acompte, PDF
- **Carnet clients** : véhicules multiples par client, historique
- **Catalogue services** : éditable (catégories, prix, gains), stockage Firestore
- **Templates** : personnalisation de l'en-tête, du logo, des couleurs et du pied de page
- **Agenda** : calendrier mensuel, RDV liés clients/véhicules/documents
- **Rappels par email** : EmailJS, programmation à H‑X heures/jours
- **Statistiques** : CA mensuel, top prestations, taux de conversion, KPIs, export CSV
- **Fiscalité** : suivi des frais (km, péages, matériel…), calcul de marge nette,
  marquage déclaré / non déclaré
- **PWA** : installable iOS/Android, fonctionne hors-ligne (cache Service Worker)
- **Raccourcis clavier** : voir la modale via `?`

## Structure

```
.
├── index.html                # Squelette HTML + écrans, modales (sans CSS ni JS inline)
├── css/
│   └── styles.css            # Tous les styles (dark theme + responsive mobile + print)
├── js/
│   ├── firebase-config.js    # Config Firebase (à modifier pour utiliser un autre projet)
│   └── app.js                # Logique applicative (auth, sync, docs, agenda, stats…)
├── manifest.json             # PWA manifest (start_url = "/")
├── sw.js                     # Service Worker (cache offline + notifications push)
├── favicon.svg, *.png, *.ico # Icônes (à uploader manuellement, voir plus bas)
└── README.md
```

## Déploiement

### Option 1 — GitHub Pages

1. Settings → Pages → Source = `Deploy from a branch` → branch `main` / `/`
2. L'app sera disponible sur `https://<user>.github.io/gestion/`
3. **Important** : adapter les chemins absolus (`/css/...`, `/js/...`, `/manifest.json`,
   `/sw.js`) si le site n'est pas servi à la racine. Pour Pages avec sous-chemin,
   un domaine custom est plus simple.

### Option 2 — Netlify / Vercel / Cloudflare Pages

- Build command : *(aucun)*
- Publish directory : `.`
- Domaine custom recommandé pour conserver les chemins absolus.

### Option 3 — Serveur statique local (test)

```bash
python3 -m http.server 8080
# puis http://localhost:8080
```

## Configuration Firebase

Le fichier `js/firebase-config.js` contient la config du projet `areprog-devis`.
Pour utiliser un projet Firebase distinct (données séparées) :

1. Créer un projet sur https://console.firebase.google.com
2. Activer **Authentication** (Email/Password) et créer un utilisateur
3. Activer **Firestore Database** (mode production)
4. Ajouter les règles Firestore minimales :

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
5. Récupérer la config Web (Project Settings → Your apps → SDK setup) et
   remplacer le contenu de `js/firebase-config.js`.

## EmailJS (rappels RDV)

Le `publicKey` EmailJS (`3xdOxKiXtMqhlc7ei`) est en clair dans `js/app.js`
(c'est par design : la clé publique côté navigateur). Pour utiliser un autre
compte EmailJS, modifier la valeur passée à `emailjs.init({...})` dans
`js/app.js` (chercher `publicKey`).

## Icônes PNG / ICO (à ajouter manuellement)

Pour conserver le branding AREPROG complet, copier ces fichiers depuis le repo
`areprog` à la racine de ce repo :

- `favicon-32x32.png` (1 KB)
- `favicon-512.png` (24 KB)
- `apple-touch-icon.png` (7 KB, 180×180)
- `favicon.ico` (3 KB)

L'app fonctionne sans (le navigateur affiche un favicon par défaut), mais ils
améliorent l'install PWA (icône sur l'écran d'accueil iOS/Android).

## Dépendances externes (chargées via CDN)

- Firebase SDK 10.12 (Auth + Firestore)
- EmailJS browser SDK 3.x
- jsPDF 2.5.1
- html2canvas 1.4.1
- Google Fonts : Barlow, Barlow Condensed, JetBrains Mono

Aucun bundler, aucune installation `npm`. L'app est servie en statique.

## Développement

Pour modifier le code :

- **CSS** → `css/styles.css` (toutes les règles, y compris `@media print` et responsive)
- **HTML** → `index.html` (structure + modales)
- **JS** → `js/app.js` (toutes les fonctions globales, ordre conservé du source)
- **Firebase** → `js/firebase-config.js` (config isolée, swap rapide)

Notes :
- Les fonctions JS sont déclarées au global (pas de modules ES). L'ordre de
  chargement des `<script>` dans `index.html` doit rester `firebase-config.js`
  avant `app.js`.
- Les modales dupliquées dans le source AREPROG (carnet, ajout client, RDV, etc.)
  ont été dédupliquées dans cette refonte.
- La fin du source AREPROG était tronquée (Service Worker incomplet) — la
  registration a été complétée proprement dans `index.html`.
