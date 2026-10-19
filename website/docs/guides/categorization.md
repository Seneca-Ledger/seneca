---
title: Categorization
description: How Lumio assigns categories without an external model
---

Lumio categorizes transactions deterministically, on your own server. No external model is
contacted at any step.

## The chain

Each imported row goes through these steps, and the first one that answers wins:

1. **Your rules**, in priority order. A rule you wrote is an explicit instruction and is never
   replaced by anything later in the chain.
2. **Payee history.** Lumio keeps payees with their aliases and learns a default category from the
   rows you confirmed. The default only moves when two of the three most recent confirmed
   transactions agree on a different category, so one odd purchase does not refile every later
   one. A payee can also be pinned to a category (*always*) or excluded from learning (*never*).
3. **Uncategorized.** Anything left lands in *Uncategorized* and shows up in **Review**.

No category is guessed from words in a bank descriptor: those match category names by accident
too often to be trusted.

Learning from corrections can be switched off under **Settings → Data → Processing** (*Learn from
my corrections*).

## Local categorization

**Integrations → Local categorization** installs a Transformers.js embedding model on the server
(upload a ZIP with `config.json` and an ONNX file; the default model id is
`Xenova/paraphrase-multilingual-MiniLM-L12-v2`) and lets you test merchant names against a list
of categories with a similarity threshold. Remote model loading is disabled: the model runs from
the uploaded files and sends nothing out.

Next: [Receipt Maps](receipt-maps)
