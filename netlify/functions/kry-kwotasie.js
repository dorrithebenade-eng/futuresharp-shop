// netlify/functions/kry-kwotasie.js
//
// Een kwotasie, volledig. Rol: boekhouding.
//
// kry-kwotasies.js gee die LYS met net genoeg per rekord om 'n ry te teken.
// Hierdie een gee die hele kwotasie, sodat 'n konsep weer oopgemaak kan word
// nadat die blad toegemaak is.
//
// DIE ANTWOORD WORD VELD VIR VELD GEBOU, EN DIT IS DIE PLEK WAAR DIT STILWEG
// VERKEERD GAAN. Op 27 Augustus 2026 is presies hierdie fout in
// kry-faktuur.js gevind: `op_faktuur`, `hosting_pct` en `verdeling` het by
// elke reël uitgeval toe die verdeling na die lynitems geskuif het. Die
// gevolg was nie 'n leë skerm nie — dit was DATAVERLIES. Die vorm lees al
// drie velde, val terug op `[]`, `0` en `true`, en die outomatiese stoor
// stuur daardie terugvalle terug. 'n Heropende konsep het sy verdeling
// verloor terwyl die skerm reg gelyk het.
//
// Kom daar 'n veld by nuwe_kwotasie(), kom hy ook HIER by.
//
// Waarom nie eenvoudig die hele rekord teruggee nie: dan gaan alles wat later
// bykom vanself uit, ook wat nie op 'n skerm hoort nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_kwotasies_store,
  is_konsep_sleutel,
  nommer_na_sleutel,
  vertoon_stand,
  kan_aanvaar,
} = require("./_kwotasies");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const vraag = event.queryStringParameters || {};
  const gevra = String(vraag.sleutel || "").trim();
  const nommer = String(vraag.nommer || "").trim();

  // TWEE MANIERE OM TE VRA, want 'n kwotasie het twee identiteite in sy lewe.
  // 'n Konsep het net 'n sleutel; ná uitreiking is die NOMMER wat 'n mens in
  // die hand het.
  let sleutel = null;
  if (gevra) {
    if (!is_konsep_sleutel(gevra)) {
      return { statusCode: 400, body: "Ongeldige sleutel" };
    }
    sleutel = gevra;
  } else if (nommer) {
    sleutel = nommer_na_sleutel(nommer);
    if (!sleutel) return { statusCode: 400, body: "Ongeldige kwotasienommer" };
  } else {
    return { statusCode: 400, body: "Gee 'n sleutel of 'n nommer" };
  }

  let rekord;
  try {
    rekord = await kry_kwotasies_store().get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie kwotasie ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kwotasie laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Kwotasie nie gevind nie" };

  const klient = rekord.klient || {};
  const nou = new Date().toISOString();

  const kwotasie = {
    sleutel,
    nommer: rekord.nommer || null,

    // Sien kry-kwotasies.js: `stand` is wat op die rekord staan en wat 'n
    // skryf-Function toets; `vertoon_stand` is wat die skerm wys en dra
    // "verval", wat bereken word en nooit gestoor nie.
    stand: rekord.stand || "konsep",
    vertoon_stand: vertoon_stand(rekord, nou),
    kan_aanvaar: kan_aanvaar(rekord, nou),

    geskep_op: rekord.geskep_op || null,
    bygewerk_op: rekord.bygewerk_op || null,
    geskep_deur: rekord.geskep_deur || "",
    uitgereik_op: rekord.uitgereik_op || null,
    dokument_datum: rekord.dokument_datum || null,
    geldig_tot: rekord.geldig_tot || null,

    // Die DOKUMENT se taal, per kwotasie. Die skerm lees daarmee met
    // t_in(sleutel, kwotasie.taal), nooit met t() nie — t() gee die platform
    // se taal, wat 'n heel ander bron is.
    taal: rekord.taal || "af",

    klient_id: rekord.klient_id || null,
    klient: {
      naam: klient.naam || "",
      kontakpersoon: klient.kontakpersoon || "",
      epos: klient.epos || "",
      selfoon: klient.selfoon || "",
      adres: klient.adres || "",
    },
    // Die afdeling binne die instansie. Die antwoord word veld vir veld
    // gebou; sonder hierdie reel bereik hy nooit die skerm nie.
    afdeling: rekord.afdeling || "",
    bestelnommer: rekord.bestelnommer || "",

    // ELKE REEL DRA SY EIE VERDELING, SY EIE HOSTING EN SY EIE `vou_in`.
    // Sien die waarskuwing bo-aan hierdie lêer.
    reels: Array.isArray(rekord.reels)
      ? rekord.reels.map((r) => ({
          soort: r.soort || "verkoop",
          beskrywing: r.beskrywing || "",
          hoeveelheid: r.hoeveelheid || 0,
          prys_pp_sent: r.prys_pp_sent || 0,
          bedrag_sent: r.bedrag_sent || 0,
          // Ontbreek die veld, staan die reel op haar eie -- die veilige
          // rigting. Sien stoor-faktuur.js.
          vou_in: r.vou_in === true,

          // GEEN `|| 5`-TERUGVAL NIE. 'n Doelbewuste nul moet die rondreis
          // oorleef: op 'n kostereël beteken nul dat hosting nie gehef word
          // nie. Hosting wat stilweg verskyn, vat geld by 'n begunstigde weg.
          hosting_pct: Number.isFinite(Number(r.hosting_pct)) ? Number(r.hosting_pct) : 0,

          // Sien kry-faktuur.js: veld vir veld gebou, dus moet hy hier staan.
          kategorie_id: r.kategorie_id || "",

          verdeling: Array.isArray(r.verdeling)
            ? r.verdeling.map((v) => ({
                ontvanger: v.ontvanger || "",
                tipe: v.tipe || "pct",
                waarde: v.waarde || 0,
              }))
            : [],
        }))
      : [],

    dokument_nota: rekord.dokument_nota || "",

    // Die begroting. Sy verskyn NÊRENS op die dokument nie — sy is die
    // maatstaf waarmee 'n mens vra of die aangebode prys genoeg is.
    koste: Array.isArray(rekord.koste)
      ? rekord.koste.map((k) => ({
          beskrywing: k.beskrywing || "",
          ontvanger: k.ontvanger || "",
          bedrag_sent: k.bedrag_sent || 0,
          inskrywing: k.inskrywing || "",
        }))
      : [],

    afslag_sent: rekord.afslag_sent || 0,
    koepon_kode: rekord.koepon_kode || null,
    skenking_sent: rekord.skenking_sent || 0,
    totaal_sent: rekord.totaal_sent || 0,

    btw_koers: rekord.btw_koers || 0,
    btw_bedrag_sent: rekord.btw_bedrag_sent || 0,

    // DIE HERSIENINGS. Die lys dra die VORIGE aanbodde as momentopnames van
    // wat die kliënt gesien het. Die verdeling staan doelbewus nie daarin
    // nie: sy is backoffice en het nooit uitgegaan nie.
    hersiening: rekord.hersiening || 1,
    hersienings: Array.isArray(rekord.hersienings)
      ? rekord.hersienings.map((h) => ({
          nommer: h.nommer || 0,
          uitgereik_op: h.uitgereik_op || null,
          geldig_tot: h.geldig_tot || null,
          totaal_sent: h.totaal_sent || 0,
          vervang_op: h.vervang_op || null,
          vervang_deur: h.vervang_deur || "",
        }))
      : [],

    // Wat by aanvaarding gebeur het. Albei rekords bly bestaan: die kwotasie
    // is die bewys van wat aanvaar is, die faktuur is wat betaal word.
    aanvaar_op: rekord.aanvaar_op || null,
    aanvaar_deur_naam: rekord.aanvaar_deur_naam || "",
    aanvaar_deur_epos: rekord.aanvaar_deur_epos || "",
    faktuur_sleutel: rekord.faktuur_sleutel || null,
    faktuur_nommer: rekord.faktuur_nommer || null,
    aanvaarde_hersiening: rekord.aanvaarde_hersiening || null,

    verwerp_op: rekord.verwerp_op || null,
    verwerp_deur: rekord.verwerp_deur || null,
    verwerp_rede: rekord.verwerp_rede || null,

    // Die skakel wat die kliënt kry. 'n Konsep het nog geen een nie. Die kode
    // self is die bewys dat die persoon die skakel ontvang het; hy word hier
    // aan die PANEEL gegee sodat die skerm die skakel kan wys om te deel.
    publieke_kode: rekord.publieke_kode || null,

    toets: rekord.toets === true,

    // Nuutste eerste. By 'n oop vorm is die vraag byna altyd "wat het laas
    // gebeur?", nie "hoe het dit begin nie".
    geskiedenis: Array.isArray(rekord.geskiedenis)
      ? rekord.geskiedenis.slice().reverse()
      : [],
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kwotasie }),
  };
};
