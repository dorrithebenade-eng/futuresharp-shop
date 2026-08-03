# Future Shop

Tweetalige (Afrikaans/Engels) e-boekwinkel-platform vir **Future Sharp**
(`futureshop.futuresharp.co.za`, ook bereikbaar op `futuresharp-shop.netlify.app`).
Verkoop e-boeke, harde kopieë en tydelike leen-toegang, met
outeurs/vennote/dienverskaffers wat via omset-verdeling vergoed word.

> **Let wel oor hierdie README:** die projek is oor baie sessies in stappe
> gebou. Vorige weergawes van hierdie lêer het elke fase ("Fase 1", "Fase
> 2", ens.) as 'n aparte, chronologiese plan gedokumenteer. Hierdie
> weergawe herorganiseer dit as 'n **huidige-stand-verwysing** — wat
> *bestaan*, hoe dit werk, en wat nog oop is — eerder as 'n historiese
> logboek. Belangrike ontwerp-rasionaal uit die ou weergawe is behou waar
> dit steeds relevant is.

---

## Argitektuur op 'n oogopslag

| Laag | Tegnologie |
|---|---|
| Hosting + CD | Netlify, gekoppel aan GitHub (`dorrithebenade-eng/futuresharp-shop`) — elke `git push` na `main` ontplooi outomaties |
| Bediener-logika | Netlify Functions (`netlify/functions/*.js`) |
| Databerging | Netlify Blobs — geen tradisionele databasis nie, alles as JSON-rekords per "store" |
| Aanmelding | Netlify Identity (GoTrue), via 'n **eie** kliënt (`identiteit.js`) — sien "Aanmelding" hieronder |
| Betalings | Paystack — Transaction Splits vir outeur-/vennoot-verdeling |
| E-boek-leser | PDF.js 2.6.347 (cdnjs) in die blaaier, met `pdf-lib` vir onsigtbare watermerking |
| Tale | `taal.js` + `data-i18n`-stelsel, AF/EN — net die **koppelvlak**, nooit boek-inhoud self nie |

Twee heeltemal aparte "kante":
- **Winkelfront** (`index.html`, `produk.html`, `mandjie.html`, `my-boeke.html`, `leser.html`, ens.) — publiek, kopers meld self aan/registreer
- **Personeel-paneelbord** (`paneelbord.html`) — intern, net vir rekeninge met die `"personeel"`-Identity-rol

Die twee gebruik **aparte sessie-sleutels** in blaaier-storage
(`future_shop_identiteit_sessie_winkel` vs. `..._paneel`), sodat 'n
personeellid wat per ongeluk via die winkel se aanmeld-vorm aanmeld,
eenvoudig as 'n gewone koper behandel word in daardie konteks.

---

## Twee bekende Netlify-omgewingskwessies (en die omwegte)

Netlify se **outomatiese** konteks-inspuiting het herhaaldelik gefaal op
hierdie werf (Julie 2026, bekende/erkende Netlify-kwessies) — nie 'n fout
in ons kode nie, maar iets wat elders ook gerapporteer is:

1. **Blobs:** `MissingBlobsEnvironmentError`, selfs op vars, korrek-
   gekoppelde werwe. **Omweg** (`_blob-store.js`): siteID + token word
   HANDMATIG verskaf via twee omgewingveranderlikes
   (`FUTURE_SHOP_BLOBS_SITE_ID`, `FUTURE_SHOP_BLOBS_TOKEN`), val terug op
   gewone `getStore()` as dié nie gestel is nie.
2. **Identity:** `context.clientContext.user` word soms nie ingespuit
   nie. **Omweg** (`_rol-kontrole.js`): elke beskermde Function verifieer
   die JWT self, direk teen `/.netlify/identity/user`.

`_rol-kontrole.js` het in Aug 2026 twee dinge bygekry: 'n **kort kas
(60s)** en **in-vlug-samevoeging**, sodat die paneelbord se ~10 gelyktydige
Functions saam één Identity-aanroep doen i.p.v. tien. Dit onderskei ook nou
tussen "token is ongeldig" (401/403 — moenie herprobeer nie) en "Identity
kon nou nie antwoord nie" (429/5xx — herprobeer een keer). Voorheen was
albei stilweg `null`, wat 'n koersbeperking presies soos 'n ongeldige token
laat lyk het.

*Kas-afweging:* 'n rol wat verwyder word, kan tot 60 sekondes lank nog
toegang gee. Bewus gekies — kort genoeg om onbelangrik te wees.

Albei omwegte is intussen **in produksie bewys** en behoort onafhanklik
van Netlify se eie herstel te bly werk. **Bygewerkte risiko-status (Jul
2026):** Netlify het in Feb 2025 aangekondig hulle gaan Identity afskaf,
maar dít **omgekeer in Feb 2026** — Identity bly amptelik ondersteun,
geen migrasie nodig nie. Sien
https://www.netlify.com/blog/auth0-extension-identity-changes/.

**Sou Netlify ons ooit "laat val" (algehele kontinuïteitsrisiko):**
Hosting/CD en Functions is redelik maklik oordraagbaar (Vercel/Cloudflare
Pages/Render). **Blobs is die grootste vasgevang-risiko** — 'n eiesoortige
stoorformaat wat 'n regte migrasie sou verg na iets soos Cloudflare
KV/R2 of 'n databasis. 'n Eenvoudige periodieke JSON-uitvoer-rugsteun van
al die stores sou die goedkoopste versekering wees hierteen (nog nie
gebou nie — op die huishouding-lysie).

---

## Eie domein — en die slaggat wat dit meegebring het (Aug 2026)

Die winkel leef nou op **`futureshop.futuresharp.co.za`** (CNAME by
Afrihost → `futuresharp-shop.netlify.app`, Let's Encrypt-sertifikaat deur
Netlify uitgereik). Netlify merk 'n bygevoegde eie domein outomaties as
**Primary domain**, en dit het alles gebreek.

**Wat gebeur het:** `process.env.URL` is die *primêre* domein. `_rol-kontrole.js`
het daarheen teruggebel om die JWT te verifieer. Maar `futuresharp.co.za`
het 'n **wildcard-rekord** (`*.futuresharp.co.za`) wat na Afrihost se
bediener wys, en Netlify se Function-omgewing los die naam na die wildcard
op i.p.v. na die CNAME:

```
ERR_TLS_CERT_ALTNAME_INVALID
Host: futureshop.futuresharp.co.za is not in the cert's altnames:
DNS:bayek.aserv.co.za
```

Elke beskermde Function het 403 gegee. Die simptoom was **wisselvallig** —
sommige paneelbord-oortjies het gelaai, ander nie, en elke herlaai het 'n
ander mengsel gegee (DNS-kas per Function-instansie). Die blaaier los die
naam korrek op, dus het die winkel vir 'n gebruiker gewerk terwyl elke
Function gedruip het.

**Die reël hieruit:** 'n Function moet **nooit** oor die publieke internet
na sy eie werf terugbel via `process.env.URL` nie. `_rol-kontrole.js`
gebruik nou `https://${process.env.SITE_NAME}.netlify.app`, wat altyd na
Netlify oplos ongeag wat by die domeinverskaffer gebeur.

**Tweede gevolg:** 'n token wat op een oorsprong uitgereik is, word op 'n
ander geweier. Almal wat op `netlify.app` aangemeld was, moes een keer weer
aanmeld. Nie 'n voortdurende probleem nie, maar dit lyk soos 'n stukkende
winkel wanneer dit gebeur.

---

## Aanmelding — eie kliënt i.p.v. Netlify se Identity-widget

`public/js/identiteit.js` praat **direk** met die onderliggende
Identity-API (GoTrue) via `fetch` — nie Netlify se
`netlify-identity-widget.js` nie. Dié widget het herhaaldelik gebreek
wanneer blaaier-uitbreidings (Adobe Acrobat, Google Docs Offline) hul eie
skrips op dieselfde bladsy inspuit. Dis 'n suiwer front-end-verandering —
die JWT wat teruggegee word, is presies dieselfde tipe wat die widget sou
gegee het.

`identiteit.js` bied: aanmeld, registreer, wagwoord-herstel, token-
verwerking (uitnodiging/bevestiging), sessie-lees (met outo-verfris), en
afmeld. "Bly aangemeld"-keuseblokkie op beide aanmeld-vorms bepaal of
`localStorage` (aanhoudend) of `sessionStorage` (skoon by oortjie-toemaak)
gebruik word.

---

## Sekuriteitsgrens — personeel vs. publiek

Die skeiding tussen winkelfront en paneelbord berus **nooit** op
URL-obskuriteit nie. Twee dinge, altyd saam:

1. **Elke** personeel-beskermde Function roep
   `kry_gebruiker_en_kontroleer_rol(event, context, "personeel")` aan die
   begin van sy handler aan — gee `null` terug (en die Function stuur
   dan self 401/403) as die rol ontbreek. Dít is die werklike grens, nie
   die front-end nie.
2. **Geen kode-pad ken ooit "personeel" outomaties toe nie.** Selfregistrasie
   (koper-kant) ken altyd net `"koper"` toe. Die enigste manier om
   "personeel" te word, is 'n **handmatige** stap in Netlify se eie
   Identity-kontrolepaneel (Users → rol byvoeg).

Uitsondering wat dieselfde beginsel op 'n ander manier volg: die nuwe
**uitnodigings-stelsel** (sien onder) laat 'n vreemdeling toe om **sonder**
enige aanmelding 'n register-inskrywing te skep — maar net binne die noue
grense van 'n vooraf-deur-personeel-gegenereerde, eenmalige token. Geen
publieke Function ken ooit 'n Identity-rol toe nie.

**Die `vennoot`-rol (Aug 2026).** Ignatius en Eugene meld met `vennoot`
aan en sien **slegs** Dokumente en die Verdeling-rekenaar, lees-alleen.
Presies één Function is oopgemaak — `kry-dokumente.js` aanvaar
`["personeel", "vennoot"]`. `laai-dokument-op.js` en `skrap-dokument.js`
bly personeel-alleen, sodat 'n vennoot nie kan oplaai of skrap nie.

Die front-end-kant leef in `paneel-vennoot.js`: dit verwyder die
kieslys-items wat nie geld nie, en 'n `body.vennoot-modus`-klas verberg
die oplaai- en skrap-knoppies via CSS. Die CSS is **nie** die sekuriteit
nie — 'n verborge knoppie kan in die blaaier sigbaar gemaak word, en die
Function weier dan steeds. Die rede vir CSS eerder as JavaScript is dat
`dokumente.js` sy lys asinkroon herbou; 'n CSS-reël geld outomaties vir
elke ry wat later bykom.

Die rol word handmatig in Netlify → Identity toegeken. Het iemand albei
rolle, wen `personeel`.

---

## Katalogus & produkte

Boeke leef **nie as JSON-lêers in Git nie** — alles gaan via die
paneelbord se "Voeg produk by"/"Wysig"-vorm, wat na Netlify Blobs
("katalogus"-store) skryf en onmiddellik op die winkelfront verskyn,
sonder herontplooi.

**Sleutelbesluite:**
- Pryse in **sent**, nie rand nie (`prys_sent`) — vermy afrondingsfoute
- Harde kopie se afwesigheid = `beskikbaar: false`, knoppie verskyn eenvoudig nie
- `vrystelling_datum` per formaat = voorbestelling ("betaal nou, ontvang later"); `null` = normale, dadelik-beskikbare produk
- **Boek-etikette** (sterretjie-plakkers): 5 voorafingestelde tweetalige opsies (Nuut!/New!, Topverkoper/Bestseller, ens.) + pasgemaak, 4 kleure (amber/koraal/teal/swart)
- Omslag-beeld-oplaai: `laai-omslag-op.js`/`kry-omslag.js`, aparte "omslae"-Blobs-store
- **ISBN** (Aug 2026): twee opsionele velde op elke produk, `isbn.eboek` en
  `isbn.harde_kopie`. 'n Gedrukte en 'n elektroniese uitgawe het elk sy eie
  nommer; leen deel die e-boek s'n. Op die produkbladsy verskyn die blok
  glad nie sonder 'n nommer nie, en by net één nommer val die
  formaat-etiket weg. Future Shop reik nie ISBN's uit nie — dit word net
  vertoon. **Let wel:** `wysig-produk.js` gebruik `...wysigings`, dus is
  `kry_geldige_isbn()` uitdruklik bygevoeg — 'n nuwe top-vlak veld gaan
  andersins ongevalideer deur.

### Verdeling-argitektuur (5 registers, uitgebrei van oorspronklike enkele-outeur-model)

Elke `formaat`-blok (`eboek`/`harde_kopie`) dra 'n `verdelings`-lys (nie
meer net een `verdeling` nie) — elke ry: `{ rol_tipe, entiteit_id, tipe,
waarde }`. `rol_tipe` is een van: `outeur`, `vennoot`, `ontwerp_admin`,
`printing`, `aflewering`. Plus 'n aparte `hosting`-veld (dokumentasie-
doeleindes — bedrag bly by die hoofrekening).

