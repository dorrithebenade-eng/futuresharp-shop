// Koper-beskermd — alles vir die Sprekerspaneel, in een oproep.
// FutureSharp Talks.
//
// Gee die aangemelde spreker se profiel, sy talks met hul syfers, en elke
// aankoop van sy talks (vir die staat) terug. Net sy eie: die koppeling in
// _my-spreker.js is die grens, nie die rol nie.
//
// GELD, SOOS BY DIE OUTEURS: per aankoop drie getalle. Die prys, sy deel,
// en Future Sharp se deel (die res). Die res word nooit verder uitgesplits
// nie. Sy deel is wat na SY subrekening gegaan het; het die Paystack Split
// vir 'n aankoop misluk, het niks na hom gegaan nie, en dan staan dit as
// "uitstaande" sodat Future Sharp dit met die hand kan regmaak.
//
// Nooit teruggegee nie: die subrekening-kode, die kopers se identiteit.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_spreker } = require("./_my-spreker");

const KONTAK_SIGBAAR = ["epos", "selfoon", "adres", "bank_naam", "bank_tak_kode"];

function verdoesel(nommer) {
  const skoon = String(nommer || "").replace(/\s+/g, "");
  return skoon.length <= 4 ? skoon : `•••• ${skoon.slice(-4)}`;
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["koper", "personeel"]);
  if (!gebruiker) return { statusCode: 401, body: "Meld eers aan" };

  const { spreker, status, boodskap } = await kry_my_spreker(gebruiker);
  if (!spreker) return { statusCode: status, body: boodskap };

  // ?kort=1: net "is hierdie persoon 'n spreker?", vir die rolskakelaar en
  // die kop se skakel. Geen syfers nie, dus goedkoop.
  if ((event.queryStringParameters || {}).kort) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ spreker: { spreker_id: spreker.spreker_id, naam: spreker.naam } }),
    };
  }

  const kode = (spreker.subrekening_kode || "").trim();

  // Sy talks.
  const talks_store = kry_store("talks");
  const { blobs: talk_blobs } = await talks_store.list();
  const talks = (await Promise.all(talk_blobs.map((b) => talks_store.get(b.key, { type: "json" }))))
    .filter((t) => t && (t.spreker_ids || []).includes(spreker.spreker_id));
  const slugs = new Set(talks.map((t) => t.slug));

  // Die aankope van sy talks.
  const best_store = kry_store("talk-bestellings");
  const { blobs: best_blobs } = await best_store.list();
  const bestellings = (await Promise.all(best_blobs.map((b) => best_store.get(b.key, { type: "json" }))))
    .filter((b) => b && slugs.has(b.slug) && b.status === "Betaal");

  const aankope = bestellings
    .map((b) => {
      const prys = Number(b.totaal_sent) || 0;
      const toegeken = b.split_code && b.verdeling ? Number(b.verdeling[kode]) || 0 : 0;
      // Wat hy sou kry as die split gewerk het: sy verdeling-ry teen die prys.
      let beoog = toegeken;
      if (!b.split_code && prys > 0) {
        const talk = talks.find((t) => t.slug === b.slug);
        const ry = talk && ((talk.formate && talk.formate.video && talk.formate.video.verdelings) || [])
          .find((v) => v.rol_tipe === "spreker" && v.entiteit_id === spreker.spreker_id);
        if (ry) beoog = ry.tipe === "vaste_bedrag" ? Math.round(ry.waarde) : Math.floor((prys * ry.waarde) / 100);
      }
      return {
        datum: String(b.betaal_op || b.geskep_op || "").slice(0, 10),
        slug: b.slug,
        titel: b.titel,
        prys_sent: prys,
        jou_deel_sent: toegeken,
        future_sharp_sent: prys - toegeken,
        gratis: prys === 0,
        koepon: Boolean(b.koepon_kode),
        uitstaande_sent: Math.max(0, beoog - toegeken),
      };
    })
    .sort((a, b) => b.datum.localeCompare(a.datum));

  // Per talk: besoeke uit "talk-besigtigings", kopers en sy deel uit die aankope.
  const besig_store = kry_store("talk-besigtigings");
  const video_store = kry_store("talk-video");
  const talk_uit = await Promise.all(talks.map(async (t) => {
    const besoeke = (await besig_store.get(t.slug, { type: "json" })) || { totaal: 0, per_maand: {} };
    const video = await video_store.get(t.slug, { type: "json" });
    const hierdie = aankope.filter((a) => a.slug === t.slug);
    const v = (t.formate && t.formate.video) || {};
    return {
      slug: t.slug,
      titel: t.titel,
      omslag: t.omslag || "",
      kategoriee: t.kategoriee || [],
      aktief: t.aktief !== false,
      beskikbaar: !!v.beskikbaar,
      video_gereed: Boolean(video && (video.stand === "gereed" || video.speel_playback_id)),
      prys_sent: v.prys_sent || 0,
      duur_sekondes: v.duur_sekondes || 0,
      besoeke: { totaal: besoeke.totaal || 0, per_maand: besoeke.per_maand || {} },
      kopers: hierdie.length,
      betaalde_kopers: hierdie.filter((a) => !a.gratis).length,
      jou_deel_sent: hierdie.reduce((s, a) => s + a.jou_deel_sent, 0),
    };
  }));
  talk_uit.sort((a, b) => a.titel.localeCompare(b.titel, "af"));

  const kontak = spreker.kontak_inligting || {};
  const kontak_uit = {};
  KONTAK_SIGBAAR.forEach((v) => { if (kontak[v]) kontak_uit[v] = kontak[v]; });
  if (kontak.bank_rekeningnommer) kontak_uit.bank_rekeningnommer = verdoesel(kontak.bank_rekeningnommer);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({
      spreker: {
        spreker_id: spreker.spreker_id,
        naam: spreker.naam,
        uitbetaling_gereed: Boolean(kode),
        kontak: kontak_uit,
      },
      talks: talk_uit,
      aankope,
    }),
  };
};
