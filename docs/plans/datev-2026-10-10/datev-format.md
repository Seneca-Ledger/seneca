# DATEV-Format (EXTF) — Buchungsstapel: verified format notes

Researched 2026-10-10. Everything below is quoted/derived from official DATEV sources unless marked **UNVERIFIED**.

## Sources (all official DATEV)

| Key | What | URL |
|---|---|---|
| DEV | DATEV Developer Portal, DATEV-Format (Einstieg, Zeichensatz, Header, Buchungsstapel, Anhang, Changelog). The portal is an SPA; the content was read from its CMS JSON that the SPA itself loads. Raw copy: `datev-format.json`, text: `de.txt` / `en.txt` | https://developer.datev.de/de/file-format/details/datev-format/format-description/booking-batch (UI) — JSON: https://developer.datev.de/mediator/strapi/file-formats/slug/datev-format |
| MUSTER | Official sample data zip ("Musterdaten") linked from the portal's "Musterdaten" page; contains `EXTF_Buchungsstapel.csv` (dated 2025-06-18 in zip) | https://developer.datev.de/assets/Musterdaten_DATEV_Format_0_7f9322b9cc.zip |
| PRUEF | Official "Prüfprogramm DATEV-Format" 2.2.3.0 (zip dated 2026-03-02). Contains machine-readable field definitions `Formate/Format_Buchungsstapel.xml` (Version 13, 125 fields, `Necessary` flag, lengths) and the header validation messages in the .exe | https://developer.datev.de/assets/Datev_Format_Pruefprogramm_2_2_3_0_76439824cb.zip |
| HC-0907048 | Hilfe-Center: "SKR03 / SKR04: Steuerschlüssel-Tabelle 2026" (last change 29.12.2025) + its xlsx "Verfügbare Steuerschlüssel 2026_SKR03_SKR04" (Stand 29.12.2025) | https://apps.datev.de/help-center/documents/0907048 |
| HC-0907054 | Hilfe-Center: "Steuerschlüssel-Tabelle 2025" (archived 07.11.2025, linked from the BU-Schlüssel field in DEV) | https://apps.datev.de/help-center/documents/0907054 |
| HC-1003613 | "§ 13b UStG: Zusammenfassung der Tatbestände (drei-/vierstellige BU-Schlüssel)" | https://apps.datev.de/help-center/documents/1003613 |
| HC-1034038 | "Stapelverarbeitung: Buchungsstapel und Stammdaten im DATEV-Format importieren" (25.07.2026) | https://apps.datev.de/help-center/documents/1034038 |
| HC-1044208 | "Stapelverarbeitung: REW04506 oder 'Keine Daten vorhanden' beim Importieren" (25.07.2026) | https://apps.datev.de/help-center/documents/1044208 |
| HC-1080697 | "Festschreibung beim Import in die DATEV-Rechnungswesen-Programme" (checked 12.06.2026) | https://apps.datev.de/help-center/documents/1080697 |
| HC-9211449 | "Daten bei der Stapelverarbeitung automatisiert übernehmen" (KrStaPv) | https://apps.datev.de/help-center/documents/9211449 |

Help-Center pages are also SPA-rendered (now under wissensplattform.apps.datev.de); content was read via its document API with an anonymous session. Local copies: `hc/<docnr>.txt` / `.json`.

Local artifacts in this directory:
- `sample-EXTF-Buchungsstapel.csv` — byte-identical copy of `EXTF_Buchungsstapel.csv` from MUSTER (sha256 `25009cb9…d633`).
- `muster/` — all 7 sample files; `pruef/` — the check program incl. `Formate/Format_Buchungsstapel.xml`.
- `Steuerschluessel-2026.xlsx` + `steuerschluessel-2026-sheet1.tsv` — official 2026 key table.
- `columns-line.txt` — line 2 of the official sample, verbatim.

---

## 0. Current version (as of 2026-10-10)

- Header version (field 2): **700** — only allowed value (DEV regex `^(700)$`).
- Data category (field 3) Buchungsstapel: **21**; format name: **"Buchungsstapel"**.
- Format version (field 5) Buchungsstapel: **13** (DEV changelog: "February 2024 | 700 | booking batch | Format version increased from 12 to 13, Field 125 'dev. cash discount account' added"; "March 2025 | 700 | All formats | Improved a few regular expressions" — no newer entry). PRUEF `Format_Buchungsstapel.xml` → `<Version>13</Version>`, 125 fields.
- DEV Anhang "Format-Kategorie/Name/Version": Buchungsstapel 13 (ab 17.0/12.2), 12, 11, 10 (older versions still listed as importable).

