# Output schema (JSON file, one object per country)

{
  "<CC>": {
    "vat": {
      "frequencies": {
        "monthly":   RULE | null,
        "quarterly": RULE | null,
        "annual":    RULE | null
      },
      // how the frequency is decided (turnover / prior-year VAT thresholds), one or two sentences, with numbers
      "frequencyRule": "string | null",
      // does a deadline on a weekend/public holiday move to the next business day by law?
      "shiftsToNextBusinessDay": true | false | null,
      // a standing extension the taxpayer can apply for (e.g. DE Dauerfristverlängerung = +1 month)
      "extension": { "months": number, "name": "string", "note": "string" } | null,
      "returnName": "string",            // e.g. "Umsatzsteuer-Voranmeldung", "JPK_V7M", "Modelo 303"
      "sources": ["https://official-source", ...],
      "unsure": "string | null"          // anything you could not verify
    },
    "incomeTax2026": {                   // tax year 2026, filed in 2027 — self-employed / individuals
      "formName": "string",
      "filingOpens": "YYYY-MM-DD | null",
      "deadlines": [ { "kind": "standard|paper|online|adviser|online_pay_and_file|direct_debit|with_extension", "date": "YYYY-MM-DD" } ],
      "sources": ["..."],
      "unsure": "string | null"
    } | null
  }
}

RULE = {
  "monthsAfterPeriodEnd": number,   // 1 = the month following the period
  "day": number | null,             // day of that month, e.g. 10 / 20 / 25; null if expressed as days instead
  "plusDays": number | null,        // e.g. UK "1 month and 7 days" -> monthsAfterPeriodEnd 1, day null, plusDays 7
  "exceptions": [ { "periodEndMonth": 1-12, "monthsAfterPeriodEnd": number, "day": number } ]  // e.g. ES Q4 -> 30 January
}

Rules:
- Use ONLY official sources (tax authority, ministry, statute, EU Commission/your-europe pages count as secondary).
  Big-4/accounting-firm pages may be used to find the rule but must be confirmed on an official page; if they
  cannot be confirmed, put the value in "unsure" and leave the field null.
- Never fill a date or rule from memory. Null is better than a guess. This data drives reminders users rely on.
- For incomeTax2026: many authorities publish the 2027 calendar late; if the deadline is fixed by statute
  (e.g. "31 July of the following year"), compute the date for 2027 and apply the weekend shift rule if the
  statute says so, and cite the statute. If neither exists, set incomeTax2026 to null.
