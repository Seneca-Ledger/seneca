"""Render the invented Hapoalim / Isracard statement pages used by the parser spec.

Every name, number and transaction comes from hapoalim-example.json, which the
spec reads too. The pages copy only the layout HapoalimParser depends on: the
Hebrew section headers, the summary bars and the column order.

Run it inside the backend dev image (it has Pillow and DejaVu Sans, which covers
Hebrew), from the repository root:

  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/repo -w /repo \
    --entrypoint python3 seneca-backend:dev backend/scripts/fixtures/make-hapoalim-example.py

Tesseract is touchy about this layout: without the thin rules between foreign
rows, or with a light summary bar, whole rows come out as noise. Re-run
@tests/integration/hapoalim-parser-test.spec.ts after any change here.
"""

import json
import re
from decimal import Decimal
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
OUT_DIR = HERE.parents[2] / "docs" / "statements-examples" / "hapoalim"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

WIDTH, HEIGHT = 1700, 2560
MARGIN = 60
ROW = 76
INK, MUTED, BAR, PAPER = (20, 20, 20), (90, 90, 90), (85, 85, 85), (250, 250, 247)

HEBREW = re.compile(r"[\u0590-\u05FF]")

# Right edges of the RTL columns, from the date column leftwards (the foreign
# merchant column is a left edge: its Latin names are left-aligned).
FOREIGN_COLS = {"date": 1640, "merchant": 1150, "original": 1120,
                "rateDate": 900, "rate": 740, "commission": 590, "charge": 440}
DOMESTIC_COLS = {"date": 1640, "merchant": 1320, "category": 1000,
                 "amount": 800, "charge": 620, "note": 440}


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def visual(text):
    """Logical Hebrew order to the left-to-right order Pillow draws without raqm."""
    tokens = text.split(" ")
    if not any(HEBREW.search(t) for t in tokens):
        return text
    return " ".join(t[::-1] if HEBREW.search(t) else t for t in reversed(tokens))


class Page:
    def __init__(self):
        self.image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
        self.draw = ImageDraw.Draw(self.image)
        self.y = MARGIN

    def text(self, x, text, size=26, bold=False, align="right", fill=INK, y=None):
        f = font(size, bold)
        shown = visual(text)
        left = x - self.draw.textlength(shown, font=f) if align == "right" else x
        self.draw.text((left, self.y if y is None else y), shown, font=f, fill=fill)

    def pair(self, right, label, value, size=26):
        """A Hebrew label with its value drawn to its left, as on the real form."""
        f = font(size, True)
        shown = visual(label)
        self.text(right, label, size, bold=True)
        self.text(right - self.draw.textlength(shown, font=f) - 14, value, size)

    def rule(self, fill=MUTED, width=2):
        self.draw.line((MARGIN, self.y, WIDTH - MARGIN, self.y), fill=fill, width=width)

    def heading(self, title):
        self.y += 30
        self.text(WIDTH - MARGIN, title, size=40, bold=True)
        self.y += 70

    def summary(self, date, total):
        """The per-date total bar, which the parser skips. A regular-weight label:
        Tesseract reads a bold white 'חיוב' as Latin and the skip marker is lost."""
        self.draw.rectangle((MARGIN, self.y, WIDTH - MARGIN, self.y + 60), fill=BAR)
        y = self.y + 12
        self.text(WIDTH - MARGIN - 20, 'סה"כ חיוב לתאריך', 28, fill=PAPER, y=y)
        self.text(WIDTH - MARGIN - 360, date, 28, True, fill=PAPER, y=y)
        self.text(MARGIN + 380, money(total), 28, True, fill=PAPER, y=y)
        self.y += 90


def money(value):
    return f"{value:,.2f}"


def total(rows):
    return sum(Decimal(r["charge"].replace(",", "")) for r in rows)


