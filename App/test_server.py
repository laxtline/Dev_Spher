"""Integration checks use a temporary state directory; personal progress is untouched."""
import gzip, json, shutil, subprocess, tempfile, threading, unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import server

class PracticeChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_data=server.DATA
        cls.temp=tempfile.TemporaryDirectory()
        server.DATA=Path(cls.temp.name)
        server.CATALOG=json.loads((cls.original_data/'catalog.json').read_text(encoding='utf-8'))
        (server.DATA/'catalog.json').write_text(json.dumps(server.CATALOG),encoding='utf-8')
        server.CATALOG_MTIME=None
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        studio=server.DATA/'studio';studio.mkdir()
        cls.http.studio_tools=server.LocalTools(studio,enabled=False)
        cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True); cls.thread.start()
        cls.base=f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); server.DATA=cls.original_data; cls.temp.cleanup()

    def request(self,path,body=None,headers=None):
        req=Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','X-Practice-Token':server.TOKEN,**(headers or {})})
        with urlopen(req,timeout=12) as r: return json.loads(r.read()) if path.startswith('/api/') or '/__codelab__/' in path else r.status

    def test_01_catalog_and_page(self):
        self.assertEqual(self.request('/'),200)
        catalog=self.request('/api/catalog')
        self.assertGreater(len(catalog['problems']),3000)
        self.assertEqual(len({p['id'] for p in catalog['problems']}),len(catalog['problems']))
        expected=len(server.SPECS)+sum(bool(p.get('runnable')) for p in catalog['problems'] if p.get('sourceGroup')=='python-pack')
        self.assertEqual(sum(bool(p.get('runnable')) for p in catalog['problems']),expected)
        self.assertTrue(self.request('/api/bootstrap')['token'])

    def test_02_save_restart_readback(self):
        self.request('/api/progress',{'id':'lc-two-sum','notes':'Hash map approach — local note','drafts':{'python':'def twoSum(nums, target): pass'},'bookmark':True})
        saved=self.request('/api/bootstrap')['state']['progress']['lc-two-sum']
        self.assertEqual(saved['notes'],'Hash map approach — local note')
        self.assertTrue(saved['bookmark'])
        self.assertIn('twoSum',server.state()['progress']['lc-two-sum']['drafts']['python'])

    def test_03_python_submission_and_history(self):
        code='def twoSum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target-n in seen: return [seen[target-n], i]\n        seen[n] = i\n'
        result=self.request('/api/run',{'id':'lc-two-sum','language':'python','code':code,'mode':'submit'})
        self.assertTrue(result['accepted'],result)
        self.assertEqual(len(result['cases']),5)
        state=self.request('/api/bootstrap')['state']
        self.assertEqual(state['progress']['lc-two-sum']['status'],'solved')
        self.assertEqual(state['submissions'][0]['verdict'],'Practice accepted')
        self.assertEqual(state['progress']['lc-two-sum']['notes'],'Hash map approach — local note')

    def test_04_javascript_and_custom(self):
        result=self.request('/api/run',{'id':'lc-valid-anagram','language':'javascript','code':'function isAnagram(s,t) { return [...s].sort().join("") === [...t].sort().join(""); }','mode':'submit'})
        self.assertTrue(result['accepted'],result)
        result=self.request('/api/run',{'id':'lc-add-two-numbers','language':'python','function':'solve','code':'def solve(a,b):\n    print("custom input")\n    return a+b','mode':'custom','custom':[12,30]})
        self.assertEqual(result['cases'][0]['actual'],42)
        self.assertIsNone(result['cases'][0]['passed'])
        self.assertIn('custom input',result['stdout'])

    def test_05_wrong_answer_runtime_and_timeout(self):
        base={'id':'lc-two-sum','language':'python','mode':'run'}
        result=self.request('/api/run',{**base,'code':'def twoSum(nums,target): return []'})
        self.assertEqual(result['verdict'],'Wrong answer')
        result=self.request('/api/run',{**base,'code':'def twoSum(nums,target): return 1/0'})
        self.assertIn('ZeroDivisionError',result['error'])
        result=self.request('/api/run',{**base,'code':'def twoSum(nums,target):\n    while True: pass'})
        self.assertEqual(result['verdict'],'Time limit exceeded')

    def test_06_reject_cross_origin_and_missing_suite(self):
        with self.assertRaises(HTTPError) as cm:
            self.request('/api/progress',{'id':'lc-two-sum','notes':'blocked'},headers={'Origin':'https://example.com'})
        self.assertEqual(cm.exception.code,403)
        with self.assertRaises(HTTPError) as cm:
            self.request('/api/run',{'id':'lc-add-two-numbers','language':'python','code':'def solve(a): return a','mode':'submit'})
        self.assertEqual(cm.exception.code,400)

    def test_07_numeric_and_class_support(self):
        self.assertTrue(server.equal(2.0,2)); self.assertFalse(server.equal(True,1))
        result=self.request('/api/run',{'id':'lc-palindrome-number','language':'python','code':'class Solution:\n    def isPalindrome(self,x): return str(x)==str(x)[::-1]','mode':'submit'})
        self.assertTrue(result['accepted'],result)

    def test_08_backup_restore(self):
        before=self.request('/api/bootstrap')['state']
        self.request('/api/restore',{'state':{'progress':{},'submissions':[]}})
        self.assertEqual(self.request('/api/bootstrap')['state']['progress'],{})
        self.request('/api/restore',{'state':before})
        self.assertTrue(self.request('/api/bootstrap')['state']['progress']['lc-two-sum']['bookmark'])

    def test_09_catalog_reloads_and_compresses(self):
        path=server.DATA/'catalog.json'
        catalog=json.loads(path.read_text(encoding='utf-8'))
        catalog['report']['mergeCheck']='updated without restart'
        path.write_text(json.dumps(catalog),encoding='utf-8')
        req=Request(self.base+'/api/catalog',headers={'Accept-Encoding':'gzip'})
        with urlopen(req) as response:
            self.assertEqual(response.headers['Content-Encoding'],'gzip')
            result=json.loads(gzip.decompress(response.read()))
        self.assertEqual(result['report']['mergeCheck'],'updated without restart')

    def test_10_studio_and_private_backup_bridge(self):
        with urlopen(self.base+'/') as response:
            page=response.read().decode('utf-8')
            self.assertEqual(response.headers['Content-Security-Policy'],"frame-ancestors 'none'")
            self.assertIn('/unified.js',page)
            self.assertNotIn('studio-frame',page)
        capabilities=self.request('/__codelab__/capabilities')
        self.assertEqual(capabilities['app'],'CodeLab')
        record={'format':1,'records':{'cl_pg_code_python':{'updatedAt':1700000000000,'device':'integration-test','value':'print(42)'}}}
        result=self.request('/__codelab__/progress',record,{'X-CodeLab-Token':capabilities['token']})
        self.assertTrue(result['saved'])
        readback=self.request('/__codelab__/progress',headers={'X-CodeLab-Token':capabilities['token']})
        self.assertEqual(readback['records']['cl_pg_code_python']['value'],'print(42)')
        with self.assertRaises(HTTPError) as error:self.request('/studio/.codelab-data/progress.json')
        self.assertEqual(error.exception.code,404)

    def test_11_offline_runtimes_exist(self):
        for path in ['vendor/runtimes/python/pyodide.js','vendor/runtimes/python/pyodide.asm.wasm','vendor/runtimes/python/python_stdlib.zip','vendor/runtimes/sql/sql-wasm.wasm','vendor/runtimes/monaco/vs/loader.js','offline/catalog.js','unified.js','unified.css','level-wise.js','guides/DSA_01_Service_Based_Companies.pdf','guides/DSA_02_Mid_Tier_Product_Fintech_Companies.pdf','guides/DSA_03_Top_Tier_Product_Companies.pdf']:
            with urlopen(Request(self.base+'/'+path,method='HEAD')) as response:self.assertEqual(response.status,200,path)

    def test_12_studio_inline_scripts_parse(self):
        class Scripts(HTMLParser):
            def __init__(self):super().__init__();self.active=False;self.scripts=[]
            def handle_starttag(self,tag,attrs):
                if tag=='script':self.active=not any(k=='src' for k,v in attrs)
            def handle_endtag(self,tag):
                if tag=='script':self.active=False
            def handle_data(self,value):
                if self.active and value.strip():self.scripts.append(value)
        parsed=Scripts();parsed.feed((server.ROOT/'web/index.html').read_text(encoding='utf-8'))
        node=shutil.which('node');self.assertTrue(node)
        for script in parsed.scripts:
            checked=subprocess.run([node,'--check','-'],input=script,text=True,capture_output=True,encoding='utf-8')
            self.assertEqual(checked.returncode,0,checked.stderr[:1500])

if __name__=='__main__': unittest.main(verbosity=2)
