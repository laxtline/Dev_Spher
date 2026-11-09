'use strict';
function same(a,b){if(typeof a!==typeof b)return false;if(typeof a==='number')return Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));if(a===null||b===null)return a===b;if(Array.isArray(a)!==Array.isArray(b))return false;if(Array.isArray(a))return a.length===b.length&&a.every((v,i)=>same(v,b[i]));if(typeof a==='object'){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}return a===b;}
self.onmessage=event=>{
 const request=event.data,start=performance.now();let logs='';
 const console={log:(...values)=>{if(logs.length<16000)logs+=(values.map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' ')+'\n').slice(0,16000-logs.length);}};
 try{
   if(!/^[A-Za-z_$][\w$]*$/.test(request.function))throw Error('Use a valid JavaScript function name.');
   const fn=new Function('console',request.code+'\n;return typeof '+request.function+' === "function" ? '+request.function+' : (typeof Solution !== "undefined" ? new Solution()["'+request.function+'"].bind(new Solution()) : null);')(console);
   if(typeof fn!=='function')throw Error('Define function '+request.function+' or a matching Solution class method.');
   const cases=request.tests.map(test=>{const actual=fn(...structuredClone(test.args));if(actual&&typeof actual.then==='function')throw Error('Return the answer directly from this function.');JSON.stringify(actual);return {args:test.args,expected:test.expected??null,actual:actual===undefined?null:actual,passed:request.mode==='custom'?null:same(actual,test.expected)};});
   const accepted=request.mode==='submit'&&cases.every(c=>c.passed),verdict=accepted?'Practice accepted':request.mode==='custom'?'Custom run complete':cases.every(c=>c.passed)?'Tests passed':'Wrong answer';
   self.postMessage({cases,stdout:logs,accepted,verdict,duration:Math.round(performance.now()-start),scope:'Local practice tests only'});
 }catch(error){self.postMessage({error:error.name+': '+error.message,stdout:logs,accepted:false,verdict:'Runtime error',duration:Math.round(performance.now()-start)});}
};
