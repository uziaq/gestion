// ============================================================
// 01-core.js — Auth, Firebase config usage, sync, catalog data, vehicles, clients, helpers, init/resetForm
// (Refonte modulaire de gestion.html, source AREPROG)
// ============================================================

// AUTH — Appel direct API Netlify Identity (fetch natif, zéro dépendance)
function $(s) { return document.getElementById(s); }

// ── Auth : Firebase Authentication ──────────────────────────
function showApp() {
  $('login-screen').style.display = 'none';
  $('app').style.display = 'block';
  initApp();
}
function showLogin() {
  $('app').style.display = 'none';
  $('login-screen').style.display = 'flex';
}
function setLoginLoading(on) {
  var btn = $('login-btn');
  btn.disabled = on;
  btn.textContent = on ? 'Connexion…' : 'Se connecter →';
}
function showLoginErr(msg) {
  var el = $('lerr');
  el.textContent = msg;
  el.style.display = 'block';
}

async function doLogin() {
  var email = $('l-email').value.trim();
  var pass  = $('l-pass').value;
  $('lerr').style.display = 'none';
  if (!email || !pass) { showLoginErr('Renseigne ton email et mot de passe.'); return; }
  setLoginLoading(true);
  try {
    await firebase.auth().signInWithEmailAndPassword(email, pass);
    // onAuthStateChanged prend le relais automatiquement
  } catch(e) {
    setLoginLoading(false);
    var msg = 'Email ou mot de passe incorrect.';
    if (e.code === 'auth/too-many-requests') msg = 'Trop de tentatives. Réessaie dans quelques minutes.';
    showLoginErr(msg);
    console.error(e);
  }
}

function doLogout() {
  firebase.auth().signOut();
}

// Au chargement : session encore valide → connecter directement
document.addEventListener('DOMContentLoaded', function() {
  // Charger EmailJS, jsPDF, html2canvas dynamiquement
  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb || function(){};
    s.onerror = function(){ console.warn('Script non chargé:', src); };
    document.head.appendChild(s);
  }
  loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js', function() {
    try {
      emailjs.init({ publicKey: '3xdOxKiXtMqhlc7ei' });
      _ejsReady = true;
      console.log('EmailJS initialisé ✓');
    } catch(e) { console.warn('EmailJS init failed:', e); }
  });
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');

  // Touches clavier
  var lp = $('l-pass');
  if (lp) lp.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  var le = $('l-email');
  if (le) le.addEventListener('keydown', function(e){ if(e.key==='Enter') $('l-pass').focus(); });

  // Initialiser Firebase avant tout appel à firebase.auth()
  if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
  db = firebase.firestore();

  // Gestion de session via Firebase Auth
  // onAuthStateChanged est appelé à chaque changement d'état (login, logout, expiration)
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      showApp();
    } else {
      setLoginLoading(false);
      showLogin();
    }
  });

  // Relier le bouton proprement (évite tout souci de timing)
  var btn = $('login-btn');
  if (btn) btn.onclick = doLogin;
  // Enter dans les modals catalogue
  var cli = $('cat-item-label');
  if (cli) cli.addEventListener('keydown', function(e){ if(e.key==='Enter') saveCatItem(); });
  var cgi = $('cat-group-name-input');
  if (cgi) cgi.addEventListener('keydown', function(e){ if(e.key==='Enter') confirmAddGroup(); });
});

// ============================================================
//  FIREBASE — Synchronisation cloud
// ============================================================
// FB_CONFIG est défini dans /js/firebase-config.js (chargé avant ce fichier)

var db = null;
var syncOk = false;

