// Voorskou (November 2026): ongelyste boeke vir die mense wat hulle mag sien
// voordat hulle op die rak is.
//
// 'n Aangemelde gebruiker kry die aktiewe, ongelyste boeke (sien
// kry-katalogus.js) waarvan hy die outeur is, of almal as hy admin is
// ("personeel" of "admin_leser", soos in _eie-toegang.js). Die winkel wys
// hulle in 'n eie ry "Voorskou", sodat die outeur die volle roete sien:
// kaart, Lees meer, boekbladsy of webblad, en die betaalbladsy.
//
// Geen sessie of niks om te wys nie: 'n leë lys, nooit 'n fout nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_outeur } = require("./_my-outeur");
const { outeur_by_produk_betrokke } = require("./_outeur-aandeel");
const { is_admin } = require("./_eie-toegang");

const leeg = { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ produkte: [] }) };

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["koper", "personeel", "admin_leser"]);
  if (!gebruiker) return leeg;

  try {
    const admin = is_admin(gebruiker);
    let outeur_id = null;
    try {
      const outeur = await kry_my_outeur(gebruiker);
      outeur_id = (outeur && outeur.outeur_id) || null;
    } catch (_) {
      /* geen outeur nie */
    }
    if (!admin && !outeur_id) return leeg;

    const store = kry_store("katalogus");
    const { blobs } = await store.list();
    const produkte = [];
    for (const { key } of blobs) {
      const p = await store.get(key, { type: "json" });
      if (!p || !p.aktief || p.ongelys !== true) continue;
      if (admin || outeur_by_produk_betrokke(p, outeur_id)) produkte.push({ ...p, voorskou: true });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ produkte }),
    };
  } catch (fout) {
    console.error("Kon nie voorskou-boeke laai nie:", fout);
    return leeg;
  }
};
