// Gedeelde besoekteller — een plek vir die tel-logika van die winkel se
// tuisblad (tel-besoek.js) en FutureSharp Talks (tel-fst-besoek.js).
//
// Elke teller is vier lopende syfers in die "statistieke"-store: totaal
// (herstel net met 'n knoppie) plus vandag/week/maand, wat OUTOMATIES
// herstel sodra 'n nuwe periode begin. Elke maand se finale syfer word
// geargiveer voordat dit herstel. Geen IP-adresse, koekies of enige
// identifiseerbare inligting nie.
//
// VOORVOEGSEL. Die winkel se sleutels het geen voorvoegsel nie ("totaal",
// "daagliks", ...), presies soos voorheen, sodat sy bestaande getalle bly.
// FutureSharp Talks se sleutels begin met "fst-" ("fst-totaal", ...).

const { kry_store } = require("./_blob-store");
const { kry_periode_sleutels } = require("./_periode-sleutels");

const AFDELINGS = { winkel: "", fst: "fst-" };

function sleutels_vir(voorvoegsel) {
  return {
    totaal: `${voorvoegsel}totaal`,
    daagliks: `${voorvoegsel}daagliks`,
    weekliks: `${voorvoegsel}weekliks`,
    maandeliks: `${voorvoegsel}maandeliks`,
    geskiedenis: `${voorvoegsel}maandelikse-geskiedenis`,
  };
}

async function tel_besoek(voorvoegsel) {
  const store = kry_store("statistieke");
  const k = sleutels_vir(voorvoegsel);
  const { daagliks: vandag_sleutel, weekliks: week_sleutel, maandeliks: maand_sleutel } = kry_periode_sleutels(new Date());

  const [totaal_rec, dag_rec, week_rec, maand_rec] = await Promise.all([
    store.get(k.totaal, { type: "json" }),
    store.get(k.daagliks, { type: "json" }),
    store.get(k.weekliks, { type: "json" }),
    store.get(k.maandeliks, { type: "json" }),
  ]);

  const nuwe_totaal = (totaal_rec?.telling || 0) + 1;
  const nuwe_dag = dag_rec && dag_rec.sleutel === vandag_sleutel ? dag_rec.telling + 1 : 1;
  const nuwe_week = week_rec && week_rec.sleutel === week_sleutel ? week_rec.telling + 1 : 1;
  const nuwe_maand = maand_rec && maand_rec.sleutel === maand_sleutel ? maand_rec.telling + 1 : 1;

  const skryf_take = [
    store.setJSON(k.totaal, { telling: nuwe_totaal }),
    store.setJSON(k.daagliks, { sleutel: vandag_sleutel, telling: nuwe_dag }),
    store.setJSON(k.weekliks, { sleutel: week_sleutel, telling: nuwe_week }),
    store.setJSON(k.maandeliks, { sleutel: maand_sleutel, telling: nuwe_maand }),
  ];

  // 'n Nuwe maand het aangebreek — argiveer die vorige maand se finale
  // syfer voordat dit oorskryf word, sodat 'n geskiedenis oor tyd bly.
  if (maand_rec && maand_rec.sleutel && maand_rec.sleutel !== maand_sleutel) {
    const geskiedenis_rec = await store.get(k.geskiedenis, { type: "json" });
    const geskiedenis_lys = Array.isArray(geskiedenis_rec?.maande) ? geskiedenis_rec.maande : [];
    geskiedenis_lys.push({ maand: maand_rec.sleutel, telling: maand_rec.telling });
    skryf_take.push(store.setJSON(k.geskiedenis, { maande: geskiedenis_lys }));
  }

  await Promise.all(skryf_take);
}

// 'n Teller word net herstel wanneer iemand besoek. Kom daar 'n dag, week
// of maand lank geen besoek nie, staan die ou rekord ongeroerd; pas die
// gestoorde sleutel nie by die huidige periode nie, is die antwoord 0.
function telling_indien_huidig(rekord, huidige_sleutel) {
  if (!rekord || rekord.sleutel !== huidige_sleutel) return 0;
  return rekord.telling || 0;
}

async function lees_tellers(voorvoegsel) {
  const store = kry_store("statistieke");
  const k = sleutels_vir(voorvoegsel);
  const nou = kry_periode_sleutels();
  const [totaal, dag, week, maand, geskiedenis] = await Promise.all([
    store.get(k.totaal, { type: "json" }),
    store.get(k.daagliks, { type: "json" }),
    store.get(k.weekliks, { type: "json" }),
    store.get(k.maandeliks, { type: "json" }),
    store.get(k.geskiedenis, { type: "json" }),
  ]);
  const maande = Array.isArray(geskiedenis?.maande) ? [...geskiedenis.maande] : [];
  maande.sort((a, b) => (a.maand < b.maand ? 1 : -1)); // nuutste eerste
  return {
    totaal: totaal?.telling || 0,
    vandag: telling_indien_huidig(dag, nou.daagliks),
    hierdie_week: telling_indien_huidig(week, nou.weekliks),
    hierdie_maand: telling_indien_huidig(maand, nou.maandeliks),
    maandelikse_geskiedenis: maande,
  };
}

module.exports = { AFDELINGS, sleutels_vir, tel_besoek, lees_tellers };
