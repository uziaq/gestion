// ============================================================
// 02-form.js — Lines/autocomplete, acompte modal, totaux, saveDoc/loadDoc/deleteDoc
// (Refonte modulaire de gestion.html, source AREPROG)
// ============================================================


// ============================================================
//  LINES
// ============================================================
function buildSuggestions(query) {
  var q = query.trim().toLowerCase();
  if (!q) return [];
  var results = [], seen = {};
  var cat = loadCat();
  cat.forEach(function(group) {
    group.items.forEach(function(it) {
      if (it.l.toLowerCase().indexOf(q) !== -1 && !seen[it.l]) {
        seen[it.l] = true;
        results.push({ label: it.l, price: it.p || 0, group: group.g });
      }
    });
  });
  var shop = SHOP_PRODUCTS || [];
  shop.forEach(function(p) {
    if (p.name && p.name.toLowerCase().indexOf(q) !== -1 && !seen[p.name]) {
      seen[p.name] = true;
      results.push({ label: p.name, price: p.price || 0, group: 'Boutique' });
    }
  });
  return results.slice(0, 20);
}

function initLineAutocomplete(inputEl, lid) {
  var wrap = document.createElement('div');
  wrap.className = 'ac-wrap';
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);
  var drop = document.createElement('div');
  drop.className = 'ac-drop';
  wrap.appendChild(drop);
  var activeIdx = -1;

  function getItems() { return drop.querySelectorAll('.ac-item'); }
  function setActive(idx) {
    var items = getItems();
    items.forEach(function(el, i) { el.classList.toggle('active', i === idx); });
    activeIdx = idx;
  }
  function showDrop(suggestions) {
    drop.innerHTML = '';
    if (!suggestions.length) { drop.classList.remove('open'); return; }
    var lastGroup = null;
    suggestions.forEach(function(s) {
      if (s.group !== lastGroup) {
        var sep = document.createElement('div');
        sep.className = 'ac-sep';
        sep.textContent = s.group;
        drop.appendChild(sep);
        lastGroup = s.group;
      }
      var item = document.createElement('div');
      item.className = 'ac-item';
      var lbl = document.createElement('span');
      lbl.textContent = s.label;
      var pr = document.createElement('span');
      pr.className = 'ac-price';
      pr.textContent = s.price > 0 ? s.price.toFixed(2) + ' €' : '';
      item.appendChild(lbl);
      item.appendChild(pr);
      (function(suggestion) {
        item.addEventListener('mousedown', function(e) {
          e.preventDefault();
          selectSuggestion(suggestion);
        });
      })(s);
      drop.appendChild(item);
    });
    activeIdx = -1;
    drop.classList.add('open');
  }
  function hideDrop() { drop.classList.remove('open'); activeIdx = -1; }
  function selectSuggestion(s) {
    var line = lines.find(function(l) { return l.id === lid; });
    if (!line) return;
    line.label = s.label;
    line.pu = s.price || 0;
    inputEl.value = s.label;
    hideDrop();
    var row = inputEl.closest('.line-row');
    if (row) {
      var puInp = row.querySelectorAll('input[type="number"]')[1];
      if (puInp) puInp.value = line.pu.toFixed(2);
      var ltVal = row.querySelector('.lt-val');
      if (ltVal && !line.offert) ltVal.textContent = (line.qte * line.pu).toFixed(2) + ' €';
    }
    calcTotaux();
  }
  inputEl.addEventListener('input', function() {
    var line = lines.find(function(l) { return l.id === lid; });
    if (line) line.label = inputEl.value;
    if (inputEl.value.length >= 1) {
      if (SHOP_PRODUCTS === null) {
        loadShopProducts(function() { showDrop(buildSuggestions(inputEl.value)); });
        showDrop(buildSuggestions(inputEl.value));
      } else {
        showDrop(buildSuggestions(inputEl.value));
      }
    } else {
      hideDrop();
    }
  });
  inputEl.addEventListener('keydown', function(e) {
    var items = getItems();
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIdx + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIdx - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0 && items[activeIdx]) { e.preventDefault(); items[activeIdx].dispatchEvent(new MouseEvent('mousedown')); }
    else if (e.key === 'Escape' || e.key === 'Tab') { hideDrop(); }
  });
  inputEl.addEventListener('blur', function() { hideDrop(); });
}

