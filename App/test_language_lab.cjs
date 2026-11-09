const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {Worker}=require('node:worker_threads');
const root=path.join(__dirname,'web/studio');
function lab(){
 const context={window:{addEventListener(){}},fetch,AbortSignal,AbortController,setTimeout,clearTimeout,performance,navigator:{onLine:true},URL};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'assets/language-support.js'),'utf8')+'\nglobalThis.lab=LanguageLab;',context);return {context,lab:context.lab};
}
function run(data,timeout=3000){return new Promise((resolve,reject)=>{
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self=globalThis;global.postMessage=d=>parentPort.postMessage(d);parentPort.on('message',d=>self.onmessage({data:d}));require(${JSON.stringify(path.join(root,'assets/lab-worker.js'))});`,{eval:true});
 const timer=setTimeout(()=>{worker.terminate();reject(Error('timeout'));},timeout);
 worker.on('message',m=>{if(m.type==='done'){clearTimeout(timer);worker.terminate();resolve(m);}});worker.on('error',reject);worker.postMessage(data);
});}
test('source file extensions select the correct execution engine',()=>{
 const {lab:l}=lab();for(const [p,lang] of Object.entries({'app.js':'javascript','app.ts':'typescript','query.sql':'sql','main.py':'python','main.cpp':'cpp','Main.java':'java','index.html':'html','style.css':'html','app.cs':'csharp','query.mongo':'mongodb'}))assert.equal(l.detect(p),lang,p);
});
test('opening HTML selects web mode and preserves the imported file text',()=>{
 const {context,lab:l}=lab();const select={value:'typescript'};let text;context.document={getElementById:()=>select};context.Playground={changeLang(){},webTab(){},instance:{setValue:v=>text=v},save(){},renderPreview(){}};l.capture=()=>{};l.persist=()=>{};l.render=()=>{};l.files=[{path:'index.html',code:'<h1>Keep this file</h1>'}];l.open('index.html');assert.equal(select.value,'html');assert.equal(text,'<h1>Keep this file</h1>');
});
test('compiler discovery distinguishes C, C++ and Java and chooses stable versions',()=>{
 const {lab:l}=lab();const rows=[{name:'gcc-head-c',language:'C'},{name:'gcc-13-c',language:'C'},{name:'gcc-13',language:'C++'},{name:'openjdk-jdk-21',language:'Java'}];
 assert.equal(l.chooseCompiler('c',rows).name,'gcc-13-c');assert.equal(l.chooseCompiler('cpp',rows).name,'gcc-13');assert.equal(l.chooseCompiler('java',rows).name,'openjdk-jdk-21');
});
test('JavaScript prints values, objects, undefined and asynchronous output',async()=>{
 const r=await run({language:'javascript',code:'console.log(undefined, 12n); const o={};o.self=o;console.log(o);setTimeout(()=>console.log("later"),20);await Promise.resolve();console.log("now");',stdin:'',filename:'main.js'});
 assert.equal(r.exitCode,0);assert.match(r.stdout,/undefined 12n/);assert.match(r.stdout,/Circular/);assert.ok(r.stdout.indexOf('later')>r.stdout.indexOf('now'));
});
test('JavaScript stdin and relative workspace modules execute',async()=>{
 const r=await run({language:'javascript',code:'const add=require("./math");const raw=require("fs").readFileSync(0,"utf8");console.log(add(Number(raw),2));',stdin:'40',filename:'src/main.js',files:[{path:'src/math.js',code:'module.exports=(a,b)=>a+b;'}]});assert.equal(r.stdout.trim(),'42');
});
test('TypeScript uses the real compiler, including imports between files',async()=>{
 const r=await run({language:'typescript',code:'import { twice } from "./math";const n: number=21;console.log(twice(n));',filename:'main.ts',stdin:'',files:[{path:'math.ts',code:'export const twice=(n: number): number => n*2;'}],typescriptSource:fs.readFileSync(path.join(root,'vendor/typescript/typescript.js'),'utf8'),typescriptLibs:fs.readFileSync(path.join(root,'vendor/typescript/lib-data.json'),'utf8')},10000);assert.equal(r.exitCode,0,r.stderr);assert.equal(r.stdout.trim(),'42');
});
test('errors are visible while prior console output remains available',async()=>{
 const r=await run({language:'javascript',code:'console.log("before");throw new Error("visible failure");',stdin:'',filename:'main.js'});assert.equal(r.exitCode,1);assert.match(r.stdout,/before/);assert.match(r.stderr,/visible failure/);
});
test('TypeScript type errors appear before execution and valid typed code prints output',async()=>{
 const common={language:'typescript',stdin:'',filename:'main.ts',typescriptSource:fs.readFileSync(path.join(root,'vendor/typescript/typescript.js'),'utf8'),typescriptLibs:fs.readFileSync(path.join(root,'vendor/typescript/lib-data.json'),'utf8')};
 let r=await run({...common,code:'const n: number = "wrong";console.log(n);'},10000);assert.equal(r.exitCode,1);assert.match(r.stderr,/TS2322/);assert.equal(r.stdout,'');
 r=await run({...common,code:'const nums: number[] = [20,22];console.log(nums.reduce((a,b)=>a+b,0));'},10000);assert.equal(r.exitCode,0,r.stderr);assert.equal(r.stdout.trim(),'42');
});
test('non-terminating JavaScript is isolated and can be terminated',async()=>{
 await assert.rejects(run({language:'javascript',code:'while(true){}',stdin:'',filename:'main.js'},150),/timeout/);
});
test('MongoDB find and aggregation return calculated data, not syntax feedback',async()=>{
 const mingoSource=fs.readFileSync(path.join(root,'vendor/mingo/mingo.min.js'),'utf8');
 let r=await run({language:'mongodb',code:'db.employees.find({department:"Engineering"},{name:1,_id:0}).sort({name:-1});',stdin:'',mingoSource});assert.equal(r.exitCode,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),[{name:'Kabir'},{name:'Aarav'}]);
 r=await run({language:'mongodb',code:'db.scores.insertMany([{n:10},{n:20}]);db.scores.updateOne({n:10},{$inc:{n:5}});db.scores.aggregate([{$group:{_id:null,total:{$sum:"$n"}}}]);',stdin:'',mingoSource});assert.equal(r.exitCode,0,r.stderr);assert.equal(JSON.parse(r.stdout)[0].total,35);
});
test('SQL loads before reset and executes the complete script',async()=>{
 const {context,lab:l}=lab();const initSqlJs=require(path.join(root,'vendor/runtimes/sql/sql-wasm.js'));const SQL=await initSqlJs({locateFile:f=>path.join(root,'vendor/runtimes/sql',f)});
 const calls=[];context.SqlRun={async load(){calls.push('load');},resetDb(){calls.push('reset');this.db=new SQL.Database();},fmtTable:r=>JSON.stringify(r)};
 const r=await l.execute('sql',"CREATE TABLE t(v TEXT);INSERT INTO t VALUES('a;b');SELECT v FROM t;");assert.deepEqual(calls,['load','reset']);assert.equal(r.exitCode,0,r.stderr);assert.equal(JSON.parse(r.stdout)[0].values[0][0],'a;b');
 const bad=await l.execute('sql','SELECT * FROM missing;');assert.equal(bad.exitCode,1);assert.match(bad.stderr,/missing/);
});
test('offline native language errors state the runtime requirement',async()=>{const {context,lab:l}=lab();context.navigator.onLine=false;await assert.rejects(l.remote('java','', ''),/internet connection or a matching local compiler/);});
test('Java public class keeps its filename and receives a compatible entry wrapper',async()=>{
 const {context,lab:l}=lab();let sent;l.compilerPromise=Promise.resolve([{name:'jdk',language:'Java'}]);context.fetch=async(u,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({status:'0',program_output:'hello'})};};await l.remote('java','public class Hello { public static void main(String[] a){} }','');assert.match(sent.code,/Hello.main/);assert.equal(sent.codes[0].file,'Hello.java');assert.match(sent.codes[0].code,/public class Hello/);
});
test('Python workspace imports another file using the actual Python interpreter',()=>{
 const {lab:l}=lab();const program=l.pythonProgram('from helper import value\nprint(value+2)','src/main.py',[{path:'src/helper.py',code:'value=40'}]);const {spawnSync}=require('node:child_process');const r=spawnSync('python',['-c',program],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'42');
});
