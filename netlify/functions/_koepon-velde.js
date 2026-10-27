// Koepons — bou en valideer die velde wat personeel in die koeponvorm stel.
// Gedeel deur skep-koepon.js en wysig-koepon.js, sodat 'n nuwe en 'n
// gewysigde koepon presies dieselfde reëls volg.
//
// DIE VELDE WORD EEN VIR EEN GEBOU, nie met ...invoer nie. Die kode self,
// die gebruike, die geskiedenis, aktief en koper_id_beperking hoort nie
// hier nie: skep-koepon.js stel hulle by die skep, en wysig-koepon.js behou
// hulle uit die bestaande rekord.

const GELDIGE_FORMATE = ["eboek", "harde_kopie", "leen", "albei", "video"];

// Gee { velde } terug, of { fout } by 'n ongeldige invoer.
function bou_koepon_velde(invoer) {
  const tipe = invoer.tipe === "afslag" ? "afslag" : "gratis";
  // "video" = 'n FutureSharp Talks-koepon (sien _talk-koepon.js); die boeke
  // se betaling aanvaar dit nooit.
  const formaat_beperking = GELDIGE_FORMATE.includes(invoer.formaat_beperking) ? invoer.formaat_beperking : "albei";
  // MEER AS EEN BOEK. 'n Koepon kan nou vir 'n lys boeke geld (bv. die
  // Afrikaanse en die Engelse weergawe van dieselfde boek), sodat die koper
  // self kan kies watter een hy koop. produk_slugs is die lys; produk_slug
  // bly vir ou koepons en talk-koepons (een slug). Leeg = enige boek/talk.
  const ruwe_lys = Array.isArray(invoer.produk_slugs)
    ? invoer.produk_slugs
    : invoer.produk_slug ? [invoer.produk_slug] : [];
  let produk_slugs = [...new Set(ruwe_lys.map((s) => String(s || "").trim()).filter(Boolean))].slice(0, 100);
  if (invoer.formaat_beperking === "video") produk_slugs = produk_slugs.slice(0, 1);
  const produk_slug = produk_slugs.length === 1 ? produk_slugs[0] : null;
  const outeur_id = invoer.outeur_id ? String(invoer.outeur_id).trim() : null;
  // Net vir talk-koepons: beperk tot die talks van een spreker.
  const spreker_id = formaat_beperking === "video" && invoer.spreker_id ? String(invoer.spreker_id).trim() : null;
  const nota = invoer.nota ? String(invoer.nota).trim().slice(0, 300) : "";

  // TWEE SOORTE, SAAM BRUIKBAAR. 'n Koper mag een koepon van elke soort in
  // dieselfde betaling gebruik: 'n "veldtog"-kode (bv. BLACKFRIDAY) plus 'n
  // "lojaliteit"-kode (bv. VOLGENDE50 agter in elke boek). Twee veldtogkodes
  // saam word geweier. Ou koepons sonder die veld is "veldtog".
  const soort = invoer.soort === "lojaliteit" ? "lojaliteit" : "veldtog";
  // Net vir kopers wat reeds een van die koepon se boeke as e-boek besit
  // (of enige boek, as die koepon vir enige boek geld). So kan 'n gedrukte
  // kode maar gedeel word: net bestaande lesers kry die afslag.
  const vereis_besit = invoer.vereis_besit === true;

  const maks_gebruike = Number.isInteger(invoer.maks_gebruike) && invoer.maks_gebruike > 0 ? invoer.maks_gebruike : 1;

  let verval_op = null;
  if (invoer.verval_op) {
    const datum = new Date(invoer.verval_op);
    if (Number.isNaN(datum.getTime())) return { fout: "Ongeldige vervaldatum" };
    verval_op = datum.toISOString();
  }

  let afslag_tipe = null;
  let afslag_waarde = null;
  if (tipe === "afslag") {
    afslag_tipe = invoer.afslag_tipe === "vaste_bedrag" ? "vaste_bedrag" : "persentasie";
    afslag_waarde = Number(invoer.afslag_waarde);

    if (!Number.isFinite(afslag_waarde) || afslag_waarde <= 0) {
      return { fout: "Verpligte veld: afslag_waarde (groter as 0)" };
    }
    if (afslag_tipe === "persentasie" && afslag_waarde > 100) {
      return { fout: "Persentasie-afslag kan nie meer as 100 wees nie" };
    }

    // 'n Vaste bedrag word in RAND ingetik (die vorm se etiket lees
    // "Vaste bedrag (R)") maar moet in SENT gestoor word: die eenheid wat
    // begin-betaling.js, verifieer-koepon.js en _talk-koepon.js aftrek.
    // Dit gebeur bediener-kant sodat 'n versoek wat die paneelvorm omseil
    // dit nie kan misloop nie. 'n Persentasie bly 'n gewone getal.
    if (afslag_tipe === "vaste_bedrag") {
      afslag_waarde = Math.round(afslag_waarde * 100);
    }
  }

  return {
    velde: {
      tipe,
      afslag_tipe,
      afslag_waarde,
      produk_slug,
      produk_slugs,
      formaat_beperking,
      maks_gebruike,
      verval_op,
      outeur_id,
      spreker_id,
      nota,
      soort,
      vereis_besit,
    },
  };
}

