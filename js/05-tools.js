// ============================================================
// 05-tools.js — Send email + PDF, confirm msg, search, stats, export CSV, tabs, autosave, filters, shortcuts, fiscalité
// (Refonte modulaire de gestion.html, source AREPROG)
// ============================================================


// ══════════════════════════════════════════════════════════════
//  ENVOI DEVIS / FACTURES PAR EMAIL
// ══════════════════════════════════════════════════════════════
var _emailDocPdfB64 = null;

function sendDocByEmail() {
  // Récupérer l'email du client si connu
  var doc = _currentDocForEmail;
  var defaultEmail = doc && doc.ce ? doc.ce : '';
  $('send-to-email').value = defaultEmail;
  // Message par défaut
  var tpl = loadTemplate();
  var type = doc && doc.type === 'facture' ? 'facture' : 'devis';
  var num  = doc ? doc.num : '';
  $('send-message').value = 'Bonjour,\n\nVeuillez trouver ci-joint votre ' + type + ' ' + num + '.\n\nCordialement,\n' + (tpl.nom||'AREPROG') + '\n' + (tpl.tel||'');
  $('send-email-status').style.display = 'none';
  $('send-email-confirm-btn').disabled = false;
  $('send-email-confirm-btn').textContent = '📧 Envoyer';
  $('send-email-modal').classList.add('open');
}

async function confirmSendEmail() {
  var toEmail = $('send-to-email').value.trim();
  if (!toEmail || !toEmail.includes('@')) {
    showSendStatus('error', 'Email invalide.');
    return;
  }
  // Tenter une dernière init si pas encore prêt
  if (!_ejsReady) initEmailJS();
  if (!_ejsReady) {
    showSendStatus('error', 'Service email non disponible. Rechargez la page et réessayez.');
    return;
  }

  var btn = $('send-email-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Génération PDF…';

  try {
    // Générer le PDF depuis le contenu affiché dans le modal
    var pdfB64 = await generatePdfBase64();
    btn.textContent = 'Envoi en cours…';

    var doc = _currentDocForEmail || {};
    var tpl = loadTemplate();
    var message = $('send-message').value;
    var type = doc.type === 'facture' ? 'Facture' : 'Devis';

    await emailjs.send(EJS_SERVICE, EJS_TPL_DOC, {
      to_email:    toEmail,
      from_name:   tpl.nom || 'AREPROG',
      from_email:  EJS_FROM_EMAIL,
      doc_type:    type,
      doc_num:     doc.num || '',
      doc_date:    doc.date ? fmtDate(doc.date) : '',
      client_nom:  doc.cn || '',
      montant_ttc: fmt(doc.ttc || 0),
      message:     message,
      pdf_base64:  pdfB64,
      pdf_name:    buildPdfTitle(doc) + '.pdf',
    });

    showSendStatus('success', 'Email envoyé à '+toEmail+' ✓');
    btn.textContent = '✓ Envoyé !';
    setTimeout(function(){ $('send-email-modal').classList.remove('open'); }, 2000);
    showNotifBanner('📧', 'Email envoyé !', type+' '+doc.num+' → '+toEmail);

  } catch(e) {
    console.error('Envoi email doc:', e);
    showSendStatus('error', 'Erreur : '+(e.text||e.message||'Réessayez.'));
    btn.disabled = false;
    btn.textContent = '📧 Envoyer';
  }
}

function showSendStatus(type, msg) {
  var el = $('send-email-status');
  el.style.display = 'block';
  el.style.background = type==='success'?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)';
  el.style.color = type==='success'?'var(--green)':'var(--red)';
  el.style.border = '1px solid '+(type==='success'?'rgba(34,197,94,.2)':'rgba(239,68,68,.2)');
  el.textContent = msg;
}

async function generatePdfBase64() {
  // Utiliser jsPDF + html2canvas pour capturer le document
  var el = $('preview');
  if (!el) throw new Error('Aperçu non disponible');

  var canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  var { jsPDF } = window.jspdf;
  var pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  var imgW = 210; // A4 width mm
  var imgH = (canvas.height * imgW) / canvas.width;
  var pageH = 297; // A4 height mm
  var pos = 0;

  // Gestion multi-pages si le doc est long
  while (pos < imgH) {
    if (pos > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, -pos, imgW, imgH);
    pos += pageH;
  }

  // Retourner en base64 sans le prefixe data:
  var b64 = pdf.output('datauristring');
  return b64.split(',')[1];
}

// Banner in-app (fallback ou iOS qui bloque Notification API)
function showNotifBanner(icon, title, msg) {
  $('notif-icon').textContent = icon;
  $('notif-title').textContent = title;
  $('notif-msg').textContent = msg;
  $('notif-banner').classList.add('show');
  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(closeNotifBanner, 5000);
}
function closeNotifBanner() {
  $('notif-banner').classList.remove('show');
}

