// PUBLIEK — die talks vir die FST-blad en die talk-bladsy.
// FutureSharp Talks.
//
// Net aktiewe talks, en net die velde wat 'n besoeker mag sien. Die
// verdeling, die Bunny video-ID en wie wat geskep het, bly op die bediener.
//
//   GET                 alle aktiewe talks, nuutste eerste, plus die kategorieë
//   GET ?slug=<slug>    een talk (404 as dit nie bestaan of nie aktief is nie)

const { kry_store } = require("./_blob-store");
const { FST_KATEGORIEE } = require("./_fst-kategoriee");

function publiek(t) {
  const v = (t.formate && t.formate.video) || {};
  return {
    slug: t.slug,
    titel: t.titel,
    spreker: t.spreker,
    kategoriee: t.kategoriee || [],
    sleutelwoorde: t.sleutelwoorde || [],
    oorsig: t.oorsig || "",
    vol_beskrywing: t.vol_beskrywing || "",
    omslag: t.omslag || "",
    etiket: t.etiket || null,
    geskep_op: t.geskep_op,
    video: {
      beskikbaar: !!v.beskikbaar,
      prys_sent: v.prys_sent || 0,
      duur_sekondes: v.duur_sekondes || 0,
      vrystelling_datum: v.vrystelling_datum || null,
    },
  };
}

const KOPPE = {
  "Content-Type": "application/json",
  // Kort, sodat 'n nuwe of gewysigde talk binne 'n minuut verskyn.
  "Cache-Control": "public, max-age=60",
};

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const store = kry_store("talks");
  const slug = String((event.queryStringParameters || {}).slug || "").trim().toLowerCase();

  if (slug) {
    const talk = await store.get(slug, { type: "json" });
    if (!talk || talk.aktief === false) {
      return { statusCode: 404, headers: KOPPE, body: JSON.stringify({ talk: null }) };
    }
    return { statusCode: 200, headers: KOPPE, body: JSON.stringify({ talk: publiek(talk), kategoriee: FST_KATEGORIEE }) };
  }

  const { blobs } = await store.list();
  const talks = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }))))
    .filter((t) => t && t.aktief !== false)
    .sort((a, b) => String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")))
    .map(publiek);

  return { statusCode: 200, headers: KOPPE, body: JSON.stringify({ talks, kategoriee: FST_KATEGORIEE }) };
};
