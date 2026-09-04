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
    // Die datum op die dokument. Sonder hierdie reël bereik hy nooit die
    // skerm nie — die antwoord word veld vir veld gebou.
    dokument_datum: rekord.dokument_datum || null,

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

    // ELKE REEL DRA SY EIE VERDELING, SY EIE HOSTING EN SY EIE `vou_in`
    // (25 Augustus 2026). Sien Verdeling-Per-Lynitem-Ontwerp.md.
    //
    // DIE DRIE HET TOT 27 AUGUSTUS 2026 HIER UITGEVAL. Toe die verdeling na
    // die reels geskuif het, is _fakture.js, stoor-faktuur.js en
    // faktuur-vorm.js bygewerk en HIERDIE LESER NIE. Dit is presies die
    // slaggat wat bo-aan hierdie lêer beskryf staan — dieselfde as `leers`
    // in kry-indienings.js op 8 Augustus.
    //
    // Die gevolg was nie 'n leë skerm nie, wat 'n mens sou sien: dit was
    // STIL DATAVERLIES. faktuur-vorm.js lees al drie velde en val terug op
    // `[]`, `0` en `true`; die outomatiese stoor stuur daardie terugvalle
    // dan TERUG. 'n Konsep wat toegemaak en weer oopgemaak is, het sy
    // verdeling verloor — en die vorm het reg gelyk terwyl dit gebeur het.
    //
    // Die simptoom is op 26 Augustus in die konsole gesien (`vd: []`, `h: 0`)
    // en aan ou data toegeskryf. Die ou data was werklik oud, maar dit was
    // nie die enigste oorsaak nie.
    reels: Array.isArray(rekord.reels)
      ? rekord.reels.map((r) => ({
          soort: r.soort || "verkoop",
          beskrywing: r.beskrywing || "",
          hoeveelheid: r.hoeveelheid || 0,
          prys_pp_sent: r.prys_pp_sent || 0,
          bedrag_sent: r.bedrag_sent || 0,

          // Of die reel GEDRUK word. Slegs 'n uitdruklike `false` steek hom
          // weg; 'n ouer rekord sonder die veld word gedruk.
          // Ontbreek die veld, staan die reel op haar eie -- die veilige
          // rigting. Sien stoor-faktuur.js.
          vou_in: r.vou_in === true,

          // GEEN `|| 5`-TERUGVAL NIE. 'n Doelbewuste nul moet die rondreis
          // oorleef: op 'n kostereel beteken nul dat hosting nie gehef word
          // nie, en dit is 'n keuse. Ontbreek die veld heeltemal — 'n rekord
          // van voor 25 Augustus — is nul die veilige antwoord: hosting wat
          // stilweg verskyn, vat geld by 'n begunstigde weg.
          hosting_pct: Number.isFinite(Number(r.hosting_pct)) ? Number(r.hosting_pct) : 0,

          // Die kategorie waaronder die reel op die staat val. Die antwoord
          // word veld vir veld gebou -- sonder hierdie reel bereik hy nooit
          // die skerm nie.
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
    // maatstaf waarmee 'n mens vra of julle genoeg faktureer.
    koste: Array.isArray(rekord.koste)
      ? rekord.koste.map((k) => ({
          beskrywing: k.beskrywing || "",
          ontvanger: k.ontvanger || "",
          bedrag_sent: k.bedrag_sent || 0,
          inskrywing: k.inskrywing || "",
        }))
      : [],

    // DIE FAKTUURVLAK `verdeling` EN `hosting_pct` KOM HIER NIE MEER DEUR
    // NIE. Albei leef sedert 25 Augustus 2026 op elke reel hierbo. Hulle het
    // tot 27 Augustus nog uitgegaan, en 'n leser wat hulle vind, sou 'n
    // verdeling teken wat NAAS die reels s'n loop.
    //
    // Ouer rekords dra die velde nog. Hulle word doelbewus geignoreer: die
    // reels is die enigste bron.

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

    // Waaruit die faktuur kom, wanneer sy uit 'n aanvaarde kwotasie gebou is.
    // Sien die waarskuwing bo-aan hierdie lêer: 'n nuwe veld kom NIE vanself
    // deur nie -- dit is presies die fout wat op 27 Augustus 2026 met
    // op_faktuur, hosting_pct en verdeling gevind is.
    uit_kwotasie: rekord.uit_kwotasie || null,
    uit_kwotasie_hersiening: rekord.uit_kwotasie_hersiening || null,

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
