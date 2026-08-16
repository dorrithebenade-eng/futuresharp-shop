// netlify/functions/stuur-faktuur.js
//
// Reik 'n konsep uit. Rol: boekhouding.
//
// Dit is die oomblik waarop 'n faktuur ophou om 'n konsep te wees. Vyf dinge
// gebeur, in hierdie volgorde, en die volgorde is die punt:
//
//   1. alles word nagegaan terwyl die konsep nog heel is
//   2. die nommer word toegeken
//   3. Paystack se verdeling en transaksie word geskep
//   4. EERS DAN word die rekord onder sy FS-sleutel geskryf
//   5. en die konsep-sleutel verwyder
//
// WAAROM PAYSTACK VOOR DIE SKRYF: misluk hy — 'n verkeerde subrekening-kode,
// 'n netwerkfout — bly die konsep presies soos hy was en niks is verlore nie.
// Die nommer wat by stap 2 gekies is, is dan ook nie opgebruik nie: hy word
// uit die BESTAANDE sleutels afgelei, en daar is niks geskryf nie, dus kies
// die volgende poging dieselfde nommer.
//
// DIE BEDRAE WORD HIER GEREKEN, NOOIT VAN DIE VORM AANVAAR NIE. Dit is die
// getalle waarop mense se geld loop. Die som is DIESELFDE lêer wat die skerm
// laai — public/js/faktuur-som.js — sodat die skerm en die gevriesde
// verdeling nie met 'n sent kan verskil nie.
//
// DIE SPLIT IS `flat`, NIE `percentage` NIE.
//
// begin-betaling.js reken elke subrekening se aandeel om na 'n persentasie
// met twee desimale. Op 'n R80-boek is dit 'n sent; op 'n R25 000-faktuur is
// 0,01% R2,50 per ry. By 'n vaste split is elke `share` 'n bedrag in SENT:
// die subrekeninge kry presies wat gevries is, en die hoofrekening kry wat
// oorbly — Paystack se fooi, Hosting en die oorskot. Dit is die aftreksom
// presies soos sy bedoel is.
//
// 'N MISLUKTE SPLIT KEER DIE UITREIKING. begin-betaling.js val terug op die
// hoofrekening sodat 'n koper se aankoop nie hierom breek nie; daar staan 'n
// mens by 'n kassa. Hier staan 'n mens by 'n tafel, en 'n faktuur wat stilweg
// sonder verdeling uitgaan, beteken elke ontvanger moet met die hand betaal
// word sonder dat iemand weet waarom. Die faktuur is die rekord van waarheid;
// hy word nie half uitgereik nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const {
  kry_fakture_store,
  is_konsep_sleutel,
  skep_nommer,
  sleutel_na_nommer,
  skep_publieke_kode,
  voeg_geskiedenis_by,
} = require("./_fakture");
const { kry_maks_verdeling_sent } = require("./_paystack-koste.js");

// DIESELFDE LÊER WAT DIE BLAAIER LAAI. Nie 'n kopie nie — die lêer self.
const {
  fs_bereken,
  fs_invoer_uit_faktuur,
  FS_PS_PCT,
  FS_PS_VAS,
} = require("../../public/js/faktuur-som.js");

