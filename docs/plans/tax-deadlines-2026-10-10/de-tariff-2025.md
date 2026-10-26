# § 32a Abs. 1 EStG: tariff for VZ 2025 (and check of VZ 2026)

Checked 2026-10-10. Sources used are official only: the Federal Law Gazette (BGBl.), gesetze-im-internet.de and BMF/ITZBund.

## Sources

1. **BGBl. 2024 I Nr. 449**: Steuerfortentwicklungsgesetz (SteFeG), dated 23.12.2024, published 30.12.2024.
   - Page: https://www.recht.bund.de/bgbl/1/2024/449/VO.html (ELI: https://www.recht.bund.de/eli/bund/bgbl-1/2024/449)
   - PDF: https://www.recht.bund.de/bgbl/1/2024/449/regelungstext.pdf?__blob=publicationFile&v=1
     The downloaded PDF's MD5 is `b0dd71ec6981b00c33f7b13ed095cf43`, the same hash the BGBl page publishes.
   - Art. 1 No. 2 sets § 32a Abs. 1 for VZ 2025 onward. Art. 2 No. 2 replaces it for VZ 2026 onward.
   - Art. 10: "(1) Dieses Gesetz tritt vorbehaltlich des Absatzes 2 am 1. Januar 2025 in Kraft. (2) Die Artikel 2, 4 und 6 treten am 1. Januar 2026 in Kraft."
2. **gesetze-im-internet.de, current § 32a**: https://www.gesetze-im-internet.de/estg/__32a.html
   The current text reads "ab dem Veranlagungszeitraum 2026" and is identical to SteFeG Art. 2. The site keeps only the current version and offers no historical versions, so the 2025 text comes from the BGBl.
3. **BMF/ITZBund Lohnsteuer pseudo-code (PAP as XML)** on the BMF calculator site:
   - 2025: https://www.bmf-steuerrechner.de/javax.faces.resource/daten/xmls/Lohnsteuer2025.xml.xhtml ("Stand: 2025-09-17 13:05", method `UPTAB25`, `GFB = new BigDecimal(12096)`)
   - 2026: https://www.bmf-steuerrechner.de/javax.faces.resource/daten/xmls/Lohnsteuer2026.xml.xhtml ("Stand: 2025-10-23 12:40", method `UPTAB26`, `GFB = BigDecimal.valueOf(12348)`)
   - The BMF PDF PAPs (e.g. `.../Programmablaufplan/2025-01-22-geaenderte-PAP-2025-anlage-1.pdf`) could not be downloaded: bundesfinanzministerium.de returns 503 "Security Check" to scripted requests. The XML above is the machine-readable form of the same PAP.

## VZ 2025: quoted statutory text (BGBl. 2024 I Nr. 449, Art. 1 No. 2)

> „(1) Die tarifliche Einkommensteuer bemisst sich nach dem auf volle Euro abgerundeten zu versteuernden
> Einkommen. Sie beträgt ab dem Veranlagungszeitraum 2025 vorbehaltlich der §§ 32b, 32d, 34, 34a, 34b und 34c
> jeweils in Euro für zu versteuernde Einkommen
> 1. bis 12 096 Euro (Grundfreibetrag):
>    0;
> 2. von 12 097 Euro bis 17 443 Euro:
>    (932,30 • y + 1 400) • y;
> 3. von 17 444 Euro bis 68 480 Euro:
>    (176,64 • z + 2 397) • z + 1 015,13;
> 4. von 68 481 Euro bis 277 825 Euro:
>    0,42 • x – 10 911,92;
> 5. von 277 826 Euro an:
>    0,45 • x – 19 246,67.
> Die Größe „y“ ist ein Zehntausendstel des den Grundfreibetrag übersteigenden Teils des auf einen vollen Euro-
> Betrag abgerundeten zu versteuernden Einkommens. Die Größe „z“ ist ein Zehntausendstel des 17 443 Euro
> übersteigenden Teils des auf einen vollen Euro-Betrag abgerundeten zu versteuernden Einkommens. Die Größe
> „x“ ist das auf einen vollen Euro-Betrag abgerundete zu versteuernde Einkommen. Der sich ergebende
> Steuerbetrag ist auf den nächsten vollen Euro-Betrag abzurunden.“

