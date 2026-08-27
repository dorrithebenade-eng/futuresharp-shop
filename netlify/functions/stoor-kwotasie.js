// netlify/functions/stoor-kwotasie.js
//
// Skep of werk 'n kwotasie-KONSEP by. Rol: boekhouding.
//
// DIT IS stoor-faktuur.js SE TWEELING, en dit moet dit bly. Albei dokumente
// deel EEN vorm (faktuur.html), EEN som (faktuur-som.js) en EEN backoffice
// (faktuur-backoffice.js). Loop die twee stoorfunksies uitmekaar, loop die
// dokumente uitmekaar — en dit gebeur stilweg, want die skerm sou steeds
// reg lyk.
//
// DIT RAAK NET KONSEPTE. 'n Uitgereikte kwotasie dra 'n dokument wat reeds by
// die kliënt is en 'n skakel wat hy kan klik. Wil 'n mens die aanbod verander,
// is dit 'n HERSIENING (hersien-kwotasie.js), nie 'n stoor nie: die ou aanbod
// moet as momentopname bewaar word en dood wees, nie stilweg oorgeskryf nie.
//
// GEEN `...wysigings`-spread. Elke veld word hier met die hand gelees en
// gevalideer. 'n Nuwe veld wat deur 'n spread instroom, is 'n veld wat niemand
// nagegaan het nie.
//
// ALLE BEDRAE IS SENT, heelgetalle.
//
// DIE BEDRAE WORD OP DIE BEDIENER GEREKEN. Die vorm stuur die hoeveelheid en
// die eenheidsprys; die reël se bedrag en die totaal word hier bereken. Dit
// is die getal wat by aanvaarding na die faktuur oorgedra word.
//
// DIE GESKIEDENIS KRY NET DIE SKEPPING. 'n Konsep stoor outomaties sowat twee
// sekondes ná iemand ophou tik. Wat saak maak — uitgereik, hersien, aanvaar —
// word deur die Functions aangeteken wat dit doen.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_kwotasies_store,
  skep_konsep_sleutel,
  is_konsep_sleutel,
  nuwe_kwotasie,
  voeg_geskiedenis_by,
} = require("./_kwotasies");
const { TALE } = require("./_fakture");
const { kry_kliente_store } = require("./_kliente");

// Dieselfde twee lyste as stoor-faktuur.js. Hulle staan hier oor en word nie
// ingevoer nie: 'n kwotasie se reëlsoorte is sy eie feit, en 'n verandering
// aan die faktuur s'n moet 'n bewuste besluit hier wees, nie 'n newe-effek.
const REEL_SOORTE = ["verkoop", "koste"];
const RY_TIPES = ["pct", "vas"];

// Sent, altyd 'n heelgetal, nooit negatief. Math.round en nie Math.trunc nie.
function sent(waarde) {
  const getal = Number(waarde);
  if (!Number.isFinite(getal) || getal < 0) return 0;
  return Math.round(getal);
}

function teks(waarde, maks) {
  const skoon = String(waarde == null ? "" : waarde).trim();
  return maks ? skoon.slice(0, maks) : skoon;
}

