// Gee die watermerkte PDF-inhoud van 'n gekoopte e-boek terug — die
// ENIGSTE manier om by 'n e-boek se werklike inhoud te kom (sien nota in
// laai-eboek-op.js).
//
// TOEGANG: aangesien hierdie Function se URL direk in 'n <iframe> se src
// gebruik word (vir die blaaier se ingeboude PDF-bekyker), kan geen
// Authorization-kopstuk gestuur word nie. Ons aanvaar dus 'n kort-
// leeftyd "?token="-parameter wat vooraf via kry-leser-token.js (met 'n
// regte Bearer-versoek) uitgereik is. 'n Bearer-kopstuk word ook steeds
// aanvaar as 'n toekomstige kliënt dit direk wil gebruik.
//
// GROOT LÊERS: Netlify Functions se ~6MB-antwoordgrootte-limiet beteken
// ons kan nooit die hele PDF in een HTTP-antwoord stuur nie. Ons
// ondersteun daarom HTTP Range-versoeke (soos 'n bediener wat groot
// video's/lêers bedien) — die blaaier se PDF-bekyker vra self stuk-vir-
// stuk aan. Ons stuur altyd hoogstens MAKS_ANTWOORD_GREPE per oproep
// terug, met 'n korrekte Content-Range-kopstuk, sodat die blaaier weet
// om die res in volgende versoeke aan te vra.
//
// KAS: die gemerkte PDF word EEN KEER per koper gegenereer (die
// watermerk bevat hul e-pos) en in 'n aparte "eboeke-gemerk"-store
// gestoor — daarna word slegs daardie reeds-gegenereerde kopie
// stuksgewys bedien, nie elke keer heropgebou nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { PDFDocument } = require("pdf-lib");

const MAKS_ANTWOORD_GREPE = 5 * 1024 * 1024; // 5MB per stuk, ruim onder die 6MB-limiet

async function verifieer_via_token(token, produk_slug) {
  if (!token) return null;
  const store = kry_store("leestokens");
  const rekord = await store.get(token, { type: "json" });
  if (!rekord) return null;
  if (rekord.produk_slug !== produk_slug) return null;
  if (Date.now() > rekord.verval_op) return null;
  return { id: rekord.gebruiker_id, email: rekord.gebruiker_epos };
}

// Gee 'n objek terug: { besit: boolean, rede: "koop" | "leen" | "leen_verval" | null }
// "leen_verval" beteken hulle HET geleen, maar dit het reeds verstryk —
// dié onderskeid laat die aanroeper 'n vriendelike, spesifieke
// foutboodskap wys i.p.v. 'n generiese "nooit gekoop nie".
async function besit_boek(gebruiker_id, produk_slug) {
  const bestellings_store = kry_store("bestellings");
  const { blobs } = await bestellings_store.list();

  let leen_gevind_maar_verval = false;

  for (const item of blobs) {
    const ruwe = await bestellings_store.get(item.key);
    if (!ruwe) continue;

    let bestelling;
    try {
      bestelling = JSON.parse(ruwe);
    } catch {
      continue;
    }

    const behoort_aan_koper =
      bestelling.koper && bestelling.koper.netlify_identity_id === gebruiker_id;
    const is_betaal = bestelling.status === "Nuut";
    if (!behoort_aan_koper || !is_betaal) continue;

    const items = Array.isArray(bestelling.items) ? bestelling.items : [];

    if (items.some((i) => i.produk_slug === produk_slug && i.formaat === "eboek")) {
      return { besit: true, rede: "koop" };
    }

    const leen_item = items.find((i) => i.produk_slug === produk_slug && i.formaat === "leen");
    if (leen_item) {
      if (leen_item.verval_op && new Date(leen_item.verval_op) > new Date()) {
        return { besit: true, rede: "leen", verval_op: leen_item.verval_op };
      }
      leen_gevind_maar_verval = true;
    }
  }
  return { besit: false, rede: leen_gevind_maar_verval ? "leen_verval" : null };
}

