// netlify/functions/aanvaar-kwotasie.js
//
// 'n Kliënt aanvaar 'n kwotasie op die publieke bladsy, en 'n faktuur word
// onmiddellik uitgereik. PUBLIEK — geen rol, geen aanmelding.
//
// DIE BEWYS IS DIE SLEUTEL PLUS DIE PUBLIEKE KODE, presies soos
// kry-betaalstand.js. Die kwotasienommer is deurlopend en dus tel-baar; die
// kode is dit nie. Hier weeg dit swaarder as by 'n faktuur, want hierdie
// Function REIK 'N FAKTUUR UIT — sy skep 'n nommer, 'n Paystack-split en 'n
// verpligting teenoor begunstigdes.
//
// EEN BOODSKAP VIR ELKE SOORT MISLUKKING. Sê 'n mens "kwotasie nie gevind
// nie" teenoor "verkeerde kode", verklap die verskil watter nommers bestaan.
//
// SY ROEP DIESELFDE reik_faktuur_uit() AS stuur-faktuur.js. Een pad, twee
// ingange. Sou hierdie lêer sy eie uitreiking dra, sou die twee kopieë
// uitmekaar loop en dit sou STIL gebeur -- 'n split wat anders bereken word as
// die een wat 'n direkteur sien.
//
// DIE VOLGORDE IS NIE ONDERHANDELBAAR NIE:
//
//   1. verifieer die kwotasie
//   2. mag sy aanvaar word? (uitgereik, nie verval, nie reeds aanvaar)
//   3. skryf 'n faktuur-KONSEP uit die kwotasie se reels
//   4. reik hom uit deur die gedeelde module
//   5. merk die kwotasie as aanvaar, met 'n verwysing na die faktuur
//
// STAP 5 KOM LAASTE. Misluk die uitreiking, staan die kwotasie nog op
// "uitgereik" en die kliënt kan weer probeer. Sou ons haar eerste merk, sou 'n
// mislukte uitreiking 'n kwotasie laat wat aanvaar is en geen faktuur het nie.
//
// 'N TWEEDE KLIK SKEP NIE 'N TWEEDE FAKTUUR NIE. Sien kan_aanvaar(): sy toets
// die stand EN `faktuur_nommer`. Is daar reeds een, kom die bestaande faktuur
// terug -- 'n herlaai mag nie 'n nommer en 'n Paystack-verwysing opgebruik nie.

const {
  kry_kwotasies_store,
  sleutel_na_nommer,
  kan_aanvaar,
  is_verval,
  voeg_geskiedenis_by,
} = require("./_kwotasies");
const {
  kry_fakture_store,
  skep_konsep_sleutel,
  nuwe_faktuur,
} = require("./_fakture");
const { reik_faktuur_uit } = require("./_faktuur-uitreik");

function teks(waarde, maks) {
  const skoon = String(waarde == null ? "" : waarde).trim();
  return maks ? skoon.slice(0, maks) : skoon;
}