// ── Message de confirmation RDV ─────────────────────────────
function buildConfirmMsg(rdv) {
  var tpl = loadTemplate();
  var nomEntreprise = tpl.nom || 'AREPROG';
  var tel = tpl.tel || '06 67 92 46 30';
  var cl = rdv.clientId ? loadClients().find(function(c){ return c.id === rdv.clientId; }) : null;
  var clientPrenom = cl ? cl.nom.split(' ')[0] : '';

  var dateStr = rdv.date ? (function() {
    var d = new Date(rdv.date);
    var jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    var mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()] + ' ' + d.getFullYear();
  })() : '';

  var lignes = [];
  lignes.push('Bonjour ' + (clientPrenom || '') + ' !');
  lignes.push('');
  lignes.push('Je vous confirme notre rendez-vous pour l\'intervention :');
  lignes.push('');
  lignes.push('📅 ' + (dateStr || rdv.date));
  if (rdv.heure) lignes.push('🕐 ' + rdv.heure);
  if (rdv.lieu)  lignes.push('📍 ' + rdv.lieu);
  if (rdv.title) lignes.push('🔧 ' + rdv.title);
  lignes.push('');
  // Infos véhicule du RDV (priorité au véhicule sélectionné, sinon premier)
  if (cl) {
    var vehs2 = cl.vehs && cl.vehs.length ? cl.vehs : (cl.vm ? [{vm:cl.vm,vmo:cl.vmo||'',vmot:cl.vmot||'',van:cl.van||''}] : []);
    var selV = (rdv.vehIdx !== null && rdv.vehIdx !== undefined && vehs2[rdv.vehIdx]) ? vehs2[rdv.vehIdx] : vehs2[0];
    if (selV && selV.vm) {
      lignes.push('🚗 Véhicule : ' + [selV.vm,selV.vmo,selV.vmot,selV.van?'('+selV.van+')':''].filter(Boolean).join(' '));
      lignes.push('');
    }
  }
  if (rdv.notes) {
    lignes.push('📝 ' + rdv.notes);
    lignes.push('');
  }
  lignes.push('N\'hésitez pas à me contacter si besoin.');
  lignes.push('');
  lignes.push('À bientôt,');
  lignes.push(nomEntreprise);
  lignes.push(tel);

  return lignes.join('\n');
}

function copyConfirmMsg(rdvId) {
  var rdv = loadRdvs().find(function(r){ return r.id === rdvId; });
  if (!rdv) return;
  var msg = buildConfirmMsg(rdv);

  // Copier dans le presse-papier
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(msg).then(function() {
      showNotifBanner('📋', 'Message copié !', 'Colle-le dans WhatsApp ou SMS.');
      // Mettre à jour le bouton visuellement
      document.querySelectorAll('.rdv-confirm-btn').forEach(function(btn) {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(rdvId)) {
          btn.textContent = '✓ Copié !';
          btn.classList.add('copied');
          setTimeout(function(){ btn.textContent = '📋 Copier confirmation'; btn.classList.remove('copied'); }, 2000);
        }
      });
    }).catch(function() { fallbackCopy(msg); });
  } else {
    fallbackCopy(msg);
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    showNotifBanner('📋', 'Message copié !', 'Colle-le dans WhatsApp ou SMS.');
  } catch(e) {
    // Afficher le message dans une alerte pour copie manuelle
    prompt('Copie ce message :', text);
  }
  document.body.removeChild(ta);
}

// Aperçu du message de confirmation (dans le modal RDV)
function previewConfirmMsg(rdvId) {
  if (!rdvId) return '';
  var rdv = loadRdvs().find(function(r){ return r.id === rdvId; });
  if (!rdv) return '';
  return buildConfirmMsg(rdv);
}

// ── Helpers ─────────────────────────────────────────────────
function toDateStr(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,'0');
  var j = String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+j;
}

// ── Sync Firebase rdvs ───────────────────────────────────────
function syncRdvsFromFirebase() {
  if (!db) return;
  db.collection('rdvs').doc('all').get()
    .then(function(doc) {
      if (doc.exists && doc.data().rdvs) {
        localStorage.setItem(RDV_KEY, JSON.stringify(doc.data().rdvs));
      }
    }).catch(function(){});
}

// ============================================================
//  TABS (complet avec agenda)
// ============================================================

// ============================================================
//  STATUT RAPIDE
// ============================================================
function toggleStatusDropdown(e, docId) {
  e.stopPropagation();
  var dd = $('sd-' + docId);
  if (!dd) return;
  var pill = dd.parentElement;
  var isOpen = pill.classList.contains('open');
  // Fermer tous les autres
  document.querySelectorAll('.status-pill.open').forEach(function(p){ p.classList.remove('open'); });
  if (!isOpen) pill.classList.add('open');
}
// Fermer les dropdowns au clic extérieur
document.addEventListener('click', function() {
  document.querySelectorAll('.status-pill.open').forEach(function(p){ p.classList.remove('open'); });
});

function quickSetStatus(docId, newStatus) {
  var docs = loadDocs();
  var idx = docs.findIndex(function(d){ return d.id === docId; });
  if (idx < 0) return;
  docs[idx].statut = newStatus;
  saveDocs(docs);
  renderDash();
  if ($('t-liste').classList.contains('on')) renderListe();
  showNotifBanner('✅', 'Statut mis à jour', docs[idx].num + ' → ' + newStatus);
}

