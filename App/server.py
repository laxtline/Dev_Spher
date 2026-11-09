"""Pratice Code: dependency-free, loopback-only personal practice server."""
import argparse, contextlib, gzip, hashlib, json, math, os, secrets, shutil, subprocess, sys, tempfile, threading, time, webbrowser
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote
from local_tools import LocalTools

ROOT=Path(__file__).resolve().parent
INSTANCE_ID=hashlib.sha256(os.path.normcase(str(ROOT)).encode('utf-8')).hexdigest()
DATA=ROOT/'data'
LOCK=threading.Lock()
PACKAGE_LOCK=threading.Lock()
TOKEN=secrets.token_urlsafe(32)
CATALOG={}
CATALOG_MTIME=None
CATALOG_GZIP=None
SPECS={s['slug']:s for s in json.loads((ROOT/'practice.json').read_text(encoding='utf-8'))}
PY_RUNNER=r'''
import json, sys, io, contextlib, traceback, typing, collections, math, itertools, functools, heapq, bisect
request=json.loads(sys.stdin.read())
ns={"List":typing.List,"Optional":typing.Optional,"Counter":collections.Counter,"defaultdict":collections.defaultdict,"deque":collections.deque,"math":math,"heapq":heapq,"__name__":"__practice__"}
class BoundedLog(io.StringIO):
    def write(self,s):
        if self.tell()<16000: return super().write(s[:16000-self.tell()])
        return len(s)
log=BoundedLog()
try:
    with contextlib.redirect_stdout(log):
        exec(compile(request["code"],"solution.py","exec"),ns)
        fn=ns.get(request["function"])
        if not callable(fn) and "Solution" in ns: fn=getattr(ns["Solution"](),request["function"],None)
        if not callable(fn): raise ValueError("Define function "+request["function"]+" or a Solution class with that method.")
        results=[]
        for args in request["cases"]:
            value=fn(*args)
            results.append(value)
    print(json.dumps({"results":results,"stdout":log.getvalue()},allow_nan=False))
except BaseException as e:
    print(json.dumps({"error":type(e).__name__+": "+str(e),"stdout":log.getvalue()}))
'''
JS_RUNNER=r'''
const fs=require('fs');
const r=JSON.parse(fs.readFileSync(0,'utf8')); let logs='';
const logger={log:(...a)=>{if(logs.length<16000) logs+=(a.map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' ')+'\n').slice(0,16000-logs.length);}};
try {
 const fn=new Function('console',r.code+'\n;return typeof '+r.function+' === "function" ? '+r.function+' : (typeof Solution !== "undefined" ? new Solution()["'+r.function+'"].bind(new Solution()) : null);')(logger);
 if(typeof fn!=='function') throw Error('Define function '+r.function+' with the shown name.');
 const results=r.cases.map(a=>fn(...a));
 process.stdout.write(JSON.stringify({results,stdout:logs}));
} catch(e) {process.stdout.write(JSON.stringify({error:e.name+': '+e.message,stdout:logs}));}
'''

def state():
    try: return json.loads((DATA/'user-state.json').read_text(encoding='utf-8'))
    except FileNotFoundError: return {'progress':{},'submissions':[]}

def save(value):
    temp=DATA/'user-state.json.tmp'
    temp.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8'); temp.replace(DATA/'user-state.json')

def equal(actual,expected):
    if isinstance(expected,bool) or isinstance(actual,bool): return type(actual) is type(expected) and actual==expected
    if isinstance(actual,(int,float)) and isinstance(expected,(int,float)): return math.isclose(actual,expected,rel_tol=1e-9,abs_tol=1e-9)
    if type(actual) is not type(expected): return False
    if isinstance(expected,list): return len(actual)==len(expected) and all(equal(a,b) for a,b in zip(actual,expected))
    if isinstance(expected,dict): return actual.keys()==expected.keys() and all(equal(actual[k],expected[k]) for k in expected)
    return actual==expected

