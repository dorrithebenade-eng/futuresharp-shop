// netlify/functions/kry-my-staat.js
//
// Die outeur se staat: elke titel se besigtigings, verkope en sy eie deel,
// OPGEDEEL PER MAAND.
//
// WAAROM PER MAAND EN NIE 'N REEDS-OPGETELDE VENSTER NIE:
// Die skerm laat 'n mens die tydperk verstel — hierdie maand, laaste drie,
// laaste twaalf, alles. Sou die Function die optel doen, was elke druk op
// 'n knoppie 'n nuwe bedieneroproep wat elke bestelling weer deurloop.
// Die maandelikse syfers is klein (een inskrywing per titel per maand) en
// die skerm tel hulle onmiddellik op. Een oproep, en die venster is gratis.
//
// WAT 'N OUTEUR SIEN EN WAT NIE:
//   sien     — sy eie titels, besigtigings per maand, verkope per maand,
//              en SY deel per maand.
//   sien nie — enige ander outeur se deel, die 30% se uitsplitsing,
//              koperdata, bestelnommers, of enige subrekening-kode.
//
// By 'n boek met mede-outeurs tel slegs hierdie outeur se aandeel, presies
// soos in kry-my-titels.js. outeur_aandeel_sent() filtreer op entiteit_id.
//
// DIE DEEL WORD HERBEREKEN, NIE GESTOOR NIE — dieselfde reël as
// kry-my-titels.js en _kennisgewing-outeur.js. Word 'n verdeling later
// gewysig, skuif die historiese syfers saam. Drie verskillende antwoorde op
// dieselfde vraag sou erger wees as een antwoord wat kan skuif.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_outeur } = require("./_my-outeur");
const {
  outeur_aandeel_sent,
  outeur_by_produk_betrokke,
} = require("./_outeur-aandeel");

const FORMATE = ["eboek", "harde_kopie", "leen"];

// Besigtigings word sedert hierdie maand PER MAAND gehou
// (tel-produk-besigtiging.js se `besigtigings_maand`). Alles voor hierdie
// punt bestaan nie en kan nie agterna afgelei word nie — die lopende
// `besigtigings`-teller weet nie WANNEER hy getel het nie.
//
// Die skerm gebruik hierdie waarde om sy nota te wys wanneer die venster
// verder terug begin. Dit staan hier en nie in die blaaier nie, sodat daar
// een bron is wanneer dit ooit verander.
const BESIGTIGINGS_VANAF = "2026-08";

// "2026-08" uit 'n ISO-datum. Die maand is in UTC, dieselfde konvensie as
// tel-produk-besigtiging.js en as elke ander datum in die stelsel — 'n
// bestelling en 'n besigtiging op dieselfde oomblik moet in dieselfde maand
// val, ongeag wie die som doen.
function maand_van(waarde) {
  const teks = String(waarde || "");
  if (/^\d{4}-\d{2}/.test(teks)) return teks.slice(0, 7);

  const datum = new Date(teks);
  if (isNaN(datum.getTime())) return null;
  return datum.toISOString().slice(0, 7);
}

// 'n Leë maandvakkie, sodat elke plek wat een aanraak dieselfde vorm kry.
function leë_maand() {
  return { besigtigings: 0, verkope: 0, deel_sent: 0 };
}

function bou_titel(produk) {
  const formate = produk.formate || {};

  return {
    slug: produk.slug,
    titel: produk.titel,
    // Slegs die formate wat werklik beskikbaar is. Die skerm wys dit as
    // fynskrif onder die titel.
    formate: FORMATE.filter((naam) => formate[naam] && formate[naam].beskikbaar),
    maande: {},
  };
}

