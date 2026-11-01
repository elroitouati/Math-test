(() => {
'use strict';

const { EXAM, TOPICS, SOURCES, PLAN, MATERIAL } = window;
const STORE_KEY = 'mathprep.v1';
const WD = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת'];
const WD_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// ---------- Native bridge ----------
const Cap = window.Capacitor;
const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const LN = isNative ? Cap.Plugins.LocalNotifications : null;
const AppPlugin = isNative ? Cap.Plugins.App : null;

// ---------- State ----------
const defaults = {
  done: {},                 // taskId -> ISO date (yyyy-mm-dd) when completed
  settings: { notif: false, remind: '16:30', evening: true, theme: 'auto' },
  notifAsked: false,
};
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaults));
    const s = JSON.parse(raw);
    return { ...JSON.parse(JSON.stringify(defaults)), ...s, settings: { ...defaults.settings, ...(s.settings || {}) } };
  } catch (e) { return JSON.parse(JSON.stringify(defaults)); }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

// ---------- Dates ----------
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
function now() {
  const o = new URLSearchParams(location.search).get('today');
  if (o) { const d = parseKey(o); const t = new Date(); d.setHours(t.getHours(), t.getMinutes(), t.getSeconds()); return d; }
  return new Date();
}
const todayKey = () => keyOf(now());
const dayDiff = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
const shortDate = k => { const d = parseKey(k); return `${d.getDate()}/${d.getMonth() + 1}`; };
const examAt = () => { const d = parseKey(EXAM.date); const [h, m] = EXAM.time.split(':').map(Number); d.setHours(h, m, 0, 0); return d; };

// ---------- Derived ----------
const allTasks = PLAN.flatMap(d => d.tasks.map(t => ({ ...t, date: d.date })));
const isDone = id => !!state.done[id];
function dayStats(day) {
  const total = day.tasks.length;
  const done = day.tasks.filter(t => isDone(t.id)).length;
  return { total, done, pct: total ? done / total : 0, complete: total > 0 && done === total };
}
function overall() {
  const total = allTasks.length;
  const done = allTasks.filter(t => isDone(t.id)).length;
  const minDone = allTasks.filter(t => isDone(t.id)).reduce((s, t) => s + (t.min || 0), 0);
  return { total, done, pct: total ? done / total : 0, minDone };
}
function streak() {
  const tk = todayKey();
  const days = PLAN.filter(d => !d.rest && d.date <= tk).reverse();
  let s = 0;
  for (const d of days) {
    const st = dayStats(d);
    if (d.date === tk && !st.complete) continue; // today still in progress – doesn't break the streak
    if (st.complete) s++; else break;
  }
  return s;
}
function overdue() {
  const tk = todayKey();
  return allTasks.filter(t => t.date < tk && !isDone(t.id));
}
const nextStudyDay = after => PLAN.find(d => !d.rest && d.date > after);

// ---------- Icons ----------
const I = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="16" rx="3.5"/><path d="M8 2.8v3.4M16 2.8v3.4M3.5 9.5h17"/><path d="M8.8 14.6l2.2 2.2 4.2-4.3"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.3"/><circle cx="4.5" cy="12" r="1.3"/><circle cx="4.5" cy="18" r="1.3"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
};

// ---------- Helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = v => `<bdi class="n">${v}</bdi>`;
function ring(pct, size = 96, stroke = 9, cls = 'ring', inner = '') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<div class="${cls}"><svg viewBox="0 0 ${size} ${size}"><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/><circle class="bar" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg><div class="lbl">${inner}</div></div>`;
}
function miniRing(pct) {
  const s = 30, w = 4, r = (s - w) / 2, c = 2 * Math.PI * r;
  return `<svg class="mini-ring" viewBox="0 0 ${s} ${s}"><circle class="track" cx="15" cy="15" r="${r}" fill="none" stroke-width="${w}"/><circle class="bar" cx="15" cy="15" r="${r}" fill="none" stroke-width="${w}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/></svg>`;
}
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function greeting() {
  const h = now().getHours();
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
}

