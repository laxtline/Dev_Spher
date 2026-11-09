"""Start the installed local app quietly and open its browser window."""
import argparse, hashlib, json, os, subprocess, sys, time, webbrowser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

ROOT=Path(__file__).resolve().parent
INSTANCE_ID=hashlib.sha256(os.path.normcase(str(ROOT)).encode('utf-8')).hexdigest()
parser=argparse.ArgumentParser();parser.add_argument('--stop',action='store_true');parser.add_argument('--no-browser',action='store_true');parser.add_argument('--port',type=int,default=8787);args=parser.parse_args()
if not 1024<=args.port<=65535:parser.error('Choose a port from 1024 through 65535.')
URL=f'http://127.0.0.1:{args.port}'

def get(path):
    with urlopen(URL+path,timeout=1) as r: return json.loads(r.read())

def ready():
    try:
        health=get('/api/health');return health.get('application')=='Pratice Code' and health.get('instanceId')==INSTANCE_ID
    except (URLError,ValueError,OSError): return False

if args.stop:
    if ready():
        token=get('/api/bootstrap')['token']
        req=Request(URL+'/api/stop',data=b'{}',headers={'Content-Type':'application/json','X-Practice-Token':token})
        with urlopen(req,timeout=3) as r: r.read()
        print('Pratice Code stopped. Your progress is saved.')
    else: print('Pratice Code is not running.')
else:
    if not ready():
        executable=Path(sys.executable).with_name('pythonw.exe')
        if not executable.exists(): executable=Path(sys.executable)
        with (ROOT/'server.log').open('a',encoding='utf-8') as log:
            process=subprocess.Popen([str(executable),str(ROOT/'server.py'),'--no-browser','--port',str(args.port)],cwd=ROOT,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW if sys.platform=='win32' else 0)
        for _ in range(35):
            if ready(): break
            if process.poll() is not None: break
            time.sleep(.15)
    if ready():
        if not args.no_browser: webbrowser.open(URL)
        print('Pratice Code is running at '+URL)
    else:
        print('Could not start Pratice Code. Check server.log or try: python server.py --port 8788')
        raise SystemExit(1)
