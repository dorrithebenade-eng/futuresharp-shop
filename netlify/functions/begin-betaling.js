// Word deur voltooi-betaling.js aangeroep wanneer die koper op "Gaan na betaling" klik.
//
// Doen vier dinge:
// 1. Herbou items + totaal SERVER-KANT vanuit die "katalogus"-store — die
//    kliënt se pryse word nooit vertrou nie. Dit voorkom prys-manipulasie
//    (iemand wat die mandjie se prys in die blaaier se dev-tools verander),
//    en is ook nodig om die korrekte outeur-verdeling per boek te bepaal.
// 2. Indien enige item(s) 'n outeur-verdeling het, skep dinamies 'n
//    Paystack Transaction Split ("op die vlug", soos Paystack self
//    aanbeveel wanneer die samestelling eers by kassa bekend is) en kry 'n
//    split_code terug.
// 3. Stoor 'n konsep-bestelling in Netlify Blobs (status = "Wag vir betaling").
// 4. Roep Paystack se "Initialize Transaction"-eindpunt aan (met split_code
//    indien van toepassing) en gee die authorization_url terug.
//
// PAYSTACK_SECRET_KEY moet as 'n omgewingveranderlike in die Netlify-
// werf-instellings gestel word (nooit in kode nie).
//
// Oor die verdeling-berekening: 'n Paystack Split Group het EEN tipe
// (persentasie OF vaste bedrag) vir die hele groep, maar 'n boek se
// verdeling in ons katalogus kan per-boek persentasie ÓF vaste bedrag wees.
// Ons versoen dit deur alles om te reken na 'n effektiewe persentasie van
// die item se prys, en dan die subrekening se totale aandeel oor die hele
// bestelling as 'n enkele persentasie van totaal_sent te bereken. Vir
// vaste-bedrag-items is dit wiskundig presies (die bedrag wat Paystack
// uitbetaal, is binne 'n sent van die gestelde vaste bedrag).

