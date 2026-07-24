# Future Shop — Fase 1: Fondament

Hierdie fase lê die datastrukture en rolstruktuur vas voordat enige UI gebou word.

## BELANGRIK: katalogus-argitektuur (bygewerk)

Die katalogus leef **NIE meer as statiese JSON-lêers in Git nie**. Nuwe boeke word
deur personeel via 'n vorm op die interne paneelbord bygevoeg (Fase 4) — 'n Function
skryf die rekord na **Netlify Blobs**, en dit verskyn onmiddellik, sonder herontplooi.

Die `data/katalogus/*.json`-lêers hieronder is dus nou **net skema-verwysing** —
hulle wys watter velde 'n produk-rekord het, en watter velde die "Voeg produk
by"-vorm moet insamel. Hulle word nêrens meer deur die kode self gelees nie.

Sien "Hoe voeg ek 'n nuwe boek by?" onderaan vir die volle vloei.

## Lêers in hierdie fase

| Lêer | Doel |
|---|---|
| `data/katalogus/voorbeeld-produk.json` | Katalogus-skema (verwysing) — produk met beide formate beskikbaar |
| `data/katalogus/voorbeeld-produk-slegs-eboek.json` | Wys die "afwesig, nie uitgevaag nie"-patroon vir harde kopie |
| `data/bestelling-skema-voorbeeld.json` | Netlify Blobs-rekordskema, sleutel = bestelnommer |
| `netlify.toml` | Publish/functions-pad; Identity-instellings self via kontrolepaneel |
| `netlify/functions/identity-registrasie.js` | Ken outomaties "koper"-rol toe by registrasie |
| `netlify/functions/_rol-kontrole.js` | Gedeelde bediener-kant rol-verifikasie vir alle beskermde Functions |
| `netlify/functions/kry-katalogus.js` | **Publiek** — lys alle aktiewe produkte uit Blobs vir die katalogus-bladsy |
| `netlify/functions/skep-produk.js` | **Personeel-beskermd** — skep 'n nuwe produk in Blobs |
| `netlify/functions/wysig-produk.js` | **Personeel-beskermd** — wysig/deaktiveer 'n bestaande produk |

## Sleutelbesluite in hierdie skema

**Pryse in sent, nie rand nie** (`prys_sent`) — vermy tallose-punt-afronding-foute wat algemeen is met geld in JavaScript. Wys as R450.00 in die UI deur te deel deur 100.

**Harde kopie se afwesigheid = geen veld se `beskikbaar: false`, knoppie verskyn eenvoudig nie** — soos in die plan gespesifiseer. Sien `voorbeeld-produk-slegs-eboek.json`.

**`eboek_konfig_pad`** wys na 'n aparte lêer in `config/boek-dele/` — hou die katalogus-rekord klein en skei "wat is hierdie produk" van "hoe is hierdie produk se leesbare inhoud gestruktureer" (hoofstukke vs. een PDF vs. genommerde dele). Dit kom in Fase 5 (leser) aan die beurt.

**`reeks`-veld is nou reeds in die skema**, alhoewel nie een van die twee voorbeelde dit gebruik nie — dit laat toe dat produkte later as deel van 'n reeks gegroepeer word (bv. "Deel 1 van 3") sonder skema-verandering.

**Bestelling-rekord se `aflewering`-blok** is nou net 'n eenvoudige woonadres (straat/stad/provinsie/poskode) — geen PostNet-tipe-onderskeid meer nie, aangesien 'n print-on-demand-verskaffer self koerierswerk hanteer.

**`status_geskiedenis`** is 'n log (nie net huidige status nie) — laat die interne paneelbord later 'n volle tydlyn per bestelling wys indien nodig, sonder om die skema weer te verander.

**Rolkontrole (`_rol-kontrole.js`)** word deur elke beskermde Function ingevoer en aan die begin van die handler aangeroep — dit beteken die logika word net een plek onderhou, en elke Function wat dit vergeet sal opvallend maak wanneer dit gebruik word (Function moet self 401/403 stuur as `null` terugkom).

## Oop vrae vir jou om te bevestig voor Fase 2

