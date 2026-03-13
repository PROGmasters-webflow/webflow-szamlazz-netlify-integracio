# User Story: MiniCRM → Webflow Form pre-fill URL paraméterekkel

**Verzió:** 1.0  
**Dátum:** 2026-03-13

---

## Összefoglaló

Jelenleg a Webflow form egy üres űrlapot jelenít meg, amelyet a felhasználó kézzel tölt ki. Az új folyamatban a MiniCRM-ből küldött sablon e-mailben elhelyezett link URL paramétereken keresztül előre kitölti az űrlapot a vevő személyes adataival és a számlázási tétel adataival, így a felhasználónak minimális módosításra van szüksége.

---

## Szereplők

- **Adminisztrátor** – MiniCRM-ben sablon levelet küld a vevőnek
- **Vevő (felhasználó)** – megnyitja a linket, ellenőrzi/kiegészíti az adatokat, elküldi a formot

---

## User Story

> **Mint** adminisztrátor,  
> **szeretném**, hogy a MiniCRM sablon levelében elhelyezett link URL paraméterekben tartalmazza a vevő adatait és a számlázási tétel részleteit,  
> **azért**, hogy a vevő a Webflow form megnyitásakor már kitöltött mezőket lásson, és csak a szükséges számlázási cím adatokat kelljen megadnia/ellenőriznie.

---

## Elfogadási kritériumok

### AC-1: MiniCRM link URL paraméterek
- A MiniCRM sablon levélben az alábbi URL paraméterekkel generálható a link:

| URL paraméter | Leírás | XSD megfeleltetés | Példa |
|---|---|---|---|
| `lastName` | Vevő vezetékneve | `vevo > nev` (összetétel) | `Kovács` |
| `firstName` | Vevő keresztneve | `vevo > nev` (összetétel) | `János` |
| `email` | E-mail cím | `vevo > email` | `kovacs@example.com` |
| `phone` | Telefonszám | `vevo > telefonszam` | `+36301234567` |
| `itemName` | Tétel megnevezése | `tetel > megnevezes` | `Üzleti coaching - 5 alkalom` |
| `itemId` | Tétel/termék azonosítója | `tetel > azonosito` | `COACH-5` |
| `quantity` | Mennyiség | `tetel > mennyiseg` | `1` |
| `unit` | Mennyiségi egység | `tetel > mennyisegiEgyseg` | `db` |
| `netUnitPrice` | Nettó egységár | `tetel > nettoEgysegar` | `100000` |
| `vatRate` | ÁFA kulcs | `tetel > afakulcs` | `27` |
| `netAmount` | Nettó érték | `tetel > nettoErtek` | `100000` |
| `vatAmount` | ÁFA érték | `tetel > afaErtek` | `27000` |
| `grossAmount` | Bruttó érték | `tetel > bruttoErtek` | `127000` |
| `discount` | Kedvezmény mértéke (%) | `tetel > megjegyzes`-be kerül | `10` |
| `orderNumber` | Rendelésszám | `fejlec > rendelesSzam` | `ORD-2026-0042` |
| `invoicePrefix` | Számlaszám előtag | `fejlec > szamlaszamElotag` | `DIJ` |

- Példa teljes URL:
  ```
  https://domain.hu/szamla?lastName=Kov%C3%A1cs&firstName=J%C3%A1nos&email=kovacs%40example.com&phone=%2B36301234567&itemName=%C3%9Czleti+coaching&itemId=COACH-5&quantity=1&unit=db&netUnitPrice=100000&vatRate=27&netAmount=100000&vatAmount=27000&grossAmount=127000&discount=10&orderNumber=ORD-2026-0042&invoicePrefix=DIJ
  ```

### AC-2: Form pre-fill URL paraméterekből
- A Webflow oldal JavaScript kódja a `window.location.search`-ből kiolvassa a paramétereket
- Az űrlap mezői a paraméterek alapján előre kitöltődnek az oldal betöltésekor

### AC-3: Mező módosíthatósági szintek

**Kitöltött és módosítható mezők (normál megjelenés):**
| Mező | URL paraméter | form `name` |
|---|---|---|
| Vezetéknév | `lastName` | `vezeteknev` |
| Keresztnév | `firstName` | `keresztnev` |
| Cég neve | – | `cegnev` |
| Adószám | – | `adoszam` |
| Ország | – | `orszag` |
| Irányítószám | – | `irsz` |
| Város | – | `telepules` |
| Megye | – | `megye` |
| Utca, házszám | – | `cim` |

