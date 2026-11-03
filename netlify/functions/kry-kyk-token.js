// Reik 'n kort-lewende kykskakel uit vir een talk. FutureSharp Talks.
//
// 'n Gratis talk (prys R0, sonder toegangskode) speel vir enigiemand, ook
// sonder 'n profiel (November 2026). Vir enige ander talk moet die koper
// aangemeld wees en die talk besit.
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
const { talk_koopbaar } = require("./_talk-koopbaar");

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
  if (!process.env.MUX_SIGNING_KEY_ID || !process.env.MUX_SIGNING_KEY_PRIVATE) {
    return { statusCode: 500, body: "Die Mux-ondertekensleutel is nie in Netlify opgestel nie" };
  }

  const slug = String((event.queryStringParameters || {}).slug || "").trim().toLowerCase();
  if (!slug) return { statusCode: 400, body: "Geen talk nie" };

  const { gebruiker } = await kry_gebruiker_en_rol_uitslag(event, context, ["koper", "personeel"]);
  const is_personeel = !!gebruiker && ((gebruiker.app_metadata && gebruiker.app_metadata.roles) || []).includes("personeel");

  const video = await kry_store("talk-video").get(slug, { type: "json" });
  const talk = await kry_store("talks").get(slug, { type: "json" });
  const v = (talk && talk.formate && talk.formate.video) || {};
  const is_gratis = talk_koopbaar(talk, video).koopbaar && !v.net_koepon && !Math.round(v.prys_sent || 0);

  if (!is_gratis && !is_personeel) {
    if (!gebruiker) return { statusCode: 401, body: "Meld eers aan" };
    if (!(await besit_talk(gebruiker.id, slug))) {
      return { statusCode: 403, body: "Jy besit nie hierdie talk nie" };
    }
  }

  const playback_id = video && (video.stand === "gereed" ? video.playback_id : video.speel_playback_id);
  if (!playback_id) {
    return { statusCode: 404, body: "Die video is nog nie gereed nie" };
  }

  // KYK-TELLER vir die talk se profiel in die paneelbord. Elke keer wat 'n
  // koper die video in die teater oopmaak, tel een kyk; die lys kykers
  // (interne ID's, nooit teruggegee nie) gee die aantal verskillende kopers
  // wat gekyk het. Personeel se eie toetskyke tel nie. Beste-poging: 'n
  // fout hier mag die video nooit keer nie.
  if (!is_personeel) {
    try {
      const kyk_store = kry_store("talk-kyke");
      const huidig = (await kyk_store.get(slug, { type: "json" })) || {};
      const maand = new Date().toISOString().slice(0, 7);
      const per_maand = { ...(huidig.per_maand || {}) };
      per_maand[maand] = (per_maand[maand] || 0) + 1;
      const kykers = Array.isArray(huidig.kykers) ? huidig.kykers : [];
      if (gebruiker && !kykers.includes(gebruiker.id)) kykers.push(gebruiker.id);
      const anoniem = (huidig.anoniem || 0) + (gebruiker ? 0 : 1);
      await kyk_store.setJSON(slug, { totaal: (huidig.totaal || 0) + 1, per_maand, kykers, anoniem });
    } catch (fout) {
      console.warn("Kon nie kyk tel nie:", fout);
    }
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