1. **Munt/valuta** — ek het aanvaar Suid-Afrikaanse rand (ZAR), pryse in sent gestoor. Reg?
2. **Bestelnommer-formaat** — ek het `FS-2026-000123` (voorvoegsel + jaar + volgnommer) as voorbeeld gebruik. Enige voorkeur, of moet dit ewekansig/UUID-gebaseerd wees?
3. **Omslag-beelde** — waar word dié gestoor? (Netlify se `public/images/`, of 'n eksterne CDN/Cloudinary-tipe diens?)

## Aflewering — besluit (nie meer PostNet nie)

PostNet-aflewering is **heeltemal geskrap**, nie net uitgeskakel nie. Future Sharp gebruik in plaas daarvan 'n **print-on-demand (POD)-verskaffer** wat self die koerierswerk hanteer:

- Die voltooi-betaling-bladsy vra net 'n **woonadres** wanneer die mandjie 'n harde kopie bevat — geen tak-keuse meer nie.
- Sodra 'n bestelling se betaling bevestig is (via die Paystack-webhook), plaas **personeel self** die drukwerk-bestelling by die POD-verskaffer, en verskaf die koper se adres direk aan hulle.
- Die bestelling-rekord het nou 'n `drukker`-blok (`bestelling_geplaas`, `geplaas_op`, `nota`) sodat personeel via die toekomstige paneelbord kan bybly watter bestellings nog by die verskaffer geplaas moet word.

Sien `data/bestelling-skema-voorbeeld.json` vir die volle bygewerkte skema.

## Fase 3 — Paystack-betaling (nuut)

| Lêer | Doel |
|---|---|
| `netlify/functions/begin-betaling.js` | Stoor 'n konsep-bestelling in Blobs (status "Wag vir betaling"), roep Paystack se Initialize Transaction-eindpunt aan, gee `authorization_url` terug |
| `netlify/functions/paystack-webhook.js` | **Gesaghebbende** betaalverifikasie — Paystack roep dit direk aan wanneer 'n betaling slaag; verifieer handtekening, bevestig bedrag, werk die bestelling-rekord na status "Nuut" op |
| `public/dankie.html` | Vriendelike terugkeerbladsy ná Paystack — NIE die gesaghebbende bevestiging nie, net 'n boodskap; ruim ook die klant-kant mandjie op |
| `public/js/voltooi-betaling.js` (bygewerk) | "Gaan na betaling" roep nou `begin-betaling` aan en herlei na Paystack, i.p.v. net 'n JSON-voorskou te wys |

### Opstel wat jy (of ek namens jou) op Netlify moet doen voor dit werk

1. **Omgewingveranderlike:** stel `PAYSTACK_SECRET_KEY` in Netlify se werf-instellings (Site settings → Environment variables). Gebruik eers jou **toets-sleutel** (`sk_test_...`) totdat alles werk, dan skakel oor na die lewendige sleutel.
2. **Webhook-URL in Paystack:** in die Paystack-kontrolepaneel (Settings → API Keys & Webhooks), stel die webhook-URL na:
   `https://<jou-werf-naam>.netlify.app/.netlify/functions/paystack-webhook`
3. **Blobs-store "bestellings"** word outomaties deur die Functions geskep by die eerste skryf — geen handmatige opstel nodig nie.

### Belangrike ontwerpbesluit — waarom twee stappe (begin-betaling + webhook)?

Die bestelling word **twee keer** geskryf: eers as "Wag vir betaling" (voor Paystack), dan bygewerk na "Nuut" (deur die webhook, na bevestigde betaling). Dit beteken:
- Alle bestelling-besonderhede (adres, kontak) is reeds veilig op die bediener voordat die koper Paystack se bladsy sien — niks gaan verlore as hulle nie deur betaal nie
- Die webhook hoef net status + Paystack-besonderhede by te werk, nie die hele bestelling van voor af te herbou nie
- Bedrag word **twee keer** vergelyk (in die webhook) teen wat oorspronklik in voltooi-betaling bereken is — beskerm teen manipulasie

Sodra jy hierdie bevestig (of enige aanpassings gee), gaan ons aan na Fase 2: die katalogus-bladsy wat van Blobs (via `kry-katalogus.js`) lees en vertoon.

---

## Outeur-verdeling — Paystack-subrekeninge (Fase 3, uitgebrei)

Future Sharp bemark boeke namens outeurs wat 'n persentasie (of 'n vaste
bedrag) van hul boek se verkope moet ontvang. Dit word met Paystack se
**Subrekeninge** en **Transaction Splits**-funksies gedoen.

