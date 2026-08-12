// Personeel-beskermd — genereer 'n nuwe uitnodigingskakel vir 'n gekose
// rol (Outeur/Vennoot/Ontwerp-Admin/Printing/Aflewering). Die token is
// die enigste "sleutel" tot die publieke vorm — hou dit onraaibaar lank.
//
// Die uitnodiging self dra NIE die persoon se naam nie (ons weet nog nie
// wie dit gaan invul nie) — dis 'n generiese, rol-gebonde skakel wat
// personeel stuur aan wie ook al moet aansluit.

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { nuwe_verval_op } = require("./_uitnodiging-geldig");

const GELDIGE_ROLLE = ["outeur", "vennoot", "ontwerp_admin", "printing", "aflewering"];

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const rol_tipe = (invoer.rol_tipe || "").trim();
  if (!GELDIGE_ROLLE.includes(rol_tipe)) {
    return { statusCode: 400, body: `Ongeldige rol_tipe — moet een van wees: ${GELDIGE_ROLLE.join(", ")}` };
  }

  const token = crypto.randomBytes(24).toString("hex");

  const geskep_op = new Date().toISOString();

  const uitnodiging = {
    token,
    rol_tipe,
    status: "hangend", // hangend | voltooi
    geskep_op,
    // Die skakel se eie einde, op die rekord geskryf en nie afgelei nie —
    // sodat 'n latere verandering aan die tydperk nie 'n reeds gestuurde
    // skakel onder iemand se voete uittrek nie.
    verval_op: nuwe_verval_op(geskep_op),
    geskep_deur: gebruiker.email,
    voltooi_op: null,
    geskepte_entiteit_id: null,
  };

  const store = kry_store("uitnodigings");
  await store.setJSON(token, uitnodiging);

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(uitnodiging),
  };
};
