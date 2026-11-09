"""Build a public, subpath-safe GitHub Pages edition from the offline application."""
import argparse, hashlib, json, re, shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parent

def build(root, output):
    root=root.resolve(); output=output.resolve()
    if output==root or not output.is_relative_to(root):
        raise ValueError('The output must be a separate directory inside the project.')
    if output.exists(): shutil.rmtree(output)
    shutil.copytree(root/'web',output)
    for name in ('assets','vendor','offline'):
        shutil.copytree(root/'web/studio'/name,output/name,dirs_exist_ok=True)
    shutil.copyfile(root/'web/studio/manifest.webmanifest',output/'manifest.webmanifest')
    shutil.copyfile(root/'web/studio/CodeLab-Offline.html',output/'CodeLab-Offline.html')
    shutil.copyfile(root/'web/studio/update.html',output/'update.html')
    # Only the public catalog and content enter the deployment; no private state or runtime executables.
    (output/'data').mkdir()
    for name in ('catalog.json',): shutil.copyfile(root/'data'/name,output/'data'/name)
    for name in ('problems','resources'): shutil.copytree(root/'data'/name,output/'data'/name)
    shutil.copyfile(root/'practice.json',output/'data/practice.json')
    for file in output.rglob('*'):
        if file.suffix not in ('.html','.js','.css','.json','.webmanifest') or not file.is_file(): continue
        # Rebase only this app's known internal URLs; external URLs and imported code remain intact.
        if file in (output/'index.html',output/'unified.js',output/'studio/index.html',output/'studio/pratice-bridge.js'):
            value=file.read_text(encoding='utf-8')
            value=re.sub(r'([\x22\x27`=])/(unified\.css|unified\.js|level-wise\.js|function-worker\.js|guides/|studio/|assets/)',r'\1./\2',value)
            file.write_text(value,encoding='utf-8')
    index=output/'index.html'
    value=index.read_text(encoding='utf-8').replace('<head>','<head>\n<script>window.PRATICE_STATIC=true;</script>\n<script src="browser-api.js"></script>',1)
    value=value.replace('<meta name="viewport"','<meta name="description" content="Learn coding, practise Python and JavaScript, take placement exams and explore a complete study library. Download the offline Windows app." />\n<meta name="viewport"',1)
    index.write_text(value,encoding='utf-8')
    manifest=json.loads((output/'manifest.webmanifest').read_text())
    manifest.update(name='Pratice Code — Learn, build & practise',short_name='Pratice Code',description='Coding practice, courses, exams and your complete study library.')
    (output/'manifest.webmanifest').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    catalog=json.loads((output/'data/catalog.json').read_text(encoding='utf-8'))
    # Keep source folder paths out of the public import summary.
    report=catalog.get('report',{})
    if isinstance(report.get('additionalImports'),dict): report['additionalImports']={Path(k.replace('\\','/')).name:v for k,v in report['additionalImports'].items()}
    (output/'data/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (output/'.nojekyll').touch()
    revision=hashlib.sha256((output/'index.html').read_bytes()+(output/'unified.js').read_bytes()+(output/'browser-api.js').read_bytes()).hexdigest()[:16]
    sw=(root/'pages-sw.js').read_text(encoding='utf-8').replace('__REVISION__',revision)
    (output/'sw.js').write_text(sw,encoding='utf-8')
    print(json.dumps({'directory':str(output),'files':sum(1 for p in output.rglob('*') if p.is_file()),'questions':len(catalog['problems']),'resources':len(catalog['resources']),'revision':revision}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',default='dist');args=parser.parse_args()
    build(ROOT,ROOT/args.output)