### Skema

Elke `formaat`-blok (`eboek`, `harde_kopie`) in 'n produk-rekord kan 'n
opsionele `verdeling`-veld hê:

```json
"verdeling": {
  "subrekening_kode": "ACCT_xxxxx",
  "tipe": "persentasie",   // of "vaste_bedrag"
  "waarde": 70              // persent (0-100) OF sent-bedrag, na gelang van tipe
}
```

`verdeling: null` (of weglaat) beteken die volle bedrag gaan na Future
Sharp se hoofrekening — dis die verstek vir enige produk sonder 'n
gekoppelde outeur-ooreenkoms.

**Belangrik:** die `subrekening_kode` (`ACCT_...`) moet eers op Paystack
self geskep word (via die kontrolepaneel: Settings → Split Payments, of
die Create Subaccount-API) voordat dit aan 'n produk gekoppel kan word —
dis waar die outeur se eie bankbesonderhede geregistreer word. Future Sharp
(nie hierdie stelsel nie) is verantwoordelik om te bevestig die
bankbesonderhede korrek is voor koppeling; Paystack aanvaar geen
aanspreeklikheid vir foutiewe uitbetalings nie.

### Hoe `begin-betaling.js` dit hanteer

1. **Pryse word nooit van die kliënt vertrou nie** — elke item in die
   mandjie word herbou vanuit die "katalogus"-store se werklike
   `prys_sent` en `verdeling` voordat enigiets bereken word. (Dit is ook
   'n sekuriteitsverbetering bo wat voorheen daar was: die stelsel het
   voorheen die blaaier se `totaal_sent` net só aanvaar, wat teoreties
   deur iemand in dev-tools verander kon word.)
2. As een of meer items 'n `verdeling` het, word 'n **Paystack Transaction
   Split dinamies geskep** ("op die vlug", soos Paystack self voorstel
   wanneer die samestelling eers by kassa bekend is) — met een aandeel per
   unieke subrekening, as 'n persentasie van die bestelling se totaal.
   Vaste-bedrag-items word na 'n ekwivalente persentasie omgereken sodat
   verskillende outeurs se boeke (party persentasie, party vaste bedrag)
   saam in een mandjie kan bestaan sonder konflik.
3. Die `split_code` wat terugkom, word by die Paystack-transaksie se
   inisiëring ingesluit — Paystack betaal dan outomaties uit volgens die
   verdeling wanneer die transaksie suksesvol is.
4. Die berekende verdeling (in sent, per subrekening) word saam met die
   bestelling in Blobs gestoor (`verdeling`-veld) vir personeel se eie
   rekords, en die webhook stoor ook wat Paystack self toegepas het
   (`paystack.split_toegepas`) vir rekonsiliasie.

### Waar dit later in die paneelbord inpas (Fase 4)

Die "Voeg produk by" / "Wysig"-vorms sal 'n opsionele afdeling nodig hê
waar personeel 'n subrekening-kode, tipe (persentasie/vaste bedrag) en
waarde per formaat kan koppel. `skep-produk.js` en `wysig-produk.js`
valideer en stoor dit reeds korrek (validasie-funksie in albei Functions)
— net die vorm-UI self moet nog gebou word.

---

## Aanmelding — eie kliënt i.p.v. Netlify se Identity-widget

**Belangrike argitektuur-besluit, ná uitgebreide velddebuggering:** Future
Shop gebruik **nie** Netlify se kant-en-klaar `netlify-identity-widget.js`
nie. In plaas daarvan praat `public/js/identiteit.js` **direk** met die
onderliggende Identity-API (GoTrue) via gewone `fetch`-versoeke.

### Hoekom

