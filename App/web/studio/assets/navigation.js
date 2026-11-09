'use strict';
const Navigation={
  stack:[],index:0,restoring:false,ready:false,
  key(){return 'codelab-navigation:'+new URL('./',document.baseURI).pathname;},
  encode(route){return '#'+[route.view,route.arg,route.detail,route.tab].filter(v=>v!==undefined&&v!==null&&v!=='').map(encodeURIComponent).join('/');},
  parse(hash){const [view,arg,detail,tab]=hash.replace(/^#/,'').split('/').map(v=>{try{return decodeURIComponent(v);}catch{return '';}});return {view:view||'list',arg,detail,tab};},
  snapshot(){const view=document.getElementById('view-'+Router.current);if(this.stack[this.index])this.stack[this.index].scroll=view?.scrollTop||0;},
  persist(){try{sessionStorage.setItem(this.key(),JSON.stringify({stack:this.stack,index:this.index}));}catch{}},
  record(route){
    if(!this.ready||this.restoring)return;
    const normalized=JSON.parse(JSON.stringify(route)),hash=this.encode(normalized);
    if(this.stack[this.index]&&this.encode(this.stack[this.index])===hash){this.controls();return;}
    this.snapshot();this.stack=this.stack.slice(0,this.index+1);this.stack.push(normalized);this.index=this.stack.length-1;
    history.pushState({codelabIndex:this.index},'',hash);this.persist();this.controls();
  },
  leaveSession(){
    LearningTiming.flush();
    if(Exam.submitting||Runner.busy||Playground.busy||Study.running){Toast.show('Wait for the current evaluation or program to finish.','info');return false;}
    if(PracticeSession.session){PracticeSession.persist();clearInterval(PracticeSession.interval);PracticeSession.session=null;document.body.dataset.practiceActive='false';Toast.show('Session saved. Its original deadline continues.','info');}
    if(Exam.active){Academy.snapshotCoding();Exam.active=false;Contest.active=false;clearInterval(Exam.saveInterval);document.getElementById('exam-nav')?.remove();if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});Toast.show('Coding round saved. Its original deadline continues.','info');}
    if(WrittenTest.active||Aptitude.active){ClassicSave.persist();WrittenTest.active=false;Aptitude.active=false;Toast.show('Classic session saved. Its original deadline continues.','info');}
    document.querySelectorAll('.nav-link').forEach(el=>el.style.pointerEvents='');ProgressBackup.flush();Timer.stop();return true;
  },
  open(route){
    if(!this.leaveSession())return;
    this.render(route);this.record(route);
  },
  render(route){
    const {view,arg,detail,tab}=route;
    if(view==='study'){if(arg==='subjects')Study.subject(detail);else if(arg==='interviews')Study.interviews(detail);else if(tab==='coverage'||arg==='coverage')Study.coverage();else Study.show(arg,detail,tab);}
    else if(view==='dashboard')Learning.dashboard();
    else if(view==='revision')Learning.revision();
    else if(view==='profile')Academy.profile(arg);
    else if(view==='practice-history')Academy.history();
    else if(view==='practice-review'){const report=Store.get('practice_history',[]).find(r=>String(r.finished)===String(arg));if(report)PracticeSession.results(report);else Academy.history();}
    else if(view==='coding-history')CodingReview.history();
    else if(view==='coding-review')CodingReview.show(arg);
    else if(view==='roadmap'){Academy.track=arg||'service';Academy.step(+detail||1);}
    else if(view==='library'){Router.go('library');if(arg&&OfflineLibrary.catalog.entries.some(e=>e.key===arg))OfflineLibrary.open(arg);}
    else if(view==='problem')Router.go('problem',/^\d+$/.test(String(arg))?Number(arg):arg);
    else if(view==='session'){const s=Store.get('practice_session',null);if(s)PracticeSession.resume();else Router.go('written');}
    else if(view==='coding-session'){if(Store.get('coding_session',null))Academy.resumeCoding();else Router.go('exam');}
    else if(view==='classic-session'){ClassicSave.resume();}
    else if(['list','playground','written','exam','theory','sources','contest','mycode','result'].includes(view))Router.go(view,arg);
    else Router.go('list');
  },
  controls(){const back=document.getElementById('nav-back'),forward=document.getElementById('nav-forward');if(back){back.disabled=this.index<=0;forward.disabled=this.index>=this.stack.length-1;}},
  move(delta){if(this.index+delta>=0&&this.index+delta<this.stack.length)history.go(delta);},
  init(){
    const box=document.createElement('span');box.className='history-controls';box.innerHTML='<button id="nav-back" aria-label="Go back" title="Back (saves active sessions)" onclick="Navigation.move(-1)">←</button><button id="nav-forward" aria-label="Go forward" title="Forward" onclick="Navigation.move(1)">→</button>';document.querySelector('.nav-left').prepend(box);
    try{const saved=JSON.parse(sessionStorage.getItem(this.key()));if(saved?.stack?.length&&Number.isInteger(history.state?.codelabIndex)){this.stack=saved.stack;this.index=history.state.codelabIndex;}}catch{}
    const initial=this.parse(location.hash||'#'+Router.current);
    if(!this.stack.length){this.stack=[initial];this.index=0;}else this.stack[this.index]=initial;
    history.replaceState({codelabIndex:this.index},'',this.encode(initial));this.ready=true;this.persist();this.controls();
    window.addEventListener('popstate',event=>{
      const target=event.state?.codelabIndex;if(!Number.isInteger(target)||!this.stack[target])return;
      if(target===this.index){this.controls();return;}
      if(!this.leaveSession()){history.go(this.index-target);return;}
      this.restoring=true;this.snapshot();this.index=target;
      try{this.render(this.stack[target]);}finally{this.restoring=false;this.persist();this.controls();}
      requestAnimationFrame(()=>{const view=document.getElementById('view-'+Router.current);if(view)view.scrollTop=this.stack[target].scroll||0;});
    });
    // Handle manually entered hash links as well as browser history.
    document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const hash=link.getAttribute('href');if(!hash||hash==='#')return;const route=this.parse(hash);if(['study','theory','library','dashboard','revision','problem','written','exam','sources','contest','mycode','playground','list'].includes(route.view)){event.preventDefault();this.open(route);}});
    window.addEventListener('hashchange',()=>{const route=this.parse(location.hash);if(this.encode(this.stack[this.index])===this.encode(route))return;if(!this.leaveSession()){history.replaceState({codelabIndex:this.index},'',this.encode(this.stack[this.index]));return;}this.snapshot();this.stack=this.stack.slice(0,this.index+1);this.stack.push(route);this.index=this.stack.length-1;history.replaceState({codelabIndex:this.index},'',this.encode(route));this.restoring=true;try{this.render(route);}finally{this.restoring=false;this.persist();this.controls();}});
    if(location.hash&&location.hash!=='#list'){this.restoring=true;try{this.render(initial);}finally{this.restoring=false;}}
  }
};
