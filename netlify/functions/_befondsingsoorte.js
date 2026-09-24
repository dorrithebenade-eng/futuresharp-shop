// netlify/functions/_befondsingsoorte.js
//
// Die register van BEFONDSINGSOORTE -- wat elke soort befondsing van Future
// Sharp vra.
//
// DIE SOORT BEPAAL DIE PROSES, NIE DIE BEFONDSER NIE. 'n B-BBEE-bydrae vir
// vaardigheidsontwikkeling vra bywoningsregisters en 'n leerderlys; 'n
// skenking met Art. 18A vra 'n sertifikaat met die skenker se volle
// besonderhede. Elke soort dra twee lyste:
//
//   uitreik   wat Future Sharp aan die befondser gee (kwitansie, sertifikaat,
//             faktuur, bevestigingsbrief, verslag)
//   rekords   wat Future Sharp moet hou, elk met `dokument` as 'n opgelaaide
//             lêer vereis word
//
// en `vereis_18a` vir 'n soort wat eers ná SARS se goedkeuring gebruik mag word.
//
// ALLES IS WYSIGBAAR EN UITBREIBAAR. Die vyf voorgelaaide soorte is 'n
// beginpunt, nie 'n voorskrif nie; die inhoud moet met die rekenmeester en 'n
// B-BBEE-konsultant bevestig word.
//
// 'N TOEKENNING KRY 'N AFSKRIF VAN DIE LYSTE (fase B). 'n Latere wysiging aan
// die soort raak dus nie stilweg 'n toekenning wat reeds afgehandel is nie.
//
// DIE VOORGELAAIDE SOORTE EN DIE SAAD-MERK
//
// 'n Lees mag nie skryf nie. Solank die sleutel `_gesaai` nie bestaan nie, voeg
// die lees die voorgelaaide soorte by wat nog nie gestoor is nie. Die eerste
// skryf (stoor, skrap, aktiveer) skryf hulle eers almal weg en sit die merk,
// sodat 'n voorgelaaide soort wat daarna uitgevee word, nie weer opduik nie.

const { kry_store } = require("./_blob-store");

const STORE_NAAM = "befondsingsoorte";
const SAAD_SLEUTEL = "_gesaai";

function kry_soorte_store() {
  return kry_store(STORE_NAAM);
}

function is_toets_naam(naam) {
  return /^\s*TOETS\b/.test(String(naam || ""));
}

