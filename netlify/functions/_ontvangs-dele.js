// netlify/functions/_ontvangs-dele.js
// Weergawe 1 (19 Oktober 2026): uit kry-joernaal.js geskuif, sodat
// kry-jaareinde.js 'n debiteur op presies dieselfde manier oor die kategoriee
// verdeel as die joernaal 'n ontvangs. Die funksie self is onveranderd.

/* DIE ONTVANGS SE DELE.
 *
 * 'n Ontvangs is EEN bedrag; die faktuur se reels is verskeie, elk met sy eie
 * kategorie. Die verdeling is PRO RATA op die reelbedrae -- die enigste reel
 * wat altyd tot die ontvangs optel, ook wanneer die twee nie ooreenstem nie:
 * 'n gedeeltelike betaling, 'n afslag, 'n skenking.
 *
 * WAT ONDER DIENSINKOMSTE BLY
 *   'n KOSTEREEL. Haar kategorie is 'n UITGAWE-kategorie -- dit is presies wat
 *   die keuselys se rigtingfilter afdwing. Sou haar deel daaronder boek, staan
 *   inkomste onder 'n uitgawekop en die staat lieg.
 *   'n REEL SONDER KATEGORIE. Dit is wat voor vandag gebeur het, en 'n
 *   bestaande faktuur mag nie van betekenis verander nie.
 *   DIE SKENKING. Sy is nie werkswinkelinkomste nie; sy is haar eie ding, en
 *   sy word nie oor die reels versprei nie.
 *
 * DIE LAASTE DEEL NEEM DIE AFRONDINGSRES, sodat die dele PRESIES tot die
 * ontvangs optel. Dieselfde dissipline as fs_dele_van() in
 * faktuurpaneel-fin-staat.js en as die fooidele in faktuur-som.js.
 *
 * DELE MET DIESELFDE KATEGORIE SMELT SAAM. Drie werkswinkelreels gee een deel,
 * nie drie nie.
 */
function ontvangs_dele(f, ontvang_sent) {
  if (!(ontvang_sent > 0)) return [];

  const reels = Array.isArray(f.reels) ? f.reels : [];

  // Die gewig van elke reel is haar eie bedrag. Die skenking kry haar eie
  // gewig sodat sy nie oor die reels versprei nie.
  const gewigte = reels.map((r, ix) => {
    const sent = Math.round((Number(r.hoeveelheid) || 0) * (Number(r.prys_pp_sent) || 0));
    return {
      sent: sent > 0 ? sent : 0,
      kategorie_id:
        r.soort === "koste" || !r.kategorie_id ? "diensinkomste" : r.kategorie_id,
      // Watter reels hierdie deel dra (16 Okt 2026), sodat die staat 'n
      // faktuur se kategorie kan regstel (stel-faktuur-kategorie.js). 'n
      // Kostereel word nie verander nie.
      ix: r.soort === "koste" ? null : ix,
    };
  });

  const skenking = Number(f.skenking_sent) || 0;
  if (skenking > 0) gewigte.push({ sent: skenking, kategorie_id: "diensinkomste" });

  const totaal_gewig = gewigte.reduce((a, g) => a + g.sent, 0);
  if (totaal_gewig <= 0) {
    return [{ kategorie_id: "diensinkomste", bedrag_sent: ontvang_sent }];
  }

  const per_kat = new Map();
  const reels_per = new Map();
  let toegeken = 0;
  gewigte.forEach((g) => {
    if (g.sent <= 0) return;
    const deel = Math.round((ontvang_sent * g.sent) / totaal_gewig);
    per_kat.set(g.kategorie_id, (per_kat.get(g.kategorie_id) || 0) + deel);
    if (g.ix != null) reels_per.set(g.kategorie_id, (reels_per.get(g.kategorie_id) || []).concat([g.ix]));
    toegeken += deel;
  });

  const dele = [...per_kat.entries()].map(([kategorie_id, bedrag_sent]) => ({
    kategorie_id,
    bedrag_sent,
    reels: reels_per.get(kategorie_id) || [],
  }));

  // Die res van die afronding op die laaste deel.
  if (dele.length && toegeken !== ontvang_sent) {
    dele[dele.length - 1].bedrag_sent += ontvang_sent - toegeken;
  }

  return dele;
}

module.exports = { ontvangs_dele };
