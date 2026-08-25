// netlify/functions/skrap-klient.js
//
// Skrap 'n kliënt uit die register. Rol: boekhouding.
//
// DIT IS 'N OPRUIMING, NIE 'N GEWONE HANDELING NIE. 'n Kliënt met werk
// agter sy naam bly staan; wat hier weggaan, is die halfvoltooide rekord
// wat uit 'n toets of 'n tikfout gekom het.
//
// ─────────────────────────────────────────────────────────────────────────
// 'N KLIENT MET ENIGE FAKTUUR GAAN NOOIT WEG NIE — OOK NIE 'N KONSEP NIE.
//
// 'n Uitgereikte faktuur dra sy kliënt se besonderhede as 'n afskrif, dus sou
// die dokument self oorleef. Maar `klient_id` sou na niks wys, en dan kan
// niemand ooit weer vra "wat het ons alles vir hierdie skool gedoen" nie.
//
// 'n Konsep is nog niemand se geld, en die versoeking is om hom te ignoreer.
// Ons doen dit nie. 'n Konsep word 'n faktuur, en dan sit 'n mens met dieselfde
// gat — net later, en sonder om te weet waar dit vandaan kom. Staan daar 'n
// konsep in die pad, sê hierdie Function WATTER een, sodat 'n mens eers dié
// kan skrap en dan die kliënt.
// ─────────────────────────────────────────────────────────────────────────
//
// KAN ONS DIE FAKTURE NIE LEES NIE, WEIER ONS. Dieselfde keuse as
// los-duplikaat.js: 'n stukkende Blob-oproep mag nooit soos "geen fakture"
// lyk nie. Eerder 'n kliënt wat bly staan as 'n verwysing wat verdwyn.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_kliente_store } = require("./_kliente");
const {
  kry_fakture_store,
  is_konsep_sleutel,
  sleutel_na_nommer,
} = require("./_fakture");

// Gee terug WATTER fakture aan hierdie kliënt hang, nie net of daar is nie.
// "Hierdie kliënt het fakture" laat 'n mens self gaan soek; "FS/01961 en een
// konsep" sê waarheen om te gaan.
async function fakture_van(nommer) {
  const store = kry_fakture_store();
  const lys = await store.list();
  const uitgereik = [];
  let konsepte = 0;

  for (const b of lys.blobs || []) {
    const f = await store.get(b.key, { type: "json" });
    if (!f || f.klient_id !== nommer) continue;
    if (is_konsep_sleutel(b.key)) konsepte += 1;
    else uitgereik.push(f.nommer || sleutel_na_nommer(b.key) || b.key);
  }
  return { uitgereik, konsepte };
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const nommer = String(invoer.nommer || "").trim();
  if (!nommer) {
    return { statusCode: 400, body: "Geen kliëntnommer nie" };
  }

  const store = kry_kliente_store();

  let klient;
  try {
    klient = await store.get(nommer, { type: "json" });
  } catch (fout) {
    console.error(`Kon nie kliënt ${nommer} lees nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kliënt laai nie" };
  }
  if (!klient) return { statusCode: 404, body: "Kliënt nie gevind nie" };

  let gevind;
  try {
    gevind = await fakture_van(nommer);
  } catch (fout) {
    console.error("Kon nie die fakture nagaan nie:", fout);
    return {
      statusCode: 503,
      body: "Kon nie die fakture nagaan nie. Probeer weer — die kliënt is nie geskrap nie.",
    };
  }

  if (gevind.uitgereik.length) {
    return {
      statusCode: 409,
      body:
        `Hierdie kliënt het ${gevind.uitgereik.length === 1 ? "'n faktuur" : "fakture"}: ` +
        `${gevind.uitgereik.join(", ")}. 'n Kliënt met fakture kan nie geskrap word nie.`,
    };
  }

  if (gevind.konsepte) {
    return {
      statusCode: 409,
      body:
        gevind.konsepte === 1
          ? "Daar is 'n konsep vir hierdie kliënt. Skrap eers die konsep."
          : `Daar is ${gevind.konsepte} konsepte vir hierdie kliënt. Skrap eers die konsepte.`,
    };
  }

  try {
    await store.delete(nommer);
  } catch (fout) {
    console.error(`Kon nie kliënt ${nommer} skrap nie:`, fout);
    return { statusCode: 500, body: "Kon nie die kliënt skrap nie" };
  }

  console.log(
    `Kliënt ${nommer} (${klient.naam || ""}) geskrap deur ${(gebruiker && gebruiker.email) || ""}`
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nommer, geskrap: true }),
  };
};