function addLine(data) {
  data = data || {};
  lines.push({ id: Date.now() + Math.random(), label: data.label || '', qte: data.qte || 1, pu: data.pu || 0, desc: data.desc || '' });
  renderLines();
}

function removeLine(lid) {
  lines = lines.filter(function(l) { return l.id !== lid; });
  renderLines();
  calcTotaux();
}

function renderLines() {
  var c = $('lines');
  c.innerHTML = '';
  lines.forEach(function(line) {
    var wrapper = document.createElement('div');
    wrapper.className = 'line-item';

    var div = document.createElement('div');
    div.className = 'line-row';
    div.dataset.lid = line.id;
    var isOffert = line.offert || false;
    var total = isOffert ? 'Offert' : (line.qte * line.pu).toFixed(2) + ' €';
    var disabledAttr = isOffert ? ' disabled' : '';
    var opacityStyle = isOffert ? ' style="text-align:right;opacity:.4"' : ' style="text-align:right"';
    div.innerHTML =
      '<input type="text" class="line-label-input" placeholder="Désignation…" value="' + (line.label || '').replace(/"/g,'&quot;') + '" autocomplete="off" autocorrect="off" spellcheck="false"/>' +
      '<div class="lf lf-qte"><span class="lf-lbl">Qté</span><input type="number" min="1" step="1" value="' + line.qte + '" onchange="lineField(this,' + line.id + ',\'qte\')"' + disabledAttr + '/></div>' +
      '<div class="lf lf-pu"><span class="lf-lbl">PU HT</span><input type="number" min="0" step="0.01" value="' + line.pu.toFixed(2) + '" onchange="lineField(this,' + line.id + ',\'pu\')"' + (isOffert ? ' style="opacity:.4"' : '') + disabledAttr + '/></div>' +
      '<label class="lf lf-offert" title="Offert"><span class="lf-lbl">Offert</span><input type="checkbox"' + (isOffert ? ' checked' : '') + ' onchange="lineOffert(this,' + line.id + ')" style="width:18px;height:18px;accent-color:var(--green);cursor:pointer"/></label>' +
      '<div class="lt"><span class="lf-lbl">Total</span><span class="lt-val" style="color:' + (isOffert ? 'var(--green)' : '') + '">' + total + '</span></div>' +
      '<button class="rm-line" onclick="removeLine(' + line.id + ')" title="Supprimer">×</button>';

    var labelInput = div.querySelector('.line-label-input');
    (function(id) { initLineAutocomplete(labelInput, id); })(line.id);

    var descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'line-desc';
    descInput.placeholder = 'Description (optionnel)';
    descInput.value = line.desc || '';
    (function(id) {
      descInput.addEventListener('input', function() { lineDesc(this, id); });
    })(line.id);

    var descWrap = document.createElement('div');
    descWrap.className = 'line-desc-wrap';
    descWrap.appendChild(descInput);

    wrapper.appendChild(div);
    wrapper.appendChild(descWrap);
    c.appendChild(wrapper);
  });
  calcTotaux();
}

function lineOffert(chk, lid) {
  var line = lines.find(function(l){ return l.id === lid; });
  if (!line) return;
  line.offert = chk.checked;
  renderLines();
}


function lineField(inp, lid, field) {
  var line = lines.find(function(l) { return l.id === lid; });
  if (!line) return;
  line[field] = parseFloat(inp.value) || 0;
  var row = inp.closest('.line-row');
  row.querySelector('.lt-val').textContent = (line.qte * line.pu).toFixed(2) + ' €';
  calcTotaux();
}

function lineDesc(inp, lid) {
  var line = lines.find(function(l) { return l.id === lid; });
  if (!line) return;
  line.desc = inp.value;
  onFormChange();
}

// ============================================================
//  ACOMPTE
// ============================================================
var currentAcompte = null;

function openAcompteModal() {
  var doc = buildObj();
  var ttc = doc.ttc || 0;
  $('acomp-ttc').textContent = fmt(ttc);
  var savedPct = (currentAcompte && currentAcompte.pct) ? currentAcompte.pct : 30;
  var savedMontant = (currentAcompte && currentAcompte.montant) ? currentAcompte.montant : Math.round(ttc * savedPct / 100 * 100) / 100;
  $('acomp-pct').value = savedPct;
  $('acomp-montant').value = savedMontant.toFixed(2);
  $('acomp-date').value = (currentAcompte && currentAcompte.date) ? currentAcompte.date : today();
  if (currentAcompte && currentAcompte.mode) $('acomp-mode').value = currentAcompte.mode;
  _acompTtc = ttc;
  updateAcompSolde(ttc, savedMontant);
  $('acompte-modal').classList.add('open');
}

var _acompTtc = 0;

function closeAcompteModal() { $('acompte-modal').classList.remove('open'); }

function updateAcompSolde(ttc, montant) {
  $('acomp-solde').textContent = fmt(Math.max(0, ttc - montant));
}

function syncAcomptePct() {
  var pct = parseFloat($('acomp-pct').value) || 0;
  var montant = Math.round(_acompTtc * pct / 100 * 100) / 100;
  $('acomp-montant').value = montant.toFixed(2);
  updateAcompSolde(_acompTtc, montant);
}

function syncAcompteMontant() {
  var montant = parseFloat($('acomp-montant').value) || 0;
  $('acomp-pct').value = _acompTtc > 0 ? Math.round(montant / _acompTtc * 1000) / 10 : 0;
  updateAcompSolde(_acompTtc, montant);
}

function _getAcompteData() {
  var montant = parseFloat($('acomp-montant').value) || 0;
  return {
    montant: montant,
    pct: parseFloat($('acomp-pct').value) || 0,
    mode: $('acomp-mode').value,
    date: $('acomp-date').value,
    recu: true,
    ttc: _acompTtc,
    solde: Math.max(0, _acompTtc - montant)
  };
}

function previewAcomptePDF() {
  var doc = buildObj();
  var ac = _getAcompteData();
  $('preview').innerHTML = renderAcompteHTML(doc, ac);
  $('modal').classList.add('open');
  $('modal').dataset.printTitle = 'AREPROG_Acompte_' + (doc.num || 'doc').replace(/[^a-zA-Z0-9_-]/g,'-') + '_' + (doc.cn || 'client').replace(/\s+/g,'-');
}

function validerAcompteRecu() {
  var ac = _getAcompteData();
  if (!ac.montant) { alert('Saisissez un montant d\'acompte.'); return; }
  currentAcompte = ac;
  var doc = buildObj();
  if (!doc.cn) { alert('Renseignez le nom du client avant d\'enregistrer.'); return; }
  var docs = loadDocs();
  if (editId) {
    var i = docs.findIndex(function(d) { return d.id === editId; });
    if (i >= 0) docs[i] = doc; else docs.unshift(doc);
  } else { docs.unshift(doc); editId = doc.id; }
  saveDocs(docs);
  closeAcompteModal();
  renderDash();
  showNotifBanner('💶', 'Acompte enregistré', fmt(ac.montant) + ' — ' + ac.mode);
  previewAcomptePDF();
}

function renderAcompteHTML(doc, ac) {
  var tpl = loadTemplate();
  var accentColor = sanitizeCssColor(tpl.color || '#1E90FF');
  var vehStr = [escHtml(doc.vm||''), escHtml(doc.vmo||''), escHtml(doc.vmot||''), doc.van?'('+escHtml(doc.van)+')':''].filter(Boolean).join(' ');
  var linesHTML = (doc.lines||[]).filter(function(l){return !l.offert;}).map(function(l){
    return '<tr><td>'+escHtml(l.label||'—')+'</td><td style="text-align:center">'+l.qte+'</td><td style="text-align:right">'+(l.pu||0).toFixed(2)+' €</td><td style="text-align:right"><strong>'+((l.qte||1)*(l.pu||0)).toFixed(2)+' €</strong></td></tr>';
  }).join('');
  return '<style>'
    + 'body,*{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;box-sizing:border-box}'
    + '.ah{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid '+accentColor+'33;margin-bottom:20px}'
    + '.ab{font-size:20px;font-weight:800;color:'+accentColor+'}'
    + '.ai{font-size:11px;color:#666;margin-top:4px;line-height:1.6}'
    + '.at{font-size:20px;font-weight:800;color:'+accentColor+';text-align:right}'
    + '.an{font-size:12px;color:#555;text-align:right}'
    + '.ap{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:18px 0}'
    + '.apl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:3px}'
    + '.apn{font-size:15px;font-weight:700;margin-bottom:3px}'
    + '.api{font-size:12px;color:#555;line-height:1.6}'
    + '.adt{width:100%;border-collapse:collapse;margin:14px 0;font-size:12px}'
    + '.adt th{background:#f8f8f8;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#666;border-bottom:1px solid #eee}'
    + '.adt td{padding:7px 10px;border-bottom:1px solid #f5f5f5}'
    + '.abox{border:2px solid '+accentColor+'44;border-radius:8px;padding:18px;margin:18px 0}'
    + '.abox-t{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:'+accentColor+';font-weight:700;margin-bottom:12px}'
    + '.ar{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f0f0f0}'
    + '.ar:last-child{border:none}'
    + '.ar.big{font-weight:700;font-size:15px;color:'+accentColor+';padding-top:10px}'
    + '.ar.solde{font-weight:700;font-size:14px;color:#f97316;margin-top:6px;padding-top:8px;border-top:2px solid #f9731644}'
    + '.sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:28px}'
    + '.sig-b{border-top:1px solid #ccc;padding-top:8px}'
    + '.sig-l{font-size:11px;color:#888}'
    + '</style>'
    + '<div class="ah">'
      + '<div><div class="ab">'+buildLogoHTML(tpl)+'</div>'
        + '<div class="ai">'+escHtml(tpl.activite||'')+(tpl.tel?'<br>'+escHtml(tpl.tel):'')+(tpl.email?'<br>'+escHtml(tpl.email):'')+'</div></div>'
      + '<div><div class="at">REÇU D’ACOMPTE</div>'
        + '<div class="an">Réf. '+escHtml(doc.num||'—')+'</div>'
        + '<div class="an">Date : '+fmtDate(ac.date)+'</div></div>'
    + '</div>'
    + '<div class="ap">'
      + '<div><div class="apl">Prestataire</div><div class="apn">'+escHtml(tpl.nom||'AREPROG')+'</div>'
        + '<div class="api">'+escHtml(tpl.activite||'')+(tpl.adresse?'<br>'+escHtml(tpl.adresse):'')+(tpl.tel?'<br>'+escHtml(tpl.tel):'')+(tpl.email?'<br>'+escHtml(tpl.email):'')+(tpl.legal?'<br><small style="color:#aaa">'+escHtml(tpl.legal)+'</small>':'')+'</div></div>'
      + '<div><div class="apl">Client</div><div class="apn">'+escHtml(doc.cn||'—')+'</div>'
        + '<div class="api">'+(doc.ca?escHtml(doc.ca)+'<br>':'')+escHtml(doc.cv||'')+(doc.ct?'<br>'+escHtml(doc.ct):'')+(doc.ce?'<br>'+escHtml(doc.ce):'')+(vehStr?'<br><br><strong>Véhicule :</strong> '+vehStr:'')+(doc.vim?'<br>Immat. : <strong>'+escHtml(doc.vim.toUpperCase())+'</strong>':'')+'</div></div>'
    + '</div>'
    + (linesHTML?'<table class="adt"><thead><tr><th>Désignation</th><th style="text-align:center">Qté</th><th style="text-align:right">PU HT</th><th style="text-align:right">Total HT</th></tr></thead><tbody>'+linesHTML+'</tbody></table>':'')
    + '<div class="abox"><div class="abox-t">Détail de l’acompte</div>'
      + '<div class="ar"><span>Total TTC du document</span><span>'+(ac.ttc||0).toFixed(2)+' €</span></div>'
      + '<div class="ar big"><span>Acompte reçu</span><span>'+(ac.montant||0).toFixed(2)+' €</span></div>'
      + '<div class="ar"><span>Mode de paiement</span><span>'+escHtml(ac.mode||'')+'</span></div>'
      + '<div class="ar solde"><span>Solde restant à régler</span><span>'+(ac.solde||0).toFixed(2)+' €</span></div>'
    + '</div>'
    + '<div class="sig">'
      + '<div class="sig-b"><div class="sig-l">Signature prestataire</div><div style="height:60px"></div></div>'
      + '<div class="sig-b"><div class="sig-l">Signature client (bon pour accord)</div><div style="height:60px"></div></div>'
    + '</div>'
    + (tpl.showFooter!==false&&tpl.footer?'<div style="margin-top:22px;padding-top:10px;border-top:1px solid #eee;font-size:11px;color:#888;text-align:center">'+escHtml(tpl.footer).replace(/\n/g,'<br>')+'</div>':'');
}

// ============================================================
//  TOTAUX
// ============================================================
function onFormChange() {
  // Appelé par chaque changement de champ du formulaire
  if ($('t-form') && $('t-form').classList.contains('on')) {
    triggerAutoSave();
  }
}

function calcTotaux() {
  var ht = lines.reduce(function(s, l) { return s + (l.offert ? 0 : l.qte * l.pu); }, 0);
  var tvaRate = parseFloat($('f-tva').value) / 100;
  $('t-ht').textContent = fmt(ht);
  $('t-tva').textContent = fmt(ht * tvaRate);
  $('t-ttc').textContent = fmt(ht * (1 + tvaRate));
}

// ============================================================
//  SAVE / LOAD
// ============================================================
function buildObj() {
  var ht = lines.reduce(function(s, l) { return s + (l.offert ? 0 : l.qte * l.pu); }, 0);
  var tvaRate = parseFloat($('f-tva').value) / 100;
  return {
    id: editId || Date.now(),
    type: $('f-type').value,
    num: $('f-num').value,
    date: $('f-date').value,
    ech: $('f-ech').value,
    statut: $('f-statut').value,
    cn: $('f-cnom').value,
    ca: $('f-cadr').value,
    cv: $('f-cville').value,
    ct: $('f-ctel').value,
    ce: $('f-cemail').value,
    vm: $('f-vm').value,
    vmo: $('f-vmo').value,
    vmot: $('f-vmot').value,
    van: $('f-van').value,
    vim: $('f-vim').value,
    vkm: $('f-vkm').value,
    lines: JSON.parse(JSON.stringify(lines)),
    gains: currentGains ? JSON.parse(JSON.stringify(currentGains)) : null,
    customGains: ($('f-gains') ? $('f-gains').value.split('\n').map(function(g){return g.trim();}).filter(Boolean) : []),
    declare: getDeclaration(),
    frais: getFraisObj(),
    fraisTotal: calcFraisTotal(),
    tvaRate: parseFloat($('f-tva').value),
    ht: ht,
    tva: ht * tvaRate,
    ttc: ht * (1 + tvaRate),
    notes: $('f-notes').value,
    nint: $('f-nint').value,
    acompte: currentAcompte ? JSON.parse(JSON.stringify(currentAcompte)) : null,
  };
}

function saveDoc() {
  var doc = buildObj();
  if (!doc.cn) { alert('Renseignez le nom du client avant d\'enregistrer.'); return; }
  var docs = loadDocs();
  if (editId) {
    var i = docs.findIndex(function(d) { return d.id === editId; });
    if (i >= 0) docs[i] = doc; else docs.unshift(doc);
  } else {
    docs.unshift(doc);
  }
  editId = doc.id;
  saveDocs(docs);
  renderDash();
  // Proposer d'enregistrer le client dans le carnet si nouveau
  var cn = $('f-cnom').value.trim();
  var clients = loadClients();
  var exists = cn && clients.some(function(cl){ return cl.nom.toLowerCase() === cn.toLowerCase(); });
  if (cn && !exists) {
    if (confirm('Enregistrer "' + cn + '" dans le carnet clients ?')) {
      saveCurrentClientToCarnet();
    }
  }
  alert('Document enregistré ✓');
}

// Charger un objet doc directement dans le formulaire (draft restore)
function loadDocData(doc) {
  if (!doc) return;
  editId = doc.id || null;
  $('f-type').value  = doc.type  || 'devis';
  $('f-num').value   = doc.num   || '';
  $('f-date').value  = doc.date  || today();
  $('f-ech').value   = doc.ech   || '';
  $('f-statut').value= doc.statut|| 'envoyé';
  $('f-cnom').value  = doc.cn    || '';
  $('f-cadr').value  = doc.ca    || '';
  $('f-cville').value= doc.cv    || '';
  $('f-ctel').value  = doc.ct    || '';
  $('f-cemail').value= doc.ce    || '';
  $('f-vm').value    = doc.vm    || '';
  $('f-vmo').value   = doc.vmo   || '';
  $('f-vmot').value  = doc.vmot  || '';
  $('f-van').value   = doc.van   || '';
  $('f-vim').value   = doc.vim   || '';
  $('f-vkm').value   = doc.vkm   || '';
  $('f-tva').value   = String(doc.tvaRate || 0);
  $('f-notes').value = doc.notes || '';
  $('f-nint').value  = doc.nint  || '';
  lines = doc.lines ? JSON.parse(JSON.stringify(doc.lines)) : [];
  currentGains = doc.gains ? JSON.parse(JSON.stringify(doc.gains)) : null;
  if ($('f-gains')) {
    $('f-gains').value = (doc.customGains||[]).join('\n');
    previewGainsBadge();
  }
  setDeclaration(doc.declare !== false);
  loadFrais(doc.frais || null);
  onTypeChange();
  renderLines();
  calcTotaux();
  renderGainsBar();
  fillTplForm(loadTemplate());
  showTab('form');
}

function loadDoc(docId) {
  var doc = loadDocs().find(function(d) { return d.id === docId; });
  if (!doc) return;
  editId = doc.id;
  $('f-type').value = doc.type;
  $('f-num').value = doc.num;
  $('f-date').value = doc.date;
  $('f-ech').value = doc.ech || plusDays(30);
  $('f-statut').value = doc.statut;
  $('f-cnom').value = doc.cn || '';
  $('f-cadr').value = doc.ca || '';
  $('f-cville').value = doc.cv || '';
  $('f-ctel').value = doc.ct || '';
  $('f-cemail').value = doc.ce || '';
  $('f-vm').value = doc.vm || '';
  $('f-vmo').value = doc.vmo || '';
  $('f-vmot').value = doc.vmot || '';
  $('f-van').value = doc.van || '';
  $('f-vim').value = doc.vim || '';
  $('f-vkm').value = doc.vkm || '';
  $('f-tva').value = String(doc.tvaRate || 0);
  $('f-notes').value = doc.notes || '';
  $('f-nint').value = doc.nint || '';
  lines = JSON.parse(JSON.stringify(doc.lines));
  currentGains = doc.gains || null;
  currentAcompte = doc.acompte || null;
  renderGainsBar();
  // Restaurer déclaration
  setDeclaration(doc.declare !== false);
  // Restaurer frais
  loadFrais(doc.frais || null);
  // Restaurer les gains personnalisés
  if ($('f-gains')) {
    if (doc.customGains && doc.customGains.length) {
      $('f-gains').value = doc.customGains.join('\n');
    } else {
      // Pré-remplir depuis le catalogue si pas de gains custom
      $('f-gains').value = buildGainsFromLines(doc.lines || []).join('\n');
    }
    previewGainsBadge();
  }
  renderLines();
  $('form-h').textContent = doc.type === 'devis' ? 'Modifier le devis' : 'Modifier la facture';
  showTab('form');
}

function deleteDoc(docId) {
  if (!confirm('Supprimer définitivement ce document ?')) return;
  saveDocs(loadDocs().filter(function(d) { return d.id !== docId; }));
  deleteDocFirebase(docId);
  renderDash();
  renderListe();
}
