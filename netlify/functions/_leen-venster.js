// netlify/functions/_leen-venster.js
//
// Een getal, twee lesers.
//
// kry-my-boeke.js wys die opgradeer-knoppie wanneer 'n leen nog hoogstens
// soveel dae oor het. leen-herinnering.js stuur die pos oor daardie selfde
// venster. Die pos se hele bestaansrede is om die koper na daardie knoppie
// te stuur — staan die twee getalle uit pas, verwys 'n pos na iets wat nog
// nie op die skerm is nie, of verskyn 'n knoppie waaroor niemand ingelig
// is nie.
//
// Albei het die getal voorheen elk in sy eie lêer gedra, met 'n kommentaar
// wat gevra het dat 'n mens onthou om albei te verander. 'n Kommentaar is
// nie 'n waarborg nie.
//
// NIE HIER NIE: die 14 dae wat die koepon ná die leen bly leef. Daardie
// getal staan in paystack-webhook.js en het net een leser, dus kan dit nie
// dryf nie.

const LEEN_OPGRADERING_VENSTER_DAE = 5;

module.exports = { LEEN_OPGRADERING_VENSTER_DAE };
