// ============================================================
// 04-agenda.js — Template editor, agenda/calendar/RDV, EmailJS rappels
// (Refonte modulaire de gestion.html, source AREPROG)
// ============================================================


// ============================================================
//  LOGO HTML pour les documents
// ============================================================
function sanitizeCssColor(c) {
  return /^#[0-9a-fA-F]{3,8}$|^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$|^rgba\(/.test(c||'') ? c : '#1E90FF';
}
function buildLogoHTML(tpl) {
  var nom = tpl.nom || 'AREPROG';
  var style = tpl.logoStyle || 'split';
  var color = sanitizeCssColor(tpl.color || '#1E90FF');
  if (style === 'split') {
    var half = Math.ceil(nom.length / 2);
    return escHtml(nom.slice(0,half)) + '<span style="color:' + color + '">' + escHtml(nom.slice(half)) + '</span>';
  } else if (style === 'full') {
    return '<span style="color:' + color + '">' + escHtml(nom) + '</span>';
  }
  return escHtml(nom);
}

// ============================================================
//  TEMPLATE — Modèle de document
// ============================================================
var TPL_KEY = 'ar_template';
var TPL_DEFAULT = {
  nom:'AREPROG', activite:'Reprogrammation moteur à domicile',
  zones:'Pays Basque (64) · Landes (40) · Yonne (89)',
  tel:'06 67 92 46 30', email:'contact@areprog.fr', web:'areprog.fr',
  adresse:'', legal:'',
  footer:'AREPROG — Reprogrammation moteur à domicile · Pays Basque (64) · Landes (40) · Yonne (89)\n06 67 92 46 30 · areprog.fr · Garantie 2 ans sur chaque prestation · 100% réversible',
  color:'#1E90FF', titleColor:'#111111', logoStyle:'split',
  showGains:true, showVeh:true, showFooter:true, showLegal:true,
  colTotal:'Total HT', validite:30,
};

