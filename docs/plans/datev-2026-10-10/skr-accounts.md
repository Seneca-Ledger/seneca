# DATEV SKR03 / SKR04 accounts: sources and caveats

## Source / edition
- SKR03: DATEV-Kontenrahmen nach dem Bilanzrichtlinie-Umsetzungsgesetz, Standardkontenrahmen (SKR 03), "Gültig für 2026", Art.-Nr. 11174, footer "2026-01-01" (PDF created 2025-12-22, last modified 2026-06-24). 40 pages.
  https://www.datev.de/content/dam/markenassets/themen-und-produktgruppen/zielgruppen/mandant/unternehmer/branche/bau/11174%20SKR03%20BilrUg.pdf
- SKR04: same series, Art.-Nr. 11175, "Gültig für 2026", footer "2026-01-01" (modified 2026-06-24).
  https://www.datev.de/content/dam/markenassets/themen-und-produktgruppen/zielgruppen/mandant/unternehmer/branche/bau/11175%20SKR04%20BilrUg.pdf
- Both are the "Kostenfreier Download" links on the official shop pages (Stand Januar 2026):
  https://www.datev.de/web/de/shop/produkt-details/kontenrahmen-datev-skr-03-11174 and .../kontenrahmen-datev-skr-04-11175
- Every account number, name and function key in skr-accounts.json was read from these PDFs (pdftotext). None came from memory.

## Function keys (legend on PDF p. 37)
- AV = automatic input-VAT (Vorsteuer) calculation, AM = automatic output-VAT (Umsatzsteuer) calculation. No BU key needed; BU key 4 turns the automatic calculation off.
- S = Sammelkonto, F = Konto mit allgemeiner Funktion, R = reserved. `function` in the JSON holds this prefix and is null when the PDF prints none.
- The AV/AM functions cover the whole printed range, for example AM 8400-09 = 8400..8409.

## Not verified / judgement calls
- VAT rate of the 0% AM accounts (8100/4100, 8192/4184, 8336/4336, 8337/4337): the PDF marks them AM but prints no rate. "0%" is inferred from the account name (steuerfrei, or the recipient owes the VAT). The exact Steuerschlüssel behaviour is in the DATEV document "Steuerschlüssel-Tabelle 2026 - SKR03/SKR04" (Dok.-Nr. 0907055). It could not be fetched because the Hilfe-Center/Wissensplattform is a JavaScript app. UNVERIFIED.
- "laufende EDV-Kosten": no such account in the 2026 standard chart. Closest matches: 4806/6495 Wartungskosten für Hard- und Software, and 4964/6837 Aufwendungen für die zeitlich befristete Überlassung von Rechten (Lizenzen, Konzessionen). For SaaS, which one is right is the tax advisor's call.
- "Einkommensteuer": no dedicated account. The owner's income tax goes to Privatsteuern 1810/2150 (sole-trader-only variant 1811/2151).
- "Sammelkonto / Durchlaufende Posten": 1590/1370 Durchlaufende Posten is a plain account with no S function. In DATEV, "S" (Sammelkonto) marks the VAT accounts (1571/1576/1771/1776 resp. 1401/1406/3801/3806).

## Traps found in the 2026 edition
- 2026 uses "Fahrzeug" in place of "Kfz": 4500/6500 Fahrzeugkosten, 4530/6530 Laufende Fahrzeug-Betriebskosten.
- Footnote 18: 4500/6500 Fahrzeugkosten and 4670/6670 Reisekosten Unternehmer must NOT be used by EÜR filers. Use the specific sub-accounts (4673/4674/4676 resp. 6673/6674/6680; 4530/4580 resp. 6530/6570).
- Footnote 22: the x1 variants (1801/1811/1891 resp. 2101/2151/2181, "nur Einzelunternehmen") may only be used by sole traders since 2019.
- Account 2100 means interest expense in SKR03 but Privatentnahmen in SKR04, so a mapping must never be shared across charts.
- Name differences between the charts: 4855 "Sofortabschreibung ..." vs 6260 "Sofortabschreibungen ..."; 1371 "Verrechnungskonto Gewinnermittlung ..." vs 1486 "Verrechnungskonto für Gewinnermittlung ...".
- The plain Fremdleistungen accounts 3100/5900 have no automatic VAT. The automatic ones are 3106/5906 (AV 19%) and 3108/5908 (AV 7%).
- None of the ordinary expense accounts (rent, phone, office, travel ...) are automatic. They need a BU key for VAT. The key values are not in these PDFs; see Dok.-Nr. 0907055 (UNVERIFIED here).
