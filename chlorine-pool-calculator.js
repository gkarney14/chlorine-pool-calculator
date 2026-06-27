let poolGallons = null;
let concs = { bleach: 10, shock: 65, acid: 14.5, trichlor: 90 };
let history = JSON.parse(localStorage.getItem('poolHistory_chlorine') || '[]');
let lastDosing = JSON.parse(localStorage.getItem('poolLastDosing_chlorine') || 'null');
let trendChart = null;
let activeTrend = 'fc';
let unitLabel = 'ppm';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateVolume() {
  const raw = parseFloat(document.getElementById('pool-vol').value);
  poolGallons = (!isNaN(raw) && raw > 0) ? raw : null;
  const disp = document.getElementById('vol-display');
  if (poolGallons) {
    disp.textContent = poolGallons.toLocaleString() + ' gal loaded';
    document.getElementById('dosing-volume-label').textContent =
      'Chemical adjustments — ' + poolGallons.toLocaleString() + ' gal';
  } else {
    disp.textContent = '';
    document.getElementById('dosing-volume-label').textContent = 'Chemical adjustments';
  }
  updateAll();
}

function setUnit(u) {
  unitLabel = u;
  document.querySelectorAll('.unit-label').forEach(el => el.textContent = unitLabel);
  document.getElementById('unit-ppm').style.background = u === 'ppm' ? '#639922' : '#f5f5f3';
  document.getElementById('unit-ppm').style.color      = u === 'ppm' ? '#fff'    : '#888';
  document.getElementById('unit-mgl').style.background = u === 'mgl' ? '#639922' : '#f5f5f3';
  document.getElementById('unit-mgl').style.color      = u === 'mgl' ? '#fff'    : '#888';
  updateAll();
}

function v(id) { return parseFloat(document.getElementById(id).value) || null; }

function badge(val, low, high) {
  if (val === null) return '';
  let cls, txt;
  if (val >= low && val <= high) { cls = 'status-ok'; txt = 'In range'; }
  else if (val < low * 0.8 || val > high * 1.2) { cls = 'status-danger'; txt = 'Action needed'; }
  else { cls = 'status-warn'; txt = 'Out of range'; }
  return `<span class="status-badge ${cls}">${txt}</span>`;
}

function updateAll() {
  const fc = v('fc'), cc = v('cc'), ph = v('ph'), ta = v('ta'),
        ch = v('ch'), cya = v('cya'), tds = v('tds'), temp = v('temp');

  document.getElementById('fc-status').innerHTML  = badge(fc,  2,    4);
  document.getElementById('cc-status').innerHTML  = badge(cc,  0,    0.5);
  document.getElementById('ph-status').innerHTML  = badge(ph,  7.2,  7.6);
  document.getElementById('ta-status').innerHTML  = badge(ta,  80,   120);
  document.getElementById('ch-status').innerHTML  = badge(ch,  200,  400);
  document.getElementById('cya-status').innerHTML = badge(cya, 30,   50);
  document.getElementById('tds-status').innerHTML = badge(tds, 0,    1500);
  document.getElementById('temp-status').innerHTML = temp !== null
    ? `<span style="font-size:13px;color:#888;">${temp}&deg;F</span>` : '';

  calcLSI(ph, ta, ch, temp);
  updateDosing(fc, cc, ph, ta, ch, cya, tds, temp);
}

function calcLSI(ph, ta, ch, temp) {
  const box = document.getElementById('csi-box');
  if (!ph || !ta || !ch || !temp) { box.style.display = 'none'; return; }
  box.style.display = '';
  const tc = (temp - 32) * 5 / 9;
  const pHs = (9.3 + Math.log10(ta) - 1) + (Math.log10(ch) - 2) - (tc > 25 ? 0.3 : tc > 15 ? 0.2 : 0.1);
  const lsi = ph - pHs;
  let color, label, note;
  if (lsi < -0.5)      { color = '#A32D2D'; label = 'Corrosive';          note = 'Water may etch plaster and corrode metal. Raise TA or calcium hardness.'; }
  else if (lsi < -0.3) { color = '#854F0B'; label = 'Slightly corrosive'; note = 'Consider raising alkalinity or calcium hardness slightly.'; }
  else if (lsi <= 0.3) { color = '#3B6D11'; label = 'Balanced';           note = 'Water is well-balanced — not scaling or corrosive.'; }
  else if (lsi <= 0.5) { color = '#854F0B'; label = 'Slightly scaling';   note = 'Monitor — may deposit scale on surfaces and equipment.'; }
  else                 { color = '#A32D2D'; label = 'Scaling';            note = 'Calcium scale will form. Lower TA, CH, or pH.'; }
  document.getElementById('csi-value').textContent = lsi.toFixed(2);
  document.getElementById('csi-value').style.color = color;
  document.getElementById('csi-label').textContent = label;
  document.getElementById('csi-note').textContent = note;
}

