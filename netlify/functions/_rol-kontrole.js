// Gedeelde helper: verifieer Netlify Identity-gebruiker se rol bediener-kant.
//
// BELANGRIK: rolkontrole gebeur HIER (bediener-kant), nie net in die
// front-end nie — front-end-versteekte knoppies kan omseil word via
// blaaier-ontwikkelaarnutsgoed, maar 'n Function wat weier om te reageer
// kan nie omseil word nie.
//
// AGTERGROND (Julie 2026): Netlify se OUTOMATIESE Identity-konteks-
// inspuiting (context.clientContext.user) het dieselfde tipe
// onbetroubaarheid getoon as hulle Blobs-konteks-inspuiting — dit werk
// soms nie op vars, korrek-opgestelde werwe nie. In plaas daarvan om
// daarop te vertrou, verifieer ons die JWT HIER self, direk teen Netlify
// se onderliggende Identity-API (GoTrue) — dieselfde patroon wat
// public/js/identiteit.js reeds gebruik i.p.v. die onbetroubare widget.
//
// AGTERGROND (Augustus 2026) — WAAROM DAAR NOU 'N KAS IS:
// Die paneelbord laai omtrent tien beskermde Functions gelyktydig. Elkeen
// het sy eie HTTP-aanroep na /.netlify/identity/user gedoen — tien
// identiese vrae, met dieselfde token, in dieselfde sekonde. Identity het
// van hulle geweier, en omdat die helper enige nie-ok-antwoord as
// "gebruiker onbekend" behandel het, het dit as 403 by die gebruiker
// uitgekom. Die simptoom was wisselvallig: sommige oortjies van die
// paneelbord het gelaai, ander nie, en 'n herlaai het 'n ander mengsel
// gegee.
//
// Twee dinge los dit op:
//   1. IN-VLUG-SAMEVOEGING — vra tien keer gelyktydig vir dieselfde token,
//      en almal wag op EEN aanroep i.p.v. tien.
//   2. KORT KAS (60s) — 'n tweede bladsylaai binne die minuut vra glad nie
//      weer nie.
//
// Die sekuriteitsmodel bly presies dieselfde: elke token word steeds by
// Identity self geverifieer. Ons doen dit net nie tien keer per bladsy nie.
//
// WAT DIE KAS BETEKEN VIR ROLVERANDERINGE: word 'n gebruiker se rol
// verwyder, kan hulle tot 60 sekondes lank nog toegang hê. Dit is 'n
// bewuste afweging — kort genoeg om onbelangrik te wees, lank genoeg om
// die stormloop te stop.
//
// LET WEL: elke Function-instansie het sy eie geheue, en Netlify kan
// verskeie instansies gelyktydig loop. Die kas is dus per instansie, nie
// globaal nie. Dit is genoeg: die probleem was tien gelyktydige aanroepe
// vanuit een bladsylaai, nie twee of drie nie.
//
// Gebruik: elke beskermde Function roep AWAIT kry_gebruiker_en_kontroleer_rol()
// aan die begin van sy handler, voor enige data gelees/geskryf word.

const KAS_LEEFTYD_MS = 60 * 1000;
const KAS_MAKS_INSKRYWINGS = 200;
const HERPROBEER_WAG_MS = 250;

// token -> { gebruiker, verval_op }
const kas = new Map();
// token -> Promise (aanroepe wat tans in die vlug is)
const in_vlug = new Map();

function kry_bearer_token(event) {
  const kop = event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!kop || !kop.toLowerCase().startsWith("bearer ")) return null;
  return kop.slice(7).trim();
}

// WAAROM DIT NIE process.env.URL GEBRUIK NIE (Augustus 2026):
//
// process.env.URL is die werf se PRIMÊRE domein. Sodra 'n eie domein
// bygevoeg is, word dit iets soos https://futureshop.futuresharp.co.za.
// 'n Function wat dáárheen terugbel, moet oor die publieke internet gaan
// en die naam self oplos — en dit het gebreek:
//
//   ERR_TLS_CERT_ALTNAME_INVALID
//   Host: futureshop.futuresharp.co.za is not in the cert's altnames:
//   DNS:bayek.aserv.co.za
//
// Die domein het 'n wildcard-rekord (*.futuresharp.co.za) wat na Afrihost
// se bediener wys. Netlify se Function-omgewing los die naam na die
// wildcard op i.p.v. na die CNAME, land by Afrihost, en die TLS-handdruk
// misluk. Die blaaier los dit korrek op — daarom werk die winkel vir 'n
// gebruiker terwyl elke beskermde Function 403 gee.
//
// Die netlify.app-adres het nie hierdie probleem nie: dit los altyd na
// Netlify op, ongeag wat by die domeinverskaffer gebeur. Dit bly ook
// geldig al word die primêre domein later verander.
//
// Volgorde: 'n uitdruklike oorskryf (indien ooit nodig), dan die werf se
// naam, dan die ontplooiing se eie adres. process.env.URL word doelbewus
// LAASTE gebruik — slegs as niks anders beskikbaar is nie.
function kry_identity_basis_url() {
  const werf_url =
    process.env.FUTURE_SHOP_IDENTITY_URL ||
    (process.env.SITE_NAME ? `https://${process.env.SITE_NAME}.netlify.app` : null) ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    process.env.URL;

  return `${werf_url}/.netlify/identity`;
}

