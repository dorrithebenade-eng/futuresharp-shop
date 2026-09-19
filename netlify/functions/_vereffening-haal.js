// netlify/functions/_vereffening-haal.js
//
// Haal Paystack se vereffenings vir 'n datumbereik en skryf hulle na die store.
// Gedeel deur haal-vereffenings.js (geskeduleer) en haal-vereffenings-inhaal.js
// (met die hand, vir 'n inhaal oor 'n ouer bereik).
//
// DIESELFDE REDENASIE AS _paystack-haal.js: 'n afhaal en nie 'n webhook nie.
// 'n Gemiste kennisgewing ontbreek stil, en in 'n grootboek merk niemand dit
// op nie. Paystack se lys is die gesag.
//
// DIE AFHAAL LOOP PER ONTVANGER, want Paystack betaal per ontvanger uit. Die
// parameter `subaccount` kies wie: "none" vir die hoofrekening, of 'n ACCT_
// kode vir 'n begunstigde. Sonder die parameter mis 'n mens die subrekeninge se
// uitbetalings heeltemal, en dit is juis hulle wat die vraag "het Ignatius sy
// geld gekry" beantwoord.
//
// DIE TRANSAKSIES KOM UIT 'N TWEEDE OPROEP. /settlement gee die uitbetaling;
// /settlement/:id/transactions gee wat daarin was. Net die VERWYSINGS word
// gestoor -- die transaksies self staan reeds in `paystack-transaksies`.
//
// DIE VENSTER IS BREER AS EEN DAG, en dit is die punt. Loop die skedule een nag
// nie, dek die volgende loop daardie dag steeds. Die sleutel is deterministies,
// dus is 'n oorvleueling geen duplikaat nie. Dit geld hier dubbel: 'n
// vereffening wat gister nog `processing` was, is vandag `success`, en die
// tweede loop werk dieselfde rekord by.

const { kry_store } = require("./_blob-store");
const {
  kry_vereffenings_store,
  HOOFREKENING,
  bou_rekord,
} = require("./_vereffenings");

const PAYSTACK_VEREFFENINGS = "https://api.paystack.co/settlement";

// Paystack laat tot 100 per bladsy toe. Die doppe is 'n keering teen 'n
// verkeerde datumbereik wat duisende bladsye sou vra, nie 'n verwagte grens
// nie -- 'n normale loop vra een bladsy.
const PER_BLAD = 100;
const MAKS_BLAAIE = 20;
const MAKS_TRANSAKSIE_BLAAIE = 10;

function kop() {
  const sleutel = process.env.PAYSTACK_SECRET_KEY;
  if (!sleutel) {
    throw new Error("PAYSTACK_SECRET_KEY is nie gestel nie");
  }
  return { Authorization: `Bearer ${sleutel}` };
}

/**
 * Die ontvangers wie se uitbetalings gehaal word: die hoofrekening, plus elke
 * begunstigde met 'n subrekening.
 *
 * 'n BEGUNSTIGDE SONDER 'N SUBREKENING WORD OORGESLAAN. Hy het nog nooit geld
 * ontvang nie, en Paystack sou die oproep met 'n fout beantwoord.
 */
async function kry_ontvangers() {
  const ontvangers = [{ kode: HOOFREKENING, naam: "Hoofrekening" }];

  try {
    const store = kry_store("begunstigdes");
    const lys = (await store.list()).blobs || [];
    for (const b of lys) {
      const rekord = await store.get(b.key, { type: "json" });
      const kode = String((rekord && rekord.subrekening_kode) || "").trim();
      if (!kode) continue;
      ontvangers.push({ kode, naam: String((rekord && rekord.naam) || kode) });
    }
  } catch (fout) {
    // DIT IS NIE FATAAL NIE. Sonder die begunstigdes haal die loop steeds die
    // hoofrekening s'n, en dit is die deel wat in die joernaal boek.
    console.error("Kon nie die begunstigdes lees nie:", fout && fout.message);
  }

  return ontvangers;
}

/**
 * Die verwysings van die transaksies in een vereffening.
 */
