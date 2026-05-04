// ============================================================
// 03-render.js — Render PDF doc, dashboard, liste, carnet UI, OLSX gains, catalog editor
// (Refonte modulaire de gestion.html, source AREPROG)
// ============================================================

// ── Filtrage par période (calendaire ou glissante) ──────────
// raw = chaîne du select : "month"/"quarter"/"year" (calendaire civil)
//                          "prev_month"/"prev_quarter"/"prev_year" (période civile précédente)
//                          "7"/"30"/"90"/"365" (jours glissants)
function filterByPeriod(docs, raw) {
  if (!raw) return docs;
  var now = new Date();
  var start, end;
  if (raw === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (raw === 'prev_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (raw === 'quarter') {
    var q = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), q * 3, 1);
    end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
  } else if (raw === 'prev_quarter') {
    var pq = Math.floor(now.getMonth() / 3) - 1;
    var py = now.getFullYear();
    if (pq < 0) { pq = 3; py -= 1; }
    start = new Date(py, pq * 3, 1);
    end = new Date(py, pq * 3 + 3, 0, 23, 59, 59, 999);
  } else if (raw === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (raw === 'prev_year') {
    start = new Date(now.getFullYear() - 1, 0, 1);
    end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else {
    var days = parseInt(raw) || 0;
    if (!days) return docs;
    start = new Date(Date.now() - days * 86400000);
    end = new Date();
  }
  return docs.filter(function(d) {
    if (!d.date) return false;
    var t = new Date(d.date).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });
}

// Libellé humain d'une période (pour affichage)
function periodLabel(raw) {
  var now = new Date();
  var months = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  if (raw === 'month') return months[now.getMonth()] + ' ' + now.getFullYear();
  if (raw === 'prev_month') {
    var d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return months[d.getMonth()] + ' ' + d.getFullYear();
  }
  if (raw === 'quarter') return 'T' + (Math.floor(now.getMonth()/3)+1) + ' ' + now.getFullYear();
  if (raw === 'prev_quarter') {
    var pq = Math.floor(now.getMonth()/3) - 1, py = now.getFullYear();
    if (pq < 0) { pq = 3; py -= 1; }
    return 'T' + (pq+1) + ' ' + py;
  }
  if (raw === 'year') return 'Année ' + now.getFullYear();
  if (raw === 'prev_year') return 'Année ' + (now.getFullYear()-1);
  var days = parseInt(raw) || 0;
  if (days) return days + ' derniers jours';
  return 'Toute période';
}

// ============================================================
//  APERÇU / PRINT
// ============================================================
function renderDocHTML(doc, tplOverride) {
  var tpl = tplOverride || loadTemplate();
  var accentColor = sanitizeCssColor(tpl.color || '#1E90FF');
  var ht = doc.ht || doc.lines.reduce(function(s,l){return s+l.qte*l.pu;},0);
  var tvaRate = (doc.tvaRate || 0) / 100;
  var tva = ht * tvaRate;
  var ttc = ht + tva;
  var isDevis = doc.type === 'devis';
  var gains = getGains(doc.lines);
  var vehStr = [escHtml(doc.vm||''), escHtml(doc.vmo||''), escHtml(doc.vmot||''), doc.van ? '(' + escHtml(doc.van) + ')' : ''].filter(Boolean).join(' ');

  var acompteNotice = (doc.acompte && doc.acompte.recu)
    ? '<div class="d-notice" style="background:rgba(168,85,247,.12);border-left:3px solid #a855f7;color:#a855f7">'
      + '💶 Acompte reçu : <strong>' + (doc.acompte.montant||0).toFixed(2) + ' €</strong>'
      + ' via ' + escHtml(doc.acompte.mode||'') + ' le ' + fmtDate(doc.acompte.date)
      + ' — Solde restant : <strong>' + (doc.acompte.solde||0).toFixed(2) + ' €</strong></div>'
    : '';
  var noticeHTML = doc.statut === 'payé'
    ? '<div class="d-notice paye">✓ FACTURE RÉGLÉE — Paiement reçu</div>'
    : (isDevis
      ? '<div class="d-notice devis">⏳ Ce devis est valable ' + (tpl.validite||30) + ' jours à compter du ' + fmtDate(doc.date) + (doc.acompte && doc.acompte.recu ? '' : ' — Paiement après intervention.') + '</div>'
      : '<div class="d-notice facture">📄 Facture émise le ' + fmtDate(doc.date) + ' — Règlement à réception.</div>')
    + acompteNotice;

  var linesHTML = doc.lines.map(function(l) {
    var puStr = l.offert ? '<span style="color:#22c55e;font-weight:700">Offert</span>' : (l.pu||0).toFixed(2) + ' €';
    var totStr = l.offert ? '<span style="color:#22c55e;font-weight:700">Offert</span>' : '<strong>' + ((l.qte||1)*(l.pu||0)).toFixed(2) + ' €</strong>';
    var descRow = l.desc ? '<tr><td colspan="4" style="padding-top:2px;padding-bottom:8px;font-size:12px;color:#888;font-style:italic">' + escHtml(l.desc) + '</td></tr>' : '';
    return '<tr><td>' + escHtml(l.label || '—') + '</td><td>' + l.qte + '</td><td>' + puStr + '</td><td>' + totStr + '</td></tr>' + descRow;
  }).join('');

  var gainsHTML = '';
  // Priorité 1 : gains personnalisés du document
  // Priorité 2 : gains OLSX numériques
  // Priorité 3 : gains du catalogue par prestation
  var customGainsArr = doc.customGains && doc.customGains.length ? doc.customGains : null;
  if (customGainsArr && tpl.showGains !== false) {
    gainsHTML = '<div class="d-gains"><div class="d-gains-title">✦ Bénéfices de votre prestation</div><div class="d-gains-grid">'
      + customGainsArr.map(function(g){return '<div class="d-gain">'+escHtml(g)+'</div>';}).join('')
      + '</div></div>';
  } else if (doc.gains && (doc.gains.chOrig || doc.gains.ch || doc.gains.nm || doc.gains.conso)) {
    var g = doc.gains;
    var items = [];
    if (g.chOrig && g.ch) items.push({lbl:'Puissance', val:'+'+(g.ch-g.chOrig)+' ch', sub:g.chOrig+' → '+g.ch+' ch'});
    if (g.nmOrig && g.nm) items.push({lbl:'Couple', val:'+'+(g.nm-g.nmOrig)+' Nm', sub:g.nmOrig+' → '+g.nm+' Nm'});
    if (g.conso) items.push({lbl:'Consommation', val:g.conso, sub:'estimation'});
    if (items.length) {
      gainsHTML = '<div class="d-gains-olsx"><div class="d-gains-olsx-title">✦ Gains estimés pour ce véhicule</div><div class="d-gains-olsx-grid">'
        + items.map(function(it){ return '<div class="d-gains-olsx-item"><div class="d-gains-olsx-val">'+it.val+'</div><div class="d-gains-olsx-lbl">'+it.lbl+'</div></div>'; }).join('')
        + '</div></div>';
    }
  } else if (gains.length && tpl.showGains !== false) {
    gainsHTML = '<div class="d-gains"><div class="d-gains-title">✦ Bénéfices de votre prestation</div><div class="d-gains-grid">'
      + gains.map(function(g){return '<div class="d-gain">'+g+'</div>';}).join('')
      + '</div></div>';
  }
  if (customGainsArr && !tpl.showGains) gainsHTML = '';

  return '<div class="d-header" style="border-bottom:2px solid ' + accentColor + '22">'
    + '<div><div class="d-brand">' + buildLogoHTML(tpl) + '</div>'
    + '<div class="d-brand-info">' + escHtml(tpl.activite||'')
    + (tpl.zones ? '<br>' + escHtml(tpl.zones) : '')
    + (tpl.tel ? '<br>' + escHtml(tpl.tel) : '')
    + (tpl.email ? ' &nbsp;·&nbsp; ' + escHtml(tpl.email) : '')
    + (tpl.web ? ' &nbsp;·&nbsp; ' + escHtml(tpl.web) : '')
    + '</div></div>'
    + '<div class="d-right">'
    + '<div class="d-type">' + (isDevis ? 'DEVIS' : 'FACTURE') + '</div>'
    + '<div class="d-num">' + (doc.num || '—') + '</div>'
    + '<div class="d-date">Émis le ' + fmtDate(doc.date) + '</div>'
    + (doc.ech ? '<div class="d-date">' + (isDevis ? 'Valable jusqu\'au' : 'Échéance') + ' ' + fmtDate(doc.ech) + '</div>' : '')
    + '</div></div>'
    + '<div class="d-parties">'
    + '<div class="d-party"><div class="d-party-label">Prestataire</div><div class="d-party-name">' + escHtml(tpl.nom||'AREPROG') + '</div>'
    + '<div class="d-party-info">' + escHtml(tpl.activite||'')
    + (tpl.zones ? '<br>' + escHtml(tpl.zones) : '')
    + (tpl.adresse ? '<br>' + escHtml(tpl.adresse) : '')
    + (tpl.tel ? '<br>' + escHtml(tpl.tel) : '')
    + (tpl.email ? '<br>' + escHtml(tpl.email) : '')
    + (tpl.web ? '<br>' + escHtml(tpl.web) : '')
    + (tpl.legal ? '<br><small style="color:#aaa">' + escHtml(tpl.legal) + '</small>' : '')
    + '</div></div>'
    + '<div class="d-party"><div class="d-party-label">Client</div><div class="d-party-name">' + escHtml(doc.cn || '—') + '</div>'
    + '<div class="d-party-info">'
    + (doc.ca ? escHtml(doc.ca) + '<br>' : '') + escHtml(doc.cv || '')
    + (doc.ct ? '<br>' + escHtml(doc.ct) : '')
    + (doc.ce ? '<br>' + escHtml(doc.ce) : '')
    + (vehStr ? '<br><br><strong>Véhicule :</strong> ' + vehStr : '')
    + (doc.vim ? '<br>Immatriculation : <strong>' + escHtml(doc.vim.toUpperCase()) + '</strong>' : '')
    + (doc.vkm ? '<br>Kilométrage : <strong>' + escHtml(doc.vkm) + '</strong>' : '')
    + '</div></div></div>'
    + noticeHTML
    + '<table class="d-table"><thead><tr>'
    + '<th style="width:52%">Désignation</th>'
    + '<th style="width:8%;text-align:right">Qté</th>'
    + '<th style="width:18%;text-align:right">PU HT</th>'
    + '<th style="width:22%;text-align:right">' + (tpl.colTotal||'Total HT') + '</th>'
    + '</tr></thead><tbody>' + linesHTML + '</tbody></table>'
    + '<div class="d-totaux"><div class="d-totaux-box">'
    + '<div class="d-tot-row"><span>Total HT</span><span>' + ht.toFixed(2) + ' €</span></div>'
    + '<div class="d-tot-row"><span>TVA (' + (doc.tvaRate || 0) + ' %)</span><span>' + tva.toFixed(2) + ' €</span></div>'
    + '<div class="d-tot-row big" style="color:' + accentColor + '"><span>TOTAL TTC</span><span>' + ttc.toFixed(2) + ' €</span></div>'
    + '</div></div>'
    + gainsHTML
    + (doc.notes ? '<div class="d-notes"><strong>Conditions & mentions</strong><p>' + escHtml(doc.notes).replace(/\n/g,'<br>') + '</p></div>' : '')
    + (tpl.showFooter !== false ? '<div class="d-footer">' + escHtml(tpl.footer||'').replace(/\n/g,'<br>') + '</div>' : '');
}

// Construit le nom de fichier PDF : AREPROG_TYPE_NUMERO_CLIENT
function buildPdfTitle(doc) {
  var type = (doc.type === 'devis' ? 'Devis' : 'Facture');
  var num  = (doc.num || '').replace(/[^a-zA-Z0-9_-]/g, '-');
  var nom  = (doc.cn || 'Client').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-');
  return 'AREPROG_' + type + '_' + num + '_' + nom;
}

// Injecte le title dans la page (utilisé comme nom de fichier par le navigateur)
var _originalTitle = document.title;
function setPrintTitle(doc) {
  document.title = buildPdfTitle(doc);
}
function restoreTitle() {
  document.title = _originalTitle;
}

function openPreview() {
  var doc = buildObj();
  _currentDocForEmail = doc;
  $('preview').innerHTML = renderDocHTML(doc);
  $('modal').classList.add('open');
  $('modal').dataset.printTitle = buildPdfTitle(doc);
}
function previewDoc(docId) {
  var doc = loadDocs().find(function(d){ return d.id === docId; });
  if (!doc) return;
  _currentDocForEmail = doc;
  $('preview').innerHTML = renderDocHTML(doc);
  $('modal').classList.add('open');
  $('modal').dataset.printTitle = buildPdfTitle(doc);
}
function closeModal() {
  $('modal').classList.remove('open');
  restoreTitle();
}
function printFromModal() {
  var title = $('modal').dataset.printTitle || _originalTitle;
  document.title = title;
  window.print();
  // Restaurer après impression (délai pour laisser le dialog s'ouvrir)
  setTimeout(restoreTitle, 2000);
}
function printDoc() {
  var doc = buildObj();
  _currentDocForEmail = doc;
  $('preview').innerHTML = renderDocHTML(doc);
  $('modal').classList.add('open');
  $('modal').dataset.printTitle = buildPdfTitle(doc);
  setTimeout(function(){
    document.title = buildPdfTitle(doc);
    window.print();
    setTimeout(restoreTitle, 2000);
  }, 250);
}

// ============================================================
//  DASHBOARD
// ============================================================
function renderDash() {
  var docs = loadDocs();
  var devis = docs.filter(function(d){ return d.type === 'devis'; }).length;
  var factures = docs.filter(function(d){ return d.type === 'facture'; }).length;
  var caEnc = docs.filter(function(d){ return d.type === 'facture' && d.statut === 'payé'; }).reduce(function(s,d){ return s+(d.ttc||0); }, 0);
  var caAtt = docs.filter(function(d){ return d.type === 'facture' && d.statut !== 'payé' && d.statut !== 'annulé'; }).reduce(function(s,d){ return s+(d.ttc||0); }, 0);

  $('stats').innerHTML =
    '<div class="sc"><div class="sc-label">Devis créés</div><div class="sc-val blue">'+devis+'</div><div class="sc-sub">Total</div></div>' +
    '<div class="sc"><div class="sc-label">Factures</div><div class="sc-val">'+factures+'</div><div class="sc-sub">Émises</div></div>' +
    '<div class="sc"><div class="sc-label">CA encaissé</div><div class="sc-val green">'+fmt(caEnc)+'</div><div class="sc-sub">Factures payées</div></div>' +
    '<div class="sc"><div class="sc-label">En attente</div><div class="sc-val orange">'+fmt(caAtt)+'</div><div class="sc-sub">À encaisser</div></div>';

  var filterStatut = $('dash-filter-statut') ? $('dash-filter-statut').value : '';
  var filtered = filterStatut ? docs.filter(function(d){ return d.statut === filterStatut; }) : docs;
  var recent = filtered.slice(0, 15);
  $('dash-list').innerHTML = recent.length ? buildTable(recent, false)
    : '<div class="empty"><div class="empty-icon">📄</div><div>Aucun document trouvé.</div></div>';
}

// ============================================================
//  LISTE
// ============================================================
function renderListe() {
  var all = loadDocs();
  var flt        = $('flt') ? $('flt').value : '';
  var fltStatut  = $('flt-statut') ? $('flt-statut').value : '';
  var fltPeriodRaw = $('flt-period') ? $('flt-period').value : '';
  var docs = all;
  if (flt) docs = docs.filter(function(d){ return d.type === flt; });
  if (fltStatut) {
    if (fltStatut === 'impayé') {
      docs = docs.filter(function(d){ return d.type==='facture' && d.statut!=='payé' && d.statut!=='annulé'; });
    } else {
      docs = docs.filter(function(d){ return d.statut === fltStatut; });
    }
  }
  if (fltPeriodRaw) {
    docs = filterByPeriod(docs, fltPeriodRaw);
  }
  updateListeFilterCounts();
  var countInfo = docs.length !== all.length
    ? '<div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">'+docs.length+' document'+(docs.length>1?'s':'')+' sur '+all.length+'</div>'
    : '';
  $('liste-body').innerHTML = countInfo + (docs.length ? buildTable(docs, true)
    : '<div class="empty"><div class="empty-icon">📂</div><div>Aucun document trouvé pour ce filtre.</div></div>');
}

function buildTable(docs, withDelete) {
  var rows = docs.map(function(d) {
    var typeBadge = d.type === 'devis' ? '<span class="badge b-devis">Devis</span>' : '<span class="badge b-facture">Facture</span>';
    var statBadge = d.statut === 'payé' ? '<span class="badge b-paye">Payé ✓</span>'
      : d.statut === 'annulé' ? '<span class="badge b-annule">Annulé</span>'
      : '<span style="color:var(--text-dim);font-size:12px">'+d.statut+'</span>';
    var veh = [d.vm, d.vmo].filter(Boolean).join(' ');
    var declBadge = d.declare === false
      ? '<span class="badge-non-decl" style="font-size:10px">⚠ Non déclaré</span>'
      : '<span class="badge-decl" style="font-size:10px">✓ Déclaré</span>';
    var acompteBadge = (d.acompte && d.acompte.recu)
      ? '<br><span class="badge b-acompte" style="margin-top:3px">💶 ' + fmt(d.acompte.montant) + ' versé</span>'
      : '';
    var delBtn = withDelete ? '<button class="btn-d btn-sm" onclick="deleteDoc('+d.id+')">🗑</button>' : '';
    return '<tr>'
      + '<td><span class="doc-num">'+(d.num||'—')+'</span></td>'
      + '<td>'+typeBadge+'</td>'
      + '<td>'+fmtDate(d.date)+'</td>'
      + '<td><strong>'+(d.cn||'—')+'</strong>'+(veh?'<br><span style="color:var(--text-dim);font-size:11px">'+veh+(d.van?' ('+d.van+')':'')+'</span>':'')+'</td>'
      + '<td style="font-family:var(--fm);color:var(--blue)">'+fmt(d.ttc||0)+'</td>'
      + '<td>'+statBadge+acompteBadge+'</td>'
      + '<td><div class="act-cell">'
        + '<button class="btn-s btn-sm" onclick="previewDoc('+d.id+')">👁 Aperçu</button>'
        + '<button class="btn-s btn-sm" onclick="loadDoc('+d.id+')">✏️ Modifier</button>'
        + delBtn
      + '</div></td>'
      + '</tr>';
  }).join('');
  return '<table class="dt"><thead><tr><th>N°</th><th>Type</th><th>Date</th><th>Client / Véhicule</th><th>Montant TTC</th><th>Statut</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
}

// ============================================================
//  CARNET CLIENTS
// ============================================================
// loadClients/saveClients définis dans le bloc Firebase ci-dessus

var editClientId = null;

function renderCarnet() {
  var q = ($('carnet-search') ? $('carnet-search').value : '').toLowerCase();
  var clients = loadClients().filter(function(cl) {
    return !q || (cl.nom+cl.vm+cl.vmo+cl.vim+cl.tel).toLowerCase().includes(q);
  });
  var grid = $('carnet-grid');
  if (!grid) return;
  grid.innerHTML = clients.length ? clients.map(function(cl) {
    return clientCard(cl, false);
  }).join('') : '<div class="carnet-empty">Aucun client enregistré.</div>';
}

function renderCarnetModal() {
  var q = ($('carnet-modal-search') ? $('carnet-modal-search').value : '').toLowerCase();
  var clients = loadClients().filter(function(cl) {
    return !q || (cl.nom+cl.vm+cl.vmo+cl.vim+cl.tel).toLowerCase().includes(q);
  });
  var grid = $('carnet-modal-grid');
  if (!grid) return;
  grid.innerHTML = clients.length ? clients.map(function(cl) {
    return clientCard(cl, true);
  }).join('') : '<div class="carnet-empty">Aucun client.</div>';
}

function clientCard(cl, selectable) {
  var onclick = selectable ? 'onclick="selectClient(' + cl.id + ')"' : '';
  // Construire la liste de tous les véhicules
  var vehs = cl.vehs && cl.vehs.length
    ? cl.vehs
    : (cl.vm ? [{ vm:cl.vm, vmo:cl.vmo||'', vmot:cl.vmot||'', van:cl.van||'', vim:cl.vim||'' }] : []);
  var vehsHTML = vehs.map(function(v) {
    var label = [v.vm, v.vmo, v.vmot, v.van ? '(' + v.van + ')' : ''].filter(Boolean).join(' ');
    var immat = v.vim ? ' <span style="font-family:var(--fm);font-size:10px;color:var(--text-muted)">' + escHtml(v.vim.toUpperCase()) + '</span>' : '';
    return label ? '<div class="carnet-card-veh">🚗 ' + escHtml(label) + immat + '</div>' : '';
  }).filter(Boolean).join('');
  return '<div class="carnet-card" ' + onclick + '>'
    + '<button class="carnet-card-del" onclick="event.stopPropagation();deleteClient(' + cl.id + ')" title="Supprimer">×</button>'
    + '<div class="carnet-card-name">' + escHtml(cl.nom || '—') + '</div>'
    + vehsHTML
    + (cl.tel ? '<div class="carnet-card-tel">📞 ' + escHtml(cl.tel) + '</div>' : '')
    + (!selectable ? '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn-s btn-sm" onclick="editClient(' + cl.id + ')">✏️ Modifier</button><button class="btn-s btn-sm" onclick="showClientHistory(' + cl.id + ')">📋 Historique</button><button class="btn-p btn-sm" onclick="selectClientAndGo(' + cl.id + ')">→ Devis</button></div>' : '')
    + '</div>';
}

function openCarnetModal() {
  $('carnet-modal-search').value = '';
  renderCarnetModal();
  $('carnet-modal').classList.add('open');
}
function closeCarnetModal() { $('carnet-modal').classList.remove('open'); }

function openAddClientModal(fromCarnet) {
  editClientId = null;
  $('add-client-title').textContent = 'Nouveau client';
  ['ac-nom','ac-tel','ac-email','ac-adr','ac-ville'].forEach(function(i){ $(i).value=''; });
  var vl = $('ac-veh-list'); if(vl) vl.innerHTML = '';
  addVehicleRow();
  closeCarnetModal();
  $('add-client-modal').classList.add('open');
}
function closeAddClientModal() { $('add-client-modal').classList.remove('open'); }

// FIX bug : ferme le carnet-modal d'abord pour éviter empilement de modaux
function editClient(cid) {
  var cl = loadClients().find(function(c){ return c.id === cid; });
  if (!cl) return;
  editClientId = cid;
  closeCarnetModal();
  $('add-client-title').textContent = 'Modifier le client';
  $('ac-nom').value = cl.nom || '';
  $('ac-tel').value = cl.tel || '';
  $('ac-email').value = cl.email || '';
  $('ac-adr').value = cl.adr || '';
  $('ac-ville').value = cl.ville || '';
  // Charger les véhicules multiples
  var vehList = $('ac-veh-list');
  if (vehList) {
    vehList.innerHTML = '';
    var clVehs = cl.vehs && cl.vehs.length ? cl.vehs : (cl.vm ? [{vm:cl.vm,vmo:cl.vmo||'',vmot:cl.vmot||'',van:cl.van||'',vim:cl.vim||''}] : []);
    if (clVehs.length === 0) clVehs = [{}]; // au moins une ligne vide
    clVehs.forEach(function(v){ addVehicleRow(v); });
  }
  $('add-client-modal').classList.add('open');
}

function saveClient() {
  var nom = $('ac-nom').value.trim();
  if (!nom) { alert('Le nom est obligatoire.'); return; }
  var clients = loadClients();
  // Collecter les véhicules depuis les lignes dynamiques
  var vehs = [];
  document.querySelectorAll('#ac-veh-list .veh-row').forEach(function(row) {
    var vm   = row.querySelector('.vr-vm').value.trim();
    var vmo  = row.querySelector('.vr-vmo').value.trim();
    var vmot = row.querySelector('.vr-vmot').value.trim();
    var van  = row.querySelector('.vr-van').value.trim();
    var vim  = row.querySelector('.vr-vim').value.trim();
    if (vm || vmo || vim) vehs.push({ vm:vm, vmo:vmo, vmot:vmot, van:van, vim:vim });
  });
  // Compatibilité rétro : conserver vm/vmo/etc sur le premier véhicule
  var firstVeh = vehs[0] || {};
  var cl = {
    id: editClientId || Date.now(),
    nom: nom, tel: $('ac-tel').value, email: $('ac-email').value,
    adr: $('ac-adr').value, ville: $('ac-ville').value,
    vm: firstVeh.vm||'', vmo: firstVeh.vmo||'', vmot: firstVeh.vmot||'',
    van: firstVeh.van||'', vim: firstVeh.vim||'',
    vehs: vehs,
  };
  if (editClientId) {
    var i = clients.findIndex(function(c){ return c.id === editClientId; });
    if (i >= 0) clients[i] = cl; else clients.unshift(cl);
  } else {
    clients.unshift(cl);
  }
  saveClients(clients);
  closeAddClientModal();
  renderCarnet();
}

function deleteClient(cid) {
  if (!confirm('Supprimer ce client ?')) return;
  saveClients(loadClients().filter(function(c){ return c.id !== cid; }));
  deleteClientFirebase(cid);
  renderCarnet();
  renderCarnetModal();
}

function selectClient(cid) {
  var cl = loadClients().find(function(c){ return c.id === cid; });
  if (!cl) return;
  $('f-cnom').value  = cl.nom   || '';
  $('f-ctel').value  = cl.tel   || '';
  $('f-cemail').value = cl.email || '';
  $('f-cadr').value  = cl.adr   || '';
  $('f-cville').value = cl.ville || '';
  closeCarnetModal();
  // Si plusieurs véhicules → afficher le sélecteur
  var vehs = cl.vehs && cl.vehs.length ? cl.vehs
    : (cl.vm ? [{vm:cl.vm,vmo:cl.vmo||'',vmot:cl.vmot||'',van:cl.van||'',vim:cl.vim||''}] : []);
  if (vehs.length > 1) {
    openVehSelect(cid);
  } else if (vehs.length === 1) {
    applyVehicle(vehs[0]);
  }
}

function selectClientAndGo(cid) {
  selectClient(cid);
  showTab('form');
}

// FIX bug : sauvegarde aussi le tableau vehs[] (pas juste les champs legacy vm/vmo/...)
// Préserve les véhicules existants si update + ajoute le véhicule courant si non dupliqué
function saveCurrentClientToCarnet() {
  var nom = $('f-cnom').value.trim();
  if (!nom) { alert('Renseignez le nom du client d\'abord.'); return; }
  var clients = loadClients();
  var existing = clients.find(function(c){ return c.nom.toLowerCase() === nom.toLowerCase(); });
  if (existing && !confirm('Un client "' + nom + '" existe déjà. Mettre à jour ?')) return;
  var currentVeh = {
    vm: $('f-vm').value, vmo: $('f-vmo').value, vmot: $('f-vmot').value,
    van: $('f-van').value, vim: $('f-vim').value
  };
  var hasVeh = currentVeh.vm || currentVeh.vmo || currentVeh.vim;
  var vehs = (existing && existing.vehs && existing.vehs.length) ? existing.vehs.slice() : [];
  if (hasVeh) {
    var dup = vehs.find(function(v){
      return (currentVeh.vim && v.vim && v.vim.toUpperCase() === currentVeh.vim.toUpperCase())
          || (!currentVeh.vim && v.vm === currentVeh.vm && v.vmo === currentVeh.vmo);
    });
    if (!dup) vehs.push(currentVeh);
  }
  var cl = {
    id: existing ? existing.id : Date.now(),
    nom: nom, tel: $('f-ctel').value, email: $('f-cemail').value,
    adr: $('f-cadr').value, ville: $('f-cville').value,
    vm: currentVeh.vm, vmo: currentVeh.vmo, vmot: currentVeh.vmot,
    van: currentVeh.van, vim: currentVeh.vim,
    vehs: vehs,
  };
  if (existing) {
    var i = clients.indexOf(existing);
    clients[i] = cl;
  } else {
    clients.unshift(cl);
  }
  saveClients(clients);
  alert('Client enregistré dans le carnet ✓');
}

// ============================================================
//  OLSX — GAINS MOTEUR
// ============================================================
var currentGains = null;
var olsxDetected = null;

// Retourne la liste des gains depuis les lignes via le catalogue
function buildGainsFromLines(linesArr) {
  var cat = loadCat();
  var set = new Set();
  linesArr.forEach(function(l) {
    if (!l.label) return;
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

// Pré-remplir f-gains depuis les prestations actuellement sélectionnées
function prefillGains() {
  var suggestions = buildGainsFromLines(lines);
  if (suggestions.length) {
    $('f-gains').value = suggestions.join('\n');
    previewGainsBadge();
  } else {
    $('f-gains').value = '';
    previewGainsBadge();
    var btn = event.currentTarget;
    btn.textContent = 'Aucun gain trouvé';
    setTimeout(function(){ btn.textContent = '↺ Auto'; }, 1500);
  }
}

// Afficher les gains comme badges dans le formulaire
function previewGainsBadge() {
  var el = $('gains-badge-preview');
  if (!el) return;
  var raw = ($('f-gains') ? $('f-gains').value : '');
  var items = raw.split('\n').map(function(g){return g.trim();}).filter(Boolean);
  if (!items.length) { el.innerHTML = ''; return; }
  el.innerHTML = items.map(function(g) {
    return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:rgba(30,144,255,.1);border:1px solid rgba(30,144,255,.2);border-radius:20px;font-size:11px;color:var(--blue)">' + g + '</span>';
  }).join('');
}

function openOlsxModal() {
  olsxDetected = null;
  $('olsx-gains-preview').textContent = 'Sélectionne un véhicule dans le simulateur…';
  $('olsx-import-btn').style.display = 'none';
  $('olsx-modal').classList.add('open');
}
function closeOlsxModal() { $('olsx-modal').classList.remove('open'); }

function importOlsxGains() {
  if (!olsxDetected) return;
  currentGains = olsxDetected;
  renderGainsBar();
  var g = olsxDetected;
  var parts = [];
  if (g.chOrig && g.ch) parts.push(g.chOrig + ' ch → ' + g.ch + ' ch (+' + (g.ch - g.chOrig) + ' ch)');
  if (g.nmOrig && g.nm) parts.push(g.nmOrig + ' Nm → ' + g.nm + ' Nm (+' + (g.nm - g.nmOrig) + ' Nm)');
  if (g.conso) parts.push('Consommation : ' + g.conso);
  if (parts.length && $('f-gains')) {
    var existing = $('f-gains').value.trim();
    $('f-gains').value = (existing ? existing + '\n' : '') + parts.join('\n');
    previewGainsBadge();
  }
  closeOlsxModal();
}

function clearGains() {
  currentGains = null;
  renderGainsBar();
}

function renderGainsBar() {
  var bar = $('gains-bar');
  if (!bar) return;
  if (!currentGains) {
    bar.style.display = 'none';
    return;
  }
  var g = currentGains;
  var items = [];
  if (g.chOrig && g.ch)   items.push({ lbl: 'Puissance', val: g.chOrig + ' → ' + g.ch + ' ch (+' + (g.ch - g.chOrig) + ')' });
  if (g.nmOrig && g.nm)   items.push({ lbl: 'Couple',    val: g.nmOrig + ' → ' + g.nm + ' Nm (+' + (g.nm - g.nmOrig) + ')' });
  if (g.conso)             items.push({ lbl: 'Conso',     val: g.conso });
  bar.style.display = 'block';
  $('gains-bar-vals').innerHTML = items.map(function(it) {
    return '<div style="font-size:13px"><strong style="color:var(--green)">' + it.val + '</strong> <span style="color:var(--text-dim);font-size:11px">' + it.lbl + '</span></div>';
  }).join('');
}

// Écouter les messages postMessage de l'iframe OLSX
window.addEventListener('message', function(e) {
  if (!e.data) return;
  var d = e.data;
  if (d.type === 'olsx_data' || d.ch || d.power || d.horsepower) {
    olsxDetected = {
      ch:     d.ch || d.power || d.horsepower || null,
      chOrig: d.chOrig || d.powerOrig || d.originalHorsepower || null,
      nm:     d.nm || d.torque || null,
      nmOrig: d.nmOrig || d.torqueOrig || null,
      conso:  d.conso || d.consumption || null,
      raw:    d
    };
    var parts = [];
    if (olsxDetected.chOrig && olsxDetected.ch) parts.push(olsxDetected.chOrig + '→' + olsxDetected.ch + ' ch');
    if (olsxDetected.nmOrig && olsxDetected.nm) parts.push(olsxDetected.nmOrig + '→' + olsxDetected.nm + ' Nm');
    if (olsxDetected.conso) parts.push(olsxDetected.conso);
    if (parts.length) {
      $('olsx-gains-preview').textContent = '✓ Gains détectés : ' + parts.join(' · ');
      $('olsx-gains-preview').style.color = 'var(--green)';
      $('olsx-import-btn').style.display = 'inline-flex';
    }
  }
});

// ============================================================
//  GESTIONNAIRE CATALOGUE
// ============================================================
var catEditingGroup = null;
var catEditingItem  = null;

function renderCatEditor() {
  var cat = loadCat();
  var el = $('cat-editor');
  if (!el) return;
  if (!cat.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div>Aucun service. Clique sur "+ Ajouter une catégorie".</div>';
    return;
  }
  el.innerHTML = cat.map(function(grp, gi) {
    var items = (grp.items || []).map(function(it, ii) {
      var gainsCount = (it.gains || []).filter(Boolean).length;
      return '<div class="cat-item">'
        + '<div class="cat-item-label">' + escHtml(it.l)
          + (gainsCount > 0 ? ' <span style="font-size:10px;color:var(--green);margin-left:6px">✓ ' + gainsCount + ' gain' + (gainsCount>1?'s':'') + '</span>' : '') + '</div>'
        + '<div class="cat-item-price">' + (it.p > 0 ? it.p + ' €' : '<span style="color:var(--text-muted)">Sur devis</span>') + '</div>'
        + '<div class="cat-item-actions">'
          + '<button class="cat-icon-btn" onclick="editCatItem(' + gi + ',' + ii + ')" title="Modifier">✏️</button>'
          + '<button class="cat-icon-btn" onclick="moveCatItem(' + gi + ',' + ii + ',-1)" title="Monter">↑</button>'
          + '<button class="cat-icon-btn" onclick="moveCatItem(' + gi + ',' + ii + ',1)" title="Descendre">↓</button>'
          + '<button class="cat-icon-btn del" onclick="deleteCatItem(' + gi + ',' + ii + ')" title="Supprimer">×</button>'
        + '</div>'
      + '</div>';
    }).join('');
    return '<div class="cat-group">'
      + '<div class="cat-group-head" onclick="toggleCatGroup(this)">'
        + '<div class="cat-group-name">' + escHtml(grp.g) + '</div>'
        + '<div class="cat-group-count">' + (grp.items||[]).length + ' service' + ((grp.items||[]).length > 1 ? 's' : '') + '</div>'
        + '<div class="cat-group-actions" onclick="event.stopPropagation()">'
          + '<button class="cat-icon-btn" onclick="renameCatGroup(' + gi + ')" title="Renommer">✏️</button>'
          + '<button class="cat-icon-btn" onclick="moveCatGroup(' + gi + ',-1)" title="Monter">↑</button>'
          + '<button class="cat-icon-btn" onclick="moveCatGroup(' + gi + ',1)" title="Descendre">↓</button>'
          + '<button class="cat-icon-btn del" onclick="deleteCatGroup(' + gi + ')" title="Supprimer la catégorie">×</button>'
        + '</div>'
      + '</div>'
      + '<div class="cat-items" id="cat-group-' + gi + '">'
        + items
        + '<button class="cat-add-item" onclick="addCatItem(' + gi + ')">+ Ajouter un service</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

function toggleCatGroup(head) {
  var items = head.nextElementSibling;
  items.style.display = items.style.display === 'none' ? '' : 'none';
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openCatModal(gi, ii) {
  catEditingGroup = gi;
  catEditingItem  = ii;
  var cat = loadCat();
  var isNew = ii === null;
  $('cat-modal-title').textContent = isNew ? 'Nouveau service' : 'Modifier le service';
  var sel = $('cat-item-group');
  sel.innerHTML = cat.map(function(grp, i) {
    return '<option value="' + i + '"' + (i === gi ? ' selected' : '') + '>' + escHtml(grp.g) + '</option>';
  }).join('');
  if (!isNew) {
    var it = cat[gi].items[ii];
    $('cat-item-label').value = it.l;
    $('cat-item-price').value = it.p;
    $('cat-item-gains').value = (it.gains || []).join('\n');
  } else {
    $('cat-item-label').value = '';
    $('cat-item-price').value = '';
    $('cat-item-gains').value = '';
  }
  $('cat-item-modal').classList.add('open');
  setTimeout(function(){ $('cat-item-label').focus(); }, 100);
}

function closeCatModal() { $('cat-item-modal').classList.remove('open'); }
function addCatItem(gi) { openCatModal(gi, null); }
function editCatItem(gi, ii) { openCatModal(gi, ii); }

function saveCatItem() {
  var label = $('cat-item-label').value.trim();
  if (!label) { alert('Le nom du service est obligatoire.'); return; }
  var price = parseFloat($('cat-item-price').value) || 0;
  var targetGroup = parseInt($('cat-item-group').value);
  var cat = loadCat();
  var gainsRaw = ($('cat-item-gains').value || '').split('\n').map(function(g){ return g.trim(); }).filter(Boolean);
  var item = { l: label, p: price, gains: gainsRaw };
  if (catEditingItem === null) {
    cat[targetGroup].items.push(item);
  } else {
    if (targetGroup === catEditingGroup) {
      cat[catEditingGroup].items[catEditingItem] = item;
    } else {
      cat[catEditingGroup].items.splice(catEditingItem, 1);
      cat[targetGroup].items.push(item);
    }
  }
  saveCat(cat);
  closeCatModal();
  renderCatEditor();
}

function deleteCatItem(gi, ii) {
  if (!confirm('Supprimer ce service ?')) return;
  var cat = loadCat();
  cat[gi].items.splice(ii, 1);
  saveCat(cat);
  renderCatEditor();
}

function moveCatItem(gi, ii, dir) {
  var cat = loadCat();
  var items = cat[gi].items;
  var ni = ii + dir;
  if (ni < 0 || ni >= items.length) return;
  var tmp = items[ii]; items[ii] = items[ni]; items[ni] = tmp;
  saveCat(cat);
  renderCatEditor();
}

function addCatGroup() {
  $('cat-group-name-input').value = '';
  $('cat-group-modal').classList.add('open');
  setTimeout(function(){ $('cat-group-name-input').focus(); }, 100);
}

function confirmAddGroup() {
  var name = $('cat-group-name-input').value.trim();
  if (!name) { alert('Nom de catégorie obligatoire.'); return; }
  var cat = loadCat();
  cat.push({ g: name, items: [] });
  saveCat(cat);
  $('cat-group-modal').classList.remove('open');
  renderCatEditor();
}

function renameCatGroup(gi) {
  var cat = loadCat();
  var name = prompt('Nouveau nom de la catégorie :', cat[gi].g);
  if (!name || !name.trim()) return;
  cat[gi].g = name.trim();
  saveCat(cat);
  renderCatEditor();
}

function deleteCatGroup(gi) {
  var cat = loadCat();
  if (cat[gi].items.length > 0 && !confirm('Supprimer la catégorie "' + cat[gi].g + '" et ses ' + cat[gi].items.length + ' services ?')) return;
  cat.splice(gi, 1);
  saveCat(cat);
  renderCatEditor();
}

function moveCatGroup(gi, dir) {
  var cat = loadCat();
  var ni = gi + dir;
  if (ni < 0 || ni >= cat.length) return;
  var tmp = cat[gi]; cat[gi] = cat[ni]; cat[ni] = tmp;
  saveCat(cat);
  renderCatEditor();
}

function resetCatalogue() {
  if (!confirm('Réinitialiser le catalogue aux services par défaut ?')) return;
  localStorage.removeItem(CAT_KEY);
  if (db && syncOk) db.collection('config').doc('catalogue').delete().catch(function(){});
  renderCatEditor();
}

function exportCatalogue() {
  var cat = loadCat();
  var json = JSON.stringify(cat, null, 2);
  var blob = new Blob([json], {type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'catalogue-areprog.json';
  a.click();
}

function syncCatalogueFromFirebase() {
  if (!db) return;
  db.collection('config').doc('catalogue').get()
    .then(function(doc) {
      if (doc.exists && doc.data().cat) {
        localStorage.setItem(CAT_KEY, JSON.stringify(doc.data().cat));
      }
    })
    .catch(function(){});
}
