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

// BELANGRIK — WINKEL- EN PANEEL-AANMELDING IS VOLLEDIG GESKEI:
// 'n Aanmelding op die winkel se aanmeld.html (of enige ander kliënt-
// bladsy) word onder 'n ANDER stoor-sleutel gehou as 'n aanmelding op
// paneelbord.html. Dit beteken 'n personeel-rekening wat via die winkel
// se aanmeld-vorm aanmeld, WORD NOOIT as personeel behandel in daardie
// konteks nie — dit is doelbewus 'n heeltemal aparte sessie. Om by die
// paneelbord te kom, moet 'n mens spesifiek via paneelbord.html se eie
// aanmeld-vorm aanmeld, al is dit dieselfde rekening.
//
// DIE PANEEL-KANT IS MEER AS EEN BLADSY. Boekhouding (faktuurpaneel.html)
// deel die paneel-sessie: een aanmelding vir albei. Was dit 'n toets op
// net paneelbord.html, sou 'n mens wat op die paneelbord aangemeld is,
// op die faktuurpaneel uitgeteken wees — dit sou die winkel se sleutel
// gekry het. Elke nuwe personeel-kant bladsy kom hier by.
const PANEEL_BLADSYE = ["paneelbord.html", "faktuurpaneel.html", "faktuur.html"];

function kry_sessie_sleutel() {
  const pad = window.location.pathname;
  const is_paneel = PANEEL_BLADSYE.some(
    (bladsy) => pad.endsWith(`/${bladsy}`) || pad.endsWith(bladsy)
  );
  return is_paneel ? "future_shop_identiteit_sessie_paneel" : "future_shop_identiteit_sessie_winkel";
}

// Verstek: sessionStorage — 'n sessie verval sodra die oortjie/venster
// toegemaak word. 'n Gebruiker kan egter "Bly aangemeld" merk by
// aanmeld — dan gebruik ons eerder localStorage, wat oorleef. Ons weet
// nie vooraf in watter een 'n bestaande sessie sit nie, dus soek
// identiteit_kry_sessie() in albei.

function kry_identiteit_api_url() {
  return `${window.location.origin}/.netlify/identity`;
}

function identiteit_kry_sessie() {
  try {
    const sleutel = kry_sessie_sleutel();
    const ruwe = sessionStorage.getItem(sleutel) || localStorage.getItem(sleutel);
    return ruwe ? JSON.parse(ruwe) : null;
  } catch {
    return null;
  }
}

// Vind uit watter bewaarplek 'n bestaande sessie (in HIERDIE area — sien
// kry_sessie_sleutel()) reeds gebruik, sodat 'n verfris-aksie dit weer
// daar terugskryf, i.p.v. per ongeluk 'n "Bly aangemeld"-sessie na 'n
// oortjie-alleen-sessie te verander of andersom.
function kry_aktiewe_sessie_bewaarplek() {
  const sleutel = kry_sessie_sleutel();
  if (sessionStorage.getItem(sleutel)) return sessionStorage;
  if (localStorage.getItem(sleutel)) return localStorage;
  return sessionStorage;
}

function identiteit_stoor_sessie(sessie, bly_aangemeld) {
  const bewaarplek = bly_aangemeld ? localStorage : kry_aktiewe_sessie_bewaarplek();
  bewaarplek.setItem(kry_sessie_sleutel(), JSON.stringify(sessie));
}

function identiteit_verwyder_sessie() {
  const sleutel = kry_sessie_sleutel();
  sessionStorage.removeItem(sleutel);
  localStorage.removeItem(sleutel);
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
async function identiteit_meld_aan(epos, wagwoord, bly_aangemeld) {
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
  identiteit_stoor_sessie(sessie, bly_aangemeld);
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
// stap — dis hoe GoTrue se /verify-eindpunt werk. Die sessie word gestoor
// onder die sleutel van die bladsy waarop DIT verwerk word (bevestig.html
// is 'n winkel-bladsy, dus altyd die winkel-sleutel — sien nota bo).
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
  kry_aktiewe_sessie_bewaarplek().setItem(kry_sessie_sleutel(), JSON.stringify(sessie));
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
  // Maak ook die mandjie leeg — dit is 'n gedeelde localStorage-toestand
  // sonder gebruiker-koppeling, so dit moenie oorleef na 'n ander persoon
  // op dieselfde toestel aanmeld nie. mandjie.js is nie altyd op elke
  // bladsy gelaai waar afmeld kan gebeur nie, dus 'n bestaan-toets eers.
  if (typeof maak_mandjie_leeg === "function") {
    maak_mandjie_leeg();
  }
  // Dieselfde rede: die kop se "is hierdie koper 'n outeur"-antwoord is
  // gedeelde oortjie-toestand. Bly dit staan, sien die volgende persoon
  // wat in hierdie oortjie aanmeld die vorige een se antwoord.
  try {
    sessionStorage.removeItem("future_shop_is_outeur");
  } catch {
    /* nie krities nie */
  }
}

function identiteit_het_rol(gebruiker, rol) {
  const rolle = (gebruiker && gebruiker.app_metadata && gebruiker.app_metadata.roles) || [];
  return rolle.includes(rol);
}
