// netlify/functions/ontvang-geskenk.js
//
// Die ontvanger los 'n geskenkkode in. Sien _geskenke.js.
//
// POST { kode }  (Identity-token, rol "koper")
// -> 200 { bestelnommer, items: [titel], oorgeslaan: [titel] }
// -> 400 { fout: "ONBEKEND" | "REEDS_ONTVANG" | "BESIT_ALMAL" }
//
// Skep 'n R0-bestelling op die ontvanger se naam met die geskenk se boeke.
// Dit is GEEN verkoop nie: geen inkomste, geen verdeling, geen outeurpos of
// -tellers. Dié is klaar aangeteken toe die geskenk gekoop is. Elke item dra
// `via_geskenk` sodat stade dit oorslaan.
//
// 'n Boek wat die ontvanger reeds besit, word oorgeslaan. Besit hy almal, word
// die kode NIE gebruik nie, sodat die koper dit vir iemand anders kan gee.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { lees_geskenk, stoor_geskenk, is_eie_item } = require("./_geskenke");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const antwoord = (status, data) => ({ statusCode: status, headers: JSON_KOP, body: JSON.stringify(data) });

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return antwoord(405, { fout: "Metode nie toegelaat nie" });

  const { gebruiker, rede } = await kry_gebruiker_en_rol_uitslag(event, context, "koper");
  if (rede === "geen_token") return antwoord(401, { fout: "MELD_AAN" });
  if (rede !== "ok") return antwoord(403, { fout: "GEEN_KOPERPROFIEL" });

  let invoer;
  try {
    invoer = JSON.parse(event.body || "{}");
  } catch {
    return antwoord(400, { fout: "Ongeldige JSON" });
  }

  try {
    const geskenk = await lees_geskenk(invoer.kode);
    if (!geskenk) return antwoord(400, { fout: "ONBEKEND" });
    if (geskenk.ontvang) return antwoord(400, { fout: "REEDS_ONTVANG" });

    // Wat besit die ontvanger reeds?
    const bestellings = kry_store("bestellings");
    const besit = new Set();
    const { blobs } = await bestellings.list();
    for (const b of blobs) {
      const rekord = await bestellings.get(b.key, { type: "json" });
      if (!rekord || rekord.status !== "Nuut") continue;
      if (!rekord.koper || rekord.koper.netlify_identity_id !== gebruiker.id) continue;
      for (const item of rekord.items || []) {
        if (is_eie_item(item) && item.formaat === "eboek") besit.add(item.produk_slug);
      }
    }

    const nuut = (geskenk.items || []).filter((i) => !besit.has(i.produk_slug));
    const oorgeslaan = (geskenk.items || []).filter((i) => besit.has(i.produk_slug));
    if (!nuut.length) {
      return antwoord(400, { fout: "BESIT_ALMAL", oorgeslaan: oorgeslaan.map((i) => i.titel) });
    }

    // Bestelnommer in die winkel se vorm, met 'n G vir geskenk.
    const jaar = new Date().getFullYear();
    let bestelnommer;
    for (let poging = 0; poging < 5; poging++) {
      bestelnommer = `FS-${jaar}-G${Math.floor(100000 + Math.random() * 900000)}`;
      if (!(await bestellings.get(bestelnommer, { type: "json" }))) break;
    }

    const nou = new Date().toISOString();
    const bestelling = {
      bestelnommer,
      geskep_op: nou,
      bygewerk_op: nou,
      koper: {
        epos: gebruiker.email || "",
        selfoonnommer: "",
        netlify_identity_id: gebruiker.id,
      },
      items: nuut.map((i) => ({
        produk_slug: i.produk_slug,
        titel: i.titel,
        formaat: "eboek",
        prys_sent: 0,
        via_geskenk: geskenk.kode,
      })),
      totaal_sent: 0,
      hosting_totaal_sent: 0,
      bevat_harde_kopie: false,
      aflewering: null,
      verdeling: null,
      split_code: null,
      split_fout: null,
      koepon_toegepas: null,
      koepons_toegepas: [],
      geskenk_ontvang: { kode: geskenk.kode, gekoop_in: geskenk.bestelnommer },
      drukker: null,
      paystack: {
        referensie: bestelnommer,
        geverifieer: true,
        geverifieer_op: nou,
        bedrag_bevestig_sent: 0,
        gratis_via_geskenk: true,
      },
      status: "Nuut",
      status_geskiedenis: [{ status: "Nuut", op: nou }],
    };

    // Merk die kode eers as gebruik, en dan die bestelling. Twee gelyktydige
    // pogings met dieselfde kode lees albei "nie ontvang nie"; die tweede
    // lees hieronder vang dit in die meeste gevalle.
    const weer = await lees_geskenk(geskenk.kode);
    if (weer && weer.ontvang) return antwoord(400, { fout: "REEDS_ONTVANG" });
    await stoor_geskenk({
      ...geskenk,
      ontvang: {
        op: nou,
        deur_id: gebruiker.id,
        deur_epos: gebruiker.email || "",
        bestelnommer,
        oorgeslaan: oorgeslaan.map((i) => i.produk_slug),
      },
    });
    await bestellings.setJSON(bestelnommer, bestelling);

    return antwoord(200, {
      bestelnommer,
      items: nuut.map((i) => i.titel),
      oorgeslaan: oorgeslaan.map((i) => i.titel),
    });
  } catch (fout) {
    console.error("ontvang-geskenk fout:", fout);
    return antwoord(500, { fout: "FOUT" });
  }
};
