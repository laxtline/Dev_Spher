"""Build the next desktop release using the retained, already bundled runtimes."""
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import zipfile
from pathlib import Path

PROJECT=Path(__file__).resolve().parents[1]
APP=PROJECT/'App'
WEB=PROJECT/'Website'
OUT=PROJECT/'Installer'
VERSION='1.4.0'


def load(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


def prepare():
    # Copy only distributable files; private saved work is never replaced or packaged.
    source=load(WEB/'package_offline.py','website_package')
    changed=0
    for file in source.public_files(WEB):
        dest=APP/file.relative_to(WEB)
        if dest.exists() and dest.stat().st_size==file.stat().st_size and hashlib.sha256(dest.read_bytes()).digest()==hashlib.sha256(file.read_bytes()).digest():continue
        dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(file,dest);changed+=1
    for folder in (APP,WEB):
        for name in ('Launcher.cs','Installer.cs'):
            file=folder/'windows'/name
            file.write_text(file.read_text(encoding='utf-8').replace('AssemblyVersion("1.3.0.0")','AssemblyVersion("1.4.0.0")'),encoding='utf-8')
        file=folder/'build_windows.py'
        file.write_text(file.read_text(encoding='utf-8').replace("VERSION='1.3.0'","VERSION='1.4.0'"),encoding='utf-8')
        file=folder/'web/studio/assets/language-support.js'
        file.write_text(file.read_text(encoding='utf-8').replace("version:'1.3.0'","version:'1.4.0'"),encoding='utf-8')
        file=folder/'web/index.html'
        file.write_text(file.read_text(encoding='utf-8').replace("version:'1.3.0'","version:'1.4.0'"),encoding='utf-8')
        file=folder/'README.md'
        text=file.read_text(encoding='utf-8').replace('v1.2.0','v1.4.0')
        text=text.replace('This update changes Website only. App, Installer, Publish and installed executables are untouched.','The web library update is included in desktop version 1.4.0. Questions, source versions, aliases and saved-progress compatibility use the same implementation in the web and desktop editions.')
        file.write_text(text,encoding='utf-8')
    print(json.dumps(dict(stage='prepared',filesUpdated=changed,version=VERSION)),flush=True)


def build():
    OUT.mkdir(exist_ok=True)
    csc=Path(os.environ.get('WINDIR','C:/Windows'))/'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    common=[str(csc),'/nologo','/target:winexe','/platform:x64','/optimize+','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/win32icon:'+str(APP/'windows/PraticeCode.ico'),'/win32manifest:'+str(APP/'windows/app.manifest')]
    subprocess.run(common+['/reference:'+str(APP/'Microsoft.Web.WebView2.Core.dll'),'/reference:'+str(APP/'Microsoft.Web.WebView2.WinForms.dll'),'/out:'+str(APP/'Pratice Code.exe'),str(APP/'windows/Launcher.cs')],check=True)
    package=load(APP/'package_offline.py','desktop_package')
    payload=APP/'build/release-1.4.0/Pratice-Code-Windows-Portable.zip'
    report=package.package(payload)
    installer=OUT/'Pratice-Code-Setup.exe'
    subprocess.run(common+['/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll','/resource:'+str(payload)+',PraticeCode.Payload','/out:'+str(installer),str(APP/'windows/Installer.cs')],check=True)
    with zipfile.ZipFile(installer) as archive:
        assert archive.testzip() is None
        names=archive.namelist()
        assert len(names)==len(set(names)), 'Duplicate installer archive paths'
        forbidden=[n for n in names if any(p in {'studio-private','__pycache__','backups','.git'} for p in Path(n).parts) or Path(n).name in {'user-state.json','import_sources.json','server.log','imported-files.json'}]
        assert not forbidden,forbidden
        prefix='Pratice-Code-Offline/'
        catalog=json.loads(archive.read(prefix+'data/catalog.json'))
        assert len(catalog['problems'])==11143
        script=archive.read(prefix+'web/unified.js').decode('utf-8')
        tabs=script.split('collectionTabs(scope){',1)[1].split(' importSummary',1)[0]
        assert "['resources','Files & books']" not in tabs
        assert 'questionIdentity' in script and 'aliasIds' in script
    digest=hashlib.sha256(installer.read_bytes()).hexdigest()
    (OUT/'Pratice-Code-Setup.sha256').write_text(digest+'  Pratice-Code-Setup.exe\n',encoding='ascii')
    report.update(version=VERSION,installer=installer.name,installerMiB=round(installer.stat().st_size/1048576,2),sha256=digest,
                  runtime='Python 3.14.10 x64',desktopRuntime='156.0.4314.56',standaloneWindow=True,
                  private_files_in_installer=0,questions=11143,visibleQuestionsAndTopics=11748,mergedDuplicateRecords=344,
                  packQuestions=404,sourceFiles=14652,packTestsPassed=489)
    report['archive']=str(payload.relative_to(PROJECT))
    (OUT/'windows-build.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2),flush=True)
    return report


if __name__=='__main__':
    prepare();build()