function taskHTML(t, { showDay = false } = {}) {
  const tp = TOPICS[t.topic];
  const late = showDay ? `<span class="chip late">מיום ${WD[parseKey(t.date).getDay()]} ${n(shortDate(t.date))}</span>` : '';
  return `<button class="task ${isDone(t.id) ? 'done' : ''}" data-task="${t.id}" role="checkbox" aria-checked="${isDone(t.id)}">
    <span class="check" aria-hidden="true">${I.check}</span>
    <span class="task-body">
      <span class="task-title">${esc(t.title)}</span>
      <span class="task-meta">
        <span class="chip src-${t.src}">${esc(SOURCES[t.src])}</span>
        <span>${esc(tp.short)}</span><span aria-hidden="true">·</span><span>~${n(t.min)} דק׳</span>
        ${late}
      </span>
      ${t.note ? `<span class="task-note" style="display:block">${esc(t.note)}</span>` : ''}
    </span>
  </button>`;
}

// ---------- Views ----------
let current = 'today';
const openDays = new Set();
const openMat = new Set();

function viewToday() {
  const tk = todayKey();
  const d = now();
  const days = dayDiff(tk, EXAM.date);
  const ov = overall();
  const day = PLAN.find(p => p.date === tk);
  const studyLeft = PLAN.filter(p => !p.rest && p.date >= tk).length;

  let bigNum, unit, label;
  if (days > 1) { bigNum = days; unit = 'ימים'; label = 'עד המבחן'; }
  else if (days === 1) { bigNum = 'מחר'; unit = ''; label = 'המבחן'; }
  else if (days === 0) { bigNum = 'היום'; unit = ''; label = 'המבחן'; }
  else { bigNum = '✓'; unit = ''; label = 'המבחן מאחוריך'; }

  let html = `
  <header class="top">
    <div>
      <h1>${greeting()}</h1>
      <div class="sub">יום ${WD_LONG[d.getDay()]} · ${n(shortDate(tk))}</div>
    </div>
    <button class="icon-btn" data-action="settings" aria-label="הגדרות">${I.gear}</button>
  </header>

  <section class="hero" aria-label="ספירה לאחור">
    <div class="hero-row">
      <div>
        <div class="hero-label">${label}</div>
        <div class="hero-count"><span class="big">${typeof bigNum === 'number' ? n(bigNum) : bigNum}</span>${unit ? `<span class="unit">${unit}</span>` : ''}</div>
        <div class="hero-meta">יום ג׳ · ${EXAM.hebDate}<span class="sep">|</span>${n('10/11')}</div>
      </div>
      ${ring(ov.pct, 96, 9, 'ring', `<div><b>${n(Math.round(ov.pct * 100) + '%')}</b><span>מהחומר</span></div>`)}
    </div>
    ${days > 0 ? `<div class="hero-clock">${studyLeft > 0 ? `נשארו ${n(studyLeft)} ימי לימוד` : 'סיימנו ללמוד – עכשיו רק לנוח'}</div>` : ''}
  </section>`;

  // notifications CTA
  if (isNative && !state.settings.notif && days >= 0) {
    html += `<div class="card notif-cta">
      <span class="ic">${I.bell}</span>
      <span class="tx"><b>תזכורת יומית</b>אזכיר לך כל יום מה לעשות</span>
      <button class="btn primary" data-action="enable-notif">להפעיל</button>
    </div>`;
  }

  // today
  if (days < 0) {
    html += `<div class="section"><div class="banner success celebrate"><span class="em">🎓</span><div><h3>סיימת את המבחן</h3><p>עשית ${n(ov.done)} מתוך ${n(ov.total)} משימות. כל הכבוד על ההתמדה.</p></div></div></div>`;
  } else if (days === 0) {
    html += `<div class="section"><div class="banner calm"><span class="em">💪</span><div><h3>בהצלחה במבחן!</h3><p>נשום עמוק, קרא כל שאלה פעמיים, ותתחיל ממה שאתה בטוח בו.</p></div></div>
      <button class="btn ghost block" data-action="goto" data-view="material">לעבור על רשימת הבדיקה</button></div>`;
  } else if (day && day.rest) {
    html += `<div class="section"><div class="banner calm"><span class="em">🕯️</span><div><h3>שבת שלום</h3><p>היום אין משימות. מנוחה היא חלק מהתוכנית.</p></div></div></div>`;
  } else if (day) {
    const st = dayStats(day);
    html += `<div class="section">
      <div class="section-head"><h2>${esc(day.title)}</h2><span class="aside">${n(st.done + '/' + st.total)}</span></div>
      ${day.note ? `<div class="eyebrow">${esc(day.note)}</div>` : ''}
      <div class="daybar ${st.complete ? 'done' : ''}"><i style="width:${st.pct * 100}%"></i></div>
      ${st.complete ? `<div class="banner success celebrate" style="margin-bottom:12px"><span class="em">🎉</span><div><h3>סיימת את היום!</h3><p>עקביות זה כל הסוד. נתראה מחר.</p></div></div>` : ''}
      <div class="card tasks">${day.tasks.map(t => taskHTML(t)).join('')}</div>
    </div>`;
  } else {
    const startIn = dayDiff(tk, PLAN[0].date);
    html += startIn > 0
      ? `<div class="section"><div class="banner calm"><span class="em">😌</span><div><h3>היום חופש</h3><p>${startIn === 1 ? 'מתחילים מחר' : `מתחילים ב-${n(shortDate(PLAN[0].date))}`} – בנחת, ומרביעי נכנסים לקצב.</p></div></div></div>`
      : `<div class="section"><div class="banner calm"><span class="em">📅</span><div><h3>אין משימות להיום</h3><p>תסתכל על "להשלים" או על המשימות של מחר.</p></div></div></div>`;
  }

  // overdue
  const od = overdue();
  if (od.length && days >= 0) {
    html += `<div class="section">
      <div class="section-head"><h2>להשלים</h2><span class="aside">${n(od.length)} משימות</span></div>
      <div class="card tasks">${od.map(t => taskHTML(t, { showDay: true })).join('')}</div>
    </div>`;
  }

  // tomorrow
  const nx = days > 0 ? nextStudyDay(tk) : null;
  if (nx) {
    const dd = parseKey(nx.date);
    html += `<div class="section">
      <div class="section-head"><h2>${dayDiff(tk, nx.date) === 1 ? 'מחר' : 'יום ' + WD_LONG[dd.getDay()]}</h2><span class="aside">${n(shortDate(nx.date))}</span></div>
      <div class="card preview"><div class="t">${esc(nx.title)}</div>
        <ul>${nx.tasks.map(t => `<li>${esc(SOURCES[t.src])} – ${esc(t.title)}</li>`).join('')}</ul>
      </div>
    </div>`;
  }
  return html;
}

