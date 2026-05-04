// ============================================================
// 06-fiscal.js — Onglet Fiscalité dédié (URSSAF trimestriel + seuils)
// ============================================================

// Paramètres fiscaux 2025 — micro-entrepreneur services BIC
// Modifiables par l'utilisateur dans l'UI (stockés en localStorage)
var FISCAL_KEY = 'ar_fiscal_params';
var FISCAL_DEFAULT = {
  regime: 'services_bic',  // 'vente' | 'services_bic' | 'services_bnc'
  taux_urssaf: 21.2,       // % URSSAF 2025 services BIC
  versement_lib: false,    // versement libératoire IR
  taux_lib: 1.7,           // % IR libératoire services BIC
  seuil_tva: 37500,        // € franchise TVA services 2024-2025
  seuil_tva_maj: 41250,    // € seuil majoré TVA services 2024-2025
  seuil_micro: 77700,      // € plafond micro services 2024-2025
};
function loadFiscalParams() {
  try {
    var raw = localStorage.getItem(FISCAL_KEY);
    return raw ? Object.assign({}, FISCAL_DEFAULT, JSON.parse(raw)) : Object.assign({}, FISCAL_DEFAULT);
  } catch(e) { return Object.assign({}, FISCAL_DEFAULT); }
}
function saveFiscalParams(p) {
  localStorage.setItem(FISCAL_KEY, JSON.stringify(p));
}

// Année actuellement affichée (par défaut année courante)
var fiscalYear = new Date().getFullYear();

// ── Calculs ─────────────────────────────────────────────────
// Retourne {q1, q2, q3, q4, total} en CA encaissé (factures payées + déclarées)
// pour une année donnée
function calcQuarters(year) {
  var docs = loadDocs();
  var quarters = { q1: 0, q2: 0, q3: 0, q4: 0, total: 0, byQ: [[],[],[],[]] };
  docs.forEach(function(d) {
    if (d.type !== 'facture' || d.statut !== 'payé') return;
    if (d.declare === false) return; // skip non déclaré
    var dt = new Date(d.date);
    if (dt.getFullYear() !== year) return;
    var q = Math.floor(dt.getMonth() / 3); // 0,1,2,3
    var ttc = d.ttc || 0;
    quarters[['q1','q2','q3','q4'][q]] += ttc;
    quarters.byQ[q].push(d);
    quarters.total += ttc;
  });
  return quarters;
}

// CA non déclaré (informatif, hors URSSAF)
function calcNonDeclared(year) {
  var total = 0;
  loadDocs().forEach(function(d) {
    if (d.type !== 'facture' || d.statut !== 'payé') return;
    if (d.declare !== false) return;
    var dt = new Date(d.date);
    if (dt.getFullYear() !== year) return;
    total += d.ttc || 0;
  });
  return total;
}