function bleachOz(ppmNeeded) {
  if (!poolGallons) return null;
  return (ppmNeeded * poolGallons * 0.000128) / (concs.bleach / 100);
}

function shockOz(ppmNeeded) {
  if (!poolGallons) return null;
  const lbsActive = ppmNeeded * poolGallons * 8.34 / 1000000;
  const lbsShock = lbsActive / (concs.shock / 100);
  return lbsShock * 16;
}

function renderDosingItems(items, heldDate) {
  const list = document.getElementById('dosing-list');
  let html = '';
  if (heldDate) {
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding:9px 13px;background:#EAF3DE;border-radius:8px;border-left:3px solid #639922;">
      <i class="ti ti-clock" aria-hidden="true" style="color:#639922;font-size:16px;flex-shrink:0;"></i>
      <span style="font-size:13px;color:#3B6D11;">Held results from <strong>${escapeHtml(heldDate)}</strong> — enter new readings to recalculate.</span>
    </div>`;
  }
  html += items.map(i => `
    <div class="dose-card ${i.cls}">
      <div class="dose-reading">
        <div class="dose-reading-label">${i.param}</div>
        <div class="dose-reading-value">${i.reading}</div>
        <div class="dose-reading-unit">${i.readingUnit}</div>
      </div>
      <div class="dose-body">
        <p class="dose-name">${i.name}</p>
        <p class="dose-amount">${i.amount}</p>
        <p class="dose-note">${i.note}</p>
      </div>
    </div>
  `).join('');
  list.innerHTML = html;
}

function updateDosing(fc, cc, ph, ta, ch, cya, tds, temp) {
  const list = document.getElementById('dosing-list');
  if (!poolGallons) {
    list.innerHTML = '<p style="font-size:14px;color:#888;">Enter your pool volume above to see dosing recommendations.</p>';
    return;
  }
  if (fc === null && ph === null && ta === null && ch === null && cya === null) {
    if (lastDosing && lastDosing.items && lastDosing.items.length > 0) {
      renderDosingItems(lastDosing.items, lastDosing.date);
    } else {
      list.innerHTML = '<p style="font-size:14px;color:#888;">Enter readings on the Readings tab to see dosing recommendations.</p>';
    }
    return;
  }
  const items = [];
  const u = unitLabel;

  if (fc !== null) {
    if (fc < 2) {
      const oz = bleachOz(3 - fc);
      const shOz = shockOz(3 - fc);
      items.push({
        name: 'Add chlorine',
        amount: `${oz.toFixed(1)} fl oz liquid (${(oz/128).toFixed(2)} gal)  or  ${(shOz/16).toFixed(2)} lbs granular shock`,
        note: `${concs.bleach}% NaOCl or ${concs.shock}% cal-hypo to raise FC ${fc} → 3 ${u}`,
        reading: fc, readingUnit: u, param: 'FC', cls: 'dose-warn'
      });
    } else if (fc > 5) {
      items.push({ name: 'Free Chlorine — high', amount: 'Wait before adding more chlorine', note: `FC at ${fc} ${u}. Let it drop naturally or reduce dosing frequency.`, reading: fc, readingUnit: u, param: 'FC', cls: 'dose-warn' });
    } else {
      items.push({ name: 'Free Chlorine', amount: 'No action needed', note: `Target 2–4 ${u}`, reading: fc, readingUnit: u, param: 'FC', cls: 'dose-ok' });
    }
  }

  if (cc !== null && cc > 0.5) {
    const shockLvl = cya ? (cya * 0.2) : 10;
    const oz = bleachOz(Math.max(0, shockLvl - (fc || 0)));
    const shOz = shockOz(Math.max(0, shockLvl - (fc || 0)));
    items.push({
      name: 'SLAM shock — CC too high',
      amount: `${oz.toFixed(0)} fl oz liquid  or  ${(shOz/16).toFixed(2)} lbs granular shock`,
      note: `Raise FC to ${shockLvl.toFixed(0)} ${u} (CYA×0.2). Hold until CC < 0.5 ${u} and pool is clear.`,
      reading: cc, readingUnit: u, param: 'CC', cls: 'dose-danger'
    });
  }

  if (ph !== null) {
    if (ph > 7.6) {
      const taForCalc = ta || 100;
      const oz = ((ph - 7.4) * poolGallons * (taForCalc / 100) * 0.004 * (31.45 / concs.acid)).toFixed(1);
      items.push({ name: `Muriatic acid (${concs.acid}%)`, amount: `${oz} fl oz (${(oz / 128).toFixed(2)} gal)`, note: `Lower pH ${ph} → 7.4. Based on TA ${taForCalc} ${u}. Pour near return jet with pump running.`, reading: ph, readingUnit: '', param: 'pH', cls: 'dose-warn' });
    } else if (ph < 7.2) {
      const lbs = ((7.4 - ph) * poolGallons * 0.000219).toFixed(2);
      items.push({ name: 'Add soda ash (pH+)', amount: `${lbs} lbs`, note: `Raise pH ${ph} → 7.4. Add in front of a return jet with pump running.`, reading: ph, readingUnit: '', param: 'pH', cls: 'dose-warn' });
    } else {
      items.push({ name: 'pH', amount: 'No action needed', note: 'Target 7.2–7.6', reading: ph, readingUnit: '', param: 'pH', cls: 'dose-ok' });
    }
  }

  if (ta !== null) {
    if (ta < 80) {
      const lbs = ((80 - ta) * poolGallons * 0.000015).toFixed(1);
      items.push({ name: 'Add baking soda (TA+)', amount: `${lbs} lbs`, note: `Raise TA ${ta} → 80 ${u}. Add in increments, retest each time.`, reading: ta, readingUnit: u, param: 'TA', cls: 'dose-warn' });
    } else if (ta > 120) {
      const oz = ((ta - 100) * poolGallons * 0.0001 * (31.45 / concs.acid)).toFixed(1);
      items.push({ name: `Muriatic acid ${concs.acid}% (lower TA)`, amount: `${oz} fl oz (${(oz / 128).toFixed(2)} gal)`, note: `Lower TA ${ta} → 100 ${u}. Add in 2–3 doses with aeration between each to degas CO₂.`, reading: ta, readingUnit: u, param: 'TA', cls: 'dose-warn' });
    } else {
      items.push({ name: 'Total Alkalinity', amount: 'No action needed', note: `Target 80–120 ${u}`, reading: ta, readingUnit: u, param: 'TA', cls: 'dose-ok' });
    }
  }

  if (ch !== null) {
    if (ch < 200) {
      const lbs = ((200 - ch) * poolGallons * 0.00002).toFixed(1);
      items.push({ name: 'Add calcium chloride (CH+)', amount: `${lbs} lbs`, note: `Raise CH ${ch} → 200 ${u}. Dissolve in a bucket of water first, add slowly.`, reading: ch, readingUnit: u, param: 'CH', cls: 'dose-warn' });
    } else if (ch > 400) {
      items.push({ name: 'Calcium Hardness — high', amount: 'Partial drain/refill', note: `Above 400 ${u}. Replace 20–30% water with fresh.`, reading: ch, readingUnit: u, param: 'CH', cls: 'dose-warn' });
    } else {
      items.push({ name: 'Calcium Hardness', amount: 'No action needed', note: `Target 200–400 ${u}`, reading: ch, readingUnit: u, param: 'CH', cls: 'dose-ok' });
    }
  }

  if (cya !== null) {
    if (cya < 30) {
      const lbs = ((40 - cya) * poolGallons / 1000000 * 8.34).toFixed(2);
      const oz  = (lbs * 16).toFixed(0);
      items.push({ name: 'Add stabilizer / CYA', amount: `${lbs} lbs (${oz} oz)`, note: `Raise CYA ${cya} → 40 ${u}. Dissolve in warm water first. Takes 1–2 weeks to fully register.`, reading: cya, readingUnit: u, param: 'CYA', cls: 'dose-warn' });
    } else if (cya > 80) {
      items.push({ name: 'CYA — high', amount: 'Partial drain/refill', note: `CYA ${cya} ${u} severely reduces chlorine effectiveness. Dilute with fresh water; no chemical fix.`, reading: cya, readingUnit: u, param: 'CYA', cls: 'dose-danger' });
    } else if (cya > 50) {
      items.push({ name: 'CYA — elevated', amount: 'Monitor closely', note: `CYA ${cya} ${u} is above ideal (30–50 ${u}). Avoid adding more stabilizer. Consider partial drain if trending up.`, reading: cya, readingUnit: u, param: 'CYA', cls: 'dose-warn' });
    } else {
      items.push({ name: 'Cyanuric Acid', amount: 'No action needed', note: `Target 30–50 ${u} for outdoor chlorine pool`, reading: cya, readingUnit: u, param: 'CYA', cls: 'dose-ok' });
    }
  }

  if (tds !== null && tds > 1500) {
    items.push({ name: 'TDS — elevated', amount: tds > 2500 ? 'Drain/refill recommended' : 'Monitor', note: `TDS ${tds} ${u}. ${tds > 2500 ? 'Above 2500 — partial drain and refill recommended.' : 'Approaching 1500 limit — monitor and reduce chemical inputs.'}`, reading: tds, readingUnit: u, param: 'TDS', cls: tds > 2500 ? 'dose-danger' : 'dose-warn' });
  }

  if (items.length > 0) {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    lastDosing = { items, date };
    localStorage.setItem('poolLastDosing_chlorine', JSON.stringify(lastDosing));
    renderDosingItems(items, null);
  } else {
    list.innerHTML = '<p style="font-size:14px;color:#888;">Enter readings on the Readings tab to see dosing recommendations.</p>';
  }
}

function setConc(chem, val, btn) {
  concs[chem] = val;
  btn.parentElement.querySelectorAll('.conc-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
  updateAll();
}

function logReading() {
  const entry = {
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
          ' ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    ts: Date.now(),
    gallons: poolGallons,
    fc: v('fc'), cc: v('cc'), ph: v('ph'), ta: v('ta'),
    ch: v('ch'), cya: v('cya'), tds: v('tds'), temp: v('temp')
  };
  const hasData = [entry.fc, entry.cc, entry.ph, entry.ta, entry.ch, entry.cya, entry.tds, entry.temp].some(x => x !== null);
  if (!hasData) { alert('Please enter at least one reading before logging.'); return; }
  history.unshift(entry);
  localStorage.setItem('poolHistory_chlorine', JSON.stringify(history));
  document.getElementById('last-logged').textContent = 'Last logged: ' + entry.date;
  renderHistory();
}

function deleteEntry(i) {
  history.splice(i, 1);
  localStorage.setItem('poolHistory_chlorine', JSON.stringify(history));
  document.getElementById('last-logged').textContent = history.length > 0
    ? 'Last logged: ' + history[0].date : 'No readings logged';
  renderHistory();
}

function clearHistory() {
  if (!confirm('Clear all logged readings? This cannot be undone.')) return;
  history = [];
  localStorage.removeItem('poolHistory_chlorine');
  document.getElementById('last-logged').textContent = 'No readings logged';
  renderHistory();
}

const TREND_PARAMS = {
  fc:   { label: 'Free Chlorine', unit: 'ppm', color: '#639922', target: [2, 4] },
  ph:   { label: 'pH',            unit: '',    color: '#1D9E75', target: [7.2, 7.6] },
  ta:   { label: 'Alkalinity',    unit: 'ppm', color: '#D85A30', target: [80, 120] },
  ch:   { label: 'Ca Hardness',   unit: 'ppm', color: '#BA7517', target: [200, 400] },
  cya:  { label: 'CYA',           unit: 'ppm', color: '#7F77DD', target: [30, 50] },
  tds:  { label: 'TDS',           unit: 'ppm', color: '#D4537E', target: [0, 1500] },
  temp: { label: 'Temp',          unit: '°F',  color: '#888780', target: [78, 86] }
};

function setTrend(p) { activeTrend = p; renderHistory(); }

function renderHistory() {
  const empty = document.getElementById('trend-empty');
  const charts = document.getElementById('trend-charts');
  if (history.length < 2) {
    empty.style.display = ''; charts.style.display = 'none';
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    return;
  }
  empty.style.display = 'none'; charts.style.display = '';

  const sorted = [...history].sort((a, b) => a.ts - b.ts);
  const labels = sorted.map(e => e.date);

  const legend = document.getElementById('trend-legend');
  legend.innerHTML = '';
  Object.entries(TREND_PARAMS).forEach(([key, p]) => {
    const isSel = key === activeTrend;
    const btn = document.createElement('button');
    btn.className = 'trend-btn';
    if (isSel) btn.style.cssText = `background:${p.color}22;border-color:${p.color};color:${p.color};font-weight:500;`;
    const dot = document.createElement('span');
    dot.style.cssText = `width:10px;height:10px;border-radius:2px;background:${p.color};display:inline-block;`;
    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(' ' + p.label));
    btn.addEventListener('click', () => setTrend(key));
    legend.appendChild(btn);
  });

  const p = TREND_PARAMS[activeTrend];
  const data = sorted.map(e => e[activeTrend]);
  const validData = data.filter(x => x !== null);
  const dataMin = validData.length ? Math.min(...validData) : 0;
  const dataMax = validData.length ? Math.max(...validData) : 10;
  const [tLow, tHigh] = p.target;
  const allMin = Math.min(dataMin, tLow);
  const allMax = Math.max(dataMax, tHigh);
  const pad = (allMax - allMin) * 0.2 || 1;

  const bandLow  = labels.map(() => tLow);
  const bandHigh = labels.map(() => tHigh);

  if (trendChart) { trendChart.destroy(); trendChart = null; }
  const ctx = document.getElementById('trendChart').getContext('2d');
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Target low',  data: bandLow,  borderColor: 'transparent', backgroundColor: p.color + '25', fill: '+1', pointRadius: 0, pointHoverRadius: 0, tension: 0, spanGaps: true },
        { label: 'Target high', data: bandHigh, borderColor: 'transparent', backgroundColor: p.color + '25', fill: false, pointRadius: 0, pointHoverRadius: 0, tension: 0, spanGaps: true },
        { label: p.label, data, borderColor: p.color, backgroundColor: 'transparent', fill: false, tension: 0.3, pointRadius: 5, pointHoverRadius: 7, spanGaps: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { filter: (item) => item.datasetIndex === 2, callbacks: { label: (c) => `${p.label}: ${c.parsed.y}${p.unit}` } }
      },
      scales: {
        y: { min: Math.max(0, allMin - pad), max: allMax + pad, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { color: '#888' } },
        x: { grid: { display: false }, ticks: { color: '#888', maxRotation: 30, autoSkip: false } }
      }
    }
  });

  const u = unitLabel;
  const historyList = document.getElementById('history-list');
  historyList.innerHTML = '';
  history.slice(0, 15).forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'history-date';
    dateSpan.textContent = e.date;
    row.appendChild(dateSpan);

    if (e.gallons) {
      const galSpan = document.createElement('span');
      galSpan.style.cssText = 'font-size:12px;color:#3B6D11;font-weight:500;';
      galSpan.textContent = e.gallons.toLocaleString() + ' gal';
      row.appendChild(galSpan);
    }

    [
      e.fc   !== null && ['FC',   `${e.fc}`],
      e.ph   !== null && ['pH',   `${e.ph}`],
      e.ta   !== null && ['TA',   `${e.ta}`],
      e.ch   !== null && ['CH',   `${e.ch}`],
      e.cya  !== null && ['CYA',  `${e.cya}`],
      e.tds  !== null && ['TDS',  `${e.tds}`],
      e.temp !== null && ['Temp', `${e.temp}°F`],
    ].filter(Boolean).forEach(([label, val]) => {
      const span = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = label;
      span.appendChild(b);
      span.appendChild(document.createTextNode(' ' + val));
      row.appendChild(span);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'del-btn';
    delBtn.title = 'Delete this entry';
    delBtn.setAttribute('aria-label', `Delete entry from ${escapeHtml(e.date)}`);
    delBtn.dataset.index = i;
    const icon = document.createElement('i');
    icon.className = 'ti ti-x';
    icon.setAttribute('aria-hidden', 'true');
    delBtn.appendChild(icon);
    row.appendChild(delBtn);

    historyList.appendChild(row);
  });
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'trends') renderHistory();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab, btn));
  });

  document.getElementById('unit-ppm').addEventListener('click', () => setUnit('ppm'));
  document.getElementById('unit-mgl').addEventListener('click', () => setUnit('mgl'));

  document.getElementById('pool-vol').addEventListener('input', updateVolume);

  ['fc','cc','ph','ta','ch','cya','tds','temp'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateAll);
  });

  document.getElementById('log-btn').addEventListener('click', logReading);

  document.getElementById('clear-history-link').addEventListener('click', e => {
    e.preventDefault();
    clearHistory();
  });

  document.querySelectorAll('.conc-btn[data-chem]').forEach(btn => {
    btn.addEventListener('click', () => setConc(btn.dataset.chem, Number(btn.dataset.val), btn));
  });

  document.getElementById('history-list').addEventListener('click', e => {
    const btn = e.target.closest('.del-btn[data-index]');
    if (btn) deleteEntry(Number(btn.dataset.index));
  });

  if (history.length > 0) {
    document.getElementById('last-logged').textContent = 'Last logged: ' + history[0].date;
  }

  if (lastDosing && lastDosing.items && lastDosing.items.length > 0) {
    renderDosingItems(lastDosing.items, lastDosing.date);
  }
});
