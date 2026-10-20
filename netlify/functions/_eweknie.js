// Eweknie-koppeling: twee uitgawes van dieselfde werk in verskillende tale
// (bv. SPEEL-SLIM en PLAY-SMART). Die koppeling is altyd wedersyds: as A
// na B wys, wys B na A. Hierdie lêer is die enigste plek wat die skakel
// aan albei kante skryf, sodat skep-, wysig- en verwyder-produk dieselfde
// reëls volg.
//
// Velde op die produkrekord:
//   taal          "af" | "en" | null   taal van hierdie uitgawe
//   eweknie_slug  slug | null          die uitgawe in die ander taal

const GELDIGE_TALE = ["af", "en"];

function kry_geldige_taal(waarde) {
  return GELDIGE_TALE.includes(waarde) ? waarde : null;
}

function kry_geldige_eweknie(waarde, eie_slug) {
  const slug = typeof waarde === "string" ? waarde.trim() : "";
  if (!slug || slug === eie_slug) return null;
  return slug;
}

// Kontroleer voor enige skryf of die gekose eweknie bestaan. Gee 'n
// foutboodskap terug, of null as alles in orde is.
async function kontroleer_eweknie(store, eweknie_slug) {
  if (!eweknie_slug) return null;
  const eweknie = await store.get(eweknie_slug, { type: "json" });
  if (!eweknie) return `Eweknie "${eweknie_slug}" bestaan nie in die katalogus nie.`;
  return null;
}

async function stel_skakel(store, slug, nuwe_waarde) {
  const rekord = await store.get(slug, { type: "json" });
  if (!rekord) return;
  if ((rekord.eweknie_slug || null) === nuwe_waarde) return;
  await store.setJSON(slug, { ...rekord, eweknie_slug: nuwe_waarde });
}

// Werk die ander kant(e) by nadat `slug` self reeds gestoor is.
//   ou_eweknie   die eweknie voor hierdie stoor (null by 'n nuwe produk)
//   nuwe_eweknie die eweknie na hierdie stoor
async function sinkroniseer_eweknie(store, slug, ou_eweknie, nuwe_eweknie) {
  // 1. Vorige eweknie los, as dit verander het en nog na ons wys.
  if (ou_eweknie && ou_eweknie !== nuwe_eweknie) {
    const ou = await store.get(ou_eweknie, { type: "json" });
    if (ou && ou.eweknie_slug === slug) await stel_skakel(store, ou_eweknie, null);
  }

  if (!nuwe_eweknie) return;

  // 2. As die nuwe eweknie reeds aan 'n derde boek gekoppel was, los die
  //    derde boek se skakel, anders wys twee boeke na dieselfde eweknie.
  const nuwe = await store.get(nuwe_eweknie, { type: "json" });
  if (!nuwe) return;
  const derde = nuwe.eweknie_slug;
  if (derde && derde !== slug) {
    const derde_rekord = await store.get(derde, { type: "json" });
    if (derde_rekord && derde_rekord.eweknie_slug === nuwe_eweknie) {
      await stel_skakel(store, derde, null);
    }
  }

  // 3. Nuwe eweknie wys terug na ons.
  await stel_skakel(store, nuwe_eweknie, slug);
}

// Reeks: boeke wat in 'n vaste volgorde saam vertoon word (bv. die vier
// SPEEL-SLIM-ouderdomsgroepe). reeks_slug is die reeks se naam soos
// personeel dit tik; volgorde_in_reeks is 1, 2, 3 ... Albei of geeneen.
function kry_geldige_reeks(waarde) {
  const leeg = { reeks_slug: null, volgorde_in_reeks: null };
  if (!waarde || typeof waarde !== "object") return leeg;
  const naam = typeof waarde.reeks_slug === "string" ? waarde.reeks_slug.trim().slice(0, 60) : "";
  if (!naam) return leeg;
  const volgorde = Number(waarde.volgorde_in_reeks);
  return {
    reeks_slug: naam,
    volgorde_in_reeks: Number.isInteger(volgorde) && volgorde > 0 ? volgorde : null,
  };
}

module.exports = {
  kry_geldige_reeks,
  kry_geldige_taal,
  kry_geldige_eweknie,
  kontroleer_eweknie,
  sinkroniseer_eweknie,
};
