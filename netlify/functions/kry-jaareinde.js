// netlify/functions/kry-jaareinde.js
// Weergawe 1 (19 Oktober 2026).
//
// DEBITEURE EN KREDITEURE OP 'N DATUM, vir die finansiele state
// (faktuurpaneel-fin-afs.js). Rol: boekhouding.
//
//   GET ?datums=2025-02-28,2026-02-28
//
// Gee per datum wat op DAARDIE dag uitgestaan het, nie wat vandag uitstaan
// nie. kry-joernaal.js se debiteure is fakture wat VANDAG nog onbetaal is; 'n
// faktuur van Februarie wat in Maart betaal is, was op 28 Februarie 'n
// debiteur en verskyn daar nie. Die finansiele state het juis daardie een
// nodig.
//
// DEBITEUR op datum D: 'n uitgereikte faktuur met 'n dokumentdatum op of voor
// D, wat op D nog nie betaal was nie (geen betaling, of betaal na D). 'n
// Gekanselleerde faktuur sonder betaling tel nie: die skuld het nooit bestaan
// nie. Die bedrag is wat later werklik ontvang is, of die faktuur se totaal as
// daar nog niks ontvang is nie, sodat inkomste oor die jare presies tot die
// kontant optel. Die dele oor die kategoriee kom uit _ontvangs-dele.js, net
// soos by 'n ontvangs in die joernaal.
//
// KREDITEUR op datum D: vergoeding vir 'n faktuur met 'n dokumentdatum op of
// voor D, wat op D nog nie uitbetaal was nie. Die skuld word erken saam met
// die inkomste waarvoor dit betaal word (die faktuur se datum), nie eers
// wanneer die kliënt betaal nie. Is die faktuur reeds betaal, kom die rye uit
// `uitbetalings`; anders uit die gevriesde verdeling, wat by uitreiking
// vasgestel is.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store, is_konsep_sleutel, sleutel_na_nommer } = require("./_fakture");
const { is_kwotasie_sleutel } = require("./_kwotasies");
const { ontvangs_dele } = require("./_ontvangs-dele");

function dag(iso) {
  return String(iso || "").slice(0, 10);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };

  const datums = String((event.queryStringParameters || {}).datums || "")
    .split(",").map((d) => d.trim()).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!datums.length || datums.length > 12) {
    return { statusCode: 400, body: "Gee een tot twaalf datums." };
  }

  const uit = {};
  datums.forEach((d) => (uit[d] = { debiteure: [], krediteure: [] }));

  try {
    const store = kry_fakture_store();
    const lys = await store.list();
    for (const b of lys.blobs || []) {
      if (is_konsep_sleutel(b.key) || is_kwotasie_sleutel(b.key)) continue;
      const f = await store.get(b.key, { type: "json" });
      if (!f || f.stand === "konsep") continue;

      const uitgereik = dag(f.dokument_datum || f.uitgereik_op);
      if (!uitgereik) continue;
      const ontvang_op = dag(f.betaling && f.betaling.ontvang_op);
      // Gekanselleer en nooit betaal nie: geen skuld, geen vergoeding.
      if (f.stand === "gekanselleer" && !ontvang_op) continue;

      const nommer = f.nommer || sleutel_na_nommer(b.key) || b.key;
      const klient = (f.klient && f.klient.naam) || "";
      const ontvang_sent = Number(f.betaling && f.betaling.ontvang_sent) || 0;
      const bedrag = ontvang_op ? ontvang_sent : Number(f.totaal_sent) || 0;

      const uitbet = Array.isArray(f.uitbetalings) ? f.uitbetalings : [];
      const gevries = (f.verdeling_gevries && Array.isArray(f.verdeling_gevries.rye))
        ? f.verdeling_gevries.rye : [];

      for (const d of datums) {
        if (uitgereik > d) continue;

        if ((!ontvang_op || ontvang_op > d) && bedrag > 0) {
          uit[d].debiteure.push({
            nommer, klient, datum: uitgereik,
            bedrag_sent: bedrag,
            betaal_op: ontvang_op || "",
            dele: ontvangs_dele(f, bedrag),
            projek_id: f.projek_id || "",
          });
        }

        // Die vergoeding wat op D nog nie uitbetaal was nie.
        const rye = ontvang_op
          ? uitbet.filter((r) => !dag(r.betaal_op) || dag(r.betaal_op) > d)
          : gevries.map((r) => ({ ontvanger: r.naam, bedrag_sent: r.bedrag_sent, waarvoor: r.waarvoor, betaal_op: null }));
        rye.forEach((r) => {
          const sent = Number(r.bedrag_sent) || 0;
          if (sent <= 0) return;
          uit[d].krediteure.push({
            nommer,
            ontvanger: r.ontvanger || "",
            datum: uitgereik,
            bedrag_sent: sent,
            betaal_op: dag(r.betaal_op),
            waarvoor: Array.isArray(r.waarvoor) ? r.waarvoor : [],
            projek_id: f.projek_id || "",
          });
        });
      }
    }
  } catch (fout) {
    console.error("Kon nie die jaareinde lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die fakture laai nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datums: uit }),
  };
};
