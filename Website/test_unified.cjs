const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function subject(){
 const records=new Map();
 const context={console,Map,Set,Date,JSON,Promise,Cloud:{},RuntimeAssets:{},window:{addEventListener(){}},document:{},OfflineLibrary:{h:v=>String(v)},UI:{openSettings(){}},OfflineAccess:{},SaveBridge:{sync:async()=>{},refreshViews(){}},Learning:{cardInfo:()=>({title:'old'}),reviewOne(){},focus(){}},Store:{get:(k,d)=>records.has(k)?records.get(k):d,set:(k,v)=>records.set(k,v),getRaw:(k,d)=>records.has(k)?records.get(k):d,setRaw:(k,v)=>records.set(k,v)}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/web/level-wise.js','utf8')+'\nthis.levels=LevelWise;',context);vm.runInContext(fs.readFileSync(__dirname+'/web/unified.js','utf8')+'\nthis.subject=Unified;',context);return {u:context.subject,context,records};
}
test('one index merges numbered references, legacy sources and equivalent judged exercises',()=>{
 const {u}=subject();const p={id:'lc-two-sum',number:'1',title:'Two Sum',topics:['Array'],companies:{},kind:'reference'};
 const old={key:'lc-1',number:1,title:'Two Sum',tags:['Hash Map']};
 const rows=u.makeIndex({problems:[p]},[old,{key:'topic-graph',number:null,title:'Graph basics',tags:['Graph'],difficulty:'Unknown',solutionCount:1}], [{id:500,title:'Two Sum',tags:['Array']},{id:501,title:'Pattern printing',tags:['Loops']}]);
 assert.equal(rows.length,3);const two=rows.find(r=>r.id==='lc-two-sum');assert.equal(two.legacy.length,1);assert.equal(two.exercises[0].id,500);assert.ok(two.topics.includes('Hash Map'));assert.ok(rows.some(r=>r.id==='task-501'));
});
test('reference implementations deduplicate normalized language and whitespace',()=>{
 const {u}=subject();const rows=u.uniqueSolutions([{language:'py',code:'return 1\r\n'},{language:'python3',code:'return 1   \n'},{language:'cpp',code:'return 1;'}]);assert.equal(rows.length,2);
});
test('draft metadata updates retain solved status and old bookmarks',()=>{
 const {u,records}=subject();records.set('library_progress',{'lc-1':{star:true}});const p={id:'lc-two-sum',number:'1'};
 assert.equal(u.state(p).star,true);u.setState(p.id,{status:'solved'});u.setState(p.id,{language:'python'});assert.equal(u.state(p).status,'solved');assert.equal(u.state(p).star,true);
});
test('practice filtering includes attached judged exercises',()=>{
 const {u}=subject();u.scope='practice';u.items=[{id:'ref-a',title:'Example',topics:['Array'],companies:{},kind:'reference',difficulty:'Easy',exercises:[{id:1}]},{id:'ref-b',title:'Reading only',topics:[],companies:{},kind:'reference',difficulty:'Easy'}];assert.equal(u.filtered().length,1);
});
test('reference mistakes open the correct question from the shared revision system',()=>{
 const {u,context,records}=subject();records.set('revision_state',{'reference:lc-two-sum':{source:'reference'}});let route;u.open=(view,id)=>route={view,id};context.Learning.reviewOne('reference:lc-two-sum');assert.equal(route.view,'question');assert.equal(route.id,'lc-two-sum');
});
test('browser function worker checks solutions without Node or a cloud compiler in the app',()=>{
 let result;const self={postMessage:value=>{result=value;}};const context={self,performance,structuredClone,JSON,Error,Set};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/web/function-worker.js','utf8'),context);
 self.onmessage({data:{function:'twoSum',code:'function twoSum(nums,target){const seen=new Map();for(let i=0;i<nums.length;i++){if(seen.has(target-nums[i]))return [seen.get(target-nums[i]),i];seen.set(nums[i],i)}}',mode:'submit',tests:[{args:[[2,7,11,15],9],expected:[0,1]},{args:[[3,2,4],6],expected:[1,2]}]}});
 assert.equal(result.accepted,true);assert.equal(result.cases.length,2);
 self.onmessage({data:{function:'solve',code:'function solve(){return {0:1,1:2}}',mode:'submit',tests:[{args:[],expected:[1,2]}]}});assert.equal(result.accepted,false);
 self.onmessage({data:{function:'solve',code:'function solve(){throw new Error("example")}',mode:'custom',tests:[{args:[]}]}});assert.equal(result.verdict,'Runtime error');
});
test('PDF levels retain one shared question identity, apply topic and difficulty priorities, and exclude unrelated subjects',()=>{
 const {context}=subject();const make=(id,difficulty,topics,title=id)=>({id,difficulty,topics,title,companies:{},kind:'reference'});
 const rows=[make('two-sum','Easy',['Array','Hash Table'],'Two Sum'),make('islands','Medium',['Array','Graph','Depth-First Search']),make('word-break','Medium',['Dynamic Programming','String']),make('trie','Hard',['Trie']),make('sql','Easy',['Database']),make('factorial','Easy',['Math'],'Factorial'),make('cache','Medium',['Design'],'LRU Cache')];
 const index=context.levels.build(rows);assert.ok(index.get('service').some(p=>p.id==='factorial'));assert.ok(index.get('service').some(p=>p.id==='two-sum'));assert.ok(!index.get('service').some(p=>p.id==='islands'));assert.ok(index.get('product').some(p=>p.id==='islands'));assert.ok(index.get('top').some(p=>p.id==='trie'));assert.ok(index.get('top').some(p=>p.id==='cache'));for(const level of index.values()){assert.ok(!level.some(p=>p.id==='sql'));assert.equal(new Set(level.map(p=>p.id)).size,level.length);}
});
test('level topic, text and shared solved-progress filters combine correctly',()=>{
 const {u,context}=subject();u.items=[{id:'lc-two-sum',number:'1',title:'Two Sum',topics:['Array','Hash Table'],companies:{},kind:'reference',difficulty:'Easy'},{id:'lc-palindrome',number:'9',title:'Palindrome Number',topics:['Math'],companies:{},kind:'reference',difficulty:'Easy'}];u.levelIndex=context.levels.build(u.items);u.scope='levels';u.levelId='service';u.levelTopic='hashing';assert.equal(u.filtered().length,1);u.setState('lc-two-sum',{status:'solved',star:true});u.filters.status='solved';assert.equal(u.filtered()[0].id,'lc-two-sum');u.filters.q='prefix';assert.equal(u.filtered().length,0);u.filters.q='';u.levelTopic='core';assert.equal(u.filtered().length,0);assert.equal(u.state(u.items[0]).star,true);
});
test('closing flush waits until newly pending folder changes are written and refuses unresolved save conflicts',async()=>{
 const {context}=subject();context.clearTimeout=clearTimeout;const bridge=context.SaveBridge;bridge.pending=new Set(['draft']);bridge.syncing=false;let writes=0;bridge.sync=async()=>{writes++;if(writes===1){bridge.pending.delete('draft');bridge.pending.add('activity');}else bridge.pending.clear();};await bridge.flush();assert.equal(writes,2);assert.equal(bridge.pending.size,0);bridge.conflicts=[['draft',{}]];await assert.rejects(bridge.flush(),/saved versions/);
});

test('all difficulty levels include theory, source links, files and unknown legacy questions with shared progress',()=>{
 const {u}=subject();u.items=[
  {id:'pack-pdf-q244',packId:'PDF-Q244',title:'Shallow empty check',topics:['Python'],companies:{},difficulty:'Easy',kind:'reference',sourceGroup:'python-pack'},
  {id:'file-book-page-5',title:'Database transactions',topics:['Database'],companies:{},difficulty:'Medium',kind:'reference',sourceGroup:'files-books'},
  {id:'source-1',title:'Python exercise',topics:['Python'],companies:{},difficulty:'Hard',kind:'reference',sourceGroup:'source-links'},
  {id:'old-1',title:'Unspecified topic',topics:[],companies:{},difficulty:'Unknown',kind:'reference'}];
 u.scope='levels-all';assert.equal(u.filtered().length,4);
 u.filters.difficulty='Medium';assert.equal(u.filtered()[0].id,'file-book-page-5');
 u.filters.difficulty='';u.filters.kind='python-pack';u.filters.q='PDF-Q244';assert.equal(u.filtered()[0].id,'pack-pdf-q244');
 u.setState('pack-pdf-q244',{status:'solved',star:true});u.filters.status='solved';assert.equal(u.filtered().length,1);
 u.scope='all';assert.equal(u.filtered()[0].id,'pack-pdf-q244');assert.equal(u.state(u.items[0]).star,true);
 u.filters={q:'',difficulty:'',company:'',status:'',kind:''};u.scope='levels-all';u.levelTopic='Database';assert.equal(u.filtered()[0].id,'file-book-page-5');
});

test('merged question aliases retain saved progress, bookmarks, drafts and notes while allowing explicit edits',()=>{
 const {u,records}=subject();const p={id:'main',aliasIds:['old-copy'],title:'Example',topics:[],companies:{}};
 records.set('library_progress',{'old-copy':{status:'solved',star:true}});records.set('library_draft_old-copy_python','def solve(): return 1');records.set('library_notes_old-copy','Original notes');
 u.byId=new Map([['main',p],['old-copy',p]]);assert.equal(u.state(p).status,'solved');assert.equal(u.state(p).star,true);assert.equal(u.draft(p,'python'),'def solve(): return 1');assert.equal(u.notes(p),'Original notes');
 u.setState('old-copy',{star:false,status:'todo'});assert.equal(u.state(p).star,false);assert.equal(u.state(p).status,'todo');assert.ok(records.get('library_progress').main);
});

test('actual catalog and retained topics contain no repeated normalized question titles',()=>{
 const {u,context}=subject();vm.runInContext(fs.readFileSync(__dirname+'/web/studio/offline/catalog.js','utf8'),context);
 const data=JSON.parse(fs.readFileSync(__dirname+'/data/catalog.json','utf8'));
 const rows=u.makeIndex(data,context.window.CODELAB_OFFLINE_CATALOG.entries,[]),seen=new Set();
 for(const p of rows){const key=u.questionIdentity(p.title);assert.ok(!seen.has(key),'Repeated title: '+p.title);seen.add(key);}
 assert.notEqual(u.questionIdentity('What is / ?'),u.questionIdentity('What is // ?'));
 assert.notEqual(u.questionIdentity('Combination Sum II'),u.questionIdentity('Combination Sum III'));
 assert.equal(u.questionIdentity('Exercise 1: Reverse String'),u.questionIdentity('Trace, implement and test: Reverse String'));
});
