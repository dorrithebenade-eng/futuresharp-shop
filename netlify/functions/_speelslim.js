// netlify/functions/_speelslim.js
//
// Speel-Slim-terugvoerverslae: Future Shop se deel van die goedgekeurde
// koppelvlak (dokument "Speel-Slim koppelvlak", FSI, 24 Oktober 2026).
//
//   FSF se Apps Script  --aanvraag-->  speelslim-aanvraag.js  (hierdie stelsel)
//   hierdie stelsel     --terugroep-->  FSF se Apps Script, drie keer:
//                         "Kwotasie gestuur", "Betaal", "Gekanselleer"
//
// FUTURE SHOP SKRYF NOOIT SELF IN DIE SHEET NIE. Net FSF se Apps Script skryf
// in SpeelSlim_Aanvrae; ons roep hom terug en hy skryf die status.
//
// DIE VERSLAGKODE (VS-XXXXXX) IS DIE SLEUTEL. Elke verslagkode kry hoogstens
// een kwotasie. FSF probeer tot drie keer weer as 'n oproep misluk, dus kan
// dieselfde aanvraag meer as een keer kom; die tweede keer kry dieselfde
// antwoord sonder dat iets weer gebeur.
//
// GEEN ANTWOORDE UIT DIE VRAELYSTE KOM HIER NIE. Net wat op 'n kwotasie en
// faktuur hoort: naam, e-pos, taal, boek(e), getal kodes en soort verslag.
//
// OMGEWINGSVERANDERLIKES (in Netlify, nooit in kode of in die Stand van sake):
//   SPEELSLIM_GEHEIM      die gedeelde geheime sleutel met FSF, albei rigtings
//   SPEELSLIM_FSF_URL     die Apps Script se /exec-adres vir die terugroepe

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");

const AANVRAE_STORE = "speelslim-aanvrae";
const INSTELLING_SLEUTEL = "speelslim";

// ─────────────────────────────────────────────────────────────────────────
// DIE PRYSTABEL EN DIE VERDELING
//
// Besluit van Dorrithé en Ignatius (24 Oktober 2026): R350 vir 'n hoofverslag,
// plus R100 vir elke vraelys wat by 'n gesamentlike verslag gevoeg word. Die
// Paystack-fooi kom eerste af; 5% van wat oorbly gaan na Future Sharp vir
// hosting; die res 50/50 tussen Dorrithé en Ignatius.
//
// 50/50 VAN DIE RES IS 47,45% ELK VAN DIE VERDEELBARE (sien die buffer in
// los_ontvangers_op). faktuur-som.js laat
// elke persentasie op dieselfde verdeelbare bedrag loop (ná die fooi). Hosting
// 5 + 47,45 + 47,45 = 99,9. Sou daar 50 + 50 staan, vra die verdeling 105% en
// keer die som dit as oorbestee.
//
// DIE INSTELLING IN DIE STORE WEN. Hierdie verstek geld net tot iemand die
// prystabel in die paneel stoor; dan lees kry_instelling() daardie rekord.
function verstek_instelling() {
  return {
    hoof_sent: 35000,
    ekstra_sent: 10000,
    hosting_pct: 5,
    // Die ontvangers soos hulle in die begunstigde-register heet. Leeg
    // beteken: soek hulle op naam (sien los_ontvangers_op).
    verdeling: [],
    kategorie_id: "",
    projek_id: "",
  };
}

async function kry_instelling() {
  const verstek = verstek_instelling();
  try {
    const gestoor = await kry_store("instellings").get(INSTELLING_SLEUTEL, { type: "json" });
    if (gestoor && typeof gestoor === "object") return { ...verstek, ...gestoor };
  } catch (fout) {
    console.error("Speel-Slim: kon nie die instelling lees nie:", fout);
  }
  return verstek;
}