Die widget render sy hele aanmeld-/registrasie-venster binne 'n **Shadow
DOM**, en vertrou op `localStorage` vir sessie-toestand. In die praktyk
het dit herhaaldelik gebreek wanneer algemene blaaier-uitbreidings (bv.
**Adobe Acrobat**, **Google Docs Offline**) op dieselfde bladsy hulle eie
skrips inspuit — die knoppie het eenvoudig opgehou reageer, of die
widget het vasgesteek in 'n verwarrende "Email not confirmed"-toestand,
selfs met splinternuwe, korrek-bevestigde rekeninge. Dit is **nie** iets
wat ons ooit vir regte kliënte/personeel kan vra om reg te stel
("skakel jou uitbreidings af") nie — dus is die widget heeltemal
vervang.

### Hoe `identiteit.js` werk

Eenvoudige, direkte REST-oproepe teen `/.netlify/identity/*`:

| Funksie | Eindpunt | Doel |
|---|---|---|
| `identiteit_meld_aan(epos, wagwoord)` | `POST /token` | Aanmeld, kry sessie |
| `identiteit_registreer(epos, wagwoord)` | `POST /signup` | Self-registrasie (vir Fase 5 se kopers) |
| `identiteit_stuur_herstel(epos)` | `POST /recover` | Stuur wagwoord-herstel-epos |
| `identiteit_verwerk_token(tipe, token, wagwoord)` | `POST /verify` | Voltooi uitnodiging/bevestiging (`tipe:"signup"`) of herstel (`tipe:"recovery"`) — stel wagwoord in dieselfde stap |
| `identiteit_kry_huidige_sessie()` | — | Lees gestoorde sessie uit `localStorage`, verfris outomaties as verval |
| `identiteit_meld_af()` | — | Verwyder gestoorde sessie |

Sessie word gestoor onder 'n **eie** `localStorage`-sleutel
(`future_shop_identiteit_sessie`) — nie die widget se sleutel nie, wat
enige oorblywende korrupsie van vorige widget-gebruik outomaties omseil.

### Wat dit vir Fase 5 beteken

Wanneer koper-aanmelding (vir "My Boeke") gebou word, gebruik
**dieselfde** `identiteit.js` — **moet nooit teruggaan na die widget
nie**, presies om bostaande rede. Bou eie vorms (soos op
`paneelbord.html`) wat by Future Shop se eie ontwerp pas, nie 'n
generiese Netlify-opspring nie.

### Bediener-kant onveranderd

Hierdie is 'n **suiwer front-end-verandering** — die JWT wat
`identiteit_meld_aan`/`identiteit_verwerk_token` teruggee, is presies
dieselfde tipe token wat die widget sou gegee het, en Netlify se
Functions-omgewing ontleed dit steeds outomaties in
`context.clientContext.user`. Geen Function (`_rol-kontrole.js`, ens.)
moes verander word nie.

---

## Sekuriteitsgrens — personeel vs. publiek (belangrike beginsel)

Die skeiding tussen die publieke winkelfront en die interne paneelbord
(`/paneelbord.html`) berus **nooit** daarop dat 'n mens nie die URL kan
raai/vind nie. Dit berus op twee dinge, altyd saam:

1. **Elke** personeel-Function (`kry-alle-produkte.js`, `skep-produk.js`,
   `wysig-produk.js`) doen sy eie bediener-kant rolkontrole via
   `_rol-kontrole.js` — dit ontleed die aangemelde gebruiker se JWT en
   vereis `"personeel"` in hul rolle, ongeag hoe/vanwaar die versoek
   gemaak is (blaaier, bevel-reël, ens.). Dít is die werklike grens.
2. **Geen kode-pad ken ooit die "personeel"-rol outomaties toe nie.**
   `identity-signup.js` ken elke nuwe registrasie outomaties net
   `"koper"` toe. Die enigste manier waarop iemand "personeel" word, is
   'n **handmatige** stap deur 'n mens in Netlify se eie Identity-
   kontrolepaneel (Users → gebruiker kies → Roles → by voeg). Daar is
   doelbewus geen "word personeel"-vorm of API-eindpunt in hierdie
   projek se kode nie.

