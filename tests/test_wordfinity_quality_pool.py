import unittest

from scripts.build_wordfinity_quality_pool import build_word_lists, merge_spelling_variants


class WordfinityQualityPoolTests(unittest.TestCase):
    def test_keeps_common_noun_lemmas_only(self):
        rows = [
            "1\tAutos\tN\tNOUN\tAuto\t100",
            "2\tAuto\tN\tNOUN\tAuto\t50",
            "3\tlief\tV\tVERB\tlaufen\t250",
            "4\tMüller\tNE\tPROPN\tMüller\t800",
            "5\tsupra\tADJ\tADJ\tsupra\t700",
        ]
        self.assertEqual(build_word_lists(rows), ["Auto"])

    def test_supports_leipzig_files_without_ud17_column(self):
        rows = [
            "1\tHäuser\tNN\tHaus\t80",
            "2\tging\tVVFIN\tgehen\t60",
            "3\tMüller\tNE\tMüller\t50",
        ]
        self.assertEqual(build_word_lists(rows), ["Haus"])

    def test_strictly_excludes_rare_and_unusual_forms(self):
        rows = [
            "1\tBrötchentaste\tN\tNOUN\tBrötchentaste\t100",
            "2\tAuto-Bahn\tN\tNOUN\tAuto-Bahn\t100",
            "3\tKATZE\tN\tNOUN\tKATZE\t100",
            "4\tHaus\tN\tNOUN\tHaus\t4",
            "5\tBaum\tN\tNOUN\tBaum\t5",
        ]
        self.assertEqual(build_word_lists(rows, excluded_words={"brötchentaste"}), ["Baum"])

    def test_applies_limits_by_frequency(self):
        rows = [
            "1\tHaus\tN\tNOUN\tHaus\t10",
            "2\tBaum\tN\tNOUN\tBaum\t20",
        ]
        self.assertEqual(build_word_lists(rows, noun_limit=1), ["Baum"])

    def test_normalizes_known_spellings_without_merging_distinct_words(self):
        merged = merge_spelling_variants({"Strasse": 3, "Straße": 4, "Masse": 8, "Maße": 7})
        self.assertEqual(merged["Straße"], 7)
        self.assertEqual(merged["Masse"], 8)
        self.assertEqual(merged["Maße"], 7)


if __name__ == "__main__":
    unittest.main()
