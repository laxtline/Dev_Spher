'use strict';
const RuntimeAssets={
  scripts:new Map(),
  base(kind){
    if(location.protocol!=='file:'&&!window.CODELAB_STANDALONE)return new URL('vendor/runtimes/'+kind+'/',document.baseURI).href;
    return {python:'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',sql:'https://cdn.jsdelivr.net/npm/sql.js@1.14.0/dist/',monaco:'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/'}[kind];
  },
  script(url){if(!this.scripts.has(url))this.scripts.set(url,new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.onload=resolve;script.onerror=()=>{this.scripts.delete(url);reject(new Error('Could not load runtime: '+url));};document.head.append(script);}));return this.scripts.get(url);},
  allFiles(){return [...new Set(['./',...CODELAB_RUNTIME.shell,...OfflineLibrary.catalog.files,...CODELAB_RUNTIME.files.map(f=>f.path)])];},
  async saved(){
    if(window.CODELAB_STANDALONE)return 'portable';
    if(location.protocol==='file:')return 'folder';
    if(!('caches' in window))return 'unsupported';
    const name=OfflineLibrary.cacheName();
    if(!(await caches.has(name)))return 'missing';
    const cache=await caches.open(name),keys=new Set((await cache.keys()).map(r=>r.url));
    return this.allFiles().every(f=>keys.has(new URL(f,document.baseURI).href))?'ready':'partial';
  }
};

// Python executes in a stoppable worker and reads both input() and sys.stdin normally.
Object.assign(Py,{
  worker:null,pending:null,sequence:0,
  status(text,ready=false){document.getElementById('py-label').textContent=text;document.getElementById('py-dot').className='dot'+(ready?' ready':'');},
  load(){
    if(this.ready)return Promise.resolve();if(this.loading)return this.loadPromise;
    this.loading=true;this.status('Python loading…');
    this.loadPromise=new Promise((resolve,reject)=>{
      let url;
      try{url=window.CODELAB_PYTHON_WORKER_SOURCE?URL.createObjectURL(new Blob([CODELAB_PYTHON_WORKER_SOURCE],{type:'text/javascript'})):new URL('assets/python-worker.js',document.baseURI).href;this.worker=new Worker(url);}catch(error){this.loading=false;this.status('Python needs localhost / installed app');reject(error);return;}
      const worker=this.worker;
      const timeout=setTimeout(()=>{if(this.worker===worker){worker.terminate();this.worker=null;this.loading=false;this.status('Python unavailable · retry');reject(new Error('Python loading timed out.'));}},45000);
      const finish=()=>{clearTimeout(timeout);if(url.startsWith('blob:'))URL.revokeObjectURL(url);};
      worker.onmessage=({data})=>{
        if(this.worker!==worker)return;
        if(data.type==='ready'){finish();this.loading=false;this.ready=true;this.status('Python ready',true);resolve();}
        else if(data.type==='init-error'){finish();worker.terminate();this.worker=null;this.loading=false;this.ready=false;this.status('Python unavailable · retry');reject(new Error(data.error));}
        else if(data.type==='result'&&this.pending?.id===data.id){const job=this.pending;this.pending=null;clearTimeout(job.timer);job.resolve({stdout:data.stdout,stderr:data.stderr});}
      };
      worker.onerror=event=>{event.preventDefault();finish();this.stop(new Error(event.message||'Python worker failed.'));reject(new Error(event.message||'Python worker failed.'));};
      worker.postMessage({type:'init',base:RuntimeAssets.base('python')});
    });
    // Background startup must not create an unhandled rejection; explicit callers still receive it.
    this.loadPromise.catch(()=>{});return this.loadPromise;
  },
  run(code,stdin,timeoutMs){
    if(!this.ready)return Promise.reject({kind:'notready'});
    if(this.pending)return Promise.reject(new Error('Python is already running. Wait or use Stop run.'));
    return new Promise((resolve,reject)=>{
      const id=++this.sequence,timer=setTimeout(()=>{this.stop({kind:'tle'});if(!window.CODELAB_DISABLE_PYTHON)this.load();},timeoutMs);
      this.pending={id,timer,resolve,reject};this.worker.postMessage({type:'run',id,code,stdin});
    });
  },
  stop(error=new Error('Execution stopped by you.')){this.worker?.terminate();this.worker=null;this.ready=false;this.loading=false;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null;}this.status('Python stopped · reload engine');}
});
SqlRun.load=function(){
  if(this.ready)return Promise.resolve();if(this.loading)return this.loadPromise;this.loading=true;
  this.loadPromise=(async()=>{try{const base=RuntimeAssets.base('sql');if(typeof initSqlJs==='undefined')await RuntimeAssets.script(base+'sql-wasm.js');this.SQL=await initSqlJs({locateFile:file=>base+file});this.ready=true;}finally{this.loading=false;}})();return this.loadPromise;
};

