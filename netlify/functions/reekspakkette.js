// netlify/functions/reekspakkette.js
//
// REEKSPAKKETTE (Oktober 2026). Sien _reekspakkette.js vir die reëls.
//
// GET (publiek)                 -> { pakkette } wat nou aktief is, met die
//                                  los prys van die boeke (vir die produkbladsy)
// GET ?alles=1 (personeel)      -> { pakkette } almal, vir die paneel
// POST (personeel) { aksie: "stoor", pakket }   -> skep of wysig
// POST (personeel) { aksie: "skrap", id }

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { lees_pakkette, skryf_pakkette, kry_aktiewe_pakkette } = require("./_reekspakkette");
const { koepon_boeke, koepon_geld_vir_boek, koepon_soort, pas_koepon_toe } = require("./_koepon-velde");

// AANBOD (November 2026): die produkbladsy wys die prys wat die koper werklik
// betaal, met 'n openbare veldtogkode (bv. SPEELSLIM) wat op al die boeke van
// die pakket geld. Net kodes wat enigiemand mag gebruik.
async function openbare_veldtogkoepons() {
  const store = kry_store("koepons");
  const { blobs } = await store.list();
  const uit = [];
  for (const b of blobs) {
    const k = await store.get(b.key, { type: "json" });
    if (!k || !k.aktief || k.koper_id_beperking || k.vereis_besit) continue;
    if (koepon_soort(k) !== "veldtog" || k.formaat_beperking === "video" || k.formaat_beperking === "leen") continue;
    if (k.verval_op && new Date(k.verval_op) < new Date()) continue;
    if ((k.gebruike_tot_dusver || 0) >= (k.maks_gebruike || 0)) continue;
    uit.push(k);
  }
  // Die mees spesifieke kode eerste (bv. SPEELSLIM voor 'n kode vir alle boeke).
  return uit.sort((a, b) => ((koepon_boeke(a) || []).length || 9999) - ((koepon_boeke(b) || []).length || 9999));
}

function versprei(bedrag_sent, n) {
  const basis = Math.floor(bedrag_sent / n);
  const oor = bedrag_sent - basis * n;
  return Array.from({ length: n }, (_, i) => basis + (i < oor ? 1 : 0));
}

function beste_aanbod(pakket, koepons) {
  if (!pakket.koepon_toegelaat) return null;
  let beste = null;
  for (const k of koepons) {
    if (!pakket.slugs.every((s) => koepon_geld_vir_boek(k, s))) continue;
    const prys = versprei(pakket.prys_sent, pakket.slugs.length).reduce((som, d) => som + pas_koepon_toe(k, d), 0);
    if (prys < pakket.prys_sent && (!beste || prys < beste.prys_sent)) {
      beste = { kode: k.kode, prys_sent: prys, tot: k.verval_op || null };
    }
  }
  return beste;
}

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const antwoord = (status, data) => ({ statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) });

const teks = (w, maks) => String(w == null ? "" : w).trim().slice(0, maks);

