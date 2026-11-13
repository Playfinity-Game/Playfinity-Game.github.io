# WORDFINITY – Qualitäts-Wortpool

This is a separate review candidate. It does **not** replace `wordfinity-nouns.json`
and is not connected to live game selection.

## Source

- Leipzig Corpora Collection, corpus `deu_news_2023_1M`
- Download: https://downloads.wortschatz-leipzig.de/corpora/deu_news_2023_1M.tar.gz
- Data format: `*_words_pos_base.txt` with word form, Universal POS tag,
  base form and frequency.
- Attribution: Leipzig Corpora Collection, Universität Leipzig.
- License noted by the Leipzig web-service documentation: CC BY 4.0.
  Verify the current download terms and retain attribution when redistributing.

## Selection rules

- Keep only Universal POS tags `NOUN` and `VERB`; proper nouns (`PROPN`)
  and all other word classes are excluded. If UD17 tags are absent, use a
  conservative fallback for common German noun and verb POS tags.
- Use the corpus base form (lemma), aggregating frequencies of inflected forms.
- Keep German alphabetic words only; reject punctuation, digits, multiword entries,
  hyphenated entries and all-uppercase entries.
- Nouns must be capitalized and no longer than 24 characters.
- Verbs are normalized to lowercase infinitive-like lemmas and limited to 22 characters.
- Require at least two corpus occurrences.
- Keep the most frequent 15,000 nouns and 5,000 verbs when available.
- Apply the manually maintained exclusions in `wordfinity-excluded-words.txt`.

## Important quality limitation

Frequency is only a proxy for familiarity. A news corpus can contain specialist
vocabulary, regional words, spelling errors and unusual compounds. This process
reduces low-frequency noise and excludes known unwanted entries, but it cannot
guarantee that every retained word is familiar to every player. The generated file
must be reviewed before any game integration.

## Build and review

Run the GitHub Actions workflow **Build WORDFINITY quality candidate pool**
manually. It downloads the corpus, builds the candidate JSON and uploads it as a
30-day workflow artifact. The existing dictionary and game code are untouched.