// ── Rendu principal ─────────────────────────────────────────
function renderFiscal() {
  var el = $('t-fiscal');
  if (!el) return;
  var params = loadFiscalParams();
  var quarters = calcQuarters(fiscalYear);
  var quartersPrev = calcQuarters(fiscalYear - 1);
  var nonDecl = calcNonDeclared(fiscalYear);

  var urssafTotal = quarters.total * params.taux_urssaf / 100;
  var libTotal = params.versement_lib ? quarters.total * params.taux_lib / 100 : 0;
  var netAnnuel = quarters.total - urssafTotal - libTotal;

  // Comparaison N-1
  var diffPct = quartersPrev.total > 0
    ? Math.round(((quarters.total - quartersPrev.total) / quartersPrev.total) * 100)
    : null;

  // Seuils
  var pctTva = Math.min(100, Math.round((quarters.total / params.seuil_tva) * 100));
  var pctTvaMaj = Math.min(100, Math.round((quarters.total / params.seuil_tva_maj) * 100));
  var pctMicro = Math.min(100, Math.round((quarters.total / params.seuil_micro) * 100));

  // Couleurs alertes
  var tvaColor = pctTva >= 100 ? 'var(--red)' : pctTva >= 80 ? 'var(--orange)' : 'var(--green)';
  var microColor = pctMicro >= 100 ? 'var(--red)' : pctMicro >= 80 ? 'var(--orange)' : 'var(--green)';

  var quarterNow = Math.floor(new Date().getMonth() / 3);
  var quarterLabels = ['T1 (Janv-Mars)', 'T2 (Avr-Juin)', 'T3 (Juil-Sept)', 'T4 (Oct-Déc)'];

  el.innerHTML =
    '<div class="sh">'
      + '<div class="sh-title">💰 Fiscalité — Récap URSSAF</div>'
      + '<div class="sh-actions">'
        + '<button class="btn-s" onclick="fiscalPrevYear()">‹ ' + (fiscalYear-1) + '</button>'
        + '<select id="fiscal-year-sel" onchange="fiscalSetYear(this.value)" style="padding:7px 10px;background:var(--bg3);border:1px solid var(--border-blue);border-radius:7px;color:var(--blue);font-weight:700;font-size:14px">'
          + buildYearOptions(fiscalYear) + '</select>'
        + '<button class="btn-s" onclick="fiscalNextYear()">' + (fiscalYear+1) + ' ›</button>'
        + '<button class="btn-s" onclick="openFiscalParams()">⚙️ Paramètres</button>'
        + '<button class="btn-p" onclick="exportFiscalCSV()">⬇ Export CSV</button>'
      + '</div>'
    + '</div>'

    // KPIs principaux
    + '<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">'
      + kpiCard('CA encaissé déclaré', fmt(quarters.total), 'var(--blue)',
          diffPct !== null ? (diffPct >= 0 ? '+' : '') + diffPct + '% vs ' + (fiscalYear-1) : 'pas de données ' + (fiscalYear-1))
      + kpiCard('Cotisations URSSAF', fmt(urssafTotal), 'var(--orange)', params.taux_urssaf + '% du CA')
      + (params.versement_lib
          ? kpiCard('IR libératoire', fmt(libTotal), 'var(--orange)', params.taux_lib + '% du CA')
          : kpiCard('Non déclaré', fmt(nonDecl), 'var(--text-muted)', 'Hors URSSAF'))
      + kpiCard('Revenu net estimé', fmt(netAnnuel), netAnnuel >= 0 ? 'var(--green)' : 'var(--red)', 'Après cotisations')
    + '</div>'

    // Tableau trimestriel
    + '<div class="card" style="margin-bottom:20px">'
      + '<div class="card-title">Récap trimestriel ' + fiscalYear + '</div>'
      + '<table class="dt" style="width:100%">'
        + '<thead><tr>'
          + '<th>Trimestre</th>'
          + '<th style="text-align:right">CA encaissé</th>'
          + '<th style="text-align:right">URSSAF (' + params.taux_urssaf + '%)</th>'
          + (params.versement_lib ? '<th style="text-align:right">IR (' + params.taux_lib + '%)</th>' : '')
          + '<th style="text-align:right">Net après cotis.</th>'
          + '<th style="text-align:center">Statut</th>'
          + '<th style="width:60px"></th>'
        + '</tr></thead>'
        + '<tbody>'
        + [0,1,2,3].map(function(q) {
          var ca = quarters[['q1','q2','q3','q4'][q]];
          var urssaf = ca * params.taux_urssaf / 100;
          var lib = params.versement_lib ? ca * params.taux_lib / 100 : 0;
          var net = ca - urssaf - lib;
          var nbDocs = quarters.byQ[q].length;
          var isPast = q < quarterNow || fiscalYear < new Date().getFullYear();
          var isCurrent = q === quarterNow && fiscalYear === new Date().getFullYear();
          var statusBadge = isCurrent
            ? '<span class="badge b-acompte">⏱ En cours</span>'
            : isPast
              ? '<span class="badge b-paye">✓ Clôturé</span>'
              : '<span class="badge" style="background:rgba(255,255,255,.05);color:var(--text-muted)">À venir</span>';
          var rowStyle = isCurrent ? ' style="background:rgba(30,144,255,.04)"' : '';
          return '<tr' + rowStyle + '>'
            + '<td><strong>' + quarterLabels[q] + '</strong>'
              + (nbDocs > 0 ? '<br><span style="color:var(--text-muted);font-size:11px">' + nbDocs + ' facture' + (nbDocs>1?'s':'') + '</span>' : '')
            + '</td>'
            + '<td style="text-align:right;font-family:var(--fm);color:var(--blue)"><strong>' + fmt(ca) + '</strong></td>'
            + '<td style="text-align:right;font-family:var(--fm);color:var(--orange)">' + fmt(urssaf) + '</td>'
            + (params.versement_lib ? '<td style="text-align:right;font-family:var(--fm);color:var(--orange)">' + fmt(lib) + '</td>' : '')
            + '<td style="text-align:right;font-family:var(--fm);color:var(--green)"><strong>' + fmt(net) + '</strong></td>'
            + '<td style="text-align:center">' + statusBadge + '</td>'
            + '<td style="text-align:right">' + (nbDocs > 0 ? '<button class="btn-s btn-sm" onclick="showFiscalQuarter(' + q + ',' + fiscalYear + ')">📋</button>' : '') + '</td>'
          + '</tr>';
        }).join('')
        + '<tr style="border-top:2px solid var(--border-blue);font-weight:700;background:rgba(30,144,255,.03)">'
          + '<td>TOTAL ' + fiscalYear + '</td>'
          + '<td style="text-align:right;font-family:var(--fm);color:var(--blue);font-size:16px">' + fmt(quarters.total) + '</td>'
          + '<td style="text-align:right;font-family:var(--fm);color:var(--orange);font-size:16px">' + fmt(urssafTotal) + '</td>'
          + (params.versement_lib ? '<td style="text-align:right;font-family:var(--fm);color:var(--orange);font-size:16px">' + fmt(libTotal) + '</td>' : '')
          + '<td style="text-align:right;font-family:var(--fm);color:var(--green);font-size:16px">' + fmt(netAnnuel) + '</td>'
          + '<td colspan="2"></td>'
        + '</tr>'
        + '</tbody></table>'
      + (nonDecl > 0
          ? '<div style="margin-top:14px;padding:10px 14px;background:rgba(245,158,11,.08);border-left:3px solid var(--orange);border-radius:6px;font-size:13px;color:var(--orange)">'
            + '⚠️ <strong>' + fmt(nonDecl) + '</strong> de CA non déclaré sur l\'année ' + fiscalYear + ' (factures payées marquées "Non déclaré"). Non inclus dans le récap URSSAF.'
            + '</div>'
          : '')
    + '</div>'

    // Seuils & alertes
    + '<div class="fg2" style="margin-bottom:20px">'
      + '<div class="card">'
        + '<div class="card-title">Franchise TVA <span style="color:' + tvaColor + ';font-weight:700">' + pctTva + '%</span></div>'
        + progressBar(pctTva, tvaColor)
        + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-top:6px">'
          + '<span>' + fmt(quarters.total) + ' encaissé</span>'
          + '<span>Seuil : ' + fmt(params.seuil_tva) + '</span>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5">'
          + 'En 2025 (services) : franchise basique <strong>' + fmt(params.seuil_tva) + '</strong>, seuil majoré <strong>' + fmt(params.seuil_tva_maj) + '</strong>.<br>'
          + 'Au-delà → assujetti à la TVA dès le 1er € du dépassement.'
        + '</div>'
        + (pctTva >= 80 ? '<div style="margin-top:10px;padding:8px 12px;background:rgba(' + (pctTva>=100?'239,68,68':'245,158,11') + ',.1);border-radius:6px;font-size:12px;color:' + tvaColor + ';font-weight:600">⚠️ ' + (pctTva >= 100 ? 'Seuil dépassé !' : 'Approche du seuil — anticipe la TVA') + '</div>' : '')
      + '</div>'
      + '<div class="card">'
        + '<div class="card-title">Plafond micro-entreprise <span style="color:' + microColor + ';font-weight:700">' + pctMicro + '%</span></div>'
        + progressBar(pctMicro, microColor)
        + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-top:6px">'
          + '<span>' + fmt(quarters.total) + ' encaissé</span>'
          + '<span>Plafond : ' + fmt(params.seuil_micro) + '</span>'
        + '</div>'
        + '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;line-height:1.5">'
          + 'Plafond services 2024-2025 : <strong>' + fmt(params.seuil_micro) + '</strong>.<br>'
          + 'Dépassé 2 années consécutives → sortie du régime micro l\'année suivante.'
        + '</div>'
        + (pctMicro >= 80 ? '<div style="margin-top:10px;padding:8px 12px;background:rgba(' + (pctMicro>=100?'239,68,68':'245,158,11') + ',.1);border-radius:6px;font-size:12px;color:' + microColor + ';font-weight:600">⚠️ ' + (pctMicro >= 100 ? 'Plafond dépassé' : 'Approche du plafond') + '</div>' : '')
      + '</div>'
    + '</div>'

    // Comparaison annuelle N vs N-1
    + '<div class="card">'
      + '<div class="card-title">Comparaison ' + fiscalYear + ' vs ' + (fiscalYear-1) + '</div>'
      + '<table class="dt" style="width:100%">'
        + '<thead><tr><th>Trimestre</th><th style="text-align:right">' + (fiscalYear-1) + '</th><th style="text-align:right">' + fiscalYear + '</th><th style="text-align:right">Évolution</th></tr></thead>'
        + '<tbody>'
        + [0,1,2,3].map(function(q) {
          var k = ['q1','q2','q3','q4'][q];
          var prev = quartersPrev[k];
          var curr = quarters[k];
          var diff = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : (curr > 0 ? 100 : 0);
          var color = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-dim)';
          return '<tr>'
            + '<td>' + quarterLabels[q] + '</td>'
            + '<td style="text-align:right;font-family:var(--fm);color:var(--text-dim)">' + fmt(prev) + '</td>'
            + '<td style="text-align:right;font-family:var(--fm)">' + fmt(curr) + '</td>'
            + '<td style="text-align:right;color:' + color + ';font-weight:600">'
              + (prev > 0 ? (diff >= 0 ? '+' : '') + diff + '%' : (curr > 0 ? 'nouveau' : '—'))
            + '</td>'
          + '</tr>';
        }).join('')
        + '<tr style="border-top:1px solid var(--border-blue);font-weight:700">'
          + '<td>TOTAL</td>'
          + '<td style="text-align:right;font-family:var(--fm);color:var(--text-dim)">' + fmt(quartersPrev.total) + '</td>'
          + '<td style="text-align:right;font-family:var(--fm);color:var(--blue)">' + fmt(quarters.total) + '</td>'
          + '<td style="text-align:right;color:' + (diffPct !== null && diffPct > 0 ? 'var(--green)' : diffPct !== null && diffPct < 0 ? 'var(--red)' : 'var(--text-dim)') + ';font-weight:700">'
            + (diffPct !== null ? (diffPct >= 0 ? '+' : '') + diffPct + '%' : '—')
          + '</td>'
        + '</tr>'
        + '</tbody></table>'
    + '</div>';
}

