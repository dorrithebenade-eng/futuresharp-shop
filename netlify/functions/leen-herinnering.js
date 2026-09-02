// netlify/functions/leen-herinnering.js
//
// GESKEDULEERD -- 04:00 UTC daagliks, dit is 06:00 in Suid-Afrika. Die
// skedule staan in netlify.toml, nie hier nie.
//
// Dit is die EERSTE geskeduleerde funksie in hierdie stelsel. Elke ander
// Function wag dat iemand 'n bladsy laai of 'n knoppie druk. 'n Leen wat
// oor vyf dae verstryk, kan niemand se knoppie afwag nie.
//
// WAT DIT DOEN: soek betaalde bestellings met leen-items wat binne die
// venster verval, en stuur een pos per leen. Sien
// _kennisgewing-leen-verval.js vir waarom dit een pos is en nie twee nie.
//
// DIT LOOP NIE VIR 'N MENS NIE. Daar is geen rol-kontrole nie omdat daar
// geen aanroeper is nie; Netlify roep dit self aan. Dit is presies waarom
// dit NIKS terugstuur wat iemand kan lees nie en niks skryf wat 'n koper
// kan sien nie, behalwe die pos.

const { kry_store } = require("./_blob-store");
const { stuur_leen_verval_kennisgewing } = require("./_kennisgewing-leen-verval");

// Vyf dae, sodat die pos en die opgradeer-knoppie op "My Boeke" op
// dieselfde oomblik verskyn. Daardie knoppie se venster staan in
// kry-my-boeke.js op dieselfde getal. Verander die een, verander die ander.
const HERINNER_DAE_VOOR_VERVAL = 5;

// "Nuut" = die status ná 'n suksesvolle betaling (sien paystack-webhook.js).
const BETAAL_STATUS = "Nuut";

function dae_tot(verval_op, nou) {
  const verval = new Date(verval_op);
  if (Number.isNaN(verval.getTime())) return null;
  return Math.ceil((verval - nou) / (1000 * 60 * 60 * 24));
}

