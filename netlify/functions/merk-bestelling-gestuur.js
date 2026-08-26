// netlify/functions/merk-bestelling-gestuur.js
//
// Die outeur merk 'n harde-kopie-bestelling as gestuur, met 'n datum en 'n
// opsionele spoornommer. Hy kan dit ook wysig of terugtrek.
//
// WAAROM 'N EIE VELD EN NIE `drukker` NIE: drukker.bestelling_geplaas
// beteken "die bestelling is by die drukverskaffer geplaas" — personeel se
// veld in die druk-op-aanvraag-vloei. Dit wat die outeur hier doen, is iets
// anders: hy het die pakkie gepos. Twee betekenisse in een veld sou
// beteken dat 'n mens later nie kan sê wat werklik gebeur het nie.
//
// TWEE WYSES OM TE STUUR. 'n Outeur pos self, of 'n drukker/verspreider
// stuur namens hom. In albei gevalle is DIT DIE OUTEUR wat hier aanmeld —
// hy kry die kennisgewing van die verskaffer met 'n verwysingsnommer, en
// skryf dit hier oor. Sonder die verskaffer se naam en verwysing is 'n
// latere navraag 'n doodloopstraat: 'n mens weet die datum, maar nie by
// wie om te vra nie.
//
// GESKIEDENIS BLY BEHOUE. Elke wysiging en terugtrekking word bygevoeg by
// versending.geskiedenis. Kom daar 'n navraag, moet 'n mens kan sien wat
// wanneer gesê is — nie net die jongste weergawe nie.
//
// WIE MAG: die aangemelde gebruiker moet 'n outeur wees van 'n boek waarvan
// 'n harde kopie IN HIERDIE BESTELLING is. Andersins 403. Dit keer dat 'n
// outeur iemand anders se bestelling merk.
//
// DIE KOPER WORD IN KENNIS GESTEL. Hierdie funksie het van die begin af die
// datum, die wyse, die verskaffer en die spoornommer gestoor -- en toe gestop.
// Die koper het betaal vir 'n boek wat per pos kom en niks meer gehoor nie,
// terwyl die spoornommer in die rekord gele het. Sien
// _kennisgewing-versending.js. Die pos gaan uit NA die skryf, slegs by 'n NUWE
// merk, en 'n mislukking maak die merk nooit ongedaan nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { outeur_by_produk_betrokke } = require("./_outeur-aandeel");
const { stuur_versending_kennisgewing } = require("./_kennisgewing-versending");

function normaliseer_epos(epos) {
  return String(epos || "").trim().toLowerCase();
}

async function kry_my_outeur(gebruiker) {
  const store = kry_store("outeurs");
  const { blobs } = await store.list();
  const inskrywings = (
    await Promise.all(
      (blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null))
    )
  ).filter(Boolean);

  const gekoppel = inskrywings.find((i) => i.identity_id && i.identity_id === gebruiker.id);
  if (gekoppel) return gekoppel;

  const my_epos = normaliseer_epos(gebruiker.email);
  if (!my_epos) return null;

  const passend = inskrywings.filter((i) => {
    if (i.identity_id && i.identity_id !== gebruiker.id) return false;
    return normaliseer_epos(i.kontak_inligting && i.kontak_inligting.epos) === my_epos;
  });
  return passend.length === 1 ? passend[0] : null;
}

