// netlify/functions/kry-bankstate.js
//
// Boekhouding-beskermd. Sonder `sleutel`: 'n opsomming van elke ingevoerde
// staat. Met `?sleutel=`: daardie staat volledig, met sy reels.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const B = require("./_bankstate");

function tel(s) {
  const t = { oop: 0, voorstel: 0, gepas: 0, toegewys: 0, oordrag: 0, inligting: 0 };
  (s.reels || []).forEach((r) => { t[r.stand] = (t[r.stand] || 0) + 1; });
  return t;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };

  const store = B.kry_bankstate_store();
  const sleutel = String((event.queryStringParameters || {}).sleutel || "").trim();

  try {
    if (sleutel) {
      const s = await store.get(sleutel, { type: "json" });
      if (!s) return { statusCode: 404, body: "Staat nie gevind nie" };
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staat: { ...s, tel: tel(s) } }),
      };
    }
    const state = (await B.lees_almal(store))
      .map((s) => ({
        sleutel: s.sleutel, bank: s.bank, rekening4: s.rekening4, van: s.van, tot: s.tot,
        opening_sent: s.opening_sent, sluit_sent: s.sluit_sent, toets: s.toets === true,
        reels: (s.reels || []).length, tel: tel(s), ingevoer_op: s.ingevoer_op,
      }))
      .sort((a, b) => String(b.van).localeCompare(String(a.van)));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    };
  } catch (fout) {
    console.error("Kon nie die bankstate lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die bankstate laai nie" };
  }
};
