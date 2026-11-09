/* Workspace and language execution shared by the desktop, website and portable HTML. */
'use strict';
const LanguageLab={
  version:'1.4.0',files:[],active:'',controllers:new Set(),jobs:new Set(),compilerPromise:null,
  languages:{
    python:{label:'Python',ext:'py',service:'Python',sample:'print("Hello, Python!")\n'},
    javascript:{label:'JavaScript',ext:'js',service:'JavaScript',sample:'console.log("Hello, JavaScript!");\n'},
    typescript:{label:'TypeScript',ext:'ts',service:'TypeScript',sample:'const name: string = "TypeScript";\nconsole.log(`Hello, ${name}!`);\n'},
    c:{label:'C',ext:'c',service:'C',sample:'#include <stdio.h>\nint main(void) { puts("Hello, C!"); return 0; }\n'},
    cpp:{label:'C++',ext:'cpp',service:'C++',sample:'#include <iostream>\nint main() { std::cout << "Hello, C++!" << std::endl; }\n'},
    java:{label:'Java',ext:'java',service:'Java',sample:'public class Main { public static void main(String[] args) { System.out.println("Hello, Java!"); } }\n'},
    csharp:{label:'C#',ext:'cs',service:'C#',sample:'using System;\nclass Program { static void Main() { Console.WriteLine("Hello, C#!"); } }\n'},
    go:{label:'Go',ext:'go',service:'Go',sample:'package main\nimport "fmt"\nfunc main() { fmt.Println("Hello, Go!") }\n'},
    rust:{label:'Rust',ext:'rs',service:'Rust',sample:'fn main() { println!("Hello, Rust!"); }\n'},
    php:{label:'PHP',ext:'php',service:'PHP',sample:'<?php\necho "Hello, PHP!\\n";\n'},
    ruby:{label:'Ruby',ext:'rb',service:'Ruby',sample:'puts "Hello, Ruby!"\n'},
    bash:{label:'Bash',ext:'sh',service:'Bash script',sample:'echo "Hello, Bash!"\n'},
    swift:{label:'Swift',ext:'swift',service:'Swift',sample:'print("Hello, Swift!")\n'},
    scala:{label:'Scala',ext:'scala',service:'Scala',sample:'object Main { def main(args: Array[String]): Unit = println("Hello, Scala!") }\n'},
    groovy:{label:'Groovy',ext:'groovy',service:'Groovy',sample:'println "Hello, Groovy!"\n'},
    perl:{label:'Perl',ext:'pl',service:'Perl',sample:'print "Hello, Perl!\\n";\n'},
    lua:{label:'Lua',ext:'lua',service:'Lua',sample:'print("Hello, Lua!")\n'},
    r:{label:'R',ext:'r',service:'R',sample:'cat("Hello, R!\\n")\n'},
    julia:{label:'Julia',ext:'jl',service:'Julia',sample:'println("Hello, Julia!")\n'},
    haskell:{label:'Haskell',ext:'hs',service:'Haskell',sample:'main = putStrLn "Hello, Haskell!"\n'},
    elixir:{label:'Elixir',ext:'exs',service:'Elixir',sample:'IO.puts("Hello, Elixir!")\n'},
    erlang:{label:'Erlang',ext:'erl',service:'Erlang',sample:'-module(prog).\n-export([main/0]).\nmain() -> io:format("Hello, Erlang!~n").\n'},
    d:{label:'D',ext:'d',service:'D',sample:'import std.stdio;\nvoid main() { writeln("Hello, D!"); }\n'},
    pascal:{label:'Pascal',ext:'pas',service:'Pascal',sample:'program Hello;\nbegin writeln(\'Hello, Pascal!\'); end.\n'},
    lisp:{label:'Common Lisp',ext:'lisp',service:'Lisp',sample:'(format t "Hello, Lisp!~%")\n'},
    ocaml:{label:'OCaml',ext:'ml',service:'OCaml',sample:'print_endline "Hello, OCaml!";;\n'},
    crystal:{label:'Crystal',ext:'cr',service:'Crystal',sample:'puts "Hello, Crystal!"\n'},
    nim:{label:'Nim',ext:'nim',service:'Nim',sample:'echo "Hello, Nim!"\n'},
    zig:{label:'Zig',ext:'zig',service:'Zig',sample:'const std = @import("std");\npub fn main() void { std.debug.print("Hello, Zig!\\n", .{}); }\n'},
    sql:{label:'SQL · SQLite',ext:'sql'},mongodb:{label:'MongoDB · in-memory queries',ext:'mongo'},html:{label:'HTML / CSS / JavaScript',ext:'html'}
  },
  detect(path){const ext=path.split('.').pop().toLowerCase();return ({mjs:'javascript',cjs:'javascript',mts:'typescript',cts:'typescript',h:'c',hpp:'cpp',cc:'cpp',cxx:'cpp',htm:'html',css:'html',json:'json',ex:'elixir',sc:'scala',bash:'bash',p:'pascal',cl:'lisp',mli:'ocaml',vim:'vim'})[ext]||Object.keys(this.languages).find(k=>this.languages[k].ext===ext)||null;},
  async compilers(){
    if(!this.compilerPromise)this.compilerPromise=fetch('https://wandbox.org/api/list.json',{signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw Error('Online compiler catalog: HTTP '+r.status);return r.json();}).catch(e=>{this.compilerPromise=null;throw e;});
    return this.compilerPromise;
  },
  chooseCompiler(language,catalog){
    const spec=this.languages[language];if(!spec)throw Error('Unsupported language: '+language);
    const rows=catalog.filter(c=>c.language===spec.service);
    const stable=rows.filter(c=>!/head|experimental/i.test(c.name+' '+c.version));
    const preferred=window.CODELAB_COMPILER_PREFERENCES?.[language];
    const chosen=rows.find(c=>c.name===preferred)||(language==='csharp'?stable.find(c=>c.name.startsWith('mono-')):null)||stable[0]||rows[0];
    if(!chosen)throw Error(spec.label+' is currently unavailable on the online compiler.');return chosen;
  },
  async remote(language,code,stdin,files=[]){
    if(window.CODELAB_LANGUAGE_AVAILABILITY?.[language]===false)throw Error(this.languages[language].label+' runtime is temporarily unavailable on the compiler service. Your file can still be edited and saved.');
    if(!navigator.onLine)throw Error(this.languages[language].label+' needs an internet connection or a matching local compiler. Python, JavaScript, TypeScript, SQL and web previews can run offline.');
    const controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),45000);
    try{
      const compiler=this.chooseCompiler(language,await this.compilers());
      const body={compiler:compiler.name,code,stdin,save:false};
      const related=files.filter(f=>language==='cpp'?/\.(c|cc|cpp|cxx|h|hpp)$/i.test(f.path):this.detect(f.path)===language);
      if(related.length)body.codes=related.map(f=>({file:f.path,code:f.code}));
      if(language==='java'){
        const entry=/\bpublic\s+(?:final\s+|abstract\s+)?class\s+(\w+)/.exec(code)?.[1]||/\bclass\s+(\w+)/.exec(code)?.[1]||'Main';
        const pkg=/^\s*package\s+([\w.]+)\s*;/m.exec(code)?.[1];
        if(entry!=='prog'||pkg){body.code='class prog { public static void main(String[] args) throws Exception { '+(pkg?pkg+'.':'')+entry+'.main(args); } }';body.codes=[{file:(pkg?pkg.replaceAll('.','/')+'/':'')+entry+'.java',code},...(body.codes||[])];}
      }
      const response=await fetch('https://wandbox.org/api/compile.json',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      if(response.status===429)throw Error('The online compiler is busy. Please wait a minute before running again. Your code is saved.');
      if(!response.ok)throw Error('Online compiler returned HTTP '+response.status+'. Retry or use a local compiler.');
      const result=await response.json();if(result.error)throw Error(result.error);
      const exitCode=Number(result.status||0),compileError=!!exitCode&&!!result.compiler_error&&!result.program_output&&!result.program_error;
      return {stdout:result.program_output||'',stderr:[result.compiler_error,result.program_error,result.signal?`Signal: ${result.signal}`:''].filter(Boolean).join('\n'),exitCode,compileError,engine:compiler.name};
    }catch(e){if(e.name==='AbortError')throw Error('Execution stopped or the online compiler timed out.');throw e;}
    finally{clearTimeout(timer);this.controllers.delete(controller);}
  },
  async source(name){
    const key={typescript:'CODELAB_TYPESCRIPT_SOURCE',typescriptLibs:'CODELAB_TYPESCRIPT_LIBS',worker:'CODELAB_LAB_WORKER_SOURCE',mingo:'CODELAB_MINGO_SOURCE'}[name];
    if(window[key])return window[key];
    const path={typescript:'vendor/typescript/typescript.js',typescriptLibs:'vendor/typescript/lib-data.json',worker:'assets/lab-worker.js',mingo:'vendor/mingo/mingo.min.js'}[name];
    const response=await fetch(new URL(path,document.baseURI));if(!response.ok)throw Error('Runtime file missing: '+path);return window[key]=await response.text();
  },
  async worker(language,code,stdin,filename,files=[]){
    const source=await this.source('worker');
    const needsTs=language==='typescript'||[code,...files.map(f=>f.code)].some(c=>/(^|\n)\s*(import\s|export\s)/.test(c));
    const data={language,code,stdin,filename,files,typescriptSource:needsTs?await this.source('typescript'):null,typescriptLibs:language==='typescript'?await this.source('typescriptLibs'):null,mingoSource:language==='mongodb'?await this.source('mingo'):null};
    if(language==='mongodb'&&stdin.trim()){try{data.collections=JSON.parse(stdin);if(!data.collections||Array.isArray(data.collections)||Object.values(data.collections).some(v=>!Array.isArray(v)))throw Error();}catch{throw Error('MongoDB Input must be a JSON object of collection arrays, such as {"employees": [...]} .');}}
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url);let finished=false;
      const clean=()=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);this.jobs.delete(job);};
      const job={cancel:()=>{clean();reject(Error('Execution stopped by you.'));}};
      const timer=setTimeout(()=>{clean();reject({kind:'tle',message:'Time limit exceeded.'});},Math.max(1,SETTINGS.timeout||5)*1000);this.jobs.add(job);
      worker.onmessage=({data})=>{if(data.type==='output'){if(Playground.busy)this.showOutput(data,false);return;}if(data.type==='done'){clean();resolve(data);}};
      worker.onerror=e=>{e.preventDefault();clean();reject(Error(e.message||'The program could not be started.'));};worker.postMessage(data);
    });
  },
  async execute(language,code,stdin='',filename='',files=[]){
    const started=performance.now();let result;
    if(['javascript','typescript','mongodb'].includes(language))result=await this.worker(language,code,stdin,filename||'main.'+this.languages[language].ext,files);
    else if(language==='python'){await Py.load();result=await Py.run(files.length?this.pythonProgram(code,filename||'main.py',files):code,stdin,Math.max(1,SETTINGS.timeout||5)*1000);}
    else if(language==='sql'){await SqlRun.load();SqlRun.resetDb();try{result={stdout:SqlRun.fmtTable(SqlRun.db.exec(code)),stderr:'',exitCode:0};}catch(e){result={stdout:'',stderr:'SQL Error: '+e.message,exitCode:1};}}
    else{
      const caps=await LocalBridge.load();
      result=caps?.languages.includes(language)?await LocalBridge.request('run',{language,code,stdin,timeout:Math.max(.1,Math.min(15,SETTINGS.timeout||5))}):await this.remote(language,code,stdin,files);
    }
    return {...result,time:performance.now()-started};
  },
  showOutput(result,finished=true){
    const output=document.getElementById('pg-output');if(!output)return;
    output.innerHTML=(result.stdout?'<span class="ok">'+esc(result.stdout)+'</span>':'')+(result.stderr?'<span class="err">'+(result.stdout?'\n':'')+esc(result.stderr)+'</span>':'')||'<span class="pg-placeholder">'+(finished?'Finished without printed output. Use print / console.log to print a value.':'Running…')+'</span>';
    if(finished){const failed=result.compileError||(result.exitCode!==undefined?result.exitCode!==0:!!result.stderr?.trim());const meta=document.createElement('div');meta.className='meta';meta.textContent=(failed?'Finished with errors':'Finished')+' · '+Math.round(result.time||0)+' ms'+(result.engine?' · '+result.engine:'');output.append(meta);document.getElementById('pg-status-lbl').textContent=failed?'Errors':'Finished';}
    Playground.lastOutput=(result.stdout||'')+(result.stderr?(result.stdout?'\n':'')+result.stderr:'');
  },
  stop(){for(const job of [...this.jobs])job.cancel();for(const controller of this.controllers)controller.abort();if(Py.pending){Py.stop();Py.load();}},
  pythonProgram(code,filename,files){
    const payload=JSON.stringify({code,filename,files});
    return `import json as __lab_json, pathlib as __lab_path, tempfile as __lab_temp, os as __lab_os, sys as __lab_sys
__lab_request=__lab_json.loads(${JSON.stringify(payload)})
__lab_cwd=__lab_os.getcwd()
__lab_search=__lab_sys.path[:]
with __lab_temp.TemporaryDirectory(prefix='coding-lab-') as __lab_directory:
    __lab_root=__lab_path.Path(__lab_directory)
    for __lab_file in __lab_request['files']+[{'path':__lab_request['filename'],'code':__lab_request['code']}]:
        __lab_target=(__lab_root/__lab_file['path']).resolve()
        if not __lab_target.is_relative_to(__lab_root): raise ValueError('Invalid workspace path')
        __lab_target.parent.mkdir(parents=True,exist_ok=True)
        __lab_target.write_text(__lab_file['code'],encoding='utf-8')
    __lab_main=__lab_root/__lab_request['filename']
    __lab_os.chdir(__lab_main.parent)
    __lab_sys.path.insert(0,str(__lab_main.parent))
    try:
        exec(compile(__lab_request['code'],str(__lab_main),'exec'),{'__name__':'__main__','__file__':str(__lab_main)})
    finally:
        __lab_os.chdir(__lab_cwd)
        __lab_sys.path[:]=__lab_search
        for __lab_name,__lab_module in list(__lab_sys.modules.items()):
            if str(getattr(__lab_module,'__file__','')).startswith(str(__lab_root)):
                __lab_sys.modules.pop(__lab_name,None)
`;
  },
  capture(){if(!Playground.ready||this.switching)return;const f=this.files.find(f=>f.path===this.active);if(f){if(f.path.endsWith('.css'))f.code=Playground.webModel('css').getValue();else if(f.path.endsWith('.html')||f.path.endsWith('.htm'))f.code=Playground.webModel('html').getValue();else f.code=Playground.instance.getValue();}this.persist();},
  persist(){if(this.files.reduce((n,f)=>n+f.code.length,0)>4*1024**2){Toast.show('Workspace is too large for autosave. Download your changed files.','info');return;}Store.setRaw('pg_workspace_v1',JSON.stringify({active:this.active,files:this.files}));},
  open(path){
    this.capture();const file=this.files.find(f=>f.path===path);if(!file)return;this.active=path;this.switching=true;
    const language=this.detect(path);document.getElementById('pg-lang').value=language==='json'?'javascript':language||'javascript';if(language==='json'){Playground.changeLang('javascript');EditorTools.language(Playground.instance.getModel(),'json');Playground.instance.setValue(file.code);}
    else if(language==='html'){
      Playground.changeLang('html');const tab=path.endsWith('.css')?'css':'html';Playground.webTab(tab);Playground.instance.setValue(file.code);
    }else{Playground.changeLang(language||'javascript');document.getElementById('pg-lang').value=language||'javascript';Playground.instance.setValue(file.code);}
    this.switching=false;Playground.save();this.persist();this.render();if(language==='html')Playground.renderPreview();
  },
  render(){
    const list=document.getElementById('lab-files'),tabs=document.getElementById('lab-tabs');if(!list||!tabs)return;list.replaceChildren();tabs.replaceChildren();
    for(const file of this.files){for(const [container,label] of [[list,file.path],[tabs,file.path.split('/').pop()]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.title=file.path;button.className=file.path===this.active?'active':'';button.onclick=()=>this.open(file.path);container.append(button);}}
    document.getElementById('lab-workspace').hidden=!this.files.length;
    const hint=document.getElementById('lab-file-status');if(hint)hint.textContent=this.active||'Untitled · changes save automatically';
  },
  async importFiles(input){
    const picked=[...input.files];input.value='';if(!picked.length)return;
    this.capture();let first='';
    try{
      for(const file of picked){const path=(file.webkitRelativePath||file.name).replaceAll('\\','/');if(path.split('/').some(s=>['.git','node_modules','.venv','__pycache__'].includes(s))||!this.detect(path))continue;
        if(file.size>1024**2)throw Error(file.name+' exceeds the 1 MiB source-file limit.');
        const text=await file.text();const previous=this.files.find(f=>f.path===path);if(previous)previous.code=text;else{if(this.files.length>=250)throw Error('Open up to 250 source files per workspace.');this.files.push({path,code:text});}first||=path;
      }
      if(!first)throw Error('Choose supported source files, such as .js, .ts, .py, .sql, .html, .css, .c or .java.');
      Router.go('playground');Playground.init();this.active='';this.open(first);Toast.show('Files opened. Select a tab and press Run.','success');
    }catch(e){Toast.show(e.message,'error');this.render();}
  },
  newFile(){const path=prompt('File name, including extension','main.js');if(!path)return;if(!this.detect(path)||path.includes('..')||path.startsWith('/')){Toast.show('Use a supported file extension and a relative file name.','error');return;}if(this.files.some(f=>f.path===path)){this.open(path);return;}this.capture();this.files.push({path,code:this.languages[this.detect(path)]?.sample||''});Router.go('playground');Playground.init();this.open(path);},
  downloadActive(){this.capture();const file=this.files.find(f=>f.path===this.active);if(file)download(file.path.split('/').pop(),file.code,'text/plain');else EditorTools.exportCurrentOriginal();},
  buildWeb(){
    this.capture();const current=this.files.find(f=>f.path===this.active);let html=(current&&!current.path.endsWith('.css')?current.code:null)||this.files.find(f=>/\.html?$/i.test(f.path))?.code||Playground.webModel('html').getValue();
    const directory=(current?.path||'').split('/').slice(0,-1).join('/');const find=p=>{const full=(directory?directory+'/':'')+p.replace(/^\.\//,'');return this.files.find(f=>f.path===full)||this.files.find(f=>f.path===p);};
    html=html.replace(/<link\b([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,(tag,a,path)=>{const f=find(path);return f&&/\.css$/i.test(path)?'<style>'+f.code+'</style>':tag;});
    html=html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*?)>\s*<\/script>/gi,(tag,a,path)=>{const f=find(path);return f?'<script>'+f.code.replace(/<\/script/gi,'<\\/script')+'<\/script>':tag;});
    if(!/<html[\s>]/i.test(html))html=this.files.some(f=>/\.html?$/i.test(f.path))?'<!doctype html><html><head></head><body>'+html+'</body></html>':'<!doctype html><html><head><style>'+Playground.webModel('css').getValue()+'</style></head><body>'+html+'<script>'+Playground.webModel('js').getValue()+'<\/script></body></html>';
    const token=this.previewToken=Math.random().toString(36).slice(2);
    const bridge='<script>(()=>{const send=(kind,args)=>parent.postMessage({type:"codelab-web-output",token:'+JSON.stringify(token)+',kind,text:args.map(x=>typeof x==="string"?x:JSON.stringify(x)).join(" ")},"*");for(const kind of ["log","info","warn","error"]){const old=console[kind];console[kind]=(...args)=>{send(kind,args);old.apply(console,args);};}addEventListener("error",e=>send("error",[e.message]));addEventListener("unhandledrejection",e=>send("error",[String(e.reason)]));})();<\/script>';
    const out=document.getElementById('lab-web-console');if(out)out.textContent='Web console · waiting for console.log / errors';
    return /<head[\s>]/i.test(html)?html.replace(/(<head[^>]*>)/i,'$1'+bridge):bridge+html;
  },
  init(){
    Object.entries(this.languages).forEach(([id,spec])=>{if(spec.sample&&!PG_TEMPLATES[id])PG_TEMPLATES[id]=spec.sample;});
    PG_TEMPLATES.mongodb='// MongoDB-style queries execute against in-memory collections.\n// Default employees data is provided; Input can replace it with JSON collections.\ndb.employees.find({department: "Engineering"}, {name: 1, salary: 1, _id: 0}).sort({salary: -1});\n';
    const oldMap=Editor.langMap;Editor.langMap=lang=>({csharp:'csharp',typescript:'typescript',go:'go',rust:'rust',ruby:'ruby',php:'php',bash:'shell',r:'r',mongodb:'javascript',lisp:'scheme',ocaml:'fsharp'})[lang]||(oldMap(lang)==='plaintext'?lang:oldMap(lang));
    const select=document.getElementById('pg-lang');for(const [id,spec] of Object.entries(this.languages)){let option=[...select.options].find(o=>o.value===id);if(!option){option=document.createElement('option');option.value=id;select.append(option);}const unavailable=window.CODELAB_LANGUAGE_AVAILABILITY?.[id]===false;option.disabled=unavailable;option.textContent=spec.label+(unavailable?' · runtime unavailable':!['python','javascript','typescript','sql','mongodb','html'].includes(id)?' · online / local compiler':'');}
    const style=document.createElement('style');style.textContent='#view-playground{grid-template-rows:auto minmax(0,1fr)}#lab-chrome{grid-column:1/-1;grid-row:1}#view-playground>.pg-editor-col{grid-column:1;grid-row:2}#view-playground>.col-resizer{grid-column:2;grid-row:2}#pg-io-side,#pg-preview-side{grid-column:3;grid-row:2}#lab-chrome{flex:0 0 100%;min-width:0;background:var(--bg-secondary);border-bottom:1px solid var(--border)}.lab-tools{display:flex;gap:8px;align-items:center;padding:8px;flex-wrap:wrap}.lab-tools label{cursor:pointer}#lab-file-status{color:var(--text-secondary);font-size:12px}#lab-workspace{display:flex;border-top:1px solid var(--border)}#lab-workspace[hidden]{display:none}#lab-files{flex:0 0 190px;max-height:150px;overflow:auto;border-right:1px solid var(--border);padding:5px}#lab-files button{display:block;text-align:left;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#lab-tabs{display:flex;align-items:flex-start;gap:2px;overflow:auto;padding:5px;min-width:0}#lab-files button,#lab-tabs button{border:0;background:transparent;color:var(--text-secondary);padding:7px 10px;cursor:pointer}#lab-files button.active,#lab-tabs button.active{color:var(--text-primary);background:var(--bg-tertiary);border-bottom:2px solid var(--accent)}@media(max-width:900px){#view-playground.active{grid-template-columns:1fr;grid-template-rows:auto minmax(320px,1fr) minmax(220px,.6fr)}#view-playground>.pg-editor-col{grid-column:1;grid-row:2}#pg-io-side,#pg-preview-side{grid-column:1;grid-row:3}#view-playground>.col-resizer{display:none}}';document.head.append(style);
    const chrome=document.createElement('section');chrome.id='lab-chrome';chrome.innerHTML='<div class="lab-tools"><button class="tb-btn" id="lab-new">New file</button><label class="tb-btn">Open files<input id="lab-open" type="file" multiple hidden></label><label class="tb-btn">Open folder<input id="lab-folder" type="file" webkitdirectory multiple hidden></label><button class="tb-btn" id="lab-save">Save / download active file</button><span id="lab-file-status">Untitled · changes save automatically</span></div><div id="lab-workspace" hidden><nav id="lab-files" aria-label="Workspace files"></nav><nav id="lab-tabs" aria-label="Open file tabs"></nav></div>';
    document.getElementById('view-playground').prepend(chrome);document.getElementById('lab-new').onclick=()=>this.newFile();document.getElementById('lab-open').onchange=e=>this.importFiles(e.target);document.getElementById('lab-folder').onchange=e=>this.importFiles(e.target);document.getElementById('lab-save').onclick=()=>this.downloadActive();
    try{const stored=JSON.parse(Store.getRaw('pg_workspace_v1','null'));if(stored&&Array.isArray(stored.files)){this.files=stored.files.filter(f=>typeof f.path==='string'&&typeof f.code==='string'&&this.detect(f.path)).slice(0,250);this.restoredActive=stored.active;}}catch{}
    const changeLang=Playground.changeLang.bind(Playground);Playground.changeLang=language=>{if(!this.switching&&this.active){this.capture();this.active='';this.render();}changeLang(language);};
    const init=Playground.init.bind(Playground);Playground.init=()=>{init();if(!this.attached&&Playground.instance){this.attached=true;Playground.instance.onDidChangeModelContent(()=>{clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>this.capture(),250);});if(this.restoredActive){const path=this.restoredActive;this.restoredActive='';this.open(path);}}};
    Playground.buildSrcDoc=()=>this.buildWeb();EditorTools.importCurrent=input=>this.importFiles(input);EditorTools.stop=()=>{this.stop();Toast.show('Execution stopped.','info');};EditorTools.exportCurrentOriginal=EditorTools.exportCurrent.bind(EditorTools);EditorTools.exportCurrent=()=>this.downloadActive();
    const consoleBox=document.createElement('pre');consoleBox.id='lab-web-console';consoleBox.style.cssText='height:100px;min-height:60px;overflow:auto;white-space:pre-wrap;padding:10px;border-top:1px solid var(--border);margin:0;font:12px/1.5 monospace;';consoleBox.textContent='Web console';document.getElementById('pg-preview-side').append(consoleBox);
    window.addEventListener('message',event=>{const frame=document.getElementById('pg-preview');if(event.source!==frame?.contentWindow||event.data?.type!=='codelab-web-output'||event.data.token!==this.previewToken)return;if(consoleBox.textContent.startsWith('Web console'))consoleBox.textContent='';consoleBox.textContent=(consoleBox.textContent+'['+event.data.kind+'] '+String(event.data.text)+'\n').slice(-131072);});
    const busy=ProgressBackup.busy.bind(ProgressBackup);ProgressBackup.busy=()=>busy()||!!this.jobs.size||!!this.controllers.size;
    Cloud.runWandbox=(lang,code,stdin)=>this.remote(lang,code,stdin);
    Cloud.run=(lang,code,stdin)=>this.execute(lang,code,stdin);
    JsRun.run=(code,stdin)=>this.worker('javascript',code,stdin,'main.js');JsRun.stop=()=>this.stop();
    Playground.run=async()=>{
      if(!Playground.ready){Playground.init();return;}if(Playground.busy)return;this.capture();
      if(Playground.lang==='html'){Playground.renderPreview();return;}
      const lang=Playground.lang,code=Playground.instance.getValue(),stdin=document.getElementById('pg-stdin').value;
      Playground.save();Playground.busy=true;document.getElementById('pg-status-lbl').textContent='Running';document.getElementById('pg-output').textContent='Running '+(this.active||this.languages[lang]?.label||lang)+'…';
      try{if(this.active&&this.detect(this.active)==='json')throw Error('JSON is a data file. Select a program file to Run.');const extra=this.files.filter(f=>f.path!==this.active);const result=await this.execute(lang,code,stdin,this.active,extra);this.showOutput(result);RunHistory.record(lang,code,stdin,Playground.lastOutput,result.time,!!result.stderr);}
      catch(e){this.showOutput({stdout:'',stderr:e.kind==='tle'?'Time limit exceeded.':e.message||String(e),exitCode:1});}
      finally{Playground.busy=false;}
    };
    if(Playground.ready)Playground.init();this.render();
  }
};
window.addEventListener('DOMContentLoaded',()=>LanguageLab.init());
