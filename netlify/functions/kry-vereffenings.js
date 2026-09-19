// netlify/functions/kry-vereffenings.js
//
// Lees die gestoorde vereffenings vir 'n tydperk. Rol: boekhouding.
//
// DIE STORE WORD GELEES, NIE PAYSTACK NIE. Die afhaal skryf; hierdie lees.
// Dieselfde skeiding as by die joernaal: 'n leesoproep wat by 'n derde party
// gaan haal, is stadig en misluk om redes wat niks met die leser te doen het
// nie.
//
// DIE SLEUTEL DRA DIE FINANSIELE JAAR, dus word net die jare wat die tydperk
// raak oopgemaak, nie die hele store nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { finansiele_jaar } = require("./_joernaal");
const { kry_vereffenings_store, jaar_voorvoegsel } = require("./_vereffenings");
const {
  kry_paystack_transaksies_store,
  skep_sleutel: transaksie_sleutel,
} = require("./_paystack-transaksies");
const { kry_fakture_store, nommer_na_sleutel } = require("./_fakture");

const ROLLE = ["boekhouding"];

function is_datum(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  const vraag = event.queryStringParameters || {};
  const van = String(vraag.van || "").trim();
  const tot = String(vraag.tot || "").trim();

  if (!is_datum(van) || !is_datum(tot)) {
    return { statusCode: 400, body: "Verpligte velde: van en tot, as JJJJ-MM-DD" };
  }

  // ROU IS VIR 'N DIAGNOSE, nie vir die skerm nie. Paystack se eie voorwerp is
  // groot, en die lys sou met 'n paar honderd vereffenings onhanteerbaar word.
  const wys_rou = String(vraag.rou || "") === "1";

  const foute = [];

  const store = kry_vereffenings_store();
  const t_store = kry_paystack_transaksies_store();
  const f_store = kry_fakture_store();

  // ── DIE AFBREEK PER FAKTUUR ─────────────────────────────────────────────
  //
  // Die uitbetaling sê hoeveel elke ontvanger gekry het. Sy sê nie WAARVOOR
  // nie, en dit is die vraag wat 'n mens werklik vra: watter reël van watter
  // faktuur het daardie geld gemaak, en waar het die hosting heen gegaan.
  //
  // Die antwoord staan reeds op die faktuur. By uitreiking word die verdeling
  // GEVRIES, met per ontvanger 'n `waarvoor`-lys van die reëls waaruit sy geld
  // kom, plus die hosting, die voorsiening en die oorskot apart. Hier word dit
  // net gelees; niks word hier herbereken nie.
  //
  // 'n VERWYSING SONDER FAKTUUR is 'n winkelbestelling of iets anders. Dan bly
  // die verwysing alleen staan, sonder afbreek.
  const faktuur_kas = new Map();

  function nommer_uit_verwysing(verwysing) {
    const dele = String(verwysing || "").split("-");
    if (dele.length >= 2 && /^[A-Z]{2}$/.test(dele[0]) && /^\d+$/.test(dele[1])) {
      return `${dele[0]}/${dele[1]}`;
    }
    return null;
  }

  async function kry_faktuur_afbreek(verwysing) {
    if (faktuur_kas.has(verwysing)) return faktuur_kas.get(verwysing);

    const nommer = nommer_uit_verwysing(verwysing);
    let uit = { verwysing, nommer };

    if (nommer) {
      try {
        const sleutel = nommer_na_sleutel(nommer);
        const f = sleutel ? await f_store.get(sleutel, { type: "json" }) : null;
        const g = f && f.verdeling_gevries;
        if (g) {
          uit = {
            verwysing,
            nommer,
            totaal_sent: Number(g.totaal_sent) || 0,
            hosting_sent: Number(g.hosting_sent) || 0,
            voorsiening_sent: Number(g.voorsiening_sent) || 0,
            oorskot_sent: Number(g.oorskot_sent) || 0,
            rye: (g.rye || []).map((r) => ({
              naam: r.naam || "",
              subrekening_kode: r.subrekening_kode || "",
              bedrag_sent: Number(r.bedrag_sent) || 0,
              pad: r.pad || "",
              waarvoor: (r.waarvoor || []).map((w) => ({
                reel: w.reel || "",
                bedrag_sent: Number(w.bedrag_sent) || 0,
              })),
            })),
          };
        }
      } catch (fout) {
        // 'n Faktuur wat nie gelees kan word nie, laat die verwysing kaal. Dit
        // is beter as 'n halwe afbreek wat soos 'n volledige een lyk.
        foute.push(`${nommer}: ${fout.message || fout}`);
      }
    }

    faktuur_kas.set(verwysing, uit);
    return uit;
  }

  // DIE VERSKILKONTROLE.
  //
  // 'n Uitbetaling se `total_fees` is wat Paystack werklik gehou het. Elke
  // transaksie in daardie uitbetaling dra ook sy eie fooi, uit 'n ander
  // oproep, in 'n ander store. Die twee moet klop.
  //
  // KLOP HULLE NIE, WORD DIT GEWYS EN NIE GLADGESTRYK NIE. 'n Verskil is 'n
  // vraag vir 'n mens: 'n terugbetaling, 'n regstelling by Paystack, of 'n
  // transaksie wat die afhaal gemis het. 'n Stelsel wat dit self wegwerk,
  // verberg presies die ding wat 'n mens moes sien.
  //
  // DIE TRANSAKSIE SE SLEUTEL DRA SY EIE FINANSIELE JAAR, en 'n uitbetaling
  // val 'n dag of wat NA die betaling. Op 1 Maart staan die twee dus in
  // verskillende jare, en daarom word albei jare probeer.
  const kas = new Map();

  async function kry_transaksie(verwysing, datum) {
    if (kas.has(verwysing)) return kas.get(verwysing);

    const jaar = finansiele_jaar(datum);
    const kandidate = [datum];
    if (jaar != null) kandidate.push(`${jaar}-03-01`, `${jaar - 1}-03-01`);

    let gevind = null;
    const geprobeer = new Set();
    for (const d of kandidate) {
      const sleutel = transaksie_sleutel(d, verwysing);
      if (geprobeer.has(sleutel)) continue;
      geprobeer.add(sleutel);
      try {
        const t = await t_store.get(sleutel, { type: "json" });
        if (t) {
          gevind = t;
          break;
        }
      } catch {
        // 'n Sleutel wat nie bestaan nie is geen fout nie: dit beteken net die
        // transaksie is nog nie afgehaal nie.
      }
    }

    kas.set(verwysing, gevind);
    return gevind;
  }
  const jare = new Set([finansiele_jaar(van), finansiele_jaar(tot)].filter((j) => j != null));

  const vereffenings = [];

  for (const jaar of jare) {
    let blobs = [];
    try {
      blobs = (await store.list({ prefix: jaar_voorvoegsel(jaar) })).blobs || [];
    } catch (fout) {
      foute.push(`Jaar ${jaar}: ${fout.message || fout}`);
      continue;
    }

    for (const b of blobs) {
      let r;
      try {
        r = await store.get(b.key, { type: "json" });
      } catch (fout) {
        foute.push(`${b.key}: ${fout.message || fout}`);
        continue;
      }
      if (!r || !r.datum) continue;
      if (r.datum < van || r.datum > tot) continue;

      // Wat die transaksies self oor die fooi sê.
      let som_fooie_sent = 0;
      let gevind = 0;
      for (const verwysing of r.verwysings || []) {
        const t = await kry_transaksie(verwysing, r.datum);
        if (!t) continue;
        gevind += 1;
        som_fooie_sent += Number(t.fooi_sent) || 0;
      }
      const ontbreek = (r.verwysings || []).length - gevind;

      const fakture = [];
      for (const verwysing of r.verwysings || []) {
        fakture.push(await kry_faktuur_afbreek(verwysing));
      }

      const uit = {
        sleutel: r.sleutel,
        paystack_id: r.paystack_id,
        datum: r.datum,
        ontvanger_kode: r.ontvanger_kode,
        ontvanger_naam: r.ontvanger_naam,
        is_hoofrekening: r.is_hoofrekening,
        // `verwerk_sent` is wat die kliënt betaal het; `bruto_sent` is wat
        // HIERDIE ontvanger daarvan kry. Laat die eerste uit, wys die skerm
        // R0,00 waar R20,00 moet staan -- en dit het presies so gebeur.
        verwerk_sent: r.verwerk_sent,
        bruto_sent: r.bruto_sent,
        fooi_sent: r.fooi_sent,
        netto_sent: r.netto_sent,
        status: r.status,
        verwysings: r.verwysings || [],
        fakture,

        // `verskil_sent` is die uitbetaling se fooi min wat die transaksies sê.
        // Nul beteken hulle klop.
        //
        // ONTBREKENDE TRANSAKSIES MAAK DIE SOM BETEKENLOOS, dus word hulle
        // getel en apart gewys, en die verskil bly null. 'n Verskil wat net
        // van 'n ontbrekende transaksie kom, is nie 'n verskil nie.
        som_fooie_sent,
        ontbreek,
        verskil_sent: ontbreek ? null : (Number(r.fooi_sent) || 0) - som_fooie_sent,
      };
      if (wys_rou) uit.rou = r.rou;

      vereffenings.push(uit);
    }
  }

  // Nuutste eerste, soos elke ander lys in die paneel.
  vereffenings.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ van, tot, aantal: vereffenings.length, vereffenings, foute }),
  };
};