function viewPlan() {
  const tk = todayKey();
  const study = PLAN.filter(d => !d.rest);
  if (!openDays.size) { const td = PLAN.find(d => d.date === tk); if (td) openDays.add(td.date); }
  let html = `
  <header class="top"><div><h1>התוכנית</h1><div class="sub">${n(study.length)} ימי לימוד · ${n(allTasks.length)} משימות</div></div></header>`;
  for (const day of PLAN) {
    const d = parseKey(day.date);
    const st = dayStats(day);
    const isToday = day.date === tk;
    const past = day.date < tk;
    const cls = ['card', 'day'];
    if (isToday) cls.push('is-today');
    if (openDays.has(day.date) && !day.rest) cls.push('open');
    if (day.rest) cls.push('rest');
    if (past && !day.rest && !st.complete) cls.push('past-incomplete');
    const status = day.rest ? '<span style="font-size:20px">🕯️</span>'
      : st.complete ? `<span class="status-done">${I.check}</span>` : miniRing(st.pct);
    const sub = day.rest ? 'מנוחה' : `${n(st.done + '/' + st.total)} משימות · ~${n(day.tasks.reduce((a, t) => a + t.min, 0))} דק׳${isToday ? ' · היום' : ''}${past && !st.complete ? ' · נשאר להשלים' : ''}`;
    html += `<div class="${cls.join(' ')}" data-day="${day.date}">
      <button class="day-head" ${day.rest ? 'disabled' : `data-action="toggle-day" data-date="${day.date}" aria-expanded="${openDays.has(day.date)}"`}>
        <span class="day-date"><div class="dw">${WD[d.getDay()]}</div><div class="dn">${n(d.getDate())}</div></span>
        <span class="day-info"><div class="tt">${esc(day.title)}</div><div class="st">${sub}</div></span>
        <span class="day-status">${status}</span>
        ${day.rest ? '' : I.chev}
      </button>
      ${day.rest ? '' : `<div class="day-body">${day.tasks.map(t => taskHTML(t)).join('')}</div>`}
    </div>`;
  }
  const ed = parseKey(EXAM.date);
  html += `<div class="card exam-card">
    <span class="day-date"><div class="dw">${WD[ed.getDay()]}</div><div class="dn">${n(ed.getDate())}</div></span>
    <span class="day-info"><div class="tt">המבחן · ${EXAM.hebDate}</div><div class="st">אלגברה + גאומטריה · בהצלחה!</div></span>
  </div>`;
  return html;
}

