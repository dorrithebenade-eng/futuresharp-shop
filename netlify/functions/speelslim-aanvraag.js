// netlify/functions/speelslim-aanvraag.js
//
// Die ontvangspunt vir Speel-Slim-aanvrae van FSF se Apps Script. Sien die
// dokument "Speel-Slim koppelvlak" (FSI, goedgekeur 24 Oktober 2026) en
// _speelslim.js.
//
// GEEN AANMELDING NIE, WEL 'N GEHEIM. FSF se Apps Script is nie 'n gebruiker
// nie; die gedeelde sleutel (SPEELSLIM_GEHEIM) is die poort. Sonder dit: 401.
//
// WAT GEBEUR:
//   1. Die aanvraag word skoongemaak (_speelslim.js se skoon_aanvraag).
//   2. Is die verslagkode reeds verwerk, kry FSF dieselfde antwoord en niks
//      gebeur weer nie. FSF probeer tot drie keer weer as 'n oproep misluk.
//   3. Die kliënt word op e-pos gevind of as privaat kliënt geskep.
//   4. Die kwotasie word dadelik uitgereik: nommer, publieke skakel, en
//      GEEN VERVALDATUM NIE (besluit: kwotasies verval nie vanself nie;
//      Dorrithé of Ignatius kanselleer self).
//   5. Die kwotasie word aan die aanvraer gepos, uit admin@.
//   6. FSF word teruggeroep met "Kwotasie gestuur" en die kwotasienommer.
//
// DIE TOETSMERK. 'n Aanvraag met toets: true kry die toetsstempel op die
// kwotasie, die faktuur wat daaruit kom en die kliënt. Skrap-toetse ruim dit
// op, en die staat en joernaal tel dit nie as werklike sake nie. Die pos gaan
// steeds uit, na die toetsry se eie toetsadres, sodat die hele pad getoets
// kan word.
//
// LIGGAAM (JSON):
//   geheim        die gedeelde sleutel (of die kopreël X-Speelslim-Geheim)
//   verslagkode   VS-XXXXXX
//   naam          die aanvraer se naam
//   epos          die aanvraer se e-posadres
//   taal          "af" | "en"
//   boeke         [4] of [3, 4]   (een aanvraag kan oor meer as een boek gaan)
//   getal_kodes   1 vir 'n enkelverslag; 2 of meer vir 'n gesamentlike
//   soort         "enkel" | "gesamentlik"
//   toets         true | false
//
// ANTWOORD: 200 { ok, verslagkode, kwotasienommer, totaal_sent, herhaal }

const { kry_store } = require("./_blob-store");
const {
  kry_instelling,
  los_ontvangers_op,
  skoon_aanvraag,
  bou_reels,
  kry_aanvrae_store,
  geheim_klop,
  stuur_terugroep,
} = require("./_speelslim");
const {
  kry_kwotasies_store,
  skep_nommer,
  sleutel_na_nommer,
  skep_publieke_kode,
  nuwe_kwotasie,
  voeg_geskiedenis_by,
} = require("./_kwotasies");
const { kry_kliente_store, skoon_epos, skep_nommer: skep_klientnommer, nuwe_klient } = require("./_kliente");
const { stuur_kwotasie_pos } = require("./uitreik-kwotasie");
const { fs_bereken, fs_invoer_uit_faktuur } = require("../../public/js/faktuur-som.js");

// 'n Aanvraag wat hierdie lank op "besig" staan, het halfpad gesterf (die
// Function se tydslimiet is tien sekondes). 'n Herhaling mag dan weer begin.
const BESIG_VERVAL_MS = 2 * 60 * 1000;

function antwoord(kode, liggaam) {
  return {
    statusCode: kode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(liggaam),
  };
}

