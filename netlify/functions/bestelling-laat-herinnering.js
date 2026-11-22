// netlify/functions/bestelling-laat-herinnering.js
//
// GESKEDULEERD: elke oggend (sien netlify.toml). STAP 4 VAN "BESTELLINGS
// AFHANDEL" (November 2026).
//
// WAT DIT DOEN: soek betaalde harde-kopie-bestellings wat nog nie afgehandel
// is nie en ouer is as LAAT_NA_DAE dae, en stuur personeel EEN e-pos met al
// die bestellings wat sedert gister laat geword het.
//
// EEN KEER PER BESTELLING. Ná die pos kry elke bestelling in die pos
// bestelling.laat_kennisgewing = { gestuur_op }. Dié merker bly staan; 'n
// bestelling wat later weer oopgemaak word, kry nie weer 'n pos nie. Die
// paneelbord se Laat-oortjie bly die plek om te sien wat oop is.
//
// DIESELFDE REËL AS DIE PANEELBORD (paneel-bestellings-afhandel.js): status
// "Nuut", bevat_harde_kopie, versending.gestuur nie waar nie, en meer as
// LAAT_NA_DAE volle dae sedert geskep_op. Verander die een, verander die ander.
//
// ONTVANGER: BESTELLING_LAAT_AAN, anders ADMIN_EPOS, anders die admin-posbus
// self, soos gov-herinnering.js. Die pos gaan uit die admin-posbus.
//
// DIE MERKER WORD EERS NÁ DIE POS GESKRYF. Misluk die pos, word môre weer
// probeer.

const { kry_store } = require("./_blob-store");
const { stuur_epos, ontsnap } = require("./_stuur-epos");
const { outeur_by_produk_betrokke } = require("./_outeur-aandeel");

const LAAT_NA_DAE = 10;
const DAG_MS = 24 * 60 * 60 * 1000;
const BLADSY = "https://futureshop.futuresharp.co.za/paneelbord.html";

function ontvangers() {
  return process.env.BESTELLING_LAAT_AAN || process.env.ADMIN_EPOS || process.env.EPOS_ADMIN_GEBRUIKER || "";
}

function dae_sedert(iso, nou) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((nou - t) / DAG_MS));
}

function datum_kort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function is_laat(b, nou) {
  if (!b || b.status !== "Nuut" || !b.bevat_harde_kopie) return false;
  if (b.versending && b.versending.gestuur === true) return false;
  return dae_sedert(b.geskep_op, nou) > LAAT_NA_DAE;
}