function initFirebase() {
  try {
    // Firebase est déjà initialisé dans DOMContentLoaded avant onAuthStateChanged
    // On s'assure juste que db est disponible
    if (!db) db = firebase.firestore();
    // Test de connexion Firestore
    db.collection('docs').limit(1).get()
      .then(function() { setSyncStatus(true, 'Firebase connecté'); })
      .catch(function(e) { setSyncStatus(false, 'Firestore inaccessible'); console.warn(e); });
  } catch(e) {
    setSyncStatus(false, 'Firebase non disponible');
    console.warn('Firebase init failed:', e);
  }
}

function setSyncStatus(ok, msg) {
  syncOk = ok;
  var dot = $('sync-dot');
  var lbl = $('sync-status');
  if (!dot || !lbl) return;
  dot.className = 'sync-dot ' + (ok ? 'ok' : 'err');
  lbl.textContent = msg;
  if (ok) {
    var last = $('sync-last');
    if (last) last.textContent = 'Sync ' + new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
  }
}

function setSyncLoading(msg) {
  var dot = $('sync-dot');
  var lbl = $('sync-status');
  if (dot) dot.className = 'sync-dot loading';
  if (lbl) lbl.textContent = msg || 'Synchronisation…';
}

// ── DOCS ────────────────────────────────────────────────────────────────────
function loadDocs() {
  return JSON.parse(localStorage.getItem('ar_docs') || '[]');
}

function saveDocs(arr) {
  localStorage.setItem('ar_docs', JSON.stringify(arr));
  // Sync Firebase en arrière-plan
  if (db && syncOk) {
    arr.forEach(function(doc) {
      db.collection('docs').doc(String(doc.id)).set(doc)
        .catch(function(e){ console.warn('Firebase save doc:', e); });
    });
  }
}

// Sync Firebase → localStorage (appelé au démarrage)
function syncFromFirebase(callback) {
  if (!db) { if (callback) callback(); return; }
  setSyncLoading('Chargement depuis Firebase…');
  db.collection('docs').orderBy('date','desc').get()
    .then(function(snap) {
      if (!snap.empty) {
        var docs = [];
        snap.forEach(function(d){ docs.push(d.data()); });
        localStorage.setItem('ar_docs', JSON.stringify(docs));
      }
      // Sync clients
      return db.collection('clients').get();
    })
    .then(function(snap) {
      if (snap && !snap.empty) {
        var clients = [];
        snap.forEach(function(d){ clients.push(d.data()); });
        localStorage.setItem('ar_clients', JSON.stringify(clients));
      }
      syncCatalogueFromFirebase();
      syncRdvsFromFirebase();
      setSyncStatus(true, 'Firebase synchronisé');
      renderDash();
      renderCarnet();
      if (callback) callback();
    })
    .catch(function(e) {
      setSyncStatus(false, 'Sync échouée — données locales');
      console.warn('Firebase sync:', e);
      if (callback) callback();
    });
}

// Listener temps réel — met à jour si un autre appareil modifie
function startRealtimeSync() {
  if (!db || !syncOk) return;
  db.collection('docs').onSnapshot(function(snap) {
    var docs = [];
    snap.forEach(function(d){ docs.push(d.data()); });
    docs.sort(function(a,b){ return (b.id||0)-(a.id||0); });
    localStorage.setItem('ar_docs', JSON.stringify(docs));
    renderDash();
    if ($('t-liste') && $('t-liste').classList.contains('on')) renderListe();
    setSyncStatus(true, 'Synchronisé en temps réel');
  }, function(e){ console.warn('Realtime sync err:', e); });

  db.collection('clients').onSnapshot(function(snap) {
    var clients = [];
    snap.forEach(function(d){ clients.push(d.data()); });
    localStorage.setItem('ar_clients', JSON.stringify(clients));
    if ($('t-carnet') && $('t-carnet').classList.contains('on')) renderCarnet();
  }, function(e){ console.warn('Clients sync err:', e); });
}

