// public/js/dankie-stand.js
//
// Wat het met die betaling gebeur? Vra dit, en sê dit.
//
// WAAROM DIT 'N EIE LÊER IS
//
// dankie.html het sy logika in 'n <script>-blok onderaan gedra. Daardie blok
// het by ELKE uitkoms "Dankie vir jou bestelling" gesê en die mandjie
// leeggemaak — ook wanneer die koper op Paystack se bladsy gekanselleer het.
// Hy het dan niks betaal, niks gekoop, en sy mandjie was weg.
//
// Hierdie lêer neem daardie werk oor. Die HTML-blok val weg; die bestaande
// opskrif- en teks-elemente bly presies waar hulle is en word hier gevul.
//
// DIE MANDJIE IS DIE MANDJIE
//
// Dit is hoe elke aanlynwinkel met onmiddellike betaling werk: kanselleer jy,
// kom jy terug en jou mandjie is soos jy hom gelos het. begin-betaling.js is
// reeds daarvoor gebou — kry_of_skep_bestelnommer() in voltooi-betaling.js
// hergebruik die bestelnommer uit sessionStorage, en die Function tel dan 'n
// tweede POGING op DIESELFDE bestelling. Geen tweede rekord, geen wees-
// bestelling wat vir ewig op "Wag vir betaling" lê.
//
// Dit werk net as die bestelnommer bly staan. Daarom word hy — saam met die
// mandjie — slegs uitgevee wanneer daar werklik 'n transaksie by die bank is.
//
//   betaal    mandjie leeg, bestelnommer weg. Die bestelling is klaar.
//   loop      mandjie leeg, bestelnommer weg. 'n Instant EFT wat by die bank
//             hang, kan nog deurgaan; 'n vol mandjie sou 'n tweede bestelling
//             vir dieselfde boeke uitnooi, en die module het geen terugbetaling
//             nie. Die boodskap sê waarom, sodat dit soos 'n beskerming lyk.
//   oop       ALBEI BLY. Niks is afgetrek nie en niks het gebeur nie.
//   onbekend  ALBEI BLY. Ons weet nie, en 'n leë mandjie op grond van 'n
//             raaiskoot is die duurder fout.
//
// DIE TERUGVAL IS ALTYD "onbekend". Verval die sessie terwyl die koper op
// Paystack was, antwoord die Function 401. Dit mag nie soos 'n mislukte
// betaling lyk nie — dus onbekend, en die mandjie bly.

const DS_BESTELNOMMER_SLEUTEL = "future_shop_bestelnommer_konsep";
const DS_MANDJIE_SLEUTEL = "future_shop_mandjie";

// Watter uitkomste 'n transaksie by die bank beteken. Alles hier maak die
// mandjie leeg; alles anders laat hom staan.
const DS_BY_DIE_BANK = ["betaal", "loop"];