// ============================================================
//  DUPLIQUER UN DOCUMENT
// ============================================================
function duplicateDoc(docId) {
  var docs = loadDocs();
  var orig = docs.find(function(d){ return d.id === docId; });
  if (!orig) return;
  var copy = JSON.parse(JSON.stringify(orig));
  copy.id = Date.now();
  copy.date = today();
  var ech = new Date(); ech.setDate(ech.getDate() + 30);
  copy.ech = ech.toISOString().split('T')[0];
  copy.statut = 'envoyé';
  // Nouveau numéro
  var prefix = copy.type === 'devis' ? 'DEV' : 'FAC';
  copy.num = genNum(prefix);
  docs.unshift(copy);
  saveDocs(docs);
  // Charger dans le formulaire
  loadDoc(copy.id);
  showNotifBanner('⧉', 'Document dupliqué', copy.num + ' créé depuis ' + orig.num);
}

// ============================================================
//  DEVIS → FACTURE EN 1 CLIC
// ============================================================
function devisToFacture(docId) {
  var docs = loadDocs();
  var devis = docs.find(function(d){ return d.id === docId; });
  if (!devis) return;
  if (!confirm('Convertir ce devis en facture ? Le devis sera conservé.')) return;
  var facture = JSON.parse(JSON.stringify(devis));
  facture.id = Date.now();
  facture.type = 'facture';
  facture.num = genNum('FAC');
  facture.date = today();
  facture.statut = 'envoyé';
  facture.refDevis = devis.num; // référence au devis d'origine
  docs.unshift(facture);
  // Marquer le devis comme accepté
  var devisIdx = docs.findIndex(function(d){ return d.id === docId; });
  if (devisIdx >= 0 && docs[devisIdx].statut === 'envoyé') docs[devisIdx].statut = 'accepté';
  saveDocs(docs);
  loadDoc(facture.id);
  showNotifBanner('🧾', 'Facture créée', facture.num + ' depuis devis ' + devis.num);
}

// ============================================================
//  RECHERCHE GLOBALE
// ============================================================
function globalSearch(q) {
  var el = $('search-results');
  if (!el) return;
  q = (q || '').toLowerCase().trim();
  if (!q || q.length < 2) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:30px">Tape au moins 2 caractères…</div>';
    return;
  }
  var results = [];
  // Recherche dans les documents
  loadDocs().forEach(function(d) {
    var haystack = [d.num,d.cn,d.vm,d.vmo,d.vmot,d.vim,d.cv,d.type,d.statut].join(' ').toLowerCase();
    if (d.lines) d.lines.forEach(function(l){ haystack += ' ' + (l.label||'').toLowerCase(); });
    if (haystack.includes(q)) {
      results.push({ type:'doc', icon: d.type==='devis'?'📄':'🧾',
        title: d.num + ' — ' + (d.cn||'—'),
        sub: [d.type, fmtDate(d.date), fmt(d.ttc||0), d.statut].join(' · '),
        action: 'loadDoc(' + d.id + ')' });
    }
  });
  // Recherche dans les clients
  loadClients().forEach(function(cl) {
    var vehs = cl.vehs && cl.vehs.length ? cl.vehs : (cl.vm?[{vm:cl.vm,vmo:cl.vmo||'',vim:cl.vim||''}]:[]);
    var haystack = [cl.nom,cl.tel,cl.email,cl.ville].join(' ').toLowerCase();
    vehs.forEach(function(v){ haystack += ' ' + [v.vm,v.vmo,v.vmot,v.vim].join(' ').toLowerCase(); });
    if (haystack.includes(q)) {
      var vLabel = vehs.length ? vehs.map(function(v){return [v.vm,v.vmo].filter(Boolean).join(' ');}).join(', ') : '';
      results.push({ type:'client', icon:'👤',
        title: cl.nom,
        sub: (vLabel||'') + (cl.tel?' · '+cl.tel:''),
        action: 'showClientHistory(' + cl.id + ')' });
    }
  });
  // Recherche dans les RDVs
  loadRdvs().forEach(function(r) {
    var haystack = [r.title,r.lieu,r.notes].join(' ').toLowerCase();
    if (haystack.includes(q)) {
      results.push({ type:'rdv', icon:'📅',
        title: r.title,
        sub: fmtDate(r.date) + (r.heure?' à '+r.heure:'') + (r.lieu?' · '+r.lieu:''),
        action: 'showTab(\'agenda\')' });
    }
  });

  if (!results.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:30px">Aucun résultat pour "' + escHtml(q) + '"</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">' + results.length + ' résultat' + (results.length>1?'s':'') + '</div>'
    + results.map(function(r) {
      return '<div class="search-result-item" onclick="' + r.action + (r.type==='doc'?';showTab(\'form\')':'') + '">'
        + '<div class="search-result-icon">' + r.icon + '</div>'
        + '<div class="search-result-body">'
          + '<div class="search-result-title">' + escHtml(r.title) + '</div>'
          + '<div class="search-result-sub">' + escHtml(r.sub) + '</div>'
        + '</div>'
        + '<span style="color:var(--blue);font-size:16px">→</span>'
      + '</div>';
    }).join('');
}

function dashQuickSearch(q) {
  var res = $('dash-search-results');
  if (!q || q.length < 2) { res.style.display='none'; return; }
  res.style.display = 'block';
  globalSearch(q);
  res.innerHTML = $('search-results').innerHTML;
}

