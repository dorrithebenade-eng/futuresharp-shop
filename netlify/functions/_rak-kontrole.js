// netlify/functions/_rak-kontrole.js
//
// Vra die katalogus of 'n indiening se boek werklik in die winkel is.
//
// DIE PROBLEEM WAT DIT OPLOS: dieselfde feit is op twee plekke gestoor. Die
// katalogus weet of 'n boek in die winkel is, en die indiening hou 'n eie
// nota (`op_rak`). Word 'n produk geskrap, gedeaktiveer of kry hy 'n ander
// slug, bly daardie nota staan — en dan kan 'n outeur 'n wysiging indien aan
// 'n boek wat nie meer bestaan nie, die goedkeuring slaag, en Werk by stuit
// eers heel aan die einde.
//
// Die katalogus BESIT die feit. Die indiening vra dus, in plaas van sy eie
// nota te glo.
//
// TWEE STANDE CLAIM DIE RAK: `op_rak`, en `wysiging` — 'n boek met 'n
// hangende voorstel staan steeds in die winkel. Albei word nagegaan.
//
// 'N DIREKTE get(), NOOIT list() NIE. Blobs se `list()` is eventueel
// konsekwent: 'n boek wat pas opgestel is, kan nog nie daarin wees nie, en
// dan sou 'n splinternuwe boek vir 'n oomblik as weg gelees het — juis ná
// Stel op. 'n `get(slug)` is onmiddellik korrek.
//
// 'N MISLUKTE OPROEP HAAL NIKS AF NIE. Net 'n bevestigde `null` tel as weg.
// Gooi die katalogus 'n fout, bly die rekord onaangeraak — 'n netwerkhik mag
// nie 'n boek van die rak afhaal nie.
//
// DIT SKRYF DIE REGSTELLING TERUG. Die vier hekke (`stoor-indiening.js`,
// `dien-in.js`, `onttrek.js`, `stuur-terug.js`) lees die rekord direk uit die
// store, nie deur 'n lees-Function nie. Word net die antwoord reggemaak, lyk
// die skerm reg terwyl die hek oop bly. Die rekord self moet reg wees.

const { kry_store } = require("./_blob-store");
const { voeg_geskiedenis_by } = require("./_indienings");

const RAK_STANDE = ["op_rak", "wysiging"];

// Is hierdie boek werklik in die katalogus?
//
// Gee `true`, `false`, of `null` wanneer ons dit nie kon vasstel nie. Die
// derde geval is die belangrike een: hy beteken "raak niks aan".
async function is_in_katalogus(slug) {
  if (!slug) return false;

  let produk;
  try {
    produk = await kry_store("katalogus").get(slug, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die katalogus lees nie:", fout);
    return null;
  }

  return Boolean(produk);
}

// Maak een rekord reg indien nodig. Gee `true` terug as iets verander het.
//
// Die rekord word IN PLEK gewysig, sodat die oproeper se kopie dadelik reg
// is en nie weer gelees hoef te word nie.
async function kontroleer_een(rekord, store) {
  if (!rekord || !RAK_STANDE.includes(rekord.stand)) return false;

  // Sonder 'n slug is daar niks om na te vra nie, en Stel op en Werk by kan
  // in elk geval niks doen nie. Dit tel as weg.
  const slug = String(rekord.produk_id || "").trim();
  const in_winkel = slug ? await is_in_katalogus(slug) : false;

  if (in_winkel !== false) return false; // daar, of onbekend — laat staan

  // Terug na "wag om opgestel te word". By 'n wysiging BLY `hangend` staan:
  // sodra die boek weer opgestel is, is die stand `op_rak` en `dien-in.js`
  // neem daardie voorstel weer op. Die outeur se werk gaan nie verlore nie.
  rekord.stand = "goedgekeur";
  rekord.bywerking_wagtend = false;
  rekord.produk_id = null;
  rekord.gewysig_op = new Date().toISOString();

  voeg_geskiedenis_by(
    rekord,
    "boek nie meer in die katalogus nie \u2014 terug na wag om opgestel te word",
    "",
    slug
  );

  try {
    await store.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    // Die antwoord is reeds reg; net die skryf het misluk. Die volgende
    // herlaai probeer weer.
    console.error("Kon nie die regstelling stoor nie:", fout);
  }

  return true;
}

// Gaan 'n lys rekords na. Slegs dié wat die rak claim, kos 'n oproep — tans
// 'n handvol per lys.
async function kontroleer_rak(rekords, store) {
  const lys = Array.isArray(rekords) ? rekords : [rekords];
  await Promise.all(lys.filter(Boolean).map((rekord) => kontroleer_een(rekord, store)));
  return rekords;
}

module.exports = {
  RAK_STANDE,
  is_in_katalogus,
  kontroleer_rak,
};
