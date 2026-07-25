// Personeel-beskermd — wis 'n produk PERMANENT uit, saam met sy gestoorde
// PDF, omslagbeeld, en enige leesvordering/watermerkte-kopie-kas. Anders as
// wysig-produk se "aktief = false" (wat 'n produk net uit die katalogus
// verberg, maar die rekord en bestellingsgeskiedenis intak hou), verwyder
// hierdie Function die rekord heeltemal — dis nie omkeerbaar nie.
//
// Veiligheidsnet: as enige koper reeds hierdie e-boek suksesvol gekoop het
// (status "Nuut" in 'n bestelling), weier ons die skrapping — hulle "My
// Boeke"/leser-toegang hang af van die PDF-blob wat hier ook verwyder sou
// word. Personeel moet in daardie geval eerder "Deaktiveer" gebruik, wat
// die produk uit die katalogus haal sonder om bestaande kopers se toegang
// te breek.

const { kry_store } = require("./_blob-store");
const { kry_gebruiker_en_kontroleer_rol } = require("./_rol-kontrole");

async function het_bestaande_kopers(slug) {
  const bestellings_store = kry_store("bestellings");
  const { blobs } = await bestellings_store.list();

  for (const item of blobs) {
    const ruwe = await bestellings_store.get(item.key);
    if (!ruwe) continue;

    let bestelling;
    try {
      bestelling = JSON.parse(ruwe);
    } catch {
      continue;
    }

    if (bestelling.status !== "Nuut") continue;

    const items = Array.isArray(bestelling.items) ? bestelling.items : [];
    if (items.some((i) => i.produk_slug === slug && i.formaat === "eboek")) {
      return true;
    }
  }
  return false;
}

// Haal die Blobs-sleutel uit 'n "/.netlify/functions/kry-omslag?bestand=..."
// -pad — die katalogus-rekord stoor net hierdie volledige pad, nie die rou
// sleutel nie.
function kry_omslag_sleutel(omslag_pad) {
  if (!omslag_pad) return null;
  try {
    const url = new URL(omslag_pad, "https://placeholder.invalid");
    return url.searchParams.get("bestand");
  } catch {
    return null;
  }
}

// Verwyder alle sleutels in 'n store wat met 'n gegewe voorvoegsel begin —
// gebruik vir lees-vordering en eboeke-gemerk, wat albei per-koper-sleutels
// het (`${slug}--${gebruiker_id}`) wat nie vooraf bekend is nie.
async function verwyder_alles_met_voorvoegsel(store, voorvoegsel) {
  const { blobs } = await store.list();
  const passende = blobs.filter((item) => item.key.startsWith(voorvoegsel));
  await Promise.all(passende.map((item) => store.delete(item.key)));
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ fout: "Metode nie toegelaat nie" }) };
  }

  const gebruiker = await kry_gebruiker_en_kontroleer_rol(event, context, "personeel");
  if (!gebruiker) {
    return { statusCode: 403, body: JSON.stringify({ fout: "Geen toegang nie — personeel-rol vereis" }) };
  }

  let invoer;
  try {
    invoer = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ fout: "Ongeldige JSON" }) };
  }

  const { slug } = invoer;
  if (!slug) {
    return { statusCode: 400, body: JSON.stringify({ fout: "Verpligte veld: slug" }) };
  }

  try {
    const katalogus_store = kry_store("katalogus");
    const produk = await katalogus_store.get(slug, { type: "json" });
    if (!produk) {
      return { statusCode: 404, body: JSON.stringify({ fout: `Geen produk met slug "${slug}" nie` }) };
    }

    if (await het_bestaande_kopers(slug)) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          fout: "Hierdie e-boek is reeds deur ten minste een koper aangekoop — dit kan nie geskrap word sonder om hul toegang te breek nie. Gebruik eerder 'Deaktiveer' om dit uit die katalogus te haal.",
        }),
      };
    }

    // Hoof-rekord eerste — as enigiets hieronder faal, is die produk in
    // elk geval reeds uit die katalogus, wat die belangrikste is.
    await katalogus_store.delete(slug);

    const eboek_sleutel = produk.formate && produk.formate.eboek && produk.formate.eboek.eboek_sleutel;
    if (eboek_sleutel) {
      await kry_store("eboeke").delete(eboek_sleutel).catch((fout) => {
        console.warn("Kon nie e-boek-PDF-blob verwyder nie:", fout);
      });
    }

    const omslag_sleutel = kry_omslag_sleutel(produk.omslag);
    if (omslag_sleutel) {
      await kry_store("omslae").delete(omslag_sleutel).catch((fout) => {
        console.warn("Kon nie omslagbeeld verwyder nie:", fout);
      });
    }

    await verwyder_alles_met_voorvoegsel(kry_store("lees-vordering"), `${slug}--`).catch((fout) => {
      console.warn("Kon nie leesvordering-rekords verwyder nie:", fout);
    });
    await verwyder_alles_met_voorvoegsel(kry_store("eboeke-gemerk"), `${slug}--`).catch((fout) => {
      console.warn("Kon nie gemerkte-kopie-kas verwyder nie:", fout);
    });

    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (fout) {
    console.error("verwyder-produk fout:", fout);
    return { statusCode: 500, body: JSON.stringify({ fout: "Kon nie produk skrap nie, probeer later weer" }) };
  }
};