// ── VÉHICULES MULTIPLES ──────────────────────────────────────────────────────
var vehRowId = 0;
function removeVehRow(btn) {
  var row = btn.parentElement && btn.parentElement.parentElement;
  if (row && row.classList.contains('veh-row')) row.remove();
}
function addVehicleRow(data) {
  data = data || {};
  var id = ++vehRowId;
  var vl = $('ac-veh-list');
  if (!vl) return;
  var div = document.createElement('div');
  div.className = 'veh-row';
  div.style.cssText = 'background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:6px';
  div.innerHTML =
    '<div style="display:flex;gap:6px;margin-bottom:6px">'
    + '<input class="vr-vm" type="text" placeholder="Marque" value="'+(data.vm||'')+'" style="flex:1;padding:7px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"/>'
    + '<input class="vr-vmo" type="text" placeholder="Modèle" value="'+(data.vmo||'')+'" style="flex:1.5;padding:7px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"/>'
    + '<button onclick="removeVehRow(this)" style="width:28px;height:32px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text-dim);cursor:pointer;font-size:16px;flex-shrink:0">×</button>'
    + '</div>'
    + '<div style="display:flex;gap:6px">'
    + '<input class="vr-vmot" type="text" placeholder="Motorisation" value="'+(data.vmot||'')+'" style="flex:2;padding:7px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"/>'
    + '<input class="vr-van" type="text" placeholder="Année" value="'+(data.van||'')+'" style="flex:0.8;padding:7px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px"/>'
    + '<input class="vr-vim" type="text" placeholder="Immat" value="'+(data.vim||'')+'" style="flex:1.2;padding:7px 9px;background:var(--bg4);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;text-transform:uppercase"/>'
    + '</div>';
  vl.appendChild(div);
}

