// Koper-beskermd — bevestig 'n talk-betaling wanneer die koper van Paystack
// terugkom. FutureSharp Talks.
//
// Die webhook is die gesaghebbende pad, maar dit kan 'n paar sekondes ná
// die koper se terugkeer kom. Die teater roep dit dan: is die bestelling
// nog nie betaal nie, vra ons Paystack self (Verify Transaction) en voltooi
// dit op dieselfde manier as die webhook. Die bedrag word by Paystack
// nagegaan, nie in die blaaier nie.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_rol_uitslag } = require("./_rol-kontrole");
const { voltooi_talk_bestelling } = require("./_talk-betaling");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const { gebruiker } = await kry_gebruiker_en_rol_uitslag(event, context, ["koper", "personeel"]);
  if (!gebruiker) return { statusCode: 401, body: "Meld eers aan" };

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }
  const bestelnommer = String(invoer.bestelnommer || "").trim();
  const bestelling = bestelnommer ? await kry_store("talk-bestellings").get(bestelnommer, { type: "json" }) : null;
  if (!bestelling || bestelling.koper.netlify_identity_id !== gebruiker.id) {
    return { statusCode: 404, body: "Geen sodanige bestelling nie" };
  }

  const antwoord = (stand) => ({
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ stand, slug: bestelling.slug }),
  });

  if (bestelling.status === "Betaal") return antwoord("betaal");

  try {
    const resp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(bestelling.paystack.verwysing)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const data = await resp.json();
    if (resp.ok && data.status && data.data && data.data.status === "success") {
      const uitslag = await voltooi_talk_bestelling(bestelnommer, data.data);
      return antwoord(uitslag.ok ? "betaal" : uitslag.rede);
    }
    return antwoord((data && data.data && data.data.status) || "wag");
  } catch (fout) {
    console.error(`Kon nie ${bestelnommer} by Paystack nagaan nie:`, fout);
    return antwoord("wag");
  }
};