**Kitöltött és NEM módosítható mezők (szürke háttér, `readonly`):**
| Mező | URL paraméter | form `name` |
|---|---|---|
| E-mail cím | `email` | `email` |
| Telefonszám | `phone` | `telefon` |

**Rejtett mezők (`type="hidden"`) – termék/számlázási adatok:**
| Mező | URL paraméter | form `name` |
|---|---|---|
| Tétel megnevezése | `itemName` | `itemName` |
| Tétel azonosítója | `itemId` | `itemId` |
| Mennyiség | `quantity` | `quantity` |
| Mennyiségi egység | `unit` | `unit` |
| Nettó egységár | `netUnitPrice` | `netUnitPrice` |
| ÁFA kulcs | `vatRate` | `vatRate` |
| Nettó érték | `netAmount` | `netAmount` |
| ÁFA érték | `vatAmount` | `vatAmount` |
| Bruttó érték | `grossAmount` | `grossAmount` |
| Kedvezmény (%) | `discount` | `discount` |
| Rendelésszám | `orderNumber` | `orderNumber` |
| Számlaszám előtag | `invoicePrefix` | `invoicePrefix` |

### AC-4: Read-only mezők vizuális megjelenése
- A `readonly` mezők szürke háttérrel (`#F3F4F6`) és halványabb szövegszínnel (`#6B7280`) jelennek meg
- A kurzor `not-allowed` vagy `default` legyen rajtuk
- A felhasználó nem tudja átírni ezeket az értékeket

### AC-5: Összefoglaló blokk a termék adatokról
- A hidden mezők értékeiből egy **látható, nem szerkeszthető összefoglaló blokk** jelenik meg a form tetején vagy alján (a submit gomb előtt), amely tartalmazza:
  - Termék neve
  - Mennyiség és egység
  - Nettó ár, ÁFA, Bruttó ár (formázva, pl. `100 000 Ft`)
  - Kedvezmény (ha van, pl. `10%`)
  - Rendelésszám
- Ez biztosítja a transzparenciát: a vevő látja, miről szól a számla, de nem módosíthatja

### AC-6: JavaScript payload összeállítás
- A submit handler a meglévő mezőkön túl az alábbi mezőket is küldi a backendnek:

```json
{
  "vezeteknev": "Kovács",
  "keresztnev": "János",
  "email": "kovacs@example.com",
  "telefon": "+36301234567",
  "irsz": "1234",
  "telepules": "Budapest",
  "cim": "Fő utca 1.",
  "orszag": "Magyarország",
  "orderNumber": "ORD-2026-0042",
  "invoicePrefix": "DIJ",
  "items": [
    {
      "megnevezes": "Üzleti coaching",
      "azonosito": "COACH-5",
      "mennyiseg": 1,
      "mennyisegiEgyseg": "db",
      "nettoEgysegar": 100000,
      "afakulcs": "27",
      "nettoErtek": 100000,
      "afaErtek": 27000,
      "bruttoErtek": 127000,
      "megjegyzes": "Kedvezmény: 10%"
    }
  ]
}
```

### AC-7: Backend módosítások (`szamla.ts`)
- A `SzamlaRequest` interface bővül két opcionális mezővel:
  - `orderNumber?: string` → XML `fejlec > rendelesSzam`
  - `invoicePrefix?: string` → XML `fejlec > szamlaszamElotag` (felülírja az env var-t, ha megadva)
- A `SzamlaItem` interface bővül:
  - `azonosito?: string` → XML `tetel > azonosito`
- A `buildXml` függvényben:
  - Ha `data.orderNumber` megadva → `<rendelesSzam>` elem hozzáadása a fejléchez
  - Ha `data.invoicePrefix` megadva → `<szamlaszamElotag>` felülírása
  - Ha item-ben `azonosito` megadva → `<azonosito>` elem hozzáadása a tételhez

### AC-8: URL paraméterek nélküli működés
- Ha nincs URL paraméter, a form pontosan úgy működik, mint eddig (üres mezők, minden szerkeszthető)
- A korábbi `NETLIFY_DEFAULT_ITEMS` env var továbbra is működik fallback-ként, ha nincs `items` a requestben

---

## Megvalósítási terv

