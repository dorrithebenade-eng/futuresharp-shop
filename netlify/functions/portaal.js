// netlify/functions/portaal.js
//
// Die Future Sharp-paneel se ingang na die registrasieportaal. Rol:
// boekhouding (Dorrithé en Ignatius).
//
// DIE BLAAIER SIEN NOOIT DIE PORTAAL SE SLEUTEL NIE. Hierdie Function
// kontroleer die aanmelding en die rol, en stuur dan self deur met die
// sleutel uit die omgewing.
//
// BY "lys" WORD KLIËNTE WAT NOG NIE GEKOPPEL IS NIE, NOU GEKOPPEL. Die portaal
// probeer dit by elke registrasie self, maar was die winkel daardie oomblik
// nie bereikbaar nie, bly die registrasie sonder kliëntnommer. Die lys is die
// natuurlike plek om dit reg te maak: iemand kyk juis nou.

const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { portaal_admin, koppel_klient } = require("./_portaal");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const AKSIES = [
  "lys", "een", "konsultasie", "skep_bladsy", "hernu",
  "instellings", "stoor_instrumente", "stoor_adres", "skrap_toets",
];

function antwoord(status, data) {
  return { statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };

  const { rede } = await kry_gebruiker_en_rol_uitslag(event, context, ["boekhouding"]);
  if (rede === "geen_token") return antwoord(401, { fout: "Nie aangemeld nie" });
  if (rede !== "ok") return antwoord(403, { fout: "Geen toegang tot Future Sharp nie" });

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return antwoord(400, { fout: "Ongeldige JSON" });
  }
  if (!AKSIES.includes(invoer.aksie)) return antwoord(400, { fout: "Onbekende aksie" });

  try {
    const data = await portaal_admin(invoer);

    if (invoer.aksie === "lys" && Array.isArray(data.registrasies)) {
      for (const r of data.registrasies) {
        if (r.toets || (r.klient && r.klient.nommer) || !r.rp_epos) continue;
        try {
          const k = await koppel_klient({ registrasie: r.no, naam: r.rp_naam, epos: r.rp_epos, selfoon: r.rp_sel });
          await portaal_admin({ aksie: "klient", no: r.no, nommer: k.nommer });
          r.klient = { nommer: k.nommer, fout: null };
        } catch (fout) {
          console.error("Kon nie", r.no, "koppel nie:", fout.message);
        }
      }
    }
    return antwoord(200, data);
  } catch (fout) {
    console.error("portaal", invoer.aksie, fout.message);
    return antwoord(fout.status && fout.status < 500 ? fout.status : 502, { fout: fout.message });
  }
};
