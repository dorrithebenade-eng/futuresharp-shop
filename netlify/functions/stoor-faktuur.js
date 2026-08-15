// netlify/functions/stoor-faktuur.js
//
// Skep of werk 'n faktuur-KONSEP by. Rol: boekhouding.
//
// DIT RAAK NET KONSEPTE. 'n Faktuur wat uitgereik is, dra 'n dokument wat
// reeds by die kliënt is en 'n verdeling wat gevries is; 'n betaalde een se
// verdeling het klaar gebeur. Wil 'n mens iets aan sulke een verander, word
// gekanselleer en 'n nuwe uitgereik. Hierdie Function antwoord 409 en sê dit.
//
// GEEN `...wysigings`-spread. Elke veld word hier met die hand gelees en
// gevalideer. Dieselfde slaggat as wysig-produk.js in die winkel: 'n nuwe
// veld wat deur 'n spread instroom, is 'n veld wat niemand nagegaan het nie.
//
// ALLE BEDRAE IS SENT, heelgetalle. Rand met desimale tel nie betroubaar op
// nie, en dit is presies waar 'n sent verlore raak.
//
// DIE BEDRAE WORD OP DIE BEDIENER GEREKEN. Die vorm stuur die hoeveelheid en
// die eenheidsprys; die reël se bedrag en die faktuur se totaal word hier
// bereken. 'n Getal wat afgelei kan word, word nooit van die kliëntkant
// vertrou nie — dit is die getal waarop die verdeling later loop.
//
// DIE GESKIEDENIS KRY NET DIE SKEPPING. 'n Konsep stoor outomaties sowat twee
// sekondes ná iemand ophou tik; sou elke stoor 'n inskrywing maak, sou 'n
// halfuur se werk 'n paar honderd reëls oplewer en die geskiedenis nutteloos
// wees. Wat saak maak — uitgereik, betaal, gekanselleer — word deur die
// Functions aangeteken wat dit doen.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_fakture_store,
  skep_konsep_sleutel,
  is_konsep_sleutel,
  nuwe_faktuur,
  voeg_geskiedenis_by,
  TALE,
} = require("./_fakture");
const { kry_kliente_store } = require("./_kliente");

// 'n Reël is óf 'n verkoop óf 'n koste. Die onderskeid dryf faktuur-som.js se
// etiket ("koste terug" teenoor "verdienste") en niks anders nie.
const REEL_SOORTE = ["verkoop", "koste"];
const RY_TIPES = ["pct", "vas"];

// Sent, altyd 'n heelgetal, nooit negatief. Math.round en nie Math.trunc nie:
// 'n bedrag wat afwaarts afrond, kan 'n verdeling onder Paystack se minimum
// druk.
function sent(waarde) {
  const getal = Number(waarde);
  if (!Number.isFinite(getal) || getal < 0) return 0;
  return Math.round(getal);
}

function teks(waarde, maks) {
  const skoon = String(waarde == null ? "" : waarde).trim();
  return maks ? skoon.slice(0, maks) : skoon;
}

