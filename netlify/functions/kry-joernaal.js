// netlify/functions/kry-joernaal.js
//
// Die joernaal vir een finansiele jaar. Rol: boekhouding.
//
// DRIE BRONNE, EEN LYS
//
//   faktuur      'n betaalde faktuur se totaal -- INKOMSTE
//   uitbetaling  'n uitbetaalry wat afgemerk is -- UITGAWE
//   hand         alles wat nie deur Paystack vloei nie -- albei rigtings
//   winkel       wat 'n bestelling in die HOOFREKENING laat -- albei rigtings
//
// DIE WINKEL WORD NETTO GEBOEK, EN DIT IS NIE 'N VEREENVOUDIGING NIE.
//
// Paystack verdeel 'n bestelling by vereffening: die outeur, die drukker en
// die ontwerper se dele gaan REGSTREEKS na hul eie subrekeninge. Daardie geld
// raak nooit Future Sharp se bank nie. Op 'n kontantbasis is dit dus nie
// inkomste nie en nie uitgawe nie -- dit boek beteken 'n staat wat nie meer
// teen die bankstaat klop nie.
//
// Wat WEL die bank raak, is twee bedrae:
//
//   die behoue deel   totaal min die subrekeninge se dele -- INKOMSTE
//   Paystack se fooi  kom uit die hoofrekening            -- UITGAWE
//
// Die behoue deel is hoofsaaklik die hosting: die heffing wat Future Sharp se
// bedryfskoste dra -- subskripsies, data, LearnWorlds, KI. Die fooi word
// herbereken uit die totaal, want Paystack se werklike heffing staan nie op
// die bestelling nie.
//
// 'n R0-BESTELLING (100%-koepon) VERSKYN NERENS. Daar was nooit 'n Paystack-
// transaksie nie, dus was daar ook nooit 'n fooi of 'n vereffening nie, en
// niks het beweeg nie.
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
const { kry_store } = require("./_blob-store");
const { kry_paystack_fooi_sent } = require("./_paystack-koste");

function dag(iso) {
  return String(iso || "").slice(0, 10);
}

/* DIE ONTVANGS SE DELE.
 *
 * 'n Ontvangs is EEN bedrag; die faktuur se reels is verskeie, elk met sy eie
 * kategorie. Die verdeling is PRO RATA op die reelbedrae -- die enigste reel
 * wat altyd tot die ontvangs optel, ook wanneer die twee nie ooreenstem nie:
 * 'n gedeeltelike betaling, 'n afslag, 'n skenking.
 *
 * WAT ONDER DIENSINKOMSTE BLY
 *   'n KOSTEREEL. Haar kategorie is 'n UITGAWE-kategorie -- dit is presies wat
 *   die keuselys se rigtingfilter afdwing. Sou haar deel daaronder boek, staan
 *   inkomste onder 'n uitgawekop en die staat lieg.
 *   'n REEL SONDER KATEGORIE. Dit is wat voor vandag gebeur het, en 'n
 *   bestaande faktuur mag nie van betekenis verander nie.
 *   DIE SKENKING. Sy is nie werkswinkelinkomste nie; sy is haar eie ding, en
 *   sy word nie oor die reels versprei nie.
 *
 * DIE LAASTE DEEL NEEM DIE AFRONDINGSRES, sodat die dele PRESIES tot die
 * ontvangs optel. Dieselfde dissipline as fs_dele_van() in
 * faktuurpaneel-fin-staat.js en as die fooidele in faktuur-som.js.
 *
 * DELE MET DIESELFDE KATEGORIE SMELT SAAM. Drie werkswinkelreels gee een deel,
 * nie drie nie.
 */
