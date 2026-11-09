/* Coding Lab worker: each run gets an isolated console, input and workspace. */
'use strict';
self.onmessage=async({data})=>{
  let stdout='',stderr='',bytes=0,lastValue;
  const pending=new Map(),nativeSetTimeout=self.setTimeout.bind(self),nativeClearTimeout=self.clearTimeout.bind(self);
  const format=value=>{
    if(typeof value==='string')return value;
    if(value===undefined)return 'undefined';
    if(typeof value==='bigint')return value+'n';
    const seen=new WeakSet();
    try{return JSON.stringify(value,(_,v)=>{if(typeof v==='bigint')return v+'n';if(v&&typeof v==='object'){if(seen.has(v))return '[Circular]';seen.add(v);}return v;},2)??String(value);}catch{return String(value);}
  };
  const write=(error,args,newline=true)=>{
    const text=args.map(format).join(' ')+(newline?'\n':'');bytes+=text.length;
    if(bytes>131072)throw Error('Output limit exceeded (128 KiB).');
    if(error)stderr+=text;else stdout+=text;
    self.postMessage({type:'output',stdout,stderr});
  };
  const console={log:(...a)=>write(false,a),info:(...a)=>write(false,a),debug:(...a)=>write(false,a),warn:(...a)=>write(true,a),error:(...a)=>write(true,a),table:v=>write(false,[v]),dir:v=>write(false,[v]),clear:()=>{stdout='';stderr='';},assert:(ok,...a)=>{if(!ok)write(true,['Assertion failed:',...a]);}};
  const lines=String(data.stdin||'').replace(/\r\n/g,'\n').split('\n');let line=0;
  const readline=()=>lines[line++]??'';
  const setTimeout=(fn,ms=0,...args)=>{
    const id=nativeSetTimeout(()=>{pending.delete(id);try{const result=fn(...args);if(result?.then){const marker={};pending.set(marker,true);result.catch(e=>write(true,[e.stack||String(e)])).finally(()=>pending.delete(marker));}}catch(e){write(true,[e.stack||String(e)]);}},Math.max(0,Number(ms)||0));
    pending.set(id,true);return id;
  };
  const clearTimeout=id=>{pending.delete(id);nativeClearTimeout(id);};
  const setInterval=(fn,ms,...args)=>{const key={};pending.set(key,true);const tick=()=>{if(!pending.has(key))return;fn(...args);key.timer=nativeSetTimeout(tick,Math.max(1,ms||1));};key.timer=nativeSetTimeout(tick,Math.max(1,ms||1));return key;};
  const clearInterval=key=>{pending.delete(key);nativeClearTimeout(key.timer);};
  const process={argv:['node',data.filename||'main.js'],env:{},stdout:{write:s=>write(false,[String(s)],false)},stderr:{write:s=>write(true,[String(s)],false)},exit:c=>{const e=Error('Program exited with code '+(c||0));e.exitCode=c||0;throw e;}};
  const normalize=p=>{const parts=[];for(const s of p.replaceAll('\\','/').split('/')){if(s==='..')parts.pop();else if(s&&s!=='.')parts.push(s);}return parts.join('/');};
  const files=Object.fromEntries((data.files||[]).map(f=>[normalize(f.path),f.code]));
  files[normalize(data.filename||'main.js')]=data.code;
  const cache={};
  const checkTypes=()=>{
    if(data.language!=='typescript'||!data.typescriptLibs)return;
    if(!self.ts)(0,eval)(data.typescriptSource);
    const ts=self.ts,libs=JSON.parse(data.typescriptLibs),virtual={};
    for(const [name,text] of Object.entries(libs))virtual['lib/'+name]=text;
    for(const [name,text] of Object.entries(files))virtual['workspace/'+name]=text;
    virtual['workspace/__lab_runtime__.d.ts']='declare function readline(): string; declare function input(): string; declare var require: (name: string) => any; declare var module: {exports: any}; declare var exports: any; declare var process: any;';
    const host={getSourceFile:(name,version)=>{const code=virtual[normalize(name)];return code===undefined?undefined:ts.createSourceFile(name,code,version,true);},getDefaultLibFileName:()=>'/lib/lib.es2020.full.d.ts',writeFile(){},getCurrentDirectory:()=>'/workspace',getDirectories:()=>[],fileExists:name=>normalize(name) in virtual,readFile:name=>virtual[normalize(name)],getCanonicalFileName:name=>name,useCaseSensitiveFileNames:()=>true,getNewLine:()=>'\n',directoryExists:name=>Object.keys(virtual).some(p=>p.startsWith(normalize(name)+'/'))};
    const program=ts.createProgram(['/workspace/'+normalize(data.filename||'main.ts'),'/workspace/__lab_runtime__.d.ts'],{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,noEmit:true,allowJs:true,checkJs:false,skipLibCheck:true},host);
    const errors=ts.getPreEmitDiagnostics(program).filter(d=>d.category===ts.DiagnosticCategory.Error&&d.code!==1375);
    if(errors.length)throw Error(errors.map(d=>{const at=d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start):null;return (d.file?d.file.fileName.replace('/workspace/','')+(at?':'+(at.line+1)+':'+(at.character+1):'')+': ':'')+'TS'+d.code+' '+ts.flattenDiagnosticMessageText(d.messageText,'\n');}).join('\n'));
  };
  const compile=(code,name)=>{
    if(data.typescriptSource){
      if(!self.ts)(0,eval)(data.typescriptSource);
      const result=self.ts.transpileModule(code,{fileName:name,reportDiagnostics:true,compilerOptions:{target:self.ts.ScriptTarget.ES2020,module:self.ts.ModuleKind.CommonJS,allowJs:true,esModuleInterop:true}});
      const errors=(result.diagnostics||[]).filter(d=>d.category===self.ts.DiagnosticCategory.Error);
      if(errors.length)throw SyntaxError(errors.map(d=>self.ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
      return result.outputText;
    }
    if(/(^|\n)\s*(import\s|export\s)/.test(code))throw Error('Module compiler is unavailable. Reconnect or open the complete local app.');
    return code;
  };
  const requireFor=filename=>name=>{
    if(name==='fs'||name==='node:fs')return {readFileSync:(path)=>{if(path===0||path==='/dev/stdin')return data.stdin||'';const key=normalize(filename.split('/').slice(0,-1).join('/')+'/'+path);if(!(key in files))throw Error('Workspace file not found: '+path);return files[key];}};
    if(name==='readline'||name==='node:readline')return {createInterface:()=>{const rows=!data.stdin?[]:data.stdin.endsWith('\n')?lines.slice(0,-1):lines;const reader={on(event,fn){if(event==='line')rows.forEach(fn);if(event==='close')queueMicrotask(fn);return reader;},close(){},[Symbol.asyncIterator]:async function*(){for(const l of rows)yield l;}};return reader;}};
    if(!name.startsWith('.'))throw Error('Module "'+name+'" is not bundled. Open the project in a Node.js environment for npm packages.');
    const base=normalize(filename.split('/').slice(0,-1).join('/')+'/'+name);
    const key=[base,base+'.ts',base+'.js',base+'.json',base+'/index.ts',base+'/index.js'].find(k=>k in files);
    if(!key)throw Error('Workspace module not found: '+name);
    if(key.endsWith('.json'))return JSON.parse(files[key]);
    if(cache[key])return cache[key].exports;
    const module=cache[key]={exports:{}};
    new Function('require','module','exports','console','process','readline','input','prompt','setTimeout','clearTimeout','setInterval','clearInterval',compile(files[key],key))(requireFor(key),module,module.exports,console,process,readline,readline,readline,setTimeout,clearTimeout,setInterval,clearInterval);
    return module.exports;
  };
  try{
    checkTypes();
    if(data.language==='mongodb'){
      (0,eval)(data.mingoSource);
      const mingo=self.mingo,collections=structuredClone(data.collections||{employees:[{_id:1,name:'Aarav',department:'Engineering',salary:65000},{_id:2,name:'Diya',department:'Design',salary:52000},{_id:3,name:'Kabir',department:'Engineering',salary:71000},{_id:4,name:'Meera',department:'Marketing',salary:48000}]});
      let nextId=100;
      const remember=v=>{lastValue=v;return v;};
      const collection=name=>{
        if(['__proto__','constructor','prototype'].includes(name))throw Error('Invalid collection name.');
        const rows=()=>collections[name]||(collections[name]=[]);
        const cursor=c=>{c.toArray=()=>c.all();return remember(c);};
        return {
          find:(q={},p={})=>cursor(mingo.find(rows(),q,p)),
          findOne:(q={},p={})=>remember(mingo.find(rows(),q,p).first()??null),
          aggregate:p=>remember(mingo.aggregate(rows(),p,{collectionResolver:n=>collections[n]||[]})),
          countDocuments:(q={})=>remember(mingo.find(rows(),q).all().length),
          distinct:(field,q={})=>remember([...new Set(mingo.find(rows(),q).all().map(r=>r[field]))]),
          insertOne:doc=>{const d=structuredClone(doc);if(d._id===undefined)d._id=nextId++;if(rows().some(r=>r._id===d._id))throw Error('Duplicate _id: '+d._id);rows().push(d);return remember({acknowledged:true,insertedId:d._id});},
          insertMany:docs=>{const ids={};docs.forEach((d,i)=>ids[i]=collection(name).insertOne(d).insertedId);return remember({acknowledged:true,insertedIds:ids});},
          updateOne:(q,u)=>update(q,u,false),updateMany:(q,u)=>update(q,u,true),
          deleteOne:q=>remove(q,false),deleteMany:q=>remove(q,true),
          drop:()=>{delete collections[name];return remember(true);}
        };
        function update(q,u,many){let matched=0,modified=0;for(const d of rows()){if(new mingo.Query(q).test(d)){matched++;if(mingo.update(d,u).length)modified++;if(!many)break;}}return remember({acknowledged:true,matchedCount:matched,modifiedCount:modified});}
        function remove(q,many){let count=0;collections[name]=rows().filter(d=>{if((many||!count)&&new mingo.Query(q).test(d)){count++;return false;}return true;});return remember({acknowledged:true,deletedCount:count});}
      };
      const db=new Proxy({getCollection:collection,createCollection:name=>{collection(name);return remember({ok:1});}}, {get:(t,p)=>p in t?t[p]:collection(String(p))});
      const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
      await new AsyncFunction('db','console','print','printjson',data.code)(db,console,(...a)=>write(false,a),v=>write(false,[v]));
      if(!stdout&&!stderr&&lastValue!==undefined)write(false,[typeof lastValue?.all==='function'?lastValue.all():lastValue]);
    }else{
      const name=normalize(data.filename||'main.js'),module={exports:{}};
      const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
      await new AsyncFunction('require','module','exports','console','process','readline','input','prompt','setTimeout','clearTimeout','setInterval','clearInterval',compile(data.code,name))(requireFor(name),module,module.exports,console,process,readline,readline,readline,setTimeout,clearTimeout,setInterval,clearInterval);
      while(pending.size)await new Promise(r=>nativeSetTimeout(r,5));
    }
    self.postMessage({type:'done',stdout,stderr,exitCode:0});
  }catch(e){
    if(e.exitCode===0)self.postMessage({type:'done',stdout,stderr,exitCode:0});
    else self.postMessage({type:'done',stdout,stderr:stderr+(e.stack||String(e)),exitCode:e.exitCode||1});
  }
};