function snoei_kas() {
  const nou = Date.now();
  for (const [sleutel, waarde] of kas) {
    if (waarde.verval_op <= nou) kas.delete(sleutel);
  }
  // Steeds te groot ná snoei? Gooi die oudstes uit (Map hou invoegorde).
  while (kas.size > KAS_MAKS_INSKRYWINGS) {
    const oudste = kas.keys().next().value;
    kas.delete(oudste);
  }
}

function slaap(ms) {
  return new Promise((los_op) => setTimeout(los_op, ms));
}

// Doen die werklike aanroep. Onderskei tussen "token is ongeldig" (401/403 —
// moenie herprobeer nie) en "Identity kon nou nie antwoord nie" (429/5xx —
// herprobeer een keer). Voorheen was albei stilweg null, en dit is presies
// waarom 'n koersbeperking soos 'n ongeldige token gelyk het.
async function haal_gebruiker_by_identity(token) {
  for (let poging = 0; poging < 2; poging++) {
    try {
      const resp = await fetch(`${kry_identity_basis_url()}/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (resp.ok) return await resp.json();

      // Token self is ongeldig — 'n herprobeer sal niks verander nie.
      if (resp.status === 401 || resp.status === 403) return null;

      // 429 of 5xx: Identity is oorlaai of tydelik af. Een herprobeer.
      if (poging === 0) {
        console.warn(`Identity gee ${resp.status} — herprobeer een keer.`);
        await slaap(HERPROBEER_WAG_MS);
        continue;
      }

      console.error(`Identity gee steeds ${resp.status} ná herprobeer.`);
      return null;
    } catch (fout) {
      if (poging === 0) {
        console.warn("Netwerkfout na Identity — herprobeer een keer:", fout.message);
        await slaap(HERPROBEER_WAG_MS);
        continue;
      }
      console.error("Kon nie gebruiker by Identity-API verifieer nie:", fout);
      return null;
    }
  }
  return null;
}

async function kry_gebruiker_vanaf_token(token) {
  if (!token) return null;

  const nou = Date.now();

  const gekas = kas.get(token);
  if (gekas && gekas.verval_op > nou) return gekas.gebruiker;

  // Loop daar reeds 'n aanroep vir hierdie token? Wag op dieselfde een.
  // Dit is die deel wat die gelyktydige stormloop stop.
  const lopend = in_vlug.get(token);
  if (lopend) return lopend;

  const belofte = (async () => {
    const gebruiker = await haal_gebruiker_by_identity(token);
    // Slegs geslaagde verifikasies word gekas. 'n Mislukking word nie
    // onthou nie — 'n tydelike Identity-probleem moet nie 'n geldige
    // gebruiker 'n minuut lank uitsluit nie.
    if (gebruiker) {
      kas.set(token, { gebruiker, verval_op: Date.now() + KAS_LEEFTYD_MS });
      if (kas.size > KAS_MAKS_INSKRYWINGS) snoei_kas();
    }
    return gebruiker;
  })();

  in_vlug.set(token, belofte);
  try {
    return await belofte;
  } finally {
    in_vlug.delete(token);
  }
}

// vereiste_rol kan 'n string wees ("personeel") of 'n lys ("personeel",
// "vennoot") — die gebruiker moet minstens EEN daarvan hê. Die lys-vorm is
// vooruitsig vir die komende vennoot-rol; bestaande aanroepe met 'n enkele
// string werk presies soos voorheen.
function kontroleer_rol(gebruiker, vereiste_rol) {
  if (!gebruiker) return false;
  const rolle = (gebruiker.app_metadata && gebruiker.app_metadata.roles) || [];
  const vereis = Array.isArray(vereiste_rol) ? vereiste_rol : [vereiste_rol];
  return vereis.some((rol) => rolle.includes(rol));
}

/**
 * Gee die geverifieerde gebruiker terug indien hulle die vereiste rol het,
 * of null indien nie (Function moet dan 401/403 terugstuur).
 * LET WEL: asinkroon — roep aan met `await`.
 */
async function kry_gebruiker_en_kontroleer_rol(event, context, vereiste_rol) {
  const token = kry_bearer_token(event);
  const gebruiker = await kry_gebruiker_vanaf_token(token);
  if (!kontroleer_rol(gebruiker, vereiste_rol)) {
    return null;
  }
  return gebruiker;
}

module.exports = {
  kry_gebruiker_en_kontroleer_rol,
};
