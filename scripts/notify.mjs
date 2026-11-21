// Envoie la notification push du jour (ou l'aperçu de la semaine) à l'iPhone.
// Secret GitHub requis : PUSH_CONFIG (code copié depuis Réglages › Notifications dans l'app).
import webpush from 'web-push';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(process.env.PUSH_CONFIG || 'null');
if (!cfg) { console.log('PUSH_CONFIG absent : rien à envoyer.'); process.exit(0); }
const plan = JSON.parse(readFileSync(new URL('../data/plan.json', import.meta.url)));
const mode = process.argv[2] || 'daily';

// Date du jour à Zurich
const zurich = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(d);
const now = new Date(), todayStr = zurich(now);
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const EM = { 'Natation': '🏊', 'Vélo': '🚴', 'Course': '🏃', 'Renfo': '💪', 'Triathlon': '🏁' };
const fmt = m => m < 60 ? `${m}'` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
const day = d => plan.sessions.filter(s => s.d === d && s.sp !== 'Repos');
const race = Math.round((new Date(plan.race + 'T12:00:00Z') - new Date(todayStr + 'T12:00:00Z')) / 864e5);

let msg = null;
if (mode === 'daily') {
  const ss = day(todayStr);
  if (ss.length) msg = {
    title: `${ss.map(s => EM[s.sp] || '').join('')} ${ss.map(s => s.t).join(' + ')}`,
    body: ss.map(s => `${s.sp} ${fmt(s.min)}${s.z ? ' · ' + s.z : ''} : ${s.desc}`).join('\n') + `\nJ-${race}`,
    tag: 'daily-' + todayStr, badge: ss.length
  };
  else if (race >= 0) msg = { title: '😴 Repos aujourd\'hui', body: `Récupère bien. J-${race} avant Rapperswil.`, tag: 'daily-' + todayStr, badge: 0 };
} else if (mode === 'weekly') {
  const mon = addDays(todayStr, 1);
  const w = plan.weeks.find(x => x.mon === mon);
  if (w) msg = { title: `Semaine ${w.w} · ${w.ph} · ${fmt(Math.round(w.tot * 60))}`, body: `${w.goal}${w.tests ? '\n🎯 ' + w.tests : ''}\nNatation ${fmt(Math.round(w.h.swim * 60))} · Vélo ${fmt(Math.round(w.h.bike * 60))} · Course ${fmt(Math.round(w.h.run * 60))}`, tag: 'weekly-' + mon };
}
if (!msg) { console.log('Rien à envoyer aujourd\'hui.'); process.exit(0); }
msg.url = cfg.app || './';

webpush.setVapidDetails(cfg.app && cfg.app.startsWith('https://') ? cfg.app : 'mailto:prepa703@example.com', cfg.vapidPublicKey, cfg.vapidPrivateKey);
try {
  const r = await webpush.sendNotification(cfg.subscription, JSON.stringify(msg), { TTL: 6 * 3600, urgency: 'normal' });
  console.log('Envoyé :', r.statusCode, msg.title);
} catch (e) {
  console.error('Échec de l\'envoi :', e.statusCode, e.body || e.message);
  if (e.statusCode === 404 || e.statusCode === 410) console.error('Abonnement expiré : régénère le code dans Réglages › Notifications et mets à jour PUSH_CONFIG.');
  process.exit(1);
}
