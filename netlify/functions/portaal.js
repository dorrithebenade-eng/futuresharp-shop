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
const { portaal_admin, koppel_klient, fakture_vir } = require("./_portaal");
const { konsultant_vir_epos, lees_konsultante } = require("./_konsultante");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const AKSIES = [
  "lys", "een", "konsultasie", "skep_bladsy", "hernu",
  "instellings", "stoor_instrumente", "stoor_adres", "skrap_toets",
  "skrap", "hernommer", "sessies",
  "groepe", "skep_groep", "sluit_groep", "stoor_sjablone", "stel_voorskou", "skrap_groep", "stel_voltooi",
];

// DIE KONSULTANT (November 2026). Wie die rol "konsultant" het en nie
// "boekhouding" nie, mag net hierdie aksies doen, en net op registrasies wat
// deur haar eie skakel kom (registrasie.konsultant === haar kode). Sy kies
// net uit die vraelyste wat by haar in die Konsultante-register staan, en
// net vir die leerder of student, nie vir die ouer nie.
const KONSULTANT_AKSIES = ["lys", "een", "konsultasie", "skep_bladsy", "hernu", "instellings", "sessies"];
const REG_AKSIES = ["een", "konsultasie", "skep_bladsy", "sessies", "hernu"];

const PORTAAL_PUBLIEK = "https://futureshop.futuresharp.co.za/portaal";

function fout_met(status, boodskap) {
  const f = new Error(boodskap);
  f.status = status;
  return f;
}

function filter_instrumente(lys, konsultant) {
  const mag = new Set(konsultant.vraelyste || []);
  return (Array.isArray(lys) ? lys : []).filter((i) => i && mag.has(i.id) && i.vir !== "ouer");
}

// Gaan na of die konsultant hierdie aksie op hierdie registrasie mag doen.
// Gee die "een"-antwoord terug, sodat aksie "een" self nie twee keer gelees
// word nie.
async function konsultant_voorkontrole(konsultant, invoer) {
  if (!REG_AKSIES.includes(invoer.aksie)) return null;
  const een = await portaal_admin({ aksie: "een", no: invoer.no });
  if (!een.registrasie || een.registrasie.konsultant !== konsultant.kode) {
    throw fout_met(404, "Onbekende registrasie");
  }
  if (invoer.aksie === "hernu") {
    const tokens = (een.bladsye || []).map((b) => b.token);
    if (!tokens.includes(invoer.token)) throw fout_met(404, "Onbekende bladsy");
  }
  if (invoer.aksie === "skep_bladsy") {
    const mag = new Set(filter_instrumente(een.instrumente, konsultant).map((i) => i.id));
    const leerder = Array.isArray(invoer.leerder) ? invoer.leerder : [];
    const ouer = Array.isArray(invoer.ouer) ? invoer.ouer : [];
    if (ouer.length) throw fout_met(403, "'n Konsultant reik nie 'n ouervraelys uit nie");
    if (!leerder.length || leerder.some((id) => !mag.has(id))) {
      throw fout_met(403, "Net die vraelyste wat vir jou oopgestel is");
    }
  }
  return een;
}

function antwoord(status, data) {
  return { statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Metode nie toegelaat nie" };

  const { rede, gebruiker } = await kry_gebruiker_en_rol_uitslag(event, context, ["boekhouding", "konsultant"]);
  if (rede === "geen_token") return antwoord(401, { fout: "Nie aangemeld nie" });
  if (rede !== "ok") return antwoord(403, { fout: "Geen toegang tot Future Sharp nie" });

  const rolle = (gebruiker && gebruiker.app_metadata && gebruiker.app_metadata.roles) || [];
  let konsultant = null;
  if (!rolle.includes("boekhouding")) {
    try {
      konsultant = await konsultant_vir_epos(gebruiker.email);
    } catch (fout) {
      console.error("portaal: kon nie die konsultante lees nie:", fout);
      return antwoord(503, { fout: "Probeer weer" });
    }
    if (!konsultant) return antwoord(403, { fout: "Hierdie rekening is nie as konsultant opgestel nie" });
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return antwoord(400, { fout: "Ongeldige JSON" });
  }
  if (!AKSIES.includes(invoer.aksie)) return antwoord(400, { fout: "Onbekende aksie" });
  if (konsultant && !KONSULTANT_AKSIES.includes(invoer.aksie)) {
    return antwoord(403, { fout: "Hierdie aksie is nie vir 'n konsultant nie" });
  }

  try {
    let reeds = null;
    if (konsultant) reeds = await konsultant_voorkontrole(konsultant, invoer);

    // DIE FAKTUURSLOT: 'n gefaktureerde registrasie se nommer mag nie verander
    // en die registrasie nie geskrap word nie. Sien fakture_vir in _portaal.js.
    if (invoer.aksie === "hernommer" || invoer.aksie === "skrap") {
      const f = (await fakture_vir([invoer.no]))[String(invoer.no || "").toUpperCase()];
      if (f && f.length) {
        return antwoord(409, { fout: "Hierdie registrasie is gefaktureer (" + f.map((x) => x.nommer).join(", ") + ") en kan nie meer gewysig of geskrap word nie." });
      }
    }
    if (invoer.aksie === "skrap_toets") {
      const lys = await portaal_admin({ aksie: "lys" });
      const toets = (lys.registrasies || []).filter((r) => r.toets).map((r) => r.no);
      const f = await fakture_vir(toets);
      invoer.behalwe = Object.keys(f);
    }

    // Die konsultant se "een" is reeds gelees.
    const data = konsultant && invoer.aksie === "een" && reeds ? reeds : await portaal_admin(invoer);

    if (invoer.aksie === "een" && data.registrasie) {
      const f = (await fakture_vir([data.registrasie.no]))[String(data.registrasie.no).toUpperCase()];
      data.gefaktureer = f || [];
    }

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
    if (konsultant) {
      // Net haar eie registrasies, haar eie vraelyste en haar eie skakel.
      if (Array.isArray(data.registrasies)) {
        data.registrasies = data.registrasies.filter((r) => r.konsultant === konsultant.kode);
      }
      if (Array.isArray(data.instrumente)) data.instrumente = filter_instrumente(data.instrumente, konsultant);
      if (invoer.aksie === "lys") {
        data.registrasieskakel = `${PORTAAL_PUBLIEK}/registreer?k=${konsultant.kode}`;
        data.registrasieskakel_en = `${PORTAAL_PUBLIEK}/register?k=${konsultant.kode}`;
      }
      // Die besigheidsadres is Future Sharp s'n; 'n konsultant tik haar eie
      // plek by 'n konsultasie in persoon.
      delete data.adres;
      delete data.sjablone;
      data.konsultant = { kode: konsultant.kode, naam: konsultant.naam };
    } else if (invoer.aksie === "lys") {
      // Vir julle: die name by die kodes, sodat die lys kan wys wie die
      // konsultant is.
      try {
        data.konsultante = Object.fromEntries((await lees_konsultante()).map((k) => [k.kode, k.naam]));
      } catch (fout) {
        data.konsultante = {};
      }
    }
    return antwoord(200, data);
  } catch (fout) {
    console.error("portaal", invoer.aksie, fout.message);
    return antwoord(fout.status && fout.status < 500 ? fout.status : 502, { fout: fout.message });
  }
};
