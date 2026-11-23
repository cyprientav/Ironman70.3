// Synchro Strava côté serveur : récupère les nouvelles activités et met à jour data/activities.json.
// Secret GitHub requis : STRAVA_CONFIG = {"client_id","client_secret","refresh_token"} (copié depuis Réglages › Strava dans l'app).
// Strava peut renouveler le refresh token : la dernière valeur est conservée chiffrée dans data/strava-token.enc.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const cfg = JSON.parse(process.env.STRAVA_CONFIG || 'null');
if (!cfg || !cfg.refresh_token) { console.log('STRAVA_CONFIG absent : synchro ignorée.'); process.exit(0); }
const ACTS = new URL('../data/activities.json', import.meta.url);
const TOK = new URL('../data/strava-token.enc', import.meta.url);
const key = createHash('sha256').update('p703:' + cfg.client_secret).digest();
const cfgHash = createHash('sha256').update(cfg.refresh_token).digest('hex').slice(0, 16);

function readToken() {
  if (!existsSync(TOK)) return cfg.refresh_token;
  try {
    const { iv, tag, data, from } = JSON.parse(readFileSync(TOK, 'utf8'));
    if (from !== cfgHash) return cfg.refresh_token; // nouveau code collé dans GitHub : il prime
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  } catch { return cfg.refresh_token; }
}
function writeToken(tok) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(tok, 'utf8'), c.final()]);
  writeFileSync(TOK, JSON.stringify({ iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64'), from: cfgHash }) + '\n');
}

const current = readToken();
const tr = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ client_id: cfg.client_id, client_secret: cfg.client_secret, refresh_token: current, grant_type: 'refresh_token' }) });
if (!tr.ok) { console.error('Rafraîchissement du jeton Strava refusé :', tr.status, await tr.text()); process.exit(1); }
const t = await tr.json();
if (t.refresh_token && t.refresh_token !== current) { writeToken(t.refresh_token); console.log('Jeton Strava renouvelé et conservé.'); }

const db = JSON.parse(readFileSync(ACTS, 'utf8'));
const list = db.activities || [];
const last = list.reduce((m, a) => a.t > m ? a.t : m, '2026-08-15T00:00:00');
const after = Math.floor((new Date(last + 'Z').getTime() - 3 * 864e5) / 1000);
let got = [];
for (let page = 1; page <= 5; page++) {
  const r = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { Authorization: 'Bearer ' + t.access_token } });
  if (!r.ok) { console.error('Lecture des activités refusée :', r.status, await r.text()); process.exit(1); }
  const arr = await r.json(); got = got.concat(arr); if (arr.length < 100) break;
}
const map = new Map(list.map(a => [String(a.id), a]));
let changed = 0;
for (const a of got) {
  const v = { id: String(a.id), n: a.name, sp: a.sport_type || a.type, t: (a.start_date_local || '').replace('Z', ''), km: Math.round((a.distance || 0) / 10) / 100, s: a.moving_time || 0, el: Math.round(a.total_elevation_gain || 0), re: a.suffer_score ?? null };
  const old = map.get(v.id);
  if (!old || JSON.stringify(old) !== JSON.stringify({ ...old, ...v })) { map.set(v.id, { ...old, ...v }); changed++; }
}
if (changed) {
  db.activities = [...map.values()].sort((a, b) => a.t.localeCompare(b.t));
  db.updated = new Date().toISOString().slice(0, 19) + 'Z';
  db.source = 'Strava (synchro automatique)';
  writeFileSync(ACTS, JSON.stringify(db));
}
console.log(`${got.length} activité(s) lue(s), ${changed} nouvelle(s) ou modifiée(s).`);