// Slegs vir die TELLING. Wat gekoop is, kom uit die bestelling -- sien
// ds_teken. Die mandjie weet net wat nog wag.
function ds_lees_mandjie() {
  try {
    const ruwe = localStorage.getItem(DS_MANDJIE_SLEUTEL);
    const items = ruwe ? JSON.parse(ruwe) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function ds_maak_leeg() {
  localStorage.removeItem(DS_MANDJIE_SLEUTEL);
  sessionStorage.removeItem(DS_BESTELNOMMER_SLEUTEL);
  // Die teller in die kop lees uit localStorage en word nie vanself herteken
  // nie — sonder hierdie oproep bly "3" langs 'n leë mandjie staan.
  if (typeof wys_mandjie_teller === "function") wys_mandjie_teller();
}

function ds_stel(id, teks) {
  const el = document.getElementById(id);
  if (el) el.textContent = teks;
}

function ds_wys_knoppie(id, wys) {
  const el = document.getElementById(id);
  if (el) el.hidden = !wys;
}

// Die opskrif en die teks per uitkoms.
//
// DIE FORMATE KOM UIT DIE BESTELLING, NIE UIT DIE MANDJIE NIE. 'n Suiwer
// e-boekbestelling is 'n AANKOOP wat klaar is; enigiets met 'n harde kopie is
// 'n BESTELLING waarop 'n druk- en afleweringsproses volg. Die ou kode het die
// mandjie gelees om dit te weet -- maar teen die tyd dat die koper hierdie
// bladsy lees, is die mandjie leeg, en dan moes die bladsy raai. 'n Sin soos
// "het jou bestelling e-boeke bevat" laat die koper ONS twyfel sien oor iets
// wat hy pas gekoop het. kry-bestelstand.js antwoord dit nou.
function ds_teken(stand, u) {
  const kaart = document.getElementById("dankie-kaart");
  if (kaart) kaart.className = "dankie-kaart ds-t-" + stand;

  ds_stel("dankie-merkie", t("ds_merk_" + stand));

  if (stand === "betaal") {
    if (u.bevat_eboek && !u.bevat_harde_kopie) {
      ds_stel("dankie-titel", t("dankie_titel_aankoop"));
      ds_stel("dankie-teks", t("dankie_teks_eboek_alleen"));
    } else {
      ds_stel("dankie-titel", t("dankie_titel"));
      ds_stel("dankie-teks", t("dankie_teks_bevat_harde_kopie"));
    }
    ds_wys_knoppie("dankie-my-boeke-knoppie", true);
    ds_wys_knoppie("dankie-mandjie-knoppie", false);
    return;
  }

  ds_stel("dankie-titel", t("ds_kop_" + stand));
  ds_stel("dankie-teks", t("ds_teks_" + stand));

  // By "loop" is die bestelling by die bank en die koper wag op sy boeke —
  // My Boeke is die regte plek. By "oop" en "onbekend" is die mandjie nog
  // vol en is dít waarheen hy moet gaan.
  const na_my_boeke = stand === "loop";
  ds_wys_knoppie("dankie-my-boeke-knoppie", na_my_boeke);
  ds_wys_knoppie("dankie-mandjie-knoppie", !na_my_boeke);
}

// Die mandjiereël onder die knoppies.
//
// SY STAAN NET WAAR DIE KOPER SELF DIE VRAAG SOU VRA. Ná 'n kansellasie wonder
// hy of sy keuses weg is, en dan is die antwoord nuus. Ná 'n GESLAAGDE aankoop
// dink niemand aan sy mandjie nie -- "Mandjie leeggemaak" is dan huishouding
// wat ons oor onsself vertel, en dit laat hom boonop wonder of hy bekommerd
// moes gewees het. Dieselfde by "loop": die waarskuwing teen 'n tweede
// bestelling staan in die hoofteks, waar sy hoort.
function ds_teken_mandjie(stand, aantal) {
  const el = document.getElementById("dankie-mandjie-nota");
  if (!el) return;
  if (stand === "betaal" || stand === "loop" || aantal < 1) {
    el.textContent = "";
    return;
  }
  // Een item is nie "1 items" nie. Twee sleutels, want die reël is kort genoeg
  // dat 'n mens die fout dadelik sien.
  el.textContent =
    aantal === 1
      ? t("ds_mandjie_behou_een")
      : t("ds_mandjie_behou").replace("{n}", aantal);
}

async function ds_begin() {
  const params = new URLSearchParams(window.location.search);
  const bestelnommer =
    params.get("bestelnommer") || params.get("reference") || "";

  ds_stel(
    "dankie-bestelnommer",
    bestelnommer ? `${t("bestelnommer_etiket")}: ${bestelnommer}` : ""
  );

  // Die MANDJIE se lengte, gelees voordat enigiets hom kan leegmaak. Dit is
  // die enigste ding waarvoor die mandjie hier nog dien: hoeveel wag nog vir
  // die koper ná 'n kansellasie. WAT gekoop is, kom uit die bestelling.
  const in_mandjie = ds_lees_mandjie().length;

  // Die terugval as die oproep misluk of die sessie verval het. "onbekend"
  // hou die mandjie, wat die veilige kant is: 'n leë mandjie op grond van 'n
  // raaiskoot is die duurder fout.
  let uitslag = { stand: "onbekend", bevat_eboek: false, bevat_harde_kopie: false };

  if (bestelnommer) {
    try {
      const sessie =
        typeof identiteit_kry_huidige_sessie === "function"
          ? await identiteit_kry_huidige_sessie()
          : null;

      if (sessie && sessie.access_token) {
        const resp = await fetch(
          "/.netlify/functions/kry-bestelstand?bestelnommer=" +
            encodeURIComponent(bestelnommer),
          { headers: { Authorization: `Bearer ${sessie.access_token}` } }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.stand) uitslag = data;
        }
      }
    } catch (fout) {
      console.error("Kon nie die bestelstand kry nie:", fout);
    }
  }

  if (DS_BY_DIE_BANK.includes(uitslag.stand)) ds_maak_leeg();

  ds_teken(uitslag.stand, uitslag);
  ds_teken_mandjie(uitslag.stand, in_mandjie);
}

document.addEventListener("DOMContentLoaded", ds_begin);
