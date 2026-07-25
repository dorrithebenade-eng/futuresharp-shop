// Koper-beskermd — stoor die koper se huidige leesposisie (bladsynommer)
// vir 'n spesifieke e-boek. Word deur leser.js aangeroep elke keer as
// die koper 'n bladsy blaai. Bevestig eers werklik dat hulle hierdie
// boek gekoop het, presies soos kry-eboek-inhoud.js — 'n mens moet nie
// vordering vir 'n boek kan stoor wat jy nie besit nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

async function besit_boek(gebruiker_id, produk_slug) {
  const bestellings_store = kry_store("bestellings");
  const { blobs } = await bestellings_store.list();

  for (const item of blobs) {
    const ruwe = await bestellings_store.get(item.key);
    if (!ruwe) continue;

    let bestelling;
    try {
      bestelling = JSON.parse(ruwe);
    } catch {
      continue;
    }

    const behoort_aan_koper =
      bestelling.koper && bestelling.koper.netlify_identity_id === gebruiker_id;
    const is_betaal = bestelling.status === "Nuut";
    if (!behoort_aan_koper || !is_betaal) continue;

    const items = Array.isArray(bestelling.items) ? bestelling.items : [];
    if (items.some((i) => i.produk_slug === produk_slug && i.formaat === "eboek")) {
      return true;
    }
  }
  return false;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: JSON.stringify({ fout: "Meld eers aan" }) };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ongeldige JSON" }) };
  }

  const { produk_slug, bladsy } = invoer;
  const bladsy_nommer = Number(bladsy);

  if (!produk_slug || !Number.isInteger(bladsy_nommer) || bladsy_nommer < 1) {
    return { statusCode: 400, body: JSON.stringify({ fout: "Verpligte velde: produk_slug, bladsy (positiewe heelgetal)" }) };
  }

  try {
    if (!(await besit_boek(gebruiker.id, produk_slug))) {
      return { statusCode: 403, body: JSON.stringify({ fout: "Jy het nie hierdie e-boek gekoop nie" }) };
    }

    const store = kry_store("lees-vordering");
    await store.setJSON(`${produk_slug}--${gebruiker.id}`, {
      bladsy: bladsy_nommer,
      bygewerk_op: new Date().toISOString(),
    });

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (fout) {
    console.error("stoor-lees-vordering fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie leesvordering stoor nie" }) };
  }
};
