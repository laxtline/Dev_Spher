'use strict';
const LocalBridge={
  capabilities:null,promise:null,
  async load(force=false){
    if(force)this.promise=null;
    if(!this.promise)this.promise=(async()=>{
      if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname)||window.CODELAB_STANDALONE)return null;
      try{const response=await fetch(new URL('__codelab__/capabilities',document.baseURI),{cache:'no-store',signal:AbortSignal.timeout(2500)});if(!response.ok)return null;const data=await response.json();if(data.app==='CodeLab'&&data.token){this.capabilities=data;return data;}}catch{}return null;
    })();return this.promise;
  },
  async request(path,data,retry=true){
    const capabilities=await this.load();if(!capabilities)throw new Error('Open the Pratice Code app or use Start Pratice Code.cmd for folder saving and local compilers.');
    const response=await fetch(new URL('__codelab__/'+path,document.baseURI),{method:data===undefined?'GET':'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-CodeLab-Token':capabilities.token},...(data===undefined?{}:{body:JSON.stringify(data)})});
    if(response.status===403&&retry){await this.load(true);return this.request(path,data,false);}
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Local server request failed.');return result;
  }
};
const SaveBridge={
  clock:{},device:'',pending:new Set(),syncing:false,paused:false,lastFolder:null,error:'',nativeSet:Storage.prototype.setItem,nativeRemove:Storage.prototype.removeItem,
  allowed(key){return ProgressBackup.raw.test(key)||[...ProgressBackup.arrays,...ProgressBackup.objects].some(name=>key==='cl_'+name);},
  clean(key,value){if(key!=='cl_settings'||value===null)return value;const settings=JSON.parse(value);delete settings.jdoodleId;delete settings.jdoodleSecret;return JSON.stringify(settings);},
  changed(key){
    if(this.paused||!this.allowed(key))return;
    this.clock[key]={updatedAt:Math.max(Date.now(),(this.clock[key]?.updatedAt||0)+1),device:this.device};this.pending.add(key);
    this.nativeSet.call(localStorage,'cl_sync_clock',JSON.stringify(this.clock));this.error='';this.status();clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync(),700);
  },
  status(){const el=document.getElementById('save-status');if(!el)return;el.dataset.error=String(!!this.error);el.textContent=this.error?'Save needs attention':LocalBridge.capabilities?(this.pending.size?'Saved in browser · folder pending':'Saved in browser + folder'):'Saved in this browser';el.title=this.error||'Browser save is immediate, online or offline. '+(this.lastFolder?'Folder backup: '+new Date(this.lastFolder).toLocaleTimeString():'Use the local launcher for an automatic private folder backup.');},
  init(){
    this.device=Store.getRaw('sync_device','')||crypto.randomUUID();this.nativeSet.call(localStorage,'cl_sync_device',this.device);
    this.clock=Store.get('sync_clock',{});
    const indicator=document.createElement('button');indicator.id='save-status';indicator.className='save-indicator btn-ghost';indicator.onclick=()=>this.open();document.querySelector('.nav-right').prepend(indicator);
    const bridge=this;
    Storage.prototype.setItem=function(key,value){try{const old=this.getItem(key);bridge.nativeSet.call(this,key,value);if(this===localStorage&&old!==String(value))bridge.changed(key);}catch(error){bridge.error='Browser storage is full or unavailable. Export progress to protect live drafts.';bridge.status();throw error;}};
    Storage.prototype.removeItem=function(key){const existed=this.getItem(key)!==null;bridge.nativeRemove.call(this,key);if(this===localStorage&&existed)bridge.changed(key);};
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(this.allowed(key)){if(!this.clock[key])this.clock[key]={updatedAt:1,device:this.device};this.pending.add(key);}}
    // Additional listeners save editor changes immediately, ahead of legacy debounce timers.
    const create=EditorTools.create.bind(EditorTools);
    const attach=editor=>{if(editor._liveSave)return;editor._liveSave=true;editor.onDidChangeModelContent(()=>{if(editor.container.id==='monaco-container')Editor.save();else if(editor.container.id==='pg-monaco')Playground.save();});};
    EditorTools.create=function(container,options){const editor=create(container,options);attach(editor);return editor;};EditorTools.editors.forEach(attach);
    window.addEventListener('pagehide',()=>{ProgressBackup.flush();ClassicSave.persist();LearningTiming.flush();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){ProgressBackup.flush();ClassicSave.persist();LearningTiming.flush();}else this.sync();});
    window.addEventListener('online',()=>this.sync());
    window.addEventListener('storage',event=>{if(this.allowed(event.key)){this.clock=Store.get('sync_clock',this.clock);this.status();}});
    LocalBridge.load().then(()=>{this.status();this.sync();});setInterval(()=>this.sync(),12000);this.status();
  },
  async sync(){
    if(this.syncing||this.conflicts)return;const capabilities=await LocalBridge.load();if(!capabilities?.folderBackup)return;
    this.syncing=true;
    try{
      const remote=await LocalBridge.request('progress'),changes=[];const conflicts=[];
      for(const [key,record] of Object.entries(remote.records||{})){
        if(!this.allowed(key))continue;const local=localStorage.getItem(key),clock=this.clock[key];
        if(clock?.updatedAt===1&&local!==null&&this.clean(key,local)!==this.clean(key,record.value)){conflicts.push([key,record]);continue;}
        if(!clock||record.updatedAt>clock.updatedAt||(record.updatedAt===clock.updatedAt&&record.device>clock.device))changes.push([key,record]);
      }
      if(conflicts.length){this.conflicts=conflicts;this.error='Browser and folder both contain different progress. Open Save status to choose which matching items to keep.';this.status();return;}
      this.paused=true;
      try{for(const [key,record] of changes){
        let value=record.value;if(key==='cl_settings'&&value!==null){const current=Store.get('settings',{});value=JSON.stringify({...JSON.parse(value),jdoodleId:current.jdoodleId||'',jdoodleSecret:current.jdoodleSecret||''});}
        if(value===null)this.nativeRemove.call(localStorage,key);else this.nativeSet.call(localStorage,key,value);
        this.clock[key]={updatedAt:record.updatedAt,device:record.device};this.pending.delete(key);
      }}finally{this.paused=false;}
      if(changes.length)this.refreshViews(changes.map(([key])=>key));
      const records={};for(const key of this.pending){let clock=this.clock[key];if(clock.updatedAt===1)clock=this.clock[key]={updatedAt:Date.now(),device:this.device};records[key]={...clock,value:this.clean(key,localStorage.getItem(key))};}
      if(Object.keys(records).length){await LocalBridge.request('progress',{format:1,records});for(const [key,record] of Object.entries(records))if(this.clock[key]?.updatedAt===record.updatedAt)this.pending.delete(key);}
      this.nativeSet.call(localStorage,'cl_sync_clock',JSON.stringify(this.clock));this.lastFolder=Date.now();this.error='';
    }catch(error){this.error='Browser save is retained; folder backup will retry. '+error.message;}
    finally{this.syncing=false;this.status();}
  },
  refreshViews(keys){
    clearTimeout(Editor.saveTimer);clearTimeout(Playground._t);
    if(Editor.ready&&ProblemView.q&&keys.includes('cl_code_'+ProblemView.q.id+'_'+Editor.currentLang))Editor.load(ProblemView.q,Editor.currentLang);
    if(Playground.ready){for(const [tab,model] of Object.entries(Playground.webModels))if(keys.includes('cl_pg_'+tab))model.setValue(Store.getRaw('pg_'+tab,''));const key='cl_pg_code_'+Playground.lang;if(keys.includes(key))Playground.instance.setValue(Store.getRaw('pg_code_'+Playground.lang,''));}
    if(keys.includes('cl_settings')){SETTINGS=Object.assign({},DEFAULT_SETTINGS,Store.get('settings',{}));UI.applyTheme();Editor.applySettings();}
    if(Router.current==='study'&&Study.lesson)for(const [id,key] of [['study-personal-notes','cl_study_notes_'],['study-example-code','cl_study_code_']]){const el=document.getElementById(id);if(el&&keys.includes(key+Study.lesson.id))el.value=Store.getRaw(key.slice(3)+Study.lesson.id,'');}
    if(Router.current==='dashboard')Learning.dashboard();
  },
  resolve(useFolder){
    const list=this.conflicts||[];this.paused=true;
    try{for(const [key,record] of list){if(useFolder){let value=record.value;if(key==='cl_settings'&&value!==null){const current=Store.get('settings',{});value=JSON.stringify({...JSON.parse(value),jdoodleId:current.jdoodleId||'',jdoodleSecret:current.jdoodleSecret||''});}if(value===null)this.nativeRemove.call(localStorage,key);else this.nativeSet.call(localStorage,key,value);this.clock[key]={updatedAt:record.updatedAt,device:record.device};this.pending.delete(key);}else{this.clock[key]={updatedAt:Math.max(Date.now(),record.updatedAt+1),device:this.device};this.pending.add(key);}}}finally{this.paused=false;}
    this.conflicts=null;this.error='';this.nativeSet.call(localStorage,'cl_sync_clock',JSON.stringify(this.clock));if(useFolder)this.refreshViews(list.map(([key])=>key));UI.close();this.sync();
  },
  async open(){
    UI.close();let modal=document.getElementById('modal-save-status');if(!modal){modal=document.createElement('div');modal.className='modal-overlay';modal.id='modal-save-status';document.body.append(modal);}
    const capabilities=await LocalBridge.load();
    modal.innerHTML=`<div class="modal"><div class="modal-head"><h2>Saving &amp; local tools</h2><button class="x-close" onclick="UI.close()" aria-label="Close saving status">×</button></div><div class="modal-body"><p>Activity, progress, saved code, drafts and notes save automatically while you work, including offline.</p><p>${capabilities?'Your work is also saved in this app or project folder at studio-private/.codelab-data/progress.json. The app keeps its own folder, and the local website keeps its project folder.':'For automatic folder saving, open the Pratice Code app or use Start Pratice Code.cmd from your project folder.'}</p><p>Local compilers: ${capabilities?.languages.length?capabilities.languages.map(l=>OfflineLibrary.label(l)).join(', '):'none detected'}. C/C++ need GCC or Clang; Java needs a JDK. Restart the launcher after installing a compiler. Native programs run with your computer account permissions.</p><p>GitHub Pages and other devices have separate browser storage. They do not automatically sync with this local folder.</p><p role="status">${OfflineLibrary.h(this.error||'Browser saving is available.')}</p>${this.conflicts?`<p>${this.conflicts.length} matching saved items differ between this browser and the existing folder backup. Other items are preserved. Export this browser before choosing.</p><div class="academy-actions"><button class="btn-primary" onclick="SaveBridge.resolve(false)">Keep browser versions</button><button class="btn-ghost" onclick="SaveBridge.resolve(true)">Restore folder versions</button></div>`:''}<div class="academy-actions">${window.chrome?.webview?`<button class="btn-ghost" onclick="chrome.webview.postMessage('pratice-open-saves')">Open saved data folder</button>`:''}<button class="btn-ghost" onclick="DataIO.exportProgress()">Export progress</button><button class="btn-ghost" onclick="DataIO.importProgress()">Import progress</button><button class="btn-ghost" onclick="SaveBridge.sync()">Retry folder backup</button></div></div><div class="modal-foot"><button class="btn-primary" onclick="UI.close()">Done</button></div></div>`;modal.classList.add('show');
  }
};
const originalCloudRun=Cloud.run.bind(Cloud);
Cloud.run=async function(language,code,stdin){
  const capabilities=await LocalBridge.load();
  if(capabilities?.languages.includes(language)){
    const result=await LocalBridge.request('run',{language,code,stdin,timeout:Math.max(.1,Math.min(15,SETTINGS.timeout||5))});
    if(result.status==='timeout')throw {kind:'tle'};
    return {...result,compileError:result.status==='compile-error'};
  }
  if(!navigator.onLine)throw {kind:'notready',message:'Offline compiler unavailable. Use the local launcher with GCC/Clang or a Java JDK installed.'};
  return originalCloudRun(language,code,stdin);
};
