// netlify/functions/kry-indienings.js
//
// Die personeel se aansig op die indienings — die lys, en een volledige
// vorm met ?nommer=.
//
// TEENOOR kry-my-indienings.js: daardie een gee 'n outeur SY eie rekords en
// filter op outeur_id. Hierdie een vereis die personeel-rol en gee almal
// s'n. Twee Functions eerder as een met 'n vertakking, want die verkeerde
// vertakking in een lêer beteken 'n outeur sien 'n ander se werk.
//
// DIE LYS DRA ALLES WAT DIE SKERM NODIG HET om te besluit wat aandag verg:
// die stand, die titel, die outeur se naam, en of daar lêers is. Nie die
// agt dele se data nie — dit kom eers wanneer sy een oopmaak.
//
// LET WEL: hierdie Function bou sy antwoord VELD VIR VELD. 'n Nuwe veld op
// die rekord kom NIE vanself hier deur nie. Dit het reeds een keer gebeur
// met `leers` in kry-my-indienings.js.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_indienings_store } = require("./_indienings");

function opsomming(rekord) {
  const data = rekord.data || {};
  const leers = rekord.leers || {};
  return {
    nommer: rekord.nommer,
    titel: String(data.titel || "").trim(),
    stand: rekord.stand,
    outeur_naam: rekord.outeur_naam || "",
    outeur_id: rekord.outeur_id || null,
    het_hangende_wysiging: Boolean(rekord.hangend),
    opmerking: rekord.opmerking || "",
    produk_id: rekord.produk_id || null,
    // Ná goedkeuring: waar die lêers in die katalogus se stores beland het.
    // Hierdie Function bou veld vir veld — 'n nuwe veld kom NIE vanself deur
    // nie, en dit is presies hoe `leers` een keer verlore geraak het.
    eboek_sleutel: rekord.eboek_sleutel || null,
    omslag: rekord.omslag || null,
    goedgekeur_op: rekord.goedgekeur_op || null,
    het_manuskrip: Boolean(leers.manuskrip),
    het_omslag: Boolean(leers.omslag),
    geskep_op: rekord.geskep_op || null,
    gewysig_op: rekord.gewysig_op || null,
    ingedien_op: rekord.ingedien_op || null,
  };
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...opsomming(rekord),
        data: rekord.data || {},
        hangend: rekord.hangend || null,
        leers: rekord.leers || null,
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

  // Die tydelike oplaai-sleutels leef in 'n ander store, maar 'n filter op
  // die vormnommer se vorm hou enigiets anders ook buite.
  const rekords = (
    await Promise.all(
      sleutels
        .filter((s) => /^BV-\d{4}-\d{4}$/.test(s))
        .map((sleutel) => store.get(sleutel, { type: "json" }).catch(() => null))
    )
  ).filter(Boolean);

  // Wat ingedien is, kom eerste — dit is wat aandag verg. Binne 'n groep
  // die oudste eerste, want wie langste wag, wag die langste.
  const rang = { ingedien: 0, wysiging: 1, op_rak: 2, konsep: 3 };
  rekords.sort((a, b) => {
    const verskil = (rang[a.stand] ?? 9) - (rang[b.stand] ?? 9);
    if (verskil !== 0) return verskil;
    return String(a.ingedien_op || a.gewysig_op || "").localeCompare(
      String(b.ingedien_op || b.gewysig_op || "")
    );
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ indienings: rekords.map(opsomming) }),
  };
};
