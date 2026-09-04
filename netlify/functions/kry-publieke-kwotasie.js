// netlify/functions/kry-publieke-kwotasie.js
//
// Wat die kliënt van 'n kwotasie mag sien. PUBLIEK — geen rol, geen
// aanmelding.
//
// DIE BEWYS IS DIE SLEUTEL PLUS DIE PUBLIEKE KODE, presies soos
// kry-betaalstand.js. Die kwotasienommer is deurlopend en dus tel-baar; die
// kode is dit nie. Sonder die kode is die antwoord 404.
//
// EEN BOODSKAP VIR ELKE SOORT MISLUKKING. Sê 'n mens "kwotasie nie gevind
// nie" teenoor "verkeerde kode", verklap die verskil watter nommers bestaan.
//
// WAAROM 'N EIE FUNCTION EN NIE kry-kwotasie.js NIE: daardie een vereis die
// boekhouding-rol en gee ALLES terug -- die verdeling, die begroting, die
// geskiedenis, die publieke kode self. Dit is wat 'n direkteur moet sien.
//
// WAT HIER UITGAAN, is die DOKUMENT en niks anders nie:
//
//   die nommer, die datum, die geldigheid, die hersiening
//   die klient se naam en adres
//   die reels SOOS HULLE DRUK -- gegroepeer, sien hieronder
//   die totaal en die afslag
//   die aantekening
//
// WAT NOOIT UITGAAN NIE: die verdeling, die begroting, die transaksiefooi, wie
// wat kry, die geskiedenis, en die publieke kode self. Dit is Future Sharp se
// binnewerk en dit gaan 'n skool nie aan nie.

const {
  kry_kwotasies_store,
  sleutel_na_nommer,
  vertoon_stand,
  kan_aanvaar,
} = require("./_kwotasies");
const { kry_maatskappy } = require("./_instellings");

function teks(waarde) {
  return String(waarde == null ? "" : waarde).trim();
}

/* DIE REELS SOOS HULLE DRUK.

   'n Reel met `vou_in` se bedrag tel by die reel BO HAAR -- die volgorde is
   die groepering. Sien Reels-Invou-En-Volgorde-Ontwerp.md.

   DIESELFDE SOM AS groepeer_vir_druk() IN faktuur-vorm.js EN AS
   _faktuur-pdf.js. Al drie moet dieselfde bly: wat 'n mens voor uitreiking
   sien, wat die PDF dra, en wat die klient op hierdie bladsy lees, is een
   ding.

   DIE KLIENT KRY NIE DIE ONGEGROEPEERDE REELS NIE. Sou hulle deurgaan, sou 'n
   skool sien dat "Skoolprojek R23 000" eintlik 'n aanbieding en 'n verslag is,
   met hul afsonderlike pryse -- en dit is presies wat die invou moet keer. */
function groepeer(reels) {
  const uit = [];
  (Array.isArray(reels) ? reels : []).forEach((r) => {
    const hoeveelheid = Number(r.hoeveelheid) || 0;
    const prys_pp_sent = Number(r.prys_pp_sent) || 0;
    const bedrag_sent = Math.round(hoeveelheid * prys_pp_sent);

    // Die EERSTE reel vou nooit in nie -- daar is niks bo haar nie.
    if (r.vou_in !== true || !uit.length) {
      uit.push({
        beskrywing: teks(r.beskrywing),
        hoeveelheid,
        prys_pp_sent,
        bedrag_sent,
        // 'n Groep dra GEEN hoeveelheid en GEEN eenheidsprys nie: drie items
        // met verskillende eenhede het nie een eenheidsprys nie.
        is_groep: false,
      });
    } else {
      const g = uit[uit.length - 1];
      g.bedrag_sent += bedrag_sent;
      g.is_groep = true;
    }
  });
  return uit;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const vraag = event.queryStringParameters || {};
  const sleutel = teks(vraag.k);
  const kode = teks(vraag.kode);

  const NIE_GEVIND = { statusCode: 404, body: "Nie gevind nie" };

  if (!sleutel || !kode) return NIE_GEVIND;
  // Slegs 'n genommerde kwotasie. 'n Konsep het geen publieke kode en dus geen
  // skakel wat 'n kliënt kon ontvang het nie.
  if (!sleutel_na_nommer(sleutel)) return NIE_GEVIND;

  let rekord;
  try {
    rekord = await kry_kwotasies_store().get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie laai nie" };
  }
  if (!rekord) return NIE_GEVIND;
  if (!rekord.publieke_kode || rekord.publieke_kode !== kode) return NIE_GEVIND;

  // Die maatskappy se kop. Sy leef as 'n INSTELLING en nie in die sjabloon
  // nie — 'n adreswysiging op een plek geld oral.
  let maatskappy = null;
  try {
    maatskappy = await kry_maatskappy();
  } catch (fout) {
    console.error("Kon nie die instelling lees nie:", fout);
  }

  const nou = new Date().toISOString();
  const klient = rekord.klient || {};

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // 'n Kwotasie verander wanneer sy hersien word. 'n Gekaste antwoord sou
      // die ou prys wys aan iemand wat pas 'n nuwe een ontvang het.
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({
      nommer: rekord.nommer || sleutel_na_nommer(sleutel),
      hersiening: Number(rekord.hersiening) || 1,

      // DIE STAND WAT DIE SKERM WYS, nie die een op die rekord nie. "verval"
      // bestaan nie op die rekord nie -- hy word hier bereken uit geldig_tot.
      stand: vertoon_stand(rekord, nou),
      kan_aanvaar: kan_aanvaar(rekord, nou),

      uitgereik_op: rekord.uitgereik_op || null,
      dokument_datum: rekord.dokument_datum || null,
      geldig_tot: rekord.geldig_tot || null,

      // Die DOKUMENT se taal, nie die blaaier s'n nie. Die kwotasie wat die
      // kliënt ontvang het, was in daardie taal; hierdie bladsy is dieselfde
      // gesprek.
      taal: rekord.taal === "en" ? "en" : "af",

      klient: {
        naam: klient.naam || "",
        kontakpersoon: klient.kontakpersoon || "",
        adres: klient.adres || "",
      },
      bestelnommer: rekord.bestelnommer || "",

      reels: groepeer(rekord.reels),
      afslag_sent: Number(rekord.afslag_sent) || 0,
      totaal_sent: Number(rekord.totaal_sent) || 0,
      dokument_nota: rekord.dokument_nota || "",

      // Is sy reeds aanvaar, wys die bladsy dit en noem die faktuur. Die
      // kliënt het dalk twee keer geklik of die skakel aangestuur.
      faktuur_nommer: rekord.faktuur_nommer || null,

      maatskappy: {
        naam: (maatskappy && maatskappy.naam) || "Future Sharp NPC",
        registrasienommer: (maatskappy && maatskappy.registrasienommer) || "",
        adres: (maatskappy && maatskappy.adres) || "",
        epos: (maatskappy && maatskappy.epos) || "admin@futuresharp.co.za",
      },
    }),
  };
};
