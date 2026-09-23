// FutureSharp Talks — die vaste lys kategorieë.
//
// Dit is die lys uit Ignatius se uitnodiging. 'n Talk kan onder meer as een
// val; die EERSTE in die talk se lys is die hoofkategorie en bepaal die
// omslag se kleur.
//
// Die kliënt dra dieselfde lys (met kleure) in talk-omslag.js. Verander 'n
// id hier, moet dit daar ook verander, anders weier die stoor 'n kategorie
// wat die vorm aanbied.

const FST_KATEGORIEE = [
  { id: "navorsing", naam_af: "Navorsing", naam_en: "Research" },
  { id: "besigheid", naam_af: "Besigheid", naam_en: "Business" },
  { id: "medisyne", naam_af: "Medisyne", naam_en: "Medicine" },
  { id: "praktyk", naam_af: "Professionele praktyk", naam_en: "Professional practice" },
];

const FST_KATEGORIE_IDS = FST_KATEGORIEE.map((k) => k.id);

module.exports = { FST_KATEGORIEE, FST_KATEGORIE_IDS };
