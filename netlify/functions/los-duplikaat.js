// netlify/functions/los-duplikaat.js
//
// Los 'n duplikaat-paar op. Rol: boekhouding.
//
// DRIE UITKOMSTE, en die stelsel kies nooit self nie:
//
//   vee_weg   — die nuwe indiening dra niks nuuts nie
//   werk_by   — die BESTAANDE rekord kry die gekose waardes, die nuwe verdwyn
//   hou_albei — werklik twee kliënte wat 'n adres deel
//
// DIE BESTAANDE KLIËNTNOMMER OORLEEF ALTYD. Dit is waarna die fakture
// verwys. Die duplikaat se nommer verdwyn saam met sy rekord, en daar bly 'n
// gaping in die reeks — 'n nommer wat niks geword het nie. Dit is
// aanvaarbaar; die alternatief is 'n indiening wat wag sonder 'n nommer.
//
// 'n KLIËNT MET FAKTURE KAN NIE UITGEVEE WORD NIE. Die faktuur sou na niks
// verwys. Die vee_weg-pad raak in elk geval net 'n splinternuwe indiening,
// wat per definisie nog geen faktuur het nie — maar die toets staan hier,
// want dit is die enigste plek wat 'n kliëntrekord verwyder.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store } = require("./_fakture");
const {
  kry_kliente_store,
  paar_sleutel,
  voeg_geskiedenis_by,
} = require("./_kliente");

const NAGEGAAN_SLEUTEL = "_nagegaan";
const VELDE = ["soort", "naam", "kontak", "epos", "selfoon"];

async function het_fakture(nommer) {
  try {
    const store = kry_fakture_store();
    const lys = await store.list();
    for (const b of lys.blobs || []) {
      const f = await store.get(b.key, { type: "json" });
      if (f && f.klient_id === nommer) return true;
    }
  } catch (fout) {
    // Kan die fakture nie lees nie: dan weier ons eerder as om te raai.
    console.error("Kon nie die fakture nagaan nie:", fout);
    return true;
  }
  return false;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const { hou, weg, uitkoms, keuses } = invoer;
  if (!hou || !weg) return { statusCode: 400, body: "Twee nommers is nodig" };
  if (!["vee_weg", "werk_by", "hou_albei"].includes(uitkoms)) {
    return { statusCode: 400, body: "Onbekende uitkoms" };
  }

  const store = kry_kliente_store();
  const bestaande = await store.get(String(hou), { type: "json" });
  const nuwe = await store.get(String(weg), { type: "json" });
  if (!bestaande || !nuwe) return { statusCode: 404, body: "Kliënt nie gevind nie" };

  // Hou albei: die paar word as nagegaan gemerk en keer nie terug nie. Kom
  // daar 'n DERDE rekord met dieselfde adres, is dit 'n nuwe paar.
  if (uitkoms === "hou_albei") {
    let pare = [];
    try {
      const g = await store.get(NAGEGAAN_SLEUTEL, { type: "json" });
      if (g && Array.isArray(g.pare)) pare = g.pare;
    } catch {
      /* bestaan nog nie */
    }
    const sleutel = paar_sleutel(bestaande.nommer, nuwe.nommer);
    if (!pare.includes(sleutel)) pare.push(sleutel);

    bestaande.gesien = true;
    nuwe.gesien = true;
    await store.setJSON(NAGEGAAN_SLEUTEL, { pare });
    await store.setJSON(bestaande.nommer, bestaande);
    await store.setJSON(nuwe.nommer, nuwe);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uitkoms, gehou: [bestaande.nommer, nuwe.nommer] }),
    };
  }

  if (await het_fakture(nuwe.nommer)) {
    return {
      statusCode: 409,
      body: "Hierdie kliënt het fakture en kan nie uitgevee word nie",
    };
  }

  if (uitkoms === "werk_by") {
    const gekies = keuses || {};
    const verander = [];
    VELDE.forEach((v) => {
      if (gekies[v] !== "nuwe") return;
      if ((bestaande[v] || "") === (nuwe[v] || "")) return;
      verander.push(v);
      bestaande[v] = nuwe[v];
    });
    // Verander die soort na privaat, val die kontakpersoon weg — dieselfde
    // reël as in stoor-klient.js.
    if (bestaande.soort === "privaat") bestaande.kontak = "";
    bestaande.bygewerk_op = new Date().toISOString();
    voeg_geskiedenis_by(
      bestaande,
      "bygewerk uit " + nuwe.nommer,
      (gebruiker && gebruiker.email) || "",
      verander.join(", ")
    );
  } else {
    voeg_geskiedenis_by(
      bestaande,
      "duplikaat " + nuwe.nommer + " weggevee",
      (gebruiker && gebruiker.email) || ""
    );
  }

  bestaande.gesien = true;

  try {
    await store.setJSON(bestaande.nommer, bestaande);
    await store.delete(nuwe.nommer);
  } catch (fout) {
    console.error("Kon nie die duplikaat oplos nie:", fout);
    return { statusCode: 500, body: "Kon nie die duplikaat oplos nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uitkoms, gehou: [bestaande.nommer] }),
  };
};