function maak_slug(teks) {
  return String(teks || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const NOTA = "Voorgelaai. Bevestig die lyste met die rekenmeester of 'n B-BBEE-konsultant.";
const i = (id, naam, dokument) => (dokument === undefined ? { id, naam } : { id, naam, dokument });

const VOORGELAAI = [
  {
    id: "skenking-algemeen",
    naam: "Skenking (algemeen)",
    vereis_18a: false,
    uitreik: [i("kwitansie", "Kwitansie")],
    rekords: [i("bewys-van-betaling", "Bewys van betaling", false)],
  },
  {
    id: "skenking-18a",
    naam: "Skenking met Art. 18A",
    vereis_18a: true,
    uitreik: [i("sertifikaat-18a", "Art. 18A-sertifikaat")],
    rekords: [
      i("skenker-besonderhede", "Skenker se besonderhede volledig (registrasie- of ID-nommer, belastingnommer, kontak)", false),
      i("bewys-van-betaling", "Bewys van betaling", false),
      i("it3d", "Ingesluit in die IT3(d)-opgawe aan SARS", false),
    ],
  },
  {
    id: "bbbee-sed",
    naam: "B-BBEE: Sosio-ekonomiese ontwikkeling",
    vereis_18a: false,
    uitreik: [i("bevestigingsbrief", "Bevestigingsbrief aan die befondser"), i("verslag", "Verslag")],
    rekords: [
      i("ooreenkoms", "Getekende ooreenkoms", true),
      i("begunstigdelys", "Begunstigdelys met demografie", true),
      i("bewys-van-betaling", "Bewys van betaling", false),
      i("impak", "Impakopsomming", true),
    ],
  },
  {
    id: "bbbee-vaardigheid",
    naam: "B-BBEE: Vaardigheidsontwikkeling",
    vereis_18a: false,
    uitreik: [i("faktuur", "Faktuur"), i("bywoningsertifikate", "Bywoningsertifikate per leerder")],
    rekords: [
      i("ooreenkoms", "Getekende ooreenkoms", true),
      i("bywoningsregisters", "Bywoningsregisters", true),
      i("leerderlys", "Leerderlys met ID-bewys", true),
      i("bewys-van-betaling", "Bewys van betaling", false),
    ],
  },
  {
    id: "toekenning-ooreenkoms",
    naam: "Toekenning met ooreenkoms",
    vereis_18a: false,
    uitreik: [i("kwitansie", "Kwitansie"), i("finansiele-verslag", "Finansiële verslag")],
    rekords: [
      i("ooreenkoms", "Getekende ooreenkoms", true),
      i("begroting", "Begroting", true),
      i("verslag", "Verslag teen die sperdatum", true),
    ],
  },
].map((s) => ({
  ...s,
  aktief: true,
  voorgelaai: true,
  nota: NOTA,
  geskep_op: "2026-09-25T00:00:00.000Z",
  geskep_deur: "",
  bygewerk_op: "2026-09-25T00:00:00.000Z",
}));

async function lees_gestoor(store) {
  const { blobs } = await store.list();
  const sleutels = (blobs || []).map((b) => b.key);
  const gesaai = sleutels.includes(SAAD_SLEUTEL);
  const soorte = (
    await Promise.all(
      sleutels.filter((k) => k !== SAAD_SLEUTEL).map((k) => store.get(k, { type: "json" }))
    )
  ).filter(Boolean);
  return { gesaai, soorte };
}

// Vir die LEES: gestoor plus die voorgelaaides wat nog nie gestoor is nie.
async function lees_almal(store) {
  const { gesaai, soorte } = await lees_gestoor(store);
  if (gesaai) return soorte;
  const bestaan = new Set(soorte.map((s) => s.id));
  return soorte.concat(VOORGELAAI.filter((s) => !bestaan.has(s.id)));
}

// Vir die SKRYF: sorg dat die voorgelaaides gestoor is en die merk sit.
async function saai(store) {
  const { gesaai, soorte } = await lees_gestoor(store);
  if (gesaai) return;
  const bestaan = new Set(soorte.map((s) => s.id));
  for (const s of VOORGELAAI) {
    if (!bestaan.has(s.id)) await store.setJSON(s.id, s);
  }
  await store.setJSON(SAAD_SLEUTEL, { op: new Date().toISOString() });
}

// Een lys se items skoonmaak. 'n Bestaande item hou sy id; 'n nuwe een kry een
// uit sy naam met 'n kort staart, sodat twee items met dieselfde naam nie bots
// nie. `dokument` geld net by die rekords.
function skoon_items(lys, met_dokument) {
  if (!Array.isArray(lys)) return [];
  const gesien = new Set();
  const uit = [];
  lys.slice(0, 40).forEach((it) => {
    const naam = String((it && it.naam) || "").trim().slice(0, 160);
    if (!naam) return;
    let id = String((it && it.id) || "").trim().slice(0, 80);
    if (!id || gesien.has(id)) {
      id = (maak_slug(naam).slice(0, 60) || "item") + "-" + Math.random().toString(36).slice(2, 6);
    }
    gesien.add(id);
    const item = { id, naam };
    if (met_dokument) item.dokument = Boolean(it && it.dokument);
    uit.push(item);
  });
  return uit;
}

module.exports = {
  STORE_NAAM,
  SAAD_SLEUTEL,
  VOORGELAAI,
  kry_soorte_store,
  is_toets_naam,
  maak_slug,
  lees_almal,
  saai,
  skoon_items,
};