function viewMaterial() {
  let html = `<header class="top"><div><h1>חומר למבחן</h1><div class="sub">נוסחאות, תכונות ושיטות – הכל במקום אחד</div></div></header>`;
  html += `<div class="eyebrow" style="margin-bottom:8px">אלגברה</div>`;
  const geoStart = MATERIAL.findIndex(m => m.id === 'congruence');
  MATERIAL.forEach((m, i) => {
    if (i === geoStart) html += `<div class="eyebrow" style="margin:22px 0 8px">גאומטריה</div>`;
    if (m.id === 'checklist') html += `<div class="eyebrow" style="margin:22px 0 8px">לפני המבחן</div>`;
    const tp = TOPICS[m.topic];
    const col = `var(--t-${tp.hue})`;
    html += `<div class="card mat ${openMat.has(m.id) ? 'open' : ''}" data-mat="${m.id}">
      <button class="mat-head" data-action="toggle-mat" data-id="${m.id}" aria-expanded="${openMat.has(m.id)}">
        <span class="mat-icon" style="background:color-mix(in srgb, ${col} 14%, transparent);color:${col}">${esc(m.title.trim()[0])}</span>
        <span class="tt">${esc(m.title)}</span>${I.chev}
      </button>
      <div class="mat-body">${m.blocks.map(blockHTML).join('')}</div>
    </div>`;
  });
  return html;
}
function blockHTML(b) {
  switch (b.type) {
    case 'formula': return `<div class="formula"><div class="lb">${esc(b.label)}</div><span class="m">${b.m}</span></div>`;
    case 'tip': return `<div class="tip"><span>${b.text}</span></div>`;
    case 'example': return `<div class="example"><div class="lb">תרגיל לדוגמה</div><span class="m">${b.q}</span>
      <button class="reveal" data-action="reveal">להציג תשובה</button><span class="m ans" hidden>${b.a}</span></div>`;
    case 'steps': return `<div class="steps">${b.title ? `<div class="st-title">${esc(b.title)}</div>` : ''}<ol>${b.items.map(x => `<li>${x}</li>`).join('')}</ol></div>`;
    case 'list': return `<ul>${b.items.map(x => `<li>${x}</li>`).join('')}</ul>`;
  }
  return '';
}