exports.handler = async () => {
  const aan = ontvangers();
  if (!aan) {
    console.error("bestelling-laat-herinnering: geen ontvanger gestel nie (BESTELLING_LAAT_AAN of ADMIN_EPOS).");
    return { statusCode: 200, body: "geen ontvanger" };
  }

  const nou = Date.now();
  const store = kry_store("bestellings");

  let nuut_laat = [];
  try {
    const { blobs } = await store.list();
    for (const { key } of blobs || []) {
      const b = await store.get(key, { type: "json" }).catch(() => null);
      if (is_laat(b, nou) && !(b.laat_kennisgewing && b.laat_kennisgewing.gestuur_op)) {
        nuut_laat.push({ sleutel: key, b });
      }
    }
  } catch (fout) {
    console.error("bestelling-laat-herinnering: kon nie bestellings lees nie:", fout);
    return { statusCode: 500, body: "kon nie lees nie" };
  }

  if (!nuut_laat.length) return { statusCode: 200, body: "niks laat nie" };

  // Oudste eerste: dié wag die langste.
  nuut_laat.sort((x, y) => new Date(x.b.geskep_op) - new Date(y.b.geskep_op));

  // --- Outeursname, vir die pos. Nie-krities. ---
  let outeurs = [];
  const produkte = new Map();
  try {
    const o_store = kry_store("outeurs");
    const { blobs } = await o_store.list();
    outeurs = (await Promise.all((blobs || []).map((x) => o_store.get(x.key, { type: "json" }).catch(() => null)))).filter(Boolean);
    const katalogus = kry_store("katalogus");
    const slugs = new Set();
    nuut_laat.forEach(({ b }) =>
      (b.items || []).forEach((i) => i && i.formaat === "harde_kopie" && slugs.add(i.produk_slug))
    );
    for (const slug of slugs) {
      const p = await katalogus.get(slug, { type: "json" }).catch(() => null);
      if (p) produkte.set(slug, p);
    }
  } catch (fout) {
    console.warn("bestelling-laat-herinnering: kon nie outeurs of katalogus lees nie:", fout);
  }

  function outeursname(b) {
    const ps = (b.items || [])
      .filter((i) => i && i.formaat === "harde_kopie")
      .map((i) => produkte.get(i.produk_slug))
      .filter(Boolean);
    return outeurs.filter((o) => ps.some((p) => outeur_by_produk_betrokke(p, o.outeur_id))).map((o) => o.naam).filter(Boolean);
  }

  const blokke = nuut_laat.map(({ b }) => {
    const titels = [...new Set((b.items || []).filter((i) => i && i.formaat === "harde_kopie").map((i) => String(i.titel || "").trim()).filter(Boolean))];
    const name = outeursname(b);
    const afhaal = b.aflewering && b.aflewering.metode === "afhaal";
    return (
      `<b>${ontsnap(b.bestelnommer)}</b> · ${ontsnap(datum_kort(b.geskep_op))} · ${dae_sedert(b.geskep_op, nou)} dae<br>` +
      titels.map(ontsnap).join("<br>") +
      (name.length ? `<br>Outeur: ${ontsnap(name.join(", "))}` : "") +
      `<br>${afhaal ? "Afhaal" : "Koerier"}`
    );
  });

  const reels = [
    nuut_laat.length === 1
      ? `Hierdie bestelling is langer as ${LAAT_NA_DAE} dae nie afgehandel nie:`
      : `Hierdie ${nuut_laat.length} bestellings is langer as ${LAAT_NA_DAE} dae nie afgehandel nie:`,
    blokke.join("<br><br>"),
    "Merk dit in die paneelbord as afgehandel, of volg op met die outeur.",
  ];

  const uitslag = await stuur_epos({
    aan,
    onderwerp:
      nuut_laat.length === 1
        ? `Bestelling laat: ${nuut_laat[0].b.bestelnommer}`
        : `${nuut_laat.length} bestellings is laat`,
    opskrif: "Bestellings wat laat is",
    reels,
    knoppie: { url: BLADSY, teks: "Maak die paneelbord oop" },
    merk: "faktuur",
  });

  if (!uitslag || !uitslag.ok) {
    console.error("bestelling-laat-herinnering: e-pos het misluk:", uitslag && uitslag.fout);
    return { statusCode: 500, body: "e-pos het misluk" };
  }

  // --- Merker, NA die pos. Lees vars, sodat niks anders oorskryf word nie. ---
  const gestuur_op = new Date(nou).toISOString();
  let gemerk = 0;
  for (const { sleutel } of nuut_laat) {
    try {
      const vars = await store.get(sleutel, { type: "json" });
      if (!vars) continue;
      vars.laat_kennisgewing = { gestuur_op };
      await store.setJSON(sleutel, vars);
      gemerk++;
    } catch (fout) {
      // Die pos IS weg. Môre kom hierdie bestelling weer in die pos: hinderlik,
      // maar die veilige kant.
      console.error(`bestelling-laat-herinnering: kon nie ${sleutel} merk nie:`, fout);
    }
  }

  console.log(`bestelling-laat-herinnering: ${nuut_laat.length} in pos, ${gemerk} gemerk`);
  return { statusCode: 200, body: `gestuur=${nuut_laat.length}` };
};

exports._toets = { is_laat, dae_sedert, LAAT_NA_DAE };
