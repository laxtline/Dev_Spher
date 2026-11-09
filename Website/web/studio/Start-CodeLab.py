"""Run the downloaded StudyLab folder without internet or npm. Python 3.8+ required."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser
import argparse
import json
import os
import sys
from urllib.parse import urlsplit, unquote
from local_tools import LocalTools

class CodeLabHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.server.tools.handle(self):return
        if any(part.startswith('.') for part in unquote(urlsplit(self.path).path).split('/') if part):
            self.send_error(404);return
        if urlsplit(self.path).path=='/__codelab__/health':
            body=json.dumps(dict(app='CodeLab',root=str(Path(self.directory).resolve()),pid=os.getpid())).encode()
            self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        else:super().do_GET()
    def do_POST(self):
        if not self.server.tools.handle(self):self.send_error(404)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=4173)
    parser.add_argument('--no-browser',action='store_true')
    parser.add_argument('--strict-port',action='store_true',help='Fail if the requested port is occupied.')
    parser.add_argument('--no-local-tools',action='store_true',help='Disable native C/C++/Java execution.')
    parser.add_argument('--log-dir',help='Write background-server logs in this StudyLab folder.')
    args=parser.parse_args()
    root=Path(__file__).resolve().parent
    if args.log_dir:
        if Path(args.log_dir).resolve()!=root:raise SystemExit('Background logs must stay inside this StudyLab folder.')
        sys.stdout=open(root/'.codelab-server.stdout.log','w',encoding='utf-8',buffering=1)
        sys.stderr=open(root/'.codelab-server.stderr.log','w',encoding='utf-8',buffering=1)
    if not (root/'index.html').is_file():raise SystemExit('Keep this launcher inside the extracted StudyLab folder.')
    handler=partial(CodeLabHandler,directory=str(root))
    ThreadingHTTPServer.request_queue_size=128
    try:server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
    except OSError:
        if args.strict_port:raise
        server=ThreadingHTTPServer(('127.0.0.1',0),handler)
    server.tools=LocalTools(root,enabled=not args.no_local_tools)
    url=f'http://127.0.0.1:{server.server_port}/'
    print('StudyLab is running at '+url+'\nKeep this window open. Press Ctrl+C to stop.\nNo internet is needed for Python, JavaScript, SQL or the study library.')
    if not args.no_browser:webbrowser.open(url+'index.html')
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__':main()