function viewProgress() {
  const ov = overall();
  const tk = todayKey();
  const sk = streak();
  let msg;
  if (ov.pct >= 1) msg = 'סיימת את כל התוכנית. אתה מוכן.';
  else if (ov.pct >= .66) msg = 'הישורת האחרונה – עוד קצת.';
  else if (ov.pct >= .33) msg = 'אתה באמצע הדרך. ממשיכים.';
  else if (ov.done > 0) msg = 'התחלה טובה. כל משימה נספרת.';
  else msg = 'סמן את המשימה הראשונה וזה יתחיל לזוז.';

  let html = `<header class="top"><div><h1>ההתקדמות שלי</h1><div class="sub">עקביות היא המפתח</div></div></header>
  <div class="card big-progress">
    ${ring(ov.pct, 110, 10, 'ring', `<div><b>${n(Math.round(ov.pct * 100) + '%')}</b></div>`)}
    <div class="txt"><h3>${n(ov.done)} מתוך ${n(ov.total)} משימות</h3><p>${msg}</p></div>
  </div>
  <div class="tiles">
    <div class="tile"><b>${n(sk)}</b><span>ימים ברצף</span></div>
    <div class="tile"><b>${n(PLAN.filter(d => !d.rest && dayStats(d).complete).length)}</b><span>ימים הושלמו</span></div>
    <div class="tile"><b>${n((ov.minDone / 60).toFixed(ov.minDone % 60 ? 1 : 0))}</b><span>שעות תרגול</span></div>
  </div>

  <div class="section"><div class="section-head"><h2>יום אחרי יום</h2></div>
  <div class="card">
    <div class="strip" style="grid-template-columns:repeat(${PLAN.length}, 1fr)">${PLAN.map(d => {
      const st = dayStats(d);
      let c = '';
      if (d.rest) c = 'rest';
      else if (st.complete) c = 'full';
      else if (st.done > 0) c = 'part';
      else if (d.date < tk) c = 'miss';
      if (d.date === tk) c += ' today';
      const dt = parseKey(d.date);
      return `<div class="c"><div class="sq ${c}">${st.complete ? '✓' : (d.rest || (!st.done && d.date > tk)) ? '' : n(st.done)}</div><div class="lbl">${WD[dt.getDay()].replace('שבת', 'ש׳')}</div></div>`;
    }).join('')}</div>
    <div class="legend"><span><i style="background:var(--success)"></i>הושלם</span><span><i style="background:var(--accent-soft-2)"></i>חלקי</span><span><i style="background:var(--warn-soft)"></i>פספוס</span></div>
  </div></div>

  <div class="section"><div class="section-head"><h2>לפי נושא</h2></div>
  <div class="card">${Object.entries(TOPICS).map(([k, tp]) => {
    const ts = allTasks.filter(t => t.topic === k);
    if (!ts.length) return '';
    const dn = ts.filter(t => isDone(t.id)).length;
    return `<div class="topic-row"><div class="hd">${esc(tp.name)}<span>${n(dn + '/' + ts.length)}</span></div>
      <div class="bar"><i style="width:${dn / ts.length * 100}%;background:var(--t-${tp.hue})"></i></div></div>`;
  }).join('')}</div></div>`;
  return html;
}

const VIEWS = { today: viewToday, plan: viewPlan, material: viewMaterial, progress: viewProgress };

function render(anim = true) {
  const v = $('#view');
  const y = window.scrollY;
  v.innerHTML = VIEWS[current]();
  v.style.animation = anim ? '' : 'none';
  if (anim) { v.classList.remove('view'); void v.offsetWidth; v.classList.add('view'); window.scrollTo(0, 0); }
  else window.scrollTo(0, y);
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.view === current;
    t.classList.toggle('active', on);
    t.setAttribute('aria-current', on ? 'page' : 'false');
  });
}

function go(view) { if (view === current) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } current = view; render(true); }

// ---------- Interactions ----------
function toggleTask(id) {
  const wasDay = PLAN.find(d => d.tasks.some(t => t.id === id));
  const before = dayStats(wasDay).complete;
  if (state.done[id]) delete state.done[id]; else state.done[id] = todayKey();
  save();
  render(false);
  document.querySelectorAll(`[data-task="${id}"]`).forEach(el => el.classList.add('pop'));
  if (isNative && Cap.Plugins.Haptics) Cap.Plugins.Haptics.impact({ style: 'LIGHT' }).catch(() => {});
  if (!before && dayStats(wasDay).complete && current !== 'today') toast('יום שלם הושלם 🎉');
  scheduleNotifications();
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-task]');
  if (t) { toggleTask(t.dataset.task); return; }
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const act = a.dataset.action;
  if (act === 'toggle-day') {
    const d = a.dataset.date;
    openDays.has(d) ? openDays.delete(d) : openDays.add(d);
    const el = a.closest('.day'); el.classList.toggle('open'); a.setAttribute('aria-expanded', el.classList.contains('open'));
  } else if (act === 'toggle-mat') {
    const id = a.dataset.id;
    openMat.has(id) ? openMat.delete(id) : openMat.add(id);
    const el = a.closest('.mat'); el.classList.toggle('open'); a.setAttribute('aria-expanded', el.classList.contains('open'));
  } else if (act === 'reveal') {
    const ans = a.nextElementSibling; ans.hidden = !ans.hidden; a.textContent = ans.hidden ? 'להציג תשובה' : 'להסתיר תשובה';
  } else if (act === 'goto') {
    if (a.dataset.view === 'material') openMat.add('checklist');
    go(a.dataset.view);
  } else if (act === 'settings') openSheet();
  else if (act === 'enable-notif') enableNotifications();
});

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => go(t.dataset.view)));

