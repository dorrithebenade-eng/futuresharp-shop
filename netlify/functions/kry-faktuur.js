// netlify/functions/kry-faktuur.js
//
// Een faktuur, volledig. Rol: boekhouding.
//
// kry-fakture.js gee die LYS met net genoeg per rekord om 'n ry te teken.
// Hierdie een gee die hele faktuur, sodat 'n konsep weer oopgemaak kan word
// nadat die blad toegemaak is — die reëls, die begroting, die verdeling en
// die twee datums.
//
// DIE ANTWOORD WORD VELD VIR VELD GEBOU, en dit is die plek waar dit stilweg
// verkeerd gaan: 'n nuwe veld op die rekord kom NIE vanself deur nie. Op
// 8 Augustus het `leers` in kry-indienings.js uitgeval, en die outeur se
// manuskrip het gelyk of hy weg is terwyl hy heeltyd korrek gestoor was.
// Kom daar 'n veld by nuwe_faktuur(), kom hy ook hier by.
//
// Waarom nie eenvoudig die hele rekord teruggee nie: dan gaan alles wat later
// bykom vanself uit, ook wat nie op 'n skerm hoort nie. Die `bron`-veld dra
// respondente se e-posadresse — ander mense se data. Dit kom hier NIE deur
// nie; die skerm wat dit nodig het, kry sy eie Function.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store, is_konsep_sleutel, nommer_na_sleutel } = require("./_fakture");

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

  // TWEE MANIERE OM TE VRA, want 'n faktuur het twee identiteite in sy lewe.
  // 'n Konsep het net 'n sleutel; ná uitreiking is die NOMMER wat 'n mens in
  // die hand het — dit staan op die dokument en in die bankverwysing.
  // nommer_na_sleutel() doen die `/`-na-`-`-omskakeling; niks buite
  // _fakture.js weet daarvan nie.
  let sleutel = null;
  if (gevra) {
    if (!is_konsep_sleutel(gevra)) {
      return { statusCode: 400, body: "Ongeldige sleutel" };
    }
    sleutel = gevra;
  } else if (nommer) {
    sleutel = nommer_na_sleutel(nommer);
    if (!sleutel) return { statusCode: 400, body: "Ongeldige faktuurnommer" };
  } else {
    return { statusCode: 400, body: "Gee 'n sleutel of 'n nommer" };
  }

  let rekord;
  try {
    rekord = await kry_fakture_store().get(sleutel, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die faktuur laai nie" };
  }
  if (!rekord) return { statusCode: 404, body: "Faktuur nie gevind nie" };

  const klient = rekord.klient || {};
  const betaling = rekord.betaling || {};
  const lewering = rekord.lewering || {};
  const paystack = rekord.paystack || {};

  const faktuur = {
    sleutel,
    nommer: rekord.nommer || null,
    stand: rekord.stand || "konsep",
    geskep_op: rekord.geskep_op || null,
    bygewerk_op: rekord.bygewerk_op || null,
    uitgereik_op: rekord.uitgereik_op || null,

    // Die DOKUMENT se taal, per faktuur. Die skerm lees daarmee met
    // t_in(sleutel, faktuur.taal), nooit met t() nie — t() gee die platform
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
    bestelnommer: rekord.bestelnommer || "",

    reels: Array.isArray(rekord.reels)
      ? rekord.reels.map((r) => ({
          soort: r.soort || "verkoop",
          beskrywing: r.beskrywing || "",
          hoeveelheid: r.hoeveelheid || 0,
          prys_pp_sent: r.prys_pp_sent || 0,
          bedrag_sent: r.bedrag_sent || 0,
        }))
      : [],

    dokument_nota: rekord.dokument_nota || "",

    // Die begroting. Sy verskyn NÊRENS op die dokument nie — sy is die
    // maatstaf waarmee 'n mens vra of julle genoeg faktureer.
    koste: Array.isArray(rekord.koste)
      ? rekord.koste.map((k) => ({
          beskrywing: k.beskrywing || "",
          ontvanger: k.ontvanger || "",
          bedrag_sent: k.bedrag_sent || 0,
          inskrywing: k.inskrywing || "",
        }))
      : [],

    verdeling: Array.isArray(rekord.verdeling)
      ? rekord.verdeling.map((v) => ({
          ontvanger: v.ontvanger || "",
          tipe: v.tipe || "pct",
          waarde: v.waarde || 0,
        }))
      : [],

    // hosting_pct kan wettig 0 wees, dus mag dit nie deur || 5 loop nie —
    // dan sou iemand wat Hosting doelbewus afskakel, dit elke keer terugkry.
    hosting_pct: Number.isFinite(Number(rekord.hosting_pct)) ? Number(rekord.hosting_pct) : 5,

    afslag_sent: rekord.afslag_sent || 0,
    koepon_kode: rekord.koepon_kode || null,
    skenking_sent: rekord.skenking_sent || 0,
    totaal_sent: rekord.totaal_sent || 0,

    btw_koers: rekord.btw_koers || 0,
    btw_bedrag_sent: rekord.btw_bedrag_sent || 0,

    // TWEE DATUMS WAT NIE VERWAR MAG WORD NIE: betaalbaar_teen staan op die
    // dokument en keer niks; verval_op maak die betaalskakel dood.
    betaalbaar_teen: rekord.betaalbaar_teen || null,
    verval_op: rekord.verval_op || null,

    // Die verdeling soos sy by uitreiking gevries is. 'n Konsep het nog geen
    // een nie; ná uitreiking is dit hierdie een wat geld, nooit weer die
    // lewende lys nie.
    verdeling_gevries: rekord.verdeling_gevries || null,

    // Die betaalskakel is die authorization_url wat Paystack teruggee. Die
    // sleutels self bly hier uit — hulle leef in Netlify se
    // omgewingsveranderlikes en het op geen skerm iets te soeke nie.
    betaalskakel: paystack.authorization_url || null,

    betaling: {
      metode: betaling.metode || null,
      ontvang_sent: betaling.ontvang_sent || 0,
      ontvang_op: betaling.ontvang_op || null,
      verwysing: betaling.verwysing || "",
      aangeteken_deur: betaling.aangeteken_deur || "",
      nota: betaling.nota || "",
    },

    uitbetalings: Array.isArray(rekord.uitbetalings) ? rekord.uitbetalings : [],

    lewering: {
      gestuur_op: lewering.gestuur_op || null,
      nota: lewering.nota || "",
    },

    // Nuutste eerste. By 'n oop vorm is die vraag byna altyd "wat het laas
    // gebeur?", nie "hoe het dit begin nie".
    geskiedenis: Array.isArray(rekord.geskiedenis)
      ? rekord.geskiedenis.slice().reverse()
      : [],
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ faktuur }),
  };
};
