// netlify/functions/uitreik-kwotasie.js
//
// Reik 'n kwotasie uit. Rol: boekhouding.
//
// DIT IS stuur-faktuur.js SE HELFTE. Dieselfde volgorde — keer, dan nommer,
// dan skryf, dan pos — met DRIE dinge wat NIE gebeur nie:
//
//   GEEN PAYSTACK. Geen /split, geen /transaction/initialize, geen
//   betaalskakel. 'n Kwotasie is 'n AANBOD en is nie betaalbaar nie.
//
//   GEEN GEVRIESDE VERDELING. Sy vries by die FAKTUUR se uitreiking, wat by
//   aanvaarding gebeur. Die BEDRAE kom uit die kwotasie; die BETAALROETES —
//   wie deur Paystack betaal word en wie met die hand — is 'n feit oor die
//   dag van fakturering, nie oor die dag van die aanbod. 'n Begunstigde kan
//   intussen 'n subrekening kry.
//
//   GEEN NOMMER UIT DIE FS-REEKS. Die kwotasie kry KW/01961 uit sy eie reeks.
//
// MAAR DIE SOM LOOP VOLLEDIG, insluitend die oorbestee-kontrole. 'n Prys wat
// nie sy eie verdeling kan dra nie, moet HIER gekeer word: hier kan dit nog
// verander. By die faktuur is dit 'n gesprek met die kliënt.
//
// DIE VOLGORDE IS NIE ONDERHANDELBAAR NIE: nommer toeken, dan onder die nuwe
// sleutel skryf, dan die konsep-sleutel skrap. Skryf 'n mens eers en skrap
// dan, en die skrap misluk, lê daar twee rekords van dieselfde kwotasie. Die
// pos gaan LAASTE — 'n pos wat misluk, mag nie 'n uitgereikte kwotasie
// halfpad laat nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_kwotasies_store,
  is_konsep_sleutel,
  skep_nommer,
  sleutel_na_nommer,
  skep_publieke_kode,
  verstek_geldig_tot,
  is_verval,
  voeg_geskiedenis_by,
} = require("./_kwotasies");
const { datum_dokument } = require("./_fakture");
const { kry_maatskappy } = require("./_instellings");
const { stuur_epos, ontsnap } = require("./_stuur-epos");
// t_rand alleen. `fd_kwotasie` BESTAAN NIE in taal.js nie, en t_in() gee die
// SLEUTEL terug wanneer hy hom nie ken nie — dan sou "fd_kwotasie" as die
// opskrif van 'n kliënt se e-pos staan. Dit het op 6 Augustus gebeur. Die
// dokument se sleutels kom by wanneer die kwotasieblad gebou word; tot dan
// staan die twee woorde hier.
const { t_rand } = require("../../public/js/taal.js");

// DIESELFDE LÊER WAT DIE BLAAIER LAAI. Nie 'n kopie nie — die lêer self. Die
// kwotasie en die faktuur mag nooit twee somme hê nie.
const { fs_bereken, fs_invoer_uit_faktuur } = require("../../public/js/faktuur-som.js");

// Die vorm kan hierop tak: 422 beteken "die kwotasie is reg, maar sy het
// nêrens om heen te gaan nie".
const GEEN_EPOS = 422;

