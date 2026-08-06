// netlify/functions/_indienings.js
//
// Die indienings-store en die vormnommer.
//
// 'N INDIENING IS DIE TITEL SE REKORD, nie 'n eenmalige aksie nie. Hy word
// as konsep geskep, ingedien, goedgekeur, en bly daarna staan langs die
// boek. Wil die outeur later iets verander, wysig hy DIESELFDE rekord en dit
// gaan terug as 'n hangende wysiging.
//
// DIE STANDE:
//   konsep    — hy werk daaraan; net hy sien dit
//   ingedien  — wag vir prosessering; hy kan dit nog onttrek
//   op_rak    — goedgekeur en in die katalogus
//   wysiging  — op die rak, met 'n hangende wysiging
//
// Daar is GEEN "afgekeur" nie. 'n Indiening wat nie reg is nie, gaan terug
// na `konsep` met 'n opmerking. 'n Afkeur eindig 'n gesprek; 'n opmerking
// hou hom aan die gang, en die geskiedenis wys hoe die boek by sy finale
// vorm uitgekom het.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "indienings";
const STANDE = ["konsep", "ingedien", "op_rak", "wysiging"];

function kry_indienings_store() {
  return kry_store(STORE_NAAM);
}

// BV-2026-0147. Die jaar maak dit leesbaar, die volgnommer maak dit uniek.
// Die nommer word by die EERSTE STOOR uitgereik, nooit by oopmaak nie —
// anders lê daar nommers van vorms wat nooit iets geword het nie.
//
// Die volgende nommer kom uit die bestaande sleutels, nie uit 'n aparte
// teller nie. 'n Teller sou 'n tweede skryf per stoor beteken, en as hy
// wegraak is die nommers deurmekaar. Twee indienings wat binne dieselfde
// oomblik geskep word, kan dieselfde nommer kry — by hierdie volume is dit
// nie 'n werklike risiko nie, en `skep_nommer` toets in elk geval of die
// sleutel reeds bestaan voordat hy hom teruggee.
async function skep_nommer(store) {
  const jaar = new Date().getFullYear();
  const voorvoegsel = `BV-${jaar}-`;

  let sleutels = [];
  try {
    const lys = await store.list({ prefix: voorvoegsel });
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die indienings lys nie:", fout);
    throw fout;
  }

  let hoogste = 0;
  sleutels.forEach((sleutel) => {
    const getal = Number(sleutel.slice(voorvoegsel.length));
    if (Number.isFinite(getal) && getal > hoogste) hoogste = getal;
  });

  for (let poging = 1; poging <= 20; poging += 1) {
    const kandidaat = `${voorvoegsel}${String(hoogste + poging).padStart(4, "0")}`;
    if (!sleutels.includes(kandidaat)) return kandidaat;
  }

  throw new Error("Kon nie 'n vry vormnommer kry nie");
}

// Elke handeling gaan hier in. Dit is wat later 'n vraag beantwoord oor wat
// verskaf en bevestig is — dieselfde patroon as versending.geskiedenis.
function voeg_geskiedenis_by(rekord, handeling, wie, nota) {
  if (!Array.isArray(rekord.geskiedenis)) rekord.geskiedenis = [];
  rekord.geskiedenis.push({
    handeling,
    wie: wie || "",
    nota: nota || "",
    op: new Date().toISOString(),
  });
  return rekord;
}

// Behoort hierdie rekord aan hierdie outeur? Elke Function wat 'n bestaande
// indiening aanraak, moet dit vra. Die outeur_id op die rekord is die
// enigste eienaarskapstoets — nooit die e-pos nie, want dié kan verander.
function is_myne(rekord, outeur) {
  return Boolean(rekord && outeur && rekord.outeur_id && rekord.outeur_id === outeur.outeur_id);
}

module.exports = {
  STORE_NAAM,
  STANDE,
  kry_indienings_store,
  skep_nommer,
  voeg_geskiedenis_by,
  is_myne,
};
