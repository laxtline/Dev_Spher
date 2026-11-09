"""Loopback-only local compiler and private folder backup support for StudyLab.

Programs run with the user's permissions, not in a security sandbox. The API is
same-origin, token-protected, bounded, and never enabled on the public website.
"""
import glob
import hmac
import json
import math
import os
from pathlib import Path
import secrets
import shutil
import signal
import subprocess
import tempfile
import threading
import time

MAX_BODY = 25 * 1024 * 1024
MAX_OUTPUT = 128 * 1024
RAW_PREFIXES = ('cl_code_', 'cl_notes_', 'cl_editorial_', 'cl_library_draft_', 'cl_library_notes_', 'cl_pg_', 'cl_study_notes_', 'cl_study_code_')
PROGRESS_KEYS = {'cl_'+s for s in ('settings','custom_questions','solved','attempted','submissions','liked','disliked','saved_snippets','practice_history','coding_history','contest_leaderboard','progress','library_progress','question_stats','practice_session','coding_session','classic_session','revision_state','learning_daily','learning_events','study_progress','study_settings','learning_meta','exam_hub')}

def allowed_key(key):
    return isinstance(key, str) and (key in PROGRESS_KEYS or key.startswith(RAW_PREFIXES))

def compiler_paths():
    def find(names, patterns=()):
        for name in names:
            found = shutil.which(name)
            if found:
                return found
        for pattern in patterns:
            for name in sorted(glob.glob(pattern), reverse=True):
                if Path(name).is_file():
                    return name
        return None
    roots = [os.environ.get('ProgramFiles', r'C:\Program Files'), os.environ.get('LOCALAPPDATA', '')]
    cc = find(['gcc','clang'], [r'C:\msys64\ucrt64\bin\gcc.exe',r'C:\msys64\mingw64\bin\gcc.exe',r'C:\MinGW\bin\gcc.exe',roots[0]+r'\LLVM\bin\clang.exe'])
    cpp = find(['g++','clang++'], [r'C:\msys64\ucrt64\bin\g++.exe',r'C:\msys64\mingw64\bin\g++.exe',r'C:\MinGW\bin\g++.exe',roots[0]+r'\LLVM\bin\clang++.exe'])
    jdk = os.environ.get('JAVA_HOME','')
    javac = find(['javac'], [jdk+r'\bin\javac.exe',roots[0]+r'\Java\*\bin\javac.exe',roots[0]+r'\Eclipse Adoptium\*\bin\javac.exe',roots[0]+r'\Microsoft\jdk*\bin\javac.exe',roots[0]+r'\Android\Android Studio\jbr\bin\javac.exe'])
    java = (str(Path(javac).with_name('java.exe' if os.name=='nt' else 'java')) if javac else None)
    if java and not Path(java).is_file():
        java = shutil.which('java')
    return {k:v for k,v in {'c':cc,'cpp':cpp,'javac':javac,'java':java}.items() if v}

def stop_tree(process):
    if process.poll() is not None:
        return
    if os.name == 'nt':
        subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