function kpiCard(label, val, color, sub) {
  return '<div class="kpi-item" style="padding:14px">'
    + '<div class="kpi-val" style="color:' + color + ';font-size:22px">' + val + '</div>'
    + '<div class="kpi-lbl">' + label + '</div>'
    + (sub ? '<div style="font-size:10px;color:var(--text-muted);margin-top:3px">' + sub + '</div>' : '')
  + '</div>';
}

function progressBar(pct, color) {
  return '<div style="height:10px;background:var(--bg3);border-radius:5px;overflow:hidden">'
    + '<div style="height:100%;width:' + Math.min(pct, 100) + '%;background:' + color + ';border-radius:5px;transition:width .4s"></div>'
  + '</div>';
}

function buildYearOptions(current) {
  var docs = loadDocs();
  var years = new Set([current]);
  docs.forEach(function(d){ if (d.date) years.add(new Date(d.date).getFullYear()); });
  var arr = [...years].sort(function(a,b){ return b-a; });
  return arr.map(function(y){ return '<option value="' + y + '"' + (y === current ? ' selected' : '') + '>' + y + '</option>'; }).join('');
}

function fiscalSetYear(y) { fiscalYear = parseInt(y); renderFiscal(); }
function fiscalPrevYear() { fiscalYear -= 1; renderFiscal(); }
function fiscalNextYear() { fiscalYear += 1; renderFiscal(); }