// Die verstekverdeling: Dorrithé en Ignatius, elk die helfte van wat ná
// hosting oorbly. Hulle NAME kom uit die begunstigde-register, want die
// verdeling kyk by uitreiking op naam vir die subrekening (sien
// _faktuur-uitreik.js). 'n Naam wat nie presies pas nie, kry geen subrekening
// en sy geld bly in die hoofrekening.
async function los_ontvangers_op(instelling) {
  const hosting = Number(instelling.hosting_pct) || 0;
  if (Array.isArray(instelling.verdeling) && instelling.verdeling.length) {
    return instelling.verdeling;
  }

  let begunstigdes = [];
  try {
    const store = kry_store("begunstigdes");
    const lys = await store.list();
    begunstigdes = (
      await Promise.all((lys.blobs || []).map((b) => store.get(b.key, { type: "json" })))
    ).filter(Boolean);
  } catch (fout) {
    console.error("Speel-Slim: kon nie die begunstigdes lees nie:", fout);
  }

  const vind = (patroon) => {
    const b = begunstigdes.find((x) => x && x.naam && patroon.test(String(x.naam)));
    return b ? String(b.naam).trim() : null;
  };
  const name = [vind(/dorrith/i), vind(/ignatius/i)].filter(Boolean);
  if (!name.length) return [];

  // 'N KLEIN BUFFER VAN 0,1%. Presies 100% (5 + 47,5 + 47,5) loop by sommige
  // bedrae een sent oor weens afronding, en dan keer die som die kwotasie as
  // oorbestee (byvoorbeeld R350 + 2 x R100). 0,05% minder elk laat sowat 35c
  // op R350 in die hoofrekening, saam met hosting.
  const elk = Math.floor(((100 - hosting) / name.length - 0.05) * 100) / 100;
  return name.map((ontvanger) => ({ ontvanger, tipe: "pct", waarde: elk }));
}

// ─────────────────────────────────────────────────────────────────────────
// DIE AANVRAAG SKOONMAAK

const EPOS_PATROON = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VERSLAGKODE_PATROON = /^VS-[A-Z0-9]{4,12}$/;

function teks(waarde, maks) {
  const t = String(waarde == null ? "" : waarde).trim();
  return maks ? t.slice(0, maks) : t;
}