function loadTemplate() {
  try {
    var raw = localStorage.getItem(TPL_KEY);
    return raw ? Object.assign({},TPL_DEFAULT,JSON.parse(raw)) : Object.assign({},TPL_DEFAULT);
  } catch(e) { return Object.assign({},TPL_DEFAULT); }
}
function saveTemplate() {
  localStorage.setItem(TPL_KEY, JSON.stringify(readTplForm()));
  alert('Template enregistré ✓');
}
function resetTemplate() {
  if (!confirm('Réinitialiser le template aux valeurs par défaut ?')) return;
  localStorage.removeItem(TPL_KEY);
  fillTplForm(TPL_DEFAULT);
  livePreview();
}
function syncTpl(key,val) {
  var map = {
    nom:['tpl-nom','tpl2-nom'], activite:['tpl-activite','tpl2-activite'],
    zones:['tpl-zones','tpl2-zones'], tel:['tpl-tel','tpl2-tel'],
    web:['tpl-web','tpl2-web'], legal:['tpl-legal','tpl2-legal'],
    footer:['tpl-footer','tpl2-footer'], color:['tpl-color-hex','tpl2-color-hex'],
  };
  if (map[key]) map[key].forEach(function(id){ var el=$(id); if(el&&el.value!==val)el.value=val; });
  livePreview();
}
function readTplForm() {
  function v(id,def){ var el=$(id); return el&&el.value?el.value:def; }
  function ck(id,def){ var el=$(id); return el?el.checked:def; }
  return {
    nom:v('tpl-nom','AREPROG'), activite:v('tpl-activite',TPL_DEFAULT.activite),
    zones:v('tpl-zones',''), tel:v('tpl-tel',''), email:v('tpl-email',''),
    web:v('tpl-web',''), adresse:v('tpl-adresse',''), legal:v('tpl-legal',''),
    footer:v('tpl-footer',TPL_DEFAULT.footer),
    color:v('tpl-color-hex','#1E90FF'), titleColor:v('tpl-title-color-hex','#111111'),
    logoStyle:v('tpl-logo-style','split'),
    showGains:ck('tpl-show-gains',true), showVeh:ck('tpl-show-veh',true),
    showFooter:ck('tpl-show-footer',true), showLegal:ck('tpl-show-legal',true),
    colTotal:v('tpl-col-total','Total HT'),
    validite:parseInt(v('tpl-validite','30'))||30,
  };
}
function fillTplForm(tpl) {
  var fields=[
    ['tpl-nom',tpl.nom],['tpl-activite',tpl.activite],['tpl-zones',tpl.zones],
    ['tpl-tel',tpl.tel],['tpl-email',tpl.email],['tpl-web',tpl.web],
    ['tpl-adresse',tpl.adresse],['tpl-legal',tpl.legal],['tpl-footer',tpl.footer],
    ['tpl-color-hex',tpl.color],['tpl-color-pick',tpl.color],
    ['tpl-title-color-hex',tpl.titleColor],['tpl-title-color-pick',tpl.titleColor],
    ['tpl2-nom',tpl.nom],['tpl2-activite',tpl.activite],['tpl2-zones',tpl.zones],
    ['tpl2-tel',tpl.tel],['tpl2-web',tpl.web],['tpl2-legal',tpl.legal],
    ['tpl2-footer',tpl.footer],['tpl2-color-hex',tpl.color],['tpl2-color-pick',tpl.color],
  ];
  fields.forEach(function(f){ var el=$(f[0]); if(el) el.value=f[1]||''; });
  var ls=$('tpl-logo-style'); if(ls) ls.value=tpl.logoStyle||'split';
  var cs=$('tpl-col-total'); if(cs) cs.value=tpl.colTotal||'Total HT';
  var ve=$('tpl-validite'); if(ve) ve.value=tpl.validite||30;
  if($('tpl-show-gains'))  $('tpl-show-gains').checked  = tpl.showGains!==false;
  if($('tpl-show-veh'))    $('tpl-show-veh').checked    = tpl.showVeh!==false;
  if($('tpl-show-footer')) $('tpl-show-footer').checked = tpl.showFooter!==false;
  if($('tpl-show-legal'))  $('tpl-show-legal').checked  = tpl.showLegal!==false;
}
function syncColorInput(){ var v=$('tpl-color-pick').value; $('tpl-color-hex').value=v; if($('tpl2-color-pick'))$('tpl2-color-pick').value=v; if($('tpl2-color-hex'))$('tpl2-color-hex').value=v; livePreview(); }
function syncColorPicker(){ var v=$('tpl-color-hex').value; if(/^#[0-9a-fA-F]{6}$/.test(v)){$('tpl-color-pick').value=v; if($('tpl2-color-pick'))$('tpl2-color-pick').value=v; if($('tpl2-color-hex'))$('tpl2-color-hex').value=v;} livePreview(); }
function syncTitleColorInput(){ var v=$('tpl-title-color-pick').value; $('tpl-title-color-hex').value=v; livePreview(); }
function syncTitleColorPicker(){ var v=$('tpl-title-color-hex').value; if(/^#[0-9a-fA-F]{6}$/.test(v))$('tpl-title-color-pick').value=v; livePreview(); }
function openTemplateModal(){ fillTplForm(readTplForm()); livePreview(); $('tpl-modal').classList.add('open'); }
function closeTplModal(){ $('tpl-modal').classList.remove('open'); }
function livePreview() {
  var tpl = readTplForm();
  var sampleDoc = {
    type:'devis',num:'DEV-2026-001',date:new Date().toISOString().split('T')[0],
    ech:new Date(Date.now()+30*86400000).toISOString().split('T')[0],statut:'envoyé',
    cn:'Dupont Thomas',ca:'12 rue des Pins',cv:'64100 Bayonne',
    ct:'06 12 34 56 78',ce:'thomas@email.fr',
    vm:'Volkswagen',vmo:'Golf 7 GTI',vmot:'2.0 TSI 220ch',van:'2019',vim:'AB-123-CD',
    lines:[
      {label:'Stage 1 — Reprogrammation moteur (essence & diesel turbo)',qte:1,pu:330,offert:false},
      {label:'Conversion E85 — Bioéthanol natif ECU',qte:1,pu:330,offert:false},
      {label:'Diagnostic ODIS VAG',qte:1,pu:0,offert:true},
    ],
    tvaRate:0,ht:660,tva:0,ttc:660,
    notes:'Prestation réalisée à domicile. Garantie 2 ans. 100% réversible.',
    gains:{ch:220,chOrig:180,nm:380,nmOrig:320},
  };
  var html = renderDocHTML(sampleDoc, tpl);
  var m=$('tpl-mini-preview'); if(m) m.innerHTML=html;
  var l=$('tpl-live-preview'); if(l) l.innerHTML=html;
}

// ============================================================
//  TABS (complet avec template)
// ============================================================
// ============================================================
//  AGENDA — Calendrier + Notifications
// ============================================================
var RDV_KEY = 'ar_rdvs';
var calDate = new Date(); // mois affiché
var calSelected = new Date(); // jour sélectionné
var editingRdvId = null;

// ── Storage RDVs ─────────────────────────────────────────────
function loadRdvs() {
  try { return JSON.parse(localStorage.getItem(RDV_KEY) || '[]'); } catch(e) { return []; }
}
function saveRdvs(arr) {
  localStorage.setItem(RDV_KEY, JSON.stringify(arr));
  if (db && syncOk) {
    db.collection('rdvs').doc('all').set({ rdvs: arr })
      .catch(function(e){ console.warn('Firebase rdvs:', e); });
  }
}

// ── Rendu calendrier ─────────────────────────────────────────
var DOW = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
var MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function renderAgenda() {
  renderCalendar();
  renderSideEvents(calSelected);
  renderAutoAlerts();
  fillRdvClientSelect();
}

function calPrev() { calDate.setMonth(calDate.getMonth()-1); renderCalendar(); }
function calNext() { calDate.setMonth(calDate.getMonth()+1); renderCalendar(); }
function calToday() { calDate = new Date(); calSelected = new Date(); renderCalendar(); renderSideEvents(calSelected); }

function renderCalendar() {
  var y = calDate.getFullYear(), m = calDate.getMonth();
  $('cal-month-label').textContent = MONTHS[m] + ' ' + y;

  // Premier lundi avant le 1er du mois
  var first = new Date(y, m, 1);
  var startDow = (first.getDay() + 6) % 7; // lundi=0
  var start = new Date(first); start.setDate(1 - startDow);

  var rdvs = loadRdvs();
  var grid = $('cal-grid');
  grid.innerHTML = DOW.map(function(d){ return '<div class="cal-dow">'+d+'</div>'; }).join('');
  var today = new Date(); today.setHours(0,0,0,0);

  for (var i = 0; i < 42; i++) {
    var d = new Date(start); d.setDate(start.getDate() + i);
    var isToday = d.getTime() === today.getTime();
    var isSel = d.toDateString() === calSelected.toDateString();
    var isOther = d.getMonth() !== m;
    var dStr = toDateStr(d);

    var dayRdvs = rdvs.filter(function(r){ return r.date === dStr; });

    var cls = 'cal-cell' + (isToday?' today':'') + (isSel?' selected':'') + (isOther?' other-month':'') + (dayRdvs.length?' has-event':'');
    var evHTML = dayRdvs.slice(0,3).map(function(r){
      return '<div class="cal-event '+r.type+'" onclick="event.stopPropagation();openRdvModal(\''+r.id+'\',null)" title="'+escHtml(r.title)+'">'+escHtml(r.heure?r.heure+' ':'')+escHtml(r.title)+'</div>';
    }).join('');
    if (dayRdvs.length > 3) evHTML += '<div class="cal-more">+' + (dayRdvs.length-3) + '</div>';

    var cell = document.createElement('div');
    cell.className = cls;
    cell.innerHTML = '<div class="cal-day-num">'+d.getDate()+'</div>' + evHTML;
    cell.addEventListener('click', (function(dd){ return function(){ calSelected = new Date(dd); renderCalendar(); renderSideEvents(calSelected); }; })(d));
    grid.appendChild(cell);
  }
}

function renderSideEvents(d) {
  var dStr = toDateStr(d);
  var label = $('side-date-label');
  var today = new Date(); today.setHours(0,0,0,0);
  var isToday = d.getTime() === today.getTime();
  if (label) label.textContent = isToday ? 'Aujourd\'hui — ' + d.getDate() + ' ' + MONTHS[d.getMonth()] : d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();

  var rdvs = loadRdvs().filter(function(r){ return r.date === dStr; });
  rdvs.sort(function(a,b){ return (a.heure||'99:99').localeCompare(b.heure||'99:99'); });

  var el = $('side-events');
  if (!rdvs.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Aucun événement</div>'; return; }

  el.innerHTML = rdvs.map(function(r) {
    var clientName = '';
    var rdvVehLabel = '';
    if (r.clientId) {
      var cl = loadClients().find(function(c){ return c.id === r.clientId; });
      if (cl) {
        clientName = cl.nom;
        var vehs = cl.vehs && cl.vehs.length ? cl.vehs : (cl.vm ? [{vm:cl.vm,vmo:cl.vmo||'',vmot:cl.vmot||'',van:cl.van||'',vim:cl.vim||''}] : []);
        if (r.vehIdx !== null && r.vehIdx !== undefined && vehs[r.vehIdx]) {
          var v = vehs[r.vehIdx];
          rdvVehLabel = [v.vm,v.vmo,v.vmot,v.van?'('+v.van+')':''].filter(Boolean).join(' ');
          if (v.vim) rdvVehLabel += ' · ' + v.vim.toUpperCase();
        }
      }
    }
    return '<div class="rdv-item '+r.type+'">'
      + '<button class="rdv-del" onclick="deleteRdv(\''+r.id+'\')" title="Supprimer">×</button>'
      + (r.heure ? '<div class="rdv-time">'+r.heure+'</div>' : '')
      + '<div class="rdv-title">'+escHtml(r.title)+'</div>'
      + (clientName ? '<div class="rdv-sub">👤 '+escHtml(clientName)+'</div>' : '')
      + (rdvVehLabel ? '<div class="rdv-sub">🚗 '+escHtml(rdvVehLabel)+'</div>' : '')

      + (r.lieu ? '<div class="rdv-sub">📍 '+escHtml(r.lieu)+'</div>' : '')
      + (r.notes ? '<div class="rdv-sub" style="margin-top:4px;font-style:italic">'+escHtml(r.notes.slice(0,80))+(r.notes.length>80?'…':'')+'</div>' : '')
      + '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">'
        + '<button class="btn-s btn-sm" onclick="openRdvModal(\''+r.id+'\',null)">✏️ Modifier</button>'
        + (r.clientId ? '<button class="btn-s btn-sm" onclick="selectClientAndGo('+r.clientId+')">📄 Devis</button>' : '')
        + '<button class="rdv-confirm-btn" onclick="copyConfirmMsg(\''+r.id+'\')">📋 Copier confirmation</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

function renderAutoAlerts() {
  var el = $('auto-alerts');
  if (!el) return;
  var docs = loadDocs();
  var alerts = [];
  var now = new Date(); now.setHours(0,0,0,0);

  // Devis en attente depuis + de 3 jours
  docs.filter(function(d){ return d.type==='devis' && (d.statut==='envoyé'||d.statut==='accepté'); }).forEach(function(d) {
    var dDate = new Date(d.date);
    var days = Math.floor((now - dDate) / 86400000);
    if (days >= 3) {
      alerts.push({ type:'orange', text: 'Devis '+d.num+' — '+d.cn+' en attente depuis '+days+' jour'+(days>1?'s':''), date: d.date });
    }
  });

  // Factures impayées depuis + de 7 jours
  docs.filter(function(d){ return d.type==='facture' && d.statut!=='payé' && d.statut!=='annulé'; }).forEach(function(d) {
    var dDate = new Date(d.date);
    var days = Math.floor((now - dDate) / 86400000);
    if (days >= 7) {
      alerts.push({ type:'red', text: 'Facture '+d.num+' — '+d.cn+' impayée depuis '+days+' jour'+(days>1?'s':''), date: d.date });
    }
  });

  if (!alerts.length) {
    el.innerHTML = '<div style="color:var(--green);font-size:12px">✓ Aucune alerte en cours</div>';
    return;
  }

  alerts.sort(function(a,b){ return a.type.localeCompare(b.type); });
  el.innerHTML = alerts.map(function(a) {
    return '<div class="alert-item">'
      + '<div class="alert-dot '+a.type+'"></div>'
      + '<div class="alert-text">'+escHtml(a.text)+'<div class="alert-date">'+fmtDate(a.date)+'</div></div>'
    + '</div>';
  }).join('');
}

// ── Modal RDV ────────────────────────────────────────────────
function openRdvModal(rdvId) {
  editingRdvId = rdvId;
  fillRdvClientSelect();
  fillRdvDocSelect();

  if (rdvId) {
    var rdv = loadRdvs().find(function(r){ return r.id === rdvId; });
    if (!rdv) return;
    $('rdv-modal-title').textContent = 'Modifier le rendez-vous';
    $('rdv-title').value = rdv.title || '';
    $('rdv-type').value = rdv.type || 'rdv';
    $('rdv-date').value = rdv.date || '';
    $('rdv-heure').value = rdv.heure || '';
    setRappels(rdv.rappels || (rdv.rappel ? [rdv.rappel] : []));
    $('rdv-client').value = rdv.clientId || '';
    updateRdvVehSelect();

    if (rdv.vehIdx !== null && rdv.vehIdx !== undefined && $('rdv-vehicule')) {
      $('rdv-vehicule').value = String(rdv.vehIdx);
    }
    $('rdv-doc').value = rdv.docId || '';
    $('rdv-lieu').value = rdv.lieu || '';
    $('rdv-notes').value = rdv.notes || '';
    $('rdv-delete-btn').style.display = 'inline-flex';
    $('rdv-copy-btn').style.display = 'inline-flex';
  } else {
    $('rdv-modal-title').textContent = 'Nouveau rendez-vous';
    $('rdv-title').value = '';
    $('rdv-type').value = 'rdv';
    $('rdv-date').value = toDateStr(calSelected);
    $('rdv-heure').value = '';
    setRappels([]);
    $('rdv-client').value = '';
    $('rdv-doc').value = '';
    $('rdv-lieu').value = '';
    $('rdv-notes').value = '';
    $('rdv-delete-btn').style.display = 'none';
    $('rdv-copy-btn').style.display = 'none';
  }
  $('rdv-modal').classList.add('open');
  setTimeout(function(){ $('rdv-title').focus(); }, 100);
}

function closeRdvModal() { $('rdv-modal').classList.remove('open'); }

function copyConfirmMsgFromModal() {
  if (editingRdvId) copyConfirmMsg(editingRdvId);
}

function fillRdvClientSelect() {
  var sel = $('rdv-client');
  if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">— Aucun client —</option>'
    + loadClients().map(function(cl) {
        var vLabel = '';
        var vehs = cl.vehs && cl.vehs.length ? cl.vehs : (cl.vm ? [{vm:cl.vm,vmo:cl.vmo||''}] : []);
        if (vehs.length === 1 && vehs[0].vm) vLabel = ' — ' + vehs[0].vm + ' ' + (vehs[0].vmo||'');
        else if (vehs.length > 1) vLabel = ' — ' + vehs.length + ' véhicules';
        return '<option value="'+cl.id+'">' + escHtml(cl.nom) + vLabel + '</option>';
      }).join('');
  if (cur) sel.value = cur;
  updateRdvVehSelect();
}

function updateRdvVehSelect() {
  var clientId = parseInt($('rdv-client').value);
  var row = $('rdv-veh-row');
  var sel = $('rdv-vehicule');
  if (!row || !sel) return;
  if (!clientId) {
    row.style.display = 'none';
    sel.innerHTML = '<option value="">— Tous les véhicules —</option>';
    return;
  }
  var cl = loadClients().find(function(c){ return c.id === clientId; });
  if (!cl) { row.style.display = 'none'; return; }
  var vehs = cl.vehs && cl.vehs.length ? cl.vehs : (cl.vm ? [{vm:cl.vm,vmo:cl.vmo||'',vmot:cl.vmot||'',van:cl.van||'',vim:cl.vim||''}] : []);
  if (vehs.length <= 1) {
    row.style.display = 'none';
    return;
  }
  // Plusieurs véhicules → afficher le select
  row.style.display = 'block';
  sel.innerHTML = '<option value="">— Tous les véhicules —</option>'
    + vehs.map(function(v, i) {
        var label = [v.vm, v.vmo, v.vmot, v.van?'('+v.van+')':''].filter(Boolean).join(' ');
        return '<option value="'+i+'">' + escHtml(label) + (v.vim?' · '+escHtml(v.vim.toUpperCase()):'') + '</option>';
      }).join('');
}

function fillRdvDocSelect() {
  var sel = $('rdv-doc');
  if (!sel) return;
  var cur = sel.value;
  sel.innerHTML = '<option value="">— Aucun document —</option>'
    + loadDocs().slice(0,50).map(function(d){ return '<option value="'+d.id+'">'+escHtml(d.num)+' — '+escHtml(d.cn||'')+'</option>'; }).join('');
  if (cur) sel.value = cur;
}

function saveRdv() {
  var title = $('rdv-title').value.trim();
  if (!title) { alert('Le titre est obligatoire.'); return; }
  var rdvDate = $('rdv-date').value;
  if (!rdvDate) { alert('La date est obligatoire.'); return; }

  var rdvs = loadRdvs();
  var existing = editingRdvId ? rdvs.find(function(r){ return r.id === editingRdvId; }) : null;
  var rappels = getRappels();

  // Préserver rappelsSent existants, mais élaguer aux minutes toujours présentes dans rappels
  var prevSent = (existing && existing.rappelsSent) ? existing.rappelsSent : [];
  var rappelsSent = prevSent.filter(function(m){ return rappels.indexOf(m) >= 0; });

  var heure = $('rdv-heure').value;
  // fireISO : timestamp UTC absolu utilisé par le cron serveur (TZ-safe)
  var fireISO = heure ? new Date(rdvDate+'T'+heure).toISOString() : null;

  var rdv = {
    id:       editingRdvId || String(Date.now()),
    title:    title,
    type:     $('rdv-type').value,
    date:     rdvDate,
    heure:    heure,
    rappels:  rappels,
    rappelsSent: rappelsSent,
    fireISO:  fireISO,
    clientId: $('rdv-client').value ? parseInt($('rdv-client').value) : null,
    vehIdx:   $('rdv-vehicule') && $('rdv-vehicule').value !== '' ? parseInt($('rdv-vehicule').value) : null,
    docId:    $('rdv-doc').value ? parseInt($('rdv-doc').value) : null,

    lieu:     $('rdv-lieu').value,
    notes:    $('rdv-notes').value,
  };

  if (editingRdvId) {
    // Annuler les timers existants pour ce rdv avant de reprogrammer
    cancelRdvTimers(editingRdvId);
    var i = rdvs.findIndex(function(r){ return r.id === editingRdvId; });
    if (i >= 0) rdvs[i] = rdv; else rdvs.push(rdv);
  } else {
    rdvs.push(rdv);
  }
  saveRdvs(rdvs);

  // Programmer le rappel (timers live) + rattrapage immédiat si besoin
  scheduleRdvNotif(rdv);
  runRappelCheck();

  closeRdvModal();
  renderCalendar();
  renderSideEvents(calSelected);
}

function deleteRdv(rdvId) {
  if (!confirm('Supprimer ce rendez-vous ?')) return;
  cancelRdvTimers(rdvId);
  saveRdvs(loadRdvs().filter(function(r){ return r.id !== rdvId; }));
  renderCalendar();
  renderSideEvents(calSelected);
}

function deleteRdvFromModal() {
  if (!editingRdvId) return;
  deleteRdv(editingRdvId);
  closeRdvModal();
}

// ══════════════════════════════════════════════════════════════
//  EMAILJS — Rappels RDV + Envoi devis/factures
// ══════════════════════════════════════════════════════════════
var EJS_SERVICE       = 'service_6dj8dmv';
var EJS_TPL_RAPPEL    = 'template_mlbev47';  // Rappels agenda
var EJS_TPL_DOC       = 'template_l6jwa72';  // Envoi devis/factures
var EJS_FROM_EMAIL    = 'arthur@areprog.fr';
var notifTimer        = null;
var _currentDocForEmail = null; // doc en cours d'affichage dans le modal

// État rappels RDV (timers live + boucle de rattrapage)
var _rdvTimers          = {};   // { rdvId: [timeoutId, ...] }
var _rappelLoopInterval = null; // setInterval id pour runRappelCheck
var _rappelInFlight     = {};   // "rdvId|minutes" → true (dédup intra-onglet)
var STALE_RAPPEL_MS     = 7 * 24 * 3600000; // rappels ratés depuis > 7j : on marque sans envoyer
var RAPPEL_LOOP_MS      = 60000; // boucle de rattrapage toutes les 60s

// Init EmailJS — robuste, attend que le SDK soit chargé
var _ejsReady = false;
function initEmailJS() {
  if (_ejsReady) return; // déjà initialisé
  if (typeof emailjs === 'undefined') return; // SDK pas encore chargé
  try {
    emailjs.init({ publicKey: '3xdOxKiXtMqhlc7ei' });
    _ejsReady = true;
    console.log('EmailJS initialisé ✓');
  } catch(e) {
    console.warn('EmailJS init erreur:', e);
  }
}
// Tenter à l'exécution du script
initEmailJS();
// Tenter après chargement complet de la page (scripts externes inclus)
window.addEventListener('load', function() {
  initEmailJS();
  // Si toujours pas prêt, réessayer toutes les 500ms jusqu'à 5s
  if (!_ejsReady) {
    var attempts = 0;
    var retryInterval = setInterval(function() {
      initEmailJS();
      attempts++;
      if (_ejsReady || attempts >= 10) clearInterval(retryInterval);
    }, 500);
  }
});

// ── Rappels multiples UI ──────────────────────────────────────
var RAPPEL_OPTIONS = [
  { v:'15',    l:'15 min avant' },
  { v:'30',    l:'30 min avant' },
  { v:'60',    l:'1 heure avant' },
  { v:'120',   l:'2 heures avant' },
  { v:'360',   l:'6 heures avant' },
  { v:'1440',  l:'La veille (24h)' },
  { v:'2880',  l:'2 jours avant' },
  { v:'4320',  l:'3 jours avant' },
  { v:'10080', l:'1 semaine avant' },
];

function addRappelRow(val) {
  var list = $('rdv-rappels-list');
  if (!list) return;
  var opts = RAPPEL_OPTIONS.map(function(o) {
    return '<option value="'+o.v+'"'+(o.v===(val||'1440')?' selected':'')+'>'+o.l+'</option>';
  }).join('');
  var div = document.createElement('div');
  div.className = 'rappel-row';
  div.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px';
  div.innerHTML = '<select style="flex:1;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:13px">'+opts+'</select>'
    + '<button type="button" onclick="this.parentElement.remove()" style="width:30px;height:32px;background:transparent;border:1px solid var(--border);border-radius:6px;color:var(--text-dim);cursor:pointer;font-size:16px">×</button>';
  list.appendChild(div);
}

function getRappels() {
  var vals = [];
  document.querySelectorAll('#rdv-rappels-list .rappel-row select').forEach(function(sel) {
    var v = parseInt(sel.value);
    if (v > 0 && vals.indexOf(v) < 0) vals.push(v);
  });
  return vals;
}

function setRappels(arr) {
  var list = $('rdv-rappels-list');
  if (!list) return;
  list.innerHTML = '';
  if (!arr || !arr.length) { addRappelRow('1440'); return; }
  arr.forEach(function(v) { addRappelRow(String(v)); });
}

// ── Envoi email rappel RDV ────────────────────────────────────
function sendReminderEmail(rdv, minutes) {
  if (!_ejsReady) initEmailJS();
  if (!_ejsReady || typeof emailjs === 'undefined') {
    showNotifBanner('⚠️', 'EmailJS non prêt', 'Rappel "'+(rdv.title||'')+'" sera retenté.');
    return Promise.reject(new Error('EmailJS non initialisé'));
  }
  var key = rdv.id + '|' + minutes;
  if (_rappelInFlight[key]) return Promise.resolve();
  _rappelInFlight[key] = true;

  var cl = rdv.clientId ? loadClients().find(function(c){ return c.id===rdv.clientId; }) : null;
  var vehs = cl && cl.vehs && cl.vehs.length ? cl.vehs : (cl&&cl.vm?[{vm:cl.vm,vmo:cl.vmo||'',vmot:cl.vmot||'',van:cl.van||''}]:[]);
  var selV = (rdv.vehIdx!=null && vehs[rdv.vehIdx]) ? vehs[rdv.vehIdx] : vehs[0];
  var vehLabel = selV ? [selV.vm,selV.vmo,selV.vmot,selV.van?'('+selV.van+')':''].filter(Boolean).join(' ') : '';
  var opt = RAPPEL_OPTIONS.find(function(o){ return parseInt(o.v)===minutes; });

  return emailjs.send(EJS_SERVICE, EJS_TPL_RAPPEL, {
    to_email:    EJS_FROM_EMAIL,
    rdv_title:   rdv.title||'',
    rdv_date:    rdv.date ? fmtDate(rdv.date) : '',
    rdv_heure:   rdv.heure||'Non précisée',
    rdv_lieu:    rdv.lieu||'Non précisé',
    rdv_client:  cl ? cl.nom : 'Non précisé',
    rdv_vehicule: vehLabel||'Non précisé',
    rdv_notes:   rdv.notes||'',
    rappel_label: opt ? opt.l : minutes+' min avant',
  }).then(function(){
    markRappelSent(rdv.id, minutes);
    showNotifBanner('📧', 'Rappel envoyé', rdv.title||'');
    delete _rappelInFlight[key];
  }).catch(function(e){
    console.error('EmailJS rappel:', e);
    var msg = (e && (e.text || e.message)) || 'Erreur inconnue';
    showNotifBanner('⚠️', 'Erreur EmailJS rappel', msg);
    delete _rappelInFlight[key];
    throw e;
  });
}

// Marque un rappel comme envoyé dans la liste des rdvs (persisté Firebase + localStorage)
function markRappelSent(rdvId, minutes) {
  var rdvs = loadRdvs();
  var i = rdvs.findIndex(function(r){ return r.id === rdvId; });
  if (i < 0) return;
  rdvs[i].rappelsSent = rdvs[i].rappelsSent || [];
  if (rdvs[i].rappelsSent.indexOf(minutes) < 0) {
    rdvs[i].rappelsSent.push(minutes);
    saveRdvs(rdvs);
  }
}

function cancelRdvTimers(rdvId) {
  var ids = _rdvTimers[rdvId];
  if (!ids) return;
  ids.forEach(function(id){ clearTimeout(id); });
  delete _rdvTimers[rdvId];
}

function cancelAllRdvTimers() {
  Object.keys(_rdvTimers).forEach(cancelRdvTimers);
}

function scheduleRdvNotif(rdv) {
  cancelRdvTimers(rdv.id);
  var rappels = rdv.rappels && rdv.rappels.length ? rdv.rappels
    : (rdv.rappel && rdv.rappel>0 ? [rdv.rappel] : []);
  if (!rdv.heure || !rappels.length) return;
  var sent = rdv.rappelsSent || [];
  var rdvDT = new Date(rdv.date+'T'+rdv.heure);
  rappels.forEach(function(minutes) {
    if (sent.indexOf(minutes) >= 0) return;
    var delay = rdvDT.getTime() - minutes*60000 - Date.now();
    // delay < 0 → la boucle runRappelCheck s'en charge ; > 30j → trop loin
    if (delay < 0 || delay > 30*24*3600000) return;
    var tid = setTimeout(function() {
      sendReminderEmail(rdv, minutes);
    }, delay);
    (_rdvTimers[rdv.id] = _rdvTimers[rdv.id] || []).push(tid);
  });
}

// Boucle de rattrapage : envoie tous les rappels dont l'heure est passée et non encore marqués sent
function runRappelCheck() {
  updateRappelIndicator();
  if (!_ejsReady) initEmailJS();
  if (!_ejsReady || typeof emailjs === 'undefined') return;
  var now = Date.now();
  var rdvs = loadRdvs();
  var dirty = false;
  rdvs.forEach(function(rdv) {
    var rappels = rdv.rappels && rdv.rappels.length ? rdv.rappels
      : (rdv.rappel && rdv.rappel>0 ? [rdv.rappel] : []);
    if (!rdv.heure || !rappels.length) return;
    var fireBase = new Date(rdv.date+'T'+rdv.heure).getTime();
    if (isNaN(fireBase)) return;
    rdv.rappelsSent = rdv.rappelsSent || [];
    rappels.forEach(function(m) {
      if (rdv.rappelsSent.indexOf(m) >= 0) return;
      var fire = fireBase - m*60000;
      if (fire > now) return; // futur — géré par scheduleRdvNotif
      if (now - fire > STALE_RAPPEL_MS) {
        // trop vieux : on marque sans envoyer pour éviter un flood
        rdv.rappelsSent.push(m);
        dirty = true;
        return;
      }
      sendReminderEmail(rdv, m);
    });
  });
  if (dirty) saveRdvs(rdvs);
}

function updateRappelIndicator() {
  var el = document.getElementById('rappel-heartbeat');
  if (!el) return;
  var d = new Date();
  var hh = String(d.getHours()).padStart(2,'0');
  var mm = String(d.getMinutes()).padStart(2,'0');
  el.textContent = '⏱ Rappels : ' + hh + ':' + mm;
}

function maybeShowInstallHint() {} // supprimé

function checkTodayNotifs() {
  // 1. Rattrapage immédiat des rappels ratés (navigateur fermé, etc.)
  runRappelCheck();
  // 2. Timers live pour les rappels à venir dans cette session
  loadRdvs().forEach(function(r){ scheduleRdvNotif(r); });
  // 3. Démarrer la boucle de rattrapage périodique
  if (!_rappelLoopInterval) {
    _rappelLoopInterval = setInterval(runRappelCheck, RAPPEL_LOOP_MS);
  }

  // Alertes factures impayées — dédup journalier (évite un envoi à chaque reload)
  if (typeof emailjs === 'undefined') return;
  var todayKey = new Date().toISOString().slice(0,10);
  if (localStorage.getItem('ar_last_facture_alert_day') === todayKey) return;
  var now = new Date(); now.setHours(0,0,0,0);
  var sent = false;
  loadDocs().filter(function(d){ return d.type==='facture'&&d.statut!=='payé'&&d.statut!=='annulé'; }).forEach(function(d) {
    var days = Math.floor((now - new Date(d.date))/86400000);
    if (days===7||days===14||days===30) {
      sent = true;
      setTimeout(function(){
        emailjs.send(EJS_SERVICE, EJS_TPL_RAPPEL, {
          to_email: EJS_FROM_EMAIL,
          rdv_title: 'Facture impayée — '+(d.cn||''),
          rdv_date: fmtDate(d.date),
          rdv_heure: 'Depuis '+days+' jours',
          rdv_lieu: '', rdv_client: d.cn||'',
          rdv_vehicule: [d.vm,d.vmo].filter(Boolean).join(' '),
          rdv_notes: 'Montant : '+fmt(d.ttc||0)+' · Ref : '+(d.num||''),
          rappel_label: 'Alerte automatique',
        }).catch(function(){});
      }, 5000);
    }
  });
  if (sent) localStorage.setItem('ar_last_facture_alert_day', todayKey);
}