## 1. Header record (line 1)

Official example (DEV "Einstieg" + "Header", and line 1 of the MUSTER file, identical):

```
"EXTF";700;21;"Buchungsstapel";13;20240130140440439;;"RE";"";"";29098;55003;20240101;4;20240101;20240831;"Buchungsstapel";"WD";1;0;0;"EUR";;"";;;"03";;;"";""
```

31 fields. DEV: "Der nachfolgende Aufbau des Headers muss zwingend eingehalten werden." Quoting follows the regex: `["]…["]` = text field in quotes; no quotes = numeric/unquoted. Empty fields that are text are written `""`, empty numeric/reserved fields are written as nothing (`;;`).

| # | Überschrift | Ausdruck (DEV regex, verbatim) | Beschreibung (DEV) | Example |
|---|---|---|---|---|
| 1 | Kennzeichen | `^["](EXTF\|DTVF)["]$` | EXTF = Export aus 3rd-Party App; DTVF = Export aus DATEV App | `"EXTF"` |
| 2 | Versionsnummer | `^(700)$` | Versionsnummer des Headers | `700` |
| 3 | Formatkategorie | `^(16\|20\|21\|46\|48\|65)$` | 21 = Buchungsstapel (16 Deb/Kred, 20 Sachkontenbeschriftungen, 46 Zahlungsbedingungen, 48 Diverse Adressen, 65 Wiederkehrende Buchungen) | `21` |
| 4 | Formatname | `^["](Buchungsstapel\|Wiederkehrende Buchungen\|Debitoren/Kreditoren\|Kontenbeschriftungen\|Zahlungsbedingungen\|Diverse Adressen)["]$` | | `"Buchungsstapel"` |
| 5 | Formatversion | `^(2\|4\|5\|13)$` | 13 = Buchungsstapel | `13` |
| 6 | Erzeugt am | `^([2])([0])([0-9]{2})(0[1-9]\|1[0-2])(0[1-9]\|[1-2][0-9]\|3[0-1])(2[0-3]\|[01][0-9])([0-5][0-9])([0-5][0-9][0-9][0-9][0-9])$` | Zeitstempel: **YYYYMMDDHHMMSSFFF** (17 digits, unquoted) | `20240130140440439` |
| 7 | Importiert | `^[]$` | Leerfeld | (empty) |
| 8 | Herkunft | `^["]\w{0,2}["]$` | Beispiel: RE. (PRUEF: "Durch die Stapelverarbeitung wird die Herkunft zu "SV"") | `"RE"` |
| 9 | Exportiert von | `^["]\w{0,25}["]$` | Beispiel: Max Mustermann | `""` |
| 10 | Importiert von | `^["]\w{0,25}["]$` | Beispiel: Admin | `""` |
| 11 | Beraternummer | `^(\d{4,6}\|\d{7})$` | Bereich 1001–9999999 | `29098` |
| 12 | Mandantennummer | `^\d{1,5}$` | Bereich 1–99999 | `55003` |
| 13 | WJ-Beginn | `^([2])([0])([0-9]{2})(0[1-9]\|1[0-2])(0[1-9]\|[1-2][0-9]\|3[0-1])$` | Wirtschaftsjahresbeginn, Format **YYYYMMDD** | `20240101` |
| 14 | Sachkontenlänge | `^[4-8]$` | Nummernlänge der Sachkonten. "Wert muss beim Import mit der Konfiguration des Mandats in der DATEV App übereinstimmen." | `4` |
| 15 | Datum von | YYYYMMDD regex as #13 | Beginn der Periode des Stapels | `20240101` |
| 16 | Datum bis | YYYYMMDD regex as #13 | Ende der Periode des Stapels | `20240831` |
| 17 | Bezeichnung | `^["][\w.-/ ]{0,30}["]$` | Bezeichnung des Stapels, z. B. "Rechnungsausgang 02/2024" | `"Buchungsstapel"` |
| 18 | Diktatkürzel | `^["]([A-Z]{2}){0,2}["]$` | Kürzel in Großbuchstaben des Bearbeiters, z. B. "MM" | `"WD"` |
| 19 | Buchungstyp | `^[1-2]$` | 1 = Finanzbuchführung (default); 2 = Jahresabschluss | `1` |
| 20 | Rechnungslegungszweck | `^(0\|30\|40\|50\|64)$` | 0 = unabhängig (default); 30 Steuerrecht; 40 Kalkulatorik; 50 Handelsrecht; 64 IFRS | `0` |
| 21 | Festschreibung | `^(0\|1)$` | 0 = keine Festschreibung; 1 = Festschreibung (**default**) | `0` |
| 22 | WKZ | `^["]([A-Z]{3})["]$` | ISO-Code der Währung, "EUR" = default | `"EUR"` |
| 23 | Reserviert | `^[]$` | Leerfeld | (empty) |
| 24 | Derivatskennzeichen | `^["]["]$` | Leerfeld | `""` |
| 25 | Reserviert | `^[]$` | Leerfeld | (empty) |
| 26 | Reserviert | `^[]$` | Leerfeld | (empty) |
| 27 | Sachkontenrahmen | `^["](\d{2}){0,2}["]$` | Sachkontenrahmen, der für die Bewegungsdaten verwendet wurde (e.g. "03" = SKR03, "04" = SKR04) | `"03"` |
| 28 | ID der Branchenlösung | `^\d{0,4}$` | Falls eine spezielle DATEV Branchenlösung genutzt wird | (empty) |
| 29 | Reserviert | `^[]$` | Leerfeld | (empty) |
| 30 | Reserviert | `^["]["]$` | Leerfeld | `""` |
| 31 | Anwendungsinformation | `^["].{0,16}["]$` | Verarbeitungskennzeichen der abgebenden Anwendung, z. B. 02/2024 | `""` |

