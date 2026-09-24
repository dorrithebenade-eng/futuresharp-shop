// Koper-beskermd — kyk of 'n koeponkode op 'n talk van toepassing is, en
// wat die prys dan is. FutureSharp Talks.
//
// Net 'n voorskou vir die talk-bladsy: begin-talk-betaling.js toets die
// koepon self weer voordat daar enigiets betaal of toegeken word.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { toets_talk_koepon } = require("./_talk-koepon");

const JSON_KOP = { "Content-Type": "application/json", "Cache-Control": "no-store" };

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const { gebruiker } = await kry_gebruiker_en_rol_uitslag(event, context, ["koper", "personeel"]);
  if (!gebruiker) return { statusCode: 401, headers: JSON_KOP, body: JSON.stringify({ fout_kode: "AANMELD" }) };

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const slug = String(invoer.slug || "").trim().toLowerCase();
  const talk = slug ? await kry_store("talks").get(slug, { type: "json" }) : null;
  if (!talk || talk.aktief === false) {
    return { statusCode: 404, headers: JSON_KOP, body: JSON.stringify({ fout_kode: "GEEN_TOEPASSING" }) };
  }

  const uitslag = await toets_talk_koepon(invoer.kode, gebruiker, talk);
  if (uitslag.fout_kode) {
    return { statusCode: 400, headers: JSON_KOP, body: JSON.stringify({ fout_kode: uitslag.fout_kode }) };
  }
  return {
    statusCode: 200,
    headers: JSON_KOP,
    body: JSON.stringify({
      geldig: true,
      kode: uitslag.koepon.kode,
      tipe: uitslag.koepon.tipe,
      oorspronklik_sent: talk.formate.video.prys_sent,
      prys_na_sent: uitslag.prys_na_sent,
    }),
  };
};
