'use strict';
// Public hosting executes code in the visitor's browser and keeps progress in local storage.
const BrowserPractice={
 specs:null,catalog:null,
 async json(path){const response=await fetch(new URL(path,document.baseURI));if(!response.ok)throw Error('This item could not be loaded. Check your connection or download the offline app.');return response.json();},
 same(a,b){if(typeof a!==typeof b)return false;if(typeof a==='number')return Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));if(a===null||b===null)return a===b;if(Array.isArray(a)!==Array.isArray(b))return false;if(Array.isArray(a))return a.length===b.length&&a.every((v,i)=>this.same(v,b[i]));if(typeof a==='object'){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&this.same(a[k],b[k]));}return a===b;},
 async api(path,body){
   if(path==='bootstrap')return {token:'browser',state:{progress:{},submissions:[]},python:'Browser Python',node:false};
   if(path==='catalog')return this.catalog ||= this.json('data/catalog.json').catch(error=>{this.catalog=null;throw error;});
   if(path==='run')return this.run(body);
   const match=/^(problem|resource)\/([a-z0-9-]+)$/.exec(path);
   if(!match)throw Error('This operation requires the offline app.');
   if(match[1]==='problem'){
     const catalog=await Unified.api('catalog');
     const item=catalog.problems.find(p=>p.id===match[2]);if(!item)throw Error('Question not found.');
     let data;
     try{data=await this.json('data/problems/'+match[2]+'.json');}
     catch(error){if(item.description||item.solutions)throw error;data={html:'',source:'Company sheet (metadata only)',solutions:[]};}
     this.specs ||= this.json('data/practice.json');
     const spec=(await this.specs).find(s=>s.slug===match[2].replace(/^lc-/,''));
     if(spec)data.practice=spec;
     return data;
   }
   const data=await this.json('data/resources/'+match[2]+'.json');
   if(data.asset?.startsWith('/'))data.asset=data.asset.slice(1);
   return data;
 },
 async run(request){
   const detail=Unified.detail;
   if(request.mode!=='custom'&&!detail?.practice)throw Error('Use custom input for this reference question.');
   if(request.language!=='python')throw Error('Choose Python or JavaScript for function practice.');
   if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(request.function))throw Error('Use a valid Python function name.');
   const tests=request.mode==='custom'?[{args:request.custom}]:detail.practice.tests.slice(0,request.mode==='run'?2:undefined);
   const fn=request.mode==='custom'?request.function:detail.practice.function;
   await Py.load();
   const input=JSON.stringify({code:request.code,function:fn,cases:tests.map(t=>t.args)});
   const program=`import json, sys, io, contextlib, typing, collections, math, itertools, functools, heapq, bisect
request=json.loads(sys.stdin.read())
ns={"List":typing.List,"Optional":typing.Optional,"Counter":collections.Counter,"defaultdict":collections.defaultdict,"deque":collections.deque,"math":math,"heapq":heapq,"__name__":"__practice__"}
class BoundedLog(io.StringIO):
    def write(self,s):
        if self.tell()<16000: return super().write(s[:16000-self.tell()])
        return len(s)
log=BoundedLog()
try:
    with contextlib.redirect_stdout(log):
        exec(compile(request["code"],"solution.py","exec"),ns)
        fn=ns.get(request["function"])
        if not callable(fn) and "Solution" in ns: fn=getattr(ns["Solution"](),request["function"],None)
        if not callable(fn): raise ValueError("Define function "+request["function"]+" or a Solution class with that method.")
        results=[fn(*args) for args in request["cases"]]
    print(json.dumps({"results":results,"stdout":log.getvalue()},allow_nan=False))
except BaseException as e:
    print(json.dumps({"error":type(e).__name__+": "+str(e),"stdout":log.getvalue()}))`;
   const start=performance.now();let execution;
   try{execution=await Py.run(program,input,6000);}catch(error){if(error.kind==='tle')return {error:'Time limit exceeded (6 seconds).',verdict:'Time limit exceeded',accepted:false};throw error;}
   const duration=Math.round(performance.now()-start);let output;
   try{output=JSON.parse(execution.stdout);}catch{throw Error(execution.stderr||'The program ended without a result.');}
   if(output.error)return {...output,duration,verdict:'Runtime error',accepted:false};
   const cases=output.results.map((actual,i)=>({args:tests[i].args,expected:tests[i].expected??null,actual,passed:request.mode==='custom'?null:this.same(actual,tests[i].expected)}));
   const accepted=request.mode==='submit'&&cases.every(c=>c.passed);
   return {cases,stdout:output.stdout,duration,accepted,verdict:accepted?'Practice accepted':request.mode==='custom'?'Custom run complete':cases.every(c=>c.passed)?'Tests passed':'Wrong answer',scope:'Browser practice tests only'};
 }
};
