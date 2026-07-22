// Eie, direkte kliënt vir Netlify se onderliggende Identity-API (GoTrue).
// Vervang die vorige "netlify-identity-widget.js"-afhanklikheid heeltemal.
//
// WAAROM: die widget render sy hele venster binne 'n Shadow DOM en
// vertrou op localStorage-toestand wat herhaaldelik korrupteer is deur
// algemene blaaier-uitbreidings (bv. Adobe Acrobat, Google Docs Offline)
// wat op elke bladsy hulle eie skrips inspuit. Hierdie module gebruik net
// gewone `fetch`-versoeke direk teen die API — geen derdeparty-skrip,
// geen Shadow DOM, niks wat 'n uitbreiding kan korrupteer nie.
//
// Vir Fase 5 (koper-aanmelding/"My Boeke"): gebruik hierdie selfde module
// — moet NOOIT teruggaan na die widget nie, presies om hierdie rede.
//
// API-verwysing (GoTrue, bevestig teen amptelike bron):
//   POST /token    { grant_type: "password", username, password }  → sessie
//   POST /token    { grant_type: "refresh_token", refresh_token }  → nuwe sessie
//   POST /signup   { email, password }                             → stuur bevestigingspos
//   POST /recover  { email }                                       → stuur herstelpos
//   POST /verify   { type: "signup"|"recovery", token, password }  → bevestig/herstel + sessie
//   GET  /user     (met Authorization: Bearer <access_token>)      → gebruiker-inligting

const IDENTITEIT_SESSIE_SLEUTEL = "future_shop_identiteit_sessie";

function kry_identiteit_api_url() {
  return `${window.location.origin}/.netlify/identity`;
}

function identiteit_kry_sessie() {
  try {
    const ruwe = localStorage.getItem(IDENTITEIT_SESSIE_SLEUTEL);
    return ruwe ? JSON.parse(ruwe) : null;
  } catch {
    return null;
  }
}

function identiteit_stoor_sessie(sessie) {
  localStorage.setItem(IDENTITEIT_SESSIE_SLEUTEL, JSON.stringify(sessie));
}

function identiteit_verwyder_sessie() {
  localStorage.removeItem(IDENTITEIT_SESSIE_SLEUTEL);
}

async function identiteit_verwerk_antwoord(resp) {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const boodskap = data.error_description || data.msg || data.error || `Fout ${resp.status}`;
    throw new Error(boodskap);
  }
  return data;
}

// --- Aanmeld ---
async function identiteit_meld_aan(epos, wagwoord) {
  const liggaam = new URLSearchParams();
  liggaam.set("grant_type", "password");
  liggaam.set("username", epos);
  liggaam.set("password", wagwoord);

  const resp = await fetch(`${kry_identiteit_api_url()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: liggaam.toString(),
  });
  const token_data = await identiteit_verwerk_antwoord(resp);
  const gebruiker = await identiteit_kry_gebruiker(token_data.access_token);

  const sessie = { ...token_data, gebruiker, geskep_op: Date.now() };
  identiteit_stoor_sessie(sessie);
  return sessie;
}

// --- Registrasie (self-registrasie, bv. vir kopers in Fase 5) ---
async function identiteit_registreer(epos, wagwoord) {
  const resp = await fetch(`${kry_identiteit_api_url()}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: epos, password: wagwoord }),
  });
  return identiteit_verwerk_antwoord(resp);
}

// --- Stuur wagwoord-herstel-epos ---
async function identiteit_stuur_herstel(epos) {
  const resp = await fetch(`${kry_identiteit_api_url()}/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: epos }),
  });
  return identiteit_verwerk_antwoord(resp);
}

// --- Verwerk 'n token uit 'n e-pos-skakel (uitnodiging/bevestiging/herstel) ---
// tipe: "signup" (vir invite_token OF confirmation_token) of "recovery"
// (vir recovery_token). Stel dadelik 'n nuwe wagwoord as deel van dieselfde
// stap — dis hoe GoTrue se /verify-eindpunt werk.
async function identiteit_verwerk_token(tipe, token, nuwe_wagwoord) {
  const resp = await fetch(`${kry_identiteit_api_url()}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: tipe, token, password: nuwe_wagwoord }),
  });
  const token_data = await identiteit_verwerk_antwoord(resp);
  const gebruiker = await identiteit_kry_gebruiker(token_data.access_token);

  const sessie = { ...token_data, gebruiker, geskep_op: Date.now() };
  identiteit_stoor_sessie(sessie);
  return sessie;
}

// --- Kry gebruiker-inligting (rolle, epos, ens.) vir 'n access_token ---
async function identiteit_kry_gebruiker(access_token) {
  const resp = await fetch(`${kry_identiteit_api_url()}/user`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  return identiteit_verwerk_antwoord(resp);
}

// --- Verfris 'n verlope sessie met die refresh_token ---
async function identiteit_ververs_sessie() {
  const huidige = identiteit_kry_sessie();
  if (!huidige || !huidige.refresh_token) return null;

  const liggaam = new URLSearchParams();
  liggaam.set("grant_type", "refresh_token");
  liggaam.set("refresh_token", huidige.refresh_token);

  const resp = await fetch(`${kry_identiteit_api_url()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: liggaam.toString(),
  });
  if (!resp.ok) {
    identiteit_verwyder_sessie();
    return null;
  }
  const token_data = await resp.json();
  const gebruiker = await identiteit_kry_gebruiker(token_data.access_token);
  const sessie = { ...token_data, gebruiker, geskep_op: Date.now() };
  identiteit_stoor_sessie(sessie);
  return sessie;
}

// --- Huidige aangemelde gebruiker (of null) — verfris outomaties as
// die access_token reeds verval het (expires_in is in sekondes) ---
async function identiteit_kry_huidige_sessie() {
  const sessie = identiteit_kry_sessie();
  if (!sessie) return null;

  const verval_op = sessie.geskep_op + sessie.expires_in * 1000;
  if (Date.now() < verval_op - 30000) return sessie; // nog 30s+ geldig

  return identiteit_ververs_sessie();
}

function identiteit_meld_af() {
  identiteit_verwyder_sessie();
}

function identiteit_het_rol(gebruiker, rol) {
  const rolle = (gebruiker && gebruiker.app_metadata && gebruiker.app_metadata.roles) || [];
  return rolle.includes(rol);
}