**Which header fields are mandatory.** DEV says the header layout is fixed and that, for Bewegungsdaten (Buchungsstapel), "zusätzlich auf die Angabe einiger bestimmter Datenfelder geachtet werden [muss], welche hingegen bei den Stammdaten nicht zu befüllen sind" and that the table marks them — but the published table carries **no visible marker** (every row is bold). Comparing DEV's two official example headers (Buchungsstapel vs. Debitoren/Kreditoren), the fields the Stammdaten example leaves empty are **15 Datum von, 16 Datum bis, 17 Bezeichnung, 18 Diktatkürzel, 19 Buchungstyp, 20 Rechnungslegungszweck, 21 Festschreibung, 22 WKZ** → these are the Buchungsstapel-specific fields. Fields 1–6 and 11–14 are filled in both examples. Exactly which ones the importer rejects when empty is **UNVERIFIED**; PRUEF's messages show some have defaults when empty:
- "Feldinhalt nicht gefüllt. Es werden FIBU-Stapel erzeugt" (Buchungstyp),
- "Feldinhalt nicht gefüllt. Es wird Rechnungslegungszweck 0 = alle Bereiche zugrunde gelegt",
- "Feldinhalt nicht gefüllt. Es wird die SKL aus dem Rechnungswesen-Bestand zugrunde gelegt" (Sachkontenlänge),
- "Datei-Header enthält nicht alle erforderlichen Felder", "'DATEV-Format-KZ' muß "EXTF" sein", "Header-Version unbekannt", "Textfelder müssen in Anführungszeichen gesetzt werden".
Safe rule: fill 1–6, 8, 11–22 and 27 as in the official example; write all 31 fields.

**Header date checks (PRUEF validation messages, verbatim):**
- "'Datum von' kleiner Wirtschaftsjahresbeginn"
- "'Datum bis' kleiner als 'Datum von'"
- "'Datum von' und 'Datum bis' in unterschiedlichen Wirtschaftsjahren"
- "'Datum bis' größer als mögliches Wirtschaftsjahresende"
→ one file (batch) must lie within one fiscal year starting at WJ-Beginn.

HC-1044208 ("Keine Daten vorhanden"): the import matches the batch to the client by **Beraternummer, Mandantennummer, Wirtschaftsjahr, Stapeldatum (Datum von/bis)**; wrong values = file not found for that client. Missing header line → file not recognised.

## 2. Column header record (line 2)

Line 2 of the official sample, verbatim (unquoted titles, `;`-separated, 125 columns — also saved as `columns-line.txt`). PRUEF `Format_Buchungsstapel.xml` defines exactly 125 fields in this order.