// Die kliënt op e-pos. 'n Ouer wat vir twee kinders 'n verslag aanvra, is
// een kliënt, nie twee nie.
async function vind_of_skep_klient(aanvraag) {
  const store = kry_kliente_store();
  const epos = skoon_epos(aanvraag.epos);

  try {
    const lys = await store.list({ prefix: "K" });
    for (const { key } of lys.blobs || []) {
      const k = await store.get(key, { type: "json" });
      if (k && skoon_epos(k.epos) === epos) return { sleutel: key, klient: k };
    }
  } catch (fout) {
    console.error("Speel-Slim: kon nie die kliënte deursoek nie:", fout);
    throw fout;
  }

  const klient = nuwe_klient("speelslim");
  klient.soort = "privaat";
  klient.naam = aanvraag.naam;
  klient.epos = epos;
  if (aanvraag.toets) klient.toets = true;
  klient.nommer = await skep_klientnommer(store);
  klient.geskiedenis.push({
    handeling: "geskep",
    wie: "speelslim",
    nota: `Uit Speel-Slim-aanvraag ${aanvraag.verslagkode}`,
    op: new Date().toISOString(),
  });
  await store.setJSON(klient.nommer, klient);
  return { sleutel: klient.nommer, klient };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return antwoord(405, { ok: false, fout: "Metode nie toegelaat nie" });
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return antwoord(400, { ok: false, fout: "Ongeldige JSON" });
  }

  const kop = event.headers || {};
  const geheim = invoer.geheim || kop["x-speelslim-geheim"] || kop["X-Speelslim-Geheim"];
  if (!geheim_klop(geheim)) {
    return antwoord(401, { ok: false, fout: "Geen toegang nie" });
  }

  const { aanvraag, fout: skoon_fout } = skoon_aanvraag(invoer);
  if (skoon_fout) return antwoord(400, { ok: false, fout: skoon_fout });

  const aanvrae = kry_aanvrae_store();
  const nou = new Date().toISOString();

  // ── Een keer per verslagkode ─────────────────────────────────────────────
  let bestaande = null;
  try {
    bestaande = await aanvrae.get(aanvraag.verslagkode, { type: "json" });
  } catch (fout) {
    console.error("Speel-Slim: kon nie die aanvrae lees nie:", fout);
    return antwoord(500, { ok: false, fout: "Kon nie die aanvraag nagaan nie" });
  }

  if (bestaande && bestaande.kwotasienommer) {
    // Die kwotasie bestaan reeds. Het die eerste terugroep misluk, probeer
    // ons hom weer, sodat FSF se status nie op Aangevra bly hang nie.
    // Het die pos die eerste keer misluk, probeer ons hom nou weer; eers as
    // hy uit is, hoor FSF "Kwotasie gestuur".
    if (bestaande.status === "Pos misluk" && bestaande.kwotasie_sleutel) {
      try {
        const kw = await kry_kwotasies_store().get(bestaande.kwotasie_sleutel, { type: "json" });
        if (kw && kw.stand === "uitgereik") {
          const pos = await stuur_kwotasie_pos(kw, bestaande.kwotasie_sleutel, kw.publieke_kode);
          if (pos && pos.ok) {
            bestaande.status = "Kwotasie uitgereik";
            bestaande.pos_fout = null;
            await aanvrae.setJSON(aanvraag.verslagkode, bestaande);
            await stuur_terugroep(aanvraag.verslagkode, "Kwotasie gestuur", {
              kwotasienommer: bestaande.kwotasienommer,
              toets: bestaande.toets === true,
            });
          }
        }
      } catch (fout) {
        console.error(`Speel-Slim: kon nie die pos vir ${aanvraag.verslagkode} weer stuur nie:`, fout);
      }
    }

    const laaste = (bestaande.terugroepe || []).slice(-1)[0];
    if (bestaande.status === "Kwotasie gestuur" && laaste && !laaste.ok) {
      await stuur_terugroep(aanvraag.verslagkode, "Kwotasie gestuur", {
        kwotasienommer: bestaande.kwotasienommer,
        toets: bestaande.toets === true,
      });
    }
    return antwoord(200, {
      ok: true,
      herhaal: true,
      verslagkode: aanvraag.verslagkode,
      kwotasienommer: bestaande.kwotasienommer,
      totaal_sent: bestaande.totaal_sent,
    });
  }

  if (bestaande && bestaande.besig_sedert &&
      Date.now() - new Date(bestaande.besig_sedert).getTime() < BESIG_VERVAL_MS) {
    return antwoord(409, { ok: false, fout: "Hierdie aanvraag word reeds verwerk. Probeer later weer." });
  }

  // Merk as besig VOOR enigiets geskep word, sodat 'n tweede oproep binne
  // sekondes nie 'n tweede kwotasie maak nie.
  const register = {
    verslagkode: aanvraag.verslagkode,
    ontvang_op: (bestaande && bestaande.ontvang_op) || nou,
    besig_sedert: nou,
    aanvraag: { ...aanvraag },
    toets: aanvraag.toets,
    kwotasie_sleutel: null,
    kwotasienommer: null,
    totaal_sent: null,
    status: "Ontvang",
    terugroepe: (bestaande && bestaande.terugroepe) || [],
  };
  try {
    await aanvrae.setJSON(aanvraag.verslagkode, register);
  } catch (fout) {
    console.error("Speel-Slim: kon nie die aanvraag aanteken nie:", fout);
    return antwoord(500, { ok: false, fout: "Kon nie die aanvraag aanteken nie" });
  }

  try {
    // ── Die kliënt ─────────────────────────────────────────────────────────
    const { sleutel: klient_id, klient } = await vind_of_skep_klient(aanvraag);

    // ── Die kwotasie ───────────────────────────────────────────────────────
    const instelling = await kry_instelling();
    const verdeling = await los_ontvangers_op(instelling);
    if (!verdeling.length) {
      console.warn("Speel-Slim: geen ontvangers vir die verdeling gevind nie; alles bly in die hoofrekening.");
    }

    const store = kry_kwotasies_store();
    const rekord = nuwe_kwotasie("speelslim");
    rekord.taal = aanvraag.taal;
    rekord.klient_id = klient_id;
    rekord.klient = {
      naam: klient.naam || aanvraag.naam,
      kontakpersoon: "",
      epos: klient.epos || aanvraag.epos,
      selfoon: klient.selfoon || "",
      adres: klient.adres || "",
    };
    // Die verslagkode is die verwysing op die kwotasie en die faktuur.
    rekord.bestelnommer = aanvraag.verslagkode;
    rekord.reels = bou_reels(aanvraag, instelling, verdeling);
    rekord.projek_id = String(instelling.projek_id || "");
    const reelsom = rekord.reels.reduce((s, r) => s + (r.bedrag_sent || 0), 0);
    rekord.totaal_sent = reelsom;

    // Die verdeling moet haarself kan dra, presies soos by uitreik-kwotasie.js.
    const som = fs_bereken(fs_invoer_uit_faktuur(rekord, () => false));
    if (som.oorbestee) {
      throw new Error("Die Speel-Slim-verdeling vra meer as wat die kwotasie inbring. Kyk na die prystabel en die verdeling.");
    }

    rekord.speelslim = {
      verslagkode: aanvraag.verslagkode,
      boeke: aanvraag.boeke,
      getal_kodes: aanvraag.getal_kodes,
      soort: aanvraag.soort,
      toets: aanvraag.toets,
    };
    if (aanvraag.toets) rekord.toets = true;

    // GEEN VERVALDATUM. is_verval() gee false wanneer geldig_tot leeg is.
    rekord.geldig_tot = null;

    const kw_sleutel = await skep_nommer(store);
    const nommer = sleutel_na_nommer(kw_sleutel);
    rekord.nommer = nommer;
    rekord.stand = "uitgereik";
    rekord.uitgereik_op = nou;
    rekord.dokument_datum = nou;
    rekord.bygewerk_op = nou;
    rekord.publieke_kode = skep_publieke_kode();
    voeg_geskiedenis_by(
      rekord,
      "uitgereik",
      "speelslim",
      `${nommer} outomaties uit Speel-Slim-aanvraag ${aanvraag.verslagkode}`
    );

    await store.setJSON(kw_sleutel, rekord);

    register.kwotasie_sleutel = kw_sleutel;
    register.kwotasienommer = nommer;
    register.totaal_sent = rekord.totaal_sent;
    register.besig_sedert = null;
    register.status = "Kwotasie uitgereik";
    await aanvrae.setJSON(aanvraag.verslagkode, register);

    // ── Die pos ────────────────────────────────────────────────────────────
    const pos = await stuur_kwotasie_pos(rekord, kw_sleutel, rekord.publieke_kode);
    if (!pos || !pos.ok) {
      // Die kwotasie staan; net die pos het misluk. Sy is in die paneel
      // sigbaar en kan van daar weer gestuur word. FSF hoor eers
      // "Kwotasie gestuur" wanneer die pos werklik uit is.
      console.error(`Speel-Slim: kwotasie ${nommer} is uitgereik maar die pos het misluk:`, pos && pos.fout);
      register.status = "Pos misluk";
      register.pos_fout = (pos && pos.fout) || "onbekend";
      await aanvrae.setJSON(aanvraag.verslagkode, register);
      return antwoord(200, {
        ok: true,
        verslagkode: aanvraag.verslagkode,
        kwotasienommer: nommer,
        totaal_sent: rekord.totaal_sent,
        pos_gestuur: false,
      });
    }

    // ── Die terugroep ──────────────────────────────────────────────────────
    await stuur_terugroep(aanvraag.verslagkode, "Kwotasie gestuur", {
      kwotasienommer: nommer,
      toets: aanvraag.toets,
    });

    return antwoord(200, {
      ok: true,
      verslagkode: aanvraag.verslagkode,
      kwotasienommer: nommer,
      totaal_sent: rekord.totaal_sent,
      pos_gestuur: true,
    });
  } catch (fout) {
    console.error(`Speel-Slim: aanvraag ${aanvraag.verslagkode} het misluk:`, fout);
    // Laat die besig-merk val sodat FSF se volgende poging weer kan begin.
    try {
      register.besig_sedert = null;
      register.status = "Fout";
      register.fout = String((fout && fout.message) || fout);
      await aanvrae.setJSON(aanvraag.verslagkode, register);
    } catch { /* niks meer om te doen nie */ }
    return antwoord(500, { ok: false, fout: "Kon nie die aanvraag verwerk nie" });
  }
};
