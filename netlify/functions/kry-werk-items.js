// netlify/functions/kry-werk-items.js
//
// Lys die register van werk en uitgawes. Rol: boekhouding.
//
// DIE ANTWOORD WORD VELD VIR VELD GEBOU. 'n Nuwe veld op die rekord kom NIE
// vanself hier deur nie — dieselfde slaggat as kry-my-indienings.js op
// 8 Augustus, waar die outeur se lêers korrek gestoor was maar nie in die
// antwoord gesit het nie en die vorm sy blokke leeg geteken het.
//
// AFGESKAKELDE ITEMS KOM WEL DEUR, met hul `aktief`-vlag. Die register wys
// hulle gedemp; die faktuurvorm se keuselys sal hulle uitfilter. Sou hierdie
// Function hulle wegsteek, kon 'n mens hulle nooit weer aanskakel nie.

const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");
const { kry_werk_items_store } = require("./_werk-items");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ["boekhouding"]);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const store = kry_werk_items_store();

  let sleutels = [];
  try {
    const lys = await store.list();
    sleutels = (lys.blobs || []).map((b) => b.key);
  } catch (fout) {
    console.error("Kon nie die werk-items lys nie:", fout);
    return { statusCode: 500, body: "Kon nie die register laai nie" };
  }

  const rekords = [];
  for (const sleutel of sleutels) {
    try {
      const r = await store.get(sleutel, { type: "json" });
      if (r) rekords.push(r);
    } catch (fout) {
      console.error(`Kon nie item ${sleutel} lees nie:`, fout);
    }
  }

  const items = rekords.map((r) => ({
    item_id: r.item_id || "",
    soort: r.soort === "werk" ? "werk" : "uitgawe",
    naam: r.naam || "",
    beskrywing: r.beskrywing || "",
    aktief: r.aktief !== false,
    geskep_op: r.geskep_op || null,
  }));

  items.sort((a, b) => (a.naam || "").localeCompare(b.naam || "", "af-ZA"));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  };
};
