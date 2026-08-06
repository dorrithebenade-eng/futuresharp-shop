// netlify/functions/kry-my-indienings.js
//
// Gee die aangemelde outeur se indienings terug — sy lys, en op versoek een
// volledige vorm.
//
// TWEE MODUSSE:
//   sonder ?nommer=  — die lys, met net genoeg per rekord om 'n kaart te
//                      teken. Nie die volle vormdata nie; dit is agt dele
//                      per boek en die lys het dit nie nodig nie.
//   met ?nommer=     — een rekord, volledig, sodat die vorm gevul kan word.
//
// SLEGS SY EIE. Die filter is outeur_id, nie e-pos nie — 'n e-pos kan
// verander sonder dat die eienaarskap verander.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_outeur } = require("./_my-outeur");
const { kry_indienings_store, is_myne } = require("./_indienings");

// Genoeg om 'n kaart te teken: die titel, die stand, wanneer laas geraak.
function opsomming(rekord) {
  const data = rekord.data || {};
  return {
    nommer: rekord.nommer,
    titel: String(data.titel || "").trim(),
    stand: rekord.stand,
    het_hangende_wysiging: Boolean(rekord.hangend),
    opmerking: rekord.opmerking || "",
    produk_id: rekord.produk_id || null,
    geskep_op: rekord.geskep_op || null,
    gewysig_op: rekord.gewysig_op || null,
  };
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  const outeur = await kry_my_outeur(gebruiker);
  if (!outeur) {
    return { statusCode: 403, body: "Hierdie rekening is nie as 'n outeur geregistreer nie" };
  }

  const store = kry_indienings_store();
  const gevra = (event.queryStringParameters || {}).nommer;

  // --- Een volledige vorm ---
  if (gevra) {
    let rekord;
    try {
      rekord = await store.get(gevra, { type: "json" });
    } catch (fout) {
      console.error("Kon nie die indiening lees nie:", fout);
      return { statusCode: 500, body: "Kon nie die vorm lees nie" };
    }

    if (!rekord) {
      return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
    }
    // Dieselfde antwoord vir "bestaan nie" en "nie joune nie" sou netjieser
    // wees, maar 404 hier sou 'n outeur laat dink sy eie vorm is weg. Die
    // lys wys in elk geval net syne, dus kom hierdie geval nie normaalweg
    // voor nie.
    if (!is_myne(rekord, outeur)) {
      return { statusCode: 403, body: "Hierdie vorm behoort nie aan hierdie rekening nie" };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...opsomming(rekord),
        data: rekord.data || {},
        hangend: rekord.hangend || null,
        geskiedenis: rekord.geskiedenis || [],
      }),
    };
  }

  // --- Die lys ---
  let sleutels;
  try {
    const lys = await store.list();
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die indienings lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die lys lees nie" };
  }

  const rekords = (
    await Promise.all(
      sleutels.map((sleutel) => store.get(sleutel, { type: "json" }).catch(() => null))
    )
  ).filter((r) => is_myne(r, outeur));

  // Nuutste eerste. Die skerm groepeer self volgens stand.
  rekords.sort((a, b) => String(b.gewysig_op || "").localeCompare(String(a.gewysig_op || "")));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ indienings: rekords.map(opsomming) }),
  };
};
