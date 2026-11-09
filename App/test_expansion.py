"""Regression coverage for source identities, extraction and repeatable imports."""
import json
import tempfile
import unittest
from pathlib import Path
from expand_library import Expansion, write, classify


class ExpansionChecks(unittest.TestCase):
    def test_source_matching_deduplicates_without_confusing_other_numbered_banks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            p=dict(id='lc-two-sum',number='1',title='Two Sum',difficulty='Easy',topics=['Array'],companies={})
            write(root/'data/catalog.json',dict(problems=[p],resources=[],report={}))
            x=Expansion(root)
            self.assertEqual(x.existing('Two Sum'),p['id'])
            self.assertEqual(x.existing('Solution','','leetcode/Python/0001.py'),p['id'])
            self.assertIsNone(x.existing('Different task','','leetcode/lcof/0001/solution.py'))
            r=dict(id='r1',title='patterns.py',collection='supplied',language='py',company='general')
            write(root/'data/resources/r1.json',dict(text='print("*")',source='supplied/patterns.py'))
            x.resource(r)
            pid=r['questionIds'][0]
            self.assertEqual(x.problems[pid]['recordType'],'code-review')
            self.assertEqual(x.problems[pid]['difficultyBasis'],'Estimated study difficulty')
            self.assertFalse(x.problems[pid].get('runnable',False))
            x.catalog['resources']=[r]
            write(root/'data/catalog.json',dict(problems=list(x.problems.values()),resources=[r],report={}))
            second=Expansion(root);second.resource(r)
            self.assertEqual(r['questionIds'],[pid])
            self.assertEqual(len(second.problems),2)

    def test_questions_in_tables_and_numbered_lists_retain_the_actual_prompt(self):
        x=object.__new__(Expansion)
        rows=x.candidates('| Question | Difficulty | Tags |\n| --- | --- | --- |\n| Explain transactions? | Medium | SQL |\n1. Write a function to reverse a string.\n## What is a shallow copy?\n```python\n# What is fake code?\n```')
        self.assertEqual([q for q,_ in rows],['Explain transactions?','Write a function to reverse a string.','What is a shallow copy?'])

    def test_levels_distinguish_supplied_and_estimated_values(self):
        self.assertEqual(classify('Graph traversal')[1:],('Medium','Estimated study difficulty'))
        self.assertEqual(classify('Graph traversal',explicit='difficulty: Easy')[1:],('Easy','Source supplied'))


if __name__=='__main__': unittest.main()