### VZ 2025 in the `TariffYear` structure of tariff.ts

```ts
2025: {
  zone1End: 12_096,
  zone2End: 17_443,
  zone3End: 68_480,
  zone4End: 277_825,
  zone2: { a: 932.3, b: 1_400 },
  zone3: { a: 176.64, b: 2_397, c: 1_015.13 },
  zone4: { rate: 0.42, minus: 10_911.92 },
  zone5: { rate: 0.45, minus: 19_246.67 },
},
```

| Parameter | Value | Status |
|---|---|---|
| Grundfreibetrag (zone1End) | 12,096 | verified: BGBl Art. 1, PAP `GFB = 12096` |
| zone2End | 17,443 | verified: BGBl, PAP `X < 17444` |
| zone2 a / b | 932.30 / 1,400 | verified: BGBl, PAP |
| zone3End | 68,480 | verified: BGBl, PAP `X < 68481` |
| zone3 a / b / c | 176.64 / 2,397 / 1,015.13 | verified: BGBl, PAP |
| zone4End | 277,825 | verified: BGBl, PAP `X < 277826` |
| zone4 rate / minus | 0.42 / 10,911.92 | verified: BGBl, PAP |
| zone5 rate / minus | 0.45 / 19,246.67 | verified: BGBl, PAP |
| y base | Grundfreibetrag (12,096) | verified: BGBl |
| z base | 17,443 | verified: BGBl, PAP |
| Rounding | taxable income rounded down to a full euro first; the resulting tax rounded down to a full euro | verified: BGBl sentences 1, 3–6 |

All values you listed (932.30 / 1,400 / 176.64 / 2,397 / 1,015.13 / 0.42 / 10,911.92 / 0.45 / 19,246.67) are correct.

Is anything later in force for VZ 2025? `gesetze-im-internet.de/estg/__52.html` has no special application rule that changes the 2025 tariff. § 52 Abs. 32a only covers the December 2024 catch-up in payroll withholding. The BMF PAP 2025, last updated 2025-09-17, still uses exactly these figures. The current § 32a text is SteFeG Art. 2 unchanged, so no later law amended Abs. 1.

## VZ 2026: check of tariff.ts

Quoted from gesetze-im-internet.de (current text), identical to SteFeG Art. 2 No. 2:

> 1. bis 12 348 Euro (Grundfreibetrag): 0; 2. von 12 349 Euro bis 17 799 Euro: (914,51 • y + 1 400) • y;
> 3. von 17 800 Euro bis 69 878 Euro: (173,10 • z + 2 397) • z + 1 034,87; 4. von 69 879 Euro bis 277 825 Euro:
> 0,42 • x – 11 135,63; 5. von 277 826 Euro an: 0,45 • x – 19 470,38. … Die Größe „z“ ist ein Zehntausendstel
> des 17 799 Euro übersteigenden Teils …

tariff.ts has 12,348 / 17,799 / 69,878 / 277,825, 914.51 / 1,400, 173.1 / 2,397 / 1,034.87, 0.42 / 11,135.63 and 0.45 / 19,470.38. **Every value matches.** The BMF PAP 2026 (`UPTAB26`) agrees as well.

## Implementation notes

- **Intermediate rounding:** The BMF PAP truncates y and z to 6 decimals (`divide(ZAHL10000, 6, ROUND_DOWN)`). The statute has no such step, and tariff.ts does not have it either. Because x is a whole euro, x/10,000 has at most 4 decimals, so the truncation never changes anything.
- **Exhaustive check** (Python, exact `Fraction` arithmetic versus the JS-style float formula in tariff.ts versus the PAP-style truncation), for every whole-euro x from 0 to 400,000, both years: **0 differences**. Float plus `Math.floor` is safe for both years.
- **Sample values (VZ 2025):** 20,000 → 1,639; 50,000 → 10,691; 100,000 → 31,088; 300,000 → 115,753.
- **Sample values (VZ 2026):** 20,000 → 1,570; 50,000 → 10,548; 100,000 → 30,864; 300,000 → 115,529.
- **Zone boundaries (2025):** 17,443 → 1,015 and 17,444 → 1,015; 68,480 → 17,849 and 68,481 → 17,850. The tax is continuous at the boundaries, which supports the coefficients.