// 'n ISO-datum of niks. 'n Onleesbare datum word leeg eerder as om as
// "Invalid Date" op die dokument te gaan staan.
function datum(waarde) {
  const skoon = teks(waarde);
  if (!skoon) return null;
  const d = new Date(skoon);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Die reëls van die dokument. Die hoeveelheid mag 'n desimaal wees — 'n halwe
// dag se werk is 'n geldige reël — maar die bedrag land in sent.
function lees_reels(rou) {
  if (!Array.isArray(rou)) return [];
  return rou.slice(0, 40).map((r) => {
    const item = r || {};
    const hoeveelheid = Number(item.hoeveelheid);
    const veilig = Number.isFinite(hoeveelheid) && hoeveelheid >= 0 ? hoeveelheid : 0;
    const prys_pp_sent = sent(item.prys_pp_sent);
    return {
      soort: REEL_SOORTE.includes(item.soort) ? item.soort : "verkoop",
      beskrywing: teks(item.beskrywing, 300),
      hoeveelheid: veilig,
      prys_pp_sent,
      bedrag_sent: Math.round(veilig * prys_pp_sent),
    };
  });
}

// Die begroting. Die ontvanger word gestoor soos hy gekies is; of hy 'n
// subrekening het, word by uitreiking bepaal — 'n begunstigde kan een kry
// tussen die konsep en die stuur.
function lees_koste(rou) {
  if (!Array.isArray(rou)) return [];
  return rou.slice(0, 40).map((k) => {
    const item = k || {};
    return {
      beskrywing: teks(item.beskrywing, 300),
      ontvanger: teks(item.ontvanger, 200),
      bedrag_sent: sent(item.bedrag_sent),
      // Vrye teks wat by die faktuur bly en NOOIT uitgaan nie. Ses maande
      // later is "R2 450" 'n getal; die inskrywing is 'n rekord.
      inskrywing: teks(item.inskrywing, 500),
    };
  });
}

// Die lewende verdeling. 'n Persentasie word op 0–100 gehou; 'n vaste bedrag
// is sent.
function lees_verdeling(rou) {
  if (!Array.isArray(rou)) return [];
  return rou.slice(0, 40).map((v) => {
    const item = v || {};
    const tipe = RY_TIPES.includes(item.tipe) ? item.tipe : "pct";
    let waarde;
    if (tipe === "pct") {
      const getal = Number(item.waarde);
      waarde = Number.isFinite(getal) ? Math.min(100, Math.max(0, getal)) : 0;
    } else {
      waarde = sent(item.waarde);
    }
    return { ontvanger: teks(item.ontvanger, 200), tipe, waarde };
  });
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const store = kry_fakture_store();
  const wie = (gebruiker && gebruiker.email) || "";

  let sleutel = teks(invoer.sleutel);
  let rekord;
  let nuut = false;

  if (sleutel) {
    // 'n Bestaande konsep. Die sleutel kom van die vorm af, dus word hy
    // getoets voordat hy 'n store-sleutel word.
    if (!is_konsep_sleutel(sleutel)) {
      return { statusCode: 400, body: "Ongeldige konsep-sleutel" };
    }
    try {
      rekord = await store.get(sleutel, { type: "json" });
    } catch (fout) {
      console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
      return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
    }
    if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };
    if (rekord.stand !== "konsep") {
      return {
        statusCode: 409,
        body: "Hierdie faktuur is uitgereik en kan nie meer gewysig word nie. Kanselleer dit en reik 'n nuwe uit.",
      };
    }
  } else {
    rekord = nuwe_faktuur(wie);
    sleutel = skep_konsep_sleutel();
    voeg_geskiedenis_by(rekord, "konsep geskep", wie);
    nuut = true;
  }

  // ── Die dokument ────────────────────────────────────────────────────────

  // Die taal van die DOKUMENT, per faktuur. 'n Onbekende waarde val terug op
  // wat reeds op die rekord staan, nie op 'n verstek nie — 'n tikfout in die
  // invoer mag nie 'n keuse omkeer wat iemand doelbewus gemaak het nie.
  if (invoer.taal !== undefined) {
    rekord.taal = TALE.includes(invoer.taal) ? invoer.taal : rekord.taal;
  }

  // Die kliënt se afskrif word HIER uit die register gelees, nie van die vorm
  // af aanvaar nie. Anders kan die naam op die dokument van die register
  // afwyk sonder dat iemand dit weet.
  if (invoer.klient_id !== undefined) {
    const klient_id = teks(invoer.klient_id);
    if (!klient_id) {
      rekord.klient_id = null;
      rekord.klient = { naam: "", kontakpersoon: "", epos: "", selfoon: "", adres: "" };
    } else {
      let klient;
      try {
        klient = await kry_kliente_store().get(klient_id, { type: "json" });
      } catch (fout) {
        console.error(`Kon nie kliënt ${klient_id} lees nie:`, fout);
        return { statusCode: 500, body: "Kon nie die kliënt laai nie" };
      }
      if (!klient) return { statusCode: 404, body: "Kliënt nie gevind nie" };
      rekord.klient_id = klient_id;
      rekord.klient = {
        naam: klient.naam || "",
        // Die register se veld heet `kontak`; op die faktuur heet dit
        // `kontakpersoon`. Die afskrif dra die faktuur se naam.
        kontakpersoon: klient.kontak || "",
        epos: klient.epos || "",
        selfoon: klient.selfoon || "",
        adres: klient.adres || "",
      };
    }
  }

  if (invoer.bestelnommer !== undefined) rekord.bestelnommer = teks(invoer.bestelnommer, 100);
  if (invoer.dokument_nota !== undefined) rekord.dokument_nota = teks(invoer.dokument_nota, 3000);
  if (invoer.reels !== undefined) rekord.reels = lees_reels(invoer.reels);

  // betaalbaar_teen staan op die DOKUMENT en keer niks. verval_op maak die
  // BETAALSKAKEL dood. Hulle word hier apart gelees juis omdat hulle maklik
  // verwar word.
  if (invoer.betaalbaar_teen !== undefined) rekord.betaalbaar_teen = datum(invoer.betaalbaar_teen);
  if (invoer.verval_op !== undefined) rekord.verval_op = datum(invoer.verval_op);

  // ── Die backoffice ──────────────────────────────────────────────────────

  if (invoer.koste !== undefined) rekord.koste = lees_koste(invoer.koste);
  if (invoer.verdeling !== undefined) rekord.verdeling = lees_verdeling(invoer.verdeling);

  if (invoer.hosting_pct !== undefined) {
    const pct = Number(invoer.hosting_pct);
    rekord.hosting_pct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  }

  if (invoer.afslag_sent !== undefined) rekord.afslag_sent = sent(invoer.afslag_sent);
  if (invoer.skenking_sent !== undefined) rekord.skenking_sent = sent(invoer.skenking_sent);
  if (invoer.koepon_kode !== undefined) {
    rekord.koepon_kode = teks(invoer.koepon_kode, 40).toUpperCase() || null;
  }

  // ── Die totaal ──────────────────────────────────────────────────────────
  //
  // Reëls minus afslag, plus skenking. Die AFSLAG verminder wat verdeel word;
  // die SKENKING doen dit nie — sy tel by wat betaal word en bly buite die
  // verdeling. Dit is Future Sharp se geld.
  //
  // Die afslag kan nie onder nul druk nie: 'n koepon wat meer aftrek as wat
  // die faktuur is, gee R0, nie 'n krediet nie.
  const reelsom = rekord.reels.reduce((s, r) => s + (r.bedrag_sent || 0), 0);
  const netto = Math.max(0, reelsom - (rekord.afslag_sent || 0));
  rekord.totaal_sent = netto + (rekord.skenking_sent || 0);

  rekord.bygewerk_op = new Date().toISOString();

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error("Kon nie die faktuur stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die faktuur stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sleutel,
      nuut,
      stand: rekord.stand,
      totaal_sent: rekord.totaal_sent,
      bygewerk_op: rekord.bygewerk_op,
    }),
  };
};