// ── Détail trimestre ─────────────────────────────────────────
function showFiscalQuarter(q, year) {
  var quarters = calcQuarters(year);
  var docs = quarters.byQ[q];
  var labels = ['T1 Janv-Mars', 'T2 Avr-Juin', 'T3 Juil-Sept', 'T4 Oct-Déc'];
  var params = loadFiscalParams();
  var ca = quarters[['q1','q2','q3','q4'][q]];
  var urssaf = ca * params.taux_urssaf / 100;

  var html = '<div style="margin-bottom:14px;padding:12px;background:var(--bg3);border-radius:8px">'
    + '<div style="font-size:12px;color:var(--text-muted)">CA du trimestre</div>'
    + '<div style="font-family:var(--fm);font-size:22px;color:var(--blue);font-weight:700">' + fmt(ca) + '</div>'
    + '<div style="font-size:12px;color:var(--orange);margin-top:4px">→ URSSAF estimée : <strong>' + fmt(urssaf) + '</strong> (' + params.taux_urssaf + '%)</div>'
  + '</div>';

  html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:8px">Factures du trimestre (' + docs.length + ')</div>';
  if (docs.length) {
    html += docs.map(function(d) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        + '<span class="doc-num">' + d.num + '</span>'
        + '<span style="font-size:12px;color:var(--text-dim)">' + fmtDate(d.date) + '</span>'
        + '<span style="flex:1;font-size:13px">' + escHtml(d.cn || '—') + '</span>'
        + '<span style="font-family:var(--fm);color:var(--blue);font-size:13px">' + fmt(d.ttc || 0) + '</span>'
        + '<button class="btn-s btn-sm" onclick="loadDoc(' + d.id + ');$(' + "'client-history-modal'" + ').classList.remove(' + "'open'" + ')">✏️</button>'
      + '</div>';
    }).join('');
  } else {
    html += '<div style="color:var(--text-muted);font-size:13px">Aucune facture sur ce trimestre.</div>';
  }

  $('client-history-title').textContent = '💰 ' + labels[q] + ' ' + year;
  $('client-history-content').innerHTML = html;
  $('client-history-modal').classList.add('open');
}

