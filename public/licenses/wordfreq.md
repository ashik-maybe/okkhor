# Word frequency data

`src/data/word-frequency.tsv` is derived from the Bengali (`bn`) frequency
data in [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1. It was generated
with `python3 scripts/build-word-frequency.py`, which keeps words with a zipf
score of 4.0 or higher and writes `word<TAB>zipf`.

wordfreq's Python code is licensed under Apache License 2.0. Its frequency
data is licensed under **Creative Commons Attribution-ShareAlike 4.0
International** (https://creativecommons.org/licenses/by-sa/4.0/). The derived
table in this repository is shared under that same CC BY-SA 4.0 licence. This
licence applies to the data file only; it does not change the licence of the
application code, which is tracked separately in `README.md`.

Source: Robyn Speer, wordfreq — https://github.com/rspeer/wordfreq
