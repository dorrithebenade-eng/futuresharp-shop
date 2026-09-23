// FutureSharp Talks — wie besit watter talk, en die verkope per talk.
//
// "talk-besit": een rekord per koper per talk, met die sleutel
//   <netlify_identity_id>/<slug>
// sodat My Teater met een list({ prefix }) al 'n koper se talks kry.
//
// "talk-verkope": een rekord per talk { aantal, bruto_sent } vir die
// Sprekerspaneel, en om te keer dat 'n gekoopte talk geskrap word.
//
// gee_toegang() is idempotent: 'n webhook wat twee keer vuur, of 'n
// bevestiging deur die blaaier wat saam met die webhook kom, gee nie twee
// keer toegang of tel nie twee keer nie.

const { kry_store } = require("./_blob-store");

function besit_sleutel(identity_id, slug) {
  return `${identity_id}/${slug}`;
}

async function besit_talk(identity_id, slug) {
  if (!identity_id || !slug) return null;
  return kry_store("talk-besit").get(besit_sleutel(identity_id, slug), { type: "json" });
}

async function gee_toegang({ identity_id, slug, bestelnommer, bron, bedrag_sent }) {
  const store = kry_store("talk-besit");
  const sleutel = besit_sleutel(identity_id, slug);
  if (await store.get(sleutel, { type: "json" })) return false;

  await store.setJSON(sleutel, {
    identity_id,
    slug,
    bestelnommer: bestelnommer || null,
    bron: bron || "koop",
    bedrag_sent: bedrag_sent || 0,
    verkry_op: new Date().toISOString(),
  });

  const verkope = kry_store("talk-verkope");
  const huidig = (await verkope.get(slug, { type: "json" })) || { aantal: 0, bruto_sent: 0 };
  await verkope.setJSON(slug, {
    aantal: (huidig.aantal || 0) + 1,
    bruto_sent: (huidig.bruto_sent || 0) + (bedrag_sent || 0),
    laaste_op: new Date().toISOString(),
  });
  return true;
}

async function lys_my_talks(identity_id) {
  const store = kry_store("talk-besit");
  const { blobs } = await store.list({ prefix: `${identity_id}/` });
  const rekords = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return rekords.filter(Boolean);
}

module.exports = { besit_talk, gee_toegang, lys_my_talks };
