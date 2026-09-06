// netlify/functions/kry-paystack-transaksies.js
//
// Lees die rou Paystack-transaksies vir een finansiele jaar. Rol: boekhouding.
//
// WAARVOOR DIT IS. Twee dinge, en hulle bly albei geld:
//
//   1. Om te SIEN wat Paystack werklik teruggee. Die vorm van 'n verdeelde
//      transaksie -- watter veld dra wat na die hoofrekening gegaan het -- is
//      nie iets wat 'n mens uit die dokumentasie met sekerheid aflei nie. Die
//      afleiding in kry-joernaal.js word teen 'n WERKLIKE transaksie geskryf.
//
//   2. Om later 'n transaksielys in die paneel te wys.
//
// `rou=1` gee die volle transaksievoorwerp terug. Dit is groot; daarsonder kom
// slegs die afskrifvelde.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_paystack_transaksies_store,
  jaar_voorvoegsel,
} = require("./_paystack-transaksies");

const ROLLE = ["boekhouding"];

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  const vraag = event.queryStringParameters || {};
  const jaar = Number(vraag.jaar) || new Date().getUTCFullYear();
  const wil_rou = String(vraag.rou || "") === "1";
  const maks = Math.min(200, Math.max(1, Number(vraag.maks) || 200));

  const store = kry_paystack_transaksies_store();

  let almal = [];
  try {
    const { blobs } = await store.list({ prefix: jaar_voorvoegsel(jaar) });
    almal = (
      await Promise.all(
        (blobs || []).map((b) => store.get(b.key, { type: "json" }))
      )
    ).filter(Boolean);
  } catch (fout) {
    console.error("Kon nie die Paystack-transaksies lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die transaksies laai nie" };
  }

  almal.sort((a, b) => String(b.datum).localeCompare(String(a.datum)));

  const lys = almal.slice(0, maks).map((t) => {
    if (wil_rou) return t;
    const { rou, ...res } = t;
    return res;
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jaar, aantal: almal.length, transaksies: lys }),
  };
};
