// netlify/functions/mandjie-herinnering.js
//
// GESKEDULEERD -- elke uur (sien netlify.toml).
//
// WAT DIT DOEN (besluit 15 November 2026):
//   1. 'n Bestelling wat 3 uur ná die laaste betaalpoging nog op
//      "Wag vir betaling" staan, kry EEN herinnering per e-pos.
//   2. Geen pos tussen 21:00 en 07:00 (Suid-Afrikaanse tyd) nie. Verstryk die
//      3 uur in die nag, gaan die pos om 07:00 uit.
//   3. Die skakel in die pos werk 48 uur vanaf die oomblik dat die pos
//      WERKLIK uitgegaan het. Daarna kry die bestelling die status "Verval".
//   4. Bestellings ouer as 7 dae kry geen herinnering nie. Die venster is so
//      wyd sodat bestellings van voor hierdie funksie (soos FS-2026-376269)
//      ook een kry; verander VENSTER_DAE om dit nouer te maak.
//
// WIE KRY NIKS:
//   - 'n koper wat intussen met dieselfde profiel of e-pos betaal het;
//   - 'n ouer konsep van 'n koper wat 'n nuwer konsep het (net die nuutste
//     kry 'n pos, anders kry een mens twee);
//   - 'n bestelling sonder e-pos.
//
// Iemand wat net iets in die mandjie gesit het, maar nooit "Gaan na betaling"
// gedruk het nie, bestaan nie vir ons nie: die mandjie leef op sy eie
// toestel en ons het geen e-pos nie.
//
// DIE MERKER WORD EERS NÁ DIE POS GESKRYF, soos by leen-herinnering.js. 'n
// Pos wat misluk, word die volgende uur weer probeer.

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");
const { stuur_mandjie_herinnering } = require("./_kennisgewing-mandjie");

const WAG_STATUS = "Wag vir betaling";
const BETAAL_STATUS = "Nuut";
const VERVAL_STATUS = "Verval";

const UUR = 60 * 60 * 1000;
const WAG_UUR = 3;
const OOP_UUR = 48;
const VENSTER_DAE = 7;
const STIL_VANAF = 21; // 21:00
const STIL_TOT = 7; // 07:00

// Suid-Afrika het geen somertyd nie: altyd UTC+2.
function sa_uur(nou) {
  return (nou.getUTCHours() + 2) % 24;
}

function is_stil_tyd(nou) {
  const u = sa_uur(nou);
  return u >= STIL_VANAF || u < STIL_TOT;
}