// ---------- Settings sheet ----------
function sheetHTML() {
  const s = state.settings;
  return `<div class="grabber"></div>
  <h2>הגדרות</h2>
  <div class="row"><div class="l"><div class="t">תזכורת יומית</div><div class="d">${isNative ? 'התראה עם המשימות של היום' : 'זמין באפליקציה המותקנת'}</div></div>
    <button class="switch" role="switch" aria-checked="${s.notif}" data-set="notif" aria-label="תזכורת יומית"></button></div>
  <div class="row"><div class="l"><div class="t">שעת התזכורת</div><div class="d">בשישי – בבוקר, לפני שבת</div></div>
    <input class="time-input" type="time" value="${s.remind}" data-set="remind" aria-label="שעת התזכורת"></div>
  <div class="row"><div class="l"><div class="t">תזכורת ערב</div><div class="d">ב-20:30, רק אם נשארו משימות</div></div>
    <button class="switch" role="switch" aria-checked="${s.evening}" data-set="evening" aria-label="תזכורת ערב"></button></div>
  <div class="row"><div class="l"><div class="t">מראה</div></div>
    <div class="seg" role="radiogroup" aria-label="מראה">
      ${[['auto', 'אוטומטי'], ['light', 'בהיר'], ['dark', 'כהה']].map(([v, l]) => `<button role="radio" aria-checked="${s.theme === v}" class="${s.theme === v ? 'on' : ''}" data-theme-set="${v}">${l}</button>`).join('')}
    </div></div>
  ${isNative ? `<button class="btn ghost block" data-sheet="test">לשלוח התראת בדיקה</button>` : ''}
  <button class="btn danger block" data-sheet="reset">לאפס את כל ההתקדמות</button>
  <p class="small-note">ההתראות לא נשלחות בשבת. ביום שישי התזכורת מוקדמת. ההתקדמות נשמרת רק במכשיר הזה.</p>`;
}
function openSheet() {
  const sh = $('#sheet'); sh.innerHTML = sheetHTML();
  $('#scrim').classList.add('show'); sh.classList.add('show'); sh.setAttribute('aria-hidden', 'false');
}
function closeSheet() { $('#scrim').classList.remove('show'); $('#sheet').classList.remove('show'); $('#sheet').setAttribute('aria-hidden', 'true'); }
$('#scrim').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', async e => {
  const sw = e.target.closest('.switch');
  if (sw) {
    const k = sw.dataset.set;
    if (k === 'notif' && !state.settings.notif) { await enableNotifications(); }
    else { state.settings[k] = !state.settings[k]; save(); scheduleNotifications(); }
    $('#sheet').innerHTML = sheetHTML(); render(false); return;
  }
  const th = e.target.closest('[data-theme-set]');
  if (th) { state.settings.theme = th.dataset.themeSet; save(); applyTheme(); $('#sheet').innerHTML = sheetHTML(); return; }
  const b = e.target.closest('[data-sheet]');
  if (!b) return;
  if (b.dataset.sheet === 'reset') {
    if (b.dataset.armed) { state.done = {}; save(); closeSheet(); render(false); scheduleNotifications(); toast('ההתקדמות אופסה'); }
    else { b.dataset.armed = '1'; b.textContent = 'בטוח? לחץ שוב לאיפוס'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'לאפס את כל ההתקדמות'; } }, 3500); }
  } else if (b.dataset.sheet === 'test') {
    if (!state.settings.notif) { toast('קודם צריך להפעיל תזכורות'); return; }
    await LN.schedule({ notifications: [{ id: 999, title: 'זה עובד 👋', body: 'ככה ייראו התזכורות היומיות שלך', channelId: 'study', schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true } }] });
    toast('ההתראה תגיע בעוד 3 שניות');
  }
});
$('#sheet').addEventListener('change', e => {
  if (e.target.dataset.set === 'remind' && e.target.value) { state.settings.remind = e.target.value; save(); scheduleNotifications(); toast('שעת התזכורת עודכנה'); }
});

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// ---------- Notifications ----------
async function enableNotifications() {
  if (!isNative) { toast('התראות זמינות באפליקציה המותקנת'); return; }
  try {
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') { toast('צריך לאשר התראות בהגדרות הטלפון'); return; }
    state.settings.notif = true; state.notifAsked = true; save();
    await scheduleNotifications();
    render(false);
    toast(`מעולה! תזכורת כל יום ב-${state.settings.remind}`);
  } catch (err) { toast('לא הצלחתי להפעיל התראות'); }
}

