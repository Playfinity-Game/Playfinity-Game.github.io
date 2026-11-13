import unittest

from scripts.build_wordfinity_quality_pool import build_word_lists


class WordfinityQualityPoolTests(unittest.TestCase):
    def test_keeps_noun_and_verb_lemmas_only(self):
        rows = [
            "1\tAutos\tN\tNOUN\tAuto\t100",
            "2\tAuto\tN\tNOUN\tAuto\t50",
            "3\tlief\tV\tVERB\tlaufen\t25",
            "4\tlaufen\tV\tVERB\tlaufen\t20",
            "5\tam\tAPPR\tADP\tan\t900",
            "6\tMüller\tNE\tPROPN\tMüller\t800",
            "7\tsupra\tADJ\tADJ\tsupra\t700",
        ]
        nouns, verbs = build_word_lists(rows)
        self.assertEqual(nouns, ["Auto"])
        self.assertEqual(verbs, ["laufen"])

    def test_excludes_manual_words_and_unusual_forms(self):
        rows = [
            "1\tBrötchentaste\tN\tNOUN\tBrötchentaste\t100",
            "2\tAuto-Bahn\tN\tNOUN\tAuto-Bahn\t100",
            "3\tKATZE\tN\tNOUN\tKATZE\t100",
            "4\tgehen\tV\tVERB\tgehen\t100",
        ]
        nouns, verbs = build_word_lists(rows, excluded_words={"brötchentaste"})
        self.assertEqual(nouns, [])
        self.assertEqual(verbs, ["gehen"])

    def test_applies_limits_by_frequency(self):
        rows = [
            "1\tHaus\tN\tNOUN\tHaus\t10",
            "2\tBaum\tN\tNOUN\tBaum\t20",
            "3\tlaufen\tV\tVERB\tlaufen\t30",
            "4\tspringen\tV\tVERB\tspringen\t40",
        ]
        nouns, verbs = build_word_lists(rows, noun_limit=1, verb_limit=1)
        self.assertEqual(nouns, ["Baum"])
        self.assertEqual(verbs, ["springen"])


if __name__ == "__main__":
    unittest.main()
