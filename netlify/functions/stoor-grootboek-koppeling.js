// netlify/functions/stoor-grootboek-koppeling.js
// Weergawe 1 (16 Oktober 2026).
//
// Stoor die koppeling van een of meer grootboekrekeninge. Rol: boekhouding.
//
// Invoer: { rekeninge: { "2200/000": { kategorie, naam }, ... } }
//
// SAAMVOEG, NIE VERVANG NIE. Net die rekeninge wat gestuur word, verander;
// 'n koppeling uit 'n vorige boekjaar se grootboek bly staan, al kom daardie
// rekening nie in hierdie jaar se grootboek voor nie.
//
// DIE KATEGORIE MOET BESTAAN EN DIE REGTE RIGTING HE. 'n Uitgawerekening aan
// 'n inkomstekategorie gekoppel sou elke reel daarvan by die toewysing laat
// misluk; dit word hier al geweier.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_store } = require("./_blob-store");
const K = require("./_grootboek-koppeling");

const VAS = { "diensinkomste": "in", "paystack-transaksiefooi": "uit" };

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  let invoer;
  try { invoer = JSON.parse(event.body); } catch { return { statusCode: 400, body: "Ongeldige JSON" }; }
  const nuut = invoer && typeof invoer.rekeninge === "object" && invoer.rekeninge ? invoer.rekeninge : null;
  if (!nuut || !Object.keys(nuut).length) return { statusCode: 400, body: "Niks om te stoor nie" };

  let kats;
  try {
    const ks = kry_store("fin-kategoriee");
    const { blobs } = await ks.list();
    kats = new Map((await Promise.all((blobs || []).map((b) => ks.get(b.key, { type: "json" }))))
      .filter(Boolean).map((k) => [k.id, k.rigting === "in" ? "in" : "uit"]));
    Object.entries(VAS).forEach(([id, r]) => { if (!kats.has(id)) kats.set(id, r); });
  } catch (fout) {
    console.error("Kon nie die kategoriee lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die kategoriee laai nie" };
  }

  const skoon = {};
  for (const [kode, w] of Object.entries(nuut)) {
    if (!K.KODE.test(kode)) return { statusCode: 400, body: `Ongeldige rekeningkode: ${kode}` };
    const kategorie = String((w && w.kategorie) || "");
    const rigting = w && (w.rigting === "in" || w.rigting === "uit") ? w.rigting : "";
    if (kategorie && kategorie !== "__oordrag") {
      if (!kats.has(kategorie)) return { statusCode: 400, body: `Die kategorie vir ${kode} bestaan nie.` };
      if (rigting && kats.get(kategorie) !== rigting) {
        return {
          statusCode: 409,
          body: `${kode} is ${rigting === "in" ? "'n inkomsterekening" : "'n uitgawerekening"}, maar die kategorie is ${kats.get(kategorie) === "in" ? "inkomste" : "'n uitgawe"}.`,
        };
      }
    }
    skoon[kode] = { kategorie, naam: String((w && w.naam) || "").slice(0, 120) };
  }

  const store = K.kry_koppeling_store();
  try {
    const d = await K.lees(store);
    d.rekeninge = { ...d.rekeninge, ...skoon };
    d.bygewerk_op = new Date().toISOString();
    d.bygewerk_deur = gebruiker.email || "";
    await store.setJSON(K.SLEUTEL, d);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) };
  } catch (fout) {
    console.error("Kon nie die koppeling stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die koppeling stoor nie" };
  }
};
