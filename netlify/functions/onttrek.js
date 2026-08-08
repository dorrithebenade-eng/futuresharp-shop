// netlify/functions/onttrek.js
//
// Die outeur trek 'n indiening terug voordat dit hanteer is.
//
// TWEE VERTREKPUNTE, spieëlbeeld van dien-in.js:
//   ingedien → konsep    die vorm gaan terug na hom
//   wysiging → op_rak    die voorstel gaan terug; die boek bly op die rak
//
// DIE LÊERS BLY STAAN. Hy trek terug om iets reg te maak, nie om oor te
// begin nie — 'n manuskrip wat hy weer moet oplaai omdat hy 'n tikfout in
// die beskrywing gesien het, is straf vir niks. Wil hy 'n ander lêer stuur,
// kies hy hom; die sleutel is dieselfde en die nuwe een skryf bo-oor.
//
// DIE HANGENDE VOORSTEL BLY OOK STAAN. By 'n wysiging gaan die stand terug
// na `op_rak` terwyl `hangend` bly — dit is presies die toestand waarin 'n
// halfklaar wysiging hoort. Sou ons dit weggooi, verloor hy sy werk.
//
// NA `konsep`, nie na iets soos "onttrek" nie. 'n Vyfde stand sou beteken
// elke skerm en elke groepering moet hom ken, vir 'n toestand wat niks van
// 'n konsep verskil nie.
//
// ROL: "koper", met is_myne as die werklike grens.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_my_outeur } = require("./_my-outeur");
const { kry_indienings_store, voeg_geskiedenis_by, is_myne } = require("./_indienings");

function nommer_is_geldig(nommer) {
  return /^BV-\d{4}-\d{4}$/.test(String(nommer || ""));
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Slegs POST" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "koper");
  if (!gebruiker) {
    return { statusCode: 401, body: "Meld eers aan" };
  }

  const outeur = await kry_my_outeur(gebruiker);
  if (!outeur) {
    return { statusCode: 403, body: "Hierdie rekening is nie as 'n outeur geregistreer nie" };
  }

  let versoek;
  try {
    versoek = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Ongeldige versoek" };
  }

  if (!nommer_is_geldig(versoek.nommer)) {
    return { statusCode: 400, body: "Ongeldige vormnommer" };
  }

  const store = kry_indienings_store();

  let rekord;
  try {
    rekord = await store.get(versoek.nommer, { type: "json" });
  } catch (fout) {
    console.error("Kon nie die indiening lees nie:", fout);
    return { statusCode: 500, body: "Kon nie die indiening onttrek nie" };
  }

  if (!rekord) {
    return { statusCode: 404, body: "Hierdie vorm bestaan nie" };
  }
  if (!is_myne(rekord, outeur)) {
    return { statusCode: 403, body: "Hierdie vorm behoort nie aan hierdie rekening nie" };
  }

  // Reeds terug. Twee klikke, nie 'n oortreding nie.
  if (rekord.stand === "konsep" || rekord.stand === "op_rak") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nommer: rekord.nommer, stand: rekord.stand, reeds: true }),
    };
  }

  if (rekord.stand !== "ingedien" && rekord.stand !== "wysiging") {
    return { statusCode: 409, body: "Hierdie vorm kan nie onttrek word nie" };
  }

  // 'n Vorm wat op die rak is, het 'n produk. Een wat nog nooit goedgekeur
  // is nie, gaan terug na 'n konsep.
  const terug_na = rekord.stand === "wysiging" ? "op_rak" : "konsep";
  const nou = new Date().toISOString();

  rekord.stand = terug_na;
  rekord.gewysig_op = nou;
  rekord.ingedien_op = null;

  voeg_geskiedenis_by(rekord, "onttrek", gebruiker.email || outeur.naam || "", "");

  try {
    await store.setJSON(rekord.nommer, rekord);
  } catch (fout) {
    console.error("Kon nie die onttrekking stoor nie:", fout);
    return { statusCode: 500, body: "Kon nie die indiening onttrek nie" };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nommer: rekord.nommer, stand: terug_na }),
  };
};