| # | Column title (verbatim from MUSTER line 2) | Mandatory |
|---|---|---|
| 1 | Umsatz (ohne Soll/Haben-Kz) | **yes** |
| 2 | Soll/Haben-Kennzeichen | **yes** |
| 3 | WKZ Umsatz | |
| 4 | Kurs | |
| 5 | Basis-Umsatz | |
| 6 | WKZ Basis-Umsatz | |
| 7 | Konto | **yes** |
| 8 | Gegenkonto (ohne BU-Schlüssel) | **yes** |
| 9 | BU-Schlüssel | |
| 10 | Belegdatum | **yes** |
| 11 | Belegfeld 1 | |
| 12 | Belegfeld 2 | |
| 13 | Skonto | |
| 14 | Buchungstext | |
| 15 | Postensperre | |
| 16 | Diverse Adressnummer | |
| 17 | Geschäftspartnerbank | |
| 18 | Sachverhalt | |
| 19 | Zinssperre | |
| 20 | Beleglink | |
| 21–36 | Beleginfo - Art 1 / Beleginfo - Inhalt 1 … Beleginfo - Art 8 / Beleginfo - Inhalt 8 | |
| 37 | KOST1 - Kostenstelle | |
| 38 | KOST2 - Kostenstelle | |
| 39 | Kost-Menge | |
| 40 | EU-Land u. UStID (Bestimmung) | |
| 41 | EU-Steuersatz (Bestimmung) | |
| 42 | Abw. Versteuerungsart | |
| 43 | Sachverhalt L+L | |
| 44 | Funktionsergänzung L+L | |
| 45 | BU 49 Hauptfunktionstyp | |
| 46 | BU 49 Hauptfunktionsnummer | |
| 47 | BU 49 Funktionsergänzung | |
| 48–87 | Zusatzinformation - Art 1 / Zusatzinformation- Inhalt 1 … Zusatzinformation - Art 20 / Zusatzinformation- Inhalt 20 (note: "Art" titles have a space before the hyphen, "Inhalt" titles do not — verbatim) | |
| 88 | Stück | |
| 89 | Gewicht | |
| 90 | Zahlweise | |
| 91 | Forderungsart | |
| 92 | Veranlagungsjahr | |
| 93 | Zugeordnete Fälligkeit | |
| 94 | Skontotyp | |
| 95 | Auftragsnummer | |
| 96 | Buchungstyp | |
| 97 | USt-Schlüssel (Anzahlungen) | |
| 98 | EU-Land (Anzahlungen) | |
| 99 | Sachverhalt L+L (Anzahlungen) | |
| 100 | EU-Steuersatz (Anzahlungen) | |
| 101 | Erlöskonto (Anzahlungen) | |
| 102 | Herkunft-Kz | |
| 103 | Buchungs GUID | |
| 104 | KOST-Datum | |
| 105 | SEPA-Mandatsreferenz | |
| 106 | Skontosperre | |
| 107 | Gesellschaftername | |
| 108 | Beteiligtennummer | |
| 109 | Identifikationsnummer | |
| 110 | Zeichnernummer | |
| 111 | Postensperre bis | |
| 112 | Bezeichnung SoBil-Sachverhalt | |
| 113 | Kennzeichen SoBil-Buchung | |
| 114 | Festschreibung | |
| 115 | Leistungsdatum | |
| 116 | Datum Zuord. Steuerperiode | |
| 117 | Fälligkeit | |
| 118 | Generalumkehr (GU) | |
| 119 | Steuersatz | |
| 120 | Land | |
| 121 | Abrechnungsreferenz | |
| 122 | BVV-Position | |
| 123 | EU-Land u. UStID (Ursprung) | |
| 124 | EU-Steuersatz (Ursprung) | |
| 125 | Abw. Skontokonto | |

**Mandatory columns = 1, 2, 7, 8, 10.** Verified two ways: PRUEF `Format_Buchungsstapel.xml` has `<Necessary>1</Necessary>` only for these five fields; DEV's Buchungsstapel table bolds exactly these five rows (#1 Umsatz, #2 Soll-/Haben-Kennzeichen, #7 Konto, #8 Gegenkonto, #10 Belegdatum).

Notes:
- DEV's field table uses slightly different labels (e.g. "Umsatz", "Basisumsatz", "Generalumkehr", #103 "Leerfeld — Wird von DATEV verwendet"); the sample's line 2 is the authoritative spelling to copy. Whether the importer validates line-2 titles textually is **UNVERIFIED** → copy `columns-line.txt` verbatim.
- Every data record in the sample has all 125 fields (trailing empty fields written as `;;`).