// Ouvrir le sélecteur de véhicule pour un client dans le formulaire devis
function openVehSelect(clientId) {
  var cl = loadClients().find(function(cl){ return cl.id === clientId; });
  if (!cl) return;
  var vehs = cl.vehs && cl.vehs.length ? cl.vehs
    : (cl.vm ? [{vm:cl.vm,vmo:cl.vmo||'',vmot:cl.vmot||'',van:cl.van||'',vim:cl.vim||''}] : []);
  if (vehs.length === 0) return;
  if (vehs.length === 1) { applyVehicle(vehs[0]); return; }
  // Plusieurs véhicules → afficher le sélecteur
  var list = $('veh-select-list');
  list.innerHTML = vehs.map(function(v, i) {
    var label = [v.vm,v.vmo,v.vmot,v.van?'('+v.van+')':''].filter(Boolean).join(' ');
    return '<div class="veh-item" onclick="applyVehicle('+JSON.stringify(v).replace(/"/g,'&quot;')+')">'
      + '<div class="veh-item-info">'
        + '<div class="veh-item-name">'+escHtml(label)+'</div>'
        + (v.vim ? '<div class="veh-item-sub">'+escHtml(v.vim.toUpperCase())+'</div>' : '')
      + '</div>'
      + '<span style="color:var(--blue);font-size:18px">→</span>'
      + '</div>';
  }).join('');
  $('veh-select-modal').classList.add('open');
}

function applyVehicle(v) {
  $('f-vm').value   = v.vm   || '';
  $('f-vmo').value  = v.vmo  || '';
  $('f-vmot').value = v.vmot || '';
  $('f-van').value  = v.van  || '';
  $('f-vim').value  = (v.vim || '').toUpperCase();
  $('veh-select-modal').classList.remove('open');
}

// ── CLIENTS ─────────────────────────────────────────────────────────────────
function loadClients() {
  return JSON.parse(localStorage.getItem('ar_clients') || '[]');
}

function saveClients(arr) {
  localStorage.setItem('ar_clients', JSON.stringify(arr));
  if (db && syncOk) {
    arr.forEach(function(cl) {
      db.collection('clients').doc(String(cl.id)).set(cl)
        .catch(function(e){ console.warn('Firebase save client:', e); });
    });
  }
}

function deleteDocFirebase(docId) {
  if (db && syncOk) {
    db.collection('docs').doc(String(docId)).delete()
      .catch(function(e){ console.warn('Firebase delete:', e); });
  }
}

function deleteClientFirebase(clientId) {
  if (db && syncOk) {
    db.collection('clients').doc(String(clientId)).delete()
      .catch(function(e){ console.warn('Firebase delete client:', e); });
  }
}

// ============================================================
//  CATALOGUE — extrait exact de tarifs.html
// ============================================================
var CAT_DEFAULT = [
  { g: 'Reprogrammation moteur', items: [
    { l: 'Stage 1 — Reprogrammation moteur (essence & diesel turbo) · 100% réversible', p: 330,
      gains: ['Meilleure réactivité moteur', 'Couple optimisé dès bas régimes', 'Agrément de conduite amélioré', '100% réversible'] },
    { l: 'Stage 2 — Reprogrammation haute performance (avec modifs mécaniques)', p: 460,
      gains: ['Cartographie sur-mesure', 'Couple & puissance maximisés', 'Suivi personnalisé', '100% réversible'] },
    { l: 'Conversion E85 — Bioéthanol natif ECU · Sans boîtier externe', p: 330,
      gains: ['Carburant E85 ≈ 0,75 €/L vs 1,80 €/L SP95', '−40% sur le coût carburant', 'Compatible toutes stations E85', 'Bilan carbone amélioré'] },
    { l: 'Optimisation consommation — Idéal grands rouleurs & flottes', p: 380,
      gains: ['−10 à −15% de carburant', 'Idéal grands rouleurs & flottes', 'Couple amélioré bas régime'] },
    { l: 'Retour à l\'origine — Restauration fichier constructeur (offert si reprog AREPROG)', p: 0, gains: [] },
  ]},
  { g: 'Désactivations — usage spécifique', items: [
    { l: 'EGR OFF — Désactivation vanne EGR · Diesel · Logiciel uniquement', p: 180,
      gains: ['Admission protégée de l\'encrassement', 'Moteur plus propre', 'Fiabilité accrue +80 000 km'] },
    { l: 'FAP / DPF OFF — Usage circuit & export uniquement (après retrait physique)', p: 280,
      gains: ['Régénérations forcées supprimées', 'Contre-pressions éliminées', 'Consommation stabilisée'] },
    { l: 'AdBlue / SCR OFF — Désactivation réduction catalytique · Hors homologation voie publique', p: 280,
      gains: ['Coût AdBlue supprimé', 'Système simplifié', 'Alertes défaillance supprimées'] },
    { l: 'Swirl OFF — Désactivation volets d\'admission · Diesel · Prévention défaillances', p: 140,
      gains: ['Prévention casse mécanique', 'Moteur protégé', 'Aucun impact sur les performances'] },
  ]},
  { g: 'Packs combinés — économies garanties', items: [
    { l: 'Pack Stage 1 + EGR OFF · Diesel — 2 prestations en 1 intervention', p: 370,
      gains: ['Performance + protection admission', 'Économie vs prestations séparées', '2 prestations en 1 déplacement'] },
    { l: 'Pack Stage 1 + FAP OFF · Diesel (après retrait physique du filtre)', p: 370,
      gains: ['Performance + suppression régénérations', 'Économie vs prestations séparées', '2 prestations en 1 déplacement'] },
    { l: 'Pack Stage 1 + EGR + FAP OFF — Préparation diesel complète ★', p: 390,
      gains: ['Performance + protection + flux échappement', 'Tout en une seule intervention', 'Économies maximales'] },
    { l: 'Pack Stage 1 + AdBlue OFF — Moteur optimisé + SCR désactivé', p: 400,
      gains: ['Performance moteur', 'Coût AdBlue supprimé', 'Économie vs prestations séparées'] },
  ]},
  { g: 'Diagnostic & spécialités VAG', items: [
    { l: 'Diagnostic ODIS VAG — VW · Audi · Seat · Skoda · Porsche · Outil officiel constructeur', p: 100,
      gains: ['Diagnostic officiel constructeur', 'Codages avancés disponibles', 'Mises à jour via serveurs VAG officiels'] },
  ]},
  { g: 'Options logicielles (en complément d\'une reprog, sinon +100 €)', items: [
    { l: 'Pop & Bang — Détonations à la décélération · Effet sonore agressif', p: 150, gains: ['Son sportif à la décélération'] },
    { l: 'Pop & Bang Sport Button — Pops actifs uniquement en mode Sport', p: 180, gains: ['Pops actifs en mode Sport uniquement'] },
    { l: 'DSG Farts — Crépitements à la décélération sur boîtes DSG', p: 150, gains: ['Crépitements DSG à la décélération'] },
    { l: 'Popcorn — Crépitements agressifs continus', p: 150, gains: ['Crépitements agressifs continus'] },
    { l: 'Launch Control — Optimisation départ arrêté · Meilleur 0-100', p: 150, gains: ['Départ arrêté optimisé', 'Meilleur chrono 0-100'] },
    { l: 'Octane Adaptation — Adaptation automatique selon indice d\'octane', p: 360, gains: ['Adaptation auto selon carburant utilisé'] },
    { l: 'Exhaust Flaps — Gestion des clapets d\'échappement selon le mode', p: 60, gains: ['Gestion des clapets par mode de conduite'] },
    { l: 'Start & Stop OFF — Désactivation définitive du Start & Stop', p: 60, gains: ['Start & Stop définitivement désactivé'] },
    { l: 'Vmax OFF — Suppression du limiteur de vitesse constructeur', p: 60, gains: ['Bridage vitesse supprimé'] },
    { l: 'Power on Driving Mode — Démarrage automatique en mode Sport', p: 60, gains: ['Démarre toujours en mode Sport'] },
    { l: 'Sport Display — Affichage données sportives au tableau de bord', p: 60, gains: ['Données sportives sur le tableau de bord'] },
    { l: 'Vmax 30 — Limitation à 30 km/h', p: 90, gains: ['Limitation à 30 km/h — chantier/logistique'] },
  ]},
  { g: 'Suppléments & options', items: [
    { l: 'Supplément déplacement hors zone (+30 km)', p: 40, gains: [] },
    { l: 'Supplément fichier inconnu (reprise modif tiers)', p: 30, gains: [] },
    { l: 'Supplément intervention urgente (sous 24h)', p: 50, gains: [] },
    { l: 'Prestation personnalisée / Sur-mesure', p: 0, gains: [] },
  ]},
];

// ============================================================
//  CATALOGUE DYNAMIQUE — modifiable par l'utilisateur
// ============================================================
var CAT_KEY = 'ar_catalogue';

function loadCat() {
  try {
    var raw = localStorage.getItem(CAT_KEY);
    return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(CAT_DEFAULT));
  } catch(e) { return JSON.parse(JSON.stringify(CAT_DEFAULT)); }
}