### 1. fázis – Backend bővítés (`szamla.ts`)
1. `SzamlaRequest` interface bővítése: `orderNumber`, `invoicePrefix`
2. `SzamlaItem` interface bővítése: `azonosito`
3. `buildItemsXml` bővítése az `azonosito` elem generálásával
4. `buildXml` bővítése: `rendelesSzam`, `szamlaszamElotag` felülírás `invoicePrefix`-szel
5. Tesztelés helyi Netlify CLI-vel

### 2. fázis – Webflow Form HTML bővítés
1. Hidden input mezők hozzáadása a termék/számlázási adatokhoz
2. Összefoglaló blokk HTML/CSS hozzáadása
3. Read-only CSS stílusok hozzáadása

### 3. fázis – Webflow JavaScript bővítés
1. URL paraméterek kiolvasása (`URLSearchParams`)
2. Form mezők pre-fill logika
3. Read-only attribútum beállítása az érintett mezőkre
4. Összefoglaló blokk kitöltése az URL paraméterekből
5. Submit handler bővítése: hidden mezők + `items` tömb + `orderNumber`/`invoicePrefix` beépítése a payloadba

### 4. fázis – MiniCRM sablon konfigurálás
1. MiniCRM sablon levélben a link URL összeállítása a kontakt és termék mezőkből
2. URL encoding biztosítása (ékezetes karakterek, speciális jelek)

### 5. fázis – Tesztelés
1. End-to-end teszt: MiniCRM sablon → e-mail → link megnyitás → form kitöltés → számla kiállítás
2. Ékezetes karakterek tesztelése az URL paraméterekben
3. Hiányzó paraméterek kezelésének tesztelése (részleges kitöltés)
4. Read-only mezők nem módosíthatóságának ellenőrzése (DevTools-szal is – submit handler-ben verifikálás)

---

## Biztonsági megjegyzések

- A URL paraméterek kliens oldali adatok → a backend **nem bízik meg** bennük vakon
- Az API kulcs továbbra is kizárólag a backend env var-ból jön, nem az URL-ből
- A backend validálja a `mennyiség × nettó egységár == nettó érték` és `nettó + ÁFA == bruttó` egyenleteket (Számlázz.hu API is ellenőrzi, hibakódok: 57, 259–264)
- XSS védelem: az URL paraméterek értékei a form `value` attribútumba kerülnek (nem `innerHTML`-be), és a backend `escapeXml()`-lel sanitizálja az XML kimenetben
- A hidden mezők kliens oldalon módosíthatók (DevTools) → fontos, hogy a backend a Számlázz.hu API szintjén kapja meg az érvényességi hibákat, és azokat továbbítsa

---

## URL paraméter ↔ XSD mező összesítő tábla

| URL param | Form `name` | JSON payload mező | XML elem (XSD) | XSD típus |
|---|---|---|---|---|
| `lastName` | `vezeteknev` | `vezeteknev` | `vevo > nev` (részeként) | `string` |
| `firstName` | `keresztnev` | `keresztnev` | `vevo > nev` (részeként) | `string` |
| `email` | `email` | `email` | `vevo > email` | `string` |
| `phone` | `telefon` | `telefon` | `vevo > telefonszam` | `string` |
| `itemName` | `itemName` | `items[0].megnevezes` | `tetel > megnevezes` | `string` |
| `itemId` | `itemId` | `items[0].azonosito` | `tetel > azonosito` | `string` |
| `quantity` | `quantity` | `items[0].mennyiseg` | `tetel > mennyiseg` | `double` |
| `unit` | `unit` | `items[0].mennyisegiEgyseg` | `tetel > mennyisegiEgyseg` | `string` |
| `netUnitPrice` | `netUnitPrice` | `items[0].nettoEgysegar` | `tetel > nettoEgysegar` | `double` |
| `vatRate` | `vatRate` | `items[0].afakulcs` | `tetel > afakulcs` | `string` |
| `netAmount` | `netAmount` | `items[0].nettoErtek` | `tetel > nettoErtek` | `double` |
| `vatAmount` | `vatAmount` | `items[0].afaErtek` | `tetel > afaErtek` | `double` |
| `grossAmount` | `grossAmount` | `items[0].bruttoErtek` | `tetel > bruttoErtek` | `double` |
| `discount` | `discount` | `items[0].megjegyzes` (részeként) | `tetel > megjegyzes` | `string` |
| `orderNumber` | `orderNumber` | `orderNumber` | `fejlec > rendelesSzam` | `string` |
| `invoicePrefix` | `invoicePrefix` | `invoicePrefix` | `fejlec > szamlaszamElotag` | `string` |
