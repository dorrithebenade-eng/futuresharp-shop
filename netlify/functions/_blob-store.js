// Gedeelde helper: bou 'n Netlify Blobs-winkel.
//
// AGTERGROND: Netlify het 'n bekende, tans-onopgeloste probleem (Julie 2026)
// waar die outomatiese Blobs-omgewingkonteks (siteID/token) soms nie korrek
// aan Functions ingespuit word nie, selfs op vars, korrek-gekoppelde werwe —
// dit gee dan 'n MissingBlobsEnvironmentError. Sien:
//   https://answers.netlify.com/t/missingblobsenvironmenterror-on-fresh-sites/164777
//
// OMWEG: Netlify se eie foutboodskap beveel aan om siteID + token
// HANDMATIG te voorsien wanneer outo-inspuiting faal. Ons doen dit hier,
// vanuit twee omgewingveranderlikes wat in die Netlify-kontrolepaneel
// gestel moet word (Project configuration > Environment variables):
//   FUTURE_SHOP_BLOBS_SITE_ID  — die werf se Project ID
//   FUTURE_SHOP_BLOBS_TOKEN    — 'n Personal Access Token (User settings > Applications)
//
// As hierdie veranderlikes nie gestel is nie, val ons terug op die gewone
// getStore(naam) — sodra Netlify hulle kant se probleem regmaak, sal dit
// outomaties weer sonder hierdie omweg werk.

const { getStore } = require("@netlify/blobs");

function kry_store(naam) {
  const siteID = process.env.FUTURE_SHOP_BLOBS_SITE_ID;
  const token = process.env.FUTURE_SHOP_BLOBS_TOKEN;

  if (siteID && token) {
    return getStore({ name: naam, siteID, token });
  }

  // Terugval — werk net indien Netlify se outo-inspuiting korrek funksioneer
  return getStore(naam);
}

module.exports = { kry_store };