let scheduling = Promise.resolve();
function scheduleNotifications() { scheduling = scheduling.then(doSchedule).catch(() => {}); return scheduling; }
async function doSchedule() {
  if (!isNative) return;
  const pending = await LN.getPending();
  if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map(x => ({ id: x.id })) });
  if (!state.settings.notif) return;

  const list = [];
  const t = Date.now() + 30 * 1000;
  const at = (dateKey, hhmm) => { const d = parseKey(dateKey); const [h, m] = hhmm.split(':').map(Number); d.setHours(h, m, 0, 0); return d; };

  PLAN.forEach((day, i) => {
    if (day.rest) return;
    const st = dayStats(day);
    if (st.complete) return;
    const dow = parseKey(day.date).getDay();
    let rt = state.settings.remind;
    if (dow === 5 && rt > '10:00') rt = '09:30';
    const left = st.total - st.done;
    const first = day.tasks.find(x => !isDone(x.id));
    const when = at(day.date, rt);
    if (+when > t) list.push({
      id: 100 + i, channelId: 'study',
      title: `📚 היום: ${day.title}`,
      body: `${left} משימות · מתחילים ב${SOURCES[first.src]} – ${first.title}`,
      schedule: { at: when, allowWhileIdle: true },
    });
    if (state.settings.evening && dow !== 5) {
      const ev = at(day.date, '20:30');
      if (+ev > t && ev > when) list.push({
        id: 200 + i, channelId: 'study',
        title: 'עוד לא סיימת להיום',
        body: `נשארו ${left} משימות. גם משימה אחת עכשיו שווה הרבה 💪`,
        schedule: { at: ev, allowWhileIdle: true },
      });
    }
  });
  // exam eve + exam morning
  const eve = new Date(examAt()); eve.setDate(eve.getDate() - 1); eve.setHours(21, 30, 0, 0);
  if (+eve > t) list.push({ id: 300, channelId: 'study', title: 'מחר המבחן 🎯', body: 'עבור על רשימת הבדיקה ולך לישון מוקדם. אתה מוכן.', schedule: { at: eve, allowWhileIdle: true } });
  const morning = new Date(examAt()); morning.setHours(6, 45, 0, 0);
  if (+morning > t) list.push({ id: 301, channelId: 'study', title: 'בהצלחה במבחן! 🍀', body: 'נשום עמוק, קרא כל שאלה פעמיים, ותתחיל ממה שאתה בטוח בו.', schedule: { at: morning, allowWhileIdle: true } });

  if (list.length) await LN.schedule({ notifications: list });
}

// ---------- Boot ----------
async function boot() {
  applyTheme();
  render(true);
  if (isNative) {
    try { await LN.createChannel({ id: 'study', name: 'תזכורות לימוד', description: 'תזכורת יומית למשימות', importance: 4, visibility: 1, vibration: true }); } catch (e) {}
    try {
      const p = await LN.checkPermissions();
      if (state.settings.notif && p.display !== 'granted') { state.settings.notif = false; save(); render(false); }
    } catch (e) {}
    scheduleNotifications();
    if (AppPlugin) {
      AppPlugin.addListener('backButton', () => {
        if ($('#sheet').classList.contains('show')) closeSheet();
        else if (current !== 'today') go('today');
        else AppPlugin.exitApp();
      });
      AppPlugin.addListener('resume', () => { render(false); scheduleNotifications(); });
    }
    LN.addListener('localNotificationActionPerformed', () => { current = 'today'; render(true); });
  }
  // refresh when the day changes while the app is open
  let lastKey = todayKey();
  setInterval(() => { const k = todayKey(); if (k !== lastKey) { lastKey = k; render(false); } }, 60 * 1000);
}
boot();
})();