function teks(waarde) {
  return String(waarde == null ? "" : waarde).trim();
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

  const sleutel = teks(invoer.sleutel);
  if (!sleutel || !is_konsep_sleutel(sleutel)) {
    return { statusCode: 400, body: "Ongeldige konsep-sleutel" };
  }

  const store = kry_kwotasies_store();
  const wie = (gebruiker && gebruiker.email) || "";
  const nou = new Date().toISOString();

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Kwotasie nie gevind nie" };
  if (rekord.stand !== "konsep") {
    return { statusCode: 409, body: "Hierdie kwotasie is reeds uitgereik." };
  }

  // ── Die keer, terwyl die konsep nog heel is ──────────────────────────────

  const reels = Array.isArray(rekord.reels) ? rekord.reels : [];
  if (!reels.length) {
    return { statusCode: 400, body: "Die kwotasie het nog geen reëls nie." };
  }

  if (!teks(rekord.klient_id)) {
    return { statusCode: 400, body: "Kies eers 'n kliënt." };
  }

  // SONDER 'N E-POS HET DIE KWOTASIE NÊRENS OM HEEN TE GAAN NIE. Dit weeg
  // swaarder as by 'n faktuur: die kliënt AANVAAR deur 'n skakel, en 'n
  // skakel wat nooit uitgaan nie, kan nie geklik word nie.
  const klient_epos = teks(rekord.klient && rekord.klient.epos);
  if (!klient_epos) {
    return {
      statusCode: GEEN_EPOS,
      body: "Hierdie kliënt het nog geen e-posadres nie, en die kwotasie het dus nêrens om heen te gaan nie.",
    };
  }

  // DIE GELDIGHEID. Leeg beteken hier NIE "geen verval" nie — dit beteken die
  // verstek van dertig dae. Presies andersom as die faktuur se `verval_op`,
  // waar leeg beteken die betaalskakel bly oop.
  if (!rekord.geldig_tot) rekord.geldig_tot = verstek_geldig_tot(nou);

  // 'n Aanbod wat op die dag van uitreiking reeds verby is, is 'n fout in die
  // konsep, nie iets om stilweg deur te laat nie.
  if (is_verval(rekord, nou)) {
    return {
      statusCode: 400,
      body: "Die geldigheidsdatum lê in die verlede — die kwotasie sou dadelik verval wees.",
    };
  }

  // ── Die som ─────────────────────────────────────────────────────────────
  //
  // `het_subrekening` gee ALTYD false terug, en dit is korrek. Die som gebruik
  // hom sedert 25 Augustus nie meer nie (sien faktuur-som.js), en 'n kwotasie
  // mag in elk geval nie op 'n betaalroete steun wat eers by fakturering
  // bepaal word nie.
  const u = fs_bereken(fs_invoer_uit_faktuur(rekord, () => false));

  if (u.oorbestee) {
    // DIE BOODSKAP NOEM DIE REELS BY NOMMER EN NAAM. Die som weet klaar watter
    // reëls die meeste vra; "hierdie kwotasie is oorbestee" gooi daardie
    // inligting weg en laat 'n mens self soek.
    //
    // MAAR NIE ELKE REEL WAT OORSKRY, IS 'N PROBLEEM NIE. 'n Vaste bedrag wat
    // sy reël met 'n paar sent oorskry, word deur die ander reëls GEDRA en dit
    // werk — die split loop oor die hele dokument. Sien besluit 5 in
    // Verdeling-Per-Lynitem-Ontwerp.md: 'n stop oor vyf sent is presies hoe 'n
    // mens leer om stops te ignoreer.
    //
    // Wat hier gekeer word, is die faktuur AS GEHEEL. Die name is dus 'n
    // AANWYSING na waar om te kyk — die grootstes eerste, hoogstens drie —
    // nie 'n lys van foute nie.
    const oorskrei = (u.perReel || [])
      .map((p, ix) => ({ ix, kort: p.toegekenSent - p.basisSent }))
      .filter((x) => x.kort > 0)
      .sort((a, b) => b.kort - a.kort)
      .slice(0, 3)
      .map((x) => `${x.ix + 1}. ${teks(reels[x.ix] && reels[x.ix].beskrywing) || "naamloos"}`);

    return {
      statusCode: 409,
      body: oorskrei.length
        ? `Die verdeling vra meer as wat die kwotasie inbring. Kyk na ${oorskrei.join(", ")}.`
        : "Die verdeling vra meer as wat die kwotasie inbring.",
    };
  }

  // ── Die nommer ──────────────────────────────────────────────────────────
  //
  // Eers HIER, en nie by die skep van die konsep nie: anders lê daar gate in
  // die reeks van kwotasies wat nooit uitgegaan het nie.
  let nuwe_sleutel;
  try {
    nuwe_sleutel = await skep_nommer(store);
  } catch (fout) {
    console.error("Kon nie 'n kwotasienommer toeken nie:", fout);
    return { statusCode: 500, body: "Kon nie 'n kwotasienommer toeken nie" };
  }
  const nommer = sleutel_na_nommer(nuwe_sleutel);

  // Die kode wat die publieke bladsy toelaat om HIERDIE kwotasie te wys. Die
  // nommerreeks is deurlopend en dus tel-baar; sonder die kode kon iemand by
  // KW-01961 begin en deur die reeks loop. Hier weeg dit swaarder as by die
  // faktuur, want die publieke bladsy dra 'n knoppie wat 'n faktuur uitreik.
  const publieke_kode = teks(rekord.publieke_kode) || skep_publieke_kode();

  rekord.nommer = nommer;
  rekord.stand = "uitgereik";
  rekord.uitgereik_op = nou;
  rekord.bygewerk_op = nou;
  rekord.publieke_kode = publieke_kode;
  voeg_geskiedenis_by(
    rekord,
    "uitgereik",
    wie,
    `${nommer} — ${t_rand(rekord.totaal_sent, "af")}, geldig tot ${datum_dokument(rekord.geldig_tot)}`
  );

  // Skryf eers onder die nuwe sleutel, dan skrap die konsep. Misluk die skrap,
  // bestaan die kwotasie ten minste onder sy nommer.
  try {
    await store.setJSON(nuwe_sleutel, rekord);
  } catch (fout) {
    console.error(`Kon nie kwotasie ${nuwe_sleutel} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie uitreik nie" };
  }
  try {
    await store.delete(sleutel);
  } catch (fout) {
    // Nie 'n fout wat die uitreiking keer nie. Die konsep-sleutel bly lê en
    // word by die volgende opruiming gevang; die kwotasie self is uit.
    console.error(`Kon nie die konsep ${sleutel} skrap nie:`, fout);
  }

  // ── Die pos ─────────────────────────────────────────────────────────────
  //
  // LAASTE, en sy mag nie die uitreiking omkeer nie. _stuur-epos.js gooi
  // nooit 'n fout nie; hy gee { ok, fout } terug.
  const pos = await stuur_kwotasie_pos(rekord, nuwe_sleutel, publieke_kode);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sleutel: nuwe_sleutel,
      nommer,
      stand: rekord.stand,
      geldig_tot: rekord.geldig_tot,
      publieke_kode,
      totaal_sent: rekord.totaal_sent,
      pos_ok: Boolean(pos && pos.ok),
      pos_fout: (pos && pos.fout) || null,
    }),
  };
};

/* ═══ die pos ═══

   Die syfers in die pos self, plus die skakel. IN DIE KWOTASIE SE TAAL — dit
   is die kliënt se dokument, nie ons skerm nie.

   GEEN BANKBESONDERHEDE EN GEEN BETAALKNOPPIE. 'n Kwotasie is nie betaalbaar
   nie, en 'n bankrekening op 'n aanbod nooi 'n betaling uit vir iets wat nog
   nie gefaktureer is nie — dan land geld in die hoofrekening sonder 'n
   faktuur om dit teen af te skryf.

   GEEN PDF-AANHEGSEL NIE, nog nie. _faktuur-pdf.js is heeltemal
   faktuur-gevorm: `fd_proforma`, `fd_gefaktureer_aan`, `fd_betaalbaar_teen`,
   `fd_totaal_verskuldig` en 'n betaalblok met QR. Om hom albei dokumente te
   laat dra, is 'n verandering aan 'n werkende lêer wat kliëntdokumente
   produseer, en dit is sy eie stuk werk. Die skakel dra intussen die
   dokument. */
async function stuur_kwotasie_pos(rekord, sleutel, kode) {
  try {
    const aan = teks(rekord.klient && rekord.klient.epos);
    if (!aan) return { ok: false, fout: "Geen kliënt-e-pos" };

    let maatskappy = null;
    try {
      maatskappy = await kry_maatskappy();
    } catch (fout) {
      console.error("Kwotasie: kon nie die instelling lees nie:", fout);
    }

    const taal = rekord.taal === "en" ? "en" : "af";
    const en = taal === "en";
    const nommer = rekord.nommer || "";
    const bedrag = t_rand(rekord.totaal_sent, taal);
    const geldig = datum_dokument(rekord.geldig_tot);

    // DIESELFDE PATROON AS stuur-faktuur.js SE callback_url. `_instellings.js`
    // dra GEEN werf-adres nie — ek het gaan kyk — dus is Netlify se `URL` die
    // bron, en dit is ook waar die betaalskakel s'n vandaan kom.
    const basis = process.env.URL || "http://localhost:8888";
    const skakel = `${basis}/kwotasie.html?k=${encodeURIComponent(sleutel)}&kode=${encodeURIComponent(kode)}`;

    const hersien = Number(rekord.hersiening) > 1;

    const reels = [
      hersien
        ? en
          ? `Please find the revised quotation <b>${ontsnap(nommer)}</b> below. It replaces the previous version.`
          : `Hierby die hersiene kwotasie <b>${ontsnap(nommer)}</b>. Dit vervang die vorige weergawe.`
        : en
          ? `Please find quotation <b>${ontsnap(nommer)}</b> below.`
          : `Hierby kwotasie <b>${ontsnap(nommer)}</b>.`,

      `${en ? "Quotation number" : "Kwotasienommer"}: <b>${ontsnap(nommer)}</b><br>` +
        `${en ? "Total" : "Totaal"}: <b>${bedrag}</b><br>` +
        `${en ? "Valid until" : "Geldig tot"}: <b>${ontsnap(geldig)}</b>`,

      en
        ? "Open the quotation to view the full breakdown. If you accept it, an invoice is issued immediately and the payment options appear."
        : "Maak die kwotasie oop om die volledige afbreek te sien. Aanvaar u dit, word 'n faktuur onmiddellik uitgereik en die betaalopsies verskyn.",

      // Die aanpassing gaan BUITE die stelsel — 'n oproep of 'n e-pos. Die
      // publieke bladsy dra geen wysigingsvorm nie: wat 'n kliënt daarin sou
      // tik, is nooit 'n instruksie wat uitgevoer kan word nie, dit is die
      // begin van 'n gesprek wat in elk geval gevoer moet word.
      en
        ? `Questions or an adjustment? Email us at ${ontsnap(teks((maatskappy && maatskappy.epos) || "admin@futuresharp.co.za"))}.`
        : `Vrae of 'n aanpassing? E-pos ons by ${ontsnap(teks((maatskappy && maatskappy.epos) || "admin@futuresharp.co.za"))}.`,
    ];

    return await stuur_epos({
      merk: "faktuur",
      aan,
      onderwerp: en ? `Quotation ${nommer}` : `Kwotasie ${nommer}`,
      opskrif: en ? "Quotation" : "Kwotasie",
      reels,
      knoppie: {
        teks: en ? `View quotation ${nommer}` : `Sien kwotasie ${nommer}`,
        url: skakel,
      },
    });
  } catch (fout) {
    console.error("Kon nie die kwotasie pos nie:", fout);
    return { ok: false, fout: String((fout && fout.message) || fout) };
  }
}

module.exports.stuur_kwotasie_pos = stuur_kwotasie_pos;