**5 registers**, elk met volledige CRUD (`kry-*`/`skep-*`/`wysig-*`/
`skrap-*`), presies dieselfde patroon: Outeurs, Vennote, Ontwerp/Admin,
Printing, Aflewering. Elke register-rekord:

```json
{
  "outeur_id": "johan-smith",
  "naam": "Johan Smith",
  "subrekening_kode": "ACCT_xxxxx",
  "status": "aktief",
  "kontak_inligting": {
    "epos": "...", "selfoon": "...", "id_nommer": "...",
    "bank_naam": "...", "bank_rekeningnommer": "...", "bank_tak_kode": "..."
  },
  "geskep_op": "...", "geskep_deur": "..."
}
```

`subrekening_kode` is **opsioneel** — 'n nuwe persoon wat via 'n
uitnodigings-skakel self aansluit, het nog geen Paystack-subrekening nie;
status word outomaties `"wag_vir_subrekening"` totdat personeel dit self
by Paystack opstel en later invoer (via "Wysig"). `kontak_inligting` is 'n
wit-lys-gesaniteerde objek (nie elke veld geld vir elke rol nie).

**Business-reël:** Future Sharp se hoofrekening moet altyd genoeg behou om
Paystack se transaksiekoste te dek, plus Hosting% — afgedwing in
`skep-produk.js`/`wysig-produk.js` by stoor-tyd, en as vangnet-klamp in
`begin-betaling.js`.

