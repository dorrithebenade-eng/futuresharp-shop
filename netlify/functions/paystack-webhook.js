// Paystack roep hierdie URL aan wanneer 'n betaling-gebeurtenis plaasvind:
//   https://<jou-werf>.netlify.app/.netlify/functions/paystack-webhook
// Stel dit as die "Webhook URL" in die Paystack-kontrolepaneel (Settings > API Keys & Webhooks).
//
// BELANGRIK: dit is die GESAGHEBBENDE bevestiging van betaling — nie die
// client-side "dankie"-bladsy nie. 'n Koper kan die blaaier toemaak voor
// die bevestigingsbladsy laai, veral met volume; die webhook vuur steeds
// af omdat dit direk van Paystack se bediener af kom.

const crypto = require("crypto");
const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  // Verifieer dat die versoek werklik van Paystack af kom — die
  // handtekening word met die geheime sleutel bereken en moet ooreenstem.
  const handtekening = event.headers["x-paystack-signature"];
  const verwagte_handtekening = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(event.body)
    .digest("hex");

  if (handtekening !== verwagte_handtekening) {
    console.warn("Paystack-webhook: ongeldige handtekening ontvang");
    return { statusCode: 401, body: "Ongeldige handtekening" };
  }

  const gebeurtenis = JSON.parse(event.body);

  // Ons stel net belang in suksesvolle betalings; ander gebeurtenisse
  // (bv. mislukte pogings) word erken maar nie verder verwerk nie.
  if (gebeurtenis.event !== "charge.success") {
    return { statusCode: 200, body: "Erken (geen aksie geneem nie)" };
  }

  const data = gebeurtenis.data;
  const bestelnommer = data.reference;

  const store = kry_store("bestellings");
  const bestelling = await store.get(bestelnommer, { type: "json" });

  if (!bestelling) {
    console.error(`Webhook: geen konsep-bestelling gevind vir ${bestelnommer}`);
    return { statusCode: 404, body: "Geen ooreenstemmende bestelling gevind nie" };
  }

  // Verhoed dubbele verwerking as Paystack dieselfde gebeurtenis weer stuur
  if (bestelling.paystack && bestelling.paystack.geverifieer) {
    return { statusCode: 200, body: "Reeds geverifieer" };
  }

  // Bevestig dat die betaalde bedrag ooreenstem met wat verwag is —
  // beskerm teen manipulasie van die bedrag tussen voltooi-betaling en betaling.
  if (data.amount !== bestelling.totaal_sent) {
    console.error(
      `Webhook: bedrag-teenstrydigheid vir ${bestelnommer} — verwag ${bestelling.totaal_sent}, ontvang ${data.amount}`
    );
    return { statusCode: 400, body: "Bedrag stem nie ooreen nie" };
  }

  const nou = new Date().toISOString();

  const bygewerkte_bestelling = {
    ...bestelling,
    paystack: {
      referensie: bestelnommer,
      geverifieer: true,
      geverifieer_op: nou,
      bedrag_bevestig_sent: data.amount,
      split_toegepas: data.split || null,
    },
    status: "Nuut",
    bygewerk_op: nou,
    status_geskiedenis: [...(bestelling.status_geskiedenis || []), { status: "Nuut", op: nou }],
  };

  await store.setJSON(bestelnommer, bygewerkte_bestelling);

  // E-boek-ontsluiting (Fase 4) sal hierdie status = "Nuut" +
  // paystack.geverifieer = true as sein gebruik om outomaties te ontsluit.

  return { statusCode: 200, body: "Bestelling bevestig" };
};
