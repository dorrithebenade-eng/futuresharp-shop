// netlify/functions/_faktuur-pas.js
// Weergawe 1 (16 Oktober 2026).
//
// BANKTRANSAKSIES TEEN FAKTURE EN UITBETALINGS PAS.
//
// Die fakturemodule boek self in die joernaal: die ONTVANGS van 'n faktuur wat
// met die hand as betaal aangeteken is (bankoorbetaling), en elke UITBETALING
// aan 'n begunstigde wat met die hand uit die hoofrekening betaal is. Daardie
// geld loop ook deur die bank. Kry die banktransaksie dan 'n eie kategorie,
// staan dieselfde rand twee keer in die staat (Julie tot September 2026:
// Standard Bank se FS/01964 tot FS/01968 en die betalings aan die begunstigdes).
//
// Die regte hantering is dat die banktransaksie GEPAS word teen die faktuur se
// inskrywing, net soos 'n Paystack-vereffening: die bank bevestig wat die
// joernaal reeds weet, en tel nie weer nie.
//
// WAT 'N KANDIDAAT IS
//
//   faktuur      'n Faktuur se ontvangs met metode "bankoorbetaling". Paystack-
//                ontvangste word deur die vereffening gepas, nie hier nie.
//                ref "F:<faktuursleutel>"
//   uitbetaling  'n Uitbetalingsry met stand "betaal_met_hand". 'n Ry wat deur
//                Paystack se split betaal is, het nooit deur die hoofrekening
//                geloop nie.
//                ref "U:<faktuursleutel>#<indeks>"
//
// HOE GEKIES WORD
//
//   Die bedrag en rigting moet presies klop, en die datums hoogstens 45 dae
//   uitmekaar (die betaling word dikwels eers dae later in die paneel
//   aangeteken). Dan tel bewyse:
//     +100  die faktuurnommer se syfers (bv. 01964) staan in die bank se
//           beskrywing of verwysing
//     +10   'n naam (kliënt of ontvanger) staan in die bank se beskrywing
//     -dae  hoe nader die datum, hoe beter
//   'n Pas sonder enige bewys word net aanvaar as die datums hoogstens 3 dae
//   verskil, OF as daar binne 21 dae net een enkele kandidaat met daardie
//   bedrag en rigting is (Standard Bank se R4 500 op 9 September teen
//   FS/01965 wat op 23 September as betaal aangeteken is).
//
// DIT IS 'N VOORSTEL, NIE 'N BESLUIT NIE. kry-bankstate wys dit by die lees;
// eers wanneer iemand "Pas" druk, skryf wys-bankreel-toe dit.

const { kry_fakture_store, is_konsep_sleutel, sleutel_na_nommer } = require("./_fakture");
const { is_kwotasie_sleutel } = require("./_kwotasies");

const VENSTER = 45;

function dag(iso) {
  return String(iso || "").slice(0, 10);
}

function dae(a, b) {
  return Math.round(Math.abs(Date.parse(dag(a) + "T00:00:00Z") - Date.parse(dag(b) + "T00:00:00Z")) / 86400000);
}

function woorde(naam) {
  return String(naam || "").toLowerCase().split(/[^a-zÀ-ſ]+/)
    .filter((w) => w.length >= 4 && !["pty", "ltd", "limited", "south", "africa", "bank", "of"].includes(w));
}

// Al die kandidate uit die fakture.
async function kandidate() {
  const store = kry_fakture_store();
  const { blobs } = await store.list();
  const uit = [];
  for (const b of blobs || []) {
    if (is_konsep_sleutel(b.key) || is_kwotasie_sleutel(b.key)) continue;
    const f = await store.get(b.key, { type: "json" });
    if (!f) continue;
    const nommer = f.nommer || sleutel_na_nommer(b.key) || b.key;
    const syfers = (String(nommer).match(/\d{3,}/) || [""])[0];
    const klient = (f.klient && f.klient.naam) || "";

    const bet = f.betaling || {};
    if (bet.metode === "bankoorbetaling" && dag(bet.ontvang_op) && Number(bet.ontvang_sent) > 0) {
      uit.push({
        soort: "faktuur", ref: `F:${b.key}`, nommer, syfers,
        datum: dag(bet.ontvang_op), bedrag_sent: Number(bet.ontvang_sent), rigting: "in",
        beskrywing: `${nommer}${klient ? " — " + klient : ""}`,
        name: woorde(klient),
      });
    }
    (Array.isArray(f.uitbetalings) ? f.uitbetalings : []).forEach((ry, i) => {
      if (!ry || ry.stand !== "betaal_met_hand" || !dag(ry.betaal_op)) return;
      const sent = Number(ry.bedrag_sent) || 0;
      if (sent <= 0) return;
      uit.push({
        soort: "uitbetaling", ref: `U:${b.key}#${i}`, nommer, syfers,
        datum: dag(ry.betaal_op), bedrag_sent: sent, rigting: "uit",
        beskrywing: `${ry.ontvanger || ""} — ${nommer}`,
        name: woorde(ry.ontvanger),
      });
    });
  }
  return uit;
}

// Die refs wat reeds aan 'n bankreel gepas is, oor alle state heen.
function gebruik(state) {
  const s = new Set();
  (state || []).forEach((st) => (st.reels || []).forEach((r) => {
    if (r.stand === "gepas" && r.pas && (r.pas.soort === "faktuur" || r.pas.soort === "uitbetaling")) s.add(r.pas.ref);
  }));
  return s;
}

// Die beste kandidaat vir een bankreel, of null.
function kies(r, kand, gebruikte) {
  const teks = `${r.beskrywing || ""} ${r.verwysing || ""}`.toLowerCase();
  const moontlik = kand.filter((k) => !gebruikte.has(k.ref) && k.rigting === r.rigting &&
    k.bedrag_sent === r.bedrag_sent && dae(k.datum, r.datum) <= VENSTER);
  let beste = null;
  for (const k of moontlik) {
    const d = dae(k.datum, r.datum);
    let telling = -d;
    let bewys = false;
    if (k.syfers && teks.includes(k.syfers)) { telling += 100; bewys = true; }
    if (k.name.some((w) => teks.includes(w))) { telling += 10; bewys = true; }
    const enigste = moontlik.length === 1 && d <= 21;
    if (!bewys && d > 3 && !enigste) continue;
    if (!beste || telling > beste.telling) beste = { k, telling };
  }
  return beste ? beste.k : null;
}

// Gee elke bankreel in `reels` (wat nog nie gepas is nie) 'n `pas_voorstel`,
// sonder dat een kandidaat twee keer gebruik word. Raak niks anders aan nie.
function stel_voor(reels, kand, gebruikte) {
  const hier = new Set(gebruikte);
  return (reels || []).map((r) => {
    if (r.stand === "gepas" || r.stand === "inligting" || r.stand === "oordrag") return r;
    const k = kies(r, kand, hier);
    if (!k) return r;
    hier.add(k.ref);
    return { ...r, pas_voorstel: { soort: k.soort, ref: k.ref, beskrywing: k.beskrywing } };
  });
}

module.exports = { kandidate, gebruik, kies, stel_voor };
