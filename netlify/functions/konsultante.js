// netlify/functions/konsultante.js
//
// Die Konsultante-register lees (GET) of stoor (POST { konsultante: [...] }).
// Rol: boekhouding (Dorrithé en Ignatius). Sien _konsultante.js.

const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { lees_konsultante, skryf_konsultante } = require("./_konsultante");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const antwoord = (status, data) => ({ statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) });

exports.handler = async (event, context) => {
  const { rede } = await kry_gebruiker_en_rol_uitslag(event, context, ["boekhouding"]);
  if (rede === "geen_token") return antwoord(401, { fout: "Nie aangemeld nie" });
  if (rede !== "ok") return antwoord(403, { fout: "Geen toegang nie" });

  try {
    if (event.httpMethod === "GET") {
      return antwoord(200, { konsultante: await lees_konsultante() });
    }
    if (event.httpMethod === "POST") {
      let invoer;
      try {
        invoer = JSON.parse(event.body || "{}");
      } catch {
        return antwoord(400, { fout: "Ongeldige JSON" });
      }
      return antwoord(200, { konsultante: await skryf_konsultante(invoer.konsultante) });
    }
    return antwoord(405, { fout: "Metode nie toegelaat nie" });
  } catch (fout) {
    if (fout.status === 400) return antwoord(400, { fout: fout.message });
    console.error("konsultante:", fout);
    return antwoord(500, { fout: "Kon nie die konsultante lees of stoor nie" });
  }
};
