// netlify/functions/nommer-projekte.js
//
// Gee elke projek wat nog nie 'n nommer het nie, een. Rol: boekhouding.
//
// Projekte wat voor 17 Oktober 2026 geskep is, het nie 'n nommer nie. Hulle
// kry een in die volgorde waarin hulle geskep is, elk in sy eie
// skeppingsjaar, sodat die oudste projek die laagste nommer het. 'n Projek
// wat reeds 'n nommer het, word nie aangeraak nie.
//
// Dieselfde nommer kom ook vanself by die volgende stoor van 'n projek (sien
// stoor-projek.js). Hierdie leer doen dit vir almal in een slag.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_projekte_store, lees_almal, volgende_nr, jaar_van } = require("./_projekte");

const ROLLE = ["boekhouding"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  const store = kry_projekte_store();
  let almal;
  try {
    almal = await lees_almal(store);
  } catch (fout) {
    console.error("Kon nie die projekte lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die projekte laai nie" };
  }

  const sonder = almal
    .filter((p) => p && p.id && !p.nr)
    .sort((a, b) => String(a.geskep_op || "").localeCompare(String(b.geskep_op || "")));

  const nou = new Date().toISOString();
  const gegee = [];
  for (const p of sonder) {
    const nr = volgende_nr(almal, jaar_van(p.geskep_op));
    const rekord = { ...p, nr, bygewerk_op: nou };
    try {
      await store.setJSON(p.id, rekord);
    } catch (fout) {
      console.error(`Kon nie projek "${p.id}" nommer nie:`, fout);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fout: "Kon nie al die projekte nommer nie", gegee }),
      };
    }
    // Die volgende nommer moet hierdie een sien.
    p.nr = nr;
    gegee.push({ id: p.id, nr });
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gegee }),
  };
};