def bounded_run(command, cwd, stdin='', timeout=5, env=None):
    flags = {'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {'start_new_session':True}
    process = subprocess.Popen(command,cwd=cwd,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**flags)
    output = {'stdout':bytearray(),'stderr':bytearray()}
    overflow = threading.Event()
    def read(stream, name):
        while True:
            chunk=stream.read(4096)
            if not chunk:
                break
            remaining=MAX_OUTPUT-sum(len(v) for v in output.values())
            output[name].extend(chunk[:max(0,remaining)])
            if len(chunk)>remaining:
                overflow.set();stop_tree(process);break
        stream.close()
    readers=[threading.Thread(target=read,args=(process.stdout,'stdout'),daemon=True),threading.Thread(target=read,args=(process.stderr,'stderr'),daemon=True)]
    for reader in readers:reader.start()
    def feed():
        try:process.stdin.write(stdin.encode('utf-8'));process.stdin.close()
        except (BrokenPipeError,OSError,ValueError):pass
    feeder=threading.Thread(target=feed,daemon=True);feeder.start()
    timed_out=False
    try:process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:timed_out=True;stop_tree(process);process.wait(timeout=5)
    for reader in readers:reader.join(timeout=2)
    result={key:value.decode('utf-8',errors='replace') for key,value in output.items()}
    result.update(exitCode=process.returncode,status='timeout' if timed_out else 'output-limit' if overflow.is_set() else 'ok' if process.returncode==0 else 'runtime-error')
    return result

class LocalTools:
    def __init__(self, root, enabled=True):
        self.root=Path(root).resolve();self.enabled=enabled;self.token=secrets.token_urlsafe(32)
        self.compilers=compiler_paths();self.lock=threading.Lock();self.running=threading.BoundedSemaphore(1)
        self.folder=self.root/'.codelab-data';self.path=self.folder/'progress.json'

    def capabilities(self):
        languages=[lang for lang in ['c','cpp'] if self.compilers.get(lang)]
        if self.compilers.get('javac') and self.compilers.get('java'):languages.append('java')
        return {'app':'CodeLab','localTools':self.enabled,'languages':languages if self.enabled else [],'folderBackup':True,'backupFile':'studio-private/.codelab-data/progress.json','token':self.token}

    def compile(self, data):
        if not self.enabled:raise ValueError('Local execution is disabled on this launcher.')
        lang=data.get('language');code=data.get('code');stdin=data.get('stdin','')
        if lang not in self.capabilities()['languages']:raise ValueError('Compiler not installed. Install a C/C++ compiler or a Java JDK, then restart the launcher.')
        if not isinstance(code,str) or not isinstance(stdin,str) or len(code.encode())>512*1024 or len(stdin.encode())>512*1024:raise ValueError('Code and input must each be text of at most 512 KiB.')
        timeout=data.get('timeout',5)
        if isinstance(timeout,bool) or not isinstance(timeout,(int,float)) or not 0.1<=timeout<=15:raise ValueError('Timeout must be from 0.1 to 15 seconds.')
        if not self.running.acquire(blocking=False):raise ValueError('Another local program is running. Wait before starting another.')
        try:
            with tempfile.TemporaryDirectory(prefix='codelab-run-') as directory:
                root=Path(directory);started=time.monotonic()
                if lang=='java':
                    source=root/'Main.java';source.write_text(code,encoding='utf-8')
                    compile_cmd=[self.compilers['javac'],'-encoding','UTF-8',str(source)]
                    run_cmd=[self.compilers['java'],'-Xmx256m','-cp',str(root),'Main']
                else:
                    source=root/('main.c' if lang=='c' else 'main.cpp');source.write_text(code,encoding='utf-8')
                    executable=root/('program.exe' if os.name=='nt' else 'program')
                    compile_cmd=[self.compilers[lang],'-std=c17' if lang=='c' else '-std=c++17','-O0',str(source),'-o',str(executable)]
                    run_cmd=[str(executable)]
                environment=dict(os.environ)
                compiler=self.compilers['javac' if lang=='java' else lang]
                environment['PATH']=str(Path(compiler).parent)+os.pathsep+environment.get('PATH','')
                build=bounded_run(compile_cmd,directory,timeout=30,env=environment)
                if build['status']!='ok':build['status']='compile-error';return build
                result=bounded_run(run_cmd,directory,stdin,timeout,env=environment);result['time']=(time.monotonic()-started)*1000
                if result['status']=='timeout':result['stderr']+='\nTime limit exceeded.'
                if result['status']=='output-limit':result['stderr']+='\nOutput limit exceeded (128 KiB).'
                return result
        finally:self.running.release()

    def read_records(self):
        with self.lock:
            if not self.path.exists():return {'format':1,'records':{}}
            return json.loads(self.path.read_text(encoding='utf-8'))

    def merge_records(self, data):
        if not isinstance(data,dict) or data.get('format')!=1 or not isinstance(data.get('records'),dict):raise ValueError('Invalid progress record format.')
        for key,record in data['records'].items():
            if not allowed_key(key) or not isinstance(record,dict) or not isinstance(record.get('updatedAt'),(int,float)) or not isinstance(record.get('device'),str) or not isinstance(record.get('value'),(str,type(None))):raise ValueError('Invalid progress record.')
            if isinstance(record['updatedAt'],bool) or not math.isfinite(record['updatedAt']) or not 0<record['updatedAt']<1e16 or not 0<len(record['device'])<=128 or len(key)>512:raise ValueError('Invalid progress clock or key.')
            if key=='cl_settings' and record['value'] is not None:
                settings=json.loads(record['value'])
                if not isinstance(settings,dict):raise ValueError('Invalid settings.')
                settings.pop('jdoodleId',None);settings.pop('jdoodleSecret',None);record['value']=json.dumps(settings)
        with self.lock:
            existing=json.loads(self.path.read_text(encoding='utf-8')) if self.path.exists() else {'format':1,'records':{}}
            for key,record in data['records'].items():
                old=existing['records'].get(key)
                if not old or (record['updatedAt'],record['device'])>(old['updatedAt'],old['device']):existing['records'][key]=record
            self.folder.mkdir(exist_ok=True)
            target=self.folder/'progress.tmp';target.write_text(json.dumps(existing,ensure_ascii=False),encoding='utf-8');target.replace(self.path)
            return {'saved':True,'keys':len(existing['records'])}

    def handle(self, handler):
        from urllib.parse import urlsplit
        path=urlsplit(handler.path).path
        if not path.startswith('/__codelab__/') or path=='/__codelab__/health':return False
        expected={'127.0.0.1:'+str(handler.server.server_port),'localhost:'+str(handler.server.server_port)}
        host=handler.headers.get('Host','');origin=handler.headers.get('Origin')
        def respond(status, body):
            content=json.dumps(body).encode();handler.send_response(status)
            for k,v in [('Content-Type','application/json'),('Cache-Control','no-store'),('X-Content-Type-Options','nosniff'),('Cross-Origin-Resource-Policy','same-origin'),('Content-Length',str(len(content)))]:handler.send_header(k,v)
            handler.end_headers();handler.wfile.write(content)
        if host not in expected or (origin and origin!='http://'+host):respond(403,{'error':'Same-origin localhost requests only.'});return True
        if handler.command=='GET' and path=='/__codelab__/capabilities':respond(200,self.capabilities());return True
        if not hmac.compare_digest(handler.headers.get('X-CodeLab-Token',''),self.token):respond(403,{'error':'Invalid local session token.'});return True
        try:
            if handler.command=='GET' and path=='/__codelab__/progress':result=self.read_records()
            elif handler.command=='POST' and path in ['/__codelab__/run','/__codelab__/progress']:
                size=int(handler.headers.get('Content-Length','0'))
                if not 0<size<=MAX_BODY or handler.headers.get('Content-Type','').split(';')[0]!='application/json':respond(413,{'error':'Expected bounded JSON request.'});return True
                data=json.loads(handler.rfile.read(size));result=self.compile(data) if path.endswith('/run') else self.merge_records(data)
            else:respond(404,{'error':'Unknown StudyLab endpoint.'});return True
            respond(200,result)
        except (ValueError,TypeError,json.JSONDecodeError) as error:respond(400,{'error':str(error)})
        except Exception:respond(500,{'error':'Local operation failed. Check the launcher logs.'})
        return True