def execute(payload):
    language=payload.get('language'); code=payload.get('code',''); function=payload.get('function','solve')
    if language not in ('python','javascript') or not isinstance(code,str) or len(code)>60000 or not function.isidentifier(): raise ValueError('Invalid language, function name or code size.')
    pid=payload.get('id',''); slug=pid.removeprefix('lc-'); spec=SPECS.get(slug)
    if not spec and isinstance(pid,str) and pid and all(c in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in pid):
        detail=DATA/'problems'/(pid+'.json')
        if detail.is_file(): spec=json.loads(detail.read_text(encoding='utf-8')).get('practice')
    mode=payload.get('mode','run')
    if mode=='submit' and not spec: raise ValueError('No verified practice suite for this question. Use custom input or save your progress manually.')
    custom=payload.get('custom')
    tests=spec['tests'] if spec else []
    if mode=='custom':
        if not isinstance(custom,list): raise ValueError('Custom input must be a JSON array of arguments.')
        cases=[custom]; function=payload.get('function',spec['function'] if spec else 'solve')
    else:
        if not tests: raise ValueError('Choose Custom input for this question; no local test suite is available.')
        if mode=='run': tests=tests[:2]
        function=spec['function']; cases=[t['args'] for t in tests]
    request=json.dumps({'code':code,'function':function,'cases':cases})
    if language=='python': command=[sys.executable,'-I','-u','-c',PY_RUNNER]
    else:
        node=shutil.which('node')
        if not node: raise ValueError('Node.js is not installed; select Python.')
        command=[node,'--max-old-space-size=128','-e',JS_RUNNER]
    start=time.perf_counter()
    try:
        with tempfile.TemporaryDirectory(prefix='suryacode-') as folder:
            result=subprocess.run(command,input=request,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',timeout=6,cwd=folder,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    except subprocess.TimeoutExpired: return {'error':'Time limit exceeded (6 seconds). Check for an infinite loop.','verdict':'Time limit exceeded'}
    duration=round((time.perf_counter()-start)*1000)
    try: output=json.loads(result.stdout[:1500000])
    except (ValueError,TypeError): return {'error':(result.stderr or result.stdout or 'The program ended without a result.')[:4000],'verdict':'Runtime error'}
    if output.get('error'): return {**output,'verdict':'Runtime error','duration':duration}
    rows=[]
    for i,actual in enumerate(output['results']):
        expected=tests[i]['expected'] if mode!='custom' else None
        # Comparison is structural and type-aware (Python True must not equal 1).
        passed=equal(actual,expected) if mode!='custom' else None
        rows.append({'args':cases[i],'expected':expected,'actual':actual,'passed':passed})
    accepted=mode=='submit' and all(t['passed'] for t in rows)
    return {'cases':rows,'stdout':output.get('stdout',''),'duration':duration,'accepted':accepted,'verdict':('Practice accepted' if accepted else 'Custom run complete' if mode=='custom' else 'Tests passed' if all(t['passed'] for t in rows) else 'Wrong answer'),'scope':'Local practice tests only'}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT/'web'),**kw)
    def log_message(self,fmt,*args): pass
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cache-Control','no-store')
        # The integrated editor uses its original inline scripts, WebAssembly and workers.
        self.send_header('Content-Security-Policy',"frame-ancestors 'self'" if urlsplit(self.path).path.startswith('/studio/') else "frame-ancestors 'none'")
        super().end_headers()
    def allowed(self):
        host=self.headers.get('Host','')
        return host in (f'localhost:{self.server.server_port}',f'127.0.0.1:{self.server.server_port}')
    def reply(self,value,status=200):
        data=json.dumps(value,ensure_ascii=False).encode('utf-8')
        if len(data)>32768 and 'gzip' in self.headers.get('Accept-Encoding',''):
            data=gzip.compress(data); compressed=True
        else: compressed=False
        self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(data)))
        if compressed: self.send_header('Content-Encoding','gzip'); self.send_header('Vary','Accept-Encoding')
        self.end_headers(); self.wfile.write(data)
    def catalog_reply(self):
        global CATALOG,CATALOG_MTIME,CATALOG_GZIP
        stamp=(DATA/'catalog.json').stat().st_mtime_ns
        with LOCK:
            if CATALOG_MTIME!=stamp:
                CATALOG=json.loads((DATA/'catalog.json').read_text(encoding='utf-8'))
                CATALOG_MTIME=stamp; CATALOG_GZIP=None
            if 'gzip' in self.headers.get('Accept-Encoding',''):
                if CATALOG_GZIP is None: CATALOG_GZIP=gzip.compress(json.dumps(CATALOG,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
                data=CATALOG_GZIP
            else: data=None
        if data is None: return self.reply(CATALOG)
        self.send_response(200); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Encoding','gzip'); self.send_header('Vary','Accept-Encoding'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def studio_api(self,path):
        if not path.startswith(('/studio/__codelab__/','/__codelab__/')): return False
        if not hasattr(self.server,'studio_tools'):
            with LOCK:
                if not hasattr(self.server,'studio_tools'):
                    private=ROOT/'studio-private'; private.mkdir(exist_ok=True)
                    self.server.studio_tools=LocalTools(private)
        if path in ('/studio/__codelab__/health','/__codelab__/health'):
            self.reply({'app':'CodeLab','combined':True}); return True
        original=self.path
        try:
            if self.path.startswith('/studio/'): self.path=self.path[len('/studio'):]
            return self.server.studio_tools.handle(self)
        finally: self.path=original
    def do_GET(self):
        if not self.allowed(): return self.reply({'error':'Invalid host'},403)
        path=urlsplit(self.path).path
        if any(part.startswith('.') for part in unquote(path).split('/') if part): return self.reply({'error':'Not found'},404)
        if path in ('/studio','/studio/','/studio/index.html'):
            self.send_response(302);self.send_header('Location','/');self.end_headers();return
        if self.studio_api(path): return
        if path=='/downloads/Pratice-Code-Offline.zip':
            package=ROOT/'downloads'/'Pratice-Code-Offline.zip'
            with PACKAGE_LOCK:
                if not package.exists():
                    built=subprocess.run([sys.executable,str(ROOT/'package_offline.py')],cwd=ROOT,capture_output=True,timeout=180)
                    if built.returncode: return self.reply({'error':'Could not prepare the offline ZIP.'},500)
            self.send_response(200);self.send_header('Content-Type','application/zip');self.send_header('Content-Disposition','attachment; filename="Pratice-Code-Offline.zip"');self.send_header('Content-Length',str(package.stat().st_size));self.end_headers()
            with package.open('rb') as file:self.copyfile(file,self.wfile)
            return
        if path=='/api/health': return self.reply({'application':'Pratice Code','ready':True,'instanceId':INSTANCE_ID})
        if path=='/api/bootstrap':
            with LOCK: value=state()
            return self.reply({'token':TOKEN,'state':value,'python':sys.version.split()[0],'node':bool(shutil.which('node'))})
        if path=='/api/catalog': return self.catalog_reply()
        for prefix,folder in [('/api/problem/','problems'),('/api/resource/','resources')]:
            if path.startswith(prefix):
                key=unquote(path[len(prefix):])
                if not key or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in key): return self.reply({'error':'Not found'},404)
                file=DATA/folder/(key+'.json')
                if file.is_file(): return self.reply(json.loads(file.read_text(encoding='utf-8')))
                if folder=='problems' and key in {p['id'] for p in CATALOG['problems']}: return self.reply({'html':'','source':'Company sheet (metadata only)','solutions':[]})
                return self.reply({'error':'Not found'},404)
        if path.startswith('/api/'): return self.reply({'error':'Not found'},404)
        return super().do_GET()
    def do_HEAD(self):
        if not self.allowed(): return self.reply({'error':'Invalid host'},403)
        path=urlsplit(self.path).path
        if path.startswith('/api/') or any(part.startswith('.') for part in unquote(path).split('/') if part): return self.reply({'error':'Not found'},404)
        return super().do_HEAD()
    def translate_path(self,path):
        primary=super().translate_path(path)
        if Path(primary).exists(): return primary
        relative=unquote(urlsplit(path).path).lstrip('/')
        if relative.split('/')[0] in ('assets','vendor','offline') or relative in ('sw.js','manifest.webmanifest','CodeLab-Offline.html','update.html'):
            candidate=(ROOT/'web/studio'/relative).resolve()
            try: candidate.relative_to((ROOT/'web/studio').resolve())
            except ValueError: return primary
            if candidate.is_file(): return str(candidate)
        return primary
    def copyfile(self,source,outputfile):
        try: return super().copyfile(source,outputfile)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError): pass
    def do_POST(self):
        if not self.allowed(): return self.reply({'error':'Invalid host'},403)
        if self.studio_api(urlsplit(self.path).path): return
        origin=self.headers.get('Origin')
        if not self.allowed() or (origin and origin not in (f'http://localhost:{self.server.server_port}',f'http://127.0.0.1:{self.server.server_port}')) or self.headers.get('X-Practice-Token')!=TOKEN: return self.reply({'error':'Reload the page before saving or running code.'},403)
        try:
            length=int(self.headers.get('Content-Length',0))
            if length>10000000: raise ValueError('Request too large')
            payload=json.loads(self.rfile.read(length))
            path=urlsplit(self.path).path
            if path=='/api/stop':
                self.reply({'ok':True})
                threading.Thread(target=self.server.shutdown,daemon=True).start()
                return
            if path=='/api/progress':
                pid=payload.get('id')
                if pid not in {p['id'] for p in CATALOG['problems']}: raise ValueError('Unknown problem')
                with LOCK:
                    value=state(); progress=value['progress'].setdefault(pid,{})
                    for key in ('status','bookmark','notes','drafts'):
                        if key in payload: progress[key]=payload[key]
                    progress['updated']=time.time(); save(value)
                return self.reply({'ok':True})
            if path=='/api/restore':
                value=payload.get('state')
                if not isinstance(value,dict) or not isinstance(value.get('progress'),dict) or not isinstance(value.get('submissions'),list): raise ValueError('Invalid Pratice Code backup')
                for key,p in value['progress'].items():
                    if not isinstance(p,dict) or p.get('status','todo') not in ('todo','attempted','solved'): raise ValueError('Invalid progress record')
                    if 'drafts' in p and not isinstance(p['drafts'],dict): raise ValueError('Invalid drafts')
                with LOCK: save(value)
                return self.reply({'ok':True})
            if path=='/api/run':
                result=execute(payload)
                if payload.get('mode')=='submit':
                    with LOCK:
                        value=state(); p=value['progress'].setdefault(payload['id'],{})
                        if result.get('accepted'): p['status']='solved'
                        elif p.get('status')!='solved': p['status']='attempted'
                        value['submissions'].insert(0,{'id':payload['id'],'language':payload['language'],'verdict':result['verdict'],'at':time.time(),'duration':result.get('duration',0)})
                        value['submissions']=value['submissions'][:3000]; save(value)
                return self.reply(result)
            return self.reply({'error':'Not found'},404)
        except (ValueError,KeyError,TypeError) as e: return self.reply({'error':str(e)},400)
        except Exception as e: return self.reply({'error':'Could not complete this operation: '+str(e)},500)

def main():
    global CATALOG
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=8787); parser.add_argument('--no-browser',action='store_true'); args=parser.parse_args()
    if not (DATA/'catalog.json').exists():
        print('Importing your question packs...'); subprocess.run([sys.executable,str(ROOT/'import_packs.py')],check=True)
    CATALOG=json.loads((DATA/'catalog.json').read_text(encoding='utf-8'))
    try: server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    except OSError:
        print(f'Port {args.port} is already in use. Pratice Code may already be running.'); return
    url=f'http://127.0.0.1:{args.port}'
    print(f'Pratice Code is ready: {url}',flush=True)
    print('Your data stays on this computer. Close this window to stop.',flush=True)
    if not args.no_browser: webbrowser.open(url)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=='__main__': main()
