#!/usr/bin/env python3
"""
Anonymize a text-layer bank statement PDF for the golden corpus.

Rewrites the text inside the PDF's content streams and keeps everything else
(page geometry, fonts, table rulings) as the bank produced it, so a parser
sees the same layout it would see in the real file:

  * every run of --min-digits or more digits (account numbers, IIN/BIN, card
    numbers) is replaced by digits derived from a salted hash of the run, so
    the same number maps to the same replacement everywhere in the file;
  * each --replace OLD=NEW pair swaps names and other identifying text.

Only glyphs already embedded in the PDF's font subsets can be written, so a
replacement that needs a missing letter fails loudly instead of rendering as
garbage. Amounts, dates and balances are left alone: they are what the golden
test checks.

Requires the `qpdf` CLI (12+). Usage:

  python3 scripts/anonymize_statement_pdf.py in.pdf out.pdf \
      --replace "Иванов=Петров" --replace "*3454=*7781"
  python3 scripts/anonymize_statement_pdf.py in.pdf --dump   # list text runs
"""

import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

TOKEN_RE = re.compile(
    rb"(/[^\s/<>\[\]()]+)\s+[-\d.]+\s+Tf"  # font selection
    rb"|<([0-9A-Fa-f\s]*)>"  # hex string
    rb"|\(((?:\\.|[^\\)])*)\)",  # literal string
    re.S,
)
DIGIT_RUN_RE = re.compile(r"\d+")


def run_qpdf_json(pdf: Path) -> dict:
    out = subprocess.run(
        ["qpdf", "--json=2", "--json-stream-data=inline", "--decode-level=generalized", str(pdf), "-"],
        check=True,
        capture_output=True,
    )
    return json.loads(out.stdout)


def stream_bytes(obj: dict) -> bytes:
    return base64.b64decode(obj["stream"]["data"])


def set_stream_bytes(obj: dict, data: bytes) -> None:
    obj["stream"]["data"] = base64.b64encode(data).decode("ascii")
    obj["stream"]["dict"].pop("/Filter", None)
    obj["stream"]["dict"].pop("/DecodeParms", None)


def parse_cmap(data: bytes) -> dict:
    """ToUnicode CMap → {glyph code (int): unicode str}."""
    text = data.decode("latin-1")
    mapping: dict = {}
    for block in re.findall(r"beginbfchar(.*?)endbfchar", text, re.S):
        for src, dst in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            mapping[int(src, 16)] = bytes.fromhex(dst).decode("utf-16-be")
    for block in re.findall(r"beginbfrange(.*?)endbfrange", text, re.S):
        for lo, hi, dst in re.findall(
            r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])", block
        ):
            lo_i, hi_i = int(lo, 16), int(hi, 16)
            if dst.startswith("["):
                for offset, item in enumerate(re.findall(r"<([0-9A-Fa-f]+)>", dst)):
                    mapping[lo_i + offset] = bytes.fromhex(item).decode("utf-16-be")
            else:
                base = bytes.fromhex(dst[1:-1]).decode("utf-16-be")
                for offset in range(hi_i - lo_i + 1):
                    mapping[lo_i + offset] = base[:-1] + chr(ord(base[-1]) + offset)
    return mapping


class Font:
    def __init__(self, cmap: dict | None):
        self.forward = cmap or {}
        self.reverse = {v: k for k, v in self.forward.items() if len(v) == 1}
        self.two_byte = cmap is not None

    def decode(self, raw: bytes) -> str | None:
        if not self.two_byte:
            return raw.decode("cp1252", errors="replace")
        if len(raw) % 2:
            return None
        codes = [int.from_bytes(raw[i : i + 2], "big") for i in range(0, len(raw), 2)]
        if any(code not in self.forward for code in codes):
            return None
        return "".join(self.forward[code] for code in codes)

    def encode(self, text: str) -> bytes:
        if not self.two_byte:
            return text.encode("cp1252")
        missing = sorted({ch for ch in text if ch not in self.reverse})
        if missing:
            raise ValueError(f"glyphs not embedded in this font: {''.join(missing)!r}")
        return b"".join(self.reverse[ch].to_bytes(2, "big") for ch in text)


def unescape_literal(raw: bytes) -> bytes:
    return re.sub(rb"\\([nrtbf()\\])", lambda m: {b"n": b"\n", b"r": b"\r", b"t": b"\t", b"b": b"\b", b"f": b"\f"}.get(m.group(1), m.group(1)), raw)