// 'n E-posadres wat ten minste die vorm het. Nie 'n volledige toets nie --
// daardie bestaan nie -- maar genoeg om 'n tikfout te vang voordat 'n faktuur
// daarheen gaan.
function lyk_soos_epos(waarde) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teks(waarde));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const sleutel = teks(invoer.sleutel);
  const kode = teks(invoer.kode);

  const NIE_GEVIND = { statusCode: 404, body: "Nie gevind nie" };
  if (!sleutel || !kode) return NIE_GEVIND;
  // Slegs 'n genommerde kwotasie. 'n Konsep het geen publieke kode en dus geen
  // skakel wat 'n kliënt kon ontvang het nie.
  if (!sleutel_na_nommer(sleutel)) return NIE_GEVIND;

  const kw_store = kry_kwotasies_store();

  let kwotasie;
  try {
    kwotasie = await kw_store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie laai nie" };
  }
  if (!kwotasie) return NIE_GEVIND;
  if (!kwotasie.publieke_kode || kwotasie.publieke_kode !== kode) return NIE_GEVIND;

  const nou = new Date().toISOString();

  /* REEDS AANVAAR: gee die BESTAANDE faktuur terug, moenie 'n tweede skep nie.

     Dit is nie 'n randgeval nie. 'n Kliënt klik Aanvaar, die bladsy is stadig,
     hy klik weer. Of hy stuur die skakel aan en iemand anders klik hom ook.
     Elke tweede klik sou 'n faktuurnommer EN 'n Paystack-verwysing opgebruik.

     Die antwoord is 200, nie 'n fout nie: uit die kliënt se oogpunt HET die
     aanvaarding geslaag, en dit is die waarheid. */
  if (kwotasie.faktuur_nommer) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reeds: true,
        kwotasie_nommer: kwotasie.nommer,
        faktuur_nommer: kwotasie.faktuur_nommer,
        faktuur_sleutel: kwotasie.faktuur_sleutel,
        publieke_kode: kwotasie.faktuur_publieke_kode || null,
      }),
    };
  }

  // VERVAL IS 'N EIE ANTWOORD, nie 'n 404 nie. Die kwotasie bestaan en die
  // kliënt hou 'n geldige skakel; die datum is net verby. Die bladsy sê dit en
  // wys die kontakbesonderhede — 'n 404 sou lyk of die skakel stukkend is.
  if (is_verval(kwotasie, nou)) {
    return {
      statusCode: 410,
      body: "Hierdie kwotasie het verval.",
    };
  }

  if (!kan_aanvaar(kwotasie, nou)) {
    return {
      statusCode: 409,
      body: "Hierdie kwotasie kan nie aanvaar word nie.",
    };
  }

  // ── Wie aanvaar ─────────────────────────────────────────────────────────
  //
  // 'n Kwotasie word AANGESTUUR: die departementshoof stuur hom na finansies,
  // of andersom. Die persoon wat klik, is dikwels nie die geadresseerde nie,
  // en "aanvaar" sonder 'n persoon daaragter is geen rekord nie.
  const naam = teks(invoer.naam, 200);
  const epos = teks(invoer.epos, 200);
  const bestelnommer = teks(invoer.bestelnommer, 100);

  if (!naam) return { statusCode: 400, body: "Gee die naam van die persoon wat aanvaar." };
  if (!lyk_soos_epos(epos)) return { statusCode: 400, body: "Gee 'n geldige e-posadres." };

  // ── Die faktuur-konsep ──────────────────────────────────────────────────
  //
  // Die BEDRAE kom uit die kwotasie: dit is wat die kliënt aanvaar het. Die
  // BETAALROETES word by uitreiking bepaal -- of 'n begunstigde 'n subrekening
  // het, is 'n feit oor VANDAG, nie oor die dag van die aanbod nie.
  //
  // Die reels word HEEL oorgedra, met hul verdelings, hul hosting en hul
  // vou_in. Die faktuur druk dus presies soos die kwotasie gedruk het.
  const f_store = kry_fakture_store();
  const f_sleutel = skep_konsep_sleutel();
  const faktuur = nuwe_faktuur(epos);

  faktuur.taal = kwotasie.taal === "en" ? "en" : "af";
  faktuur.klient_id = kwotasie.klient_id || null;
  faktuur.klient = {
    naam: (kwotasie.klient && kwotasie.klient.naam) || "",
    kontakpersoon: (kwotasie.klient && kwotasie.klient.kontakpersoon) || "",
    // DIE E-POS VAN DIE PERSOON WAT AANVAAR HET, nie die kwotasie s'n nie.
    // Hy is die een wat die faktuur moet kry: hy het pas gesê hy is die een
    // wat hierdie ding hanteer.
    epos,
    selfoon: (kwotasie.klient && kwotasie.klient.selfoon) || "",
    adres: (kwotasie.klient && kwotasie.klient.adres) || "",
  };

  // Die bestelnommer van die kwotasie, of die een wat pas ingetik is. Die nuwe
  // een wen: hy is die vars inligting.
  faktuur.bestelnommer = bestelnommer || teks(kwotasie.bestelnommer, 100);

  faktuur.reels = Array.isArray(kwotasie.reels)
    ? JSON.parse(JSON.stringify(kwotasie.reels))
    : [];
  faktuur.koste = Array.isArray(kwotasie.koste)
    ? JSON.parse(JSON.stringify(kwotasie.koste))
    : [];
  faktuur.dokument_nota = kwotasie.dokument_nota || "";
  faktuur.afslag_sent = Number(kwotasie.afslag_sent) || 0;
  faktuur.skenking_sent = Number(kwotasie.skenking_sent) || 0;
  faktuur.koepon_kode = kwotasie.koepon_kode || null;
  faktuur.totaal_sent = Number(kwotasie.totaal_sent) || 0;

  // WAARUIT DIE FAKTUUR KOM. Sonder dit kan niemand ses maande later antwoord
  // waarvoor hierdie R25 072 gefaktureer is nie.
  faktuur.uit_kwotasie = kwotasie.nommer;
  faktuur.uit_kwotasie_hersiening = Number(kwotasie.hersiening) || 1;

  // Die toetsstempel erf. Was die kwotasie toetsdata, is die faktuur dit ook.
  faktuur.toets = kwotasie.toets === true;

  voeg_geskiedenis_by(
    faktuur,
    "uit kwotasie geskep",
    epos,
    `${kwotasie.nommer} (hersiening ${faktuur.uit_kwotasie_hersiening}) aanvaar deur ${naam}`
  );

  try {
    await f_store.setJSON(f_sleutel, faktuur);
  } catch (fout) {
    console.error(`Kon nie die faktuur-konsep uit ${sleutel} skryf nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur skep nie" };
  }

  // ── Die uitreiking ──────────────────────────────────────────────────────
  //
  // DIESELFDE FUNKSIE AS stuur-faktuur.js. Sy ken die nommer toe, vries die
  // verdeling, skep die split, inisieer die transaksie, skryf onder die nuwe
  // sleutel en pos die proforma.
  //
  // `wie` is die persoon wat geklik het, nie 'n direkteur nie. Dit is wat in
  // die faktuur se geskiedenis land, en dit is die waarheid.
  let uit;
  try {
    uit = await reik_faktuur_uit(f_store, f_sleutel, faktuur, epos);
  } catch (fout) {
    console.error(`Kon nie die faktuur uit ${sleutel} uitreik nie:`, fout);
    uit = { statusCode: 500, body: "Kon nie die faktuur uitreik nie" };
  }

  if (uit.statusCode !== 200) {
    /* DIE KONSEP WORD OPGERUIM. Hy is niemand se werk nie -- hy is 'n paar
       sekondes gelede uit die kwotasie gebou -- en 'n verweesde konsep in die
       faktuurregister sou soos 'n halfklaar faktuur lyk wat iemand vergeet
       het.

       Die KWOTASIE bly onaangeraak: sy staan nog op "uitgereik" en die kliënt
       kan weer probeer. */
    try {
      await f_store.delete(f_sleutel);
    } catch (fout) {
      console.error(`Kon nie die verweesde konsep ${f_sleutel} skrap nie:`, fout);
    }

    console.error(
      `Aanvaarding van ${kwotasie.nommer} het misluk by die uitreiking:`,
      uit.statusCode,
      uit.body
    );

    /* DIE KLIENT KRY NIE DIE MODULE SE BOODSKAP NIE.

       "Die verdeling vra meer as wat die faktuur inbring" is 'n boodskap vir 'n
       direkteur. 'n Skool se departementshoof kan niks daarmee doen nie, en dit
       verklap hoe Future Sharp se geld verdeel word.

       Een boodskap, met 'n pad vorentoe. Die werklike rede staan in die
       logboek hierbo. */
    return {
      statusCode: 502,
      body: "Die kwotasie kon nie aanvaar word nie. Skakel ons en ons help dadelik.",
    };
  }

  const gegewens = JSON.parse(uit.body);

  // ── Die kwotasie word gemerk ────────────────────────────────────────────
  //
  // LAASTE. Die faktuur bestaan reeds; misluk hierdie skryf, is die faktuur
  // steeds uitgereik en die kliënt het sy proforma. Wat verlore gaan, is die
  // verwysing terug -- hinderlik, en herstelbaar met die hand.
  kwotasie.stand = "aanvaar";
  kwotasie.aanvaar_op = nou;
  kwotasie.aanvaar_deur_naam = naam;
  kwotasie.aanvaar_deur_epos = epos;
  kwotasie.aanvaarde_hersiening = Number(kwotasie.hersiening) || 1;
  kwotasie.faktuur_sleutel = gegewens.sleutel;
  kwotasie.faktuur_nommer = gegewens.nommer;
  // Sodat 'n tweede klik die kliënt na dieselfde faktuurbladsy kan stuur.
  kwotasie.faktuur_publieke_kode = null;
  kwotasie.bygewerk_op = nou;

  voeg_geskiedenis_by(
    kwotasie,
    "aanvaar",
    epos,
    `${naam} — faktuur ${gegewens.nommer}` + (bestelnommer ? `, bestelnommer ${bestelnommer}` : "")
  );

  try {
    await kw_store.setJSON(sleutel, kwotasie);
  } catch (fout) {
    console.error(
      `Faktuur ${gegewens.nommer} is uitgereik, maar kwotasie ${sleutel} kon nie gemerk word nie:`,
      fout
    );
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reeds: false,
      kwotasie_nommer: kwotasie.nommer,
      faktuur_nommer: gegewens.nommer,
      faktuur_sleutel: gegewens.sleutel,
      totaal_sent: gegewens.totaal_sent,
      betaalskakel: gegewens.betaalskakel,
      // Die skerm sê eerlik of die proforma uitgegaan het. 'n Stil mislukking
      // laat die kliënt aanneem hy het sy faktuur.
      pos_gestuur: gegewens.pos_gestuur,
    }),
  };
};