const { kry_store } = require("./_blob-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const { bestelnommer, items, aflewering, koper } = invoer;

  if (!bestelnommer || !items || !items.length || !koper || !koper.epos || !koper.selfoonnommer) {
    return { statusCode: 400, body: "Onvolledige bestelling-data" };
  }

  const katalogusStore = kry_store("katalogus");
  const bestellingsStore = kry_store("bestellings");
  const outeursStore = kry_store("outeurs");
  // Onthou reeds-opgesoekte outeurs binne hierdie versoek — voorkom
  // herhaalde Blobs-opsoeke as dieselfde outeur op meer as een item/formaat
  // se verdeling verskyn.
  const outeur_kas = {};
  async function kry_outeur(outeur_id) {
    if (!(outeur_id in outeur_kas)) {
      outeur_kas[outeur_id] = await outeursStore.get(outeur_id, { type: "json" });
    }
    return outeur_kas[outeur_id];
  }

  // Verhoed dat 'n reeds-betaalde bestelnommer oorskryf word
  const bestaande = await bestellingsStore.get(bestelnommer, { type: "json" });
  if (bestaande && bestaande.status !== "Wag vir betaling") {
    return { statusCode: 409, body: "Hierdie bestelnommer is reeds verwerk" };
  }

  // --- Stap 1: herbou items + totaal server-kant vanuit die katalogus ---
  let totaal_sent = 0;
  let bevat_harde_kopie = false;
  const geverifieerde_items = [];
  const verdeling_per_subrekening = {}; // { "ACCT_xxx": sent_bedrag }

  for (const kliënt_item of items) {
    const produk = await katalogusStore.get(kliënt_item.produk_slug, { type: "json" });
    if (!produk || !produk.aktief) {
      return { statusCode: 400, body: `"${kliënt_item.produk_slug}" is nie meer beskikbaar nie` };
    }

    const formaat_data = produk.formate && produk.formate[kliënt_item.formaat];
    if (!formaat_data || !formaat_data.beskikbaar) {
      return { statusCode: 400, body: `"${produk.titel}" (${kliënt_item.formaat}) is nie meer beskikbaar nie` };
    }

    const item_prys_sent = formaat_data.prys_sent;
    totaal_sent += item_prys_sent;
    if (kliënt_item.formaat === "harde_kopie") bevat_harde_kopie = true;

    geverifieerde_items.push({
      produk_slug: produk.slug,
      titel: produk.titel,
      formaat: kliënt_item.formaat,
      prys_sent: item_prys_sent,
    });

    const verdelings = formaat_data.verdelings || [];
    for (const verdeling of verdelings) {
      if (!verdeling || !verdeling.outeur_id) continue;

      const outeur = await kry_outeur(verdeling.outeur_id);
      if (!outeur || !outeur.subrekening_kode) {
        // Outeur bestaan nie (meer) nie, of het geen subrekening-kode nie —
        // spring hierdie verdeling oor. Die bedrag bly eenvoudig by Future
        // Sharp se hoofrekening, i.p.v. die hele betaling te laat faal.
        console.warn(`Outeur "${verdeling.outeur_id}" nie gevind nie — verdeling oorgeslaan`);
        continue;
      }

      const item_aandeel_sent =
        verdeling.tipe === "vaste_bedrag"
          ? Math.min(verdeling.waarde, item_prys_sent)
          : Math.round((item_prys_sent * verdeling.waarde) / 100);

      verdeling_per_subrekening[outeur.subrekening_kode] =
        (verdeling_per_subrekening[outeur.subrekening_kode] || 0) + item_aandeel_sent;
    }
  }

  if (totaal_sent <= 0) {
    return { statusCode: 400, body: "Bestelling se totaal is ongeldig" };
  }

  // Veiligheidsnet: Future Sharp se hoofrekening moet ALTYD ten minste 3%
  // van die bestelling se totaal behou (dek Paystack se transaksiekoste,
  // en Paystack self weier 'n verdeling waar die handelaar se aandeel nul
  // of minder is). skep-produk.js/wysig-produk.js keer dit reeds af by
  // stoor-tyd, maar ons verklein hier ook proporsioneel as 'n laaste
  // vangnet — bv. vir data wat van vóór hierdie reël bestaan het — sodat
  // 'n koper se betaling nooit hierom kan misluk nie.
  const totale_verdeling_sent = Object.values(verdeling_per_subrekening).reduce((a, b) => a + b, 0);
  const maks_verdeling_sent = Math.floor(totaal_sent * 0.97);
  if (totale_verdeling_sent > maks_verdeling_sent && totale_verdeling_sent > 0) {
    const skaal_faktor = maks_verdeling_sent / totale_verdeling_sent;
    for (const kode of Object.keys(verdeling_per_subrekening)) {
      verdeling_per_subrekening[kode] = Math.floor(verdeling_per_subrekening[kode] * skaal_faktor);
    }
  }

  // --- Stap 2: dinamiese split-groep skep indien nodig ---
  const subrekening_kodes = Object.keys(verdeling_per_subrekening);
  let split_code = null;

  if (subrekening_kodes.length) {
    const subaccounts = subrekening_kodes.map((kode) => ({
      subaccount: kode,
      share: Math.round((verdeling_per_subrekening[kode] / totaal_sent) * 10000) / 100,
    }));

    try {
      const splitResp = await fetch("https://api.paystack.co/split", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Bestelling ${bestelnommer}`,
          type: "percentage",
          currency: "ZAR",
          subaccounts,
          bearer_type: "account", // Future Sharp dra Paystack se transaksiefooie
        }),
      });

      const splitData = await splitResp.json();
      if (!splitResp.ok || !splitData.status) {
        console.error("Kon nie split-groep skep nie:", splitData);
        return { statusCode: 502, body: "Kon nie betaling-verdeling opstel nie" };
      }
      split_code = splitData.data.split_code;
    } catch (fout) {
      console.error("Fout tydens split-groep-skepping:", fout);
      return { statusCode: 500, body: "Kon nie betaling-verdeling opstel nie" };
    }
  }

  // --- Stap 3: stoor konsep-bestelling ---
  const konsep_bestelling = {
    bestelnommer,
    geskep_op: bestaande ? bestaande.geskep_op : new Date().toISOString(),
    bygewerk_op: new Date().toISOString(),
    koper,
    items: geverifieerde_items,
    totaal_sent,
    bevat_harde_kopie,
    aflewering: aflewering || null,
    verdeling: subrekening_kodes.length ? verdeling_per_subrekening : null,
    split_code,
    drukker: bevat_harde_kopie
      ? { bestelling_geplaas: false, geplaas_op: null, nota: "" }
      : null,
    paystack: { referensie: bestelnommer, geverifieer: false },
    status: "Wag vir betaling",
    status_geskiedenis: [{ status: "Wag vir betaling", op: new Date().toISOString() }],
  };

  await bestellingsStore.setJSON(bestelnommer, konsep_bestelling);

  // --- Stap 4: inisieer die Paystack-transaksie ---
  const webwerf_url = process.env.URL || "http://localhost:8888";

  try {
    const paystackBody = {
      email: koper.epos,
      amount: totaal_sent, // Paystack verwag ook die kleinste eenheid (sent)
      reference: bestelnommer,
      callback_url: `${webwerf_url}/dankie.html?bestelnommer=${bestelnommer}`,
      metadata: {
        bestelnommer,
        selfoonnommer: koper.selfoonnommer,
      },
    };
    if (split_code) paystackBody.split_code = split_code;

    const paystackResp = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackBody),
    });

    const paystackData = await paystackResp.json();

    if (!paystackResp.ok || !paystackData.status) {
      console.error("Paystack-inisiëring het misluk:", paystackData);
      return { statusCode: 502, body: "Kon nie betaling by Paystack begin nie" };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
      }),
    };
  } catch (fout) {
    console.error("Fout tydens Paystack-inisiëring:", fout);
    return { statusCode: 500, body: "Kon nie betaling begin nie" };
  }
};