const ProgressBackup={
  arrays:['custom_questions','solved','attempted','submissions','liked','disliked','saved_snippets','practice_history','coding_history'],
  objects:['settings','contest_leaderboard','progress','library_progress','question_stats','practice_session','coding_session'],
  raw:/^cl_(code_|notes_|editorial_|library_draft_|library_notes_|pg_).+$/,
  busy(){return !!(Exam.active||Exam.submitting||Aptitude.active||WrittenTest.active||PracticeSession.session||Runner.busy||Playground.busy||Py.pending||JsRun.workers?.size);},
  drafts(){
    const values={};if(Editor.ready&&ProblemView.q)values['cl_code_'+ProblemView.q.id+'_'+Editor.currentLang]=Editor.getValue();
    if(Playground.ready){for(const [tab,model] of Object.entries(Playground.webModels))values['cl_pg_'+tab]=model.getValue();values['cl_pg_'+(Playground.lang==='html'?Playground.webTabActive:'code_'+Playground.lang)]=Playground.instance.getValue();}
    return values;
  },
  flush(strict=false){
    Editor.save();Playground.save();if(Exam.active)Academy.snapshotCoding();PracticeSession.persist();
    if(strict&&Object.entries(this.drafts()).some(([key,text])=>localStorage.getItem(key)!==text))throw new Error('A draft could not be saved. Export progress before reloading and free browser storage.');
  },
  create(){
    this.flush();const data={_codelab:{format:1,exportedAt:new Date().toISOString(),revision:OfflineLibrary.catalog.revision}};
    [...this.arrays,...this.objects].forEach(key=>data[key]=Store.get(key,null));
    if(data.settings){data.settings={...data.settings};delete data.settings.jdoodleId;delete data.settings.jdoodleSecret;}
    data._raw={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(this.raw.test(key))data._raw[key]=localStorage.getItem(key);}
    // Export live models even when autosave cannot write because storage is full.
    Object.assign(data._raw,this.drafts());
    return data;
  },
  export(){try{download('study-lab_progress.json',JSON.stringify(this.create(),null,2),'application/json');}catch(error){Toast.show('Could not export progress: '+error.message,'error');}},
  prepare(data){
    const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
    if(!object(data))throw new Error('Expected a StudyLab progress object.');
    if(data._codelab&&(!object(data._codelab)||data._codelab.format!==1))throw new Error('Unsupported backup version.');
    const allowed=new Set([...this.arrays,...this.objects,'_raw','_codelab']);
    const inspect=(value,depth=0)=>{if(depth>60)throw new Error('Backup is nested too deeply.');if(value&&typeof value==='object')for(const key of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('Invalid object key in backup.');inspect(value[key],depth+1);}};inspect(data);
    const writes=new Map();
    for(const [key,value] of Object.entries(data)){
      if(!allowed.has(key))throw new Error('Unknown progress field: '+key);
      if(value===null||key==='_codelab')continue;
      if(key==='_raw'){
        if(!object(value))throw new Error('Invalid draft collection.');
        for(const [name,text] of Object.entries(value)){if(!this.raw.test(name)||typeof text!=='string')throw new Error('Invalid saved draft key or text.');writes.set(name,text);}
        continue;
      }
      if(this.arrays.includes(key)?!Array.isArray(value):!object(value))throw new Error('Invalid progress field: '+key);
      let imported=value;
      if(key==='settings'){
        imported={...DEFAULT_SETTINGS,...Store.get('settings',{})};
        for(const name of Object.keys(DEFAULT_SETTINGS))if(!['jdoodleId','jdoodleSecret'].includes(name)&&Object.hasOwn(value,name)){
          if(typeof value[name]!==typeof DEFAULT_SETTINGS[name]||(typeof value[name]==='number'&&!Number.isFinite(value[name])))throw new Error('Invalid setting: '+name);
          imported[name]=value[name];
        }
      }
      writes.set('cl_'+key,JSON.stringify(imported));
    }
    if(!writes.size)throw new Error('No saved progress was found in this file.');return writes;
  },
  restore(data){
    if(this.busy())throw new Error('Finish or save and leave the current session before importing progress.');
    const writes=this.prepare(data);this.flush();clearTimeout(Editor.saveTimer);clearTimeout(Playground._t);
    const previous=new Map([...writes.keys()].map(key=>[key,localStorage.getItem(key)]));
    try{for(const [key,value] of writes)localStorage.setItem(key,value);}
    catch(error){
      // Free the attempted writes first, so the previous values fit back in the same quota.
      for(const key of writes.keys())localStorage.removeItem(key);
      for(const [key,value] of previous)if(value!==null)localStorage.setItem(key,value);
      throw new Error('Import could not be saved; previous progress was restored. Check browser storage space.');
    }
    if(Editor.ready&&ProblemView.q)Editor.load(ProblemView.q,Editor.currentLang);
    if(Playground.ready){
      for(const [tab,model] of Object.entries(Playground.webModels))if(writes.has('cl_pg_'+tab))model.setValue(Store.getRaw('pg_'+tab,''));
      if(Playground.lang!=='html'&&writes.has('cl_pg_code_'+Playground.lang))Playground.instance.setValue(Store.getRaw('pg_code_'+Playground.lang,''));
      if(writes.has('cl_pg_stdin'))document.getElementById('pg-stdin').value=Store.getRaw('pg_stdin','');
    }
    SETTINGS=Object.assign({},DEFAULT_SETTINGS,Store.get('settings',{}));UI.applyTheme();Editor.applySettings();Problems.render();
    if(Router.current==='library'){if(OfflineLibrary.selected)OfflineLibrary.reader();else OfflineLibrary.results();}
  },
  choose(){
    if(this.busy()){Toast.show('Finish or save and leave the current session before importing progress.','info');return;}
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.onchange=async()=>{const file=input.files[0];if(!file)return;try{if(file.size>25*1048576)throw new Error('Backup exceeds 25 MiB.');this.restore(JSON.parse(await file.text()));Toast.show('Progress imported successfully.','success');}catch(error){Toast.show('Progress import failed: '+error.message,'error',6000);}};input.click();
  }
};

