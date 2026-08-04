// netlify/functions/kry-my-titels.js
//
// Die outeur se eie titels, met sy verkope en sy deel, plus die vier
// syfers vir die oorsig.
//
// NAAM: "titels", nie "boeke" nie — kry-my-boeke.js bestaan reeds en gee 'n
// KOPER sy aankope. Die twee moenie verwar word nie.
//
// WAT 'N OUTEUR SIEN EN WAT NIE:
//   sien     — sy eie titels, besigtigings, verkope per formaat, sy deel,
//              en die aantal harde kopieë wat hy nog moet stuur.
//   sien nie — enige ander outeur se deel, die 30% se uitsplitsing,
//              koperdata, of enige subrekening-kode.
//
// By 'n boek met mede-outeurs word SLEGS hierdie outeur se aandeel getel.
// outeur_aandeel_sent() filtreer op entiteit_id, so 'n mede-outeur se deel
// kom nooit in hierdie som nie.
//
// DIE DEEL WORD HERBEREKEN, NIE GESTOOR NIE. Elke bestelling se items word
// teen die HUIDIGE katalogus se verdelings gemeet. Word 'n verdeling later
// gewysig, skuif die historiese syfers saam. _kennisgewing-outeur.js doen
// dit presies so; twee verskillende antwoorde op dieselfde vraag sou erger
// wees as een antwoord wat kan skuif.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  outeur_aandeel_sent,
  outeur_by_produk_betrokke,
} = require("./_outeur-aandeel");

const FORMATE = ["eboek", "harde_kopie", "leen"];

function normaliseer_epos(epos) {
  return String(epos || "").trim().toLowerCase();
}

// Dieselfde koppeling as kry-my-outeur.js, maar sonder om te skryf — die
// skryf hoort op één plek. Kom 'n outeur hier sonder om ooit sy oorsig
// gelaai te hê, val ons terug op die e-pos.
async function kry_my_outeur_id(gebruiker) {
  const store = kry_store("outeurs");
  const { blobs } = await store.list();
  const inskrywings = await Promise.all(
    (blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null))
  );
  const geldig = inskrywings.filter(Boolean);

  const gekoppel = geldig.find((i) => i.identity_id && i.identity_id === gebruiker.id);
  if (gekoppel) return gekoppel.outeur_id;

  const my_epos = normaliseer_epos(gebruiker.email);
  if (!my_epos) return null;

  const passend = geldig.filter((i) => {
    if (i.identity_id && i.identity_id !== gebruiker.id) return false;
    return normaliseer_epos(i.kontak_inligting && i.kontak_inligting.epos) === my_epos;
  });

  // Meer as een is dubbelsinnig — kry-my-outeur.js hanteer daardie geval
  // met 'n eie boodskap; hier gee ons eenvoudig niks terug nie.
  return passend.length === 1 ? passend[0].outeur_id : null;
}

// 'n Titel is te koop as die produk aktief is EN minstens een formaat
// beskikbaar is. "aktief" alleen is nie genoeg nie: 'n boek waarvan elke
// formaat afgeskakel is, staan nêrens in die winkel nie.
function bepaal_status(produk) {
  if (!produk.aktief) return "nie_aktief";
  const formate = produk.formate || {};
  const enige = FORMATE.some((naam) => formate[naam] && formate[naam].beskikbaar);
  return enige ? "te_koop" : "nie_aktief";
}

function bou_titel(produk, outeur_id) {
  const formate = produk.formate || {};
  const beskikbaar = FORMATE.filter((naam) => formate[naam] && formate[naam].beskikbaar);

  return {
    slug: produk.slug,
    titel: produk.titel,
    status: bepaal_status(produk),
    formate: beskikbaar,
    besigtigings: produk.besigtigings || 0,
    verkope: {
      eboek: produk.aankope_eboek || 0,
      harde_kopie: produk.aankope_harde_kopie || 0,
      leen: produk.aankope_leen || 0,
    },
    // Word hieronder ingevul sodra die bestellings deurloop is.
    my_deel_sent: 0,
    my_verkope: 0,
  };
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  let outeur_id;
  try {
    outeur_id = await kry_my_outeur_id(gebruiker);
  } catch (fout) {
    console.error("Kon nie die outeurs-register lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die register lees nie" };
  }

  if (!outeur_id) {
    return { statusCode: 404, body: "Geen outeur-inskrywing vir hierdie rekening nie" };
  }

  // --- Die outeur se titels uit die katalogus ---
  const katalogus = kry_store("katalogus");
  const { blobs } = await katalogus.list();
  const alle_produkte = await Promise.all(
    (blobs || []).map((b) => katalogus.get(b.key, { type: "json" }).catch(() => null))
  );

  const myne = new Map();
  for (const produk of alle_produkte) {
    if (!produk || !produk.slug) continue;
    if (!outeur_by_produk_betrokke(produk, outeur_id)) continue;
    myne.set(produk.slug, { produk, uitset: bou_titel(produk, outeur_id) });
  }

  // --- Bestellings deurloop vir die geld en die uitstaande versendings ---
  //
  // Slegs geverifieerde bestellings tel. 'n Onbetaalde bestelling is nie
  // inkomste nie, en dit moet ook nie 'n harde kopie laat opdaag wat die
  // outeur moet stuur nie.
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
    // Sonder bestellings wys ons steeds die titels, met nulle. Beter as
    // 'n leë bladsy.
    console.error("Kon nie bestellings lees nie:", fout);
  }

  let bestellings_uitstaande = 0;

  for (const bestelling of bestellings) {
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

      inskrywing.uitset.my_deel_sent += aandeel;
      inskrywing.uitset.my_verkope += 1;

      // 'n Harde kopie is uitstaande tot die OUTEUR dit as gestuur gemerk
      // het. Nie drukker.bestelling_geplaas nie — daardie veld beteken die
      // bestelling is by die drukverskaffer geplaas, wat personeel se
      // vloei is en nie sê of die pakkie die pos in is nie.
      if (
        item.formaat === "harde_kopie" &&
        !(bestelling.versending && bestelling.versending.gestuur)
      ) {
        bestellings_uitstaande += 1;
      }
    }
  }

  const titels = [...myne.values()].map((i) => i.uitset);

  // Nuutste eerste, sodat 'n pas-ingediende titel bo staan.
  titels.sort((a, b) => String(b.slug).localeCompare(String(a.slug)));

  const deel_totaal_sent = titels.reduce((som, t) => som + t.my_deel_sent, 0);
  const verkope_totaal = titels.reduce((som, t) => som + t.my_verkope, 0);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      titels,
      opsomming: {
        titels_te_koop: titels.filter((t) => t.status === "te_koop").length,
        verkope_totaal,
        deel_totaal_sent,
        bestellings_uitstaande,
      },
    }),
  };
};
