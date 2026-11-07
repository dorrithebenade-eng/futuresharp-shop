// Die register van fisiese items (November 2026): alles wat gedruk of
// gepak word, een keer opgestel. Harde-kopie-opsies verwys hierna met
// item_id (sien _harde-kopie-opsies.js).
//
// Rekord in die "fisiese_items"-store, sleutel = item_id:
//   { item_id, naam, formaat, drukkoste_sent, isbn, geskep_op, bygewerk_op }

const { kry_store } = require("./_blob-store");

const STORE = "fisiese_items";

async function kry_alle_items() {
  const store = kry_store(STORE);
  const { blobs } = await store.list();
  const items = [];
  for (const { key } of blobs) {
    const r = await store.get(key, { type: "json" });
    if (r) items.push(r);
  }
  items.sort((a, b) => String(a.naam).localeCompare(String(b.naam), "af"));
  return items;
}

// [{ item_id, aantal }] -> ["1 × A4 joernaal-jaarboek (hardeband)", ...]
// Die name word by die bestelling vasgelê, sodat 'n latere hernoeming nie
// verander wat op 'n ou bestelling staan nie.
async function kry_item_name(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const store = kry_store(STORE);
  const uit = [];
  for (const it of items) {
    const r = await store.get(it.item_id, { type: "json" });
    const naam = r ? (r.formaat ? `${r.naam} (${r.formaat})` : r.naam) : it.item_id;
    uit.push(`${it.aantal || 1} × ${naam}`);
  }
  return uit;
}

module.exports = { STORE, kry_alle_items, kry_item_name };
