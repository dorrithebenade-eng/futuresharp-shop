// netlify/functions/akk-aflaai.js
//
// Bedien 'n Akkreditasie-dokument se lêer. Anders as kry-dokument.js IS HIERDIE
// EEN BESKERM: akkreditasiedokumente is nie vir buitestanders nie. Die blaaier
// haal die lêer met die Authorization-kop en maak hom self oop of laai hom af.
//
// TOEGANG: boekhouding-rol (sien _akk.js).
//
// Gebruik: GET /.netlify/functions/akk-aflaai?id=<dokument-id>&wys=1
//   wys=1  inline (bekyk in die blaaier)
//   anders attachment (aflaai)

const { kry_store } = require("./_blob-store");
const G = require("./_akk");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") return G.json(405, { fout: "Metode nie toegelaat nie" });

  const toegang = await G.kontroleer(event, context);
  if (toegang.antwoord) return toegang.antwoord;

  const parms = event.queryStringParameters || {};
  const id = String(parms.id || "");
  if (!id) return G.json(400, { fout: "Ontbrekende id" });

  try {
    const rekord = await kry_store(G.STORE.dokumente).get(id, { type: "json" });
    if (!rekord) return G.json(404, { fout: "Dokument nie gevind nie." });

    const lêer = await kry_store(G.STORE.leers).get(id, { type: "arrayBuffer" });
    if (!lêer) return G.json(404, { fout: "Die lêer ontbreek." });

    const naam = String(rekord["lêernaam"] || id).replace(/["\\\r\n]/g, "");
    const ascii = naam.replace(/[^\x20-\x7E]/g, "_");
    const wyse = parms.wys === "1" ? "inline" : "attachment";

    return {
      statusCode: 200,
      headers: {
        "Content-Type": rekord.inhoud_tipe || "application/octet-stream",
        "Content-Disposition": `${wyse}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(naam)}`,
        "Cache-Control": "private, no-store",
      },
      body: Buffer.from(lêer).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (f) {
    console.error("Akkreditasies-aflaai het misluk:", f);
    return G.json(500, { fout: "Kon nie die lêer laai nie." });
  }
};