// 'n Datum, nie 'n tydstip nie. Die outeur weet op watter DAG hy gepos het.
// Ons aanvaar JJJJ-MM-DD, wat presies is wat <input type="date"> gee.
function geldige_datum(waarde) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(waarde || ""))) return null;

  const datum = new Date(`${waarde}T00:00:00Z`);
  if (Number.isNaN(datum.getTime())) return null;

  // 'n Datum in die toekoms is 'n tikfout. Een dag speling vir tydsones.
  const more = new Date();
  more.setUTCDate(more.getUTCDate() + 1);
  if (datum > more) return null;

  return waarde;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const bestelnommer = String(invoer.bestelnommer || "").trim();
  if (!bestelnommer) {
    return { statusCode: 400, body: "Verpligte veld: bestelnommer" };
  }

  const gestuur = invoer.gestuur !== false;

  // "self" of "verskaffer". Enigiets anders word "self", want dit is die
  // eenvoudiger geval en die velde wat daarby hoort, is opsioneel.
  const wyse = invoer.wyse === "verskaffer" ? "verskaffer" : "self";

  let gestuur_op = null;
  if (gestuur) {
    gestuur_op = geldige_datum(invoer.gestuur_op);
    if (!gestuur_op) {
      return { statusCode: 400, body: "Ongeldige datum — verwag JJJJ-MM-DD, nie in die toekoms nie" };
    }
  }

  const outeur = await kry_my_outeur(gebruiker);
  if (!outeur) {
    return { statusCode: 403, body: "Geen outeur-inskrywing vir hierdie rekening nie" };
  }

  const store = kry_store("bestellings");
  const bestelling = await store.get(bestelnommer, { type: "json" });
  if (!bestelling) {
    return { statusCode: 404, body: "Geen bestelling met daardie nommer nie" };
  }
  if (!bestelling.bevat_harde_kopie) {
    return { statusCode: 400, body: "Hierdie bestelling bevat geen harde kopie nie" };
  }

  // --- Mag hierdie outeur aan hierdie bestelling raak? ---
  const katalogus = kry_store("katalogus");
  const harde_slugs = (bestelling.items || [])
    .filter((item) => item.formaat === "harde_kopie")
    .map((item) => item.produk_slug);

  const produkte = (
    await Promise.all(
      harde_slugs.map((slug) => katalogus.get(slug, { type: "json" }).catch(() => null))
    )
  ).filter(Boolean);

  const myne = produkte.some((produk) => outeur_by_produk_betrokke(produk, outeur.outeur_id));
  if (!myne) {
    return { statusCode: 403, body: "Hierdie bestelling bevat geen boek van jou nie" };
  }

  // --- Skryf ---
  const nou = new Date().toISOString();
  const spoornommer = String(invoer.spoornommer || "").trim().slice(0, 100);

  // Slegs betekenisvol wanneer 'n verskaffer gestuur het. Word die wyse
  // later terug na "self" verander, val hulle weg eerder as om as spoke
  // agter te bly.
  const verskaffer =
    wyse === "verskaffer" ? String(invoer.verskaffer || "").trim().slice(0, 120) : "";
  const verskaffer_verwysing =
    wyse === "verskaffer" ? String(invoer.verskaffer_verwysing || "").trim().slice(0, 100) : "";

  const vorige = bestelling.versending || {};

  const inskrywing = {
    op: nou,
    deur: outeur.outeur_id,
    gestuur,
    gestuur_op,
    wyse: gestuur ? wyse : null,
    verskaffer: gestuur ? verskaffer : "",
    verskaffer_verwysing: gestuur ? verskaffer_verwysing : "",
    spoornommer: gestuur ? spoornommer : "",
  };

  const bygewerk = {
    ...bestelling,
    versending: {
      gestuur,
      gestuur_op,
      wyse: gestuur ? wyse : null,
      verskaffer: gestuur ? verskaffer : "",
      verskaffer_verwysing: gestuur ? verskaffer_verwysing : "",
      spoornommer: gestuur ? spoornommer : "",
      laas_gewysig_op: nou,
      laas_gewysig_deur: outeur.outeur_id,
      geskiedenis: [...(vorige.geskiedenis || []), inskrywing],
    },
    bygewerk_op: nou,
  };

  await store.setJSON(bestelnommer, bygewerk);

  // --- Laat die koper weet ---
  //
  // NA DIE SKRYF, EN NOOIT VOOR NIE. Die versending is nou 'n feit in die
  // rekord; 'n pos wat misluk, mag dit nie ongedaan maak nie. Daarom die
  // try/catch en geen invloed op die antwoord.
  //
  // SLEGS BY 'N NUWE MERK. Trek die outeur die versending terug (gestuur ===
  // false), is daar niks om aan te kondig nie. En het hy bloot 'n spoornommer
  // reggemaak wat reeds gestuur was, sou 'n tweede pos die koper laat dink 'n
  // tweede pakkie is op pad. `vorige.gestuur` is die toets: was dit reeds
  // gestuur, is hierdie 'n wysiging en nie 'n aankondiging nie.
  const is_nuwe_versending = gestuur === true && vorige.gestuur !== true;

  if (is_nuwe_versending) {
    try {
      await stuur_versending_kennisgewing(bygewerk);
    } catch (fout) {
      console.error(
        `Kon nie die versending-kennisgewing stuur nie vir ${bestelnommer}:`,
        fout
      );
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bestelnommer,
      gestuur,
      gestuur_op,
      wyse: bygewerk.versending.wyse,
      verskaffer: bygewerk.versending.verskaffer,
      verskaffer_verwysing: bygewerk.versending.verskaffer_verwysing,
      spoornommer: bygewerk.versending.spoornommer,
    }),
  };
};
