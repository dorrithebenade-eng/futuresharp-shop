// netlify/functions/kry-fakture.js
//
// Lys die fakture. Rol: boekhouding.
//
// DIT IS DIE POORT. Die skerm kan 'n knoppie wegsteek, maar dit is hierdie
// Function wat besluit wie die data sien. Word die skakel in die kieslys ooit
// weggelaat of raai iemand die URL, is die antwoord steeds 403.
//
// _rol-kontrole.js hoef niks te verander nie — kontroleer_rol() neem reeds 'n
// LYS vereiste rolle. Kom daar later 'n boekhouer by wat net mag kyk, word
// dit hier `["boekhouding", "boekhouding_lees"]` en niks anders skuif nie.
//
// LET WEL: hierdie antwoord word VELD VIR VELD gebou. 'n Nuwe veld op die
// rekord kom NIE vanself deur nie — dieselfde slaggat as `leers` in
// kry-indienings.js, waar 'n outeur se manuskrip gelyk het of hy weg is.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_fakture_store } = require("./_fakture");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const store = kry_fakture_store();

  let sleutels = [];
  try {
    const lys = await store.list();
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die fakture lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die fakture laai nie" };
  }

  const fakture = [];
  for (const sleutel of sleutels) {
    let rekord;
    try {
      rekord = await store.get(sleutel, { type: "json" });
    } catch (fout) {
      console.error(`Kon nie faktuur ${sleutel} lees nie:`, fout);
      continue;
    }
    if (!rekord) continue;

    fakture.push({
      sleutel,
      nommer: rekord.nommer || null,
      stand: rekord.stand || "konsep",
      geskep_op: rekord.geskep_op || null,
      uitgereik_op: rekord.uitgereik_op || null,
      klient_naam: (rekord.klient && rekord.klient.naam) || "",
      bestelnommer: rekord.bestelnommer || "",
      totaal_sent: rekord.totaal_sent || 0,
      // Die toetsstempel. Die skerm gebruik hom om te sê wat geskrap kan word;
      // skrap-faktuur.js dwing dit af. DIE ANTWOORD WORD VELD VIR VELD GEBOU —
      // 'n nuwe veld op die rekord kom nie vanself hier deur nie.
      toets: rekord.toets === true,
      betaal_metode: (rekord.betaling && rekord.betaling.metode) || null,
      // Betaal is nie die einde nie — die verslag moet nog uitgaan. Dit is
      // GEEN stand nie; die stande gaan oor geld.
      gelewer_op: (rekord.lewering && rekord.lewering.gestuur_op) || null,
    });
  }

  // Nuutste eerste. By 'n oop lys is die vraag byna altyd "wat het laas
  // gebeur?", nie "hoe het dit begin nie".
  fakture.sort((a, b) => String(b.geskep_op || "").localeCompare(String(a.geskep_op || "")));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fakture }),
  };
};