// ============================================================
//  HISTORIQUE CLIENT
// ============================================================
function showClientHistory(clientId) {
  var cl = loadClients().find(function(c){ return c.id === clientId; });
  if (!cl) return;
  var docs = loadDocs().filter(function(d){ return d.cn && d.cn.toLowerCase() === (cl.nom||'').toLowerCase(); });
  var rdvs = loadRdvs().filter(function(r){ return r.clientId === clientId; });

  $('client-history-title').textContent = '📋 ' + cl.nom;

  var vehs = cl.vehs && cl.vehs.length ? cl.vehs : (cl.vm?[{vm:cl.vm,vmo:cl.vmo||'',vmot:cl.vmot||'',van:cl.van||'',vim:cl.vim||''}]:[]);
  var vehsHTML = vehs.map(function(v){
    return '<span style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:3px 8px;font-size:11px;margin-right:4px">🚗 '+escHtml([v.vm,v.vmo,v.van?'('+v.van+')':''].filter(Boolean).join(' '))+'</span>';
  }).join('');

  var totalCA = docs.filter(function(d){return d.statut==='payé';}).reduce(function(s,d){return s+(d.ttc||0);},0);

  var html = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">'
    + (cl.tel?'<span style="font-size:13px;color:var(--text-dim)">📞 '+escHtml(cl.tel)+'</span>':'')
    + (cl.email?'<span style="font-size:13px;color:var(--text-dim)">✉️ '+escHtml(cl.email)+'</span>':'')
    + '</div>';
  if (vehsHTML) html += '<div style="margin-bottom:16px">' + vehsHTML + '</div>';
  html += '<div style="display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap">'
    + '<div style="background:var(--bg3);border-radius:8px;padding:10px 14px;text-align:center"><div style="font-family:var(--fh);font-size:20px;color:var(--blue)">' + docs.length + '</div><div style="font-size:10px;color:var(--text-muted)">Documents</div></div>'
    + '<div style="background:var(--bg3);border-radius:8px;padding:10px 14px;text-align:center"><div style="font-family:var(--fh);font-size:20px;color:var(--green)">' + fmt(totalCA) + '</div><div style="font-size:10px;color:var(--text-muted)">CA total</div></div>'
    + '<div style="background:var(--bg3);border-radius:8px;padding:10px 14px;text-align:center"><div style="font-family:var(--fh);font-size:20px;color:var(--orange)">' + rdvs.length + '</div><div style="font-size:10px;color:var(--text-muted)">RDVs</div></div>'
    + '</div>';

  if (docs.length) {
    html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:8px">Documents</div>';
    html += docs.map(function(d) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        + '<span class="badge ' + (d.type==='devis'?'b-devis':'b-facture') + '">' + d.type + '</span>'
        + '<span class="doc-num">' + d.num + '</span>'
        + '<span style="font-size:12px;color:var(--text-dim)">' + fmtDate(d.date) + '</span>'
        + '<span style="flex:1;font-size:12px;color:var(--text-dim)">' + (d.lines||[]).map(function(l){return l.label?l.label.split(' — ')[0]:'';}).filter(Boolean).slice(0,2).join(', ') + '</span>'
        + '<span style="font-family:var(--fm);color:var(--blue);font-size:13px">' + fmt(d.ttc||0) + '</span>'
        + '<button class="btn-s btn-sm" onclick="loadDoc('+d.id+');$(' + "'client-history-modal'" + ').classList.remove(' + "'open'" + ')">✏️</button>'
        + '</div>';
    }).join('');
  } else {
    html += '<div style="color:var(--text-muted);font-size:13px">Aucun document trouvé pour ce client.</div>';
  }

  $('client-history-content').innerHTML = html;
  $('client-history-modal').classList.add('open');
}

// Bouton historique depuis le carnet
function clientHistoryBtn(id) { showClientHistory(id); }