## 3. Data record field formats (relevant fields)

Regex = DEV (verbatim). Len = PRUEF `Length`/`DecimalPlaces`/`FormatType`.

| # | Field | DEV regex | DEV description (key points) | PRUEF |
|---|---|---|---|---|
| 1 | Umsatz | `^(?!0{1,10}\,00)\d{1,10}\,\d{2}$` | "Betrag muss positiv und darf nicht 0,00 sein." Example `1234567890,12`. → unquoted, **decimal comma, exactly 2 decimals, max 10 integer digits, no thousands separator, no sign** (direction comes from field 2). | Betrag, len 10, 2 dec, Necessary |
| 2 | Soll/Haben-Kennzeichen | `^["](S\|H)["]$` | "bezieht sich auf das Feld #7 Konto"; S = SOLL (default), H = HABEN | Text 1, Necessary |
| 3 | WKZ Umsatz | `^["]([A-Z]{3})["]$` | ISO currency code; "#22 aus Header = default" → may be `""` | Text 3 |
| 4 | Kurs | `^([1-9]\d{0,3}[,]\d{2,6})$` | Only if Umsatz is in foreign currency; then #4, #5, #6 must be given. "Der Wert 0 ist unzulässig." Example `1234,123456` | Zahl 5+6 dec |
| 5 | Basisumsatz | same as #1 | If used, #6 must be filled | Betrag 10/2 |
| 6 | WKZ Basisumsatz | (none given) | ISO code of base currency; paired with #5 | Text 3 |
| 7 | Konto | `^(?!0{1,9}$)(\d{1,9})$` | Sach- oder Personenkonto, unquoted digits, max 8 resp. 9 digits depending on Sachkontenlänge; Personenkonto may be only 1 digit longer than Sachkontenlänge | Konto 9, Necessary |
| 8 | Gegenkonto (ohne BU-Schlüssel) | same as #7 | Sach- oder Personenkonto; BU-Schlüssel is NOT prefixed here, it goes into #9 | Konto 9, Necessary |
| 9 | BU-Schlüssel | `^(["]\d{4}["])$` | "Steuerungskennzeichen zur Abbildung verschiedener Funktionen/Sachverhalte"; link to Steuerschlüssel table | Text, len 4 |
| 10 | Belegdatum | `^(\d{4})$` | "Format: TTMM", e.g. `0105`. "Das Jahr wird immer aus dem Feld #13 des Headers ermittelt." (#13 = WJ-Beginn) — unquoted | Datum, FormatExpression `TTMM`, Necessary |
| 11 | Belegfeld 1 | `^(["][\w$&%*+\-\/]{0,36}["])$` | Rechnungs-/Belegnummer, OPOS-Ausgleichsschlüssel. "Sonderzeichen: $ & % * + - / — Andere Zeichen sind unzulässig (insbesondere Leerzeichen, Umlaute, Punkt, Komma, Semikolon und Doppelpunkt)." **Max 36** | Text 36 |
| 12 | Belegfeld 2 | same charset, `{0,36}` | Belegnummer oder OPOS-Info wie Fälligkeitsdatum (TTMMJJ) | Text **12** (conflict, see UNVERIFIED) |
| 13 | Skonto | `^([1-9]\d{0,7}[,]\d{2})$` | Only for payments; 0 not allowed | Betrag 8/2 |
| 14 | Buchungstext | `^(["].{0,60}["])$` | 0–60 characters, quoted | Text 60 |
| 20 | Beleglink | `^(["].{0,210}["])$` | e.g. `"BEDI ""<GUID>"""` for DATEV Unternehmen online | Text 210 |
| 21/22… | Beleginfo Art/Inhalt | Art `.{0,20}`, Inhalt `.{0,210}` | always fill both | |
| 37/38 | KOST1/KOST2 | `^(["][\w ]{0,36}["])$` | cost centre; length must be configured in KOST | Text 36 |
| 40 | EU-Mitgliedstaat u. UStID (Bestimmung) | `^(["].{0,15}["])$` | 2-letter country (EL Greece, XI N. Ireland) + max 13-char VAT id, e.g. `"DE133546770"` | |
| 43 | Sachverhalt L+L | `^(\d{1,3})$` | Sachverhalte gem. § 13b Abs. 1 und 2 UStG; 0 not allowed; with field 119 if needed | Zahl 3 |
| 114 | Festschreibung | `^(0\|1)$` | "leer = nicht definiert; wird automatisch festgeschrieben; 0 = keine Festschreibung; 1 = Festschreibung. Hat ein Buchungssatz in diesem Feld den Inhalt 1, so wird der gesamte Stapel nach dem Import festgeschrieben." | Zahl 1 |
| 115 | Leistungsdatum | TTMMJJJJ | requires #116; "in Absprache mit dem Steuerberater" | |
| 119 | Steuersatz | `^(\d{1,2}[,]\d{2})$` | only for keys with Steuersatzwahl (e.g. 100, 400) | |
| 120 | Land | `^(["][A-Z]{2}["])$` | with #119 if needed | |

Common text-field rule (DEV Einstieg): text fields in `"`, embedded quotes doubled, **no control characters (e.g. line breaks) inside text fields**.

**Soll/Haben semantics** (DEV #2: "bezieht sich auf das Feld #7 Konto"): `S` = Konto is debited, Gegenkonto credited; `H` = Konto credited, Gegenkonto debited. Official sample rows illustrating this:
- `4979,65;"H";…;8400;30200;"";0902;"201802010"` → revenue 8400 (SKR03, Automatikkonto 19%) credited, debtor 30200 debited, no BU.
- `26,87;"H";…;1000;4930;"9";0102;"";…;"Schreibwaren"` → Konto 1000 credited (cash out), expense 4930 debited with BU 9 (Vorsteuer 19%).
- `2500,00;"S";…;1200;10100;"";0103;"AR-78/13";…;"Bezahlung"` → 1200 debited, debtor 10100 credited (customer payment).
- `1190,00;"H";…;8400;10100;"";1403;"AR2345";…;"Aufteilung AR mit Automatikkonto"` and `600,00;"S";…;8400;8401;"40";…` → BU 40 on an Automatikkonto.
For a bank-statement export the natural mapping is Konto = bank account, `S` = money in, `H` = money out, Gegenkonto = revenue/expense/person account. The SKR bank account numbers themselves (e.g. 1200 SKR03 / 1800 SKR04) were **not** verified in an official source in this pass (UNVERIFIED) — take them from the client's chart.

## 4. File-level rules

| Rule | Value | Source |
|---|---|---|
| Structure | Line 1 header, line 2 column titles, line 3..n data | DEV Einstieg |
| Field separator | `;` | DEV Einstieg ("Alle Datenfelder sind durch ein Semicolon getrennt"); PRUEF `<SeperatorField>;` |
| Text qualifier | `"` — all text fields quoted, embedded `"` doubled | DEV Einstieg; PRUEF `<SeperatorText>"`, `<DoubleTextSeperator>1` |
| Decimal separator | `,`; no thousands separator (except some Deb/Kred master fields) | DEV Einstieg; PRUEF `<DecimalSeperator>,`, empty `<GroupSeperator />` |
| Line ending | **CR/LF** after every line ("Am Ende jeder Zeile muss ein CR/LF gesetzt werden") | DEV Einstieg; sample: 56 lines, all CRLF, file ends with CRLF |
| Encoding | "Der Default-Zeichensatz für den Import nach DATEV Rechnungswesen ist der Standard **ISO-8859-1 bzw. CodePage 1252**. Zusätzlich kann DATEV Rechnungswesen auch die Unicode-Standards (UTF-8, -16, -32) interpretieren, **sofern die ByteOrderMark (BOM, gilt auch für UTF-8) mitgeliefert wird**." "Unicode funktioniert nur über den manuellen Import im DATEV Rechnungswesen oder mittels der Online API accounting:extf-files. Die App KrStaPv … unterstützt kein Unicode." | DEV Zeichensatz; PRUEF `<Coding>ANSI</Coding>` |
| File name | Fixed prefix `EXTF_` (3rd-party) / `DTVF_` (DATEV), extension `.csv`: "Der korrekte Dateiname beginnt mit EXTF_ und endet auf .csv." Example name `EXTF_Buchungsstapel.csv` | DEV Einstieg; HC-1044208 (Ursache 4); HC-1034038; KrStaPv wildcard `-dEXTF*.csv` (HC-9211449) |
| Size limit | max **99.999 Buchungen** per Buchungsstapel file | DEV Formatbeschreibung |
| Period | "Erstellen Sie pro Buchungsperiode eine eigene Text-Datei" (recommendation). Datum von/bis must lie in one Wirtschaftsjahr, Datum von ≥ WJ-Beginn (PRUEF errors above). Belegdatum carries only TTMM; year comes from header | DEV Buchungsstapel; PRUEF |
| Festschreibung | Header #21 default 1 (= festgeschrieben). Stapel with Festschreibung "Ja" can only be un-fixed on import via a logged exception right; KrStaPv import cannot lift it. Any record with #114 = 1 fixes the whole batch | DEV Header/#114; HC-1080697; HC-9211449 |
| No zip | Compressed files are not importable directly | HC-1044208 |

## 5. BU-Schlüssel / Steuerschlüssel (SKR03/SKR04, valid 2026)

Source: HC-0907048 + its xlsx "Verfügbare Steuerschlüssel 2026_SKR03_SKR04" (Stand 29.12.2025). 2026 changes vs 2025: only new keys 391, 396, 783 (none relevant here). 2025 doc (HC-0907054) is archived.

**On the "3–4-digit keys" question:** this is not a 2025 change. HC-0907048 §6.1: "Die dreistelligen / vierstelligen Steuerschlüssel stehen ab dem Wirtschaftsjahr 2018 zur Verfügung … Für jeden einstelligen / zweistelligen Steuerschlüssel gibt es einen dreistelligen / vierstelligen Steuerschlüssel. Eine Mischform … ist möglich. Die Einstellung der ein-/zweistelligen Steuerschlüssel ist derzeit nicht geplant." Recommendation: "Verwenden Sie die drei-/vierstelligen Steuerschlüssel." Column "BU bisher": e.g. "9 = Vorsteuer (voller Steuersatz), 401 = Vorsteuer (voller Steuersatz). Beide Steuerschlüssel können analog verwendet werden."

| Case | 3-digit key (recommended) | old 1–2-digit equivalent ("BU bisher") | UStVA Kz | Function | Comparable Automatikkonto SKR03 / SKR04 |
|---|---|---|---|---|---|
| Vorsteuer 19 % | **401** | **9** | 66 | AV 30001 / AV 30190 | 3400, 3418 / 5400, 5418 |
| Vorsteuer 7 % | **402** | **8** | 66 | AV 30002 / AV 30070 | 3300, 3347 / 5300, 5347 |
| Umsatzsteuer 19 % | **101** | **3** | 81 | AM 80001 / AM 80190 | 8400, 8410 / 4400, 4410 |
| Umsatzsteuer 7 % | **102** | **2** | 86 | AM 80002 / AM 80070 | 8300, 8334 / 4300, 4334 |
| Vorsteuer, Satz wählbar | 400 (+ field 119 Steuersatz) | — | 66 | AV 30xxx | — |
| Umsatzsteuer, Satz wählbar | 100 (+ field 119) | 2,3,4,5 | 81/86/… | AM 80xxx | — |
| § 13b Abs. 1: sonstige Leistung eines EU-Unternehmers, 19 % VSt + 19 % USt (reverse charge, EU services) | **506** | 94 | 46/47/67 | AV 24001 / AV 24190 | 3123 / 5923 |
| same, 7 % | 507 | 91 | 46/47/67 | AV 24002 / AV 24070 | 3113 / 5913 |
| same, without Vorsteuerabzug 19 % | 6506 | 95 | 46/47 | AV 25001 | 3143 / 5943 |
| § 13b Abs. 2 Nr. 1: Leistungen ausländischer (non-EU) Unternehmer 19 % | 511 | 94 | 84/85/67 | AV 36001 | 3125 / 5925 |
| Generic "erhaltene Leistung § 13b, alle Steuertatbestände" 19 % | 94 or 501 | — | 46/73/84/67 | "wählbar" | — (requires Sachverhalt L+L, field 43) |
| Kleinunternehmer § 19 Abs. 1 (revenue, steuerfrei) | 185 | — | 48 | AM 83402 | 8197 / 4184 |

Sachverhalt L+L (field 43) per HC-1003613 §6: with a specific key such as 506/526 it is "Nicht notwendig (Sachverhalt im Steuerschlüssel enthalten)"; it (and field 119 Steuersatz) is needed only for the generic keys with "Steuersatz wählbar"/"alle Steuertatbestände". Value 7 = "Im Inland steuerpflichtige sonstige Leistungen von im übrigen Gemeinschaftsgebiet ansässigen Unternehmern". Steuersatz codes: 0, 5, 7, 16, 19.

**Automatikkonten → no BU-Schlüssel.** HC-0907048 §6.1 "Verwendung": "**Steuerschlüssel können nur in Verbindung mit Konten ohne Automatik-Funktion genutzt werden.**" The xlsx column "Standard-Konto SKR03/SKR04" is described as: "Wenn Sie alternativ zur Nutzung eines Steuerschlüssels ein Konto mit Automatik-Funktion nutzen möchten …". So booking against 8400 (SKR03, AM 80001, USt 19 %) / 4400 (SKR04) means leave BU empty; the tax is computed automatically. To suppress the automatic on such an account use **Buchungsschlüssel 40** ("Aufhebung der Automatik … in Verbindung mit Automatik-Konten (alle AM-Funktionen und AV-Funktionen) zulässig"). The official sample shows both patterns (8400/10100 with BU `""`; 8400/8401 with BU `"40"`). Steuerschlüssel are only allowed for Ist-/Soll-Versteuerung (not "Keine Umsatzsteuerrechnung", error #REW00282).

Other Buchungsschlüssel (prefix digit on the tax key, HC-0907048 §6.2): 5000/5xxx Minderung Bemessungsgrundlage (§17), 6xxx Sachverhalte ohne Vorsteuerabzug (e.g. 6506), 9000/9xxx aufzuteilende Vorsteuer (e.g. 9401). Generalumkehr in the file is field 118, not a BU prefix (the sample also contains "20" on a Berichtigung row).

## 6. Official sample file

Saved byte-identical as `sample-EXTF-Buchungsstapel.csv` (from `Musterdaten_DATEV_Format_0_7f9322b9cc.zip`, member `EXTF_Buchungsstapel.csv`, zip date 2025-06-18). Properties: 56 lines (1 header + 1 titles + 54 records), CRLF everywhere, header 31 fields, every row 125 fields, **encoded UTF-8 without BOM** (contains ä/ö/ü), SKR03, Sachkontenlänge 4.

## 7. UNVERIFIED / conflicts found

1. **Encoding conflict.** DEV says default is CP1252/ISO-8859-1 and Unicode only with a BOM (and never via KrStaPv); PRUEF format says `ANSI`. But DATEV's own sample `EXTF_Buchungsstapel.csv` is UTF-8 **without** BOM (would be mis-read as CP1252 per the doc). Safe choice: write **Windows-1252** (replace/transliterate characters outside CP1252); UTF-8 *with* BOM only if the advisor imports manually. Behaviour of BOM-less UTF-8 is UNVERIFIED.
2. **Mandatory header fields:** DEV promises a marking that is not present. Set of required-for-Buchungsstapel fields (15–22) is inferred from comparing DEV's two example headers; exact importer behaviour per field is UNVERIFIED.
3. **BU-Schlüssel length/format:** DEV regex `^(["]\d{4}["])$` (exactly 4 digits) contradicts the official sample (`"9"`, `"3"`, `"40"`, `"501"`, `"6501"`) and PRUEF (Text, max length 4). Treat as quoted string of 1–4 digits, no zero-padding; whether `"0009"` would be accepted is UNVERIFIED.
4. **Umsatz without decimals:** the sample has one row `64083;"S";…` without `,00`, violating DEV's regex. Always write 2 decimals.
5. **Belegfeld 2 max length:** DEV regex 36 vs PRUEF length 12. Not needed for bank exports; if used, keep ≤ 12.
6. **Belegdatum year for non-calendar fiscal years:** DEV only says the year is taken from header #13 (WJ-Beginn). How TTMM before the WJ start month is resolved is UNVERIFIED — for calendar-year clients a file must not cross 31.12.
7. Whether records with a Belegdatum outside header Datum von/bis are rejected: UNVERIFIED (PRUEF only checks the header dates).
8. Whether the line-2 column titles are validated textually: UNVERIFIED — copy them verbatim from the sample.
9. SKR03/SKR04 bank/cash account numbers (1200/1800 etc.) not verified here.
10. Header #21 Festschreibung value for our export (0 vs 1) is a choice for the Steuerberater, not a format rule; DEV default is 1, and HC-1080697 explains fixed batches can only be un-fixed by a logged exception right — recommending 0 is my suggestion, not a DATEV statement.