const OfflineUpdates={
  registration:null,message:'',applying:false,
  async init(){
    this.registration=await OfflineLibrary.registrationPromise;if(!this.registration)return;
    const watch=worker=>{if(!worker)return;worker.addEventListener('statechange',()=>{if(['installed','activated'].includes(worker.state)){this.message='';this.refresh();}});};
    watch(this.registration.installing);this.registration.addEventListener('updatefound',()=>watch(this.registration.installing));
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(this.applying)location.reload();else this.refresh();});this.refresh();
  },
  refresh(){
    const waiting=!!(this.registration?.waiting&&navigator.serviceWorker.controller);
    const status=document.getElementById('offline-update-status');if(status)status.textContent=this.message||(waiting?'An update is ready. Apply it when your session is finished.':'Current offline revision: '+OfflineLibrary.catalog.revision+'.');
    const apply=document.getElementById('apply-codelab-update');if(apply){apply.hidden=!waiting;apply.disabled=this.applying;}
    const button=document.querySelector('.offline-access');if(button)button.textContent='Online / Offline'+(waiting?' · Update ready':'');
  },
  async check(){
    if(!this.registration){this.message='Updates use HTTPS or localhost. For the portable edition, download a fresh copy.';this.refresh();return;}
    this.message='Checking for updates…';this.refresh();
    try{await this.registration.update();this.message=this.registration.installing?'Downloading update. Your current session can continue.':this.registration.waiting?'An update is ready. Apply it when your session is finished.':'You are using the latest available version.';}
    catch(error){this.message='Could not check for updates. Reconnect and try again.';}
    this.refresh();
  },
  async apply(){
    if(this.applying)return;
    if(ProgressBackup.busy()||OfflineLibrary.saving){this.message='Finish or save and leave your session, and wait for running code or offline saving to finish before applying.';this.refresh();return;}
    const worker=this.registration?.waiting;if(!worker){await this.check();return;}
    try{ProgressBackup.flush(true);}catch(error){this.message=error.message;this.refresh();return;}
    this.applying=true;this.message='Applying update…';this.refresh();
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{this.applying=false;this.message='Update did not finish. Close other StudyLab windows, reopen online and retry.';channel.port1.close();this.refresh();},15000);
    channel.port1.onmessage=({data})=>{if(!data.ok){clearTimeout(timer);channel.port1.close();this.applying=false;this.message=data.message;this.refresh();}};
    worker.postMessage({type:'CODELAB_APPLY_UPDATE'},[channel.port2]);
  }
};

