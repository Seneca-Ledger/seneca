# Anlage EÜR 2025: lines and Kennzahlen (verified against the official BMF PDF)

## Source

- BMF letter of 29.08.2025, "Standardisierte Einnahmenüberschussrechnung nach § 60 Absatz 4 EStDV; Anlage EÜR 2025"
  - Page: https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-08-29-anlage-EUER-2025.html
  - PDF: https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-08-29-anlage-EUER-2025.pdf?__blob=publicationFile&v=3
- From here the live site answers with a Myra "Security Check" (HTTP 503 JS challenge), so I fetched the same file byte for byte from the Wayback Machine:
  http://web.archive.org/web/20250902125104id_/https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-08-29-anlage-EUER-2025.pdf?__blob=publicationFile&v=3
  The Wayback content digest is PF2DFN7X7LLXQLZ5NU3VM3UU744GSODM in every snapshot from 2025-09-02 to 2026-07-27, so the file has not changed since publication.
  PDF metadata: Title "Standardisierte Einnahmenüberschussrechnung nach § 60 Absatz 4 EStDV; Anlage EÜR 2025", Author "Bundesministerium der Finanzen", created 2025-09-01. Local copy sha1: 797432b7f7fad7782f3d6d37566e94ff3869386c (scratchpad/euer2025.pdf, text in euer2025.txt).
- The same PDF holds the form (pages 2025AnlEÜR801–804, "- August 2025 -") and the "Anleitung zur Anlage EÜR - August 2025 - Version 1.9.1.1". The quotes below come from both parts.

## Edition check (the reference lines the code already uses all match this PDF)

Line 12 KZ 111 (Kleinunternehmer), 15/112, 16/103, 17/140, 23/159, 27/100, 29/110, 30/120, 39/150, 43/280, 44/221, 46/194, 54/224, 65 (162/172), 66/163, 75/199, 97/219: all present in the form exactly as listed.

## Findings

### 1. Vom Finanzamt erstattete und ggf. verrechnete Umsatzsteuer: Zeile 18, KZ 141 (VERIFIED)
Form: "18  Vom Finanzamt erstattete und ggf. verrechnete Umsatzsteuer (Die Regelung zum 10-Tageszeitraum - § 11 Abs. 1 Satz 2 EStG - ist zu beachten.)  141"
Anleitung, Zeile 18: "Hier sind die vom Finanzamt erstatteten und ggf. verrechneten Umsatzsteuerbeträge einzutragen. Die entsprechenden erstatteten oder vergüteten steuerlichen Nebenleistungen (Verspätungszuschlag, Säumniszuschlag etc.) sind in Zeile 16 – bei Kleinunternehmern in den Zeilen 12 und 13 – zu erfassen."
It is part of the sum in line 23 (KZ 159).

### 2. Gezahlte Vorsteuerbeträge: Zeile 57, KZ 185 (VERIFIED)
Form: "57  Gezahlte und nach § 15 UStG abziehbare Vorsteuerbeträge  185"
Anleitung, Zeile 57: "Die in Eingangsrechnungen enthaltenen und nach § 15 UStG abziehbaren Vorsteuerbeträge auf die Betriebsausgaben gehören im Zeitpunkt ihrer Bezahlung zu den Betriebsausgaben und sind hier einzutragen. … Aufwendungen, für die der Vorsteuerabzug nach § 15 UStG ausgeschlossen ist, sind nicht hier, sondern mit dem Bruttobetrag in den jeweiligen Betriebsausgabenpositionen einzutragen."

