// netlify/functions/kry-my-bestellings.js
//
// Die harde kopieë wat hierdie outeur moet druk en stuur, en dié wat hy
// reeds gestuur het.
//
// WAT DIE OUTEUR SIEN: bestelnommer, datum, sy eie titel(s) met hoeveelheid,
// en die afleweradres — ontvanger, straat, stad, provinsie, poskode en
// selfoon. Dit is alles wat 'n mens nodig het om 'n pakkie te pos.
//
// WAT HY NIE SIEN NIE: die koper se e-posadres, wat betaal is, ander items
// in dieselfde bestelling (die koper kan 'n ander outeur se boek saam
// gekoop het), en enigiets oor die verdeling. 'n Bestelling word gefiltreer
// tot slegs sy eie harde-kopie-items voordat dit teruggaan.
//
// DIE FILTER IS DIE SEKURITEIT. Rol "koper" laat enige aangemelde gebruiker
// in; wat hom by iemand anders se bestellings weghou, is dat ons slegs
// items behou waarvan hy die outeur is.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { outeur_by_produk_betrokke } = require("./_outeur-aandeel");

function normaliseer_epos(epos) {
  return String(epos || "").trim().toLowerCase();
}

async function kry_my_outeur_id(gebruiker) {
  const store = kry_store("outeurs");
  const { blobs } = await store.list();
  const inskrywings = (
    await Promise.all(
      (blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null))
    )
  ).filter(Boolean);

  const gekoppel = inskrywings.find((i) => i.identity_id && i.identity_id === gebruiker.id);
  if (gekoppel) return gekoppel.outeur_id;

  const my_epos = normaliseer_epos(gebruiker.email);
  if (!my_epos) return null;

  const passend = inskrywings.filter((i) => {
    if (i.identity_id && i.identity_id !== gebruiker.id) return false;
    return normaliseer_epos(i.kontak_inligting && i.kontak_inligting.epos) === my_epos;
  });
  return passend.length === 1 ? passend[0].outeur_id : null;
}

// Slegs die velde wat nodig is om te pos. Alles anders bly weg — 'n nuwe
// veld op `aflewering` lek dus nie vanself deur nie.
function aflewering_vir_outeur(bestelling) {
  const aflewering = bestelling.aflewering || {};
  const koper = bestelling.koper || {};

  return {
    ontvanger: aflewering.ontvanger || "",
    straat: aflewering.straat || "",
    stad: aflewering.stad || "",
    provinsie: aflewering.provinsie || "",
    poskode: aflewering.poskode || "",
    selfoon: koper.selfoonnommer || "",
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

  // --- Watter produkte behoort aan hierdie outeur? ---
  const katalogus = kry_store("katalogus");
  const { blobs: produk_blobs } = await katalogus.list();
  const produkte = (
    await Promise.all(
      (produk_blobs || []).map((b) => katalogus.get(b.key, { type: "json" }).catch(() => null))
    )
  ).filter(Boolean);

  const my_slugs = new Map();
  produkte.forEach((produk) => {
    if (produk.slug && outeur_by_produk_betrokke(produk, outeur_id)) {
      my_slugs.set(produk.slug, produk.titel || produk.slug);
    }
  });

  if (!my_slugs.size) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ om_te_stuur: [], gestuur: [] }),
    };
  }

  // --- Bestellings ---
  const store = kry_store("bestellings");
  const { blobs } = await store.list();
  const bestellings = (
    await Promise.all(
      (blobs || []).map((b) => store.get(b.key, { type: "json" }).catch(() => null))
    )
  ).filter((b) => b && b.paystack && b.paystack.geverifieer && b.bevat_harde_kopie);

  const om_te_stuur = [];
  const gestuur = [];

  for (const bestelling of bestellings) {
    // Slegs harde kopieë van SY boeke. 'n E-boek in dieselfde bestelling
    // is nie sy saak nie — daar is niks om te pos nie.
    const my_items = (bestelling.items || []).filter(
      (item) => item.formaat === "harde_kopie" && my_slugs.has(item.produk_slug)
    );
    if (!my_items.length) continue;

    const versending = bestelling.versending || null;

    const inskrywing = {
      bestelnommer: bestelling.bestelnommer,
      geplaas_op: bestelling.geskep_op || bestelling.bygewerk_op || null,
      items: my_items.map((item) => ({
        titel: my_slugs.get(item.produk_slug),
        hoeveelheid: item.hoeveelheid || 1,
      })),
      aflewering: aflewering_vir_outeur(bestelling),
      gestuur: Boolean(versending && versending.gestuur),
      gestuur_op: (versending && versending.gestuur_op) || null,
      wyse: (versending && versending.wyse) || "self",
      verskaffer: (versending && versending.verskaffer) || "",
      verskaffer_verwysing: (versending && versending.verskaffer_verwysing) || "",
      spoornommer: (versending && versending.spoornommer) || "",
    };

    (inskrywing.gestuur ? gestuur : om_te_stuur).push(inskrywing);
  }

  // Oudste eerste by wat nog gestuur moet word — die een wat die langste
  // wag, is die dringendste. Nuutste eerste by wat klaar is.
  om_te_stuur.sort((a, b) => String(a.geplaas_op || "").localeCompare(String(b.geplaas_op || "")));
  gestuur.sort((a, b) => String(b.gestuur_op || "").localeCompare(String(a.gestuur_op || "")));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ om_te_stuur, gestuur }),
  };
};
