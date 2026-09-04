#!/usr/bin/env python3
"""Combine BirdNET3_geomodel_labels.csv with translated names from taxonomy.csv.

Usage:
    python3 combine_labels.py [taxonomy.csv] [BirdNET+_V3.0-preview3.1_Global_11K_Labels.csv] [BirdNET3_geomodel_labels.csv]

With no arguments, the three filenames above are resolved in the current
working directory. Inputs are comma-delimited UTF-8 CSV files
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path


DEFAULTS = (
    Path("taxonomy.csv"),
    Path("BirdNET+_V3.0-preview3.1_Global_11K_Labels.csv"),
    Path("BirdNET3_geomodel_labels.csv"),
)


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    """Read a UTF-8 CSV and normalize missing fields to empty strings."""
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            raise ValueError(f"{path} has no header row")
        headers = reader.fieldnames
        return headers, [
            {header: row.get(header) or "" for header in headers}
            for row in reader
        ]


def first_by(rows: list[dict[str, str]], column: str) -> dict[str, dict[str, str]]:
    """Index nonblank values, retaining the first taxonomy occurrence."""
    result: dict[str, dict[str, str]] = {}
    for row in rows:
        value = row[column]
        if value and value not in result:
            result[value] = row
    return result


def main(argv: list[str]) -> int:
    if len(argv) not in (1, 4):
        print(__doc__.strip(), file=sys.stderr)
        return 2

    taxonomy_path, labels_path, output_path = (
        DEFAULTS if len(argv) == 1 else tuple(Path(arg) for arg in argv[1:])
    )
    taxonomy_headers, taxonomy_rows = read_csv(taxonomy_path)
    labels_headers, label_rows = read_csv(labels_path)

    required_taxonomy = {"sci_name", "com_name", "class_name"}
    required_labels = {"sci_name", "com_name"}
    missing = (required_taxonomy - set(taxonomy_headers)) | (
        required_labels - set(labels_headers)
    )
    if missing:
        raise ValueError("Missing required column(s): " + ", ".join(sorted(missing)))

    locale_headers = [
        header for header in taxonomy_headers if header.startswith("common_name_")
    ]
    output_headers = ["sci_name", "com_name", "class_name", *locale_headers]
    taxonomy_by_sci = first_by(taxonomy_rows, "sci_name")
    taxonomy_by_com = first_by(taxonomy_rows, "com_name")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sci_matches = com_matches = unmatched = 0
    with output_path.open("w", encoding="utf-8", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=output_headers)
        writer.writeheader()
        for label in label_rows:
            match = taxonomy_by_sci.get(label["sci_name"])
            if match is not None:
                sci_matches += 1
            else:
                match = taxonomy_by_com.get(label["com_name"])
                if match is not None:
                    com_matches += 1

            if match is None:
                unmatched += 1
                output = {
                    "sci_name": label["sci_name"],
                    "com_name": label["com_name"],
                    "class_name": "",
                    **{header: "" for header in locale_headers},
                }
            else:
                output = {header: match[header] for header in output_headers}
            writer.writerow(output)

    print(
        f"Wrote {len(label_rows)} rows to {output_path} "
        f"({sci_matches} scientific-name matches, {com_matches} common-name matches, "
        f"{unmatched} unmatched)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
