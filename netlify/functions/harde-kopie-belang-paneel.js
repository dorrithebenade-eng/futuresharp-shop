// netlify/functions/harde-kopie-belang-paneel.js
//
// PERSONEEL: die "Laat weet my"-lyste vir harde kopieë.
//
// GET                 -> { per_slug: { <slug>: { wag, gestuur, jongste, laaste_stuur } } }
// POST { slug }       -> stuur die kennisgewing aan almal wat nog wag
//
// Die kennisgewing gaan net uit as die boek se harde kopie reeds beskikbaar
// is; anders sou die skakel in die e-pos na 'n bladsy lei waar niks te koop
// is nie. Elke ontvanger kry sy eie e-pos (geen lys in "Aan" nie), en word
// eers as gestuur gemerk wanneer sy pos deurgekom het.
//
// HOOGSTENS 40 PER DRUK. Die posbus stuur een vir een, en 'n Function het
// net 'n paar sekondes. Wag daar meer, sê die antwoord hoeveel oor is, en
// die paneelbord vra om weer te druk.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { stuur_epos, ontsnap } = require("./_stuur-epos");
const { lees, skryf, opsomming, skoon_slug } = require("./_harde-kopie-belang");

const WERF_URL = "https://futureshop.futuresharp.co.za";
const MAKS_PER_DRUK = 40;

function antwoord(kode, data) {
  return {
    statusCode: kode,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(data),
  };
}

function rand(sent) {
  const r = Number(sent || 0) / 100;
  return "R" + (Number.isInteger(r) ? String(r) : r.toFixed(2));
}

function bou_pos(produk, taal) {
  const titel = ontsnap(produk.titel || "");
  const prys = rand(produk.formate.harde_kopie.prys_sent);
  const url = `${WERF_URL}/produk.html?produk=${encodeURIComponent(produk.slug)}`;
  if (taal === "en") {
    return {
      onderwerp: `The printed copy of ${produk.titel} is now available`,
      opskrif: "Your printed copy is ready to order",
      reels: [
        `You asked us to let you know when the printed copy of <b>${titel}</b> becomes available. It is now on sale.`,
        `The price is <b>${prys}</b>, with delivery in South Africa included.`,
        "This is the only e-mail we will send you about it.",
      ],
      knoppie: { teks: "Order the printed copy", url },
    };
  }
  return {
    onderwerp: `Die harde kopie van ${produk.titel} is nou te koop`,
    opskrif: "Die harde kopie is nou te koop",
    reels: [
      `Jy het gevra dat ons jou laat weet wanneer die harde kopie van <b>${titel}</b> beskikbaar is. Dit is nou te koop.`,
      `Die prys is <b>${prys}</b>, met aflewering binne Suid-Afrika ingesluit.`,
      "Dit is die enigste e-pos wat ons jou hieroor stuur.",
    ],
    knoppie: { teks: "Bestel die harde kopie", url },
  };
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) return antwoord(403, { fout: "Geen toegang nie" });

  try {
    if (event.httpMethod === "GET") {
      return antwoord(200, { per_slug: await opsomming() });
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Metode nie toegelaat nie" };
    }

    let invoer;
    try {
      invoer = JSON.parse(event.body || "{}");
    } catch {
      return antwoord(400, { fout: "Ongeldige versoek" });
    }
    const slug = skoon_slug(invoer.slug);
    if (!slug) return antwoord(400, { fout: "Onbekende boek" });

    const produk = await kry_store("katalogus").get(slug, { type: "json" });
    const hk = produk && produk.formate && produk.formate.harde_kopie;
    if (!produk || !hk || !hk.beskikbaar) {
      return antwoord(409, { fout: "Maak eers die harde kopie beskikbaar en stoor die boek." });
    }

    const rekord = await lees(slug);
    const wag = rekord.inskrywings.filter((i) => !i.gestuur_op);
    const hierdie_keer = wag.slice(0, MAKS_PER_DRUK);

    let gestuur = 0;
    let misluk = 0;
    for (const inskrywing of hierdie_keer) {
      const pos = bou_pos(produk, inskrywing.taal);
      const uitslag = await stuur_epos({ aan: inskrywing.epos, ...pos });
      if (uitslag.ok) {
        inskrywing.gestuur_op = new Date().toISOString();
        gestuur++;
      } else {
        misluk++;
        console.error(`Harde-kopie-kennisgewing aan ${inskrywing.epos} het misluk:`, uitslag.fout);
      }
    }
    await skryf(rekord);

    return antwoord(200, {
      ok: true,
      gestuur,
      misluk,
      oor: wag.length - hierdie_keer.length + misluk,
    });
  } catch (fout) {
    console.error("harde-kopie-belang-paneel:", fout);
    return antwoord(500, { fout: "Iets het fout gegaan" });
  }
};
