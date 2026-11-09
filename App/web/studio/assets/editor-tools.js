/* An immediate local editor, upgraded to Monaco when its optional CDN becomes available. */
const EditorTools = {
  editors:[], richReady:false,
  model(value='', language='plaintext') {
    return {plain:true,value,language,listeners:new Set(),rich:null,
      getValue(){return this.rich?this.rich.getValue():this.value;},
      setValue(v){v=String(v);if(this.rich){this.rich.setValue(v);return;}this.value=v;this.listeners.forEach(f=>f());},
      getLanguageId(){return this.rich?this.rich.getLanguageId():this.language;},
      dispose(){this.rich?.dispose();this.listeners.clear();}};
  },
  language(model, language) {if(model.plain){model.language=language;if(model.rich)monaco.editor.setModelLanguage(model.rich,language);}else monaco.editor.setModelLanguage(model,language);},
  richModel(model) {
    if(!model.plain)return model;
    if(!model.rich)model.rich=monaco.editor.createModel(model.value,model.language);
    return model.rich;
  },
  create(container, options) {
    const facade={container,options,model:this.model(options.value,options.language),listeners:[],commands:[],rich:null,
      getValue(){return this.rich?this.rich.getValue():this.model.getValue();},
      setValue(v){if(this.rich)this.rich.setValue(v);else this.model.setValue(v);},
      getModel(){return this.rich?this.rich.getModel():this.model;},
      setModel(m){if(this.rich){this.rich.setModel(EditorTools.richModel(m));return;}this.model.listeners.delete(this.update);this.model=m;this.model.listeners.add(this.update);this.update();},
      onDidChangeModelContent(f){this.listeners.push(f);return{dispose:()=>{this.listeners=this.listeners.filter(x=>x!==f);}};},
      addCommand(key,f){this.commands.push([key,f]);if(this.rich)this.rich.addCommand(key,f);},
      getAction(){return this.rich?this.rich.getAction(...arguments):{run:()=>Toast.show('Formatting needs the optional Monaco editor; local editing is available.','info')};},
      updateOptions(o){Object.assign(this.options,o);if(this.rich)this.rich.updateOptions(o);else{this.area.style.fontSize=(this.options.fontSize||14)+'px';this.lines.style.fontSize=(this.options.fontSize||14)+'px';this.area.style.tabSize=this.options.tabSize||4;this.area.wrap=this.options.wordWrap==='on'?'soft':'off';this.lines.hidden=this.options.lineNumbers==='off';}},
      focus(){(this.rich||this.area).focus();},
      dispose(){this.rich?.dispose();this.model.listeners.delete(this.update);this.container.innerHTML='';}};
    container.innerHTML='<div class="local-editor"><div class="local-editor-body"><pre class="local-line-numbers" aria-hidden="true"></pre><textarea class="local-code-input" aria-label="Code editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off"></textarea></div><div class="local-editor-status"><span class="local-position">Ln 1, Col 1</span><span>Local editor · autosave · Tab indent · Ctrl+/ comment</span></div></div>';
    facade.area=container.querySelector('textarea');facade.lines=container.querySelector('pre');
    const position=()=>{let lines=facade.area.value.slice(0,facade.area.selectionStart).split('\n');container.querySelector('.local-position').textContent=`Ln ${lines.length}, Col ${lines.at(-1).length+1} · ${facade.area.value.split('\n').length} lines`;};
    facade.update=()=>{facade.area.value=facade.model.getValue();facade.lines.textContent=Array.from({length:facade.area.value.split('\n').length},(_,i)=>i+1).join('\n');position();facade.listeners.forEach(f=>f());};
    facade.model.listeners.add(facade.update);
    facade.area.addEventListener('input',()=>{const start=facade.area.selectionStart,end=facade.area.selectionEnd;facade.model.setValue(facade.area.value);facade.area.setSelectionRange(start,end);});
    facade.area.addEventListener('scroll',()=>{facade.lines.scrollTop=facade.area.scrollTop;});
    ['click','keyup'].forEach(e=>facade.area.addEventListener(e,position));
    facade.area.addEventListener('keydown',e=>{
      const a=facade.area,start=a.selectionStart,end=a.selectionEnd;
      if(a.readOnly)return;
      if(e.key==='Tab'){e.preventDefault();a.setRangeText(' '.repeat(SETTINGS.tabSize||4),start,end,'end');a.dispatchEvent(new Event('input'));}
      else if(e.key==='Enter'){e.preventDefault();const line=a.value.slice(0,start).split('\n').at(-1);let indent=line.match(/^\s*/)[0];if(/[:{]\s*$/.test(line))indent+=' '.repeat(SETTINGS.tabSize||4);a.setRangeText('\n'+indent,start,end,'end');a.dispatchEvent(new Event('input'));}
      else if((e.ctrlKey||e.metaKey)&&e.key==='/'){e.preventDefault();const begin=a.value.lastIndexOf('\n',start-1)+1;let stop=a.value.indexOf('\n',end);if(stop<0)stop=a.value.length;const prefix=facade.model.getLanguageId()==='python'?'#':'//';const text=a.value.slice(begin,stop).split('\n');const uncomment=text.every(l=>l.trimStart().startsWith(prefix));const revised=text.map(l=>uncomment?l.replace(new RegExp('^(\\s*)'+prefix+' ?'),'$1'):prefix+' '+l).join('\n');a.setRangeText(revised,begin,stop,'select');a.dispatchEvent(new Event('input'));}
    });
    const updateOptions=facade.updateOptions.bind(facade);
    facade.updateOptions=o=>{updateOptions(o);facade.area.readOnly=!!facade.options.readOnly;};
    facade.update();facade.updateOptions(options);this.editors.push(facade);
    if(this.richReady)this.upgrade(facade);
    return facade;
  },
  upgrade(f) {
    if(f.rich)return;
    const model=this.richModel(f.model);f.model.listeners.delete(f.update);f.container.innerHTML='';
    f.rich=monaco.editor.create(f.container,{...f.options,model,value:undefined,language:undefined});
    f.rich.onDidChangeModelContent(()=>f.listeners.forEach(fn=>fn()));
    f.commands.forEach(([key,fn])=>f.rich.addCommand(key,fn));
    const problem=f.container.id==='monaco-container';
    f.rich.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.Enter,()=>problem?Runner.run():Playground.run());
    if(problem)f.rich.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyMod.Shift|monaco.KeyCode.Enter,()=>Runner.submit());
    f.rich.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.KeyS,()=>{if(problem)Editor.save();else Playground.save();Toast.show('Draft saved','success');});
  },
  initRich() {
    if(window.CODELAB_DISABLE_MONACO)return;
    if(typeof require==='undefined'&&typeof RuntimeAssets!=='undefined'){
      RuntimeAssets.script(RuntimeAssets.base('monaco')+'vs/loader.js').then(()=>this.initRich()).catch(()=>{});return;
    }
    let tries=0;
    const tryLoad=()=>{
      if(typeof require==='undefined'){if(tries++<100)setTimeout(tryLoad,150);return;}
      require.config({paths:{vs:window.CODELAB_MONACO_BASE||(typeof RuntimeAssets!=='undefined'?RuntimeAssets.base('monaco')+'vs':'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs')}});
      require(['vs/editor/editor.main'],()=>{this.richReady=true;registerSnippets();this.editors.forEach(f=>this.upgrade(f));},()=>{});
    };
    tryLoad();
  },
  theme(){if(this.richReady)monaco.editor.setTheme(SETTINGS.theme==='light'?'vs':'vs-dark');},
  exportCurrent(){const pg=Router.current==='playground',inst=pg?Playground.instance:Editor.instance;if(!inst)return;const lang=pg?Playground.lang:Editor.currentLang;download('solution.'+({python:'py',javascript:'js',cpp:'cpp',java:'java',c:'c',sql:'sql',html:'html'}[lang]||'txt'),inst.getValue(),'text/plain');},
  importCurrent(input){const file=input.files[0];if(!file)return;const inst=Router.current==='playground'?Playground.instance:Editor.instance;if(!inst)return;file.text().then(text=>{inst.setValue(text);Toast.show('File loaded. Your editor draft has been updated.','success');});input.value='';},
  focusMode(){document.body.classList.toggle('editor-focus');},
  stop(){if(JsRun.stop)JsRun.stop();if(Py.pending){Py.stop();Py.load();}Toast.show('Execution stopped.','info');}
};
// JS runs away from the UI thread so a non-terminating loop can be stopped.
Object.assign(JsRun,{
  workers:new Set(),
  stop(){for(const job of this.workers)job.cancel();},
  run(code,stdin,timeoutMs){
    return new Promise((resolve,reject)=>{
      const source=`self.onmessage=async({data})=>{const lines=data.stdin.split('\\n');let i=0;const readline=()=>lines[i++]??'';const input=readline;const prompt=readline;let out=[];const write=(...a)=>{if(out.length>=10000)throw Error('Output limit exceeded');out.push(a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '));};const console={log:write,error:write,warn:write,info:write};try{await new Function('readline','input','prompt','console',data.code)(readline,input,prompt,console);self.postMessage({stdout:out.join('\\n'),stderr:''});}catch(e){self.postMessage({stdout:out.join('\\n'),stderr:e.stack||String(e)});}};`;
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));const worker=new Worker(url);let finished=false;
      const cleanup=()=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);this.workers.delete(job);};
      const job={cancel:()=>{cleanup();reject(new Error('Execution stopped by you.'));}};
      const timer=setTimeout(()=>{cleanup();reject({kind:'tle'});},timeoutMs);this.workers.add(job);
      worker.onmessage=e=>{cleanup();resolve(e.data);};worker.onerror=e=>{e.preventDefault();cleanup();reject(new Error(e.message));};worker.postMessage({code,stdin});
    });
  }
});
window.addEventListener('DOMContentLoaded',()=>{
  EditorTools.initRich();
  const stdin=document.getElementById('pg-stdin');stdin.value=Store.getRaw('pg_stdin','');stdin.addEventListener('input',()=>Store.setRaw('pg_stdin',stdin.value));
  document.querySelectorAll('.editor-toolbar').forEach(bar=>{
    const actions=document.createElement('span');actions.className='editor-file-actions';
    actions.innerHTML='<label class="tb-btn">Open file<input type="file" accept=".py,.js,.c,.cpp,.java,.sql,.txt,.html,.css" hidden onchange="EditorTools.importCurrent(this)"></label><button class="tb-btn" onclick="EditorTools.exportCurrent()">Download code</button><button class="tb-btn" onclick="EditorTools.stop()" title="Stop JavaScript / Python execution">■ Stop run</button><button class="tb-btn" onclick="EditorTools.focusMode()">Focus</button>';
    bar.append(actions);
  });
});
