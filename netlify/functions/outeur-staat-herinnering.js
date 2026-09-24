// netlify/functions/outeur-staat-herinnering.js
//
// GESKEDULEERD -- die eerste van elke maand, 04:00 UTC, dit is 06:00 in
// Suid-Afrika. Die skedule staan in netlify.toml, nie hier nie.
//
// Dit laat elke outeur weet sy staat vir die AFGELOPE maand is gereed. Loop
// dit op 1 Oktober, gaan die pos oor September.
//
// DIE VORIGE MAAND, NIE DIE HUIDIGE NIE. 'n Staat vir 'n maand wat pas begin
// het, is leeg. Die eerste dag van 'n maand is presies die oomblik waarop
// die vorige een klaar is en niks meer daaraan kan verander nie.
//
// DIT LOOP NIE VIR 'N MENS NIE. Daar is geen rol-kontrole nie, want daar is
// geen aanroeper -- Netlify roep dit self aan. Daarom stuur dit niks terug
// wat iemand kan lees nie, en skryf dit niks wat 'n outeur kan sien nie
// behalwe die pos.
//
// DIESELFDE PATROON AS leen-herinnering.js: een pos per ontvanger, 'n merker
// wat NA die pos geskryf word, en 'n tel van wat gestuur, oorgeslaan en
// misluk het.

const { kry_store } = require("./_blob-store");
const { outeur_by_produk_betrokke } = require("./_outeur-aandeel");
const { stuur_outeur_staat_kennisgewing } = require("./_kennisgewing-outeur-staat");

// Die voorkeur op die outeursrekord. Sien stoor-my-besonderhede.js se
// STAAT_FREKWENSIES. Afwesig beteken "maandeliks" -- 'n outeur wat nog nooit
// gekies het nie, kry die pos, dieselfde beginsel as by_verkoop.
const VERSTEK_FREKWENSIE = "maandeliks";

// "2026-09" vir 'n loop op 1 Oktober 2026. UTC, dieselfde konvensie as
// kry-my-staat.js en tel-produk-besigtiging.js, sodat 'n bestelling en 'n
// besigtiging op dieselfde oomblik in dieselfde maand val.
function vorige_maand_sleutel(nou) {
  const d = new Date(Date.UTC(nou.getUTCFullYear(), nou.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

exports.handler = async () => {
  const nou = new Date();
  const maand = vorige_maand_sleutel(nou);

  const outeur_store = kry_store("outeurs");
  const katalogus = kry_store("katalogus");

  let gestuur = 0;
  let oorgeslaan = 0;
  let misluk = 0;

  try {
    // Die katalogus EEN keer, nie een keer per outeur nie. By 'n handvol
    // outeurs maak dit min saak; by 'n honderd is dit die verskil tussen een
    // lees en 'n honderd.
    let produkte = [];
    try {
      const lys = await katalogus.list();
      produkte = (
        await Promise.all(
          (lys.blobs || []).map((b) => katalogus.get(b.key, { type: "json" }).catch(() => null))
        )
      ).filter(Boolean);
    } catch (fout) {
      console.error("Kon nie die katalogus lees nie:", fout);
      return { statusCode: 500, body: "Kon nie die katalogus lees nie" };
    }

    const { blobs } = await outeur_store.list();

    for (const inskrywing of blobs || []) {
      const outeur = await outeur_store.get(inskrywing.key, { type: "json" }).catch(() => null);
      if (!outeur || !outeur.outeur_id) continue;

      // Reeds gestuur vir hierdie maand. Die merker dra die MAAND en nie 'n
      // datum nie: loop die taak twee keer op dieselfde dag, of word hy 'n
      // paar dae later met die hand afgevuur, bly die antwoord dieselfde.
      if (outeur.staat_pos_gestuur === maand) continue;

      const kennisgewings = outeur.kennisgewings || {};
      const frekwensie = kennisgewings.staat_frekwensie || VERSTEK_FREKWENSIE;
      if (frekwensie !== "maandeliks") {
        oorgeslaan++;
        continue;
      }

      const aan = String(
        (outeur.kontak_inligting && outeur.kontak_inligting.epos) || ""
      ).trim();
      if (!aan) {
        oorgeslaan++;
        continue;
      }

      // GEEN TITELS, GEEN POS. 'n Staat vir iemand sonder 'n enkele titel is
      // 'n leë bladsy, en 'n pos wat maandeliks na 'n leë bladsy wys, leer
      // die leser om die pos te ignoreer. Ons bereken NIE die staat hier nie
      // -- ons vra net of daar iets is om na te kyk.
      const het_titels = produkte.some((p) => outeur_by_produk_betrokke(p, outeur.outeur_id));
      if (!het_titels) {
        oorgeslaan++;
        continue;
      }

      const uitslag = await stuur_outeur_staat_kennisgewing({
        aan,
        naam: outeur.naam,
        maand,
      });

      if (uitslag.ok) {
        try {
          await outeur_store.setJSON(inskrywing.key, {
            ...outeur,
            staat_pos_gestuur: maand,
          });
        } catch (fout) {
          // Die pos IS gestuur. Kan ons die merker nie skryf nie, gaan hy
          // volgende maand weer uit vir hierdie maand se sleutel, wat niks
          // breek nie. Die omgekeerde volgorde -- merk eers, stuur dan --
          // sou beteken 'n outeur kry stilweg niks wanneer die pos misluk.
          console.error(
            `Kon nie die staat-merker vir "${outeur.outeur_id}" skryf nie:`,
            fout
          );
        }
        gestuur++;
      } else {
        misluk++;
      }
    }
  } catch (fout) {
    console.error("Outeur-staat-herinnering het misluk:", fout);
    return { statusCode: 500, body: "Outeur-staat-herinnering het misluk" };
  }

  console.log(
    `Outeur-staat-herinnering (${maand}): ${gestuur} gestuur, ${oorgeslaan} oorgeslaan, ${misluk} misluk`
  );
  return { statusCode: 200, body: `gestuur=${gestuur}` };
};