// Werk 'n titel se maandvakkie by. Die vakkie word geskep wanneer dit die
// eerste keer nodig is — 'n titel dra dus net die maande waarin iets
// gebeur het, nie 'n ry nulle van sy eerste dag af nie.
function tel_by(uitset, maand, veld, hoeveel) {
  if (!maand || !hoeveel) return;
  if (!uitset.maande[maand]) uitset.maande[maand] = leë_maand();
  uitset.maande[maand][veld] += hoeveel;
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  let my_outeur;
  try {
    my_outeur = await kry_my_outeur(gebruiker);
  } catch (fout) {
    console.error("Kon nie die outeurs-register lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die register lees nie" };
  }

  if (!my_outeur || !my_outeur.outeur_id) {
    return { statusCode: 404, body: "Geen outeur-inskrywing vir hierdie rekening nie" };
  }

  const outeur_id = my_outeur.outeur_id;

  // --- Die outeur se titels uit die katalogus ---
  let alle_produkte = [];
  try {
    const katalogus = kry_store("katalogus");
    const { blobs } = await katalogus.list();
    alle_produkte = await Promise.all(
      (blobs || []).map((b) => katalogus.get(b.key, { type: "json" }).catch(() => null))
    );
  } catch (fout) {
    console.error("Kon nie die katalogus lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die katalogus lees nie" };
  }

  const myne = new Map();
  for (const produk of alle_produkte) {
    if (!produk || !produk.slug) continue;
    if (!outeur_by_produk_betrokke(produk, outeur_id)) continue;
    myne.set(produk.slug, { produk, uitset: bou_titel(produk) });
  }

  // --- Besigtigings per maand, direk van die produk se eie rekord ---
  for (const { produk, uitset } of myne.values()) {
    const per_maand = produk.besigtigings_maand || {};
    for (const [maand, hoeveel] of Object.entries(per_maand)) {
      tel_by(uitset, maand, "besigtigings", Number(hoeveel) || 0);
    }
  }

  // --- Verkope en die outeur se deel, uit die bestellings ---
  //
  // Slegs geverifieerde bestellings. 'n Onbetaalde bestelling is nie
  // inkomste nie, en dit moet nie in 'n staat opdaag wat 'n mens teen sy
  // bankstaat hou nie.
  let bestellings = [];
  try {
    const store = kry_store("bestellings");
    const lys = await store.list();
    bestellings = (
      await Promise.all(
        (lys.blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null))
      )
    ).filter((b) => b && b.paystack && b.paystack.geverifieer);
  } catch (fout) {
    // Sonder bestellings wys ons steeds die besigtigings. 'n Halwe staat
    // met 'n nul in die verkoopkolom is duideliker as 'n leë skerm.
    console.error("Kon nie bestellings lees nie:", fout);
  }

  for (const bestelling of bestellings) {
    const maand = maand_van(bestelling.geskep_op || bestelling.bygewerk_op);
    if (!maand) continue;

    for (const item of bestelling.items || []) {
      const inskrywing = myne.get(item.produk_slug);
      if (!inskrywing) continue;

      const formaat_data =
        (inskrywing.produk.formate && inskrywing.produk.formate[item.formaat]) || null;

      const aandeel = outeur_aandeel_sent(
        formaat_data && formaat_data.verdelings,
        outeur_id,
        item.prys_sent || 0
      );

      tel_by(inskrywing.uitset, maand, "verkope", 1);
      tel_by(inskrywing.uitset, maand, "deel_sent", aandeel);
    }
  }

  // 'n Titel sonder ENIGE beweging, ooit, hoort nie in die staat nie — hy
  // sou in elke venster as 'n ry nulle staan. Die skerm sny verder weg wat
  // buite die gekose venster val.
  const titels = [...myne.values()]
    .map((i) => i.uitset)
    .filter((t) => Object.keys(t.maande).length > 0);

  titels.sort((a, b) => String(a.titel || "").localeCompare(String(b.titel || ""), "af"));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outeur_naam: my_outeur.naam || "",
      besigtigings_vanaf: BESIGTIGINGS_VANAF,
      titels,
    }),
  };
};