async function haal_verwysings(id, foute) {
  const verwysings = [];
  let blad = 1;

  while (blad <= MAKS_TRANSAKSIE_BLAAIE) {
    const url = `${PAYSTACK_VEREFFENINGS}/${encodeURIComponent(id)}/transactions?perPage=${PER_BLAD}&page=${blad}`;

    let data;
    try {
      const resp = await fetch(url, { headers: kop() });
      data = await resp.json();
      if (!resp.ok || !data.status) {
        foute.push(`Vereffening ${id}, blad ${blad}: ${(data && data.message) || resp.status}`);
        break;
      }
    } catch (fout) {
      foute.push(`Vereffening ${id}, blad ${blad}: ${fout.message || fout}`);
      break;
    }

    const lys = Array.isArray(data.data) ? data.data : [];
    for (const t of lys) {
      if (t && t.reference) verwysings.push(String(t.reference));
    }

    const bladsye = (data.meta && Number(data.meta.pageCount)) || 1;
    if (blad >= bladsye || !lys.length) break;
    blad++;
  }

  return verwysings;
}

/**
 * @param {string} van   ISO-datum, ingesluit. Bv. "2026-07-15"
 * @param {string} tot   ISO-datum, ingesluit.
 * @param {object[]} [ontvangers]  { kode, naam }; verstek is almal.
 * @returns {Promise<{gehaal:number, geskryf:number, ontvangers:number, foute:string[]}>}
 */
async function haal_vereffenings(van, tot, ontvangers) {
  const store = kry_vereffenings_store();
  const lys_ontvangers = ontvangers && ontvangers.length ? ontvangers : await kry_ontvangers();

  // 'N DATUM SONDER 'N TYD IS MIDDERNAG AAN DIE BEGIN VAN DIE DAG, en daardie
  // dag se eie rekords val dan buite die venster. Dieselfde val wat op 6
  // September 2026 by die transaksies 'n leë inhaal gegee het, staan in
  // _paystack-haal.js beskryf.
  const van_t = `${van} 00:00:00`;
  const tot_t = `${tot} 23:59:59`;

  let gehaal = 0;
  let geskryf = 0;
  const foute = [];

  for (const ontvanger of lys_ontvangers) {
    let blad = 1;

    while (blad <= MAKS_BLAAIE) {
      const url =
        `${PAYSTACK_VEREFFENINGS}?perPage=${PER_BLAD}&page=${blad}` +
        `&subaccount=${encodeURIComponent(ontvanger.kode)}` +
        `&from=${encodeURIComponent(van_t)}&to=${encodeURIComponent(tot_t)}`;

      let data;
      try {
        const resp = await fetch(url, { headers: kop() });
        data = await resp.json();
        if (!resp.ok || !data.status) {
          foute.push(`${ontvanger.naam}, blad ${blad}: ${(data && data.message) || resp.status}`);
          break;
        }
      } catch (fout) {
        foute.push(`${ontvanger.naam}, blad ${blad}: ${fout.message || fout}`);
        break;
      }

      const lys = Array.isArray(data.data) ? data.data : [];
      gehaal += lys.length;

      for (const v of lys) {
        const verwysings = await haal_verwysings(v.id, foute);

        let rekord;
        try {
          rekord = bou_rekord(v, ontvanger, verwysings);
        } catch (fout) {
          foute.push(`${ontvanger.naam}, ${v.id}: kon nie die rekord bou nie -- ${fout.message || fout}`);
          continue;
        }

        if (!rekord.datum) {
          // Sonder 'n datum kan die sleutel nie 'n finansiele jaar dra nie en
          // sou die rekord onvindbaar wees. Dit behoort nooit te gebeur nie.
          foute.push(`${ontvanger.naam}, ${v.id}: geen datum op die vereffening`);
          continue;
        }

        try {
          await store.setJSON(rekord.sleutel, rekord);
          geskryf++;
        } catch (fout) {
          foute.push(`${ontvanger.naam}, ${v.id}: kon nie stoor nie -- ${fout.message || fout}`);
        }
      }

      const bladsye = (data.meta && Number(data.meta.pageCount)) || 1;
      if (blad >= bladsye || !lys.length) break;
      blad++;
    }
  }

  return { gehaal, geskryf, ontvangers: lys_ontvangers.length, foute };
}

// "Vandag min N dae", as YYYY-MM-DD in UTC.
function dae_terug(dae) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - Number(dae || 0));
  return d.toISOString().slice(0, 10);
}

function vandag() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = { haal_vereffenings, kry_ontvangers, dae_terug, vandag };