// ============================================================
//  STATISTIQUES
// ============================================================
function renderStats() {
  var period = parseInt($('stats-period') ? $('stats-period').value : '6') || 0;
  var docs = loadDocs();
  var now = new Date();

  // Filtrer par période
  if (period > 0) {
    var cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - period);
    docs = docs.filter(function(d){ return new Date(d.date) >= cutoff; });
  }

  var factures = docs.filter(function(d){ return d.type==='facture'; });
  var devis = docs.filter(function(d){ return d.type==='devis'; });
  var payees = factures.filter(function(d){ return d.statut==='payé'; });
  var caTotal = payees.reduce(function(s,d){ return s+(d.ttc||0); }, 0);
  var caAttente = factures.filter(function(d){ return d.statut!=='payé'&&d.statut!=='annulé'; }).reduce(function(s,d){ return s+(d.ttc||0); }, 0);
  var convRate = devis.length > 0 ? Math.round((factures.length / devis.length) * 100) : 0;
  var panierMoyen = payees.length > 0 ? caTotal / payees.length : 0;

  // KPIs
  // Calcul frais et marge sur les docs filtrés
  var totalFrais = docs.reduce(function(s,d){ return s + (d.fraisTotal || calcFraisTotal(d.frais||{})); }, 0);
  var margeNette = caTotal - totalFrais;
  var nbDeclare  = docs.filter(function(d){ return d.declare !== false; }).length;
  var nbNonDecl  = docs.filter(function(d){ return d.declare === false; }).length;

  var kpis = $('stats-kpis');
  if (kpis) kpis.innerHTML = [
    { val: fmt(caTotal),     lbl: 'CA encaissé' },
    { val: fmt(caAttente),   lbl: 'En attente' },
    { val: fmt(totalFrais),  lbl: 'Frais totaux' },
    { val: fmt(margeNette),  lbl: 'Marge nette', color: margeNette >= 0 ? 'var(--green)' : 'var(--red)' },
    { val: convRate + '%',   lbl: 'Taux conversion' },
    { val: fmt(panierMoyen), lbl: 'Panier moyen' },
    { val: nbDeclare + '',   lbl: 'Déclarés', color: 'var(--green)' },
    { val: nbNonDecl + '',   lbl: 'Non déclarés', color: nbNonDecl > 0 ? 'var(--orange)' : 'var(--text-dim)' },
    { val: fmt(caTotal * 0.226), lbl: 'Cotis. estimées (22,6%)' },
  ].map(function(k) {
    return '<div class="kpi-item"><div class="kpi-val" style="color:'+(k.color||'var(--blue)')+'">'+k.val+'</div><div class="kpi-lbl">'+k.lbl+'</div></div>';
  }).join('');

  // Graphique CA par mois
  var mois6 = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now);
    d.setMonth(d.getMonth() - i);
    mois6.push({ y: d.getFullYear(), m: d.getMonth(), lbl: ['Jan','Fév','Mar','Avr','Mai','Jui','Jul','Aoû','Sep','Oct','Nov','Déc'][d.getMonth()] });
  }
  var allDocs = loadDocs();
  var maxCA = 0;
  var maxDocs = 0;
  var moisData = mois6.map(function(mo) {
    var moFacts = allDocs.filter(function(d){ return d.type==='facture' && d.statut==='payé' && new Date(d.date).getFullYear()===mo.y && new Date(d.date).getMonth()===mo.m; });
    var moAll = allDocs.filter(function(d){ return new Date(d.date).getFullYear()===mo.y && new Date(d.date).getMonth()===mo.m; });
    var ca = moFacts.reduce(function(s,d){ return s+(d.ttc||0); }, 0);
    if (ca > maxCA) maxCA = ca;
    if (moAll.length > maxDocs) maxDocs = moAll.length;
    return { lbl: mo.lbl, ca: ca, cnt: moAll.length };
  });

  var chartCA = $('chart-ca');
  if (chartCA) chartCA.innerHTML = moisData.map(function(mo) {
    var h = maxCA > 0 ? Math.max(4, Math.round((mo.ca / maxCA) * 90)) : 4;
    return '<div class="bar-col"><div class="bar-val">' + (mo.ca>0?Math.round(mo.ca)+'€':'') + '</div><div class="bar-fill" style="height:'+h+'px;background:var(--blue)"></div><div class="bar-label">' + mo.lbl + '</div></div>';
  }).join('');

  var chartDocs = $('chart-docs');
  if (chartDocs) chartDocs.innerHTML = moisData.map(function(mo) {
    var h = maxDocs > 0 ? Math.max(4, Math.round((mo.cnt / maxDocs) * 90)) : 4;
    return '<div class="bar-col"><div class="bar-val">' + (mo.cnt>0?mo.cnt:'') + '</div><div class="bar-fill" style="height:'+h+'px;background:var(--green)"></div><div class="bar-label">' + mo.lbl + '</div></div>';
  }).join('');

  // Prestations les plus vendues
  var prestCount = {};
  allDocs.forEach(function(d) {
    (d.lines||[]).forEach(function(l) {
      if (!l.label || l.offert) return;
      var key = l.label.split(' — ')[0].split(' · ')[0];
      prestCount[key] = (prestCount[key]||0) + 1;
    });
  });
  var topPrests = Object.keys(prestCount).sort(function(a,b){ return prestCount[b]-prestCount[a]; }).slice(0,6);
  var maxP = topPrests.length ? prestCount[topPrests[0]] : 1;
  var chartP = $('chart-prestations');
  if (chartP) chartP.innerHTML = topPrests.length ? topPrests.map(function(p) {
    var pct = Math.round((prestCount[p]/maxP)*100);
    return '<div style="margin-bottom:10px">'
      + '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:var(--text)">' + escHtml(p) + '</span><span style="color:var(--text-dim)">' + prestCount[p] + 'x</span></div>'
      + '<div style="height:6px;background:var(--bg3);border-radius:3px"><div style="height:100%;width:'+pct+'%;background:var(--blue);border-radius:3px"></div></div>'
    + '</div>';
  }).join('') : '<div style="color:var(--text-muted);font-size:13px">Pas encore de données.</div>';

  // Taux conversion
  var convEl = $('chart-conversion');
  if (convEl) convEl.innerHTML = '<div style="text-align:center">'
    + '<div style="font-family:var(--fh);font-size:48px;font-weight:700;color:' + (convRate>=50?'var(--green)':'var(--orange)') + '">' + convRate + '%</div>'
    + '<div style="color:var(--text-dim);font-size:13px;margin-top:4px">' + devis.length + ' devis → ' + factures.length + ' factures</div>'
    + '<div style="margin-top:16px;height:8px;background:var(--bg3);border-radius:4px"><div style="height:100%;width:'+Math.min(convRate,100)+'%;background:' + (convRate>=50?'var(--green)':'var(--orange)') + ';border-radius:4px"></div></div>'
  + '</div>';
}

