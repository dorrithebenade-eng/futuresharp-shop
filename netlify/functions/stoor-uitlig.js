// netlify/functions/stoor-uitlig.js
//
// Koper-beskermd (ook personeel). Voeg 'n uitlig by, verwyder een, of
// verander sy kleur of nota (November 2026). Net vir 'n boek wat die
// leser mag lees (_lees-toegang.js).
//
// Invoer (JSON):
//   { produk_slug, aksie: "voeg_by", bladsy, kleur, teks, reghoeke,
//     weergawe?, totaal_bladsye?, nota? }
//   { produk_slug, aksie: "verwyder", id }
//   { produk_slug, aksie: "nota", id, nota }
//   { produk_slug, aksie: "kleur", id, kleur }
// Antwoord: { uitligte } — die volledige, bygewerkte lys.
//
// reghoeke: [[x, y, b, h], ...] as breuke van die bladsy (0 tot 1), sodat
// die uitlig by elke zoemvlak en skermgrootte op dieselfde plek val. Die
// gekose teks word saam gestoor vir die lys in die Inhoud-paneel.

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { mag_lees } = require("./_lees-toegang");

const KLEURE = ["geel", "groen", "pienk"];
const MAKS_UITLIGTE = 1000;
const MAKS_REGHOEKE = 80;
const MAKS_TEKS = 600;
const MAKS_NOTA = 80;

function skoon_teks(teks, maks) {
  return String(teks || "").replace(/\s+/g, " ").trim().slice(0, maks);
}

function skoon_reghoeke(invoer) {
  if (!Array.isArray(invoer)) return null;
  const uit = [];
  for (const r of invoer.slice(0, MAKS_REGHOEKE)) {
    if (!Array.isArray(r) || r.length !== 4) return null;
    const getalle = r.map(Number);
    if (getalle.some((g) => !Number.isFinite(g) || g < -0.01 || g > 1.01)) return null;
    uit.push(getalle.map((g) => Math.round(g * 10000) / 10000));
  }
  return uit.length ? uit : null;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["koper", "personeel"]);
  if (!gebruiker) {
    return { statusCode: 401, body: JSON.stringify({ fout: "Meld eers aan" }) };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ongeldige JSON" }) };
  }

  const { produk_slug, aksie } = invoer || {};
  if (!produk_slug || !["voeg_by", "verwyder", "nota", "kleur"].includes(aksie)) {
    return { statusCode: 400, body: JSON.stringify({ fout: "Verpligte velde: produk_slug, aksie" }) };
  }

  try {
    if (!(await mag_lees(gebruiker, produk_slug))) {
      return { statusCode: 403, body: JSON.stringify({ fout: "Geen toegang tot hierdie e-boek nie" }) };
    }

    const store = kry_store("uitligte");
    const sleutel = `${produk_slug}--${gebruiker.id}`;
    const rekord = (await store.get(sleutel, { type: "json" })) || {};
    let uitligte = Array.isArray(rekord.uitligte) ? rekord.uitligte : [];

    if (aksie === "voeg_by") {
      const bladsy = Number(invoer.bladsy);
      const reghoeke = skoon_reghoeke(invoer.reghoeke);
      const teks = skoon_teks(invoer.teks, MAKS_TEKS);
      if (!Number.isInteger(bladsy) || bladsy < 1 || !reghoeke || !teks || !KLEURE.includes(invoer.kleur)) {
        return { statusCode: 400, body: JSON.stringify({ fout: "Ongeldige uitlig" }) };
      }
      if (uitligte.length >= MAKS_UITLIGTE) {
        return { statusCode: 400, body: JSON.stringify({ fout: `Hoogstens ${MAKS_UITLIGTE} uitligte per boek` }) };
      }
      const weergawe = typeof invoer.weergawe === "string" && invoer.weergawe.length <= 200 ? invoer.weergawe : null;
      const totaal = Number(invoer.totaal_bladsye);
      uitligte.push({
        id: crypto.randomBytes(6).toString("hex"),
        bladsy,
        kleur: invoer.kleur,
        teks,
        reghoeke,
        weergawe,
        totaal_bladsye: Number.isInteger(totaal) && totaal >= 1 ? totaal : null,
        nota: skoon_teks(invoer.nota, MAKS_NOTA),
        geskep_op: new Date().toISOString(),
      });
    } else {
      const id = String(invoer.id || "");
      if (!uitligte.some((u) => u.id === id)) {
        return { statusCode: 404, body: JSON.stringify({ fout: "Uitlig nie gevind nie" }) };
      }
      if (aksie === "verwyder") {
        uitligte = uitligte.filter((u) => u.id !== id);
      } else if (aksie === "nota") {
        uitligte = uitligte.map((u) => (u.id === id ? { ...u, nota: skoon_teks(invoer.nota, MAKS_NOTA) } : u));
      } else {
        if (!KLEURE.includes(invoer.kleur)) {
          return { statusCode: 400, body: JSON.stringify({ fout: "Onbekende kleur" }) };
        }
        uitligte = uitligte.map((u) => (u.id === id ? { ...u, kleur: invoer.kleur } : u));
      }
    }

    // Bladsyvolgorde, en binne 'n bladsy van bo na onder.
    uitligte.sort((a, b) => a.bladsy - b.bladsy || (a.reghoeke[0][1] - b.reghoeke[0][1]) || (a.reghoeke[0][0] - b.reghoeke[0][0]));
    await store.setJSON(sleutel, { uitligte, bygewerk_op: new Date().toISOString() });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ uitligte }),
    };
  } catch (fout) {
    console.error("stoor-uitlig fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie uitlig stoor nie" }) };
  }
};
