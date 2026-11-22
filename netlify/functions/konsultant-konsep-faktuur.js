// netlify/functions/konsultant-konsep-faktuur.js
//
// 'N KONSULTANT SKEP 'N KONSEP-FAKTUUR (November 2026). Rol: konsultant.
//
// Die konsultant het geen toegang tot Boekhouding nie. Sy merk in die Future
// Sharp-paneel die eerste konsultasie en die opvolgsessies, en hierdie
// Function skep die konsep in Boekhouding se faktuurstore. Dorrithé of
// Ignatius stel daarna die verdeling, reik dit uit en stuur dit.
//
// NIKS WORD VAN DIE BLAAIER AF VERTROU NIE behalwe watter sessies gemerk is:
//   - die registrasie moet hare wees (registrasie.konsultant === haar kode);
//   - die kliënt kom uit die registrasie se kliëntnommer;
//   - die bedrae kom uit die koste wat by registrasie aanvaar is, anders uit
//     die huidige koste-instellings. Dieselfde reël as fsp-faktuur.js.
//
// DIE REELS, in dieselfde volgorde as fsp-faktuur.js:
//   1. Studievaardigheidskonsultasie × 1, teen die opvolgbedrag;
//   2. Vraelyste en verslag × 1, teen eerste min opvolg;
//   3. Opvolgkonsultasie × die gemerkte opvolgsessies, teen die opvolgbedrag.
// Reels 1 en 2 net as die eerste konsultasie gemerk is. Die registrasienommer
// staan op elke reel, sodat die faktuurslot (fakture_vir) die registrasie
// herken.
//
// DIE VERDELING KOM VOORAF INGEVUL (22 November 2026), soos Ignatius en
// Dorrithé dit besluit het:
//   - Konsultasie- en opvolgreels: die konsultant kry 70% van die VOLLE
//     reelbedrag as 'n vaste bedrag (R700 op R1 000). Hosting 5% soos op
//     Ignatius se eie fakture. Ignatius kry die res: wat ná die Paystack-fooi,
//     die konsultant en hosting oorbly, ook as 'n vaste bedrag, sodat die
//     oorskot nul is.
//   - Vraelyste en verslag: presies soos op Ignatius se eie fakture.
// Die konsultant se ry dra haar naam soos in die Konsultante-lys. Sy word eers
// deur Paystack uitbetaal wanneer daar 'n begunstigde met DIESELFDE naam en 'n
// subrekening is; tot dan word haar deel met die hand betaal.
// Boekhouding gaan die konsep na en kan enige ry verander voor uitreiking.

const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { portaal_admin } = require("./_portaal");
const { konsultant_vir_epos } = require("./_konsultante");
const { kry_fakture_store, skep_konsep_sleutel, nuwe_faktuur, voeg_geskiedenis_by } = require("./_fakture");
const { kry_kliente_store } = require("./_kliente");
const { fs_bereken, fs_invoer_uit_faktuur } = require("../../public/js/faktuur-som.js");

const IGNATIUS = "Ignatius Gous";
const DORRITHE = "Dorrithé Labuschagne";
const KONSULTANT_PCT = 70;
const HOSTING_PCT = 5;
// Soos op FS/01961 en FS/01962, deur Dorrithé bevestig op 22 November 2026:
// sy kry die groter deel. FS/01970 het die twee per abuis omgeruil.
const VRAE_VERDELING = [
  { ontvanger: DORRITHE, tipe: "pct", waarde: 62.5 },
  { ontvanger: IGNATIUS, tipe: "pct", waarde: 32.5 },
];

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const antwoord = (status, data) => ({ statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) });

const REEL = {
  af: { kons: "Studievaardigheidskonsultasie", vrae: "Vraelyste en verslag", opvolg: "Opvolgkonsultasie" },
  en: { kons: "Study skills consultation", vrae: "Questionnaires and report", opvolg: "Follow-up consultation" },
};

// Die bedrae in rand: eers die aanvaarde (koste of koste_kennis), dan die huidige.
function pryse_vir(reg, huidig) {
  const t = (reg.toestemmings || []).find((x) => (x.soort === "koste" || x.soort === "koste_kennis") && x.bedrae);
  const p = (t && t.bedrae) || huidig || {};
  const eerste = Number(p.eerste);
  const opvolg = Number(p.opvolg);
  if (!(eerste > 0) || !(opvolg > 0)) return null;
  return { kons: opvolg, vrae: Math.max(0, eerste - opvolg) };
}

function reel(beskrywing, rand, aantal, soort_reel) {
  const prys_pp_sent = Math.round(rand * 100);
  return {
    _soort: soort_reel,
    soort: "verkoop",
    beskrywing: beskrywing.slice(0, 300),
    hoeveelheid: aantal,
    prys_pp_sent,
    bedrag_sent: Math.round(aantal * prys_pp_sent),
    vou_in: false,
    hosting_pct: HOSTING_PCT,
    kategorie_id: "",
    verdeling: [],
  };
}