async function kry_of_genereer_gemerkte_kopie(produk_slug, gebruiker) {
  const gemerk_store = kry_store("eboeke-gemerk");
  // "-v3" forseer 'n vars-generasie ná die skuif van 'n sigbare
  // watermerk-bladsy na onsigbare dokument-metadata — ou "-v1"/"-v2"-
  // kopieë bly onskadelik ongebruik in Blobs staan.
  const gemerk_sleutel = `${produk_slug}--${gebruiker.id}-v3.pdf`;

  const bestaande = await gemerk_store.get(gemerk_sleutel, { type: "arrayBuffer" });
  if (bestaande) return Buffer.from(bestaande);

  const katalogus_store = kry_store("katalogus");
  const produk = await katalogus_store.get(produk_slug, { type: "json" });
  if (!produk || !produk.formate || !produk.formate.eboek || !produk.formate.eboek.eboek_sleutel) {
    return null;
  }

  const eboeke_store = kry_store("eboeke");
  const rou_pdf = await eboeke_store.get(produk.formate.eboek.eboek_sleutel, { type: "arrayBuffer" });
  if (!rou_pdf) return null;

  const pdf = await PDFDocument.load(rou_pdf);
  const koper_epos = gebruiker.email || "onbekende koper";
  // Onsigbare lisensie-/opsporing-merker — geen ekstra bladsy of sigbare
  // teks in die dokument self nie (dit lyk professioneler en steur nie
  // die leeservaring nie). Die koper-koppeling is steeds vasgelê in die
  // dokument se eie metadata, wat behoue bly selfs al word die PDF
  // gekopieer/herverspei — 'n mens hoef net die lêer se "Eienskappe" oop
  // te maak om te sien aan wie dit gekoppel is.
  pdf.setSubject(`Future Shop — gekoop deur ${koper_epos}`);
  pdf.setKeywords([`future-shop-koper:${koper_epos}`]);
  pdf.setProducer(`Future Shop — eksemplaar gekoppel aan ${koper_epos}`);

  const gemerkte_bytes = Buffer.from(await pdf.save());
  await gemerk_store.set(gemerk_sleutel, gemerkte_bytes, { metadata: { inhoud_tipe: "application/pdf" } });
  return gemerkte_bytes;
}

function ontleed_reeks(range_kopstuk, totale_grootte) {
  // Ondersteun net die algemene "bytes=start-" of "bytes=start-end"-vorm.
  if (!range_kopstuk || !range_kopstuk.startsWith("bytes=")) return null;
  const [ruwe_begin, ruwe_einde] = range_kopstuk.replace("bytes=", "").split("-");
  let begin = ruwe_begin ? parseInt(ruwe_begin, 10) : 0;
  let einde = ruwe_einde ? parseInt(ruwe_einde, 10) : totale_grootte - 1;
  if (Number.isNaN(begin)) begin = 0;
  if (Number.isNaN(einde) || einde >= totale_grootte) einde = totale_grootte - 1;
  return { begin, einde };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const parms = event.queryStringParameters || {};
  const produk_slug = parms.produk_slug;
  if (!produk_slug) {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ontbrekende 'produk_slug'-parameter" }) };
  }

  // Aanvaar Bearer-token (regte fetch-versoeke) OF ?token= (iframe-src,
  // sien nota bo).
  let gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    gebruiker = await verifieer_via_token(parms.token, produk_slug);
  }
  if (!gebruiker) {
    return { statusCode: 401, body: JSON.stringify({ fout: "Meld eers aan" }) };
  }

  try {
    const besit_status = await besit_boek(gebruiker.id, produk_slug);
    if (!besit_status.besit) {
      const boodskap =
        besit_status.rede === "leen_verval"
          ? "Jou leen-tydperk vir hierdie e-boek het verval. Koop dit, of leen dit weer, om verder te lees."
          : "Jy het nie hierdie e-boek gekoop of geleen nie";
      return { statusCode: 403, body: JSON.stringify({ fout: boodskap, leen_verval: besit_status.rede === "leen_verval" }) };
    }

    const volledige_pdf = await kry_of_genereer_gemerkte_kopie(produk_slug, gebruiker);
    if (!volledige_pdf) {
      return { statusCode: 404, body: JSON.stringify({ fout: "Hierdie e-boek is nog nie beskikbaar nie" }) };
    }

    const totale_grootte = volledige_pdf.length;
    const versoekte_reeks = ontleed_reeks(event.headers.range || event.headers.Range, totale_grootte);

    const begin = versoekte_reeks ? versoekte_reeks.begin : 0;
    let einde = versoekte_reeks ? versoekte_reeks.einde : totale_grootte - 1;
    // Beperk elke antwoord tot MAKS_ANTWOORD_GREPE, ongeag wat aangevra is.
    if (einde - begin + 1 > MAKS_ANTWOORD_GREPE) {
      einde = begin + MAKS_ANTWOORD_GREPE - 1;
    }

    const stuk = volledige_pdf.slice(begin, einde + 1);
    const is_gedeeltelik = begin > 0 || einde < totale_grootte - 1;

    return {
      statusCode: is_gedeeltelik ? 206 : 200,
      headers: {
        "Content-Type": "application/pdf",
        "Accept-Ranges": "bytes",
        "Content-Length": String(stuk.length),
        ...(is_gedeeltelik ? { "Content-Range": `bytes ${begin}-${einde}/${totale_grootte}` } : {}),
        // Persoonlik gemerk per koper — moet NOOIT gekas word nie.
        "Cache-Control": "no-store",
      },
      body: stuk.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (fout) {
    console.error("kry-eboek-inhoud fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie e-boek laai nie" }) };
  }
};