// ============================================================
//  EXPORT CSV
// ============================================================
function exportCSV() {
  var docs = loadDocs();
  var rows = [['Numéro','Type','Date','Client','Véhicule','Immat','Montant HT','TVA','Montant TTC','Statut','Déclaré','Frais Total','Km','Carburant','Matériel','Péages','Repas','Marge Nette','Prestations']];
  docs.forEach(function(d) {
    var prests = (d.lines||[]).map(function(l){ return l.label?l.label.split(' — ')[0]:''; }).filter(Boolean).join(' | ');
    var fr = d.frais || {};
    var frTotal = d.fraisTotal || calcFraisTotal(fr);
    var marge = (d.ttc||0) - frTotal;
    rows.push([
      d.num||'', d.type||'', d.date||'', d.cn||'',
      [d.vm,d.vmo].filter(Boolean).join(' '), d.vim||'',
      (d.ht||0).toFixed(2), (d.tva||0).toFixed(2), (d.ttc||0).toFixed(2),
      d.statut||'',
      d.declare === false ? 'Non déclaré' : 'Déclaré',
      frTotal.toFixed(2),
      (fr['km']||0) + ' km',
      (fr['carburant']||0).toFixed(2),
      ((fr['materiel']||0)+(fr['consommables']||0)).toFixed(2),
      ((fr['peages']||0)+(fr['parking']||0)).toFixed(2),
      ((fr['repas']||0)+(fr['hebergement']||0)).toFixed(2),
      marge.toFixed(2),
      prests
    ]);
  });
  var csv = rows.map(function(r){
    return r.map(function(cell){ return '"' + String(cell).replace(/"/g,'""') + '"'; }).join(';');
  }).join('\n');
  var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'AREPROG_export_' + today() + '.csv';
  a.click();
  showNotifBanner('⬇', 'Export CSV', docs.length + ' documents exportés');
}

// ============================================================
//  TABS (complet)
// ============================================================
function showTab(t) {
  ['dash','form','liste','carnet','template','services','agenda','stats','search'].forEach(function(x){ var el=$('t-'+x); if(el) el.classList.toggle('on',x===t); });
  document.querySelectorAll('.nb').forEach(function(b,i){ b.classList.toggle('on',['dash','form','liste','carnet','template','services','agenda','stats','search'][i]===t); });
  if(t==='dash')     renderDash();
  if(t==='liste')    renderListe();
  if(t==='carnet')   renderCarnet();
  if(t==='template') { fillTplForm(loadTemplate()); livePreview(); }
  if(t==='services') renderCatEditor();
  if(t==='agenda')   renderAgenda();
  if(t==='stats')    renderStats();
  if(t==='search')   { $('global-search').value=''; $('search-results').innerHTML='<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:30px">Tape pour rechercher…</div>'; setTimeout(function(){ $('global-search').focus(); }, 100); }
}

// ══════════════════════════════════════════════════════════════
//  AUTO-SAVE DU FORMULAIRE
// ══════════════════════════════════════════════════════════════
var AUTOSAVE_KEY  = 'ar_form_draft';
var _autoSaveTimer = null;
var _lastSavedHash = '';

function getFormHash() {
  // Hash simple pour détecter les changements
  var obj = buildObj();
  return JSON.stringify(obj.lines) + obj.cn + obj.type + obj.notes + (obj.gains||'');
}

function triggerAutoSave() {
  clearTimeout(_autoSaveTimer);
  setAutoSaveStatus('saving');
  _autoSaveTimer = setTimeout(function() {
    var hash = getFormHash();
    if (hash === _lastSavedHash) { setAutoSaveStatus('saved'); return; }
    try {
      var draft = buildObj();
      draft._isDraft = true;
      draft._savedAt = Date.now();
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
      _lastSavedHash = hash;
      setAutoSaveStatus('saved');
    } catch(e) {
      console.warn('Auto-save error:', e);
    }
  }, 800);
}

function setAutoSaveStatus(status) {
  var bar = $('autosave-bar');
  var lbl = $('autosave-label');
  if (!bar || !lbl) return;
  bar.className = 'autosave-bar ' + status;
  if (status === 'saving') lbl.textContent = 'Sauvegarde…';
  else if (status === 'saved') lbl.textContent = 'Brouillon sauvegardé';
  else if (status === 'restored') lbl.textContent = 'Brouillon restauré ↺';
  else lbl.textContent = 'Prêt';
}

function checkAndRestoreDraft() {
  var raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return;
  try {
    var draft = JSON.parse(raw);
    if (!draft._isDraft || !draft.lines || !draft.lines.length) return;
    var age = Date.now() - (draft._savedAt || 0);
    if (age > 24 * 3600000) { // Ignorer les drafts > 24h
      localStorage.removeItem(AUTOSAVE_KEY);
      return;
    }
    var mins = Math.round(age / 60000);
    var ageLabel = mins < 1 ? 'il y a moins d\'1 min' : 'il y a ' + mins + ' min';
    if (confirm('Un brouillon non enregistré a été trouvé (' + ageLabel + '). Voulez-vous le restaurer ?')) {
      loadDocData(draft);
      setAutoSaveStatus('restored');
      showNotifBanner('↺', 'Brouillon restauré', draft.cn || 'Document sans client');
    } else {
      localStorage.removeItem(AUTOSAVE_KEY);
    }
  } catch(e) {}
}

function clearDraft() {
  localStorage.removeItem(AUTOSAVE_KEY);
  _lastSavedHash = '';
  setAutoSaveStatus('');
}

// ══════════════════════════════════════════════════════════════
//  FILTRES AVANCÉS LISTE
// ══════════════════════════════════════════════════════════════
var _currentListeFilter = '';
var _currentStatutFilter = '';

function setListeFilter(type, btn) {
  _currentListeFilter = type;
  _currentStatutFilter = '';
  // Reset tous les chips statut
  ['envoye','accepte','paye','impaye'].forEach(function(s) {
    var chip = $('fchip-'+s);
    if (chip) chip.className = 'filter-chip';
  });
  // Activer le bon chip type
  ['all','devis','facture'].forEach(function(t) {
    var chip = $('fchip-'+t);
    if (chip) chip.className = 'filter-chip' + (t === (type||'all') ? ' active' : '');
  });
  if ($('flt')) $('flt').value = type;
  if ($('flt-statut')) $('flt-statut').value = '';
  renderListe();
}

function setStatutFilter(statut, btn) {
  var isActive = _currentStatutFilter === statut;
  _currentStatutFilter = isActive ? '' : statut;
  _currentListeFilter = '';
  // Reset chips type
  ['all','devis','facture'].forEach(function(t) {
    var chip = $('fchip-'+t);
    if (chip) chip.className = 'filter-chip' + (t === 'all' ? ' active' : '');
  });
  // Activer/désactiver chip statut
  var colorMap = { 'envoyé':'', 'accepté':'active', 'payé':'active-green', 'impayé':'active-red active-orange' };
  ['envoye','accepte','paye','impaye'].forEach(function(s) {
    var chipStatut = { 'envoye':'envoyé', 'accepte':'accepté', 'paye':'payé', 'impaye':'impayé' }[s];
    var chip = $('fchip-'+s);
    if (!chip) return;
    if (chipStatut === _currentStatutFilter) {
      chip.className = 'filter-chip ' + (colorMap[chipStatut] || 'active');
    } else {
      chip.className = 'filter-chip';
    }
  });
  if ($('flt')) $('flt').value = '';
  if ($('flt-statut')) $('flt-statut').value = _currentStatutFilter;
  renderListe();
}

function updateListeFilterCounts() {
  var all = loadDocs();
  var cnt = function(fn) { return all.filter(fn).length; };
  [
    ['fcount-all',    function(){ return true; }],
    ['fcount-devis',  function(d){ return d.type==='devis'; }],
    ['fcount-facture',function(d){ return d.type==='facture'; }],
  ].forEach(function(pair) {
    var el = $(pair[0]);
    if (el) el.textContent = cnt(pair[1]);
  });
}

// ══════════════════════════════════════════════════════════════
//  SYNC RDVS EN TEMPS RÉEL (Firebase onSnapshot)
// ══════════════════════════════════════════════════════════════
function startRdvsRealtimeSync() {
  if (!db || !syncOk) return;
  // Remplacer le one-shot get par un listener temps réel
  db.collection('rdvs').doc('all').onSnapshot(function(doc) {
    if (doc.exists && doc.data().rdvs) {
      localStorage.setItem(RDV_KEY, JSON.stringify(doc.data().rdvs));
      // Rafraîchir l'agenda si ouvert
      if ($('t-agenda') && $('t-agenda').classList.contains('on')) {
        renderCalendar();
        renderSideEvents(calSelected);
      }
      // Reprogrammer les rappels : annuler tous les timers et relancer
      // (les rdvs peuvent avoir été modifiés depuis un autre appareil)
      cancelAllRdvTimers();
      doc.data().rdvs.forEach(function(r){ scheduleRdvNotif(r); });
      runRappelCheck();
    }
  }, function(err) {
    console.warn('RDV realtime sync error:', err);
  });
}

// ══════════════════════════════════════════════════════════════
//  RACCOURCIS CLAVIER
// ══════════════════════════════════════════════════════════════
var _gKeyPressed = false;
var _gKeyTimer = null;

function initKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    // Ignorer si dans un input/textarea/select
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    // Ignorer si modal ouverte (sauf Echap)
    var modalOpen = document.querySelector('.rdv-modal.open, .olsx-modal.open, .wa-modal.open');

    var key = e.key;
    var ctrl = e.ctrlKey || e.metaKey;

    // Fermer modaux avec Echap
    if (key === 'Escape') {
      document.querySelectorAll('.rdv-modal.open, .olsx-modal.open, .shortcuts-modal.open, .client-history-modal.open').forEach(function(m) {
        m.classList.remove('open');
      });
      return;
    }

    if (modalOpen) return;

    // Ctrl+S — Sauvegarder
    if (ctrl && key === 's') {
      e.preventDefault();
      if ($('t-form') && $('t-form').classList.contains('on')) {
        saveDoc();
        showNotifBanner('💾', 'Sauvegardé', 'Document enregistré');
      }
      return;
    }
    // Ctrl+P — Aperçu/Imprimer
    if (ctrl && key === 'p') {
      e.preventDefault();
      if ($('t-form') && $('t-form').classList.contains('on')) printDoc();
      return;
    }
    // Ctrl+E — Envoyer par email
    if (ctrl && (key === 'e' || key === 'E')) {
      e.preventDefault();
      if ($('t-form') && $('t-form').classList.contains('on')) {
        openPreview();
        setTimeout(sendDocByEmail, 300);
      }
      return;
    }
    // Ctrl+K — Recherche globale
    if (ctrl && key === 'k') {
      e.preventDefault();
      showTab('search');
      setTimeout(function(){ $('global-search') && $('global-search').focus(); }, 100);
      return;
    }
    // Ctrl++ — Ajouter une ligne prestation
    if (ctrl && (key === '+' || key === '=')) {
      e.preventDefault();
      if ($('t-form') && $('t-form').classList.contains('on')) addLine();
      return;
    }
    // ? — Raccourcis
    if (key === '?') {
      $('shortcuts-modal').classList.add('open');
      return;
    }
    // N — Nouveau devis
    if (key === 'n' || key === 'N') {
      newDoc();
      return;
    }
    // Navigation G+lettre (type Gmail)
    if (key === 'g' || key === 'G') {
      _gKeyPressed = true;
      clearTimeout(_gKeyTimer);
      _gKeyTimer = setTimeout(function(){ _gKeyPressed = false; }, 1500);
      return;
    }
    if (_gKeyPressed) {
      _gKeyPressed = false;
      clearTimeout(_gKeyTimer);
      var navMap = {
        'd': 'dash', 'D': 'dash',
        'l': 'liste', 'L': 'liste',
        'c': 'carnet', 'C': 'carnet',
        'a': 'agenda', 'A': 'agenda',
        's': 'stats', 'S': 'stats',
      };
      if (navMap[key]) { showTab(navMap[key]); return; }
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  DÉCLARATION FISCALE
// ══════════════════════════════════════════════════════════════
function setDeclaration(declared) {
  var hdField = $('f-declare');
  if (hdField) hdField.value = declared ? 'true' : 'false';
  var btnOui = $('decl-oui');
  var btnNon = $('decl-non');
  if (btnOui) btnOui.className = 'decl-btn' + (declared ? ' active-decl' : '');
  if (btnNon) btnNon.className = 'decl-btn' + (!declared ? ' active-non' : '');
  onFormChange();
}

function getDeclaration() {
  var hdField = $('f-declare');
  return !hdField || hdField.value !== 'false';
}

function resetDeclaration() {
  setDeclaration(true);
}

// ══════════════════════════════════════════════════════════════
//  FRAIS
// ══════════════════════════════════════════════════════════════
var FRAIS_FIELDS = ['km','taux-km','carburant','materiel','consommables','peages','parking','repas','hebergement'];

function getFraisObj() {
  var obj = {};
  FRAIS_FIELDS.forEach(function(f) {
    var el = $('f-' + f);
    obj[f] = el ? (parseFloat(el.value) || 0) : 0;
  });
  return obj;
}

function calcFraisTotal(frais) {
  frais = frais || getFraisObj();
  var depl = (frais['km'] || 0) * (frais['taux-km'] || 0.40) + (frais['carburant'] || 0);
  var mat  = (frais['materiel'] || 0) + (frais['consommables'] || 0);
  var road = (frais['peages'] || 0) + (frais['parking'] || 0);
  var food = (frais['repas'] || 0) + (frais['hebergement'] || 0);
  return depl + mat + road + food;
}

function calcFrais() {
  var frais = getFraisObj();
  var total = calcFraisTotal(frais);
  // Afficher le total
  var dispEl = $('frais-total-display');
  if (dispEl) dispEl.textContent = fmt(total);
  // Calculer la marge nette
  var ttc = parseFloat(($('t-ttc') ? $('t-ttc').textContent : '0').replace(',','.').replace(' €','').replace(' ','')) || 0;
  var marge = ttc - total;
  var margeEl = $('frais-marge-val');
  if (margeEl) {
    margeEl.textContent = fmt(marge);
    margeEl.className = 'frais-marge-val ' + (marge >= 0 ? 'marge-pos' : 'marge-neg');
  }
  onFormChange();
}

function resetFrais() {
  FRAIS_FIELDS.forEach(function(f) {
    var el = $('f-' + f);
    if (!el) return;
    if (f === 'taux-km') { el.value = '0.40'; return; }
    el.value = '';
  });
  calcFrais();
}

function loadFrais(frais) {
  if (!frais) { resetFrais(); return; }
  FRAIS_FIELDS.forEach(function(f) {
    var el = $('f-' + f);
    if (!el) return;
    if (frais[f] !== undefined && frais[f] !== 0) {
      el.value = frais[f];
    } else if (f === 'taux-km') {
      el.value = frais[f] || '0.40';
    } else {
      el.value = '';
    }
  });
  calcFrais();
}
