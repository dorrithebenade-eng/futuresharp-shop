// netlify/functions/teenwoordigheid.js
//
// Wie is nou aanlyn? Vir die Boekhouding-paneel se kopbalk.
//
// WAAROM DIT BESTAAN
//
// Dorrithé en Ignatius werk albei in dieselfde module, dikwels op dieselfde
// dag. Sonder enige aanduiding weet nie een of die ander een nou ook daar is
// nie -- en dan word 'n vraag per WhatsApp gevra wat oor 'n oomblik self
// beantwoord sou wees, of twee mense werk gelyktydig aan dieselfde ding.
//
// EEN OPROEP DOEN ALBEI DINGE
//
// Elke pols SKRYF die roeper se eie merk EN LEES die ander s'n terug. Twee
// aparte Functions sou die aantal oproepe verdubbel vir presies dieselfde
// resultaat.
//
// DIE KOSTE
//
// Pols elke twee minute, en slegs terwyl 'n oortjie sigbaar is. Twee mense,
// twee uur per dag elk, is sowat 120 oproepe per dag -- onder 4 000 per maand
// teen 'n perk van 125 000. Teenwoordigheid hoef nie sekondes-akkuraat te
// wees nie; 'n halfminuut-pols sou dit verviervoudig vir geen wins nie.
//
// GEEN SKOONMAAK NODIG NIE
//
// Die register is 'n vaste, klein aantal sleutels -- een per persoon wat ooit
// die paneel oopgemaak het, en dit is twee mense. 'n Ou merk word by die
// volgende besoek oorgeskryf en word intussen deur die VERVAL-toets
// weggefiltreer. Niks groei nie, dus is daar niks om te snoei nie.
//
// WAT DIT NIE IS NIE
//
// Dit is nie 'n slot nie. Dit sê wie aanlyn is, nie wie watter faktuur oop
// het nie. Daardie tweede ding sou 'n skryf by elke oopmaak en toemaak verg,
// plus 'n manier om 'n vergete oortjie se slot te breek.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

// Ná hoe lank word iemand as weg beskou. Ruim meer as die pols van twee
// minute: 'n enkele gemiste pols -- 'n stadige netwerk, 'n rekenaar wat 'n
// oomblik slaap -- mag nie iemand laat verdwyn wat wel daar is nie.
const VERVAL_MS = 5 * 60 * 1000;

// Die sleutel is die Identity-id, nie die e-pos nie: 'n adres kan verander,
// die id nooit.
function teks(waarde) {
  return String(waarde == null ? "" : waarde).trim();
}

// Die naam wat op die skerm verskyn. Identity dra dikwels net 'n e-pos, en
// "ignatius.gous@gmail.com is aanlyn" lees sleg. Die deel voor die @ is nader
// aan 'n naam as die hele adres.
function kies_naam(gebruiker) {
  const meta = gebruiker.user_metadata || {};
  const volle = teks(meta.full_name) || teks(meta.naam);
  if (volle) return volle.slice(0, 60);

  const epos = teks(gebruiker.email);
  if (!epos) return "Iemand";
  const voor = epos.split("@")[0];
  // "dorrithe.benade" -> "Dorrithe Benade"
  return voor
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .slice(0, 60);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metode nie toegelaat nie" };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(
    event,
    context,
    "boekhouding"
  );
  if (!gebruiker) {
    return { statusCode: 403, body: "Geen toegang tot Boekhouding nie" };
  }

  const store = kry_store("teenwoordigheid");
  const nou = Date.now();

  // --- Skryf die roeper se eie merk ---
  //
  // Die naam word saam met die tydstempel gestoor. Sonder dit sou die lees
  // 'n tweede oproep na Identity verg vir elke persoon in die lys, net om 'n
  // id in 'n naam te verander.
  try {
    await store.setJSON(gebruiker.id, {
      naam: kies_naam(gebruiker),
      op: nou,
    });
  } catch (fout) {
    // AANGETEKEN, NIE GEGOOI NIE. Kan ons nie skryf nie, kan ons dalk nog
    // lees -- en 'n leser wat sien wie anders daar is, is meer werd as niks.
    console.error(`Kon nie teenwoordigheid vir ${gebruiker.id} skryf nie:`, fout);
  }

  // --- Lees die ander terug ---
  const ander = [];
  try {
    const { blobs } = await store.list();
    for (const { key } of blobs || []) {
      // Die roeper self staan nooit in sy eie lys nie. "Jy is aanlyn" is
      // geen nuus.
      if (key === gebruiker.id) continue;

      const merk = await store.get(key, { type: "json" }).catch(() => null);
      if (!merk || typeof merk.op !== "number") continue;
      if (nou - merk.op > VERVAL_MS) continue;

      ander.push({
        naam: teks(merk.naam) || "Iemand",
        // Sekondes sedert die laaste merk. Die skerm besluit self of hy 'n
        // syfer wys; die Function stuur die feit.
        sedert_s: Math.max(0, Math.round((nou - merk.op) / 1000)),
      });
    }
  } catch (fout) {
    console.error("Kon nie die teenwoordigheidsregister lees nie:", fout);
  }

  ander.sort((a, b) => a.naam.localeCompare(b.naam, "af"));

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // Nooit kas nie. 'n Gekaste antwoord sou iemand aanlyn wys wat lankal
      // weg is, of andersom.
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({ ander }),
  };
};