Die front-end se "geen toegang nie"-boodskap op die paneelbord is dus
**net gerief** (wys vinnig vir 'n nie-personeel-gebruiker wat aangaan),
nie self die sekuriteit nie — selfs al sou daardie kontrole ooit per
ongeluk verwyder/omseil word, sal die Functions self steeds 401/403
teruggee.

**Bekende, aanvaarde nie-probleem:** die Identity-widget se "Sign up"-
oortjie is steeds klikbaar op `/paneelbord.html` (net "Log in" is die
verstek-oortjie). Dit is doelbewus nie heeltemal verwyder nie — dit sou
'n werf-wye "Invite only"-registrasie-instelling in Netlify vereis, wat
óók kopers sou verhoed om self vir "My Boeke" te registreer (Fase 5).
Aangesien selfregistrasie hoe dan ook net "koper" toeken, is dit nie 'n
sekuriteitsgat nie.

### Identity-eposskakels word na die paneelbord herlei, nie die winkel-voorblad nie

Netlify se eie e-pos-skakels (bevestiging, uitnodiging, wagwoord-herstel)
stuur altyd na die werf se hoofblad (`index.html`) met 'n token in die
URL. `mandjie.js` merk hierdie tokens dadelik en herlei outomaties na
`/paneelbord.html` — want op die oomblik het **net personeel**
rekeninge, so so 'n skakel is per definisie 'n personeel-aksie, en dit
moet nie op die publieke winkel-voorblad self oopmaak nie.

⚠️ **Slaggat vir Fase 5:** sodra kopers ook rekeninge kry (vir "My
Boeke"), is hierdie aanname nie meer waar nie — 'n koper se
wagwoord-herstel-skakel sou dan ook per ongeluk na die paneelbord
herlei word. Voor Fase 5 se koper-aanmelding gebou word, moet hierdie
logika in `mandjie.js` aangepas word om te onderskei tussen 'n koper-
en 'n personeel-skakel.

---

## Hoe voeg ek 'n nuwe boek by? (Fase 4 — klaar gebou)

Geen Git, geen kode, geen herontplooi nie:

1. Gaan na **`/paneelbord.html`** (nie gekoppel vanaf die publieke nav nie — personeel gaan direk daarheen) en meld aan met 'n **personeel**-rekening
2. Klik "+ Voeg produk by"
3. Vul die vorm in: slug, titel, outeur, oorsig (~100 woorde), volledige beskrywing, omslag-pad, en per formaat (e-boek/harde kopie): beskikbaar-wisselaar, prys, opsionele vrystellingsdatum (voorbestelling), en opsionele outeur-verdeling (subrekening-kode, tipe, waarde)
4. Klik "Skep produk" → `skep-produk.js` word aangeroep, skryf die rekord na Blobs, en die boek is **onmiddellik** op die winkelfront sigbaar (tensy 'n vrystellingsdatum in die toekoms gestel is — sien "Voorbestellings" hieronder vir hoe dit ontsluiting raak)

Om 'n prys, beskikbaarheid, of enige ander veld later te verander (bv. harde
kopie raak uitverkoop, of om 'n produk heeltemal te deaktiveer), gebruik
dieselfde paneelbord se "Wysig"-/"Deaktiveer"-knoppies → roep `wysig-produk.js`
aan. 'n Gedeaktiveerde produk verdwyn uit die publieke katalogus maar bly in
Blobs (bestellingsgeskiedenis bly intak) en kan enige tyd weer geaktiveer word.

**Opgedateer:** omslag-beeld-oplaai is intussen gebou en bevestig werkend —
personeel kies 'n beeld direk in die vorm ("Choose file", JPEG/PNG/WEBP/GIF,
maks. 4MB), wat outomaties via `laai-omslag-op.js`/`kry-omslag.js` opgelaai
en gestoor word. Geen handmatige lêerplasing of pad-intik meer nodig nie.

Die enigste stap wat nog buite die vorm gebeur, is die werklike PDF vir die e-boek
se leesbare inhoud oplaai — dít los ons in Fase 5 (leser) op.

---

## Fase 5 (toekoms) — DRM-besluit vasgestel

Geen harde DRM (Adobe ACS4, Readium LCP, ens.) nie — te omslagtig vir 'n klein
katalogus, vereis 'n derdeparty-sleutelbediener, en frustreer eerlike kopers meer
as wat dit skelms stop. E-boeke bly gewone PDF's wat oral oopmaak.

In plaas daarvan, **sagte watermerking (naspoorbaarheid, nie visuele steurnis
nie)** — koper se skryfwerk self word nooit aangeraak nie:

1. **Onsigbare metadata** — koper se epos + bestelnommer word in die PDF se
   dokument-eienskappe ingebed (soos "outeur"/"onderwerp"-velde), regdeur die
   lêer. Onsigbaar tydens lees, maar naspoorbaar as die lêer ooit uitlek.
2. **Een diskrete bladsy** voor of ná die boek se inhoud ("Hierdie e-boek is
   aangekoop deur [epos] — bestelnommer [nommer], vir eie gebruik.") — die
   res van die boek (elke bladsy van die skryfwerk self) bly heeltemal skoon.

Implementasie (wanneer Fase 5 aan die beurt kom): 'n Function wat die
oorspronklike PDF by aflewering dinamies watermerk (waarskynlik met
`pdf-lib`) voordat dit vir die koper afgelaai/gestroom word — nie 'n
voorafwatermerkte kopie wat op Blobs gestoor word nie, sodat die oorspronklike
lêer skoon bly en elke aflewering uniek per koper is.

---

## Fase 5 (toekoms) — "My Boeke" en toestel-onafhanklike toegang

Aangesien daar **geen harde DRM** is nie (sien bo), is 'n gekoopte e-boek se
PDF nie aan een toestel gekoppel nie — 'n koper kan dit in beginsel op enige
toestel oopmaak. Maar op die oomblik is daar nog geen manier vir 'n koper om
'n reeds-gekoopte boek **weer** af te laai op 'n ander/nuwe toestel nie
(`dankie.html` belowe klaar 'n "My Boeke"-bladsy, maar dit bestaan nog nie).

**Besluit:** aankope vereis 'n aangemelde "koper"-rekening (Netlify
Identity), sodat aankope aan 'n identiteit gekoppel is, nie net 'n epos-adres
op daardie oomblik nie. Dit is ook reeds waarvoor die bestaande rol-stelsel
gebou is (`identity-signup.js` ken outomaties "koper" toe by registrasie).

Wat dit in Fase 5 gaan verg:

1. **Voltooi-betaling vereis aanmelding** — `voltooi-betaling.js` moet
   kyk of die koper aangemeld is (Netlify Identity widget) voordat
   "Gaan na betaling" beskikbaar is; indien nie, aanmeld/registreer eers
   vra.
2. **`begin-betaling.js` stoor die identiteit server-kant** — nie van die
   kliënt se invoer vertrou nie (dieselfde beginsel as die prys-verifikasie
   wat ons reeds ingebou het), maar uit die geverifieerde Identity-konteks
   gehaal (soortgelyk aan `_rol-kontrole.js` se `kry_identity_konteks`).
   Dit vul die `koper.netlify_identity_id`-veld wat reeds in die
   bestelling-skema voorsien is.
3. **Nuwe Function `kry-my-boeke.js`** (koper-beskermd) — soek deur die
   "bestellings"-store vir rekords waar `koper.netlify_identity_id`
   ooreenstem met die aangemelde gebruiker en `status = "Nuut"` (betaal),
   en gee 'n lys van gekoopte boeke terug.
4. **Aflaai-skakel per boek roep 'n aflewer-Function aan** wat die
   Fase-5-watermerk (hierbo) dinamies toepas en die PDF stroom — elke
   aflaai is vars, so daar's geen probleem om dieselfde boek op 'n
   rekenaar, foon of tablet af te laai nie; die koper meld net op elke
   toestel by hul rekening aan.

### Leesmodel — besluit: albei opsies (hibried)

"My Boeke" bied vir elke gekoopte e-boek **twee opsies**, nie net een nie:

- **"Lees aanlyn"** — maak die boek oop in 'n ingeboude, in-blaaier-leser
  (PDF.js-gebaseer). Die PDF verlaat nooit die platform as 'n aflaaibare
  lêer nie — dit stroom net. Dit is die verkose opsie vir wie net gou wil
  lees.
- **"Laai af"** — kry die volledige, watermerkte PDF om self te stoor of
  na 'n eie toestel/e-leser oor te dra (bv. Amazon se "Send to Kindle",
  wat 'n gewone PDF sonder verdere iets van ons kant af aanvaar).

Albei paaie gebruik dieselfde onderliggende Fase-5-watermerk-Function
(punt 4 hierbo) — "Lees aanlyn" stroom die watermerkte PDF direk na die
in-blaaier-leser, "Laai af" gee dieselfde watermerkte PDF as 'n lêer.
Geen aparte watermerk-logika vir die twee paaie nie.

**Belangrik — tweetalige leser-koppelvlak:** die "Lees aanlyn"-leser se
eie koppelvlak (knoppies soos "Vorige"/"Volgende", "Bladsy X van Y",
"Aflaai", foutboodskappe, ens.) moet deur die bestaande `taal.js`/`t()`-
stelsel loop, net soos die res van die platform — AF/EN, koppelbaar met
die bestaande taal-wisselaar.

**Dit raak nooit die boek se inhoud self nie** — die PDF-teks (die
skryfwerk) word nooit verander of vertaal nie, ongeag watter platformtaal
gekies is. Slegs die leser se buite-om-koppelvlak is tweetalig.

**Skaal-nota:** vir 'n klein katalogus is 'n volle deurloop van die
"bestellings"-store (via `store.list()`) heeltemal aanvaarbaar. Sou die
bestelvolume baie groot word, sal 'n sekondêre indeks (bv.
`koper-bestellings:<identity_id>` → lys van bestelnommers) later oorweeg
kan word om die deurloop te vermy — nie nodig om nou reeds te bou nie.

---

## Voorbestellings — besluit (Fase 4, uitgebrei)

**Model: betaal nou, ontvang later** (nie "bespreek nou, betaal later" nie
— geen herinnering-/herbelastingstelsel nodig nie, werk binne die
bestaande Paystack-vloei).

### Skema

Elke `formaat`-blok (`eboek`, `harde_kopie`) kry 'n opsionele
`vrystelling_datum` (ISO-datum). Geen aparte "is voorbestelling"-vlag
nie — die datum self bepaal dit:

```json
"eboek": {
  "beskikbaar": true,
  "prys_sent": 15000,
  "vrystelling_datum": "2026-11-01"
}
```

`vrystelling_datum: null` (of weglaat) = normale, dadelik-beskikbare
produk, soos nou.

### Wat dit raak

1. **Katalogus/produk-bladsy** — knoppie wys "Voorbestel nou — verskyn
   [datum]" i.p.v. "Koop nou" wanneer `vrystelling_datum` in die toekoms
   lê.
2. **Betaling** — onveranderd; koper betaal die volle bedrag nou, soos
   enige ander aankoop. `begin-betaling.js` se prys-verifikasie werk
   reeds per item vanuit die katalogus, so dit vereis geen aanpassing
   nie.
3. **Ontsluiting/aflewering — die belangrikste verskil:** dit moet
   **per item**, nie per hele bestelling nie, gebeur. 'n Mandjie kan 'n
   voorbestelling én 'n gewone boek saam bevat; die gewone boek moet
   dadelik beskikbaar wees terwyl die voorbestelling wag. Wanneer Fase 5
   se "My Boeke"/aflaai-Function gebou word, moet dit elke item se eie
   `vrystelling_datum` teen vandag se datum toets voordat 'n aflaai-
   skakel gewys word (i.p.v. net te kyk of die hele bestelling betaal
   is).
4. **Drukker (harde kopie)** — personeel plaas die POD-drukwerk-bestelling
   eers wanneer die vrystellingsdatum aanbreek, nie dadelik ná betaling
   nie (soortgelyk aan hoe die `drukker`-blok reeds "nog nie geplaas
   nie" volg).

### Waar dit in Fase 4 se paneelbord inpas

Die "Voeg produk by" / "Wysig"-vorm kry 'n opsionele
`vrystelling_datum`-veld per formaat, saam met die verdeling-velde wat
ons reeds vasgelê het.