// Gee { aanvraag } of { fout } terug. Niks word stilweg reggemaak wat 'n
// bedrag sou verander nie: 'n getal kodes wat nie klop nie, is 'n fout.
function skoon_aanvraag(invoer) {
  const v = invoer || {};
  const verslagkode = teks(v.verslagkode, 20).toUpperCase();
  if (!VERSLAGKODE_PATROON.test(verslagkode)) return { fout: "Ongeldige verslagkode" };

  const naam = teks(v.naam, 120);
  if (!naam) return { fout: "Die aanvraer se naam ontbreek" };

  const epos = teks(v.epos, 200).toLowerCase();
  if (!EPOS_PATROON.test(epos)) return { fout: "Ongeldige e-posadres" };

  const taal = v.taal === "en" ? "en" : v.taal === "af" ? "af" : null;
  if (!taal) return { fout: "Taal moet af of en wees" };

  const boeke = [...new Set((Array.isArray(v.boeke) ? v.boeke : [v.boeke])
    .map((b) => Number(b))
    .filter((b) => Number.isInteger(b) && b >= 1 && b <= 6))].sort((a, b) => a - b);
  if (!boeke.length) return { fout: "Geen geldige boek (1 tot 6) nie" };

  const getal_kodes = Number(v.getal_kodes);
  if (!Number.isInteger(getal_kodes) || getal_kodes < 1 || getal_kodes > 30) {
    return { fout: "Ongeldige getal kodes" };
  }

  const soort = v.soort === "gesamentlik" ? "gesamentlik" : v.soort === "enkel" ? "enkel" : null;
  if (!soort) return { fout: "Soort moet enkel of gesamentlik wees" };
  if (soort === "enkel" && getal_kodes !== 1) {
    return { fout: "'n Enkelverslag het presies een kode" };
  }
  if (soort === "gesamentlik" && getal_kodes < 2) {
    return { fout: "'n Gesamentlike verslag het ten minste twee kodes" };
  }

  return {
    aanvraag: {
      verslagkode,
      naam,
      epos,
      taal,
      boeke,
      getal_kodes,
      soort,
      toets: v.toets === true || v.toets === "true" || v.toets === 1,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// DIE REELS
//
// Die naam soos FSI dit vasgestel het: "Speel-Slim Boek [N]:
// Future Sharp-terugvoerverslag", by 'n gesamentlike verslag
// "Gesamentlike Future Sharp-terugvoerverslag". Engels: Play-Smart Book [N]:
// Future Sharp Feedback Report / Joint Future Sharp Feedback Report.
//
// TWEE REELS, NIE EEN NIE. Die hoofverslag en die bykomende vraelyste staan
// apart sodat die prys op die dokument verklaar word. Die tweede reël vou in
// by die eerste (vou_in), dus druk die dokument een bedrag.
function boeke_teks(boeke, en) {
  if (boeke.length === 1) return String(boeke[0]);
  const voor = boeke.slice(0, -1).join(", ");
  return `${voor} ${en ? "and" : "en"} ${boeke[boeke.length - 1]}`;
}

function bou_reels(aanvraag, instelling, verdeling) {
  const en = aanvraag.taal === "en";
  const reeks = en ? (aanvraag.boeke.length > 1 ? "Play-Smart Books" : "Play-Smart Book")
    : (aanvraag.boeke.length > 1 ? "Speel-Slim Boeke" : "Speel-Slim Boek");
  const gesamentlik = aanvraag.soort === "gesamentlik";
  const verslag = gesamentlik
    ? en ? "Joint Future Sharp Feedback Report" : "Gesamentlike Future Sharp-terugvoerverslag"
    : en ? "Future Sharp Feedback Report" : "Future Sharp-terugvoerverslag";
  const vraelyste = gesamentlik
    ? en ? ` (${aanvraag.getal_kodes} questionnaires)` : ` (${aanvraag.getal_kodes} vraelyste)`
    : "";

  const basis = {
    soort: "verkoop",
    hosting_pct: Number(instelling.hosting_pct) || 0,
    kategorie_id: teks(instelling.kategorie_id),
    verdeling: verdeling.map((v) => ({ ...v })),
  };

  const reels = [
    {
      ...basis,
      beskrywing: `${reeks} ${boeke_teks(aanvraag.boeke, en)}: ${verslag}${vraelyste}`,
      hoeveelheid: 1,
      prys_pp_sent: Number(instelling.hoof_sent) || 0,
      vou_in: false,
    },
  ];

  const ekstra = aanvraag.getal_kodes - 1;
  if (ekstra > 0) {
    reels.push({
      ...basis,
      verdeling: verdeling.map((v) => ({ ...v })),
      beskrywing: en
        ? `Additional questionnaire${ekstra > 1 ? "s" : ""} in the joint report`
        : `Bykomende vraely${ekstra > 1 ? "ste" : "s"} in die gesamentlike verslag`,
      hoeveelheid: ekstra,
      prys_pp_sent: Number(instelling.ekstra_sent) || 0,
      vou_in: true,
    });
  }

  // Die bedrag word hier gereken, soos stoor-kwotasie.js dit doen.
  reels.forEach((r) => {
    r.bedrag_sent = Math.round(r.hoeveelheid * r.prys_pp_sent);
  });

  return reels;
}

// ─────────────────────────────────────────────────────────────────────────
// DIE REGISTER VAN AANVRAE
//
// Een rekord per verslagkode. Dit is wat 'n herhaalde oproep herken, en dit
// is waar die terugroepe hul uitslag aanteken.

function kry_aanvrae_store() {
  return kry_store(AANVRAE_STORE);
}

// ─────────────────────────────────────────────────────────────────────────
// DIE GEHEIM
//
// Tydkonstante vergelyking, sodat 'n aanvaller nie die sleutel letter vir
// letter kan uitmeet nie.
function geheim_klop(gegee) {
  const verwag = String(process.env.SPEELSLIM_GEHEIM || "");
  const kry = String(gegee || "");
  if (!verwag || !kry) return false;
  const a = Buffer.from(verwag);
  const b = Buffer.from(kry);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─────────────────────────────────────────────────────────────────────────
// DIE TERUGROEPE NA FSF
//
// Apps Script se doPost() sien nie die versoek se kopreëls nie, dus gaan die
// geheim in die liggaam. Apps Script antwoord op 'n POST met 'n 302 na
// script.googleusercontent.com; fetch volg dit vanself.
//
// 'N TERUGROEP WAT MISLUK, BREEK NIKS IN DIE BOEKE NIE. Die kwotasie, die
// faktuur en die betaling staan reeds. Die uitslag word op die aanvraag
// aangeteken, en die paneel kan hom later weer stuur (stuur_terugroep met
// dieselfde status is veilig: FSF verwerk 'n verslagkode se status net een
// keer).
const STATUSSE = ["Kwotasie gestuur", "Betaal", "Gekanselleer"];

async function stuur_terugroep(verslagkode, status, ekstra) {
  if (!STATUSSE.includes(status)) return { ok: false, fout: `Onbekende status ${status}` };

  const url = String(process.env.SPEELSLIM_FSF_URL || "").trim();
  const geheim = String(process.env.SPEELSLIM_GEHEIM || "");
  const liggaam = {
    geheim,
    verslagkode,
    status,
    ...(ekstra || {}),
  };

  let uitslag;
  if (!url || !geheim) {
    uitslag = { ok: false, fout: "SPEELSLIM_FSF_URL of SPEELSLIM_GEHEIM ontbreek" };
  } else {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(liggaam),
        redirect: "follow",
        // Die webhook en die R0-tak wag hierop; 'n trae Apps Script mag nie
        // Netlify se tydsgrens laat oorskry nie.
        signal: AbortSignal.timeout(6000),
      });
      const t = await resp.text();
      let data = null;
      try { data = JSON.parse(t); } catch { data = null; }
      uitslag = resp.ok && (!data || data.ok !== false)
        ? { ok: true }
        : { ok: false, fout: `FSF antwoord ${resp.status}: ${t.slice(0, 200)}` };
    } catch (fout) {
      uitslag = { ok: false, fout: String((fout && fout.message) || fout) };
    }
  }

  if (!uitslag.ok) console.error(`Speel-Slim-terugroep ${status} vir ${verslagkode} het misluk:`, uitslag.fout);

  // Teken aan op die aanvraag. 'n Fout hier mag die terugroep self nie raak nie.
  try {
    const store = kry_aanvrae_store();
    const rekord = await store.get(verslagkode, { type: "json" });
    if (rekord) {
      if (!Array.isArray(rekord.terugroepe)) rekord.terugroepe = [];
      rekord.terugroepe.push({
        status,
        op: new Date().toISOString(),
        ok: uitslag.ok,
        fout: uitslag.ok ? null : uitslag.fout,
      });
      rekord.status = status;
      await store.setJSON(verslagkode, rekord);
    }
  } catch (fout) {
    console.error(`Speel-Slim: kon nie die terugroep op ${verslagkode} aanteken nie:`, fout);
  }

  return uitslag;
}

// ─────────────────────────────────────────────────────────────────────────
// DIE HAAKPLEKKE
//
// Die drie plekke waar 'n faktuur betaal word (die webhook, die handmatige
// aantekening en die R0-tak by uitreiking) roep meld_faktuur_betaal() aan.
// Die kanselleer-knoppie op 'n kwotasie roep meld_kwotasie_gekanselleer().
// Albei doen niks as die dokument nie uit 'n Speel-Slim-aanvraag kom nie, en
// albei gooi nooit 'n fout nie.

function datum_jjjj_mm_dd(iso) {
  const d = String(iso || new Date().toISOString()).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.replace(/-/g, "/") : d;
}

async function meld_faktuur_betaal(faktuur) {
  try {
    if (!faktuur || !faktuur.uit_kwotasie) return null;
    const { nommer_na_sleutel, kry_kwotasies_store } = require("./_kwotasies");
    const sleutel = nommer_na_sleutel(faktuur.uit_kwotasie);
    if (!sleutel) return null;
    const kwotasie = await kry_kwotasies_store().get(sleutel, { type: "json" });
    const kode = kwotasie && kwotasie.speelslim && kwotasie.speelslim.verslagkode;
    if (!kode) return null;

    return await stuur_terugroep(kode, "Betaal", {
      kwotasienommer: kwotasie.nommer || "",
      faktuurnommer: faktuur.nommer || "",
      betaaldatum: datum_jjjj_mm_dd(faktuur.betaling && faktuur.betaling.ontvang_op),
      toets: kwotasie.speelslim.toets === true,
    });
  } catch (fout) {
    console.error("Speel-Slim: kon nie die betaling aan FSF meld nie:", fout);
    return null;
  }
}

async function meld_kwotasie_gekanselleer(kwotasie) {
  try {
    const kode = kwotasie && kwotasie.speelslim && kwotasie.speelslim.verslagkode;
    if (!kode) return null;
    return await stuur_terugroep(kode, "Gekanselleer", {
      kwotasienommer: kwotasie.nommer || "",
      toets: kwotasie.speelslim.toets === true,
    });
  } catch (fout) {
    console.error("Speel-Slim: kon nie die kansellasie aan FSF meld nie:", fout);
    return null;
  }
}

// Die name in die begunstigde-register, vir die keuselys op die Speel-Slim-blad
// en om 'n vaste verdeling na te gaan. Future Sharp self is nooit 'n
// begunstigde nie (sien kry-begunstigdes.js).
async function begunstigde_name() {
  try {
    const store = kry_store("begunstigdes");
    const lys = await store.list();
    const rekords = await Promise.all((lys.blobs || []).map((b) => store.get(b.key, { type: "json" })));
    return [...new Set(rekords.filter((r) => r && r.naam).map((r) => String(r.naam).trim()))]
      .sort((a, b) => a.localeCompare(b, "af"));
  } catch (fout) {
    console.error("Speel-Slim: kon nie die begunstigdes lees nie:", fout);
    return [];
  }
}

module.exports = {
  AANVRAE_STORE,
  begunstigde_name,
  INSTELLING_SLEUTEL,
  STATUSSE,
  verstek_instelling,
  kry_instelling,
  los_ontvangers_op,
  skoon_aanvraag,
  bou_reels,
  kry_aanvrae_store,
  geheim_klop,
  stuur_terugroep,
  meld_faktuur_betaal,
  meld_kwotasie_gekanselleer,
};