function saveCat(cat) {
  localStorage.setItem(CAT_KEY, JSON.stringify(cat));
  // Sync Firebase
  if (db && syncOk) {
    db.collection('config').doc('catalogue').set({ cat: cat })
      .catch(function(e){ console.warn('Firebase cat save:', e); });
  }
}

// CAT actif (rechargé à chaque renderLines)
var CAT = loadCat();

function reloadCat() {
  CAT = loadCat();
}

var SHOP_PRODUCTS = null;
function loadShopProducts(cb) {
  if (SHOP_PRODUCTS !== null) { if (cb) cb(SHOP_PRODUCTS); return; }
  fetch('/products.json')
    .then(function(r){ return r.json(); })
    .then(function(data){
      SHOP_PRODUCTS = (data || []).filter(function(p){ return p.active !== false; });
      if (cb) cb(SHOP_PRODUCTS);
    })
    .catch(function(){ SHOP_PRODUCTS = []; if (cb) cb([]); });
}

// Gains automatiques par mot-clé
// getGains — récupère les gains directement depuis le catalogue dynamique
function getGains(lines) {
  var cat = loadCat();
  var set = new Set();
  lines.forEach(function(l) {
    if (!l.label) return;
    // Cherche la prestation exacte dans le catalogue
    for (var gi = 0; gi < cat.length; gi++) {
      for (var ii = 0; ii < cat[gi].items.length; ii++) {
        var it = cat[gi].items[ii];
        if (it.l === l.label && it.gains && it.gains.length) {
          it.gains.forEach(function(g){ if(g) set.add(g); });
        }
      }
    }
  });
  return [...set].slice(0, 8);
}

