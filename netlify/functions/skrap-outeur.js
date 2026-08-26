// Personeel-beskermd — skrap 'n inskrywing uit die "outeurs"-store.
// Blokkeer NIE skrapping as dit reeds op 'n boek se verdeling gebruik
// word nie — die paneelbord wys eerder 'n waarskuwing vooraf aan
// personeel (kliëntkant, teen die produklys) en laat hulle self besluit.
//
// DIE DOKUMENTE GAAN SAAM
//
// 'n Outeur wat deur die uitnodigingsvloei gekom het, dra `dokumente`: sy
// ID-afskrif en die ondertekende ooreenkoms. Daardie lêers word NOOIT na die
// outeursrekord gekopieer nie — hulle bly in `uitnodiging-leers` en die rekord
// dra net die verwysing. Sien voltooi-uitnodiging.js: twee plekke met dieselfde
// ID-afskrif is die laaste ding wat 'n mens van gevoelige data wil hê.
//
// Die keerkant daarvan is dat die REKORD die enigste ding is wat weet waar
// daardie lêers lê. Verwyder 'n mens hom sonder om hulle saam te verwyder, is
// daar geen pad meer terug na hulle nie -- en dan lê 'n geskrapte persoon se
// identiteitsdokument vir ewig op die stelsel. 'n Mens skrap iemand JUIS om
// daarvan ontslae te raak.
//
// DIE LEERS EERSTE, DIE REKORD LAASTE. Misluk 'n lêer se verwydering, staan
// die rekord nog en 'n mens kan weer probeer. Andersom is die rekord weg en
// die lêers onbereikbaar -- presies die toestand wat ons wil vermy.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang nie — personeel-rol vereis" };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Ongeldige JSON" };
  }

  const outeur_id = (invoer.outeur_id || "").trim();
  if (!outeur_id) {
    return { statusCode: 400, body: "Verpligte veld: outeur_id" };
  }

  const store = kry_store("outeurs");

  const bestaande = await store.get(outeur_id, { type: "json" });
  if (!bestaande) {
    return { statusCode: 404, body: `Geen inskrywing met ID "${outeur_id}" gevind nie` };
  }

  // --- Die dokumente eerste ---
  //
  // Elke inskrywing dra `store` en `sleutel`. Ons vertrou die `store`-veld en
  // raai dit nie: 'n rekord uit 'n vroeer weergawe kon 'n ander store gehad
  // het, en 'n gehardekodeerde naam sou stilweg die verkeerde ding skrap of
  // niks skrap nie.
  const dokumente = (bestaande.dokumente && typeof bestaande.dokumente === "object")
    ? bestaande.dokumente
    : {};

  const leers_geskrap = [];
  const leers_misluk = [];

  for (const soort of Object.keys(dokumente)) {
    const dok = dokumente[soort];
    if (!dok || !dok.sleutel || !dok.store) continue;
    try {
      await kry_store(dok.store).delete(dok.sleutel);
      leers_geskrap.push(soort);
    } catch (fout) {
      // AANGETEKEN, NIE GEGOOI NIE. 'n Leer wat reeds weg is (of 'n store wat
      // nie meer bestaan nie) mag nie die skrapping keer nie -- dan sou 'n
      // mens die outeur nooit kon verwyder nie. Die antwoord se watter een
      // agtergebly het, sodat dit met die hand nagegaan kan word.
      console.error(
        `Kon nie ${soort} (${dok.store}/${dok.sleutel}) vir outeur ${outeur_id} skrap nie:`,
        fout
      );
      leers_misluk.push(soort);
    }
  }

  await store.delete(outeur_id);

  if (leers_misluk.length) {
    console.warn(
      `Outeur ${outeur_id} is geskrap, maar hierdie leers het agtergebly: ${leers_misluk.join(", ")}`
    );
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      geskrap: outeur_id,
      leers_geskrap,
      leers_misluk,
    }),
  };
};
