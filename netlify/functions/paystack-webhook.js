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
const { stuur_outeur_kennisgewings } = require("./_kennisgewing-outeur");

// Dieselfde patroon as skep-koepon.js — leesbaar-genoeg om oor die
// telefoon deur te gee, sonder dubbelsinnige karakters (0/O, 1/I/L).
function maak_koepon_kode() {
  const karakters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let kode = "";
  for (let i = 0; i < 8; i++) {
    kode += karakters[Math.floor(Math.random() * karakters.length)];
  }
  return kode;
}

// Leen-na-koop-opgradering: sodra 'n leen suksesvol bevestig is, skep 'n
// koper-spesifieke koepon wat presies die betaalde leen-bedrag as
// vaste-bedrag-afslag gee op 'n LATERE eboek-koop van dieselfde boek.
// Bly geldig regdeur die hele leen-tydperk, plus 14 dae ná die leen self
// verval — nie net 14 dae ná die aankoop nie (die leen-tydperk self is
// dikwels langer as dit). Nooit vir harde kopie — leen is uitsluitlik 'n
// eboek-konsep.
const LEEN_OPGRADERING_GELDIGHEID_DAE_NA_VERVAL = 14;

async function skep_leen_opgradering_koepon(item, koper_id, geskep_op) {
  const koeponStore = kry_store("koepons");

  let kode = "";
  let pogings = 0;
  do {
    kode = maak_koepon_kode();
    pogings++;
  } while ((await koeponStore.get(kode, { type: "json" })) && pogings < 5);

  // item.verval_op is die leen se eie vervaldatum (server-kant bereken in
  // begin-betaling.js) — val dit om enige rede terug op geskep_op, sodat
  // die koepon nooit sonder 'n verval-datum bly nie.
  const leen_verval_op = item.verval_op ? Date.parse(item.verval_op) : Date.parse(geskep_op);
  const verval_op = new Date(
    leen_verval_op + LEEN_OPGRADERING_GELDIGHEID_DAE_NA_VERVAL * 24 * 60 * 60 * 1000
  ).toISOString();

  const koepon = {
    kode,
    tipe: "afslag",
    afslag_tipe: "vaste_bedrag",
    afslag_waarde: item.prys_sent, // presies wat vir die leen betaal is
    produk_slug: item.produk_slug,
    formaat_beperking: "eboek", // Leen is net op eboeke van toepassing
    koper_id_beperking: koper_id,
    maks_gebruike: 1,
    gebruike_tot_dusver: 0,
    gebruike_geskiedenis: [],
    verval_op,
    aktief: true,
    outeur_id: null,
    nota: "Outomaties geskep: leen-na-koop-opgradering",
    geskep_deur: "stelsel:leen-opgradering",
    geskep_op,
  };

  await koeponStore.setJSON(kode, koepon);
  return kode;
}

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

  // Skep vir elke leen-item in hierdie bestelling 'n koper-spesifieke
  // opgradering-koepon — nooit die bevestiging self laat faal as hierdie
  // stap struikel nie, dis 'n bykomstige voordeel, nie krities nie.
  let bygewerkte_items = bestelling.items;
  try {
    bygewerkte_items = await Promise.all(
      bestelling.items.map(async (item) => {
        if (item.formaat !== "leen") return item;
        const opgradering_koepon_kode = await skep_leen_opgradering_koepon(
          item,
          bestelling.koper.netlify_identity_id,
          nou
        );
        return { ...item, opgradering_koepon_kode };
      })
    );
  } catch (fout) {
    console.error(`Webhook: kon nie leen-opgradering-koepon(s) skep nie vir ${bestelnommer}:`, fout);
  }

  const bygewerkte_bestelling = {
    ...bestelling,
    items: bygewerkte_items,
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

  // Registreer koepon-gebruik NOU (nie by begin-betaling.js nie) — vir 'n
  // gedeeltelike afslag is die betaling eers ECHT "gebruik" sodra dit
  // werklik bevestig is; as die koper nooit deur Paystack voltooi het nie,
  // moes die koepon nie as gebruik tel nie. (Die 100%-koepon-kortpad in
  // begin-betaling.js registreer sy eie gebruik dadelik, aangesien daar
  // in daardie geval nooit 'n Paystack-transaksie of hierdie webhook is nie.)
  if (bestelling.koepon_toegepas && bestelling.koepon_toegepas.kode) {
    try {
      const koeponStore = kry_store("koepons");
      const koepon = await koeponStore.get(bestelling.koepon_toegepas.kode, { type: "json" });
      if (koepon) {
        const nuwe_geskiedenis = [
          ...(koepon.gebruike_geskiedenis || []),
          ...bestelling.koepon_toegepas.items.map((i) => ({
            koper_id: bestelling.koper.netlify_identity_id,
            produk_slug: i.produk_slug,
            formaat: i.formaat,
            op: nou,
          })),
        ];
        await koeponStore.setJSON(bestelling.koepon_toegepas.kode, {
          ...koepon,
          gebruike_tot_dusver: koepon.gebruike_tot_dusver + 1,
          gebruike_geskiedenis: nuwe_geskiedenis,
        });
      }
    } catch (fout) {
      console.error(`Webhook: kon nie koepon-gebruik registreer nie vir ${bestelnommer}:`, fout);
    }
  }

  // Werk per-produk aankope- en opbrengs-tellers by (soortgelyk aan die
  // bestaande "besigtigings"-teller op elke produk se eie rekord) — nooit
  // die betaling-bevestiging self laat faal as hierdie stap om enige rede
  // struikel nie, dis 'n bykomstige rekord-doel, nie krities nie.
  try {
    const katalogusStore = kry_store("katalogus");
    for (const item of bestelling.items) {
      const produk = await katalogusStore.get(item.produk_slug, { type: "json" });
      if (!produk) continue;

      const is_harde_kopie = item.formaat === "harde_kopie";
      const is_leen = item.formaat === "leen";
      const aankope_veld = is_harde_kopie ? "aankope_harde_kopie" : is_leen ? "aankope_leen" : "aankope_eboek";
      const opbrengs_veld = is_harde_kopie ? "opbrengs_harde_kopie_sent" : is_leen ? "opbrengs_leen_sent" : "opbrengs_eboek_sent";

      await katalogusStore.setJSON(item.produk_slug, {
        ...produk,
        [aankope_veld]: (produk[aankope_veld] || 0) + 1,
        [opbrengs_veld]: (produk[opbrengs_veld] || 0) + item.prys_sent,
      });
    }
  } catch (fout) {
    console.error(`Webhook: kon nie per-produk aankope-tellers bywerk vir ${bestelnommer} nie:`, fout);
  }

  // Laat elke outeur weet van sy eie boeke in hierdie bestelling. Laaste
  // stap, en in 'n try/catch soos die twee hierbo: die betaling is reeds
  // bevestig en gestoor, en 'n pos wat nie deurkom nie mag dit nooit
  // ongedaan maak nie.
  //
  // Slegs e-boeke en lene. Die harde-kopie-pos wag op 'n ontvangernaam in
  // die betaalvorm — sien _kennisgewing-outeur.js.
  try {
    await stuur_outeur_kennisgewings(bygewerkte_bestelling);
  } catch (fout) {
    console.error(`Webhook: kon nie outeur-kennisgewings stuur nie vir ${bestelnommer}:`, fout);
  }

  // E-boek-ontsluiting (Fase 4) sal hierdie status = "Nuut" +
  // paystack.geverifieer = true as sein gebruik om outomaties te ontsluit.

  return { statusCode: 200, body: "Bestelling bevestig" };
};