// ============================================================
//  HELPERS
// ============================================================
function fmt(n) { return n.toFixed(2).replace('.', ',') + ' €'; }
function fmtDate(d) {
  if (!d) return '—';
  const [y,m,j] = d.split('-');
  return j + '/' + m + '/' + y;
}
function today() { return new Date().toISOString().split('T')[0]; }
function plusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
// FIX bug : numérotation par max+1 (pas par count) pour éviter les doublons après suppression
function genNum(prefix) {
  const y = new Date().getFullYear();
  const docs = loadDocs();
  let max = 0;
  docs.forEach(d => {
    if (!d.num) return;
    const m = d.num.match(new RegExp('^' + prefix + '-' + y + '-(\\d+)$'));
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  });
  return prefix + '-' + y + '-' + String(max + 1).padStart(3, '0');
}

// ============================================================
//  TABS
// ============================================================

// ============================================================
//  FORM STATE
// ============================================================
var lines = [];
var editId = null;

function initApp() {
  loadShopProducts();
  resetForm(false);
  fillTplForm(loadTemplate());
  renderDash();
  renderCarnet();
  initKeyboardShortcuts();
  // Firebase
  initFirebase();
  setTimeout(function() {
    syncFromFirebase(function() {
      startRealtimeSync();
      syncRdvsFromFirebase();
      setTimeout(startRdvsRealtimeSync, 1000);
    });
  }, 500);
  // Vérifier rappels agenda
  setTimeout(checkTodayNotifs, 2000);
  // Vérifier si un brouillon existe
  setTimeout(checkAndRestoreDraft, 500);
}

function resetForm(goToForm) {
  editId = null;
  lines = [];
  $('f-type').value = 'devis';
  $('f-num').value = genNum('DEV');
  $('f-date').value = today();
  $('f-ech').value = plusDays(30);
  $('f-statut').value = 'envoye';
  // Reset statut properly
  var s = $('f-statut');
  s.value = 'envoyé';
  ['f-cnom','f-cadr','f-cville','f-ctel','f-cemail','f-vm','f-vmo','f-vmot','f-van','f-vim','f-vkm','f-nint'].forEach(function(i) { $(i).value = ''; });
  $('f-tva').value = '0';
  $('f-notes').value = 'Prestation réalisée à domicile. Garantie 2 ans. Reprogrammation 100% réversible. Paiement à réception. Devis valable 30 jours.';
  $('form-h').textContent = 'Nouveau devis';
  currentGains = null;
  currentAcompte = null;
  renderGainsBar();
  if ($('f-gains')) { $('f-gains').value = ''; previewGainsBadge(); }
  resetDeclaration();
  resetFrais();
  addLine();
  if (goToForm) showTab('form');
}

function newDoc() { resetForm(true); }

function onTypeChange() {
  var t = $('f-type').value;
  $('form-h').textContent = t === 'devis' ? (editId ? 'Modifier le devis' : 'Nouveau devis') : (editId ? 'Modifier la facture' : 'Nouvelle facture');
  if (!editId) $('f-num').value = genNum(t === 'devis' ? 'DEV' : 'FAC');
}
