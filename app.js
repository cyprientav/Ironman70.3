/* Prépa 70.3 — PWA de suivi d'entraînement (IRONMAN 70.3 Rapperswil-Jona, 6 juin 2027) */
(() => {
'use strict';

// ---------- Utilitaires ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('p703:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('p703:' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('p703:' + k); } catch {} }
};
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };
const today = () => { const q = new URLSearchParams(location.search).get('date'); return q ? parseD(q) : new Date(); };
const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const fmtDay = d => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
const fmtShort = d => `${d.getDate()} ${MOIS[d.getMonth()]}`;
const fmtH = min => { min = Math.round(min); if (min < 60) return `${min} min`; const h = Math.floor(min / 60), m = min % 60; return m ? `${h} h ${pad(m)}` : `${h} h`; };
const fmtPace = s => { s = Math.round(s); return `${Math.floor(s / 60)}'${pad(s % 60)}`; };
const daysBetween = (a, b) => Math.round((parseD(iso(b)) - parseD(iso(a))) / 864e5);

// ---------- Sports ----------
const SP = {
  'Natation': { key: 'swim', color: 'var(--swim)', icon: '<svg viewBox="0 0 24 24"><path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M2 13c2 0 2-1.5 4-1.5S8 13 10 13s2-1.5 4-1.5 2 1.5 4 1.5"/><circle cx="16" cy="6" r="2"/><path d="m8 10 4-3 3 3"/></svg>' },
  'Vélo': { key: 'bike', color: 'var(--bike)', icon: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><circle cx="15" cy="5" r="1.5"/><path d="M12 17v-4l-3-3 4-3 2 3h3"/></svg>' },
  'Course': { key: 'run', color: 'var(--run)', icon: '<svg viewBox="0 0 24 24"><circle cx="14" cy="4" r="2"/><path d="M7 21l3-6 3 2v5M13 9l-4 1-2 4M13 9l2 3 4 1M10 15l3-6"/></svg>' },
  'Renfo': { key: 'str', color: 'var(--str)', icon: '<svg viewBox="0 0 24 24"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/></svg>' },
  'Repos': { key: 'rest', color: 'var(--rest)', icon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' },
  'Triathlon': { key: 'tri', color: 'var(--accent)', icon: '<svg viewBox="0 0 24 24"><path d="M4 21V4M4 4h12l-2 4 2 4H4"/></svg>' },
  'Autre': { key: 'other', color: 'var(--rest)', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>' }
};
const STRAVA_SP = { Run: 'Course', TrailRun: 'Course', VirtualRun: 'Course', Ride: 'Vélo', VirtualRide: 'Vélo', GravelRide: 'Vélo', MountainBikeRide: 'Vélo', EBikeRide: 'Vélo', Swim: 'Natation', WeightTraining: 'Renfo', Workout: 'Renfo', Crossfit: 'Renfo', Yoga: 'Renfo' };
const spOf = a => STRAVA_SP[a.sp] || 'Autre';
const icon = (sp, css = '') => { const s = SP[sp] || SP.Autre; return `<div class="sp-icon" style="background:${s.color};${css}">${s.icon}</div>`; };

// ---------- Références (zones) ----------
const DEFAULT_REFS = { css: 105, ftp: 248, thr: 258, weight: 82.8 };
let refs = Object.assign({}, DEFAULT_REFS, store.get('refs', {}));
function zoneHints(sport, z) {
  if (!z) return [];
  const toks = [];
  const s = z.toLowerCase();
  if (s.includes('sweet')) toks.push('SS');
  if (s.includes('70.3')) toks.push('70');
  const m = s.match(/z(\d)(?:\s*-\s*z(\d))?/g) || [];
  m.forEach(t => { const r = t.match(/z(\d)(?:\s*-\s*z(\d))?/); const a = +r[1], b = r[2] ? +r[2] : a; for (let i = a; i <= b; i++) toks.push('Z' + i); });
  const out = [];
  const uniq = [...new Set(toks)];
  for (const t of uniq) {
    if (sport === 'Vélo') {
      const P = { Z1: [0, .55], Z2: [.56, .75], Z3: [.76, .87], SS: [.88, .94], Z4: [.95, 1.05], Z5: [1.06, 1.2], '70': [.75, .79] }[t];
      if (P) out.push(`${t === 'SS' ? 'Sweet spot' : t === '70' ? 'Allure 70.3' : t} : <b>${P[0] ? Math.round(P[0] * refs.ftp) : '<'} ${P[0] ? '–' : ''} ${Math.round(P[1] * refs.ftp)} W</b>`);
    } else if (sport === 'Course') {
      const C = { Z1: [1.41, 1.55], Z2: [1.24, 1.40], '70': [1.19, 1.23], Z3: [1.06, 1.14], Z4: [.98, 1.05], Z5: [.90, .97] }[t];
      if (C) out.push(`${t === '70' ? 'Allure 70.3' : t} : <b>${fmtPace(C[0] * refs.thr)} – ${fmtPace(C[1] * refs.thr)} /km</b>`);
    } else if (sport === 'Natation') {
      const N = { Z1: [15, 25], Z2: [8, 14], Z3: [3, 7], '70': [3, 7], Z4: [-2, 2], Z5: [-8, -3] }[t];
      if (N) out.push(`${t === '70' ? 'Allure 70.3' : t} : <b>${fmtPace(refs.css + N[0])} – ${fmtPace(refs.css + N[1])} /100 m</b>`);
    }
  }
  return out;
}

// ---------- Données ----------
let PLAN = null, ACTS = [], ACTS_UPDATED = null;
const byDate = {};          // date -> séances planifiées
const actsByDate = {};      // date -> activités
let done = store.get('done', {});   // clé séance -> {rpe, note, at}

async function loadJSON(url, fresh) {
  const r = await fetch(fresh ? `${url}?t=${Date.now()}` : url, { cache: fresh ? 'no-store' : 'no-cache' });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}
async function loadData() {
  if (!PLAN) {
    PLAN = await loadJSON('data/plan.json');
    for (const k in byDate) delete byDate[k];
    PLAN.sessions.forEach((s, i) => { s.key = `${s.d}#${i}`; (byDate[s.d] ||= []).push(s); });
  }
  let base = [];
  try { const a = await loadJSON('data/activities.json', true); base = a.activities || []; ACTS_UPDATED = a.updated; store.set('serverActs', a); }
  catch { const c = store.get('serverActs'); if (c) { base = c.activities || []; ACTS_UPDATED = c.updated; } }
  const local = store.get('acts', []);
  const m = new Map(); [...base, ...local].forEach(a => m.set(String(a.id), a));
  ACTS = [...m.values()].sort((a, b) => a.t.localeCompare(b.t));
  const lu = store.get('actsUpdated'); if (lu && (!ACTS_UPDATED || lu > ACTS_UPDATED)) ACTS_UPDATED = lu;
  for (const k in actsByDate) delete actsByDate[k];
  ACTS.forEach(a => (actsByDate[a.t.slice(0, 10)] ||= []).push(a));
}

// Associe chaque séance prévue d'une journée à une activité Strava du même sport
function matchDay(dateStr) {
  const plan = (byDate[dateStr] || []).filter(s => s.sp !== 'Repos');
  const acts = (actsByDate[dateStr] || []).slice();
  const used = new Set(), res = new Map();
  plan.forEach(s => {
    let best = -1, bd = 1e9;
    acts.forEach((a, i) => { if (used.has(i)) return; const sp = spOf(a); if (sp !== s.sp && !(s.sp === 'Triathlon')) return; const d = Math.abs(a.s / 60 - s.min); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { used.add(best); res.set(s.key, acts[best]); }
  });
  const extra = acts.filter((_, i) => !used.has(i));
  return { res, extra };
}
const isDone = (s, matched) => !!(matched || done[s.key]);

// ---------- Charge (TSS estimé) ----------
function tssOf(a) {
  const h = a.s / 3600, sp = spOf(a);
  let IF = .65;
  if (sp === 'Course' && a.km > 0) IF = Math.min(1.1, refs.thr / (a.s / a.km));
  else if (sp === 'Natation' && a.km > 0) IF = Math.min(1.1, refs.css / (a.s / (a.km * 10)));
  else if (sp === 'Vélo') IF = a.sp === 'VirtualRide' ? .72 : .68;
  else if (sp === 'Renfo') IF = .6;
  else IF = .5;
  return Math.round(h * IF * IF * 100);
}
function loadSeries(endDate) {
  const daily = {}; ACTS.forEach(a => { const d = a.t.slice(0, 10); daily[d] = (daily[d] || 0) + tssOf(a); });
  const first = ACTS.length ? parseD(ACTS[0].t) : addDays(endDate, -90);
  let ctl = 0, atl = 0; const out = [];
  for (let d = new Date(first); d <= endDate; d = addDays(d, 1)) {
    const t = daily[iso(d)] || 0; ctl += (t - ctl) / 42; atl += (t - atl) / 7;
    out.push({ d: iso(d), tss: t, ctl, atl, tsb: ctl - atl });
  }
  return out;
}

// ---------- Semaine ----------
const weekOfDate = d => { const mon = iso(monday(d)); return PLAN.weeks.find(w => w.mon === mon) || null; };
function weekStats(mon) {
  const per = { 'Natation': [0, 0], 'Vélo': [0, 0], 'Course': [0, 0], 'Renfo': [0, 0] };
  let planned = 0, doneMin = 0, nPlan = 0, nDone = 0;
  for (let i = 0; i < 7; i++) {
    const ds = iso(addDays(mon, i));
    (byDate[ds] || []).forEach(s => { if (per[s.sp]) { per[s.sp][0] += s.min; planned += s.min; nPlan++; } });
    const { res } = matchDay(ds);
    (byDate[ds] || []).forEach(s => { if (s.sp !== 'Repos' && isDone(s, res.get(s.key))) nDone++; });
    (actsByDate[ds] || []).forEach(a => { const sp = spOf(a); if (per[sp]) { per[sp][1] += a.s / 60; doneMin += a.s / 60; } });
    (byDate[ds] || []).forEach(s => { if (done[s.key] && !res.get(s.key) && per[s.sp]) { per[s.sp][1] += s.min; doneMin += s.min; } });
  }
  return { per, planned, doneMin, nPlan, nDone };
}

// ---------- Rendu des séances ----------
function sessionCard(s, matched) {
  const ok = isDone(s, matched);
  const hints = zoneHints(s.sp, s.z);
  const d = done[s.key];
  const isPast = s.d < iso(today());
  let status = '';
  if (matched) status = `<span class="chip ok">Validée par Strava · ${fmtH(matched.s / 60)}${matched.km ? ' · ' + (s.sp === 'Natation' ? Math.round(matched.km * 1000) + ' m' : matched.km.toFixed(1).replace('.', ',') + ' km') : ''}</span>`;
  else if (d) status = `<span class="chip ok">Faite${d.rpe ? ' · RPE ' + d.rpe : ''}</span>`;
  else if (isPast && s.sp !== 'Repos') status = `<span class="chip warn">Non réalisée</span>`;
  return `<div class="session" data-key="${esc(s.key)}">
    ${icon(s.sp)}
    <div class="grow">
      <div class="title">${esc(s.t)}</div>
      ${s.min || s.z ? `<div class="facts">${s.min ? fmtH(s.min) : ''}${s.min && s.z ? ' · ' : ''}${s.z ? `<span class="z">${esc(s.z)}</span>` : ''}</div>` : ''}
      <div class="desc">${esc(s.desc)}</div>
      ${hints.length ? `<div class="hint">${hints.map(h => `<span>${h}</span>`).join('')}</div>` : ''}
      ${status ? `<div class="status">${status}</div>` : ''}
    </div>
    ${s.sp !== 'Repos' ? `<button class="check ${matched ? 'strava' : ok ? 'on' : ''}" data-act="toggle" data-key="${esc(s.key)}" aria-pressed="${ok}" aria-label="${esc(s.t)} : ${matched ? 'validée par Strava' : ok ? 'faite, modifier' : 'valider la séance'}"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></i></button>` : ''}
  </div>`;
}
const extraLine = a => `<div class="extra">${icon(spOf(a))}<span class="truncate">Hors plan : ${esc(a.n)} · ${fmtH(a.s / 60)}</span></div>`;

// ---------- Vues ----------
const views = {};

views.today = () => {
  const t = today(), ds = iso(t), race = parseD(PLAN.race);
  const wk = weekOfDate(t);
  const firstMon = parseD(PLAN.weeks[0].mon);
  let html = '';
  // Héro : progression vers la course
  const total = daysBetween(firstMon, race), elapsed = Math.max(0, daysBetween(firstMon, t));
  const pct = Math.min(100, Math.round(elapsed / total * 100));
  html += `<div class="card prep" id="prep">
    <div class="prep-top"><div class="grow"><div class="k">${wk ? `Semaine ${wk.w} sur 28 · ${esc(wk.ph)} · ${esc(wk.type)}` : t < firstMon ? 'Le plan démarre le lundi 23 novembre' : 'Après la course'}</div>
    <div class="v">${wk ? esc(wk.goal) : t < firstMon ? 'Semaine de transition : reste souple' : 'Bravo, Ironman !'}</div></div>
    <img class="badge" src="icons/badge.png" alt="" width="64" height="64"></div>
    <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avancement de la préparation"><i style="--p:${pct / 100}"></i></div>
    <div class="foot"><span>${pct} % de la préparation</span><span>Course le 6 juin 2027</span></div>
  </div>`;

  // Séances du jour
  const todays = byDate[ds] || [];
  const { res, extra } = matchDay(ds);
  html += `<h2>${esc(fmtDay(t))}</h2><div class="card">`;
  if (todays.length) html += todays.map(s => sessionCard(s, res.get(s.key))).join('');
  else html += `<div class="empty"><p>Pas de séance prévue aujourd'hui. Profite-en pour récupérer.</p><button class="btn sec" data-act="gotoweek">Voir la semaine</button></div>`;
  extra.forEach(a => html += extraLine(a));
  html += `</div>`;

  // Prochaine séance si aujourd'hui = repos / avant plan
  const nextDays = [];
  for (let i = 1; i <= 10 && nextDays.length < 2; i++) { const d = addDays(t, i); const ss = (byDate[iso(d)] || []).filter(s => s.sp !== 'Repos'); if (ss.length) nextDays.push([d, ss]); }
  nextDays.forEach(([d, ss], i) => {
    html += `<h2>${i === 0 && daysBetween(t, d) === 1 ? 'Demain · ' : ''}${esc(fmtDay(d))}</h2><div class="card">${ss.map(s => sessionCard(s, null)).join('')}</div>`;
  });

  // Semaine en cours
  const mon = monday(t), st = weekStats(mon);
  if (st.planned) {
    html += `<h2>Cette semaine</h2><div class="kpis">
      <div class="kpi"><div class="l">Réalisé</div><div class="n">${fmtH(st.doneMin)}</div><div class="s">sur ${fmtH(st.planned)}</div></div>
      <div class="kpi"><div class="l">Séances</div><div class="n">${st.nDone}/${st.nPlan}</div><div class="s">faites</div></div>
      <div class="kpi"><div class="l">Forme (TSB)</div><div class="n">${tsbNow()}</div><div class="s">${tsbLabel()}</div></div></div>
      <div class="meta-t" style="padding:0 4px;margin-top:-4px">${esc(syncStatus())}</div>`;
  }

  // Tests / courses à venir
  const nextTest = PLAN.tests.find(x => x.d >= iso(mon));
  if (nextTest) html += `<h2>Prochain test</h2><div class="card"><div class="row"><span class="chip accent">S${nextTest.w}</span><div class="grow"><b>${esc(nextTest.test)}</b><div class="small muted">Semaine du ${esc(fmtShort(parseD(nextTest.d)))}${nextTest.ref ? ' · réf. ' + esc(nextTest.ref) : ''}</div></div></div><div class="small muted" style="margin-top:8px">${esc(nextTest.proto)}</div></div>`;

  // Conseil du jour
  const tip = PLAN.tips[(daysBetween(firstMon, t) % PLAN.tips.length + PLAN.tips.length) % PLAN.tips.length];
  html += `<h2>Conseil du jour</h2><div class="card tip"><div class="meta-t">${esc(tip.s)}</div><div class="k">${esc(tip.k)}</div><div class="v">${esc(tip.v)}</div></div>`;

  // Installation
  if (!isStandalone()) html += installCard();
  return html;
};

let weekOffset = 0;
views.week = () => {
  const mon = addDays(monday(today()), weekOffset * 7);
  const wk = PLAN.weeks.find(w => w.mon === iso(mon));
  const st = weekStats(mon);
  let html = `<div class="weeknav">
    <button class="iconbtn" data-act="wprev" aria-label="Semaine précédente" title="Semaine précédente"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div class="mid" aria-live="polite"><b>${wk ? 'Semaine ' + wk.w : 'Hors plan'}</b><div class="small muted">${esc(fmtShort(mon))} – ${esc(fmtShort(addDays(mon, 6)))}${wk ? ' · ' + esc(wk.ph) : ''}</div></div>
    <button class="iconbtn" data-act="wnext" aria-label="Semaine suivante" title="Semaine suivante"><svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></button>
  </div>`;
  if (wk) html += `<div class="card"><div class="meta-t">${esc(wk.type)}</div><div style="font-weight:600;margin-top:2px">${esc(wk.goal)}</div>${wk.tests ? `<div class="small" style="margin-top:6px">🎯 ${esc(wk.tests)}</div>` : ''}${wk.notes ? `<div class="small muted" style="margin-top:4px">${esc(wk.notes)}</div>` : ''}</div>`;
  html += `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="tnum"><b style="font-weight:600;font-size:var(--fs-lg)">${fmtH(st.doneMin)}</b> <span class="muted small">sur ${fmtH(st.planned)} prévus</span></span><span class="small muted tnum">${st.nDone}/${st.nPlan} séances</span></div><div class="sportbars">`;
  for (const sp of ['Natation', 'Vélo', 'Course', 'Renfo']) {
    const [p, d] = st.per[sp]; if (!p && !d) continue;
    const pc = p ? Math.min(100, d / p * 100) : 100;
    html += `<div class="sb"><div class="top2"><span>${sp}</span><span class="muted">${fmtH(d)} / ${fmtH(p)}</span></div><div class="track"><div class="fill" style="--p:${pc / 100};background:${SP[sp].color}"></div></div></div>`;
  }
  html += `</div></div>`;
  const tds = iso(today());
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), ds = iso(d);
    const ss = byDate[ds] || [], { res, extra } = matchDay(ds);
    if (!ss.length && !extra.length) continue;
    html += `<div class="card day ${ds === tds ? 'today' : ''}"><div class="dayhead"><b>${esc(fmtDay(d))}</b>${ds === tds ? '<span class="chip accent">Aujourd\'hui</span>' : ''}</div>${ss.map(s => sessionCard(s, res.get(s.key))).join('')}${extra.map(extraLine).join('')}</div>`;
  }
  return html;
};

views.plan = () => {
  const cur = iso(monday(today()));
  let html = `<h2>Courses 2027</h2><div class="card">${[
    ['2027-04-11', 'Semi-marathon de Zurich', 'Date à confirmer · à courir à l\'allure 70.3'],
    ['2027-04-25', 'Triathlon M de Cannes', 'Répétition de course'],
    ['2027-06-06', 'IRONMAN 70.3 Rapperswil-Jona', 'Objectif principal · 1,9 / 90 / 21,1 km']
  ].map(([d, n, s], i) => { const dd = parseD(d); return `<div class="race ${i === 2 ? 'main' : ''}"><div class="date"><b>${dd.getDate()}</b><span>${MOIS[dd.getMonth()]}</span></div><div class="grow"><div style="font-weight:600">${esc(n)}</div><div class="small muted">${esc(s)}</div></div><span class="small muted tnum">J-${Math.max(0, daysBetween(today(), dd))}</span></div>`; }).join('')}</div>`;
  let ph = null;
  PLAN.weeks.forEach(w => {
    if (w.ph !== ph) { if (ph) html += `</div>`; ph = w.ph; html += `<h2>${esc(ph)}</h2><div class="list">`; }
    const tot = w.h.swim + w.h.bike + w.h.run + w.h.str || 1;
    html += `<button class="wk ${w.mon === cur ? 'cur' : w.mon < cur ? 'past' : ''}" data-act="openweek" data-mon="${w.mon}" aria-label="Ouvrir la semaine ${w.w}${w.mon === cur ? ' (en cours)' : ''}">
      <div class="num">${w.w}</div>
      <div class="grow"><div class="row" style="justify-content:space-between;gap:8px"><span style="font-weight:600">Sem. du ${esc(fmtShort(parseD(w.mon)))}</span><span class="small muted tnum">${fmtH(w.tot * 60)}</span></div>
      <div class="small muted truncate">${esc(w.type)} · ${esc(w.goal)}</div>
      <div class="mini"><i style="width:${w.h.swim / tot * 100}%;background:var(--swim)"></i><i style="width:${w.h.bike / tot * 100}%;background:var(--bike)"></i><i style="width:${w.h.run / tot * 100}%;background:var(--run)"></i><i style="width:${w.h.str / tot * 100}%;background:var(--str)"></i></div></div>
      <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
    </button>`;
  });
  html += `</div>`;
  html += `<h2>Zones de référence</h2><div class="card small">
    <div>Natation CSS <b>${fmtPace(refs.css)} /100 m</b> · Vélo FTP <b>${refs.ftp} W</b> (${(refs.ftp / refs.weight).toFixed(1)} W/kg) · Course seuil <b>${fmtPace(refs.thr)} /km</b></div>
    <div class="muted" style="margin-top:8px">Mets-les à jour dans Réglages après chaque test : les allures cibles des séances se recalculent.</div></div>`;
  html += `<h2>Plan de course (jour J)</h2><div class="card">${PLAN.tips.filter(t => t.s && t.s.startsWith('Plan de course')).map(t => `<div style="margin-bottom:12px"><div style="font-weight:600">${esc(t.k)}</div><div class="small muted">${esc(t.v)}</div></div>`).join('')}</div>`;
  return html;
};

function tsbNow() { const s = loadSeries(today()); const l = s[s.length - 1]; return l ? (l.tsb > 0 ? '+' : '') + Math.round(l.tsb) : '–'; }
function tsbLabel() { const s = loadSeries(today()); const v = s.length ? s[s.length - 1].tsb : 0; return v < -25 ? 'très chargé' : v < -10 ? 'charge productive' : v < 5 ? 'équilibré' : 'frais'; }

views.stats = () => {
  const t = today(), ser = loadSeries(t), last = ser[ser.length - 1] || { ctl: 0, atl: 0, tsb: 0 };
  let html = `<div class="kpis">
    <div class="kpi"><div class="l">Forme de fond</div><div class="n">${Math.round(last.ctl)}</div><div class="s">CTL</div></div>
    <div class="kpi"><div class="l">Fatigue</div><div class="n">${Math.round(last.atl)}</div><div class="s">ATL</div></div>
    <div class="kpi"><div class="l">Fraîcheur</div><div class="n">${last.tsb > 0 ? '+' : ''}${Math.round(last.tsb)}</div><div class="s">TSB · ${tsbLabel()}</div></div></div>`;
  html += `<h2>Volume par semaine</h2><div class="card"><div class="chartwrap" id="ch-vol"></div>
    <div class="legend"><span><i style="background:var(--swim)"></i>Natation</span><span><i style="background:var(--bike)"></i>Vélo</span><span><i style="background:var(--run)"></i>Course</span><span><i style="background:var(--str)"></i>Renfo</span><span><i style="background:transparent;border:1.5px dashed var(--muted)"></i>Prévu</span></div></div>`;
  html += `<h2>Charge d'entraînement (90 jours)</h2><div class="card"><div class="chartwrap" id="ch-load"></div>
    <div class="legend"><span><i style="background:var(--swim)"></i>CTL forme</span><span><i style="background:var(--accent)"></i>ATL fatigue</span><span><i style="background:var(--ok)"></i>TSB fraîcheur</span></div>
    <div class="meta-t" style="margin-top:8px">TSS estimé à partir de la durée et de l'allure (pas de puissance ni de FC dans les données) : à lire comme une tendance.</div></div>`;
  html += `<h2>Dernières activités</h2><div class="card">${ACTS.slice(-12).reverse().map(a => `<div class="act">${icon(spOf(a))}<div class="grow"><div class="truncate" style="font-weight:500">${esc(a.n)}</div><div class="small muted">${esc(fmtDay(parseD(a.t)))} · ${fmtH(a.s / 60)}${a.km ? ' · ' + (spOf(a) === 'Natation' ? Math.round(a.km * 1000) + ' m' : a.km.toFixed(1) + ' km') : ''}${spOf(a) === 'Course' && a.km ? ' · ' + fmtPace(a.s / a.km) + '/km' : ''}${spOf(a) === 'Natation' && a.km ? ' · ' + fmtPace(a.s / (a.km * 10)) + '/100 m' : ''}</div></div><span class="tss">${tssOf(a)} TSS</span></div>`).join('')}</div>
    <div class="meta-t" style="padding:0 4px">Données Strava${ACTS_UPDATED ? ' · mises à jour le ' + esc(fmtShort(parseD(ACTS_UPDATED))) + ' à ' + esc(ACTS_UPDATED.slice(11, 16)) : ''}</div>`;
  return html;
};
function afterStats() {
  // Volume : 12 dernières semaines + 4 à venir
  const t = today(), mon0 = monday(t), weeks = [];
  for (let i = -11; i <= 4; i++) { const m = addDays(mon0, i * 7); const st = weekStats(m); weeks.push({ m, st, cur: i === 0 }); }
  const el = $('#ch-vol'); if (!el) return;
  const W = el.clientWidth, H = 180, pl = 26, pb = 18, pt = 6;
  const maxH = Math.max(12, ...weeks.map(w => Math.max(w.st.planned, w.st.doneMin) / 60));
  const bw = (W - pl) / weeks.length;
  const y = v => pt + (H - pt - pb) * (1 - v / maxH);
  let svg = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  for (let g = 0; g <= maxH; g += 4) svg += `<line x1="${pl}" x2="${W}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 6}" y="${y(g) + 3}" text-anchor="end">${g}h</text>`;
  weeks.forEach((w, i) => {
    const x = pl + i * bw + bw * .18, bwi = bw * .64;
    let acc = 0;
    ['Natation', 'Vélo', 'Course', 'Renfo'].forEach(sp => { const v = w.st.per[sp][1] / 60; if (!v) return; svg += `<rect x="${x}" y="${y(acc + v)}" width="${bwi}" height="${y(acc) - y(acc + v)}" fill="${SP[sp].color}" rx="1.5"/>`; acc += v; });
    if (w.st.planned) svg += `<rect x="${x - 1}" y="${y(w.st.planned / 60)}" width="${bwi + 2}" height="${y(0) - y(w.st.planned / 60)}" fill="none" stroke="var(--muted)" stroke-dasharray="3 2" stroke-width="1.2" rx="2"/>`;
    svg += `<rect x="${pl + i * bw}" y="0" width="${bw}" height="${H}" fill="transparent" data-tip="Sem. du ${fmtShort(w.m)} : ${fmtH(w.st.doneMin)}${w.st.planned ? ' / ' + fmtH(w.st.planned) + ' prévus' : ''}"/>`;
    const ci = weeks.findIndex(x => x.cur);
    if (w.cur || (i % 2 === (ci % 2) && Math.abs(i - ci) > 1)) svg += `<text x="${Math.min(x + bwi / 2, W - 16)}" y="${H - 4}" text-anchor="middle" ${w.cur ? 'style="fill:var(--accent);font-weight:700"' : ''}>${w.m.getDate()}/${w.m.getMonth() + 1}</text>`;
  });
  el.innerHTML = svg + '</svg>'; tooltips(el);

  const el2 = $('#ch-load'); const ser = loadSeries(t).slice(-90);
  if (!el2 || !ser.length) return;
  const W2 = el2.clientWidth, H2 = 180, pl2 = 26, pb2 = 18;
  const mx = Math.max(...ser.map(s => Math.max(s.ctl, s.atl))) * 1.1, mn = Math.min(0, ...ser.map(s => s.tsb)) * 1.1;
  const X = i => pl2 + (W2 - pl2) * i / (ser.length - 1), Y = v => 6 + (H2 - 6 - pb2) * (1 - (v - mn) / (mx - mn));
  const path = k => ser.map((s, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(s[k]).toFixed(1)).join('');
  let s2 = `<svg class="chart" width="${W2}" height="${H2}" viewBox="0 0 ${W2} ${H2}">`;
  [mn, 0, mx / 2, mx].forEach(g => { g = Math.round(g); s2 += `<line x1="${pl2}" x2="${W2}" y1="${Y(g)}" y2="${Y(g)}" stroke="var(--line)"/><text x="${pl2 - 6}" y="${Y(g) + 3}" text-anchor="end">${g}</text>`; });
  s2 += `<path d="${path('tsb')}" fill="none" stroke="var(--ok)" stroke-width="1.5" opacity=".8"/><path d="${path('atl')}" fill="none" stroke="var(--accent)" stroke-width="1.5"/><path d="${path('ctl')}" fill="none" stroke="var(--swim)" stroke-width="2.5"/>`;
  ser.forEach((s, i) => { if (i % 30 === 0) { const d = parseD(s.d); s2 += `<text x="${X(i)}" y="${H2 - 4}" text-anchor="${i ? 'middle' : 'start'}">${fmtShort(d)}</text>`; } });
  const step = (W2 - pl2) / ser.length;
  ser.forEach((s, i) => s2 += `<rect x="${X(i) - step / 2}" y="0" width="${step}" height="${H2}" fill="transparent" data-tip="${fmtShort(parseD(s.d))} · CTL ${Math.round(s.ctl)} · ATL ${Math.round(s.atl)} · TSB ${Math.round(s.tsb)}"/>`);
  el2.innerHTML = s2 + '</svg>'; tooltips(el2);
}
function tooltips(el) {
  let tip = null;
  const show = e => { const r = e.target.closest('[data-tip]'); if (!r) return; tip ||= Object.assign(document.createElement('div'), { className: 'tt' }); el.appendChild(tip); tip.textContent = r.getAttribute('data-tip'); const b = el.getBoundingClientRect(), rb = r.getBoundingClientRect(); let x = rb.left + rb.width / 2 - b.left; x = Math.max(70, Math.min(b.width - 70, x)); tip.style.left = x + 'px'; tip.style.top = '20px'; };
  el.addEventListener('pointermove', show); el.addEventListener('pointerdown', show);
  el.addEventListener('pointerleave', () => tip && tip.remove());
}

// ---------- Réglages ----------
views.settings = () => {
  const ps = store.get('push', null), st = store.get('strava', {});
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  let html = '';
  if (!isStandalone()) html += installCard();
  html += `<h2>Notifications</h2><div class="card">
    <div class="small muted" style="margin-bottom:10px">Chaque matin, une notification avec ta séance du jour, et le dimanche soir l'aperçu de la semaine.${isIOS() && !isStandalone() ? ' <b>Sur iPhone, installe d\'abord l\'app sur l\'écran d\'accueil</b> : les notifications ne marchent que depuis l\'app installée.' : ''}</div>
    <div class="btnrow">
      <button class="btn" data-act="push-on" ${perm === 'unsupported' ? 'disabled' : ''}>${ps ? 'Régénérer le code' : 'Activer les notifications'}</button>
      <button class="btn sec" data-act="push-test" ${perm !== 'granted' ? 'disabled' : ''}>Envoyer un test</button>
    </div>
    <div class="meta-t" style="margin-top:8px">Autorisation : ${({ granted: 'accordée', denied: 'refusée (à changer dans Réglages iOS › Notifications)', default: 'pas encore demandée', unsupported: 'non disponible ici' })[perm]}</div>
    ${ps ? `<div class="field" style="margin-top:12px"><label>Code de notifications à coller dans le secret GitHub <b>PUSH_CONFIG</b> (une seule fois)</label><textarea readonly id="pushcode">${esc(JSON.stringify(ps.config))}</textarea></div><button class="btn sec block" data-act="copy" data-target="pushcode">Copier le code</button>` : ''}
    <div class="small muted" style="margin-top:16px">Sans serveur : ajoute toutes les séances à ton calendrier iPhone, avec un rappel à 7 h le jour même.</div>
    <a class="btn sec block" style="margin-top:8px" href="plan.ics">Ajouter le plan au calendrier</a>
  </div>`;
  html += `<h2>Strava</h2><div class="card">
    <div class="small muted" style="margin-bottom:12px">${st.refresh ? `Connecté${st.athlete ? ' (' + esc(st.athlete) + ')' : ''}. Tes activités se synchronisent à chaque ouverture.` : 'Connecte ton compte pour synchroniser tes activités en direct. Il te faut une « application API » Strava (gratuite) : strava.com/settings/api, domaine de rappel = l\'adresse de cette app.'}</div>
    ${st.refresh ? `<div class="btnrow"><button class="btn" data-act="sync">Synchroniser maintenant</button><button class="btn sec" data-act="strava-off">Déconnecter Strava</button></div>` : `
    <div class="grid2"><div class="field"><label for="s-id">Client ID</label><input id="s-id" inputmode="numeric" autocomplete="off" value="${esc(st.id || '')}"></div>
    <div class="field"><label for="s-secret">Client Secret</label><input id="s-secret" type="password" autocomplete="off" value="${esc(st.secret || '')}"></div></div>
    <button class="btn block" data-act="strava-connect">Connecter Strava</button>`}
    ${st.refresh ? `<div class="field" style="margin-top:16px"><label for="stravacode">Synchro automatique (toutes les 20 min, même app fermée) : colle ce code une seule fois dans le secret GitHub <b>STRAVA_CONFIG</b></label><textarea readonly id="stravacode">${esc(JSON.stringify({ client_id: st.id, client_secret: st.secret, refresh_token: st.refresh }))}</textarea></div><button class="btn sec block" data-act="copy" data-target="stravacode">Copier le code</button>` : ''}
    <div class="meta-t" style="margin-top:8px">${esc(syncStatus())}</div>
    <div class="meta-t" style="margin-top:4px">Les identifiants restent sur ton iPhone. Garmin Connect se synchronise déjà vers Strava, c'est donc Strava qui alimente l'app.</div>
  </div>`;
  html += `<h2>Mes références</h2><div class="card">
    <div class="grid2">
      <div class="field"><label for="r-ftp">FTP vélo (W)</label><input id="r-ftp" data-v="int" inputmode="numeric" value="${refs.ftp}" aria-describedby="e-ftp"><span class="err" id="e-ftp"></span></div>
      <div class="field"><label for="r-weight">Poids (kg)</label><input id="r-weight" data-v="dec" inputmode="decimal" value="${String(refs.weight).replace('.', ',')}" aria-describedby="e-weight"><span class="err" id="e-weight"></span></div>
      <div class="field"><label for="r-css">CSS natation (/100 m)</label><input id="r-css" data-v="pace" inputmode="numeric" value="${fmtPace(refs.css)}" placeholder="1'45" aria-describedby="e-css"><span class="err" id="e-css"></span></div>
      <div class="field"><label for="r-thr">Seuil course (/km)</label><input id="r-thr" data-v="pace" inputmode="numeric" value="${fmtPace(refs.thr)}" placeholder="4'18" aria-describedby="e-thr"><span class="err" id="e-thr"></span></div>
    </div>
    <button class="btn block" data-act="saverefs">Enregistrer les références</button>
  </div>`;
  html += `<h2>Données</h2><div class="card small"><div class="muted">${PLAN.sessions.length} séances au plan · ${ACTS.length} activités · ${Object.keys(done).length} séances cochées à la main.</div>
    <button class="btn sec block" style="margin-top:12px" data-act="reload">Recharger l'app</button></div>`;
  return html;
};
const parsePace = v => { const m = String(v).trim().match(/^(\d+)\s*['’:m]\s*(\d{1,2})/); return m ? +m[1] * 60 + +m[2] : (isFinite(+v) ? +v : null); };

function installCard() {
  return `<h2>Installer l'app</h2><div class="card install"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><rect x="4" y="11" width="16" height="10" rx="2"/></svg>
  <div class="small">Dans Safari, touche <b>Partager</b> puis <b>Sur l'écran d'accueil</b>. L'app s'ouvrira en plein écran, fonctionnera hors ligne et pourra t'envoyer des notifications.</div></div>`;
}
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

// ---------- Notifications push (Web Push, clés VAPID générées sur l'appareil) ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { toast(isIOS() ? 'Installe d\'abord l\'app sur l\'écran d\'accueil (iOS 16.4 ou plus).' : 'Notifications push non disponibles sur ce navigateur.'); return; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Notifications non autorisées. Tu peux les activer dans Réglages iOS › Notifications › Prépa 70.3.'); render(); return; }
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const pubRaw = await crypto.subtle.exportKey('raw', kp.publicKey);
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const reg = await navigator.serviceWorker.ready;
  const old = await reg.pushManager.getSubscription(); if (old) await old.unsubscribe();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(b64u(pubRaw)) });
  const config = { subscription: sub.toJSON(), vapidPublicKey: b64u(pubRaw), vapidPrivateKey: jwk.d, app: location.origin + location.pathname.replace(/index\.html$/, '') };
  store.set('push', { config, at: new Date().toISOString() });
  toast('Notifications activées. Copie le code ci-dessous dans GitHub.');
  render();
}
async function testPush() {
  const reg = await navigator.serviceWorker.ready;
  const s = (byDate[iso(today())] || []).filter(x => x.sp !== 'Repos');
  reg.showNotification(s.length ? `Aujourd'hui : ${s.map(x => x.t).join(' + ')}` : 'Prépa 70.3', { body: s.length ? s.map(x => `${x.sp} ${fmtH(x.min)} · ${x.desc}`).join('\n') : 'Les notifications fonctionnent.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'test', data: { url: './' } });
}

// ---------- Strava (OAuth dans le navigateur) ----------
const REDIRECT = () => location.origin + location.pathname;
function stravaConnect() {
  const id = $('#s-id').value.trim(), secret = $('#s-secret').value.trim();
  if (!id || !secret) { toast('Renseigne le Client ID et le Client Secret.'); return; }
  store.set('strava', { id, secret });
  location.href = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(id)}&redirect_uri=${encodeURIComponent(REDIRECT())}&response_type=code&approval_prompt=auto&scope=read,activity:read_all`;
}
async function stravaToken(body) {
  const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Strava ' + r.status);
  return r.json();
}
async function stravaHandleCode() {
  const q = new URLSearchParams(location.search), code = q.get('code');
  if (!code || !q.get('scope')) return false;
  history.replaceState(null, '', REDIRECT());
  const st = store.get('strava', {});
  try {
    const t = await stravaToken({ client_id: st.id, client_secret: st.secret, code, grant_type: 'authorization_code' });
    store.set('strava', { ...st, access: t.access_token, refresh: t.refresh_token, exp: t.expires_at, athlete: t.athlete ? `${t.athlete.firstname || ''} ${t.athlete.lastname || ''}`.trim() : '' });
    toast('Strava connecté.');
    return true;
  } catch (e) { toast('Connexion Strava impossible : ' + e.message); return false; }
}
function syncStatus() {
  const err = store.get('stravaErr');
  const at = ACTS_UPDATED ? new Date(ACTS_UPDATED.length === 19 ? ACTS_UPDATED + 'Z' : ACTS_UPDATED) : null;
  const ago = at ? Math.max(0, Math.round((Date.now() - at) / 60000)) : null;
  const when = ago == null ? 'jamais' : ago < 2 ? "à l'instant" : ago < 60 ? `il y a ${ago} min` : ago < 1440 ? `il y a ${Math.round(ago / 60)} h` : `le ${fmtShort(at)}`;
  return `Dernière mise à jour des activités : ${when}.${err ? ' Dernière erreur Strava : ' + err : ''}`;
}
async function stravaSync(silent) {
  let st = store.get('strava', {});
  if (!st.refresh) return;
  try {
    if (!st.access || st.exp * 1000 < Date.now() + 60e3) {
      const t = await stravaToken({ client_id: st.id, client_secret: st.secret, refresh_token: st.refresh, grant_type: 'refresh_token' });
      st = { ...st, access: t.access_token, refresh: t.refresh_token, exp: t.expires_at }; store.set('strava', st);
    }
    const lastT = ACTS.length ? ACTS[ACTS.length - 1].t : '2026-08-15T00:00:00';
    const after = Math.floor(addDays(parseD(lastT), -3).getTime() / 1000);
    let page = 1, got = [];
    while (page < 6) {
      const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { Authorization: 'Bearer ' + st.access } });
      if (!r.ok) throw new Error('Strava ' + r.status);
      const arr = await r.json(); got = got.concat(arr); if (arr.length < 100) break; page++;
    }
    const mapped = got.map(a => ({ id: String(a.id), n: a.name, sp: a.sport_type || a.type, t: (a.start_date_local || '').replace('Z', ''), km: Math.round((a.distance || 0) / 10) / 100, s: a.moving_time || 0, el: Math.round(a.total_elevation_gain || 0), re: a.suffer_score || null }));
    const local = new Map(store.get('acts', []).map(a => [a.id, a])); mapped.forEach(a => local.set(a.id, a));
    store.set('acts', [...local.values()].slice(-400)); store.set('actsUpdated', new Date().toISOString().slice(0, 19)); store.del('stravaErr');
    await loadData();
    if (!silent) toast(`${mapped.length} activité(s) synchronisée(s).`);
    render();
  } catch (e) { store.set('stravaErr', e.message); if (!silent) { toast('La synchronisation Strava n\'a pas abouti (' + e.message + '). Réessaie dans un instant.'); if (tab === 'settings') render(); } }
}

// ---------- Feuille « séance faite » ----------
function openDoneSheet(key) {
  const s = PLAN.sessions.find(x => x.key === key); if (!s) return;
  const cur = done[key] || {};
  const sh = $('#sheet');
  sh.innerHTML = `<div class="grab" aria-hidden="true"></div><div class="row">${icon(s.sp)}<div class="grow"><h3 id="sheet-title">${esc(s.t)}</h3><div class="small muted">${esc(fmtDay(parseD(s.d)))} · ${fmtH(s.min)}</div></div></div>
    <h2 id="rpe-l">Ressenti (RPE)</h2><div class="rpe" role="group" aria-labelledby="rpe-l">${[1,2,3,4,5,6,7,8,9,10].map(n => `<button data-rpe="${n}" aria-pressed="${cur.rpe === n}">${n}</button>`).join('')}</div>
    <div class="rpe-scale"><span>1 · très facile</span><span>10 · maximal</span></div>
    <div class="field"><label for="d-note">Commentaire (facultatif)</label><input id="d-note" value="${esc(cur.note || '')}" placeholder="Sensations, allures…"></div>
    <div class="btnrow"><button class="btn" data-act="d-save">Valider la séance</button>${done[key] ? '<button class="btn sec" data-act="d-undo">Retirer la validation</button>' : ''}</div>`;
  sh.setAttribute('aria-labelledby', 'sheet-title');
  sh.dataset.key = key; sh.dataset.rpe = cur.rpe || '';
  lastFocus = document.activeElement;
  sh.classList.remove('out'); $('#sheet-bd').classList.remove('out');
  sh.hidden = false; $('#sheet-bd').hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => (sh.querySelector('[aria-pressed="true"]') || sh.querySelector('.rpe button')).focus({ preventScroll: true }));
}
let lastFocus = null;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function closeSheet() {
  const sh = $('#sheet'), bd = $('#sheet-bd');
  if (sh.hidden) return;
  const done_ = () => { sh.hidden = true; bd.hidden = true; sh.classList.remove('out'); bd.classList.remove('out'); document.body.style.overflow = ''; };
  if (reduceMotion()) done_(); else { sh.classList.add('out'); bd.classList.add('out'); setTimeout(done_, 200); }
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}

// ---------- Navigation ----------
let tab = store.get('tab', 'today');
const TITLES = { today: "Aujourd'hui", week: 'Semaine', plan: 'Plan', stats: 'Suivi', settings: 'Réglages' };
function render() {
  $('#hdr-title').textContent = TITLES[tab];
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  const n = daysBetween(today(), parseD(PLAN.race));
  $('#countdown').innerHTML = `<b>${Math.max(0, n)}</b><span>jours</span>`;
  $('#countdown').setAttribute('aria-label', `${Math.max(0, n)} jours avant la course`);
  const v = $('#view');
  v.innerHTML = views[tab](); v.removeAttribute('aria-busy');
  if (tabChanged) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); tabChanged = false; }
  if (tab === 'stats') requestAnimationFrame(afterStats);
  if ('setAppBadge' in navigator) { const left = (byDate[iso(today())] || []).filter(s => s.sp !== 'Repos' && !isDone(s, matchDay(s.d).res.get(s.key))).length; (left ? navigator.setAppBadge(left) : navigator.clearAppBadge()).catch(() => {}); }
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; requestAnimationFrame(() => t.classList.add('show')); clearTimeout(toastT); toastT = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 200); }, 3200); }
let tabChanged = true;

document.addEventListener('click', async e => {
  const tb = e.target.closest('.tabs button');
  if (tb) { if (tb.dataset.tab === tab) { scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); return; } tab = tb.dataset.tab; store.set('tab', tab); if (tab === 'week') weekOffset = 0; tabChanged = true; render(); scrollTo(0, 0); return; }
  if (e.target.id === 'sheet-bd') return closeSheet();
  const rp = e.target.closest('.rpe button');
  if (rp) { const on = rp.getAttribute('aria-pressed') !== 'true'; $('#sheet').dataset.rpe = on ? rp.dataset.rpe : ''; document.querySelectorAll('.rpe button').forEach(b => b.setAttribute('aria-pressed', on && b === rp)); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act;
  if (act === 'toggle') { const s = PLAN.sessions.find(x => x.key === a.dataset.key); if (s && matchDay(s.d).res.get(s.key)) { toast('Séance validée par Strava.'); return; } openDoneSheet(a.dataset.key); }
  else if (act === 'd-save') { const sh = $('#sheet'), k = sh.dataset.key; done[k] = { rpe: +sh.dataset.rpe || null, note: $('#d-note').value.trim(), at: new Date().toISOString() }; store.set('done', done); closeSheet(); render(); lastFocus = document.querySelector(`.check[data-key="${CSS.escape(k)}"]`); lastFocus?.focus({ preventScroll: true }); toast('Séance validée. Bien joué !'); }
  else if (act === 'd-undo') { const k = $('#sheet').dataset.key; delete done[k]; store.set('done', done); closeSheet(); render(); document.querySelector(`.check[data-key="${CSS.escape(k)}"]`)?.focus({ preventScroll: true }); toast('Validation retirée.'); }
  else if (act === 'gotoweek') { tab = 'week'; weekOffset = 0; tabChanged = true; render(); scrollTo(0, 0); }
  else if (act === 'wprev') { weekOffset--; render(); }
  else if (act === 'wnext') { weekOffset++; render(); }
  else if (act === 'openweek') { weekOffset = Math.round((parseD(a.dataset.mon) - monday(today())) / (7 * 864e5)); tab = 'week'; tabChanged = true; render(); scrollTo(0, 0); }
  else if (act === 'push-on') { a.disabled = true; a.setAttribute('aria-busy', 'true'); a.textContent = 'Activation…'; try { await enablePush(); } catch (err) { toast('Les notifications n\'ont pas pu être activées (' + err.message + '). Réessaie depuis l\'app installée.'); render(); } }
  else if (act === 'push-test') testPush();
  else if (act === 'copy') { const t = $('#' + a.dataset.target); try { await navigator.clipboard.writeText(t.value); a.textContent = 'Code copié'; setTimeout(() => a.textContent = 'Copier le code', 2000); } catch { t.select(); toast('Le code est sélectionné : touche Copier.'); } }
  else if (act === 'strava-connect') stravaConnect();
  else if (act === 'strava-off') { store.del('strava'); render(); }
  else if (act === 'sync') { a.disabled = true; a.setAttribute('aria-busy', 'true'); a.textContent = 'Synchronisation…'; await stravaSync(false); }
  else if (act === 'saverefs') {
    const ins = [...document.querySelectorAll('[data-v]')];
    if (!ins.map(validateRef).every(Boolean)) { document.querySelector('[aria-invalid="true"]')?.focus(); return; }
    const n = { ftp: +$('#r-ftp').value, weight: +String($('#r-weight').value).replace(',', '.'), css: parsePace($('#r-css').value), thr: parsePace($('#r-thr').value) };
    refs = n; store.set('refs', n); toast('Références enregistrées. Les allures cibles sont à jour.'); render();
  }
  else if (act === 'reload') { const r = await navigator.serviceWorker?.getRegistration(); await r?.update(); location.reload(); }
});
document.addEventListener('keydown', e => {
  const sh = $('#sheet');
  if (sh.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
  if (e.key === 'Tab') { // piège de focus dans la feuille
    const f = [...sh.querySelectorAll('button,input,[href],[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
// Validation au départ du champ, effacée dès la saisie
const REF_RULES = {
  'r-ftp': v => /^\d{2,3}$/.test(v) && +v >= 80 && +v <= 500 ? '' : 'Entre 80 et 500 W, en chiffres.',
  'r-weight': v => { const n = +v.replace(',', '.'); return n >= 35 && n <= 150 ? '' : 'Entre 35 et 150 kg.'; },
  'r-css': v => { const n = parsePace(v); return n && n >= 60 && n <= 240 ? '' : "Format 1'45 (minutes'secondes)."; },
  'r-thr': v => { const n = parsePace(v); return n && n >= 150 && n <= 480 ? '' : "Format 4'18 (minutes'secondes)."; }
};
function validateRef(el) {
  const msg = REF_RULES[el.id] ? REF_RULES[el.id](el.value.trim()) : '';
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  const err = document.getElementById(el.getAttribute('aria-describedby')); if (err) err.textContent = msg;
  return !msg;
}
document.addEventListener('focusout', e => { if (e.target.matches?.('[data-v]')) validateRef(e.target); });
document.addEventListener('input', e => { if (e.target.matches?.('[data-v]') && e.target.getAttribute('aria-invalid') === 'true') { e.target.setAttribute('aria-invalid', 'false'); const err = document.getElementById(e.target.getAttribute('aria-describedby')); if (err) err.textContent = ''; } });
addEventListener('scroll', () => $('.top').classList.toggle('scrolled', scrollY > 4), { passive: true });
addEventListener('resize', () => { if (tab === 'stats') afterStats(); });
let lastRefresh = Date.now();
async function refreshData() { lastRefresh = Date.now(); try { await loadData(); render(); } catch {} stravaSync(true); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && PLAN) refreshData(); });
setInterval(() => { if (document.visibilityState === 'visible' && PLAN && Date.now() - lastRefresh > 5 * 60e3) refreshData(); }, 60e3);

// ---------- Démarrage ----------
(async () => {
  if ('serviceWorker' in navigator) {
    // Une nouvelle version du service worker prend la main : on recharge une fois pour afficher la mise à jour
    const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {});
  }
  const q = new URLSearchParams(location.search).get('tab'); if (q && views[q]) tab = q;
  try { await loadData(); } catch (e) { $('#view').innerHTML = `<div class="card"><div style="font-weight:600">Le plan n'a pas pu se charger</div><p class="small muted">Vérifie ta connexion : la première ouverture a besoin d'Internet, ensuite l'app marche hors ligne.</p><button class="btn block" onclick="location.reload()">Réessayer</button></div>`; return; }
  render();
  if (await stravaHandleCode()) { tab = 'settings'; await stravaSync(false); }
  else stravaSync(true);
})();
})();
