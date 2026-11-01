// netlify/functions/_geskenke.js
//
// GESKENKE (November 2026). 'n Koper kan 'n e-boek, of 'n hele reeks, as
// geskenk koop. Die mandjie-item dra `geskenk: true`.
//
// HOE DIT WERK
// 1. begin-betaling.js stoor die geskenk-items in die bestelling met
//    `geskenk: true`, en die besonderhede in `bestelling.geskenk`
//    ({ aan, van, boodskap }). Die geld, die verdeling en die outeur se
//    verkoop word by HIERDIE aankoop aangeteken, soos by enige ander boek.
// 2. Sodra die bestelling betaal is (paystack-webhook.js, of begin-betaling.js
//    se R0-kortpad), skep skep_geskenk_vir_bestelling() een eenmalige kode vir
//    al die geskenk-items saam, stoor dit in die "geskenke"-store, skryf die
//    kode op die bestelling (`geskenk_kode`) en stuur die geskenkbewys per
//    e-pos aan die koper.
// 3. Die ontvanger gaan na geskenk.html, tik die kode in en meld aan.
//    ontvang-geskenk.js skep dan 'n R0-bestelling op sy naam, met
//    `via_geskenk` op elke item. Die kode is daarna gebruik.
//
// REËLS
// - Geen vervaldatum nie. Elke kode werk net een keer.
// - Geskenk-items gee die KOPER nie die boek nie: elke plek wat besit uit
//   bestellings aflei, slaan `geskenk: true` oor (sien is_eie_item()).
// - Die ontvangs-bestelling is nie 'n verkoop nie: geen inkomste, geen
//   verdeling, geen outeurtellers. Stade en titellyste slaan `via_geskenk` oor.
// - Tans net e-boeke. Harde kopieë kan later volg: die ontvanger sal dan by
//   die ontvangs 'n afleweradres moet gee.
//
// STORE "geskenke", sleutel = die kode:
//   { kode, bestelnommer, geskep_op, koper: { id, epos }, aan, van, boodskap,
//     items: [{ produk_slug, titel, formaat }], ontvang: null | { op, deur_id,
//     deur_epos, bestelnommer, oorgeslaan: [slug] } }

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");
const { stuur_epos, ontsnap } = require("./_stuur-epos");

const WERF_URL = "https://futureshop.futuresharp.co.za";

// Sonder letters wat lyk soos syfers (I, L, O, 0, 1), sodat 'n kode wat
// van 'n gedrukte bewys oorgetik word, nie verkeerd gelees word nie.
const KARAKTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const store = () => kry_store("geskenke");

function maak_kode() {
  const deel = () =>
    Array.from({ length: 4 }, () => KARAKTERS[crypto.randomInt(KARAKTERS.length)]).join("");
  return `GESKENK-${deel()}-${deel()}`;
}

function skoon_kode(w) {
  return String(w || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 40);
}

// Waar besit uit bestellings afgelei word: 'n geskenk-item behoort nie aan
// die koper nie.
function is_eie_item(item) {
  return !!item && item.geskenk !== true;
}

function teks(w, maks) {
  return String(w == null ? "" : w).trim().slice(0, maks);
}

// Die koper se invoer by die betaalbladsy.
function skoon_geskenk_besonderhede(invoer) {
  const g = invoer && typeof invoer === "object" ? invoer : {};
  return {
    aan: teks(g.aan, 80),
    van: teks(g.van, 80),
    boodskap: teks(g.boodskap, 400),
  };
}

async function lees_geskenk(kode) {
  const k = skoon_kode(kode);
  if (!k) return null;
  return store().get(k, { type: "json" });
}

async function stoor_geskenk(rekord) {
  await store().setJSON(rekord.kode, rekord);
}

function geskenk_url(kode) {
  return `${WERF_URL}/geskenk.html?kode=${encodeURIComponent(kode)}`;
}

async function stuur_geskenkbewys(rekord, aan_epos) {
  const aan = String(aan_epos || (rekord.koper && rekord.koper.epos) || "").trim();
  if (!aan) return { ok: false, fout: "Geen e-pos" };

  const boeke = (rekord.items || []).map((i) => `&bull; ${ontsnap(i.titel || i.produk_slug)}`).join("<br>");
  const reels = [
    rekord.aan
      ? `Jou geskenk vir <b>${ontsnap(rekord.aan)}</b> is gereed.`
      : "Jou geskenk is gereed.",
    boeke,
    `Geskenkkode: <b style="font-size:20px;letter-spacing:2px">${ontsnap(rekord.kode)}</b>`,
    "Gee die kode, of die geskenkbewys by die knoppie hieronder, vir die ontvanger. " +
      "Die ontvanger gaan na futureshop.futuresharp.co.za/geskenk.html, tik die kode in en meld aan. " +
      "Die boeke gaan dan in sy of haar eie leeskamer.",
    "Die kode werk net een keer en verval nie.",
  ];
  if (rekord.boodskap) reels.splice(2, 0, `Jou boodskap: <i>&ldquo;${ontsnap(rekord.boodskap)}&rdquo;</i>`);

  const uitslag = await stuur_epos({
    aan,
    onderwerp: "Jou Future Shop-geskenkbewys",
    opskrif: "Jou geskenkbewys",
    reels,
    knoppie: { teks: "Wys die geskenkbewys", url: `${geskenk_url(rekord.kode)}&bewys=1` },
  });
  if (!uitslag.ok) console.error(`Geskenkbewys ${rekord.kode} kon nie gestuur word nie:`, uitslag.fout);
  return uitslag;
}

// Roep ná betaling. Gee die kode terug, of null as daar geen geskenk-items is
// nie. Veilig om twee keer te roep: 'n bestelling met 'n kode kry nie nog een nie.
async function skep_geskenk_vir_bestelling(bestelling) {
  if (!bestelling) return null;
  if (bestelling.geskenk_kode) return bestelling.geskenk_kode;
  const items = (bestelling.items || []).filter((i) => i && i.geskenk === true);
  if (!items.length) return null;

  let kode = maak_kode();
  for (let poging = 0; poging < 5 && (await lees_geskenk(kode)); poging++) kode = maak_kode();

  const g = bestelling.geskenk || {};
  const rekord = {
    kode,
    bestelnommer: bestelling.bestelnommer,
    geskep_op: new Date().toISOString(),
    koper: {
      id: (bestelling.koper && bestelling.koper.netlify_identity_id) || null,
      epos: (bestelling.koper && bestelling.koper.epos) || "",
    },
    aan: g.aan || "",
    van: g.van || "",
    boodskap: g.boodskap || "",
    items: items.map((i) => ({ produk_slug: i.produk_slug, titel: i.titel, formaat: i.formaat })),
    ontvang: null,
  };
  await stoor_geskenk(rekord);

  // Skryf die kode op die bestelling. Lees die rekord weer: die aanroeper se
  // kopie kan intussen verouderd wees.
  const bestellings = kry_store("bestellings");
  const vars = (await bestellings.get(bestelling.bestelnommer, { type: "json" })) || bestelling;
  await bestellings.setJSON(bestelling.bestelnommer, { ...vars, geskenk_kode: kode });

  await stuur_geskenkbewys(rekord);
  return kode;
}

module.exports = {
  KARAKTERS,
  maak_kode,
  skoon_kode,
  is_eie_item,
  skoon_geskenk_besonderhede,
  lees_geskenk,
  stoor_geskenk,
  geskenk_url,
  stuur_geskenkbewys,
  skep_geskenk_vir_bestelling,
};