def escape_literal(raw: bytes) -> bytes:
    return raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path, nargs="?")
    parser.add_argument("--replace", action="append", default=[], metavar="OLD=NEW")
    parser.add_argument("--min-digits", type=int, default=9)
    parser.add_argument("--salt", default="lumio-golden")
    parser.add_argument("--dump", action="store_true", help="print decoded text runs and exit")
    args = parser.parse_args()

    replacements = []
    for pair in args.replace:
        old, sep, new = pair.partition("=")
        if not sep or not old:
            parser.error(f"--replace expects OLD=NEW, got {pair!r}")
        replacements.append((old, new))

    doc = run_qpdf_json(args.input)
    objects = doc["qpdf"][1]

    def resolve(ref):
        return objects.get(f"obj:{ref}") if isinstance(ref, str) and ref.endswith(" R") else None

    def as_dict(value):
        if isinstance(value, dict):
            return value
        target = resolve(value)
        return (target or {}).get("value", {}) if target else {}

    fonts_by_ref: dict = {}

    def font_for(ref: str) -> Font:
        if ref not in fonts_by_ref:
            font_obj = resolve(ref) or {}
            to_unicode = resolve(font_obj.get("value", {}).get("/ToUnicode"))
            fonts_by_ref[ref] = Font(parse_cmap(stream_bytes(to_unicode)) if to_unicode else None)
        return fonts_by_ref[ref]

    pages = [obj["value"] for obj in objects.values() if isinstance(obj.get("value"), dict) and obj["value"].get("/Type") == "/Page"]
    jobs = []  # (content stream object, {font name: Font})
    for page in pages:
        font_refs = as_dict(as_dict(page.get("/Resources")).get("/Font"))
        fonts = {name.encode(): font_for(ref) for name, ref in font_refs.items()}
        contents = page.get("/Contents")
        for ref in contents if isinstance(contents, list) else [contents]:
            jobs.append((resolve(ref), fonts))

    def text_runs(data: bytes, fonts: dict):
        """Yields (match, font, decoded text) for every string drawn in a content stream."""
        current = Font(None)
        for m in TOKEN_RE.finditer(data):
            if m.group(1) is not None:
                current = fonts.get(m.group(1), Font(None))
                continue
            raw = (
                bytes.fromhex(re.sub(rb"\s", b"", m.group(2)).decode())
                if m.group(2) is not None
                else unescape_literal(m.group(3))
            )
            text = current.decode(raw)
            if text:
                yield m, current, text

    if args.dump:
        for stream_obj, fonts in jobs:
            for _, _, text in text_runs(stream_bytes(stream_obj), fonts):
                print(repr(text))
        return 0

    # One digit pool for the whole file, so a number printed in two fonts (an
    # account in the header and again in a purpose) gets one replacement. Only
    # fonts that actually draw long numbers count: a font embedding just a page
    # number's "1" would otherwise shrink the pool to a single digit.
    pool = set("0123456789")
    for stream_obj, fonts in jobs:
        for _, font, text in text_runs(stream_bytes(stream_obj), fonts):
            if font.two_byte and any(len(run) >= args.min_digits for run in DIGIT_RUN_RE.findall(text)):
                pool &= {d for d in "0123456789" if d in font.reverse}
    pool = sorted(pool)
    if len(pool) < 2:
        print("fonts share fewer than two digit glyphs; cannot scramble numbers", file=sys.stderr)
        return 1

    def scramble(match: re.Match) -> str:
        run = match.group(0)
        if len(run) < args.min_digits:
            return run
        digest = hashlib.sha256(f"{args.salt}:{run}".encode()).digest()
        return "".join(pool[digest[i % len(digest)] % len(pool)] for i in range(len(run)))

    def transform(text: str) -> str:
        for old, new in replacements:
            text = text.replace(old, new)
        return DIGIT_RUN_RE.sub(scramble, text)

    changed = 0
    for stream_obj, fonts in jobs:
        data = stream_bytes(stream_obj)
        out, last = [], 0
        for m, font, text in text_runs(data, fonts):
            new_text = transform(text)
            if new_text == text:
                continue
            try:
                encoded = font.encode(new_text)
            except ValueError as error:
                print(f"cannot write {new_text!r}: {error}", file=sys.stderr)
                return 1
            out.append(data[last : m.start()])
            out.append(b"<" + encoded.hex().encode() + b">" if m.group(2) is not None else b"(" + escape_literal(encoded) + b")")
            last = m.end()
            changed += 1
        out.append(data[last:])
        set_stream_bytes(stream_obj, b"".join(out))

    if not args.output:
        parser.error("output path is required unless --dump is given")

    info = resolve(doc["qpdf"][1].get("trailer", {}).get("value", {}).get("/Info"))
    if info:
        for key in ("/Author", "/Title", "/Subject", "/Keywords"):
            info["value"].pop(key, None)

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tmp:
        json.dump(doc, tmp)
    subprocess.run(["qpdf", "--json-input", tmp.name, str(args.output)], check=True)
    Path(tmp.name).unlink()
    print(f"rewrote {changed} text runs → {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