Die reël was aanvanklik 'n plat **3%**. Dit is verkeerd, en dit is in Aug
2026 by 'n R50-leen ontdek toe Paystack die transaksie geweier het met
*"Merchant share cannot be lower than zero"*. Paystack SA hef **2,9% + R1,
plus BTW** — dus `3,335% × bedrag + R1,15`. Die vaste deel is die probleem:
op R500 is 3% ruim, op R50 is 3% net R1,50 teenoor 'n werklike koste van
R2,82.

Die formule leef nou op één plek — **`_paystack-koste.js`** — en al drie
bogenoemde Functions gebruik dit. Die minimum is `3,5% + R1,30`, altyd net
bo die werklike fooi:

| Prys | Werklike fooi | Minimum behou |
|---|---|---|
| R50 | R2,82 | R3,06 (6,1%) |
| R100 | R4,49 | R4,81 (4,8%) |
| R250 | R9,49 | R10,06 (4,0%) |
| R500 | R17,83 | R18,81 (3,8%) |

**Gevolg vir prysstelling:** 'n 90%-outeursdeel is by lae pryse wiskundig
onmoontlik. 'n Boek teen R250+ dra dit gemaklik; 'n boek teen R50 nie.

**Paystack Transaction Splits** word dinamies per bestelling geskep
("op die vlug") in `begin-betaling.js` — nooit die kliënt se prys/
verdeling vertrou nie, altyd van die katalogus-store herbou.

---

## Uitnodigings-stelsel (nuut — self-diens aansluiting)

Personeel genereer 'n **rol-gebonde, eenmalige skakel** (token) in die
paneelbord se "Uitnodigings"-oortjie. Die persoon (nuwe outeur/vennoot/
ens.) maak dit **sonder enige aanmelding** oop op `uitnodiging.html`,
voltooi 'n rol-spesifieke vorm (kontak + bank), en dien in — dit skep
outomaties 'n register-inskrywing (met `status: "wag_vir_subrekening"`).

- `skep-uitnodiging.js` (personeel-beskermd) — genereer token, stoor in "uitnodigings"-store
- `kry-uitnodiging.js` (publiek) — token → rol_tipe + status, vir die vorm om te weet watter velde te wys
- `voltooi-uitnodiging.js` (publiek) — skep die register-inskrywing, merk token `"voltooi"` (nooit weer herbruikbaar nie)
- `kry-alle-uitnodigings.js` (personeel-beskermd) — rekord-lys (hangend/voltooi) vir die paneelbord

**Bewustelike skopus-beperking:** hierdie stelsel versamel net
**inligting**. Dit ken nooit outeurs aan boeke toe nie, en daar's nog
**geen formele ooreenkoms-/tekenstap** voor die bankbesonderhede ingevoer
word nie — dis 'n oop item (sien "Oop items" onder), belangrik vir POPIA-
nakoming aangesien persoonlike inligting van derdepartye reeds ingesamel
word.

`uitnodiging.html` het sy eie, groter/grafies-ryker stylblok (los van
`styl.css`) — groter teks, ikone per veld, ontwerp vir minder
tegnologies-gemaklike gebruikers.

---

## Betaalvloei (Paystack)

1. `begin-betaling.js` — herbou mandjie-pryse/verdelings vanuit die
   katalogus-store (nooit die kliënt vertrou nie), skep 'n konsep-
   bestelling in Blobs (status "Wag vir betaling"), skep dinamies 'n
   Transaction Split indien nodig, roep Paystack se Initialize
   Transaction aan
2. `paystack-webhook.js` — **gesaghebbende** bevestiging; Paystack roep
   dit direk aan, verifieer handtekening + bedrag, werk status na "Nuut"
   op
