// netlify/functions/kry-begunstigdes.js
//
// Boekhouding-beskermd — lys alle inskrywings uit die "begunstigdes"-store.
//
// Word deur die Registers-blad gebruik, en later deur die faktuurvorm se
// ontvanger-keuselys. Future Sharp self verskyn NOOIT in daardie lys nie:
// die maatskappy is die hoofrekening, nie 'n begunstigde nie. Skep 'n mens
// tog 'n ry daarvoor, word die deel uitbetaal én daar bly niks vir
// Paystack nie.
//
// Die volle rekord gaan deur, nie veld vir veld nie — anders is 'n nuwe
// veld op die rekord onsigbaar vir die skerm en lyk dit of die stoor
// misluk het.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const ROLLE = ["boekhouding"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  const store = kry_store("begunstigdes");
  const { blobs } = await store.list();

  const begunstigdes = await Promise.all(
    blobs.map((b) => store.get(b.key, { type: "json" }))
  );

  // Alfabeties, sodat die keuselys voorspelbaar is.
  const gesorteer = begunstigdes
    .filter(Boolean)
    .sort((a, b) => (a.naam || "").localeCompare(b.naam || "", "af"));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ begunstigdes: gesorteer }),
  };
};
