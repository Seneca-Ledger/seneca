#!/usr/bin/env python3
"""
Lightweight PDF extractor powered by pdfplumber.
Returns:
{
  "text": "<full document text>",
  "rows": [ { "page": 1, "y": 123.4, "text": "line text", "items": [...] }, ... ],
  "tables": [
    {
      "page": 1,
      "strategy": "lines" | "text",  # how pdfplumber found the table
      "data": [["col1", "col2"], ...],
      "structured": [ { "page": 1, "y": 120.5, "columns": [...], "cells": [{ "text": "...", "x": 10.2 }, ...] } ]
    }
  ]
}
"""

import json
import pathlib
import sys
from typing import List, Dict, Any

try:
    import pdfplumber  # type: ignore
except Exception as exc:  # pragma: no cover - surfaced to caller
    sys.stderr.write(f"pdfplumber is required: {exc}\n")
    sys.exit(1)


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return str(value)
    return str(value).replace("\n", " ").strip()


def is_horizontal(obj: Dict[str, Any]) -> bool:
    """Watermarks and margin notes are printed rotated; table text never is."""
    if obj.get("object_type") != "char":
        return True
    a, b, c, d = (obj.get("matrix") or (1, 0, 0, 1))[:4]
    return abs(b) < 1e-3 and abs(c) < 1e-3 and a > 0 and d > 0


def build_rows(words: List[Dict[str, Any]], page_number: int, tolerance: float = 2.5) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for word in sorted(words, key=lambda w: (float(w.get("top", 0)), float(w.get("x0", 0)))):
        text = normalize_text(word.get("text"))
        if not text:
            continue

        x0 = float(word.get("x0", 0.0))
        x1 = float(word.get("x1", x0))
        top = float(word.get("top", 0.0))
        bottom = float(word.get("bottom", top))

        row = next((r for r in rows if abs(r["y"] - top) <= tolerance), None)
        if row is None:
            row = {"page": page_number, "y": top, "items": []}
            rows.append(row)

        row["items"].append(
            {
                "text": text,
                "x": x0,
                "y": top,
                "width": x1 - x0,
                "height": bottom - top,
                "page": page_number,
            }
        )

    for row in rows:
        row["items"].sort(key=lambda i: i["x"])
        row["text"] = " ".join([i["text"] for i in row["items"] if i.get("text")])

    return sorted(rows, key=lambda r: (r["page"], -r["y"]))


def build_structured_rows(data: List[List[str]], bbox: List[float], page_number: int) -> List[Dict[str, Any]]:
    if not data:
        return []

    max_cols = max(len(row) for row in data) if data else 0
    if max_cols == 0:
        return []

    left, top, right, bottom = bbox
    row_height = (bottom - top) / max(1, len(data))
    col_width = (right - left) / max_cols if max_cols else 0

    structured: List[Dict[str, Any]] = []
    for row_index, row in enumerate(data):
        row_y = bottom - (row_index + 0.5) * row_height if row_height else bottom
        cells = []
        for col_index in range(max_cols):
            cell_text = normalize_text(row[col_index]) if col_index < len(row) else ""
            cell_x = left + (col_index + 0.5) * col_width if col_width else left
            cells.append({"text": cell_text, "x": cell_x})

        structured.append({"page": page_number, "y": row_y, "columns": [normalize_text(c) for c in row], "cells": cells})

    return structured


def extract_tables(page: "pdfplumber.page.Page", page_number: int) -> List[Dict[str, Any]]:
    tables_out: List[Dict[str, Any]] = []
    seen_signatures = set()

    settings_variants = [
        {
          "vertical_strategy": "lines",
          "horizontal_strategy": "lines",
          "snap_tolerance": 3,
          "join_tolerance": 3,
          "edge_min_length": 15,
        },
        {
          "vertical_strategy": "text",
          "horizontal_strategy": "text",
          "snap_tolerance": 3,
          "join_tolerance": 3,
          "edge_min_length": 3,
        },
    ]

    for settings in settings_variants:
        try:
            tables = page.find_tables(table_settings=settings)
        except Exception:
            continue

        for table in tables or []:
            try:
                data = table.extract()
            except Exception:
                continue

            if not data:
                continue

            normalized = [[normalize_text(cell) for cell in (row or [])] for row in data]
            signature = "|".join([",".join(row) for row in normalized])
            if signature in seen_signatures:
                continue
            seen_signatures.add(signature)

            bbox = list(getattr(table, "bbox", [0, 0, page.width, page.height]))
            structured = build_structured_rows(normalized, bbox, page_number)
            tables_out.append({
                "page": page_number,
                "strategy": settings["vertical_strategy"],
                "data": normalized,
                "structured": structured,
            })

    return tables_out


def parse_pdf(file_path: pathlib.Path) -> Dict[str, Any]:
    full_text: List[str] = []
    rows: List[Dict[str, Any]] = []
    tables: List[Dict[str, Any]] = []

    with pdfplumber.open(str(file_path)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text() or ""
            full_text.append(page_text)

            words = page.filter(is_horizontal).extract_words(
                x_tolerance=1.5,
                y_tolerance=2.0,
                keep_blank_chars=False,
                use_text_flow=True,
            ) or []
            rows.extend(build_rows(words, page_number))
            tables.extend(extract_tables(page, page_number))

    return {
        "text": "\n".join(full_text),
        "rows": rows,
        "tables": tables,
    }


def main() -> None:  # pragma: no cover - invoked from Node
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: pdfplumber_parser.py <file_path>\n")
        sys.exit(1)

    file_path = pathlib.Path(sys.argv[1])
    if not file_path.exists():
        sys.stderr.write(f"File not found: {file_path}\n")
        sys.exit(1)

    try:
        result = parse_pdf(file_path)
        json.dump(result, sys.stdout, ensure_ascii=False)
    except Exception as exc:
        sys.stderr.write(f"Failed to parse PDF with pdfplumber: {exc}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