// ── Export CSV trimestriel ───────────────────────────────────
function exportFiscalCSV() {
  var params = loadFiscalParams();
  var quarters = calcQuarters(fiscalYear);
  var quartersPrev = calcQuarters(fiscalYear - 1);
  var rows = [['Trimestre', 'CA encaissé déclaré', 'URSSAF (' + params.taux_urssaf + '%)']];
  if (params.versement_lib) rows[0].push('IR libératoire (' + params.taux_lib + '%)');
  rows[0].push('Net après cotisations', 'Nb factures', 'CA ' + (fiscalYear-1), 'Évolution');

  var quarterLabels = ['T1 (Janv-Mars)', 'T2 (Avr-Juin)', 'T3 (Juil-Sept)', 'T4 (Oct-Déc)'];
  [0,1,2,3].forEach(function(q) {
    var k = ['q1','q2','q3','q4'][q];
    var ca = quarters[k];
    var urssaf = ca * params.taux_urssaf / 100;
    var lib = params.versement_lib ? ca * params.taux_lib / 100 : 0;
    var net = ca - urssaf - lib;
    var prev = quartersPrev[k];
    var diff = prev > 0 ? Math.round(((ca - prev) / prev) * 100) + '%' : (ca > 0 ? 'nouveau' : '');
    var row = [quarterLabels[q], ca.toFixed(2), urssaf.toFixed(2)];
    if (params.versement_lib) row.push(lib.toFixed(2));
    row.push(net.toFixed(2), quarters.byQ[q].length, prev.toFixed(2), diff);
    rows.push(row);
  });
  // Total annuel
  var totalUrssaf = quarters.total * params.taux_urssaf / 100;
  var totalLib = params.versement_lib ? quarters.total * params.taux_lib / 100 : 0;
  var totalNet = quarters.total - totalUrssaf - totalLib;
  var totalRow = ['TOTAL ' + fiscalYear, quarters.total.toFixed(2), totalUrssaf.toFixed(2)];
  if (params.versement_lib) totalRow.push(totalLib.toFixed(2));
  totalRow.push(totalNet.toFixed(2), '', quartersPrev.total.toFixed(2), '');
  rows.push(totalRow);

  var csv = rows.map(function(r){
    return r.map(function(c){ return '"' + String(c).replace(/"/g,'""') + '"'; }).join(';');
  }).join('\n');
  var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'AREPROG_fiscal_' + fiscalYear + '.csv';
  a.click();
  showNotifBanner('💰', 'Export fiscal', 'Récap trimestriel ' + fiscalYear + ' exporté');
}

// ── Modal paramètres fiscaux ─────────────────────────────────
function openFiscalParams() {
  var p = loadFiscalParams();
  var html = '<div class="fr"><label>Régime d\'activité</label>'
    + '<select id="fp-regime">'
      + '<option value="vente"' + (p.regime==='vente'?' selected':'') + '>Vente de marchandises (BIC)</option>'
      + '<option value="services_bic"' + (p.regime==='services_bic'?' selected':'') + '>Prestations de services (BIC)</option>'
      + '<option value="services_bnc"' + (p.regime==='services_bnc'?' selected':'') + '>Prestations de services (BNC libéral)</option>'
    + '</select></div>'
    + '<div class="fr"><label>Taux URSSAF (%)</label><input id="fp-urssaf" type="number" step="0.1" min="0" max="50" value="' + p.taux_urssaf + '"/></div>'
    + '<div class="fr"><label class="tpl-toggle"><input type="checkbox" id="fp-lib"' + (p.versement_lib?' checked':'') + '/> Versement libératoire IR</label></div>'
    + '<div class="fr"><label>Taux IR libératoire (%)</label><input id="fp-tauxlib" type="number" step="0.1" min="0" max="10" value="' + p.taux_lib + '"/></div>'
    + '<div class="fr"><label>Seuil franchise TVA (€)</label><input id="fp-tva" type="number" step="100" min="0" value="' + p.seuil_tva + '"/></div>'
    + '<div class="fr"><label>Seuil TVA majoré (€)</label><input id="fp-tvamaj" type="number" step="100" min="0" value="' + p.seuil_tva_maj + '"/></div>'
    + '<div class="fr"><label>Plafond micro (€)</label><input id="fp-micro" type="number" step="100" min="0" value="' + p.seuil_micro + '"/></div>'
    + '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;padding:10px;background:var(--bg3);border-radius:6px">'
      + 'ℹ️ Valeurs 2025 par défaut (services BIC) : URSSAF 21,2% · TVA 37 500/41 250 € · Micro 77 700 €. Adapte selon ton activité réelle.'
    + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px">'
      + '<button class="btn-s" onclick="$(\'client-history-modal\').classList.remove(\'open\')">Annuler</button>'
      + '<button class="btn-s" onclick="resetFiscalParams()">↺ Valeurs 2025</button>'
      + '<button class="btn-g" onclick="saveFiscalParamsForm()">💾 Enregistrer</button>'
    + '</div>';

  $('client-history-title').textContent = '⚙️ Paramètres fiscaux';
  $('client-history-content').innerHTML = html;
  $('client-history-modal').classList.add('open');
}

function saveFiscalParamsForm() {
  var p = {
    regime: $('fp-regime').value,
    taux_urssaf: parseFloat($('fp-urssaf').value) || FISCAL_DEFAULT.taux_urssaf,
    versement_lib: $('fp-lib').checked,
    taux_lib: parseFloat($('fp-tauxlib').value) || FISCAL_DEFAULT.taux_lib,
    seuil_tva: parseFloat($('fp-tva').value) || FISCAL_DEFAULT.seuil_tva,
    seuil_tva_maj: parseFloat($('fp-tvamaj').value) || FISCAL_DEFAULT.seuil_tva_maj,
    seuil_micro: parseFloat($('fp-micro').value) || FISCAL_DEFAULT.seuil_micro,
  };
  saveFiscalParams(p);
  $('client-history-modal').classList.remove('open');
  renderFiscal();
  showNotifBanner('⚙️', 'Paramètres enregistrés', 'Récap mis à jour');
}

function resetFiscalParams() {
  if (!confirm('Réinitialiser aux valeurs 2025 par défaut (services BIC) ?')) return;
  saveFiscalParams(Object.assign({}, FISCAL_DEFAULT));
  $('client-history-modal').classList.remove('open');
  renderFiscal();
}
