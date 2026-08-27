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
const { is_kwotasie_sleutel } = require("./_kwotasies");
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

  // 'N TYDPERK, NIE 'N JAAR NIE.
  //
  // Die eerste weergawe het net `jaar` geneem. 'n Filter met 'n datum VAN en
  // 'n datum TOT doen dieselfde werk -- 1 Maart tot 28 Februarie is 'n
  // tydperk soos enige ander -- en dit kan boonop oor jaargrense heen loop.
  // Twee maniere om die tydperk te kies, langs mekaar, sou beteken 'n mens
  // weet nie watter een geld nie.
  const vraag = event.queryStringParameters || {};
  const dag_van = /^\d{4}-\d{2}-\d{2}$/.test(vraag.van || "") ? vraag.van : null;
  const dag_tot = /^\d{4}-\d{2}-\d{2}$/.test(vraag.tot || "") ? vraag.tot : null;

  if (!dag_van || !dag_tot || dag_van > dag_tot) {
    return { statusCode: 400, body: "Gee 'n geldige tydperk." };
  }

  // Die soekwoord loop oor die beskrywing en oor "Betaal deur" -- die twee
  // velde wat woorde dra. Kleinletter aan albei kante, want niemand tik 'n
  // soekwoord met dieselfde hoofletters as die inskrywing nie.
  const soek = String(vraag.soek || "").trim().toLowerCase();
  const pas = (r) =>
    !soek ||
    String(r.beskrywing || "").toLowerCase().includes(soek) ||
    String(r.wie || "").toLowerCase().includes(soek);

  const in_tydperk = (d) => Boolean(d) && d >= dag_van && d <= dag_tot;

  // Watter finansiele jare die tydperk raak. Die jaar staan in die Blob-
  // sleutel, dus lees ons net daardie jare se prefikse in plaas van die hele
  // store.
  const jare = [];
  for (let j = finansiele_jaar(dag_van); j <= finansiele_jaar(dag_tot); j += 1) {
    jare.push(j);
  }

  const inskrywings = [];

  // DEBITEURE EN KREDITEURE TEL NIE IN DIE SOMME NIE.
  //
  // Op kontantbasis bestaan hulle nie as transaksies nie -- die geld het nie
  // beweeg nie. Hulle word saamgegee omdat 'n mens hulle by jaareinde WIL
  // SIEN, maar hulle bly buite in_sent en uit_sent. Sou hulle daarin tel, is
  // die syfer wat die boekhouer kry verkeerd.
  //
  //   debiteur   'n uitgereikte faktuur wat nog nie betaal is nie. Val in die
  //              jaar van UITREIKING -- die enigste datum wat bestaan.
  //   krediteur  'n uitbetaalry wat nog uitstaan. Val in die jaar waarin die
  //              faktuur BETAAL is, want dit is wanneer die skuld ontstaan het.
  const debiteure = [];
  const krediteure = [];

  // ── 1. Wat met die hand aangeteken is ────────────────────────────────
  //
  // Die jaar staan in die sleutel, dus lees een prefix die hele jaar sonder
  // om elke ander jaar se inskrywings oop te maak.
  try {
    const store = kry_joernaal_store();
    const blobs = [];
    for (const j of jare) {
      const lys = await store.list({ prefix: jaar_voorvoegsel(j) });
      (lys.blobs || []).forEach((b) => blobs.push(b));
    }
    const rekords = await Promise.all(
      blobs.map((b) => store.get(b.key, { type: "json" }))
    );
    rekords.filter(Boolean).forEach((r) => {
      if (!in_tydperk(r.datum) || !pas(r)) return;
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
      // 'n KWOTASIE IS GEEN INSKRYWING NIE. Hy leef in dieselfde store met 'n
      // ander voorvoegsel, en 'n aanbod is nie inkomste nie — dit begin by die
      // faktuur. Die toets loop op die SLEUTEL, dus word 'n kwotasie nooit
      // gelees nie: hierdie lus lees elke rekord in die store, en die filter
      // maak hom ligter, nie swaarder nie.
      if (is_konsep_sleutel(b.key) || is_kwotasie_sleutel(b.key)) continue;
      const f = await store.get(b.key, { type: "json" });
      if (!f) continue;

      const nommer = f.nommer || sleutel_na_nommer(b.key) || b.key;
      const klient = (f.klient && f.klient.naam) || "";

      // Uitgereik en nog nie betaal nie.
      if (f.stand === "gestuur") {
        const uitgereik = dag(f.uitgereik_op);
        if (in_tydperk(uitgereik)) {
          debiteure.push({
            datum: uitgereik,
            nommer,
            klient,
            bedrag_sent: Number(f.totaal_sent) || 0,
            betaalbaar_teen: f.betaalbaar_teen || null,
          });
        }
      }

      // Die faktuur se ontvangs
      const ontvang_op = dag(f.betaling && f.betaling.ontvang_op);
      const ontvang_besk = `${nommer}${klient ? " \u2014 " + klient : ""}`;
      if (in_tydperk(ontvang_op) && pas({ beskrywing: ontvang_besk })) {
        inskrywings.push({
          sleutel: null,
          datum: ontvang_op,
          beskrywing: ontvang_besk,
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

        if (!betaal_op) {
          // Nog uitstaande. Die skuld het ontstaan toe die faktuur betaal is.
          const ontvang = dag(f.betaling && f.betaling.ontvang_op);
          if (in_tydperk(ontvang)) {
            krediteure.push({
              datum: ontvang,
              nommer,
              ontvanger: ry.ontvanger || "",
              bedrag_sent: sent,
            });
          }
          return;
        }

        if (!in_tydperk(betaal_op)) return;

        // WAARVOOR die persoon betaal is, uit die faktuur se reels. Sonder dit
        // lees die boekhouer net 'n naam en 'n bedrag, en dan moet hy vra.
        const dele = (Array.isArray(ry.waarvoor) ? ry.waarvoor : [])
          .filter((w) => w && w.reel)
          .map((w) => w.reel)
          .join(", ");

        const uit_besk =
          `${ry.ontvanger || ""} \u2014 ${nommer}` + (dele ? ` (${dele})` : "");
        if (!pas({ beskrywing: uit_besk })) return;

        inskrywings.push({
          sleutel: null,
          datum: betaal_op,
          beskrywing: uit_besk,
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
  debiteure.sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  krediteure.sort((a, b) => String(a.datum).localeCompare(String(b.datum)));

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
      van: dag_van,
      tot: dag_tot,
      soek,
      inskrywings,
      in_sent,
      uit_sent,
      netto_sent: in_sent - uit_sent,
      debiteure,
      krediteure,
      debiteure_sent: debiteure.reduce((s, r) => s + r.bedrag_sent, 0),
      krediteure_sent: krediteure.reduce((s, r) => s + r.bedrag_sent, 0),
    }),
  };
};