function ontvangs_dele(f, ontvang_sent) {
  if (!(ontvang_sent > 0)) return [];

  const reels = Array.isArray(f.reels) ? f.reels : [];

  // Die gewig van elke reel is haar eie bedrag. Die skenking kry haar eie
  // gewig sodat sy nie oor die reels versprei nie.
  const gewigte = reels.map((r) => {
    const sent = Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0));
    return {
      sent: sent > 0 ? sent : 0,
      kategorie_id:
        r.soort === "koste" || !r.kategorie_id ? "diensinkomste" : r.kategorie_id,
    };
  });

  const skenking = Number(f.skenking_sent) || 0;
  if (skenking > 0) gewigte.push({ sent: skenking, kategorie_id: "diensinkomste" });

  const totaal_gewig = gewigte.reduce((a, g) => a + g.sent, 0);
  if (totaal_gewig <= 0) {
    return [{ kategorie_id: "diensinkomste", bedrag_sent: ontvang_sent }];
  }

  const per_kat = new Map();
  let toegeken = 0;
  gewigte.forEach((g) => {
    if (g.sent <= 0) return;
    const deel = Math.round((ontvang_sent * g.sent) / totaal_gewig);
    per_kat.set(g.kategorie_id, (per_kat.get(g.kategorie_id) || 0) + deel);
    toegeken += deel;
  });

  const dele = [...per_kat.entries()].map(([kategorie_id, bedrag_sent]) => ({
    kategorie_id,
    bedrag_sent,
  }));

  // Die res van die afronding op die laaste deel.
  if (dele.length && toegeken !== ontvang_sent) {
    dele[dele.length - 1].bedrag_sent += ontvang_sent - toegeken;
  }

  return dele;
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
        kategorie_id: r.kategorie_id || "",
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
        // DIE DOKUMENT SE DATUM, nie die oomblik van uitreiking nie. Wat die
        // kliënt op sy faktuur sien, is wat in die boeke moet staan; twee
        // antwoorde op dieselfde vraag is 'n verskil wat later verklaar moet
        // word. Die terugval geld rekords van voor 4 September 2026.
        const uitgereik = dag(f.dokument_datum || f.uitgereik_op);
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
        const ontvang_sent = Number(f.betaling.ontvang_sent) || 0;
        inskrywings.push({
          sleutel: null,
          datum: ontvang_op,
          beskrywing: ontvang_besk,
          wie: "",
          nota: "",
          bedrag_sent: ontvang_sent,
          rigting: "in",
          // Die inskrywing self bly onder Diensinkomste. Die DELE hieronder
          // verfyn haar; 'n leser wat nie oor kategoriee wonder nie, sien
          // presies wat hy altyd gesien het.
          kategorie_id: "diensinkomste",
          // EEN INSKRYWING, MET HAAR DELE DAARAAN -- dieselfde vorm as
          // `waarvoor` op 'n uitbetaling. Sou ons die ontvangs in vyf
          // inskrywings opbreek, sien 'n boekhouer wat EEN betaling soek vyf
          // reels, en die joernaal se telling en die CSV verander saam.
          dele: ontvangs_dele(f, ontvang_sent),
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
          // Die uitbetaling se kategorie kom uit die begunstigde se reel op
          // die faktuur; sy word deur die STAAT toegeken, nie hier nie.
          kategorie_id: "",

          // `waarvoor` GAAN SAAM, en dit is waarom.
          //
          // 'n Uitbetaling loop dikwels oor meer as een reel: R1 200 vir 'n
          // aanbieding plus R450 vir 'n vraelys, in een oorbetaling. Elke deel
          // dra sy eie {reel, bedrag_sent}, dus kan die staat elke deel by 'n
          // ander kategorie sit sonder om te raai.
          //
          // Sonder hierdie veld sou die hele R1 650 by een kategorie moes val
          // of glad nie, en dan is die staat se uitgawekant so grof dat sy niks
          // se nie.
          waarvoor: Array.isArray(ry.waarvoor) ? ry.waarvoor : [],
          bron: "uitbetaling",
        });
      });
    }
  } catch (fout) {
    console.error("Kon nie die fakture vir die joernaal lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die fakture laai nie" };
  }

  // ── 3. Wat uit die winkel kom ────────────────────────────────────────
  try {
    const store = kry_store("bestellings");
    const lys = await store.list();

    for (const b of lys.blobs || []) {
      const o = await store.get(b.key, { type: "json" });
      if (!o || !o.paystack || o.paystack.geverifieer !== true) continue;

      // Geen Paystack-transaksie, geen beweging.
      if (o.paystack.gratis_via_koepon === true) continue;

      const totaal = Number(o.totaal_sent) || 0;
      if (totaal <= 0) continue;

      // Die dag van VEREFFENING, nie die dag van bestelling nie. Dieselfde
      // kontantbasis as die faktuur s'n.
      const datum = dag(o.paystack.geverifieer_op || o.bygewerk_op);
      if (!in_tydperk(datum)) continue;

      // Wat na die subrekeninge gegaan het. `verdeling` is 'n voorwerp met
      // die subrekening se kode as sleutel; hy is null waar daar geen
      // verdeling was nie -- dan bly die volle bedrag in die hoofrekening.
      const verdeel = o.verdeling && typeof o.verdeling === "object"
        ? Object.values(o.verdeling).reduce((a, v) => a + (Number(v) || 0), 0)
        : 0;

      const behou = Math.max(0, totaal - verdeel);
      const fooi = kry_paystack_fooi_sent(totaal);
      const nommer = o.bestelnommer || b.key;

      const in_besk = `Winkel \u2014 ${nommer}`;
      if (behou > 0 && pas({ beskrywing: in_besk })) {
        inskrywings.push({
          sleutel: null,
          datum,
          beskrywing: in_besk,
          wie: "",
          nota: "",
          bedrag_sent: behou,
          rigting: "in",
          // Die winkel se behoue deel is hoofsaaklik hosting; hy val onder
          // dieselfde vaste kategorie as die faktuur se totaal.
          kategorie_id: "diensinkomste",
          bron: "winkel",
        });
      }

      const uit_besk = `Paystack se fooi \u2014 ${nommer}`;
      if (fooi > 0 && pas({ beskrywing: uit_besk })) {
        inskrywings.push({
          sleutel: null,
          datum,
          beskrywing: uit_besk,
          wie: "",
          nota: "",
          bedrag_sent: fooi,
          rigting: "uit",
          kategorie_id: "paystack-transaksiefooi",
          bron: "winkel",
        });
      }
    }
  } catch (fout) {
    // DIE WINKEL MAG NIE DIE JOERNAAL LAAT VAL NIE. Die fakture en die hand-
    // inskrywings is reeds gelees; 'n leesfout hier moet die res nie wegvat
    // nie. Die syfer is dan onvolledig, en dit staan in die log.
    console.error("Kon nie die bestellings vir die joernaal lees nie:", fout);
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
