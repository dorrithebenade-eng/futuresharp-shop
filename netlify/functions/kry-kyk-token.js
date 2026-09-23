// Koper-beskermd — reik 'n kort-lewende kykskakel uit vir een talk.
// FutureSharp Talks.
//
// Die video is by Mux met 'n "signed" speelbeleid: dit speel net met 'n
// geldige JWT wat met ons Signing Key onderteken is. Hierdie Function gee
// so 'n token net aan iemand wat die talk besit (of personeel, om te toets),
// en dit verval ná ses uur. 'n Skakel wat aangestuur word, werk dus nie
// lank nie.
//
// Drie tokens: "v" vir die video self, "t" vir die voorskouprent, en "s"
// vir die storyboard (die prentjies op die tydlyn).

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { besit_talk } = require("./_talk-besit");

const GELDIGHEID_SEKONDES = 6 * 60 * 60;

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function teken_mux_jwt(playback_id, aud) {
  const sleutel = Buffer.from(process.env.MUX_SIGNING_KEY_PRIVATE, "base64").toString("utf8");
  const kop = { alg: "RS256", typ: "JWT", kid: process.env.MUX_SIGNING_KEY_ID };
  const vrag = { sub: playback_id, aud, exp: Math.floor(Date.now() / 1000) + GELDIGHEID_SEKONDES };
  const inhoud = `${b64url(JSON.stringify(kop))}.${b64url(JSON.stringify(vrag))}`;
  const handtekening = crypto.createSign("RSA-SHA256").update(inhoud).sign(sleutel);
  return `${inhoud}.${b64url(handtekening)}`;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const { gebruiker } = await kry_gebruiker_en_rol_uitslag(event, context, ["koper", "personeel"]);
  if (!gebruiker) return { statusCode: 401, body: "Meld eers aan" };
  if (!process.env.MUX_SIGNING_KEY_ID || !process.env.MUX_SIGNING_KEY_PRIVATE) {
    return { statusCode: 500, body: "Die Mux-ondertekensleutel is nie in Netlify opgestel nie" };
  }

  const slug = String((event.queryStringParameters || {}).slug || "").trim().toLowerCase();
  const is_personeel = ((gebruiker.app_metadata && gebruiker.app_metadata.roles) || []).includes("personeel");
  if (!slug || (!is_personeel && !(await besit_talk(gebruiker.id, slug)))) {
    return { statusCode: 403, body: "Jy besit nie hierdie talk nie" };
  }

  const video = await kry_store("talk-video").get(slug, { type: "json" });
  const playback_id = video && (video.stand === "gereed" ? video.playback_id : video.speel_playback_id);
  if (!playback_id) {
    return { statusCode: 404, body: "Die video is nog nie gereed nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({
      playback_id,
      tokens: {
        playback: teken_mux_jwt(playback_id, "v"),
        thumbnail: teken_mux_jwt(playback_id, "t"),
        storyboard: teken_mux_jwt(playback_id, "s"),
      },
      geldig_tot: new Date(Date.now() + GELDIGHEID_SEKONDES * 1000).toISOString(),
    }),
  };
};
