// FutureSharp Talks — voltooi 'n talk-bestelling ná 'n suksesvolle betaling.
//
// Twee paaie kom hier uit: die Paystack-webhook (die gesaghebbende een), en
// bevestig-talk-betaling.js, wat die teater roep wanneer die koper van
// Paystack terugkom en die webhook nog nie gevuur het nie. Albei gebruik
// voltooi_talk_bestelling(), en dit is idempotent.
//
// Die bedrag word nagegaan: Paystack se bedrag moet presies die bestelling
// se totaal wees. Klop dit nie, word die bestelling gemerk en GEEN toegang
// gegee nie; dit word nooit stilweg reggemaak nie.

const { kry_store } = require("./_blob-store");
const { gee_toegang } = require("./_talk-besit");

async function voltooi_talk_bestelling(bestelnommer, paystack_data) {
  const store = kry_store("talk-bestellings");
  const bestelling = await store.get(bestelnommer, { type: "json" });
  if (!bestelling) return { ok: false, rede: "onbekende_bestelling" };
  if (bestelling.status === "Betaal") return { ok: true, reeds: true };

  const bedrag = Number(paystack_data.amount);
  const nou = new Date().toISOString();

  if (bedrag !== bestelling.totaal_sent || String(paystack_data.currency || "ZAR").toUpperCase() !== "ZAR") {
    await store.setJSON(bestelnommer, {
      ...bestelling,
      status: "Bedrag klop nie",
      paystack: { ...bestelling.paystack, ontvang_sent: bedrag, geldeenheid: paystack_data.currency, gemerk_op: nou },
    });
    console.error(`Talk-bestelling ${bestelnommer}: Paystack-bedrag ${bedrag} klop nie met ${bestelling.totaal_sent} nie`);
    return { ok: false, rede: "bedrag_klop_nie" };
  }

  await store.setJSON(bestelnommer, {
    ...bestelling,
    status: "Betaal",
    betaal_op: nou,
    paystack: {
      ...bestelling.paystack,
      geverifieer: true,
      transaksie_id: paystack_data.id || null,
      kanaal: paystack_data.channel || null,
    },
  });

  await gee_toegang({
    identity_id: bestelling.koper.netlify_identity_id,
    slug: bestelling.slug,
    bestelnommer,
    bron: "koop",
    bedrag_sent: bestelling.totaal_sent,
  });

  return { ok: true };
}

// Vir paystack-webhook.js: net die metadata lees en oorgee.
async function hanteer_talk_betaling(data) {
  const bestelnommer = data.metadata && data.metadata.fst_bestelnommer;
  const uitslag = await voltooi_talk_bestelling(bestelnommer, data);
  if (!uitslag.ok && uitslag.rede === "onbekende_bestelling") {
    console.error(`Talk-webhook: geen bestelling ${bestelnommer} nie`);
  }
  // Altyd 200: Paystack moet nie aanhou herprobeer vir iets wat ons reeds
  // aangeteken het nie.
  return { statusCode: 200, body: "Talk-betaling verwerk" };
}

module.exports = { voltooi_talk_bestelling, hanteer_talk_betaling };