// Die boeke waarvoor 'n koepon geld, of null vir "enige boek". Lees
// produk_slugs (nuut) en val terug op produk_slug (ou koepons, en die
// leen-na-koop-koepons wat per koper geskep word).
function koepon_boeke(koepon) {
  if (koepon && Array.isArray(koepon.produk_slugs) && koepon.produk_slugs.length) return koepon.produk_slugs;
  if (koepon && koepon.produk_slug) return [koepon.produk_slug];
  return null;
}

function koepon_geld_vir_boek(koepon, produk_slug) {
  const boeke = koepon_boeke(koepon);
  return !boeke || boeke.includes(produk_slug);
}

function koepon_soort(koepon) {
  return koepon && koepon.soort === "lojaliteit" ? "lojaliteit" : "veldtog";
}

// Besit die koper reeds 'n e-boek wat by hierdie koepon hoort? besitte is
// 'n Set van produk_slugs wat die koper reeds betaal het.
function besit_voldoen(koepon, besitte) {
  if (!koepon || !koepon.vereis_besit) return true;
  const boeke = koepon_boeke(koepon);
  if (!boeke) return besitte.size > 0;
  return boeke.some((slug) => besitte.has(slug));
}

// Die e-boeke (produk_slugs) wat 'n koper reeds betaal het. Dieselfde reël
// as begin-betaling.js: 'n bestelling met status "Nuut" is betaal.
async function kry_besitte_eboeke(bestellingsStore, koper_id) {
  const besitte = new Set();
  const { blobs } = await bestellingsStore.list();
  for (const sleutel_item of blobs) {
    const bestelling = await bestellingsStore.get(sleutel_item.key, { type: "json" });
    if (!bestelling || bestelling.status !== "Nuut") continue;
    if (!bestelling.koper || bestelling.koper.netlify_identity_id !== koper_id) continue;
    for (const item of bestelling.items || []) {
      if (item.formaat === "eboek") besitte.add(item.produk_slug);
    }
  }
  return besitte;
}

// Die kodes wat die koper ingetik het, skoon en sonder duplikate. Aanvaar
// koepon_kodes (lys, nuut) en koepon_kode (een, ouer kliënte).
function skoon_kodes(invoer) {
  const ruwe = Array.isArray(invoer.koepon_kodes)
    ? invoer.koepon_kodes
    : invoer.koepon_kode ? [invoer.koepon_kode] : [];
  return [...new Set(ruwe.map((k) => String(k || "").trim().toUpperCase()).filter(Boolean))];
}

// Pas een koepon toe op 'n prys (sent).
function pas_koepon_toe(koepon, prys_sent) {
  if (koepon.tipe === "gratis") return 0;
  if (koepon.afslag_tipe === "vaste_bedrag") return Math.max(0, prys_sent - koepon.afslag_waarde);
  return Math.max(0, prys_sent - Math.round((prys_sent * koepon.afslag_waarde) / 100));
}

// Veldtog eerste, dan lojaliteit op die prys wat oorbly.
function sorteer_koepons(koepons) {
  return [...koepons].sort((a, b) => (koepon_soort(a) === "veldtog" ? 0 : 1) - (koepon_soort(b) === "veldtog" ? 0 : 1));
}

module.exports = {
  bou_koepon_velde,
  koepon_boeke,
  koepon_geld_vir_boek,
  koepon_soort,
  besit_voldoen,
  kry_besitte_eboeke,
  skoon_kodes,
  pas_koepon_toe,
  sorteer_koepons,
};
