// netlify/functions/_paystack-haal.js
//
// Haal Paystack se transaksielys vir 'n datumbereik en skryf elke geslaagde
// transaksie na die store. Gedeel deur haal-paystack.js (geskeduleer) en
// haal-paystack-inhaal.js (met die hand, vir 'n inhaal oor 'n ouer bereik).
//
// WAAROM 'N AFHAAL EN NIE 'N WEBHOOK NIE.
//
// 'n Webhook kan gemis word: 'n ontplooiing wat op daardie oomblik loop, 'n
// tydelike fout, 'n URL wat na iets anders wys. Vir 'n bestelling wat bevestig
// moet word, is dit hanteerbaar -- iemand kla. Vir 'n GROOTBOEK nie: 'n
// transaksie wat ontbreek, ontbreek stil en niemand weet nie.
//
// Paystack se lys is die gesag. Die afhaal is 'n rekonsiliasie, nie 'n
// kennisgewing nie.
//
// DIT VERVANG DIE WEBHOOK NIE. Die webhook sit 'n faktuur op Betaal, vries die
// verdeling, gee die toegangskode en stuur die kwitansie. Die afhaal BOEK; dit
// doen niks daarvan nie.
//
// DIE VENSTER IS BREER AS EEN DAG, en dit is die punt. Loop die skedule een
// nag nie, is daar geen gat -- die volgende loop dek daardie dag steeds. Die
// sleutel is deterministies, dus is 'n oorvleueling geen duplikaat nie.

const {
  kry_paystack_transaksies_store,
  bou_rekord,
} = require("./_paystack-transaksies");

const PAYSTACK_LYS = "https://api.paystack.co/transaction";

// Paystack laat tot 100 per bladsy toe. Die dop is 'n keering teen 'n
// verkeerde datumbereik wat duisende bladsye sou vra, nie 'n verwagte grens
// nie -- 'n normale loop vra een bladsy.
const PER_BLAD = 100;
const MAKS_BLAAIE = 50;

/**
 * @param {string} van   ISO-datum, ingesluit. Bv. "2026-07-01"
 * @param {string} tot   ISO-datum, ingesluit.
 * @returns {Promise<{gehaal:number, geskryf:number, oorgeslaan:number, blaaie:number, foute:string[]}>}
 */
async function haal_paystack_transaksies(van, tot) {
  const sleutel = process.env.PAYSTACK_SECRET_KEY;
  if (!sleutel) {
    throw new Error("PAYSTACK_SECRET_KEY is nie gestel nie");
  }

  const store = kry_paystack_transaksies_store();

  let gehaal = 0;
  let geskryf = 0;
  let oorgeslaan = 0;
  let blad = 1;
  const foute = [];

  while (blad <= MAKS_BLAAIE) {
    const url =
      `${PAYSTACK_LYS}?perPage=${PER_BLAD}&page=${blad}` +
      `&status=success&from=${encodeURIComponent(van)}&to=${encodeURIComponent(tot)}`;

    let data;
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${sleutel}` },
      });
      data = await resp.json();
      if (!resp.ok || !data.status) {
        foute.push(`Blad ${blad}: ${data && data.message ? data.message : resp.status}`);
        break;
      }
    } catch (fout) {
      foute.push(`Blad ${blad}: ${fout.message || fout}`);
      break;
    }

    const lys = Array.isArray(data.data) ? data.data : [];
    gehaal += lys.length;

    for (const t of lys) {
      // Die lys is reeds op `status=success` gefiltreer; die toets hier is
      // die gordel by die bretels, want 'n mislukte poging in die grootboek
      // is erger as een wat ontbreek.
      if (String(t.status || "") !== "success") {
        oorgeslaan++;
        continue;
      }

      let rekord;
      try {
        rekord = bou_rekord(t);
      } catch (fout) {
        foute.push(`${t.reference}: kon nie die rekord bou nie -- ${fout.message || fout}`);
        continue;
      }

      if (!rekord.datum) {
        // Sonder 'n datum kan die sleutel nie 'n finansiele jaar dra nie en
        // sou die rekord onvindbaar wees. Dit behoort nooit te gebeur nie.
        foute.push(`${rekord.verwysing}: geen datum op die transaksie`);
        continue;
      }

      try {
        await store.setJSON(rekord.sleutel, rekord);
        geskryf++;
      } catch (fout) {
        foute.push(`${rekord.verwysing}: kon nie stoor nie -- ${fout.message || fout}`);
      }
    }

    const bladsye = (data.meta && Number(data.meta.pageCount)) || 1;
    if (blad >= bladsye || !lys.length) break;
    blad++;
  }

  return { gehaal, geskryf, oorgeslaan, blaaie: blad, foute };
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

module.exports = { haal_paystack_transaksies, dae_terug, vandag };