3. `dankie.html` — vriendelike terugkeerbladsy, NIE gesaghebbend nie, wys
   e-boek vs. harde-kopie-boodskap, ruim mandjie op
4. `mandjie-opruiming.js` (Aug 2026) — padonafhanklike opruiming. Die
   mandjie is voorheen NET op `dankie.html` leeggemaak; 'n koper wat die
   venster toemaak of wegnavigeer voor daardie bladsy laai, sit met 'n
   item wat hy reeds besit — en kan dit 'n tweede keer betaal. Hierdie
   lêer (op `mandjie.html`, `my-boeke.html`, `voltooi-betaling.html`)
   vergelyk die mandjie met wat die koper werklik besit.
   **Die reëls is doelbewus eng:** 'n e-boek word slegs verwyder as die
   koper 'n PERMANENTE kopie het — nie by 'n aktiewe leen nie, want die
   leen-na-koop-opgradering sit juis 'n e-boek in die mandjie terwyl die
   leen loop. Harde kopieë word nooit verwyder nie ('n tweede eksemplaar
   as geskenk is wettig).

⚠️ Onthou: Paystack Live Webhook URL was op 'n stadium leeg (verklaar
waarom aankope nie in "My Boeke" verskyn het nie) — reeds reggestel,
maar 'n goeie ding om na 'n Paystack-herkonfigurasie altyd te verifieer.

**Voorbestellings:** `vrystelling_datum` bepaal of 'n item 'n
voorbestelling is; koper betaal nou, ontvang later. Ontsluiting/POD-
drukwerk-plasing gebeur **per item**, nie per hele bestelling nie.

---

## "My Boeke" en die e-boek-leser

- Aankope vereis 'n aangemelde koper-rekening — Identity-ID gekoppel aan
  bestelling, nie net 'n e-posadres nie
- `kry-my-boeke.js` (koper-beskermd) — lys gekoopte boeke vir die
  aangemelde koper
- **Geen harde DRM nie** (te omslagtig vir 'n klein katalogus, frustreer
  eerlike kopers meer as dit skelms stop). In plaas daarvan: **sagte
  watermerking**
  — koper se e-pos + bestelnommer as **onsigbare PDF-metadata**
  (dokument-eienskappe), plus 'n koraal fynskrif-kennisgewing in die
  leser-koppelvlak self (nie 'n sigbare watermerk-bladsy nie)
- **Aanlyn-leser** (`leser.html`, PDF.js-gebaseer): canvas-weergawe,
  bladsy-navigasie, soek-in-boek, zoem, aflyn-lees via IndexedDB (silent
  cache ná eerste laai — geen data nodig vir herhaalde lees nie)
- "My Boeke"-bladsy: klikbare boek-omslag-rooster, amber "Alreeds
  joune"-lint op reeds-gekoopte boeke
- Tweetalige leser-koppelvlak (knoppies, foutboodskappe) via `taal.js` —
  raak **nooit** die boek se inhoud self aan nie

---

## PWA's (Progressive Web Apps) — twee aparte, installeerbare apps

**Koper-kant ("Future Shop"):**
- `manifest.json`, `sw.js` (minimale service worker, net vir
  installeerbaarheid — geen kasering/aflyn-logika, dis reeds deur
  IndexedDB in die leser gedek)
- Ikone: `ikoon-192.png`, `ikoon-512.png`, `ikoon-maskable-512.png`,
  `apple-touch-ikoon.png`
- `start_url`/`scope`: `/my-boeke.html` — maak direk oop na die koper se
  boeke, nie die tuisblad nie
- Koppel in `my-boeke.html` + `leser.html`
- **Eie installeer-balk** (`installeer-app.js`) bo-aan "My Boeke" —
  Android kry 'n regte "Installeer"-knoppie (via `beforeinstallprompt`);
  iOS kry 'n "Tik Deel → Voeg by Tuisskerm"-instruksie (Apple laat geen
  programmatiese installasie toe nie). Verdwyn outomaties as reeds
  geïnstalleer, of vir 14 dae ná toemaak

**Personeel-kant ("Future Shop Paneelbord")** — heeltemal aparte PWA:
- `paneel-manifest.json`, `paneel-sw.js` — eie, **noue** omvang
  (`/paneelbord.html`) sodat dit nie met die koper-PWA se breër omvang
  bots nie
- Eie ikoon-stel (`paneel-ikoon-*.png`), swart tema-kleur (vs. koper se
  teal) om dit visueel te onderskei
- Eie installeer-balk (`paneelbord-installeer-app.js`), sigbaar **net**
  op `paneelbord.html`

---

## Personeel-paneelbord (`paneelbord.html`)

Sy-kieslys-navigasie (`paneel-kieslys.js`), sticky op rekenaar, hamburger-
laai op foon (≤640px). Oortjies: Katalogus (verstek), Outeurs, Vennote,
Ontwerp/Admin, Printing, Aflewering, Koepons, **Uitnodigings** (nuut).

`paneel-registers.js` — generiese CRUD-patroon vir al 5 registers via 'n
`PANEEL_REGISTERS`-konfigurasie-lys (nie 5x herhaalde kode nie, wel 5x
identiese `skep-*.js`/`wysig-*.js`-Functions agter die skerms — sien
"Kode-opruiming" onder). Skrap-vloei waarsku (nie blokkeer nie) as 'n
inskrywing reeds op 'n boek se verdeling gebruik word.

**Katalogus-soek en -sortering** (`paneel-katalogus-soek.js`, Aug 2026).
Een soekveld oor titel, outeur én slug tegelyk — nie 'n aparte
outeur-soek nie, want dan moet mens eers besluit waarna jy soek. Slug is
ingesluit omdat dit die veld is wat in Blobs-sleutels en opdragte verskyn.
Ses sorteeropsies, waarvan "Onaktiewe eerste" die nuttigste word soos die
katalogus groei. Die lêer **omhul** `wys_produkte_lys()` eerder as om
`paneelbord.js` te wysig.

**Verdeling-rekenaar** — sien die eie afdeling onder.