def draw_header(page, data):
    page.text(WIDTH - MARGIN, "בנק הפועלים", size=52, bold=True)
    page.text(MARGIN, "ישראכרט", size=52, bold=True, align="left")
    page.y += 90
    page.text(WIDTH - MARGIN, f"•{data['cardEnding']}", size=30)
    page.y += 70
    page.text(WIDTH - MARGIN, "לכבוד", size=26)
    page.y += 40
    page.text(WIDTH - MARGIN, data["holder"], size=26)
    page.text(MARGIN, "www.isracard.co.il", size=30, bold=True, align="left")
    page.y += 70
    page.pair(WIDTH - MARGIN, "פרוט פעולותיך לתאריך:", data["billingDate"])
    page.y += 44
    page.text(WIDTH - MARGIN, "סוג כרטיס: מסטרקארד", size=26)
    page.y += 44
    page.pair(WIDTH - MARGIN, "מספר חשבון לחיוב במטבע ישראלי:", data["accountNumber"])
    page.y += 50


def draw_continuation_header(page, data):
    page.text(MARGIN, "ישראכרט", size=52, bold=True, align="left")
    page.pair(WIDTH - MARGIN, "מספר חשבון:", data["accountNumber"])
    page.y += 90


def draw_foreign(page, rows):
    c = FOREIGN_COLS
    page.heading('רכישות בחו"ל')
    for key, label in (("date", "תאריך"), ("merchant", "שם בית העסק"), ("original", "סכום מקורי"),
                       ("rateDate", "תאריך המרה"), ("rate", "שער המרה"),
                       ("commission", "סכום עמלה"), ("charge", "סכום החיוב")):
        x = c[key] + 290 if key == "merchant" else c[key]
        page.text(x, label, size=22, bold=True, fill=MUTED)
    page.y += 44
    page.rule()
    page.y += 14
    for r in rows:
        page.text(c["date"], r["date"])
        page.text(c["merchant"], r["merchant"], align="left")
        page.text(c["original"], r["original"])
        page.text(c["rateDate"], r["rateDate"])
        page.text(c["rate"], r["rate"])
        page.text(c["commission"], "0.00")
        page.text(c["charge"], r["charge"])
        page.text(c["merchant"], r["city"], size=22, align="left", fill=MUTED, y=page.y + 32)
        page.y += ROW
        page.rule(width=1)
        page.y += 10
    page.y += 10
    page.summary("11/01/26", total(rows))


def draw_domestic(page, rows):
    c = DOMESTIC_COLS
    page.heading("עסקות שחויבו / זוכו - בארץ")
    for key, label in (("date", "תאריך עסקה"), ("merchant", "שם בית עסק"), ("category", "ענף"),
                       ("amount", "סכום עסקה"), ("charge", "סכום החיוב"), ("note", "פירוט נוסף")):
        page.text(c[key], label, size=22, bold=True, fill=MUTED)
    page.y += 44
    page.rule()
    page.y += 14
    for r in rows:
        page.text(c["date"], r["date"])
        page.text(c["merchant"], r["merchant"])
        page.text(c["category"], r["category"])
        page.text(c["amount"], r["amount"])
        page.text(c["charge"], r["charge"])
        if r.get("note"):
            page.text(c["note"], r["note"])
        page.y += 54
    page.y += 10
    page.summary("11/01/26", total(rows))


def draw_credit_terms(page):
    page.heading("מסגרת הכרטיס ותנאי האשראי")
    page.text(WIDTH - MARGIN, "מסגרת הכרטיס משותפת לכל השימושים בארץ ובחו\"ל", size=24)


def render(name, spec, data):
    page = Page()
    if spec["page"] == 1:
        draw_header(page, data)
    else:
        draw_continuation_header(page, data)
    draw_foreign(page, spec["foreign"])
    if spec["domestic"]:
        draw_domestic(page, spec["domestic"])
        draw_credit_terms(page)
    page.y = HEIGHT - MARGIN - 30
    page.text(MARGIN, f"עמוד {spec['page']} מתוך 2", size=22, align="left", fill=MUTED)
    page.image.save(OUT_DIR / name, "JPEG", quality=85)


def main():
    data = json.loads((HERE / "hapoalim-example.json").read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, spec in data["pages"].items():
        render(name, spec, data)
        print(f"wrote {OUT_DIR / name}")


if __name__ == "__main__":
    main()
