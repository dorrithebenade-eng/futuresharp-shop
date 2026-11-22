// netlify/functions/volg-op-met-outeur.js
//
// STAP 3 VAN "BESTELLINGS AFHANDEL" (November 2026). Personeel druk "Volg op
// met outeur" by 'n harde-kopie-bestelling wat nog nie gestuur is nie. Elke
// outeur van 'n harde kopie in die bestelling kry een e-pos, en die bestelling
// hou rekord van wanneer en aan wie opgevolg is (bestelling.opvolg).
//
// WIE IS "DIE OUTEUR": dieselfde toets as merk-bestelling-gestuur.js, wat
// besluit wie die bestelling mag merk (outeur_by_produk_betrokke). Wie dit kan
// merk, is wie opgevolg word.
//
// NET MET DIE HAND. Daar is geen outomatiese opvolg aan outeurs nie (besluit
// 22 Nov 2026); personeel besluit wanneer.
//
// DIE REKORD WORD EERS NA DIE POS GESKRYF, en slegs vir die outeurs wie se pos
// werklik uitgegaan het. Gaan geen pos uit nie, word niks aangeteken nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { outeur_by_produk_betrokke } = require("./_outeur-aandeel");
const { stuur_epos, ontsnap } = require("./_stuur-epos");

const WERF_URL = "https://futureshop.futuresharp.co.za";

function datum_kort(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const bestelnommer = String(invoer.bestelnommer || "").trim();
  if (!bestelnommer) {
    return { statusCode: 400, body: "Verpligte veld: bestelnommer" };
  }

  const store = kry_store("bestellings");
  const bestelling = await store.get(bestelnommer, { type: "json" });
  if (!bestelling) {
    return { statusCode: 404, body: "Geen bestelling met daardie nommer nie" };
  }
  if (!bestelling.bevat_harde_kopie) {
    return { statusCode: 400, body: "Hierdie bestelling bevat geen harde kopie nie" };
  }
  if (bestelling.versending && bestelling.versending.gestuur === true) {
    return { statusCode: 400, body: "Hierdie bestelling is reeds afgehandel" };
  }

  // --- Die harde kopieë en hulle produkte ---
  const harde_items = (bestelling.items || []).filter((i) => i && i.formaat === "harde_kopie");
  const katalogus = kry_store("katalogus");
  const produkte = (
    await Promise.all(
      [...new Set(harde_items.map((i) => i.produk_slug))].map((slug) =>
        katalogus.get(slug, { type: "json" }).catch(() => null)
      )
    )
  ).filter(Boolean);

  // --- Die outeurs ---
  const outeur_store = kry_store("outeurs");
  const { blobs } = await outeur_store.list();
  const outeurs = (
    await Promise.all((blobs || []).map((b) => outeur_store.get(b.key, { type: "json" }).catch(() => null)))
  ).filter(Boolean);

  const betrokke = outeurs.filter((o) => produkte.some((p) => outeur_by_produk_betrokke(p, o.outeur_id)));
  if (!betrokke.length) {
    return { statusCode: 400, body: "Geen outeur gevind vir die boeke in hierdie bestelling nie" };
  }

  const titels = [...new Set(harde_items.map((i) => String(i.titel || "").trim()).filter(Boolean))];
  const dae = Math.max(0, Math.floor((Date.now() - new Date(bestelling.geskep_op).getTime()) / 86400000));

  const gestuur_aan = [];
  const sonder_epos = [];

  for (const outeur of betrokke) {
    const aan = String((outeur.kontak_inligting && outeur.kontak_inligting.epos) || "").trim();
    if (!aan) {
      sonder_epos.push(outeur.naam || outeur.outeur_id);
      continue;
    }

    // Net sy eie titels in sy pos; 'n bestelling kan ander outeurs se boeke hê.
    const sy_titels = harde_items
      .filter((i) => produkte.some((p) => p.slug === i.produk_slug && outeur_by_produk_betrokke(p, outeur.outeur_id)))
      .map((i) => String(i.titel || "").trim())
      .filter(Boolean);
    const lys = [...new Set(sy_titels.length ? sy_titels : titels)];

    const uitslag = await stuur_epos({
      aan,
      onderwerp: `Bestelling ${bestelnommer} wag om gestuur te word`,
      opskrif: "'n Bestelling wag nog",
      reels: [
        `Bestelling <b>${ontsnap(bestelnommer)}</b> van ${ontsnap(datum_kort(bestelling.geskep_op))} is nog nie as gestuur gemerk nie. Dit is nou ${dae} dae sedert die bestelling.`,
        lys.map((t) => `<b>${ontsnap(t)}</b>`).join("<br>"),
        "Merk dit in jou outeurspaneel onder Bestellings as gestuur sodra dit weg is, met die spoornommer as jy een het. Die koper kry dan outomaties 'n e-pos.",
        "Is daar 'n vertraging of 'n probleem, antwoord gerus op hierdie e-pos.",
      ],
      knoppie: { teks: "Maak my outeurspaneel oop", url: `${WERF_URL}/outeur.html` },
    });

    if (uitslag && uitslag.ok) {
      gestuur_aan.push({ outeur_id: outeur.outeur_id, naam: outeur.naam || "" });
    } else {
      console.error(`Opvolg-pos aan ${outeur.outeur_id} vir ${bestelnommer} het misluk:`, uitslag && uitslag.fout);
    }
  }

  if (!gestuur_aan.length) {
    const rede = sonder_epos.length
      ? `Geen e-posadres vir: ${sonder_epos.join(", ")}`
      : "Die e-pos kon nie gestuur word nie";
    return { statusCode: 502, body: rede };
  }

  // Lees vars voor die skryf: die outeur kon intussen as gestuur gemerk het.
  const vars = (await store.get(bestelnommer, { type: "json" })) || bestelling;
  const bygewerk = {
    ...vars,
    opvolg: [
      ...(vars.opvolg || []),
      { op: new Date().toISOString(), deur: String(gebruiker.email || "").trim().toLowerCase(), aan: gestuur_aan },
    ],
  };
  await store.setJSON(bestelnommer, bygewerk);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bestelling: bygewerk, aan: gestuur_aan, sonder_epos }),
  };
};