**Dokumente** — oplaai, lys, skrap, en deel via e-pos/WhatsApp. Die
deelskakel (`kry-dokument.js`) is **doelbewus publiek**: enigeen met die
URL kan aflaai. Dis wat dit bruikbaar maak vir 'n outeur, en dis ook
waarom getekende dokumente met persoonlike besonderhede nie daar hoort
nie.

**Waarskuwings** — betaling-waarskuwings, plus (Aug 2026) 'n
toetsknoppie vir die e-posdiens (`paneel-epos-toets.js`). Misluk die
toets, wys dit watter `EPOS_`-instellings die bediener gevind het —
sonder die wagwoord — sodat 'n ontbrekende veranderlike dadelik sigbaar
is.

---

## Verdeling-rekenaar (paneelbord, personeel-alleen)

Suiwer front-end (`verdeling-rekenaar.js`) — raak geen store of Function
nie. In Augustus 2026 heeltemal herbou:

**Al drie formate gelyk.** 'n Boek is nie een prys nie. Die rekenaar het
voorheen een formaat op 'n slag hanteer, wat beteken het mens moes hom
drie keer loop en die getalle onthou terwyl die produkvorm ingevul word.

**Twee invoerrigtings.** Die enigste verskil tussen hulle is één reël:
`P = modus === "wins" ? (begin + K) / (outeurPct/100) : begin`. Die
prys-rigting is die praktiese een — 'n winkel prys op R150, nie op
R142,86 nie — en dis ook die enigste rigting wat kan wys dat 'n prys
**nie werk nie**.

**Drie aansigte van dieselfde som:**
- *Opstel* — presies wat in die katalogusvorm ingetik word, met 'n
  kontrole wat sê of die vorm dit gaan aanvaar. Dit vang die "Merchant
  share cannot be lower than zero"-fout vóór die vorm oopgemaak word.
- *Uiteensetting* — elke rolspeler se randbedrag, plus 'n staafstrook wat
  wys wat prys aan die direkteursfooie doen. Die kromme kom heeltemal van
  Paystack se vaste fooi.
- *Outeursaansig* — 'n **volskerm-oorlegsel**, nie 'n oortjie nie. 'n
  Oortjie sou die Aannames sigbaar laat, en dié is boonop invoervelde wat
  'n besoeker kan verander. Die oorlegsel bevat geen interne syfer en geen
  invoerveld nie.

