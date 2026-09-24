// netlify/functions/stoor-befondser.js
//
// Boekhouding-beskermd -- skep of wysig een befondser of skenker.
//
// 'n Nuwe rekord kry sy nommer uit sy rol (F of S); 'n wysiging stuur die
// nommer saam en die rol bly wat dit was. `aktief` kom nie van die vorm nie;
// sien aktiveer-befondser.js.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_befondsers_store,
  ROLLE,
  SOORTE,
  skep_nommer,
  nuwe_befondser,
} = require("./_befondsers");

const VELDE = {
  naam: 160, handelsnaam: 160, registrasienommer: 40, belastingnommer: 40,
  kontakpersoon: 120, telefoon: 40, adres: 500, nota: 500,
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const naam = String(invoer.naam || "").trim().slice(0, VELDE.naam);
  if (!naam) return { statusCode: 400, body: "Die naam is verplig" };

  const store = kry_befondsers_store();
  let rekord;
  let nuut = false;

  try {
    if (invoer.nommer) {
      rekord = await store.get(String(invoer.nommer), { type: "json" });
      if (!rekord) return { statusCode: 404, body: "Befondser nie gevind nie" };
    } else {
      const rol = ROLLE[invoer.rol] ? invoer.rol : null;
      if (!rol) return { statusCode: 400, body: "Kies befondser of skenker" };
      rekord = nuwe_befondser(rol);
      rekord.nommer = await skep_nommer(store, rol);
      rekord.geskep_deur = gebruiker.email || "";
      nuut = true;
    }
  } catch (fout) {
    console.error("Kon nie die befondser voorberei nie:", fout);
    return { statusCode: 500, body: "Kon nie die befondser laai nie" };
  }

  Object.keys(VELDE).forEach((v) => {
    rekord[v] = String(invoer[v] || "").trim().slice(0, VELDE[v]);
  });
  rekord.naam = naam;
  rekord.soort = SOORTE.includes(invoer.soort) ? invoer.soort : "maatskappy";
  rekord.epos = String(invoer.epos || "").trim().toLowerCase().slice(0, 160);
  rekord.aktief = rekord.aktief !== false;
  rekord.bygewerk_op = new Date().toISOString();

  try {
    await store.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    console.error("Kon nie die befondser stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die befondser stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ befondser: rekord, nuut }),
  };
};
