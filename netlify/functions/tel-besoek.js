// PUBLIEK — tel een tuisblad-besoek. Geen IP-adresse, koekies, of enige
// identifiseerbare inligting gestoor nie — net vier lopende syfers:
// totaal (herstel net met 'n knoppie), plus vandag/week/maand wat
// OUTOMATIES herstel sodra 'n nuwe dag/week/maand begin (die "sleutel"
// per periode verander eenvoudig, geen skedule-taak nodig nie). Elke
// maand se finale syfer word geargiveer in "maandelikse-geskiedenis"
// voordat dit herstel, sodat 'n geskiedenis oor tyd bewaar bly.

const { kry_store } = require("./_blob-store");

function iso_week_sleutel(datum) {
  // ISO 8601-weeknommer (Maandag = eerste dag, Week 1 bevat die jaar se
  // eerste Donderdag) — standaard, ondubbelsinnige weeksleutel.
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const dagNommer = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dagNommer);
  const jaarBegin = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNommer = Math.ceil(((d - jaarBegin) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNommer).padStart(2, "0")}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const store = kry_store("statistieke");
  const nou = new Date();
  const vandag_sleutel = nou.toISOString().slice(0, 10); // JJJJ-MM-DD
  const maand_sleutel = nou.toISOString().slice(0, 7); // JJJJ-MM
  const week_sleutel = iso_week_sleutel(nou);

  const [totaal_rec, dag_rec, week_rec, maand_rec] = await Promise.all([
    store.get("totaal", { type: "json" }),
    store.get("daagliks", { type: "json" }),
    store.get("weekliks", { type: "json" }),
    store.get("maandeliks", { type: "json" }),
  ]);

  const nuwe_totaal = (totaal_rec?.telling || 0) + 1;
  const nuwe_dag = dag_rec && dag_rec.sleutel === vandag_sleutel ? dag_rec.telling + 1 : 1;
  const nuwe_week = week_rec && week_rec.sleutel === week_sleutel ? week_rec.telling + 1 : 1;
  const nuwe_maand = maand_rec && maand_rec.sleutel === maand_sleutel ? maand_rec.telling + 1 : 1;

  const skryf_take = [
    store.setJSON("totaal", { telling: nuwe_totaal }),
    store.setJSON("daagliks", { sleutel: vandag_sleutel, telling: nuwe_dag }),
    store.setJSON("weekliks", { sleutel: week_sleutel, telling: nuwe_week }),
    store.setJSON("maandeliks", { sleutel: maand_sleutel, telling: nuwe_maand }),
  ];

  // 'n Nuwe maand het aangebreek — argiveer die vorige maand se finale
  // syfer voordat dit oorskryf word, sodat 'n geskiedenis oor tyd bly.
  if (maand_rec && maand_rec.sleutel && maand_rec.sleutel !== maand_sleutel) {
    const geskiedenis_rec = await store.get("maandelikse-geskiedenis", { type: "json" });
    const geskiedenis_lys = Array.isArray(geskiedenis_rec?.maande) ? geskiedenis_rec.maande : [];
    geskiedenis_lys.push({ maand: maand_rec.sleutel, telling: maand_rec.telling });
    skryf_take.push(store.setJSON("maandelikse-geskiedenis", { maande: geskiedenis_lys }));
  }

  await Promise.all(skryf_take);

  return { statusCode: 204, body: "" };
};