// Vul elke reel se verdeling in. Ignatius se deel op die konsultasiereels is
// "die res", en die stelsel ken net persentasies en vaste bedrae. Die som loop
// dus eers sonder hom; wat daarna op elke reel onverdeel oorbly, is syne.
function stel_verdeling(rekord, reels, konsultant_naam) {
  reels.forEach((r) => {
    if (r._soort === "vrae") {
      r.verdeling = VRAE_VERDELING.map((v) => ({ ...v }));
    } else {
      // Vaste bedrae word in sent gestoor.
      r.verdeling = [
        { ontvanger: konsultant_naam, tipe: "vas", waarde: Math.round((r.bedrag_sent * KONSULTANT_PCT) / 100) },
      ];
    }
  });
  const proef = { ...rekord, reels };
  const u = fs_bereken(fs_invoer_uit_faktuur(proef, () => false));
  reels.forEach((r, ix) => {
    if (r._soort === "vrae") return;
    const p = u.perReel[ix];
    const res = p ? p.basisSent - p.toegekenSent : 0;
    if (res > 0) r.verdeling.push({ ontvanger: IGNATIUS, tipe: "vas", waarde: res });
  });
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return antwoord(405, { fout: "Metode nie toegelaat nie" });

  const { rede, gebruiker } = await kry_gebruiker_en_rol_uitslag(event, context, ["konsultant"]);
  if (rede === "geen_token") return antwoord(401, { fout: "Nie aangemeld nie" });
  if (rede !== "ok") return antwoord(403, { fout: "Geen toegang nie" });

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return antwoord(400, { fout: "Ongeldige JSON" });
  }

  const eerste = invoer.eerste === true;
  const opvolg = Math.round(Number(invoer.opvolg) || 0);
  if (opvolg < 0 || opvolg > 30) return antwoord(400, { fout: "Ongeldige getal opvolgsessies" });
  if (!eerste && !opvolg) return antwoord(400, { fout: "Merk ten minste een sessie" });

  try {
    const konsultant = await konsultant_vir_epos(gebruiker.email);
    if (!konsultant) return antwoord(403, { fout: "Hierdie rekening is nie as konsultant opgestel nie" });

    const een = await portaal_admin({ aksie: "een", no: String(invoer.no || "") });
    const reg = een && een.registrasie;
    if (!reg || reg.konsultant !== konsultant.kode) return antwoord(404, { fout: "Onbekende registrasie" });
    if (reg.toets) return antwoord(409, { fout: "Toetsregistrasie: geen faktuur nie" });

    const klient_id = reg.klient && reg.klient.nommer;
    if (!klient_id) {
      return antwoord(409, { fout: "Die rekeningpligtige is nog nie in die kliënteregister nie. Probeer later weer." });
    }
    const klient = await kry_kliente_store().get(klient_id, { type: "json" });
    if (!klient) return antwoord(409, { fout: "Die kliënt is nie in die register gevind nie" });

    let huidig = null;
    try {
      huidig = (await portaal_admin({ aksie: "instellings" })).pryse;
    } catch (fout) {
      console.warn("konsultant-konsep-faktuur: kon nie die koste lees nie:", fout.message);
    }
    const pryse = pryse_vir(reg, huidig);
    if (!pryse) return antwoord(409, { fout: "Geen bedrae gevind nie. Laat weet Dorrithé of Ignatius." });

    const taal = reg.vorm_taal === "en" ? "en" : "af";
    const agter = ": " + reg.leerder.naam + " " + reg.leerder.van + " (" + reg.no + ")";
    const reels = [];
    if (eerste) {
      reels.push(reel(REEL[taal].kons + agter, pryse.kons, 1, "kons"));
      if (pryse.vrae > 0) reels.push(reel(REEL[taal].vrae + agter, pryse.vrae, 1, "vrae"));
    }
    if (opvolg) reels.push(reel(REEL[taal].opvolg + agter, pryse.kons, opvolg, "kons"));

    const wie = konsultant.epos;
    const rekord = nuwe_faktuur(wie);
    voeg_geskiedenis_by(rekord, "konsep geskep", wie, `Deur konsultant ${konsultant.naam} vir ${reg.no}`);
    rekord.taal = taal;
    rekord.klient_id = klient_id;
    rekord.klient = {
      naam: klient.naam || "",
      kontakpersoon: klient.kontak || "",
      epos: klient.epos || "",
      selfoon: klient.selfoon || "",
      adres: klient.adres || "",
    };
    stel_verdeling(rekord, reels, konsultant.naam);
    reels.forEach((r) => delete r._soort);
    rekord.reels = reels;
    rekord.totaal_sent = reels.reduce((s, r) => s + r.bedrag_sent, 0);
    rekord.bygewerk_op = new Date().toISOString();

    const sleutel = skep_konsep_sleutel();
    await kry_fakture_store().setJSON(sleutel, rekord);

    return antwoord(200, {
      sleutel,
      no: reg.no,
      leerder: reg.leerder.naam + " " + reg.leerder.van,
      rekeningpligtige: klient.naam || "",
      totaal_sent: rekord.totaal_sent,
      eerste,
      opvolg,
    });
  } catch (fout) {
    console.error("konsultant-konsep-faktuur:", fout);
    return antwoord(fout.status && fout.status < 500 ? fout.status : 502, { fout: fout.message || "Kon nie die konsep skep nie" });
  }
};