function laaste_poging(b) {
  const t = new Date(b.bygewerk_op || b.geskep_op || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function koper_sleutels(b) {
  const k = b.koper || {};
  const uit = [];
  if (k.netlify_identity_id) uit.push(`id:${k.netlify_identity_id}`);
  if (k.epos) uit.push(`epos:${String(k.epos).trim().toLowerCase()}`);
  return uit;
}

// Suiwer besluit vir een bestelling, sonder enige lees of skryf. Gee een van
// "stuur", "verval", "wag" of "niks" terug.
//   later_betaal: het hierdie koper ná hierdie konsep betaal?
//   nuwer_konsep: het hierdie koper 'n nuwer konsep?
function besluit(b, nou, { later_betaal = false, nuwer_konsep = false } = {}) {
  if (!b || b.status !== WAG_STATUS) return "niks";
  const nou_ms = nou.getTime();

  if (b.herinnering && b.herinnering.gestuur_op) {
    const verval = new Date(b.herinnering.verval_op).getTime();
    if (!Number.isFinite(verval) || nou_ms < verval) return "niks";
    // Het die koper NÁ die sperdatum weer by Paystack begin (begin-betaling.js
    // laat 'n verlope konsep weer lewe kry), laat ons hom uit: geen tweede
    // pos nie, en ook nie weer "Verval" terwyl hy dalk nou betaal nie.
    return laaste_poging(b) >= verval ? "niks" : "verval";
  }

  if (later_betaal || nuwer_konsep) return "niks";
  if (!(b.koper && b.koper.epos)) return "niks";

  const ouderdom = nou_ms - laaste_poging(b);
  if (ouderdom > VENSTER_DAE * 24 * UUR) return "niks";
  if (ouderdom < WAG_UUR * UUR) return "wag";
  if (is_stil_tyd(nou)) return "wag";
  return "stuur";
}

// Die koper se taal. Nuwe bestellings dra dit self (voltooi-betaling.js stuur
// dit sedert November 2026). By ouer bestellings lei ons dit af van die boeke:
// is die meeste Engels, skryf ons in Engels.
async function bepaal_taal(b, katalogus_store) {
  if (b.taal === "af" || b.taal === "en") return b.taal;
  let en = 0;
  let ander = 0;
  for (const i of b.items || []) {
    const p = await katalogus_store.get(i.produk_slug, { type: "json" }).catch(() => null);
    if (p && p.taal === "en") en++;
    else ander++;
  }
  return en > ander ? "en" : "af";
}

exports.handler = async () => {
  const nou = new Date();
  const store = kry_store("bestellings");
  const katalogus_store = kry_store("katalogus");

  let gestuur = 0;
  let verval = 0;
  let misluk = 0;

  try {
    const { blobs } = await store.list();
    const alle = [];
    for (const { key } of blobs) {
      const b = await store.get(key, { type: "json" }).catch(() => null);
      if (b) alle.push({ sleutel: key, b });
    }

    // Per koper: die jongste betaling en die jongste konsep.
    const jongste_betaal = new Map();
    const jongste_konsep = new Map();
    for (const { b } of alle) {
      const tyd = laaste_poging(b);
      const kaart = b.status === BETAAL_STATUS ? jongste_betaal : b.status === WAG_STATUS ? jongste_konsep : null;
      if (!kaart) continue;
      for (const s of koper_sleutels(b)) {
        if (!kaart.has(s) || kaart.get(s) < tyd) kaart.set(s, tyd);
      }
    }

    for (const { sleutel, b } of alle) {
      if (b.status !== WAG_STATUS) continue;
      const tyd = laaste_poging(b);
      const sleutels = koper_sleutels(b);
      const later_betaal = sleutels.some((s) => (jongste_betaal.get(s) || 0) > tyd);
      const nuwer_konsep = sleutels.some((s) => (jongste_konsep.get(s) || 0) > tyd);

      const wat = besluit(b, nou, { later_betaal, nuwer_konsep });

      if (wat === "verval") {
        // Lees vars: die koper kon die afgelope paar sekondes betaal het, en
        // dan mag "Verval" nie die webhook se "Nuut" oorskryf nie.
        const vars = await store.get(sleutel, { type: "json" }).catch(() => null);
        if (!vars || vars.status !== WAG_STATUS) continue;
        vars.status = VERVAL_STATUS;
        vars.status_geskiedenis = [...(vars.status_geskiedenis || []), { status: VERVAL_STATUS, op: nou.toISOString() }];
        try {
          await store.setJSON(sleutel, vars);
          verval++;
        } catch (fout) {
          console.error(`Mandjie-herinnering: kon nie ${sleutel} as verval merk nie:`, fout);
        }
        continue;
      }

      if (wat !== "stuur") continue;

      const taal = await bepaal_taal(b, katalogus_store);
      const teken = crypto.randomBytes(18).toString("base64url");
      const uitslag = await stuur_mandjie_herinnering({
        aan: b.koper.epos,
        taal,
        bestelnommer: b.bestelnommer || sleutel,
        teken,
        items: b.items || [],
      });

      if (!uitslag.ok) {
        misluk++;
        console.error(`Mandjie-herinnering: pos vir ${sleutel} het misluk:`, uitslag.fout);
        continue;
      }

      // Lees vars voordat ons skryf. Het die webhook intussen "Nuut" geskryf,
      // mag ons ou kopie dit NOOIT terugdraai na "Wag vir betaling" nie.
      const vars = await store.get(sleutel, { type: "json" }).catch(() => null);
      if (!vars || vars.status !== WAG_STATUS) {
        gestuur++;
        continue;
      }
      vars.herinnering = {
        gestuur_op: nou.toISOString(),
        verval_op: new Date(nou.getTime() + OOP_UUR * UUR).toISOString(),
        teken,
        taal,
      };
      try {
        await store.setJSON(sleutel, vars);
        gestuur++;
      } catch (fout) {
        // Die pos IS weg. Kan ons nie merk nie, gaan dit die volgende uur
        // weer uit. Hinderlik, maar die veilige kant (sien leen-herinnering.js).
        console.error(`Mandjie-herinnering: kon nie merker skryf vir ${sleutel} nie:`, fout);
      }
    }
  } catch (fout) {
    console.error("Mandjie-herinnering het misluk:", fout);
    return { statusCode: 500, body: "Mandjie-herinnering het misluk" };
  }

  console.log(`Mandjie-herinnering: ${gestuur} gestuur, ${verval} verval, ${misluk} misluk`);
  return { statusCode: 200, body: `gestuur=${gestuur} verval=${verval}` };
};

exports._toets = { besluit, is_stil_tyd, sa_uur, WAG_STATUS, VERVAL_STATUS };