exports.handler = async () => {
  const nou = new Date();
  const bestellings_store = kry_store("bestellings");
  const koepon_store = kry_store("koepons");

  let gestuur = 0;
  let oorgeslaan = 0;
  let misluk = 0;

  try {
    const { blobs } = await bestellings_store.list();

    // Twee deurgange. Die eerste bou die lys betaalde bestellings EN die
    // stel e-boeke wat elke koper reeds besit; die tweede stuur. Sonder
    // die eerste deurgang sou 'n koper wat die e-boek reeds gekoop het,
    // 'n pos kry wat hom aanraai om te koop wat hy het.
    const betaalde = [];
    for (const inskrywing of blobs) {
      const ruwe = await bestellings_store.get(inskrywing.key);
      if (!ruwe) continue;

      let bestelling;
      try {
        bestelling = JSON.parse(ruwe);
      } catch {
        continue; // ignoreer korrupte rekords, soos kry-my-boeke.js doen
      }

      if (bestelling.status !== BETAAL_STATUS) continue;
      betaalde.push({ sleutel: inskrywing.key, bestelling });
    }

    // Sleutel: die koper se Identity-id. Waarde: die stel produk-slugs wat
    // hy as volle e-boek besit.
    const besit_as_eboek = new Map();
    for (const { bestelling } of betaalde) {
      const koper_id = bestelling.koper && bestelling.koper.netlify_identity_id;
      if (!koper_id) continue;
      for (const item of bestelling.items || []) {
        if (item && item.formaat === "eboek") {
          if (!besit_as_eboek.has(koper_id)) besit_as_eboek.set(koper_id, new Set());
          besit_as_eboek.get(koper_id).add(item.produk_slug);
        }
      }
    }

    for (const { sleutel, bestelling } of betaalde) {
      const koper_id = bestelling.koper && bestelling.koper.netlify_identity_id;
      const aan = String(
        (bestelling.koper && bestelling.koper.epos) ||
          (bestelling.kontak_inligting && bestelling.kontak_inligting.epos) ||
          ""
      ).trim();

      const items = Array.isArray(bestelling.items) ? bestelling.items : [];
      let bestelling_verander = false;

      for (const item of items) {
        if (!item || item.formaat !== "leen") continue;
        if (!item.verval_op) continue;

        // Reeds gestuur. Die merker word eers geskryf NADAT die pos
        // deurgekom het, dus beteken sy afwesigheid werklik "nog nie
        // gestuur nie" en nie "ons het probeer" nie.
        if (item.leen_herinner_gestuur) continue;

        const oor = dae_tot(item.verval_op, nou);
        if (oor === null) continue;

        // Bo die venster: te vroeg, kom môre weer.
        // Onder 1: die leen het reeds verval en 'n herinnering is dan 'n
        // mededeling oor iets wat verby is.
        //
        // Die venster is 'n REEKS, nie 'n enkele dag nie. Loop hierdie
        // taak op dag 5 om enige rede nie -- 'n ontplooiing, 'n onderbreking
        // by Netlify -- vuur dit op dag 4. 'n Toets op presies vyf sou die
        // pos in daardie geval vir altyd laat val.
        if (oor > HERINNER_DAE_VOOR_VERVAL || oor < 1) continue;

        if (!aan) {
          oorgeslaan++;
          continue;
        }

        // Besit hy die e-boek reeds, is die koepon nutteloos en die pos 'n
        // aanbod om te koop wat hy het.
        const besit = koper_id && besit_as_eboek.get(koper_id);
        if (besit && besit.has(item.produk_slug)) {
          oorgeslaan++;
          continue;
        }

        if (!item.opgradering_koepon_kode) {
          oorgeslaan++;
          continue;
        }

        const koepon = await koepon_store.get(item.opgradering_koepon_kode, { type: "json" });
        const koepon_geldig =
          koepon &&
          koepon.aktief &&
          (koepon.gebruike_tot_dusver || 0) < (koepon.maks_gebruike || 1) &&
          (!koepon.verval_op || new Date(koepon.verval_op) > nou);

        if (!koepon_geldig) {
          oorgeslaan++;
          continue;
        }

        const uitslag = await stuur_leen_verval_kennisgewing({
          aan,
          titel: item.titel,
          verval_op: item.verval_op,
          dae_oor: oor,
          koepon_kode: koepon.kode,
          afslag_sent: koepon.afslag_waarde,
          koepon_verval_op: koepon.verval_op,
          bestelnommer: bestelling.bestelnommer,
        });

        if (uitslag.ok) {
          item.leen_herinner_gestuur = nou.toISOString();
          bestelling_verander = true;
          gestuur++;
        } else {
          misluk++;
        }
      }

      // Een skryf per bestelling, nie een per item nie, en slegs wanneer
      // daar werklik iets te merk is.
      if (bestelling_verander) {
        try {
          await bestellings_store.setJSON(sleutel, bestelling);
        } catch (fout) {
          // Die pos IS gestuur. Kan ons die merker nie skryf nie, gaan die
          // pos môre weer uit. Dit is hinderlik en dit is die veilige kant:
          // die alternatief sou wees om die merker eerste te skryf en dan
          // 'n koper stil te laat verbygaan wanneer die pos misluk.
          console.error(
            `Leen-herinnering: kon nie merker skryf vir ${sleutel} nie:`,
            fout
          );
        }
      }
    }
  } catch (fout) {
    console.error("Leen-herinnering het misluk:", fout);
    return { statusCode: 500, body: "Leen-herinnering het misluk" };
  }

  console.log(
    `Leen-herinnering: ${gestuur} gestuur, ${oorgeslaan} oorgeslaan, ${misluk} misluk`
  );
  return { statusCode: 200, body: `gestuur=${gestuur}` };
};