**Meer as een outeur.** Een ry per outeur, met outomatiese verspreiding
(die oorskiet van 'n onewe deling gaan na die eerste ry) en 'n
som-kontrole. Die persentasies is van die **verkoopprys**, nie van die
70% nie — so vra die katalogusvorm dit. Die outeursaansig verander nié by
meer as een outeur nie: mense wat saam geskryf het, weet reeds dat hulle
die 70% deel.

**Admin en Ontwerp** bly apart in die rekenaar (twee soorte werk, twee
koste) maar word in Opstel saamgetel tot één Ontwerp/Admin-ry, want die
produkvorm het één rol. Daardie vertaalwerk is presies waarvoor die
rekenaar bestaan.

Die outeurspersentasie is wysigbaar, maar leef in die **ankerbalk** en
nie tussen die Aannames nie: 70/30 staan vas vir nuwe outeurs, en die
veld is daar vir bestaande boeke op ander voorwaardes.

---

## E-posdiens (Aug 2026)

`_stuur-epos.js` — gedeelde helper, `nodemailer` via Future Shop se eie
posbus by Afrihost. Omgewingsveranderlikes: `EPOS_GASHEER`, `EPOS_POORT`,
`EPOS_GEBRUIKER`, `EPOS_WAGWOORD`, `EPOS_VAN`.

**Waarom die eie posbus en nie 'n transaksionele diens nie:** die pos kom
van dieselfde bediener wat die domein se bestaande SPF-rekord reeds dek —
geen DNS-verandering, en geen risiko om 'n tweede SPF-rekord by te voeg
wat albei sou breek. Wil ons later na Postmark of Resend skuif vir
aflewerinsverslae, verander net hierdie lêer plus 'n `include` in die
SPF-reël.

**`stuur_epos()` gooi nooit nie.** Dit gee `{ ok, fout }` terug. 'n Pos
wat nie deurkom nie mag nooit 'n betaling, 'n bestelling of 'n
stoor-aksie laat misluk nie.

**Die sjabloon is 'n tabel van 600px.** Outlook ignoreer `max-width` en
`border-radius` op 'n gewone blok — 'n boodskap wat mooi lyk in Gmail strek
dan oor die hele venster en verloor sy rand. Alle style inlyn;
`<style>`-blokke word gestroop.

**Die kop dra die wordmerk oor die volle breedte** (598px, uit
`public/images/future-shop-woordmerk.png`), met die teal teksband
daaronder. Die logo se `alt` is doelbewus **leeg**: poskliënte blokkeer
prente by verstek — Outlook doen dit vir elke nuwe stuurder — en die band
sê reeds in teks wie praat. Val die prent weg, lyk die boodskap presies
soos die ou ontwerp sonder dat iets breek. Bevestig in Outlook op
3 Aug 2026, met prente aan én af. Die logo word van die werf af gelaai,
nie aangeheg nie; 'n aanhegsel of base64-beeld word deur meer kliënte
geweier as 'n gewone URL.

`toets-epos.js` is 'n personeel-beskermde toetsroete — 'n betaling se
webhook is die verkeerde plek om 'n SMTP-verbinding vir die eerste keer
te toets. Bevestig werkend op 2 Aug 2026.

**Gekoppel:** outeur-kennisgewing by 'n e-boek- of leenverkoop
(`_kennisgewing-outeur.js`, sien hieronder).
**Nog nie:** die harde-kopie-pos (geblokkeer — sien oop items),
leen-vervalpos, en dokumente wat vanaf die adres uitgaan.

---

## Outeur-kennisgewing by 'n verkoop (Aug 2026)

`_kennisgewing-outeur.js` — aangeroep heel laaste in
`paystack-webhook.js`, ná die tellers, in 'n `try/catch`. Die betaling is
teen daardie punt reeds bevestig en gestoor; 'n pos wat nie deurkom nie
mag dit nooit ongedaan maak nie.

**Een pos per outeur, nie per item nie.** 'n Bestelling kan boeke van
verskeie outeurs bevat, en 'n boek kan meer as een outeur hê. Daar word
eers per outeur gegroepeer — twee poste vir dieselfde bestelling lees soos
'n fout.

**Wie hoor van 'n item:** dieselfde twee bronne as `kry-verslag.js` — die
outeurs op `produk.outeur_ids`, plus enigeen met `rol_tipe: "outeur"` in
daardie formaat se verdeling. 'n Outeur kan gekrediteer wees sonder 'n
verdeling, en andersom.

**Drie getalle**, soos vasgestel: prys, sy deel, Future Sharp se deel.
Die berekening is dieselfde as `begin-betaling.js`, insluitend die vangnet
vir die ou `{ outeur_id }`-skema. Is daar **geen** verdeling vir daardie
outeur op daardie formaat nie, wys die pos net die prys en laat die
uitbetalingsreël weg — "Jou deel R0,00" is verkeerd sowel as
onrusbarend, en beteken in werklikheid dat die verdeling nog nie opgestel
is nie.

Die knoppie gaan na die outeur se bestaande selfdiens-staat, opgesoek in
`verslag-skakels-indeks` onder `outeur:<id>`. Daar word **nooit** hier een
geskep nie; bestaan daar nie een nie, val die knoppie weg eerder as om 'n
dooie skakel te stuur.

**Voorkeure bestaan nog nie.** `wil_hoor_van_verkope()` lees
`outeur.kennisgewings.by_verkoop` en behandel afwesig as "ja", sodat die
voorkeurlaag later inskuif sonder om iets te herskryf.

`toets-outeur-kennisgewing.js` — personeel-beskermd, laat die
kennisgewing vir 'n **bestaande** bestelnommer weer loop. Drie vorms:
`{ bestelnommer, droog: true }` bereken alles en stuur niks;
`{ bestelnommer, aan: "..." }` stuur werklik maar alles na een adres;
`{ bestelnommer }` stuur aan die outeurs self. **Nog nie uitgevoer nie.**

---

## Dokumentasie vir outeurs (Aug 2026)

Drie dokumente, in die volgorde waarin hulle gebruik word. Almal met die
logo net op bladsy een, die bladsynommer bo in die middel, en
Montserrat/Poppins soos die winkel.

1. **`1-Future-Shop.docx`** — bekendstelling én hoe die winkel werk. Vier
   afdelings: Formate, Verantwoordelikhede, Prys en inkomste, Om voort te
   gaan.
2. **`2-Outeursooreenkoms.docx`** — 14 klousules plus 'n bylae vir
   bankbesonderhede. Geld per outeur, nie per titel nie.
3. **`3-Boekvorm.docx`** — per titel, herhaalbaar. Die manuskrip en die
   omslag kom per e-pos; die vorm dra hulle nie.

**Register:** derde persoon, volsinne, "die outeur" en "Future Sharp" —
dieselfde woorde as die ooreenkoms, sodat die dokumente met mekaar praat.
Die boekvorm is die uitsondering: daar is elke instruksie direk (*Dui
aan…*, *Voltooi slegs waar…*).

**Wat uitgehaal is, en hoekom.** Vroeë weergawes het argumente gevoer wat
niemand gevra het nie ("baie lae pryse werk swakker as wat mens dink"),
en het interne argitektuur bevat wat 'n outeur nie nodig het nie — hoe die
verdeling meganies werk, Paystack se naam, en die subrekening-struktuur.
Wat 'n outeur moet weet, is **wanneer** hy sy geld kry, nie hoe die geld
beweeg nie. Paystack se eie pryslys sê twee werksdae; die dokument sê
"gewoonlik binne twee werksdae", sonder om die diens te noem.

Daar is ook nie 'n aparte registrasiedokument nie. Wat 'n handtekening
verg, sit in die ooreenkoms; wat per titel verander, in die boekvorm; en
wat 'n outeur self moet kan verander — sy kontakbesonderhede en
kennisgewingvoorkeure — hoort in die komende outeurspaneelbord. Die ou
registrasievorm was 'n versameling van al drie soorte, en dis presies
waarom dit oorvleuel het.

**Die ooreenkoms het geen Bylae A vir titels nie.** Dit is geteken
vóórdat daar 'n boek is; 'n tabel wat na niks verwys nie, span die kar
voor die perde in. Klousule 5 sê in plaas daarvan dat prys en verdeling
skriftelik bevestig word voordat 'n titel te koop aangebied word.

**Nog nie afgehandel nie:** `[REGISTRASIENOMMER]`, `[ADRES]` en
`[OPSEGTYDPERK]` in die ooreenkoms, en 'n deurgang deur iemand met
regskennis.

---

## Werkvloei (hoe veranderinge ontplooi word)

Geen `netlify deploy --prod` nie — GitHub-CD doen dit outomaties:

1. Claude bou/wysig lêers, gee dit as aflaaibare lêers
2. Dorrithé: `Copy-Item` (PowerShell) na die korrekte gids
   (`public/`, `public/js/`, `public/css/`, `public/icons/`,
   `netlify/functions/`)
3. `git status` → bevestig al die verwagte lêers wys
4. `git add .` → `git commit -m "..."` → `git push`
5. Netlify ontplooi outomaties binne 'n minuut of twee

**Elke PowerShell-opdrag apart** (kombinasie op een reël het herhaaldelik
foute veroorsaak). **Verifieer altyd voor commit** — lêers het al
suksesvol plaaslik gekopieer maar nie in die repo weerspieël nie; gebruik
`git show HEAD:<pad> | Select-String "<patroon>"` om te bevestig.

**Bekende hik:** OneDrive vergrendel soms 'n lêer wat Git se agtergrond
`git gc`-opruiming probeer skoonmaak, wat 'n lusagtige "Deletion of
directory"-prompt veroorsaak. Fix: `Ctrl+C`, dan gewone `git push` weer
(die werklike stoot na GitHub het byna altyd reeds voor die gc-lus
geslaag).

---

## Oop items (nie afgehandel nie)

**Nuwe bou-werk:**

1. **Outeurspaneelbord** — die grootste oorblywende stuk, en die een wat
   die res sinvol maak. 'n Outeur meld aan en sien sy eie boeke, sy
   besigtigings en verkope, sy uitstaande harde-kopie-bestellings, en 'n
   knoppie om 'n nuwe boek in te dien. Dan hoef niemand 'n skakel te
   genereer nie, en die boekvorm word elektronies.

   Sy kontakbesonderhede en kennisgewingvoorkeure hoort hier, want hy moet
   hulle self kan verander. Wat hy **nie** sien nie: koperdata (buiten die
   afleweringsbesonderhede by 'n harde kopie wat hy moet stuur), en die
   30% se uitsplitsing.

   Baie van die infrastruktuur bestaan: Identity-rekeninge word reeds
   outomaties vir outeurs geskep, `_rol-kontrole.js` aanvaar 'n lys rolle,
   en die verslagfunksie werk. Wat gebou moet word: `outeur.html`, 'n
   Function wat sy eie boeke en syfers gee, 'n indienvorm, en die
   kennisgewing aan admin.

2. **Kennisgewings koppel aan die e-posdiens** — die verkoop-pos werk;
   die res nie.
   - *Outeur by 'n e-boek- of leenverkoop.* **Klaar** (3 Aug 2026) — sien
     die afdeling hierbo. Nog nie teen 'n regte verkoop getoets nie.
   - *Harde-kopie-bestelling.* **Geblokkeer.** Nie 'n voorkeur nie, 'n
     verpligting: die outeur druk en versend self, en die pos is hoe hy
     weet 'n bestelling wag. Maar `voltooi-betaling.js` vra e-pos,
     selfoon, straat, stad, provinsie en poskode — en **nooit 'n
     ontvangernaam nie**. 'n Outeur kan nie 'n pakkie pos aan 'n adres
     sonder 'n naam nie. Die betaalvorm moet eers 'n naamveld kry; dan
     kom `"harde_kopie"` by `FORMATE_WAT_POS_KRY` in
     `_kennisgewing-outeur.js`.
   - *Leen verval binnekort.* Vereis 'n geskeduleerde Function.
   - *Staat van verkope en besigtigings*, weekliks of maandeliks volgens
     die outeur se voorkeur.
   - *Gratis bestellings stuur niks.* Die 100%-koepon-kortpad in
     `begin-betaling.js` merk die bestelling self as betaal en die webhook
     vuur nooit — dus ook nie die kennisgewing nie. Dieselfde aanroep sou
     daar moes bykom.

3. **Voorkeurvelde op die outeursrekord** — die kennisgewingkeuses moet
   iewers gestoor word. 'n Aparte veld op die outeursrekord, nie by
   `kontak_inligting` nie (dis 'n instelling, nie kontakinligting nie).
   Die wit-lys in `skep-outeur.js` gooi enigiets buite die lys stilweg weg.

4. **Ooreenkoms afhandel** — `[REGISTRASIENOMMER]`, `[ADRES]`,
   `[OPSEGTYDPERK]`, en 'n regsdeurgang.

5. **Identity se e-pos — besluit: laat staan.** Die herstelpos kom van
   `no-reply@netlify.com` af met die onderwerp *"Reset your password for
   futuresharp-shop.netlify.app"*. Nagegaan op 3 Aug 2026: die span se
   plan is `nf_team_dev`, en Netlify se dokumentasie stel dit duidelik —
   eie sjablone **en** 'n eie stuuradres vereis albei Pro of hoër. Daar is
   dus geen instelling om te verander nie.

   Die **skakel self gaan wél na `futureshop.futuresharp.co.za`**, en
   `index.html` stuur 'n token in die adres dadelik na `bevestig.html`
   deur. Funksioneel is die ketting heel; net die onderwerp en die
   stuuradres bly Netlify s'n.

   'n Eie herstelvloei is moontlik binne die gratis vlak — eie vorm,
   kode in Blobs met 'n verval, pos deur `_stuur-epos.js`, eie bladsy —
   maar die laaste stap vereis 'n GoTrue-adminsleutel wat die projek nie
   het nie (`voltooi-uitnodiging.js` skep rekeninge deur die publieke
   `/signup`-eindpunt juis daarom). So 'n sleutel kan gewoonlik veel meer
   as net wagwoorde stel. **Heroorweeg wanneer die outeurspaneelbord kom**
   — 'n Engelse pos van `no-reply@netlify.com` af is 'n ander soort
   probleem vir 'n vreemde professionele outeur as vir 'n koper.

6. **Winkel: soek en outeur-filter.** Sortering is gedoen; soek nie.
   'n Klikbare outeursnaam vereis `outeur_ids` op elke produk, en ou
   produkte van vóór daardie skuif het dit nie almal nie — dit moet eers
   nagegaan word.

7. **"My Leeskamer"** — hernoem van die koper se area, met "My Boeke"
   daarbinne. Naam nog nie finaal nie.

8. **Ontvangernaam op die betaalvorm.** Sien punt 2 — dit blokkeer die
   harde-kopie-kennisgewing, en dit is in elk geval nodig om 'n pakkie te
   kan pos.

9. **`.terug-skakel` op 'n `<button>`** wys die blaaier se verstek-
   knoppiechroom, want die klas stel nie `background`/`border` nie. Sigbaar
   op aanmeld ("Terug na aanmeld", "Registreer hier"). Dieselfde klas word
   op agt plekke op die paneelbord gebruik ("Genereer", "Kopieer",
   "+ Voeg verdeling by"), dus verander 'n regstelling al agt saam — dit
   verdien 'n voorskou.

10. **Bedienerfoute wys in Engels.** `aanmeld.js` gee 'n mislukte versoek
    se eie woorde deur sonder om deur `taal.js` te gaan; 'n koper op AF
    sien bv. *"Rate limit exceeded, try again later"*.

**Huishouding:**

11. Kode-opruiming. Die ou Verdeling-rekenaar se CSS (`vr-formaat-kieser`,
   `vr-scenario-*`, `vr-prys-blok`, `vr-ry*`, `vr-kolletjie*`) is nie meer
   in gebruik nie.
12. Data-kennisgewing op die uitnodiging-vorm + tempo-beperking op
    `voltooi-uitnodiging.js` (POPIA-oorweging)
13. Periodieke Blobs-JSON-rugsteun-uittreksel
14. Die twee PWA's is vanaf `netlify.app` geïnstalleer. 'n PWA is aan sy
    oorsprong gebind, dus leef daardie installasies nog op die ou domein
    met hul eie sessies. Hulle moet afgeskaf en herinstalleer word — beter
    voor bekendstelling as daarna.
15. **Die repo is publiek.** Geen sleutel is blootgestel nie (alles leef in
    omgewingsveranderlikes), maar die volledige winkellogika, insluitend
    die verdeling-argitektuur en die rolkontroles, is leesbaar vir enigeen.
    Die moeite werd om een keer bewustelik te bevestig.

**Verifikasie/toetse:**

16. Responsiewe ontwerp-deurgang — foon/tablet/rekenaar
17. End-tot-end koop-tot-leser-toets in 'n privaat venster

---

## Klein dinge wat in Aug 2026 bygekom het

- **`sessie-verval.js`** — die "sessie verval"-toestand op één plek, vir
  My Boeke en die leser. 'n Boodskap sonder 'n knoppie het die koper op 'n
  doodloopstraat gelaat. Die helper **vee die sessie eers uit**: 'n 401
  beteken die bediener het die token verwerp, maar plaaslik lyk dit nog
  geldig (`identiteit_kry_huidige_sessie()` oordeel net aan die klok), en
  `aanmeld.js` se "reeds aangemeld"-kontrole het die koper dan onmiddellik
  teruggestuur na die bladsy wat pas die 401 gekry het — 'n kringloop. Dit
  gebruik `identiteit_verwyder_sessie()` en **nie** `identiteit_meld_af()`
  nie: afmeld maak ook die mandjie leeg, en 'n verwerpte token is geen
  rede om iemand se mandjie weg te gooi nie. Die leser gee geen terug-pad
  deur nie, sodat `?boek=` behoue bly.
- **`stoor-lees-vordering.js` het lene stil laat val.** Die
  eienaarskapskontrole het net `formaat === "eboek"` aanvaar, so elke
  lener het 'n 403 gekry en sy leesposisie by elke besoek verloor — al kon
  hy die boek lees, want `kry-leser-token.js` en `kry-eboek-inhoud.js`
  hanteer 'n leen wél. Nou dieselfde verval-toets as daardie twee.
- **Boodskapboks op aanmeld en bevestig.** Die boks het permanent
  `.vb-foute` gedra, sodat 'n suksesboodskap in 'n rooi foutboks beland
  het en 'n leë boks 'n rooi strook op 'n skoon bladsy gelaat het.
  `aanmeld.js` en `bevestig.js` skakel reeds `.boodskap-sukses` en
  `.boodskap-fout` — net die CSS het ontbreek. Nuwe klas
  `.aanmeld-boodskap` met drie state plus `:empty { display: none }`;
  geen JS-verandering. `.vb-foute` self bly onaangeraak, want dit is 'n
  werklike foutboks op die paneelbord, uitnodiging en voltooi-betaling.
- **"epos" → "e-pos"** in vier Afrikaanse taalsleutels.
- **`wagwoord_wys` / `wagwoord_versteek`** het in `taal.js` ontbreek —
  `wagwoord-ogie.js` het na hulle gevra en op sy eie terugval gestaan. Dit
  is aria-etikette, nie skermteks nie.
- **`mobile-web-app-capable`** bygevoeg op `my-boeke.html`,
  `leser.html` en `paneelbord.html`. Die `apple-`-weergawe bly vir ouer
  iOS; Chrome vra uitdruklik dat die standaard-etiket daarby kom.
- **`wagwoord-ogie.js`** — wys/versteek-knoppie op **elke** wagwoordveld.
  Dit spoor velde self op (met 'n `MutationObserver` vir vorms wat later
  sigbaar word), sodat 'n nuwe bladsy dit vanself kry. *Het 'n dooie lêer
  met dieselfde naam vervang:* die ou weergawe is vir Netlify se
  Identity-widget geskryf en het net Shadow DOM hanteer.
- **`mandjie-opruiming.js`** — verwyder items uit die mandjie wat die koper
  reeds besit. 'n E-boek word net by 'n permanente kopie verwyder, nie by
  'n aktiewe leen nie (die opgraderingsvloei hang daarvan af), en harde
  kopieë nooit.
- **`_paystack-koste.js`** — die plat 3%-reël was verkeerd en het 'n
  R50-leen laat faal met "Merchant share cannot be lower than zero".
  Paystack SA is 2,9% + R1, plus BTW = 3,335% + R1,15; die minimum is nou
  3,5% + R1,30.
- **Winkelkatalogus-sortering** (`katalogus-sorteer.js`) — vyf opsies langs
  die kategorie-skyfies, verstek nuutste eerste, keuse behou in
  `localStorage`. Die verstek is één konstante (`KS_VERSTEK`), en die
  lêer se kopnota verduidelik hoe 'n eie volgorde of 'n
  bestsellersortering later inskuif. Die navorsing sê 'n saamgestelde
  volgorde is die beter verstek — maar met 'n handjievol boeke is dit
  ruis, nie inligting nie.
- **Vennoot-etiket** — die UI sê "Vennoot (direkteur)". Slegs vertoonteks;
  `rol_tipe: "vennoot"` bly onveranderd, sodat die rol beskikbaar bly vir
  'n toekomstige mede-uitgewer of befondser. 'n Volledige hernoeming sou
  'n skema-migrasie verg.
- **Die statistiek-"anomalie" van 1 Augustus was geen anomalie nie.** Die
  teller tel winkelbesoeke, en daar was daardie dag eenvoudig geen — die
  werk was in die paneelbord.
