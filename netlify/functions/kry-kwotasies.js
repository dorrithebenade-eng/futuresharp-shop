// netlify/functions/kry-kwotasies.js
//
// Lys die kwotasies. Rol: boekhouding.
//
// DIT IS DIE POORT. Die skerm kan 'n knoppie wegsteek, maar dit is hierdie
// Function wat besluit wie die data sien. Word die pil in die kieslys ooit
// weggelaat of raai iemand die URL, is die antwoord steeds 403.
//
// DIE FILTER IS ANDERSOM AS DIE FAKTUURREGISTER S'N. kry-fakture.js sluit die
// kwotasies UIT; hierdie een sluit alles behalwe die kwotasies uit. Albei
// loop op die SLEUTEL, dus voor die get(): 'n faktuur word hier nooit eers
// gelees nie.
//
// LET WEL: hierdie antwoord word VELD VIR VELD gebou. 'n Nuwe veld op die
// rekord kom NIE vanself deur nie. Dit het op 8 Augustus met `leers` in
// kry-indienings.js gebeur, en op 27 Augustus met die reëls se verdeling in
// kry-faktuur.js — daardie een het stil dataverlies veroorsaak.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const {
  kry_kwotasies_store,
  is_kwotasie_sleutel,
  vertoon_stand,
} = require("./_kwotasies");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const store = kry_kwotasies_store();

  let sleutels = [];
  try {
    const lys = await store.list();
    sleutels = (lys.blobs || []).map((b) => b.key).filter(is_kwotasie_sleutel);
  } catch (fout) {
    console.error("Kon nie die kwotasies lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die kwotasies laai nie" };
  }

  // EEN OOMBLIK VIR DIE HELE LYS. Sou elke rekord sy eie `new Date()` kry,
  // kon twee kwotasies wat op dieselfde dag verval, oor 'n middernagslag
  // verskillend geoordeel word.
  const nou = new Date().toISOString();

  const kwotasies = [];
  for (const sleutel of sleutels) {
    let rekord;
    try {
      rekord = await store.get(sleutel, { type: "json" });
    } catch (fout) {
      console.error(`Kon nie kwotasie ${sleutel} lees nie:`, fout);
      continue;
    }
    if (!rekord) continue;

    kwotasies.push({
      sleutel,
      nommer: rekord.nommer || null,

      // TWEE STANDE, EN HULLE IS NIE DIESELFDE DING NIE.
      //
      //   stand   — wat op die rekord staan. Hy is wat 'n skryf-Function
      //             toets, en hy is nooit "verval".
      //   vertoon — wat die skerm wys. "verval" word HIER bereken uit
      //             geldig_tot en nooit gestoor nie: niks loop op 'n skedule
      //             nie, en 'n gestoorde stand sou verkeerd staan tot iemand
      //             die bladsy oopmaak. Dieselfde beginsel as die staat.
      stand: rekord.stand || "konsep",
      vertoon_stand: vertoon_stand(rekord, nou),

      geskep_op: rekord.geskep_op || null,
      uitgereik_op: rekord.uitgereik_op || null,
      geldig_tot: rekord.geldig_tot || null,

      // WIE DIE KONSEP GEMAAK HET. Dorrithé en Ignatius stel albei kwotasies
      // op; 'n konsep dra geen nommer, dus is die naam die enigste manier om
      // twee konsepte vir dieselfde skool uitmekaar te ken.
      geskep_deur: rekord.geskep_deur || "",

      klient_naam: (rekord.klient && rekord.klient.naam) || "",
      // DIE AFDELING BINNE DIE INSTANSIE. Drie konsepte vir dieselfde skool
      // is anders drie eenderse rye; die afdeling is dikwels die enigste ding
      // wat hulle uitmekaar hou. DIE ANTWOORD WORD VELD VIR VELD GEBOU -- 'n
      // nuwe veld op die rekord kom nie vanself hier deur nie.
      afdeling: rekord.afdeling || "",
      bestelnommer: rekord.bestelnommer || "",
      totaal_sent: rekord.totaal_sent || 0,

      // Die hersieningstelling wys by die kliëntreël. 'n Kwotasie op
      // hersiening 3 is 'n onderhandeling, nie 'n fout nie.
      hersiening: rekord.hersiening || 1,

      // Waar die aanvaarde kwotasie heen is. Die register wys die
      // faktuurnommer sonder om die faktuur te open.
      faktuur_nommer: rekord.faktuur_nommer || null,
      aanvaar_op: rekord.aanvaar_op || null,
      verwerp_op: rekord.verwerp_op || null,

      // Die toetsstempel. Die skerm gebruik hom om te sê wat geskrap kan
      // word; skrap-kwotasie.js dwing dit af.
      toets: rekord.toets === true,
    });
  }

  // Nuutste eerste. By 'n oop lys is die vraag byna altyd "wat het laas
  // gebeur?", nie "hoe het dit begin nie".
  kwotasies.sort((a, b) =>
    String(b.geskep_op || "").localeCompare(String(a.geskep_op || ""))
  );

  // DIE WERKSYFER: wat Future Sharp aangebied het en waaraan dit nog gebonde
  // is. Slegs wat UITGEREIK EN NOG GELDIG is tel — 'n konsep is nog niks, en
  // 'n verlope, aanvaarde of verwerpte aanbod bind niemand meer nie.
  //
  // DIT IS NIE VERWAGTE INKOMSTE NIE en mag nooit so genoem word nie. Dit
  // staan eers op die staat wanneer 'n faktuur uitgereik is.
  const oop = kwotasies.filter((k) => k.vertoon_stand === "uitgereik");
  const blootstelling_sent = oop.reduce((s, k) => s + (k.totaal_sent || 0), 0);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kwotasies,
      oop_aantal: oop.length,
      blootstelling_sent,
    }),
  };
};
