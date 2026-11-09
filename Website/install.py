"""Check the extracted offline folder and start Pratice Code. No network installation."""
import argparse, importlib.util, json, os, shutil, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent
def check():
    required=['server.py','launch.py','local_tools.py','practice.json','web/index.html','web/unified.js','web/level-wise.js','web/function-worker.js','data/catalog.json','web/studio/vendor/runtimes/python/pyodide.asm.wasm','web/studio/vendor/runtimes/python/python_stdlib.zip','web/studio/vendor/runtimes/sql/sql-wasm.wasm','web/studio/vendor/runtimes/monaco/vs/loader.js','web/guides/DSA_01_Service_Based_Companies.pdf','web/guides/DSA_02_Mid_Tier_Product_Fintech_Companies.pdf','web/guides/DSA_03_Top_Tier_Product_Companies.pdf']
    missing=[name for name in required if not (ROOT/name).is_file()]
    return {'ready':sys.version_info>=(3,10) and not missing,'python':sys.version.split()[0],'minimumPython':'3.10','missingFiles':missing,'nodeRequired':False,'internetRequired':False}
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--json',action='store_true');args=parser.parse_args();result=check()
    if args.json:print(json.dumps(result));return 0 if result['ready'] else 1
    if not result['ready']:
        print('Pratice Code needs Python 3.10+ and the complete extracted folder.')
        if result['missingFiles']:print('Missing files: '+', '.join(result['missingFiles']))
        return 1
    print('Ready. All required learning content and browser engines are included.')
    print('Python, JavaScript, SQLite and web previews work without internet or Node.js.')
    print('C/C++ and Java additionally use a local compiler/JDK if you have installed one.')
    if not args.check:
        if os.name=='nt' and (ROOT/'Pratice Code.exe').is_file():subprocess.Popen([str(ROOT/'Pratice Code.exe')],cwd=ROOT)
        else:
            import runpy
            runpy.run_path(str(ROOT/'launch.py'),run_name='__main__')
    return 0
if __name__=='__main__':raise SystemExit(main())
