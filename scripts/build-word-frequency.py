#!/usr/bin/env python3
"""Regenerate src/data/word-frequency.tsv from wordfreq's Bengali data.

Setup:  python3 -m pip install wordfreq==3.1.1
Run:    python3 scripts/build-word-frequency.py

The output is a sorted `word<TAB>zipf` table. zipf is log10(probability) + 9.
Only words at or above FLOOR ship: at 4.0 that is about 9,500 words and
52 KB gzipped, and it gives the same ranking quality as the full table.

wordfreq code is Apache-2.0; its data is CC BY-SA 4.0. See
public/licenses/wordfreq.md before changing the source or floor.
"""

import math
import unicodedata
from pathlib import Path

from wordfreq import get_frequency_dict

FLOOR = 4.0
OUTPUT = Path(__file__).resolve().parents[1] / "src" / "data" / "word-frequency.tsv"


def main() -> None:
    table: dict[str, float] = {}
    for raw_word, probability in get_frequency_dict("bn").items():
        if probability <= 0:
            continue
        score = math.log10(probability) + 9
        if score < FLOOR:
            continue
        word = unicodedata.normalize("NFC", raw_word)
        table[word] = max(table.get(word, 0.0), score)

    rows = sorted(table.items(), key=lambda item: (-item[1], item[0]))
    OUTPUT.write_text(
        "".join(f"{word}\t{score:.2f}\n" for word, score in rows),
        encoding="utf-8",
    )
    print(f"wrote {len(rows)} words to {OUTPUT.relative_to(OUTPUT.parents[2])}")


if __name__ == "__main__":
    main()
