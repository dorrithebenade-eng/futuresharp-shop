// Koper-beskermd — begin die aankoop van een talk. FutureSharp Talks.
//
// Apart van begin-betaling.js (die boeke se mandjie), sodat die boeke se
// betaalvloei heeltemal onaangeraak bly. Dieselfde beginsels:
//   - die prys en die verdeling word BEDIENER-KANT uit die talk gelees,
//     nooit uit die blaaier nie;
//   - 'n Paystack Split word op die vlug geskep vir die subrekeninge
//     (bearer_type "account": Future Sharp dra Paystack se fooi);
//   - misluk die split (bv. 'n verkeerde subrekening-kode), gaan die
//     betaling tog deur na die hoofrekening, en die fout word aangeteken;
//   - die hoofrekening behou altyd genoeg om Paystack se fooi te dek.
//
// Die bestelling leef in "talk-bestellings". Die webhook (via
// _talk-betaling.js) merk dit as betaal en gee toegang.
//
// 'n Talk met prys R0 (of R0 ná 'n gratis-koepon) word sonder Paystack
// dadelik toegeken. 'n Koepon word hier opnuut getoets, nooit uit die
// blaaier geglo nie; die gebruik word eers aangeteken wanneer die talk
// werklik toegeken is.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { kry_maks_verdeling_sent } = require("./_paystack-koste.js");
const { talk_koopbaar } = require("./_talk-koopbaar");
const { besit_talk, gee_toegang } = require("./_talk-besit");
const { toets_talk_koepon, merk_talk_koepon_gebruik } = require("./_talk-koepon");

const PUBLIEKE_WERF = "https://futureshop.futuresharp.co.za";
const REGISTER_VIR_ROL = { spreker: "sprekers", ontwerp_admin: "ontwerp-admin" };

function maak_bestelnommer() {
  const d = new Date();
  const datum = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  const karakters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let agter = "";
  for (let i = 0; i < 5; i++) agter += karakters[Math.floor(Math.random() * karakters.length)];
  return `FST-${datum}-${agter}`;
}

// Bereken elke subrekening se deel in sent. Rye sonder 'n subrekening
// (bv. 'n spreker wat nog "wag vir subrekening") bly by die hoofrekening en
// word in `nota` aangeteken.
// Hosting soos by die boeke (begin-betaling.js): 'n persentasie of vaste
// bedrag van die verkoopprys wat in die hoofrekening bly, apart gemerk sodat
// dit nie vir 'n spreker beskikbaar gestel word nie.
function bereken_hosting(hosting, prys_sent) {
  if (!hosting || !prys_sent) return 0;
  return hosting.tipe === "vaste_bedrag"
    ? Math.min(Math.round(hosting.waarde), prys_sent)
    : Math.round((prys_sent * hosting.waarde) / 100);
}

async function bereken_verdeling(verdelings, prys_sent, hosting_sent) {
  const per_subrekening = {};
  const nota = [];
  for (const v of verdelings || []) {
    const store_naam = REGISTER_VIR_ROL[v.rol_tipe];
    if (!store_naam) continue;
    const entiteit = await kry_store(store_naam).get(v.entiteit_id, { type: "json" });
    const kode = entiteit && (entiteit.subrekening_kode || "").trim();
    const bedrag = v.tipe === "vaste_bedrag" ? Math.round(v.waarde) : Math.floor((prys_sent * v.waarde) / 100);
    if (!kode) {
      nota.push(`${v.rol_tipe} ${v.entiteit_id}: geen subrekening nie, ${bedrag} sent bly by die hoofrekening`);
      continue;
    }
    per_subrekening[kode] = (per_subrekening[kode] || 0) + bedrag;
  }

  // Laaste vangnet: die hoofrekening moet Paystack se fooi kan dra, en die
  // hosting bly daarbo in die hoofrekening (soos by die boeke).
  const totaal = Object.values(per_subrekening).reduce((a, b) => a + b, 0);
  const maks = kry_maks_verdeling_sent(prys_sent) - (hosting_sent || 0);
  if (totaal > maks && totaal > 0) {
    const faktor = Math.max(maks, 0) / totaal;
    for (const kode of Object.keys(per_subrekening)) {
      per_subrekening[kode] = Math.floor(per_subrekening[kode] * faktor);
    }
    nota.push("verdeling proporsioneel verklein om Paystack se fooi te dek");
  }
  return { per_subrekening, nota };
}

