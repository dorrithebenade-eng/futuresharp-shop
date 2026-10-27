// netlify/functions/advertensies.js
//
// ADVERTENSIES (Oktober 2026). Rol: personeel.
//
// Die paneel se afdeling Advertensies hou al die klaar advertensies (die
// winkel, die reekse, Black Friday ensovoorts) op een plek, elk met die
// WhatsApp-boodskap wat daarby hoort. Personeel deel dit van die foon af:
// as prent (met die boodskap) of as skakel, /a/<slug>, wat op WhatsApp die
// advertensie as voorskou wys en dan na die winkel stuur (advertensie-bladsy.js).
//
// STORE: "advertensies", sleutel "lys" = die rekords. Die beelde van
// advertensies wat in die paneel opgelaai is, is in "advertensie-beelde":
// <slug> is die volle beeld, <slug>-og die 1200x630-voorskou. Die eerste
// advertensies is statiese lêers in public/images/advertensies/ en het net
// paaie (beeld.vol en beeld.og).
//
// GET: { advertensies }
// POST { aksie: "stoor", advertensie, beeld_vol_b64?, beeld_og_b64? }
// POST { aksie: "skrap", slug }

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const antwoord = (status, data) => ({ statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) });
const store = () => kry_store("advertensies");
const beelde = () => kry_store("advertensie-beelde");

const MAKS_BEELD = 4 * 1024 * 1024;
const WINKEL = "https://futureshop.futuresharp.co.za/";

async function lees() { return (await store().get("lys", { type: "json" })) || []; }
async function skryf(lys) { await store().setJSON("lys", lys); }

const teks = (w, maks) => String(w == null ? "" : w).replace(/\r/g, "").trim().slice(0, maks);

function skoon_slug(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Net ons eie werf of 'n https-adres; niks anders nie.
function skoon_bestemming(u) {
  const w = teks(u, 500);
  if (!w) return WINKEL;
  if (w.startsWith("/")) return WINKEL.replace(/\/$/, "") + w;
  return /^https:\/\//i.test(w) ? w : WINKEL;
}

function skoon_pad(p) {
  const w = teks(p, 200);
  return /^\/images\/(advertensies|koepon)\/[A-Za-z0-9._-]+$/.test(w) ? w : "";
}

function dekodeer(b64) {
  if (!b64) return null;
  const buf = Buffer.from(String(b64).replace(/^data:[^,]+,/, ""), "base64");
  if (!buf.length || buf.length > MAKS_BEELD) return "te_groot";
  // JPEG begin met FF D8.
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return "nie_jpeg";
  return buf;
}

async function stoor(invoer, gebruiker) {
  const a = invoer.advertensie || {};
  const titel = teks(a.titel, 120);
  if (!titel) return antwoord(400, { fout: "Gee die advertensie 'n titel" });

  const lys = await lees();
  const bestaande_slug = skoon_slug(a.slug);
  const bestaande = bestaande_slug ? lys.find((x) => x.slug === bestaande_slug) : null;

  let slug = bestaande ? bestaande.slug : skoon_slug(a.slug || titel);
  if (!slug) return antwoord(400, { fout: "Ongeldige kort naam" });
  if (!bestaande) {
    let n = 2;
    const basis = slug;
    while (lys.some((x) => x.slug === slug)) slug = `${basis}-${n++}`;
  }

  const vol = dekodeer(invoer.beeld_vol_b64);
  const og = dekodeer(invoer.beeld_og_b64);
  for (const b of [vol, og]) {
    if (b === "te_groot") return antwoord(400, { fout: "Die beeld is groter as 4 MB" });
    if (b === "nie_jpeg") return antwoord(400, { fout: "Die beeld moet 'n JPG wees" });
  }

  let beeld = bestaande ? bestaande.beeld : null;
  if (vol && og) {
    await beelde().set(slug, vol);
    await beelde().set(`${slug}-og`, og);
    beeld = { soort: "blob", v: ((bestaande && bestaande.beeld && bestaande.beeld.v) || 0) + 1 };
  } else if (a.beeld && a.beeld.vol && a.beeld.og) {
    const p_vol = skoon_pad(a.beeld.vol);
    const p_og = skoon_pad(a.beeld.og);
    if (p_vol && p_og) beeld = { soort: "staties", vol: p_vol, og: p_og, pdf: skoon_pad(a.beeld.pdf) || null };
  }
  if (!beeld) return antwoord(400, { fout: "Kies 'n beeld vir die advertensie" });

  const nou = new Date().toISOString();
  const rekord = {
    slug,
    titel,
    groep: teks(a.groep, 60) || "Ander",
    taal: a.taal === "en" ? "en" : "af",
    boodskap: teks(a.boodskap, 2000),
    bestemming: skoon_bestemming(a.bestemming),
    aktief: a.aktief !== false,
    volgorde: Number.isFinite(Number(a.volgorde)) ? Number(a.volgorde) : bestaande ? bestaande.volgorde : lys.length + 1,
    beeld,
    geskep_op: bestaande ? bestaande.geskep_op : nou,
    geskep_deur: bestaande ? bestaande.geskep_deur : gebruiker.email,
    gewysig_op: nou,
    gewysig_deur: gebruiker.email,
  };

  const nuwe_lys = bestaande ? lys.map((x) => (x.slug === slug ? rekord : x)) : [...lys, rekord];
  await skryf(nuwe_lys);
  return antwoord(200, { advertensie: rekord });
}

async function skrap(invoer) {
  const slug = skoon_slug(invoer.slug);
  const lys = await lees();
  const rekord = lys.find((x) => x.slug === slug);
  if (!rekord) return antwoord(404, { fout: "Advertensie nie gevind nie" });
  await skryf(lys.filter((x) => x.slug !== slug));
  if (rekord.beeld && rekord.beeld.soort === "blob") {
    await beelde().delete(slug);
    await beelde().delete(`${slug}-og`);
  }
  return antwoord(200, { ok: true });
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) return antwoord(403, { fout: "Geen toegang nie, personeel-rol vereis" });

  try {
    if (event.httpMethod === "GET") {
      const lys = await lees();
      lys.sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0));
      return antwoord(200, { advertensies: lys });
    }
    if (event.httpMethod !== "POST") return antwoord(405, { fout: "Metode nie toegelaat nie" });

    let invoer;
    try {
      invoer = JSON.parse(event.body || "{}");
    } catch {
      return antwoord(400, { fout: "Ongeldige JSON" });
    }
    if (invoer.aksie === "stoor") return await stoor(invoer, gebruiker);
    if (invoer.aksie === "skrap") return await skrap(invoer);
    return antwoord(400, { fout: "Onbekende aksie" });
  } catch (fout) {
    console.error("advertensies fout:", fout);
    return antwoord(500, { fout: "Kon nie die advertensies hanteer nie" });
  }
};