function datum(waarde) {
  const skoon = teks(waarde);
  if (!skoon) return null;
  const d = new Date(skoon);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Die lewende verdeling van EEN REEL.
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

// Die reëls van die dokument, elk met sy eie verdeling en sy eie hosting.
//
// GEEN `|| 5`-TERUGVAL OP hosting_pct NIE. 'n Doelbewuste nul moet die
// rondreis oorleef: op 'n kostereël beteken nul dat hosting nie gehef word
// nie, en dit is 'n keuse, nie 'n weglating nie.
function lees_reels(rou) {
  if (!Array.isArray(rou)) return [];
  return rou.slice(0, 40).map((r) => {
    const item = r || {};
    const hoeveelheid = Number(item.hoeveelheid);
    const veilig = Number.isFinite(hoeveelheid) && hoeveelheid >= 0 ? hoeveelheid : 0;
    const prys_pp_sent = sent(item.prys_pp_sent);
    const hosting = Number(item.hosting_pct);

    return {
      soort: REEL_SOORTE.includes(item.soort) ? item.soort : "verkoop",
      beskrywing: teks(item.beskrywing, 300),
      hoeveelheid: veilig,
      prys_pp_sent,
      bedrag_sent: Math.round(veilig * prys_pp_sent),
      op_faktuur: item.op_faktuur !== false,
      hosting_pct: Number.isFinite(hosting) ? Math.min(100, Math.max(0, hosting)) : 0,
      verdeling: lees_verdeling(item.verdeling),
    };
  });
}

// Die begroting. 'n MAATSTAF, nie 'n verpligting: wat julle verwag om te
// bestee. Sy betaal niemand — 'n uitbetaling gebeur slegs deur 'n REEL met 'n
// verdeling. Op 'n kwotasie is sy nog belangriker as op 'n faktuur: hier
// beantwoord sy die vraag of die PRYS wat aangebied word, genoeg is.
function lees_koste(rou) {
  if (!Array.isArray(rou)) return [];
  return rou.slice(0, 40).map((k) => {
    const item = k || {};
    return {
      beskrywing: teks(item.beskrywing, 300),
      ontvanger: teks(item.ontvanger, 200),
      bedrag_sent: sent(item.bedrag_sent),
      inskrywing: teks(item.inskrywing, 500),
    };
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

  const store = kry_kwotasies_store();
  const wie = (gebruiker && gebruiker.email) || "";

  let sleutel = teks(invoer.sleutel);
  let rekord;
  let nuut = false;

  if (sleutel) {
    // Die sleutel kom van die vorm af, dus word hy getoets voordat hy 'n
    // store-sleutel word. `is_konsep_sleutel` hier is DIE KWOTASIE S'N —
    // "KWKONSEP-" — dus kan hierdie Function nooit 'n faktuurkonsep raak nie,
    // ook nie as iemand die sleutel oortik nie.
    if (!is_konsep_sleutel(sleutel)) {
      return { statusCode: 400, body: "Ongeldige konsep-sleutel" };
    }
    try {
      rekord = await store.get(sleutel, { type: "json" });
    } catch (fout) {
      console.error(`Kon nie kwotasie ${sleutel} lees nie:`, fout);
      return { statusCode: 500, body: "Kon nie die kwotasie laai nie" };
    }
    if (!rekord) return { statusCode: 404, body: "Kwotasie nie gevind nie" };
    if (rekord.stand !== "konsep") {
      return {
        statusCode: 409,
        body: "Hierdie kwotasie is uitgereik. Hersien dit om die aanbod te verander.",
      };
    }
  } else {
    rekord = nuwe_kwotasie(wie);
    sleutel = skep_konsep_sleutel();
    voeg_geskiedenis_by(rekord, "konsep geskep", wie);
    nuut = true;
  }

  // ── Die dokument ────────────────────────────────────────────────────────

  // Die taal van die DOKUMENT, per kwotasie. 'n Onbekende waarde val terug op
  // wat reeds op die rekord staan, nie op 'n verstek nie.
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
        // Die register se veld heet `kontak`; op die dokument heet dit
        // `kontakpersoon`. Die afskrif dra die dokument se naam.
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

  // DIE GELDIGHEID.
  //
  // Op 'n faktuur is die ooreenstemmende veld `betaalbaar_teen`, wat NIKS
  // keer nie — 'n faktuur wat verby sy datum is, kan steeds betaal word. Hier
  // is dit die teenoorgestelde: verby die datum weier aanvaar-kwotasie.js.
  //
  // 'n Konsep mag hom dra sodat 'n mens die datum vooraf kan stel; is hy leeg
  // by uitreiking, stel uitreik-kwotasie.js hom op dertig dae.
  if (invoer.geldig_tot !== undefined) rekord.geldig_tot = datum(invoer.geldig_tot);

  // ── Die backoffice ──────────────────────────────────────────────────────

  if (invoer.koste !== undefined) rekord.koste = lees_koste(invoer.koste);

  if (invoer.afslag_sent !== undefined) rekord.afslag_sent = sent(invoer.afslag_sent);
  if (invoer.skenking_sent !== undefined) rekord.skenking_sent = sent(invoer.skenking_sent);
  if (invoer.koepon_kode !== undefined) {
    rekord.koepon_kode = teks(invoer.koepon_kode, 40).toUpperCase() || null;
  }

  // ── Die totaal ──────────────────────────────────────────────────────────
  //
  // Reëls minus afslag, plus skenking. Presies dieselfde som as
  // stoor-faktuur.js, en dit moet so bly: die kliënt aanvaar hierdie bedrag
  // en die faktuur moet dieselfde een dra.
  const reelsom = rekord.reels.reduce((s, r) => s + (r.bedrag_sent || 0), 0);
  const netto = Math.max(0, reelsom - (rekord.afslag_sent || 0));
  rekord.totaal_sent = netto + (rekord.skenking_sent || 0);

  rekord.bygewerk_op = new Date().toISOString();

  try {
    await store.setJSON(sleutel, rekord);
  } catch (fout) {
    console.error("Kon nie die kwotasie stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die kwotasie stoor nie" };
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