async function skep_split(bestelnommer, per_subrekening, prys_sent) {
  const kodes = Object.keys(per_subrekening).filter((k) => per_subrekening[k] > 0);
  if (!kodes.length) return { split_code: null, split_fout: null };
  try {
    const resp = await fetch("https://api.paystack.co/split", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Talk ${bestelnommer}`,
        type: "percentage",
        currency: "ZAR",
        subaccounts: kodes.map((kode) => ({
          subaccount: kode,
          share: Math.round((per_subrekening[kode] / prys_sent) * 10000) / 100,
        })),
        bearer_type: "account",
      }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.status) {
      console.error(`Kon nie split skep nie vir ${bestelnommer}; val terug op hoofrekening:`, data);
      return { split_code: null, split_fout: (data && data.message) || "Onbekende Paystack-fout" };
    }
    return { split_code: data.data.split_code, split_fout: null };
  } catch (fout) {
    console.error(`Split-fout vir ${bestelnommer}; val terug op hoofrekening:`, fout);
    return { split_code: null, split_fout: fout.message };
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const { gebruiker, rede } = await kry_gebruiker_en_rol_uitslag(event, context, ["koper", "personeel"]);
  if (!gebruiker) return { statusCode: 401, body: "Meld eers aan" };
  if (rede === "geen_rol") return { statusCode: 403, body: "Hierdie rekening kan nie koop nie" };

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const slug = String(invoer.slug || "").trim().toLowerCase();

  const talk = slug ? await kry_store("talks").get(slug, { type: "json" }) : null;
  const video = slug ? await kry_store("talk-video").get(slug, { type: "json" }) : null;
  const k = talk_koopbaar(talk, video);
  if (!k.koopbaar) {
    return { statusCode: 400, body: "Hierdie talk kan nog nie gekoop word nie" };
  }

  // Reeds joune: geen tweede betaling nie.
  if (await besit_talk(gebruiker.id, slug)) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reeds: true, teater: `/teater?talk=${encodeURIComponent(slug)}` }),
    };
  }

  const lys_prys_sent = Math.round((talk.formate.video.prys_sent) || 0);
  let prys_sent = lys_prys_sent;
  let koepon_kode = null;
  if (invoer.koepon_kode) {
    const k = await toets_talk_koepon(invoer.koepon_kode, gebruiker, talk);
    if (k.fout_kode) {
      return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fout_kode: k.fout_kode }) };
    }
    prys_sent = k.prys_na_sent;
    koepon_kode = k.koepon.kode;
  }
  const bestelnommer = maak_bestelnommer();
  const nou = new Date().toISOString();
  const koper = { netlify_identity_id: gebruiker.id, epos: gebruiker.email };

  // 'n Gratis talk: dadelik toegeken, sonder Paystack.
  if (prys_sent === 0) {
    await kry_store("talk-bestellings").setJSON(bestelnommer, {
      bestelnommer, slug, titel: talk.titel, koper, lys_prys_sent, prys_sent: 0, totaal_sent: 0,
      koepon_kode, status: "Betaal", betaal_op: nou, geskep_op: nou, gratis: true,
    });
    await gee_toegang({ identity_id: gebruiker.id, slug, bestelnommer, bron: koepon_kode ? "koepon" : "gratis", bedrag_sent: 0 });
    if (koepon_kode) await merk_talk_koepon_gebruik(koepon_kode, gebruiker.id, slug, bestelnommer);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gratis: true, teater: `/teater?talk=${encodeURIComponent(slug)}` }),
    };
  }

  const hosting_totaal_sent = bereken_hosting(talk.formate.video.hosting, prys_sent);
  const { per_subrekening, nota } = await bereken_verdeling(talk.formate.video.verdelings, prys_sent, hosting_totaal_sent);
  const { split_code, split_fout } = await skep_split(bestelnommer, per_subrekening, prys_sent);

  const bestelling = {
    bestelnommer,
    slug,
    titel: talk.titel,
    spreker_ids: talk.spreker_ids || [],
    koper,
    lys_prys_sent,
    prys_sent,
    totaal_sent: prys_sent,
    hosting_totaal_sent,
    koepon_kode,
    verdeling: Object.keys(per_subrekening).length ? per_subrekening : null,
    verdeling_nota: nota,
    split_code,
    split_fout,
    paystack: { verwysing: bestelnommer, geverifieer: false },
    status: "Wag vir betaling",
    geskep_op: nou,
  };
  await kry_store("talk-bestellings").setJSON(bestelnommer, bestelling);

  const liggaam = {
    email: gebruiker.email,
    amount: prys_sent,
    reference: bestelnommer,
    currency: "ZAR",
    callback_url: `${PUBLIEKE_WERF}/teater?talk=${encodeURIComponent(slug)}&bestelnommer=${bestelnommer}`,
    metadata: { fst_bestelnommer: bestelnommer, fst_slug: slug },
  };
  if (split_code) liggaam.split_code = split_code;

  try {
    const resp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(liggaam),
    });
    const data = await resp.json();
    if (!resp.ok || !data.status) {
      console.error(`Paystack-inisiëring het misluk vir ${bestelnommer}:`, data);
      return { statusCode: 502, body: "Kon nie die betaling by Paystack begin nie" };
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorization_url: data.data.authorization_url, bestelnommer }),
    };
  } catch (fout) {
    console.error(`Fout tydens Paystack-inisiëring vir ${bestelnommer}:`, fout);
    return { statusCode: 500, body: "Kon nie die betaling begin nie" };
  }
};
