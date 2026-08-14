// netlify/functions/kry-begunstigdes.js
//
// Boekhouding-beskermd — lys alle inskrywings uit die "begunstigdes"-store.
//
// Word deur die Registers-blad gebruik, en later deur die faktuurvorm se
// ontvanger-keuselys. Future Sharp self verskyn NOOIT in daardie lys nie:
// die maatskappy is die hoofrekening, nie 'n begunstigde nie. Skep 'n mens
// tog 'n ry daarvoor, word die deel uitbetaal én daar bly niks vir
// Paystack nie.
//
// DIE OUTEURS-STORE WORD SAAM GELEES, vir één doel: om te wys dat 'n
// begunstigde reeds 'n outeur is. Paystack hou die eerste uitbetaling na 'n
// NUWE subrekening terug tot iemand dit goedkeur, en die bankbesonderhede
// hoort op een plek. Wie reeds 'n kode het, moet dus daardie kode hier kry
// eerder as 'n tweede subrekening.
//
// NET TWEE VELDE KOM UIT DAARDIE STORE: 'n boolean, en die kode van
// DIESELFDE persoon. Geen outeursnaam en geen lys outeurs gaan deur nie —
// die antwoord sê iets oor die begunstigde wat reeds op die skerm is, nie
// oor die outeursregister nie.
//
// Die begunstigde se eie rekord gaan volledig deur, nie veld vir veld nie —
// anders is 'n nuwe veld op die rekord onsigbaar vir die skerm en lyk dit
// of die stoor misluk het.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

const ROLLE = ["boekhouding"];

// Twee toetse, want die een sonder die ander mis presies die geval wat saak
// maak:
//
//   Dieselfde KODE — bevestig dat dit dieselfde persoon is. Nuttig, maar
//   die kode is dan reeds oorgeplak en die fout is klaar vermy.
//
//   Dieselfde ID — albei stores lei hul sleutel uit die naam af met
//   dieselfde slug. Dit vang die geval VOORDAT die kode ingeplak is, en dit
//   is waarvoor die merkie bestaan.
function pas_by_outeur(begunstigde, outeurs) {
  const kode = (begunstigde.subrekening_kode || "").trim();

  const op_kode = kode
    ? outeurs.find((o) => (o.subrekening_kode || "").trim() === kode)
    : null;
  if (op_kode) return op_kode;

  return outeurs.find((o) => o.outeur_id === begunstigde.begunstigde_id) || null;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, ROLLE);
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — boekhouding-rol vereis" };
  }

  const store = kry_store("begunstigdes");
  const { blobs } = await store.list();

  const begunstigdes = (
    await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);

  // Die outeurs-lees mag die skerm nooit breek nie. Misluk dit, verskyn die
  // begunstigdes eenvoudig sonder die merkie — dieselfde beginsel as 'n
  // e-pos wat nie 'n betaling mag breek nie.
  let outeurs = [];
  try {
    const outeur_store = kry_store("outeurs");
    const lys = await outeur_store.list();
    outeurs = (
      await Promise.all(
        (lys.blobs || []).map((b) => outeur_store.get(b.key, { type: "json" }))
      )
    ).filter(Boolean);
  } catch (fout) {
    console.error("Kon nie die outeurs lees vir die ook-outeur-merkie nie:", fout);
  }

  const verryk = begunstigdes.map((b) => {
    const outeur = pas_by_outeur(b, outeurs);
    return {
      ...b,
      ook_outeur: Boolean(outeur),
      // Die persoon se EIE kode uit die outeursregister. Die skerm gebruik
      // dit om te sê watter kode oorgeplak moet word wanneer die
      // begunstigde nog geen een het nie.
      outeur_subrekening_kode: outeur ? (outeur.subrekening_kode || "") : "",
    };
  });

  // Alfabeties, sodat die keuselys voorspelbaar is.
  const gesorteer = verryk.sort((a, b) =>
    (a.naam || "").localeCompare(b.naam || "", "af")
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ begunstigdes: gesorteer }),
  };
};