function skoon_id(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function skoon_datum(w) {
  if (!w) return null;
  const d = new Date(w);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// Die los prys van elke boek in die pakket, uit die katalogus.
async function met_los_pryse(pakkette) {
  const katalogus = kry_store("katalogus");
  let koepons = [];
  try {
    koepons = await openbare_veldtogkoepons();
  } catch (_) {
    koepons = [];
  }
  const uit = [];
  for (const p of pakkette) {
    let los_sent = 0;
    let druk_sent = 0;
    let hk_almal = true;
    const boeke = [];
    for (const slug of p.slugs) {
      const produk = await katalogus.get(slug, { type: "json" });
      const eboek = produk && produk.formate && produk.formate.eboek;
      const hk = produk && produk.formate && produk.formate.harde_kopie;
      const prys = eboek && eboek.beskikbaar ? eboek.prys_sent : 0;
      los_sent += prys;
      const hk_ok = !!(hk && hk.beskikbaar && !(Array.isArray(hk.opsies) && hk.opsies.length));
      if (!hk_ok) hk_almal = false;
      const druk = hk_ok ? Math.max(0, Math.round(Number(hk.drukkoste_sent) || 0)) : 0;
      druk_sent += druk;
      boeke.push({ slug, titel: produk ? produk.titel : slug, prys_sent: prys, ...(hk_ok ? { hk_prys_sent: hk.prys_sent } : {}) });
    }
    uit.push({
      id: p.id,
      naam_af: p.naam_af,
      naam_en: p.naam_en,
      slugs: p.slugs,
      prys_sent: p.prys_sent,
      trappe: p.trappe || [],
      tel_nie: p.tel_nie || [],
      koepon_toegelaat: p.koepon_toegelaat === true,
      los_sent,
      aanbod: beste_aanbod(p, koepons),
      harde_kopie: hk_almal ? { druk_sent } : null,
      van: p.van,
      tot: p.tot,
      boeke,
    });
  }
  return uit;
}

async function stoor(invoer) {
  const p = invoer.pakket || {};
  const naam_af = teks(p.naam_af, 120);
  if (!naam_af) return antwoord(400, { fout: "Gee die pakket 'n naam" });
  const slugs = [...new Set((Array.isArray(p.slugs) ? p.slugs : []).map((s) => teks(s, 80)).filter(Boolean))];
  if (slugs.length < 2) return antwoord(400, { fout: "Kies minstens twee boeke" });
  const prys_rand = Number(p.prys_rand);
  if (!Number.isFinite(prys_rand) || prys_rand <= 0) return antwoord(400, { fout: "Ongeldige pakketprys" });
  const van = skoon_datum(p.van);
  const tot = skoon_datum(p.tot);
  if (van === undefined || tot === undefined) return antwoord(400, { fout: "Ongeldige datum" });

  // Trappe: "2=240; 4=230" (getal boeke = prys per boek in rand), of 'n lys.
  const trappe = [];
  const ruwe_trappe = Array.isArray(p.trappe)
    ? p.trappe.map((t) => [t.min, t.prys_rand != null ? t.prys_rand : (t.prys_per_boek_sent || 0) / 100])
    : String(p.trappe_teks || "").split(/[;\n]+/).map((d) => d.split("=").map((x) => x.trim().replace(",", ".").replace(/^R/i, "")));
  for (const [min_r, rand_r] of ruwe_trappe) {
    if (min_r === undefined || min_r === "") continue;
    const min = Math.round(Number(min_r));
    const rand = Number(rand_r);
    if (!Number.isInteger(min) || min < 1 || !Number.isFinite(rand) || rand <= 0) {
      return antwoord(400, { fout: "Ongeldige trap. Skryf dit so: 2=240; 4=230" });
    }
    trappe.push({ min, prys_per_boek_sent: Math.round(rand * 100) });
  }
  trappe.sort((a, b) => a.min - b.min);
  const tel_nie = [...new Set((Array.isArray(p.tel_nie) ? p.tel_nie : []).map((s) => teks(s, 80)).filter((s) => slugs.includes(s)))];

  const lys = await lees_pakkette();
  const id = skoon_id(p.id || naam_af);
  if (!id) return antwoord(400, { fout: "Ongeldige naam" });
  const bestaande = lys.find((x) => x.id === id);

  const rekord = {
    id,
    naam_af,
    naam_en: teks(p.naam_en, 120) || naam_af,
    slugs,
    prys_sent: Math.round(prys_rand * 100),
    trappe,
    tel_nie,
    koepon_toegelaat: p.koepon_toegelaat === true,
    van,
    tot,
    aktief: p.aktief !== false,
    gewysig_op: new Date().toISOString(),
  };
  await skryf_pakkette(bestaande ? lys.map((x) => (x.id === id ? rekord : x)) : [...lys, rekord]);
  return antwoord(200, { pakket: rekord });
}

exports.handler = async (event, context) => {
  try {
    const q = event.queryStringParameters || {};

    if (event.httpMethod === "GET" && q.alles !== "1") {
      const pakkette = await met_los_pryse(await kry_aktiewe_pakkette());
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
        body: JSON.stringify({ pakkette }),
      };
    }

    const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
    if (!gebruiker) return antwoord(403, { fout: "Geen toegang nie, personeel-rol vereis" });

    if (event.httpMethod === "GET") {
      return antwoord(200, { pakkette: await met_los_pryse(await lees_pakkette()), rou: await lees_pakkette() });
    }
    if (event.httpMethod !== "POST") return antwoord(405, { fout: "Metode nie toegelaat nie" });

    let invoer;
    try {
      invoer = JSON.parse(event.body || "{}");
    } catch {
      return antwoord(400, { fout: "Ongeldige JSON" });
    }
    if (invoer.aksie === "stoor") return await stoor(invoer);
    if (invoer.aksie === "skrap") {
      const id = skoon_id(invoer.id);
      await skryf_pakkette((await lees_pakkette()).filter((x) => x.id !== id));
      return antwoord(200, { ok: true });
    }
    return antwoord(400, { fout: "Onbekende aksie" });
  } catch (fout) {
    console.error("reekspakkette fout:", fout);
    return antwoord(500, { fout: "Kon nie die reekspakkette hanteer nie" });
  }
};