### 3. An das Finanzamt gezahlte und ggf. verrechnete Umsatzsteuer: Zeile 58, KZ 186 (VERIFIED)
Form: "58  An das Finanzamt gezahlte und ggf. verrechnete Umsatzsteuer (Die Regelung zum 10-Tageszeitraum - § 11 Abs. 2 Satz 2 EStG - ist zu beachten.)  186"
Anleitung, Zeile 58: "Die aufgrund der Umsatzsteuervoranmeldungen oder aufgrund der Umsatzsteuerjahreserklärung an das Finanzamt gezahlte und ggf. verrechnete Umsatzsteuer ist hier einzutragen." It also says: "Die Zinsen zur Umsatzsteuer sind in Zeile 56, die übrigen steuerlichen Nebenleistungen (Verspätungszuschlag, Säumniszuschlag etc.) in Zeile 60 zu erfassen."

### 4. Bewirtungsaufwendungen: Zeile 63, KZ 165 (nicht abziehbar) and KZ 175 (abziehbar) (VERIFIED)
Form, section "Beschränkt abziehbare Betriebsausgaben", with column headers "nicht abziehbar | abziehbar":
"63  Bewirtungsaufwendungen  165 [nicht abziehbar]  175 [abziehbar]"
Anleitung, Zeile 63: "Aufwendungen für die Bewirtung von Personen aus geschäftlichem Anlass sind zu 70 % abziehbar und zu 30 % nicht abziehbar. Die hierauf entfallende Vorsteuer ist allerdings abziehbar, soweit die Aufwendungen angemessen und nachgewiesen sind, und insoweit in Zeile 57 zu erfassen."
Note: only the abziehbar column (and lines 64–73) flow into the line 75 total; the left "nicht abziehbar" column is informational. The arithmetic is "Übertrag Zeile 61 + Zeilen 62–73 (abziehbar column) − 74 = 75 / KZ 199".

### 5. Geschenke: Zeile 62, KZ 164 (nicht abziehbar) and KZ 174 (abziehbar) (VERIFIED)
Form: "62  Geschenke  164 [nicht abziehbar]  174 [abziehbar]"
Anleitung, Zeile 62: "Aufwendungen für Geschenke an Personen, die nicht Arbeitnehmer sind (z. B. an Geschäftspartner), und die ggf. darauf entfallende Pauschalsteuer nach § 37b EStG, sind nur dann abzugsfähig, wenn die Anschaffungs- oder Herstellungskosten der dem Empfänger im Gewinnermittlungszeitraum zugewendeten Gegenstände 50 € nicht übersteigen."
General note (Zeilen 62 bis 67): "Sie sind in der Regel in einen nicht abziehbaren und einen abziehbaren Teil aufzuteilen. Die in den Zeilen 62 bis 67 genannten Betriebsausgaben sind auch dann dort einzutragen, wenn diese letztlich vollständig abziehbar oder vollständig nicht abziehbar sind."

### 6. Übrige unbeschränkt abziehbare Betriebsausgaben: Zeile 60, KZ 183 (VERIFIED)
Form: "60  Übrige unbeschränkt abziehbare Betriebsausgaben (auch zurückgezahlte Hilfen/Zuschüsse aufgrund der Corona-Pandemie)  183"
Anleitung, Zeile 60: "Tragen Sie hier die übrigen unbeschränkt abziehbaren Betriebsausgaben ein, soweit diese nicht in den Zeilen 24 bis 59 berücksichtigt worden sind."
Do not confuse it with the group heading "Sonstige unbeschränkt abziehbare Betriebsausgaben" above lines 43–54. That heading has no Kennzahl of its own.

## Traps seen in the same PDF
- The PDF also contains Anlage SE (Sonderbetriebseinnahmen/-ausgaben), where the same items have different line numbers but the same Kennzahlen (e.g. SE line 51 KZ 185, SE line 56 Geschenke KZ 164, SE line 57 Bewirtung KZ 165/175, "Übrige unbeschränkt abziehbare Sonderbetriebsausgaben"). Make sure a text search hits the EÜR page (2025AnlEÜR802/803) and not the SE one.
- Nothing in this file is UNVERIFIED. formulare-bfinv.de was not consulted separately, because the BMF Vordruckmuster is the primary source.
