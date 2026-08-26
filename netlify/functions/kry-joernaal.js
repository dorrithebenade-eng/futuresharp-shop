// netlify/functions/kry-joernaal.js
//
// Die joernaal vir een finansiele jaar. Rol: boekhouding.
//
// DRIE BRONNE, EEN LYS
//
//   faktuur      'n betaalde faktuur se totaal -- INKOMSTE
//   uitbetaling  'n uitbetaalry wat afgemerk is -- UITGAWE
//   hand         alles wat nie deur Paystack vloei nie -- albei rigtings
//
// Die eerste twee word UIT DIE FAKTURE gelees en nooit gestoor nie. Sou 'n
// mens hulle by die joernaal se store afskryf, staan dieselfde bedrag op twee
// plekke en hulle dryf uitmekaar sodra 'n faktuur verander.
//
// WAT TEL EN WAT NIE
//
// Die faktuur tel op die dag dat die GELD ONTVANG is, nie op die dag van
// uitreiking nie. Dit is 'n kontantbasis: 'n faktuur wat in Februarie
// uitgereik en in Maart betaal is, hoort by die nuwe finansiele jaar.
//
// 'n Uitbetaling tel op die dag dat dit AFGEMERK is. 'n Ry wat nog uitstaan,
// is nie 'n uitgawe nie -- die geld het nie beweeg nie.
//
// 'n GEKANSELLEERDE FAKTUUR se betaling tel steeds. Die geld is werklik
// ontvang; die kansellasie verander nie die bankstaat nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store, is_konsep_sleutel, sleutel_na_nommer } = require("./_fakture");
const {
  kry_joernaal_store,
  finansiele_jaar,
  jaar_voorvoegsel,
} = require("./_joernaal");

function dag(iso) {
  return String(iso || "").slice(0, 10);
}

exports.handler = async (event, context) => {
  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const gevra = Number((event.queryStringParameters || {}).jaar);
  const jaar = Number.isFinite(gevra) ? gevra : finansiele_jaar(new Date().toISOString());

  const inskrywings = [];

  // ── 1. Wat met die hand aangeteken is ────────────────────────────────
  //
  // Die jaar staan in die sleutel, dus lees een prefix die hele jaar sonder
  // om elke ander jaar se inskrywings oop te maak.
  try {
    const store = kry_joernaal_store();
    const lys = await store.list({ prefix: jaar_voorvoegsel(jaar) });
    const rekords = await Promise.all(
      (lys.blobs || []).map((b) => store.get(b.key, { type: "json" }))
    );
    rekords.filter(Boolean).forEach((r) => {
      inskrywings.push({
        sleutel: r.sleutel,
        datum: r.datum,
        beskrywing: r.beskrywing,
        wie: r.wie || "",
        nota: r.nota || "",
        bedrag_sent: Number(r.bedrag_sent) || 0,
        rigting: r.rigting === "in" ? "in" : "uit",
        bron: "hand",
      });
    });
  } catch (fout) {
    console.error("Kon nie die joernaal lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die joernaal laai nie" };
  }

  // ── 2. Wat uit die fakture kom ───────────────────────────────────────
  try {
    const store = kry_fakture_store();
    const lys = await store.list();

    for (const b of lys.blobs || []) {
      if (is_konsep_sleutel(b.key)) continue;
      const f = await store.get(b.key, { type: "json" });
      if (!f) continue;

      const nommer = f.nommer || sleutel_na_nommer(b.key) || b.key;
      const klient = (f.klient && f.klient.naam) || "";

      // Die faktuur se ontvangs
      const ontvang_op = dag(f.betaling && f.betaling.ontvang_op);
      if (ontvang_op && finansiele_jaar(ontvang_op) === jaar) {
        inskrywings.push({
          sleutel: null,
          datum: ontvang_op,
          beskrywing: `${nommer}${klient ? " \u2014 " + klient : ""}`,
          wie: "",
          nota: "",
          bedrag_sent: Number(f.betaling.ontvang_sent) || 0,
          rigting: "in",
          bron: "faktuur",
        });
      }

      // Elke uitbetaling wat werklik gebeur het
      (Array.isArray(f.uitbetalings) ? f.uitbetalings : []).forEach((ry) => {
        const sent = Number(ry.bedrag_sent) || 0;
        if (sent <= 0) return;
        const betaal_op = dag(ry.betaal_op);
        if (!betaal_op || finansiele_jaar(betaal_op) !== jaar) return;

        // WAARVOOR die persoon betaal is, uit die faktuur se reels. Sonder dit
        // lees die boekhouer net 'n naam en 'n bedrag, en dan moet hy vra.
        const dele = (Array.isArray(ry.waarvoor) ? ry.waarvoor : [])
          .filter((w) => w && w.reel)
          .map((w) => w.reel)
          .join(", ");

        inskrywings.push({
          sleutel: null,
          datum: betaal_op,
          beskrywing:
            `${ry.ontvanger || ""} \u2014 ${nommer}` + (dele ? ` (${dele})` : ""),
          wie: "",
          nota: "",
          bedrag_sent: sent,
          rigting: "uit",
          bron: "uitbetaling",
        });
      });
    }
  } catch (fout) {
    console.error("Kon nie die fakture vir die joernaal lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die fakture laai nie" };
  }

  // Nuutste eerste.
  inskrywings.sort((a, b) => String(b.datum).localeCompare(String(a.datum)));

  let in_sent = 0;
  let uit_sent = 0;
  inskrywings.forEach((r) => {
    if (r.rigting === "in") in_sent += r.bedrag_sent;
    else uit_sent += r.bedrag_sent;
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jaar,
      inskrywings,
      in_sent,
      uit_sent,
      netto_sent: in_sent - uit_sent,
    }),
  };
};
