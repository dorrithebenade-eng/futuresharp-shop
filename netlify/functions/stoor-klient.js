// netlify/functions/stoor-klient.js
//
// Skep of wysig 'n kliënt. Rol: boekhouding.
//
// DIE VORM STOOR MET NET 'N NAAM. Dit is nie slordigheid nie: "+ Nuwe
// kliënt" moet midde-in 'n faktuur werk. Iemand bel, jy het 'n naam en 'n
// nommer, en 'n Function wat weier om te stoor, dwing 'n mens om die faktuur
// te verlaat.
//
// Die keer sit by die FAKTUUR, nie hier nie: sonder 'n e-pos het die
// proforma nêrens om heen te gaan, en dít is waar dit gestop word.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_kliente_store,
  skoon_epos,
  skep_nommer,
  nuwe_klient,
  SOORTE,
  voeg_geskiedenis_by,
} = require("./_kliente");

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

  const naam = String(invoer.naam || "").trim();
  if (!naam) {
    return { statusCode: 400, body: "Die naam is verplig" };
  }

  const soort = SOORTE.includes(invoer.soort) ? invoer.soort : "instansie";
  const store = kry_kliente_store();

  let rekord;
  let nuut = false;

  if (invoer.nommer) {
    rekord = await store.get(String(invoer.nommer), { type: "json" });
    if (!rekord) return { statusCode: 404, body: "Kliënt nie gevind nie" };
  } else {
    rekord = nuwe_klient("paneel");
    rekord.nommer = await skep_nommer(store);
    nuut = true;
  }

  rekord.soort = soort;
  rekord.naam = naam;
  // 'n PRIVAAT KLIËNT DRA NOOIT 'N KONTAKPERSOON NIE, ook nie een wat vroeër
  // ingetik is en dan van soort verander het nie. Bly dit stilweg op die
  // rekord staan, wys dit later op 'n skerm waar dit nie hoort nie.
  rekord.kontak = soort === "privaat" ? "" : String(invoer.kontak || "").trim();
  rekord.epos = skoon_epos(invoer.epos);
  rekord.selfoon = String(invoer.selfoon || "").trim();
  // Die adres bly presies soos dit ingetik is, met sy reëlbreuke — dit word
  // so op die faktuur gedruk. Net die wit spasie aan die punte val weg.
  rekord.adres = String(invoer.adres || "").trim();
  rekord.bygewerk_op = new Date().toISOString();
  rekord.gesien = true;

  voeg_geskiedenis_by(
    rekord,
    nuut ? "geskep" : "gewysig",
    (gebruiker && gebruiker.email) || ""
  );

  try {
    await store.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    console.error("Kon nie die kliënt stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die kliënt stoor nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nommer: rekord.nommer, nuut }),
  };
};