const OfflineAccess={
  installEvent:null,
  init(){
    const button=document.createElement('button');button.className='nav-link offline-access';button.textContent='Online / Offline';button.onclick=()=>this.open();document.querySelector('.nav-left').append(button);
    const modal=document.createElement('div');modal.className='modal-overlay';modal.id='modal-offline-access';document.body.append(modal);
    window.addEventListener('online',()=>this.refresh());window.addEventListener('offline',()=>this.refresh());
    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();this.installEvent=event;this.refresh();});
    window.addEventListener('appinstalled',()=>{this.installEvent=null;this.refresh();});
    OfflineUpdates.init();
  },
  async open(){
    UI.close();const h=Academy.h.bind(Academy),portable=!!window.CODELAB_STANDALONE,file=location.protocol==='file:';
    const size=(CODELAB_RUNTIME.bytes/1048576).toFixed(1);
    document.getElementById('modal-offline-access').innerHTML=`<div class="modal offline-access-modal" role="dialog" aria-modal="true" aria-labelledby="offline-access-title"><div class="modal-head"><h2 id="offline-access-title">Use StudyLab online &amp; offline</h2><button class="x-close" aria-label="Close offline access" onclick="UI.close()">×</button></div><div class="modal-body"><p id="connection-state" class="academy-note" role="status"></p><h3>1. Online website</h3><p>Use the same editor, exams and library on your GitHub Pages website. Progress saves as you type in this browser. The local launcher also backs up to the private .codelab-data folder. Export progress to move it to another device or edition.</p><h3>2. Save this website for offline use</h3><p>While connected, save the full app, questions, library, diagrams and the bundled Python, SQL and Monaco engines (${size} MiB of runtime files). Wait for Ready offline before disconnecting.</p><div class="academy-actions"><button class="btn-primary" onclick="OfflineAccess.save()" ${file||portable?'disabled':''}>Save full app for offline</button><button class="btn-ghost" id="install-codelab" onclick="OfflineAccess.install()">Install app</button></div><p id="offline-save-status" class="lib-status" role="status"></p><h3>3. Download &amp; keep a copy</h3>${portable?'<p>This single HTML already contains the reading library, questions and local text editor. JavaScript works offline. For offline Python/SQL and Monaco, use the full ZIP and its local launcher.</p>':`<div class="academy-actions"><a class="btn-ghost" href="/downloads/Pratice-Code-Offline.zip" download>Download full offline ZIP</a><a class="btn-ghost" href="CodeLab-Offline.html" download>Download single HTML</a></div><p>Full ZIP: extract, then run <code>python Start-CodeLab.py</code> (Python 3 required on the computer). It opens a localhost server; no internet or npm is needed. Single HTML: double-click for MCQs, theory, reading and JavaScript.</p>`}<h3>Execution support</h3><p>Full saved app / local ZIP: Python standard library, JavaScript, HTML/CSS preview and SQL execute offline. C, C++ and Java run offline through Start-CodeLab.py / the Vivaldi launcher when GCC/Clang or a Java JDK is installed. Live Server and GitHub Pages use the existing online cloud compiler. Additional Python packages are not bundled.</p><div class="academy-actions"><button class="btn-ghost" onclick="SaveBridge.open()">Saving &amp; local tools</button><button class="btn-ghost" onclick="DataIO.exportProgress()">Export all progress</button><button class="btn-ghost" onclick="DataIO.importProgress()">Import progress</button><button class="btn-ghost" onclick="Py.load()">Reload Python engine</button></div><p>Saved progress belongs to each browser and origin. Export before clearing browser data. Browser-managed offline files can be evicted; the ZIP provides a separate copy.</p><p id="offline-readiness" role="status">Checking saved files…</p></div><div class="modal-foot"><button class="btn-primary" onclick="UI.close()">Done</button></div></div>`;
    const update=document.createElement('section');update.innerHTML='<h3>App updates &amp; progress transfer</h3><div class="academy-actions"><button class="btn-ghost" onclick="OfflineUpdates.check()">Check for updates</button><button class="btn-primary" id="apply-codelab-update" hidden onclick="OfflineUpdates.apply()">Apply update &amp; reload</button></div><p id="offline-update-status" role="status"></p><p>Applying reloads this tab after saving drafts. Finish or save and leave active sessions first; close other StudyLab tabs and installed windows. After updating, save the full app again for offline use. Download a fresh ZIP to update your separate folder copy.</p><p>Progress backups include drafts and attempt history. Compiler API credentials stay in this browser. Import replaces matching saved items; export your current progress first. Older StudyLab progress files are supported.</p>';
    document.querySelector('#modal-offline-access .modal-body').append(update);
    document.getElementById('modal-offline-access').classList.add('show');this.refresh();OfflineUpdates.refresh();
    const state=await RuntimeAssets.saved();const status=document.getElementById('offline-readiness');if(status)status.textContent={ready:'Ready offline. Every required file for this version is saved.',partial:'Offline copy is incomplete. Save the full app while connected.',missing:'Full app is not saved on this browser yet.',portable:'Portable single-HTML reading edition.',folder:'Local folder: use Start-CodeLab.py for offline Python and SQL.',unsupported:'Offline installation needs HTTPS or localhost.'}[state];
  },
  refresh(){const status=document.getElementById('connection-state');if(status)status.textContent=(navigator.onLine?'Online':'Offline')+' · '+(window.CODELAB_STANDALONE?'Single HTML':location.protocol==='file:'?'Local folder':'Website / installed app');const install=document.getElementById('install-codelab');if(install){install.disabled=!this.installEvent;install.title=this.installEvent?'Install on this device':'Use your browser menu → Install app / Add to Home Screen when available.';}},
  async save(){await OfflineLibrary.saveOffline();const state=await RuntimeAssets.saved(),el=document.getElementById('offline-readiness');if(el)el.textContent=state==='ready'?'Ready offline. Every required file for this version is saved.':'Offline copy incomplete. Check the save message and retry.';},
  async install(){if(!this.installEvent)return;await this.installEvent.prompt();await this.installEvent.userChoice;this.installEvent=null;this.refresh();}
};
const platformCacheStatus=OfflineLibrary.cacheStatus.bind(OfflineLibrary);
OfflineLibrary.cacheStatus=function(message){platformCacheStatus(message);const el=document.getElementById('offline-save-status');if(el)el.textContent=message;};
window.addEventListener('DOMContentLoaded',()=>OfflineAccess.init());
