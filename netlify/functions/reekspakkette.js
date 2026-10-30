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
  const uit = [];
  for (const p of pakkette) {
    let los_sent = 0;
    const boeke = [];
    for (const slug of p.slugs) {
      const produk = await katalogus.get(slug, { type: "json" });
      const eboek = produk && produk.formate && produk.formate.eboek;
      const prys = eboek && eboek.beskikbaar ? eboek.prys_sent : 0;
      los_sent += prys;
      boeke.push({ slug, titel: produk ? produk.titel : slug, prys_sent: prys });
    }
    uit.push({
      id: p.id,
      naam_af: p.naam_af,
      naam_en: p.naam_en,
      slugs: p.slugs,
      prys_sent: p.prys_sent,
      los_sent,
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
