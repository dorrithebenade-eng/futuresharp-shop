// netlify/functions/portaal-foto.js
//
// DIE LEERDER SE FOTO, VIR FUTURE SHARP SE EIE REKORDS. Rol: boekhouding
// (Dorrithé en Ignatius). Eie lêer, los van portaal.js, sodat ander werk aan
// die paneel nie hiermee bots nie.
//
// Die blaaier sien die portaal se sleutel nooit: hierdie Function kontroleer
// die aanmelding en stuur deur na die portaal se /portaal/api/foto, waar die
// foto geënkripteer gestoor word.

const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const AKSIES = ["kry", "stoor", "verwyder"];
const PORTAAL = () =>
  String(process.env.PORTAAL_ADMIN_URL || "https://future-sharp-vraelyste.netlify.app").replace(/\/+$/, "") + "/portaal/api/foto";

function antwoord(status, data) {
  return { statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };
  const { rede } = await kry_gebruiker_en_rol_uitslag(event, context, ["boekhouding"]);
  if (rede === "geen_token") return antwoord(401, { fout: "Nie aangemeld nie" });
  if (rede !== "ok") return antwoord(403, { fout: "Geen toegang nie" });

  let invoer;
  try { invoer = JSON.parse(event.body || "{}"); } catch { return antwoord(400, { fout: "Ongeldige JSON" }); }
  if (!AKSIES.includes(invoer.aksie)) return antwoord(400, { fout: "Onbekende aksie" });

  const geheim = process.env.PORTAAL_API_SLEUTEL;
  if (!geheim) return antwoord(503, { fout: "PORTAAL_API_SLEUTEL is nie gestel nie" });
  const beheer = new AbortController();
  const klok = setTimeout(() => beheer.abort(), 15000);
  try {
    const r = await fetch(PORTAAL(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-portaal-sleutel": geheim },
      body: JSON.stringify({ aksie: invoer.aksie, no: invoer.no, data: invoer.data }),
      signal: beheer.signal,
    });
    const data = await r.json().catch(() => ({}));
    return antwoord(r.status, data);
  } catch (fout) {
    console.error("portaal-foto:", fout.message);
    return antwoord(502, { fout: "Die portaal het nie geantwoord nie" });
  } finally {
    clearTimeout(klok);
  }
};