// Die vorm kan hierop takke: 422 beteken "die faktuur is reg, maar hy het
// nêrens om heen te gaan nie". Die boodskap dra 'n knoppie om die e-pos daar
// en dan by te voeg, sonder om die faktuur te verlaat.
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

  const store = kry_fakture_store();
  const wie = (gebruiker && gebruiker.email) || "";
  const nou = new Date().toISOString();

  let rekord;
  try {
    rekord = await store.get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };
  if (rekord.stand !== "konsep") {
    return { statusCode: 409, body: "Hierdie faktuur is reeds uitgereik." };
  }

  // ── Die keer, terwyl die konsep nog heel is ──────────────────────────────

  const reels = Array.isArray(rekord.reels) ? rekord.reels : [];
  if (!reels.length) {
    return { statusCode: 400, body: "Die faktuur het nog geen reëls nie." };
  }

  if (!teks(rekord.klient_id)) {
    return { statusCode: 400, body: "Kies eers 'n kliënt." };
  }

  // SONDER 'N E-POS HET DIE PROFORMA NÊRENS OM HEEN TE GAAN NIE. Die selfoon
  // keer NIE: sonder e-pos kan die dokument nie uitgaan nie, sonder selfoon
  // is dit bloot ongerieflik. Twee verskillende gewigte.
  const klient_epos = teks(rekord.klient && rekord.klient.epos);
  if (!klient_epos) {
    return {
      statusCode: GEEN_EPOS,
      body: "Hierdie kliënt het nog geen e-posadres nie, en die proforma het dus nêrens om heen te gaan nie.",
    };
  }

  // verval_op maak die BETAALSKAKEL dood; betaalbaar_teen doen niks daarvan
  // nie. 'n Skakel wat reeds dood is op die dag dat hy uitgaan, is 'n fout in
  // die konsep, nie iets om stilweg deur te laat nie.
  if (rekord.verval_op && new Date(rekord.verval_op) <= new Date()) {
    return {
      statusCode: 400,
      body: "Die vervaldatum lê in die verlede — die betaalskakel sou dadelik dood wees.",
    };
  }

  // ── Wie kan Paystack self betaal? ───────────────────────────────────────
  //
  // Die verdelingsrye verwys na 'n begunstigde by NAAM. Hier word daardie naam
  // een keer opgelos na sy ID en sy subrekening-kode, en die ID is wat op die
  // gevriesde rekord land — 'n latere hernoeming breek dan niks.
  //
  // Die derde geval is die een wat maklik misgekyk word: 'n begunstigde
  // SONDER 'n subrekening. Paystack kan hom nie betaal nie, dus val sy ry na
  // die hoofrekening al is hy 'n begunstigde, en iemand moet hom met die hand
  // oorbetaal.
  let begunstigdes = [];
  try {
    const b_store = kry_store("begunstigdes");
    const lys = await b_store.list();
    begunstigdes = (
      await Promise.all((lys.blobs || []).map((b) => b_store.get(b.key, { type: "json" })))
    ).filter(Boolean);
  } catch (fout) {
    console.error("Kon nie die begunstigdes lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die begunstigdes laai nie" };
  }

  const per_naam = new Map();
  begunstigdes.forEach((b) => {
    if (b && b.naam) per_naam.set(teks(b.naam), b);
  });

  function kode_van(ontvanger) {
    const b = per_naam.get(teks(ontvanger));
    return b ? teks(b.subrekening_kode) : "";
  }
  const het_subrekening = (ontvanger) => Boolean(kode_van(ontvanger));

  // ── Die som ─────────────────────────────────────────────────────────────

  const u = fs_bereken(fs_invoer_uit_faktuur(rekord, het_subrekening));

  if (u.oorbestee) {
    return {
      statusCode: 409,
      body: "Die verdeling vra meer as wat die faktuur inbring. Paystack sou dit weier.",
    };
  }

  const faktuur_sent = Math.round(u.P * 100);
  const skenking_sent = Number(rekord.skenking_sent) || 0;
  const totaal_sent = faktuur_sent + skenking_sent;

  // Die voorsiening op die VOLLE transaksie — Paystack hef op alles, ook op
  // die skenking. Dieselfde getal wat die skerm onderaan wys.
  //
  // DIT IS 'N VOORSIENING, NIE 'N KOSTE NIE. Betaal die kliënt per
  // bankoorbetaling, is die fooi nooit gehef nie en word niks herbereken nie:
  // die ontvangers kry presies wat hier gevries word, en die onbestede
  // voorsiening val na die oorskot en bly in die hoofrekening.
  const voorsiening_sent =
    totaal_sent > 0 ? Math.round((FS_PS_PCT / 100) * totaal_sent + FS_PS_VAS * 100) : 0;

  const hosting_sent = Math.round(u.hosting * 100);

  // Die som gee 'n inskrywing per verdelingsry; 'n mens betaal 'n PERSOON, nie
  // 'n ry nie. Eugene met 'n kostery en 'n persentasie is één oorbetaling en
  // één split-inskrywing.
  const per_ontvanger = new Map();
  (u.ontvangers || []).forEach((o) => {
    const naam = teks(o.naam);
    if (!naam) return;
    const bestaande = per_ontvanger.get(naam) || { naam, bedrag_sent: 0, waarvoor: [] };
    bestaande.bedrag_sent += o.sent;
    if (o.wat) bestaande.waarvoor.push(o.wat);
    per_ontvanger.set(naam, bestaande);
  });

  const gevriesde_rye = [...per_ontvanger.values()].map((r) => {
    const b = per_naam.get(r.naam);
    const kode = b ? teks(b.subrekening_kode) : "";
    return {
      // Die ID verander nie met die naam nie. Die naam gaan saam vir wanneer
      // 'n mens ses maande later na hierdie rekord kyk.
      begunstigde_id: b ? b.begunstigde_id || null : null,
      naam: r.naam,
      subrekening_kode: kode || null,
      bedrag_sent: r.bedrag_sent,
      // 'n GEVOLG van die ontvanger, nie 'n keuse nie.
      pad: kode ? "split" : "hoof",
    };
  });

  const uitbetaal_sent = gevriesde_rye.reduce((s, r) => s + r.bedrag_sent, 0);

  // Die oorskot is wat OORBLY nadat almal afgetrek is — nie 'n ry nie. Skep 'n
  // mens 'n ry daarvoor, word dit uitbetaal EN daar bly niks vir Paystack nie.
  const oorskot_sent = totaal_sent - uitbetaal_sent - hosting_sent - voorsiening_sent;

  const verdeling_gevries = {
    gevries_op: nou,
    totaal_sent,
    faktuur_sent,
    skenking_sent,
    voorsiening_sent,
    hosting_sent,
    uitbetaal_sent,
    oorskot_sent,
    rye: gevriesde_rye,
  };

  // ── Die vangnet ─────────────────────────────────────────────────────────
  //
  // Die som hou reeds die afgedwinge minimum terug, dus behoort dit nooit te
  // vuur nie. Maar Paystack weier 'n transaksie waar die handelaar se aandeel
  // nul of minder is, en dan misluk 'n betaling by die kliënt se skerm.
  // begin-betaling.js verklein die verdeling proporsioneel; hier mag dit NIE
  // gebeur nie — 'n bedrag wat stilweg krimp, is nie 'n rekord nie.
  const split_rye = gevriesde_rye.filter((r) => r.pad === "split" && r.bedrag_sent > 0);
  const split_totaal_sent = split_rye.reduce((s, r) => s + r.bedrag_sent, 0);
  if (split_totaal_sent > kry_maks_verdeling_sent(totaal_sent)) {
    return {
      statusCode: 409,
      body: "Die verdeling laat te min in die hoofrekening om Paystack se fooi te dek.",
    };
  }

  // ── Die nommer ──────────────────────────────────────────────────────────

  let nuwe_sleutel;
  try {
    nuwe_sleutel = await skep_nommer(store);
  } catch (fout) {
    console.error("Kon nie 'n faktuurnommer kry nie:", fout);
    return { statusCode: 500, body: "Kon nie 'n faktuurnommer toeken nie" };
  }
  const nommer = sleutel_na_nommer(nuwe_sleutel);

  // Die kode wat die publieke bladsy toelaat om hierdie faktuur te wys sonder
  // dat 'n mens deur die nommerreeks kan tel. 'n Ou konsep wat reeds een dra,
  // hou hom — die skakel mag nie onder iemand se voete verander nie.
  const publieke_kode = teks(rekord.publieke_kode) || skep_publieke_kode();

  // ── Paystack ────────────────────────────────────────────────────────────
  //
  // Word niks geskryf voordat albei oproepe deur is nie. Misluk een, staan die
  // konsep nog presies waar hy was.

  let split_code = null;
  let authorization_url = null;
  let referensie = null;

  // 'N FAKTUUR VAN R0 ROEP PAYSTACK GLAD NIE.
  //
  // Geen /split, geen /transaction/initialize, en dus nooit 'n transaksie
  // waarop 'n webhook kan vuur nie. Alles wat die webhook sou doen, moet in
  // hierdie tak self gebeur. Die winkel se begin-betaling.js se
  // `totaal_sent === 0`-tak is die patroon.
  const gratis = totaal_sent === 0;

  if (!gratis) {
    // Die verwysing is die faktuurnommer in sy sleutelvorm. Dit hoef nie 'n
    // agtervoegsel per poging te kry soos in die winkel nie: 'n uitgereikte
    // faktuur word nooit weer gestuur nie (409 hierbo), en 'n regstelling gaan
    // deur kanselleer plus 'n NUWE nommer.
    referensie = nuwe_sleutel;

    if (split_rye.length) {
      try {
        const resp = await fetch("https://api.paystack.co/split", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `Faktuur ${nuwe_sleutel}`,
            // VAS, nie persentasie nie — sien die nota bo-aan.
            type: "flat",
            currency: "ZAR",
            subaccounts: split_rye.map((r) => ({
              subaccount: r.subrekening_kode,
              share: r.bedrag_sent,
            })),
            // Future Sharp dra Paystack se fooi. Dit is die hele punt van die
            // aftreksom: die voorsiening is reeds van bo af weggeneem.
            bearer_type: "account",
          }),
        });

        const data = await resp.json();
        if (!resp.ok || !data.status) {
          console.error(`Kon nie 'n split skep nie vir ${nuwe_sleutel}:`, data);
          return {
            statusCode: 502,
            body: `Paystack kon nie die verdeling skep nie: ${
              (data && data.message) || "onbekende fout"
            }.`,
          };
        }
        split_code = data.data.split_code;
      } catch (fout) {
        console.error(`Fout tydens split-skepping vir ${nuwe_sleutel}:`, fout);
        return { statusCode: 502, body: "Kon nie by Paystack uitkom nie." };
      }
    }

    try {
      const liggaam = {
        email: klient_epos,
        amount: totaal_sent,
        reference: referensie,
        // Waar die kliënt land ná betaling — en ná 'n kansellasie. 'n
        // Bedankingsbladsy ná 'n kansellasie is 'n leuen, dus dra die bladsy
        // self albei uitkomste.
        // ALBEI DELE IS NODIG. Die sleutel vind die rekord direk; die kode
        // bewys dat die persoon die skakel werklik ontvang het. Sonder die
        // kode sou 'n mens by FS-01957 kon begin en deur die reeks loop.
        callback_url:
          `${process.env.URL || "http://localhost:8888"}/betaal-klaar.html` +
          `?f=${nuwe_sleutel}&k=${publieke_kode}`,
        metadata: {
          faktuur_sleutel: nuwe_sleutel,
          faktuur_nommer: nommer,
          klient: rekord.klient ? rekord.klient.naam || "" : "",
        },
      };
      if (split_code) liggaam.split_code = split_code;

      const resp = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(liggaam),
      });

      const data = await resp.json();
      if (!resp.ok || !data.status) {
        console.error(`Paystack-inisiëring het misluk vir ${nuwe_sleutel}:`, data);
        return {
          statusCode: 502,
          body: `Paystack kon nie die betaling begin nie: ${
            (data && data.message) || "onbekende fout"
          }.`,
        };
      }
      authorization_url = data.data.authorization_url;
    } catch (fout) {
      console.error(`Fout tydens Paystack-inisiëring vir ${nuwe_sleutel}:`, fout);
      return { statusCode: 502, body: "Kon nie by Paystack uitkom nie." };
    }
  }

  // ── Die rekord ──────────────────────────────────────────────────────────

  rekord.nommer = nommer;
  rekord.publieke_kode = publieke_kode;
  rekord.uitgereik_op = nou;
  rekord.bygewerk_op = nou;
  rekord.totaal_sent = totaal_sent;
  rekord.verdeling_gevries = verdeling_gevries;
  rekord.paystack = {
    referensie,
    split_code,
    authorization_url,
  };

  if (gratis) {
    // Die R0-tak. Daar is niks om te verdeel en niks om te betaal nie, dus is
    // die faktuur klaar toe op die oomblik dat hy uitgereik word.
    rekord.stand = "betaal";
    rekord.betaling = {
      metode: "gratis",
      ontvang_sent: 0,
      ontvang_op: nou,
      verwysing: nommer,
      aangeteken_deur: wie,
      nota: rekord.koepon_kode ? `Koepon ${rekord.koepon_kode}` : "R0 — niks om te verdeel nie",
    };
    voeg_geskiedenis_by(rekord, "uitgereik", wie, `${nommer} — R0`);
    voeg_geskiedenis_by(rekord, "betaal", wie, "R0: Paystack is nie geroep nie");
  } else {
    rekord.stand = "gestuur";
    voeg_geskiedenis_by(
      rekord,
      "uitgereik",
      wie,
      `${nommer} — R${(totaal_sent / 100).toFixed(2)}`
    );
  }

  // Skryf EERS die nuwe sleutel. Misluk die verwydering hierna, lê daar 'n
  // verweesde konsep — hinderlik, maar niks is verlore nie. Andersom sou die
  // faktuur weg wees.
  try {
    await store.setJSON(nuwe_sleutel, rekord);
  } catch (fout) {
    console.error(`Kon nie faktuur ${nuwe_sleutel} stoor nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur stoor nie" };
  }

  try {
    await store.delete(sleutel);
  } catch (fout) {
    console.error(
      `Faktuur ${nuwe_sleutel} is uitgereik, maar die konsep-sleutel ${sleutel} kon nie verwyder word nie:`,
      fout
    );
  }

  // DIE PROFORMA-E-POS KOM HIER, IN DIE VOLGENDE STAP. Hy word apart gebou,
  // want hy vra 'n eie besluit: die faktuurmodule stuur uit
  // admin@futuresharp.co.za, terwyl _stuur-epos.js tans uit die winkel se
  // posbus stuur. Wanneer hy kom, staan hy in sy eie try/catch — die faktuur
  // is klaar gestoor en 'n pos wat misluk mag dit nie ongedaan maak nie.

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sleutel: nuwe_sleutel,
      nommer,
      stand: rekord.stand,
      totaal_sent,
      betaalskakel: authorization_url,
      gratis,
      verdeling_gevries,
    }),
  };
};
