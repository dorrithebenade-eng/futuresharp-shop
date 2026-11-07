// Personeel-beskermd: skep, wysig of skrap 'n fisiese item (sien
// _fisiese-items.js).
//
// POST { aksie: "stoor", item: { item_id?, naam, formaat, drukkoste_sent, isbn } }
// POST { aksie: "skrap", item_id }
//
// 'n Item wat nog in 'n harde-kopie-opsie gebruik word, kan nie geskrap
// word nie; die antwoord noem die boeke.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { STORE } = require("./_fisiese-items");
const { maak_sleutel } = require("./_harde-kopie-opsies");

async function boeke_wat_item_gebruik(item_id) {
  const store = kry_store("katalogus");
  const { blobs } = await store.list();
  const titels = [];
  for (const { key } of blobs) {
    const p = await store.get(key, { type: "json" });
    const opsies = (p && p.formate && p.formate.harde_kopie && p.formate.harde_kopie.opsies) || [];
    if (opsies.some((o) => (o.items || []).some((it) => it.item_id === item_id))) titels.push(p.titel);
  }
  return titels;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const store = kry_store(STORE);

  if (invoer.aksie === "skrap") {
    const item_id = maak_sleutel(invoer.item_id);
    if (!item_id) return { statusCode: 400, body: "item_id ontbreek" };
    const titels = await boeke_wat_item_gebruik(item_id);
    if (titels.length) {
      return { statusCode: 409, body: `Die item word nog gebruik in: ${titels.join(", ")}` };
    }
    await store.delete(item_id);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ geskrap: item_id }) };
  }

  if (invoer.aksie !== "stoor" || !invoer.item) {
    return { statusCode: 400, body: "Onbekende aksie" };
  }

  const i = invoer.item;
  const naam = String(i.naam || "").trim().slice(0, 80);
  if (!naam) return { statusCode: 400, body: "Die item het 'n naam nodig" };
  const item_id = maak_sleutel(i.item_id || naam);
  if (!item_id) return { statusCode: 400, body: "Kon nie 'n geldige ID van die naam aflei nie" };
  const drukkoste_sent = Math.max(0, Math.round(Number(i.drukkoste_sent) || 0));

  const bestaande = await store.get(item_id, { type: "json" });
  const nou = new Date().toISOString();
  const rekord = {
    item_id,
    naam,
    formaat: String(i.formaat || "").trim().slice(0, 60),
    drukkoste_sent,
    isbn: String(i.isbn || "").trim().slice(0, 20),
    geskep_op: bestaande ? bestaande.geskep_op : nou,
    bygewerk_op: nou,
    bygewerk_deur: gebruiker.email,
  };
  await store.setJSON(item_id, rekord);

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: rekord }) };
};
