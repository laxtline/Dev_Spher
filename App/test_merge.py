import contextlib, io, json, tempfile, unittest
from pathlib import Path
from merge_packs import Merger, atomic

class MergeChecks(unittest.TestCase):
    def test_merge_matching_dedup_and_preservation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); data=root/'data'; source=root/'new'; repo=source/'archive'
            problem=lambda slug,n,title:{'id':'lc-'+slug,'number':str(n),'slug':slug,'title':title,'url':'https://leetcode.com/problems/'+slug,'difficulty':'Easy','acceptance':'','companies':{'google':{'frequency':50,'periods':['all']}},'topics':[],'description':False,'solutions':0}
            atomic(data/'catalog.json',{'problems':[problem('two-sum',1,'Two Sum'),problem('single-number',136,'Single Number')],'companies':[{'slug':'google','count':2}],'resources':[],'report':{'sources':[],'practiceSuites':22}})
            progress=b'{"progress":{"lc-two-sum":{"notes":"keep this"}},"submissions":[]}'
            (data/'user-state.json').write_bytes(progress)
            def fixture(path,text):
                f=repo/path; f.parent.mkdir(parents=True,exist_ok=True); f.write_text(text,encoding='utf-8')
            fixture(Path('0001.Two Sum/README_EN.md'),'---\ndifficulty: Easy\ntags:\n    - Array\n---\n# [1. Two Sum](https://leetcode.com/problems/two-sum/)\n<!-- description:start --><p>Given an integer array, return the two indices matching a target. Input contains one matching pair. Use distinct indices. Do not reuse an element.</p><script>alert(1)</script><!-- description:end -->\n```python\ndef twoSum(nums,target):\n    return [0,1]\n```')
            fixture(Path('0001.Two Sum/Solution.py'),'def twoSum(nums,target):\n    return [0,1]\n')
            fixture(Path('Week1/1-SingleNumber.cpp'),'int singleNumber(int a) { return a; }')
            fixture(Path('0003.Longest Substring Without Repeating Characters/Solution.go'),'package main\nfunc lengthOfLongestSubstring(s string) int { return len(s) }')
            fixture(Path('lintcode/1.A Different Problem/Solution.py'),'def lintcode_only(): return 1')
            fixture(Path('guide.md'),'# Preparation notes\nRead, practise, repeat.')
            fixture(Path('google/all.csv'),'ID,URL,Title,Difficulty,Acceptance %,Frequency %\n1,https://leetcode.com/problems/two-sum,Two Sum,Easy,55%,75%\n')
            with contextlib.redirect_stdout(io.StringIO()):
                m=Merger(data,root); m.merge(source); report=m.finish([source])
            catalog=json.loads((data/'catalog.json').read_text(encoding='utf-8'))
            by_id={p['id']:p for p in catalog['problems']}
            self.assertEqual(len(by_id),3)
            self.assertEqual(by_id['lc-two-sum']['solutions'],1)
            self.assertEqual(by_id['lc-single-number']['solutions'],1)
            self.assertEqual(by_id['lc-two-sum']['companies']['google']['frequency'],75)
            self.assertIn('Array',by_id['lc-two-sum']['topics'])
            detail=json.loads((data/'problems/lc-two-sum.json').read_text(encoding='utf-8'))
            self.assertNotIn('alert(',detail['html'])
            self.assertTrue(by_id['lc-two-sum']['description'])
            self.assertEqual((data/'user-state.json').read_bytes(),progress)
            with contextlib.redirect_stdout(io.StringIO()):
                m=Merger(data,root); m.merge(source); again=m.finish([source])
            self.assertEqual(again['addedProblems'],0)
            self.assertEqual(again['stats'].get('solutionsAdded',0),0)
            self.assertEqual(again['stats'].get('resourcesAdded',0),0)
            self.assertEqual(again['totals'],report['totals'])

if __name__=='__main__': unittest.main(verbosity=2)
