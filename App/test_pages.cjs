const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

function subject(){
 const requests=[];
 const context={URL,Map,JSON,Error,performance,document:{baseURI:'https://laxtline.github.io/Dev_Spher/'},Unified:{detail:{}},Py:{load:async()=>{},run:async(code,stdin)=>{
   // Run the exact browser harness in Python to check real function evaluation and output handling.
   const result=spawnSync(process.env.PYTHON||'python',['-I','-c',code],{input:stdin,encoding:'utf8',timeout:10000});
   if(result.error)throw result.error;return {stdout:result.stdout,stderr:result.stderr};
 }},fetch:async url=>{requests.push(String(url));const rel=new URL(url).pathname.replace('/Dev_Spher/','');const file=path.join(__dirname,rel.replace(/^data\//,'data/'));return fs.existsSync(file)?{ok:true,json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))}:{ok:false};}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/web/browser-api.js','utf8')+'\nthis.subject=BrowserPractice;',context);context.Unified.api=(...args)=>context.subject.api(...args);return {api:context.subject,context,requests};
}
test('public catalog and bootstrap contain no personal saved state',async()=>{
 const {api,requests}=subject();const data=await api.api('catalog');assert.ok(data.problems.length>4000);assert.ok(data.resources.length>14000);const boot=await api.api('bootstrap');assert.equal(Object.keys(boot.state.progress).length,0);assert.equal(requests[0],'https://laxtline.github.io/Dev_Spher/data/catalog.json');
});
test('Python function practice accepts correct code and rejects wrong answers with type-aware judging',async()=>{
 const {api,context}=subject();context.Unified.detail={practice:{function:'solve',tests:[{args:[[2,3]],expected:5},{args:[[]],expected:0}]}};
 const request={language:'python',mode:'submit',function:'solve',code:'def solve(nums):\n    print("running")\n    return sum(nums)'};
 const good=await api.run(request);assert.equal(good.accepted,true);assert.equal(good.cases.length,2);assert.match(good.stdout,/running/);
 const wrong=await api.run({...request,code:'def solve(nums): return True'});assert.equal(wrong.verdict,'Wrong answer');assert.equal(wrong.accepted,false);assert.equal(api.same(true,1),false);
});
test('Python class methods, exceptions, custom input and timeouts return honest results',async()=>{
 const {api,context}=subject();context.Unified.detail={practice:{function:'solve',tests:[{args:[4],expected:8}]}};
 const request={language:'python',mode:'submit',function:'solve',code:'class Solution:\n    def solve(self,n): return n*2'};
 assert.equal((await api.run(request)).accepted,true);
 const custom=await api.run({...request,mode:'custom',custom:[3]});assert.equal(custom.cases[0].actual,6);assert.equal(custom.cases[0].passed,null);
 const bad=await api.run({...request,code:'def solve(n): raise ValueError("example")'});assert.equal(bad.verdict,'Runtime error');assert.match(bad.error,/example/);
 context.Py.run=async()=>{throw {kind:'tle'}};assert.equal((await api.run(request)).verdict,'Time limit exceeded');
});
test('resource PDF links are relative to the repository website',async()=>{
 const {api,context}=subject();context.fetch=async()=>({ok:true,json:async()=>({kind:'pdf',asset:'/assets/imported/book.pdf'})});const doc=await api.api('resource/book');assert.equal(doc.asset,'assets/imported/book.pdf');
});
