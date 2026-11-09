"""Package the working combined folder with its offline engines and public content."""
import json, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent
SKIP={'downloads','backups','__pycache__','.git','studio-private','node_modules','build','dist','.venv'}
EXCLUDE={'user-state.json','user-state.json.tmp','imported-files.json','import_sources.json','.github-publish-state.json','server.log','github-upload.png'}
def public_metadata(value):
    if isinstance(value,dict):
        return {key:({Path(folder.replace('\\','/')).name:public_metadata(report) for folder,report in item.items()} if key=='additionalImports' and isinstance(item,dict) else public_metadata(item)) for key,item in value.items()}
    if isinstance(value,list):return [public_metadata(item) for item in value]
    return value
def public_files(root=ROOT):
    for file in root.rglob('*'):
        rel=file.relative_to(root)
        if file.is_file() and not any(part in SKIP for part in rel.parts) and file.name not in EXCLUDE and not file.name.endswith(('.log','.merge-tmp')):yield file

def package(output=None,extras=None):
    output=Path(output) if output else ROOT/'downloads'/'Pratice-Code-Offline.zip'
    output.parent.mkdir(parents=True,exist_ok=True);files=sorted(public_files())
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
        for file in files:
            relative=file.relative_to(ROOT).as_posix();name='Pratice-Code-Offline/'+relative
            if relative in ('data/catalog.json','data/import-report.json'):
                archive.writestr(name,json.dumps(public_metadata(json.loads(file.read_text(encoding='utf-8'))),ensure_ascii=False,separators=(',',':')))
            else:archive.write(file,name)
        for name,file in (extras or {}).items():archive.write(file,'Pratice-Code-Offline/'+name)
    with zipfile.ZipFile(output) as archive:
        invalid=archive.testzip()
        if invalid:raise RuntimeError('Archive verification failed: '+invalid)
    return {'archive':str(output),'files':len(files)+len(extras or {}),'sizeMiB':round(output.stat().st_size/1048576,2),'verified':True}

if __name__=='__main__':print(json.dumps(package()))
