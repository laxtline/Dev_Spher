/* Coding-round navigation and saved, inspectable feedback. All state stays on this device. */
'use strict';
const CodingReview = {
  roundId:null,started:null,visited:{},marked:{},
  clone(value){return JSON.parse(JSON.stringify(value));},
  metadata(){return {roundId:this.roundId,started:this.started,visited:this.visited,marked:this.marked};},
  restore(meta={}){this.roundId=meta.roundId||'coding-'+Date.now();this.started=meta.started||Date.now();this.visited=meta.visited||{};this.marked=meta.marked||{};},
  currentReport(id){return Store.get('coding_history',[]).find(r=>r.id===id);},
  restoreQuestion(){
    const id=Exam.qids[Exam.index],saved=Exam.codes[id];
    if(saved){Editor.load(Questions.byId(id),saved.lang);Editor.instance.setValue(saved.code);if(saved.cases?.length){TestPanel.cases=this.clone(saved.cases);TestPanel.active=0;TestPanel.render();}}
    this.visited[id]=true;
  },
  mark(){if(Exam.submitting)return;const id=Exam.qids[Exam.index];this.marked[id]=!this.marked[id];Academy.snapshotCoding();Exam.injectNav();},
  leave(){
    if(Exam.submitting)return;
    Academy.snapshotCoding();Exam.active=false;Contest.active=false;Timer.stop();clearInterval(Exam.saveInterval);
    document.getElementById('exam-nav')?.remove();document.querySelectorAll('.nav-link').forEach(l=>l.style.pointerEvents='');
    if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
    Router.go('exam');
  },
  resume(){
    const s=Store.get('coding_session',null);if(!s)return;
    App.mode='exam';document.body.dataset.mode='exam';document.querySelectorAll('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode==='exam'));
    Exam.config=s.config;Exam.qids=s.qids;Exam._aptResult=s.apt;Exam._academyCognitive=s.cognitive;Exam._classicAptitude=s.classic;
    Exam.beginCoding();Exam.codes=s.codes;Exam.index=s.index;Exam.deadline=s.deadline;this.restore(s.review);
    Exam._contestId=s.contestId||null;Contest.contest=CONTESTS.find(c=>c.id===s.contestId);Contest.active=!!Contest.contest;
    Router.go('problem',Exam.qids[Exam.index]);this.restoreQuestion();Exam.injectNav();
    Academy.snapshotCoding();
    const left=Math.max(0,Math.ceil((s.deadline-Date.now())/1000));
    const submit=()=>Contest.active?Contest.finish(true):Exam.submitExam(true);
    if(left)Timer.start('down',left,submit);else submit();
  },
  capture(score,rows){
    const incomplete=rows.some(r=>r.evaluationError),finished=Date.now();
    const report=this.clone({version:1,id:this.roundId||'coding-'+finished,started:this.started||finished,finished,config:Exam.config,
      status:incomplete?'incomplete':'complete',codingScore:incomplete?null:score,finalScore:incomplete?null:Exam._aptResult?Math.round((score+Exam._aptResult.pct)/2):score,
      aptitude:Exam._aptResult||null,cognitive:Exam._academyCognitive||null,rows,submissions:Exam.codes,
      questions:rows.map(r=>{const q=Questions.byId(r.id);return {id:q.id,title:q.title,problemStatement:q.problemStatement,inputFormat:q.inputFormat,outputFormat:q.outputFormat,editorial:q.editorial,referenceCode:q.referenceCode||null};})});
    let history=Store.get('coding_history',[]).filter(r=>r.id!==report.id);history.unshift(report);Store.set('coding_history',history.slice(0,20));
    this.latest=report;return report;
  },
  download(id){const r=this.currentReport(id)||this.latest;if(r)download('study-lab-coding-report.json',JSON.stringify(r,null,2),'application/json');},
  show(id){
    const report=this.currentReport(id)||this.latest;if(!report)return;
    const h=Academy.h.bind(Academy);
    Academy.activate('result');Academy.mount('result',Academy.hero('Review your coding round',h(report.config.company||'Coding feedback'),
      `Candidate: ${h(report.config.name)} · ${report.status==='incomplete'?'Evaluation incomplete':`Practice score: ${report.finalScore}/100`} · ${h(new Date(report.finished).toLocaleString())}`,
      Academy.button('Coding history','CodingReview.history()')+Academy.button('Download JSON report',`CodingReview.download('${report.id}')`))+
      '<p class="academy-note">Test cases below are available after submission. Runtime is measured on this device or compiler service and is not a company benchmark. Saved reports include your code; Export All Progress includes this history.</p>'+
      (report.aptitude?`<p class="academy-note">Cognitive section: ${report.aptitude.correct}/${report.aptitude.total}. Combined practice score weights coding and cognitive percentages equally.</p>`:'')+
      report.rows.map((row,index)=>{
        const q=report.questions.find(q=>q.id===row.id),sub=report.submissions[row.id];
        return `<article class="academy-card coding-review-card"><div class="coding-review-heading"><div><span class="academy-kicker">Question ${index+1}</span><h2>${h(row.title)}</h2><p>${h(row.status)} · ${row.passed}/${row.total} cases passed</p><p>Active problem time: ${Number.isFinite(row.timeMs)?Math.round(row.timeMs/1000)+'s':'?'}. ${!sub?.code?.trim()?'Unanswered: begin with a small example and a brute-force approach.':row.evaluationError?'Restore the runtime, then retry evaluation.':row.passed<row.total?'Review the first failing case, explain the invariant and retry without viewing the reference.':'Repeat later with an edge case and explain the complexity.'}</p></div>${Academy.button('Open for practice',`CodingReview.practice('${report.id}',${row.id})`)}</div>`+
          (row.evaluationError?`<p class="academy-note">${h(row.evaluationError)}</p>`:'')+
          `<details><summary>Your submitted code · ${h(sub?.lang||'No submission')}</summary><pre class="lib-code"><code>${h(sub?.code||'No code submitted.')}</code></pre></details>`+
          `<div class="coding-case-grid">${(row.caseResults||[]).map(c=>`<details class="coding-case"><summary>Case ${c.number} · ${h(c.status)}${c.time?' · '+c.time.toFixed(1)+' ms':''}</summary><h3>Input</h3><pre>${h(c.input)}</pre><h3>Expected</h3><pre>${h(c.expected)}</pre><h3>Your output</h3><pre>${h(c.actual||'(no output)')}</pre>${c.error?`<h3>Error</h3><pre>${h(c.error)}</pre>`:''}</details>`).join('')}</div>`+
          `<details><summary>Worked approach</summary><p class="coding-editorial">${h(q.editorial||'Use the problem statement and reference collection to review this problem.')}</p>${Object.entries(q.referenceCode||{}).map(([lang,code])=>`<h3>${h(lang)}</h3><pre class="lib-code"><code>${h(code)}</code></pre>`).join('')}</details></article>`;
      }).join(''));
  },
  practice(id,qid){
    const report=this.currentReport(id)||this.latest,sub=report?.submissions[qid];
    if(!Questions.byId(qid)){Toast.show('This custom problem is no longer available. Its code remains in the report.','info');return;}
    // Submitted code stays in the report; practice reopens the current local draft.
    App.setMode('advanced');Router.go('problem',qid);
    if(sub){Editor.load(Questions.byId(qid),sub.lang);}
  },
  history(){
    const rows=Store.get('coding_history',[]),h=Academy.h.bind(Academy);
    Academy.activate('result');Academy.mount('result',Academy.hero('Saved on this device','Coding exam history','The latest 20 completed or incomplete coding evaluations. Retrying an incomplete evaluation updates its report.',Academy.button('Exam profiles',"Router.go('exam')"))+
      `<div class="academy-grid">${rows.map(r=>`<article class="academy-card"><h2>${h(r.config.company||'Coding round')}</h2><p>${h(new Date(r.finished).toLocaleString())}</p><p>${r.status==='incomplete'?'Evaluation incomplete':r.finalScore+'/100 practice score'} · ${r.rows.length} coding problems</p>${Academy.button('Review round',`CodingReview.show('${r.id}')`)} ${Academy.button('Download JSON',`CodingReview.download('${r.id}')`)}</article>`).join('')||'<p>No coding evaluations yet. Submit a coding round to save its feedback.</p>'}</div>`);
  }
};

const assessmentBegin=Exam.beginCoding.bind(Exam),assessmentNav=Exam.injectNav.bind(Exam),assessmentSave=Exam.saveCurrent.bind(Exam),assessmentSnapshot=Academy.snapshotCoding.bind(Academy),assessmentResults=Exam.showResults.bind(Exam),assessmentHome=Academy.examHome.bind(Academy);
Exam.beginCoding=function(){CodingReview.restore();if(this.config.set!=='Contest')this._contestId=null;assessmentBegin();CodingReview.visited[this.qids[0]]=true;this.injectNav();Academy.snapshotCoding();};
Exam.saveCurrent=function(){assessmentSave();if(this.active&&Editor.ready)Editor.save();};
Exam.goto=function(index){
  if(this.submitting||index<0||index>=this.qids.length)return;
  this.saveCurrent();this.index=index;Router.go('problem',this.qids[index]);CodingReview.restoreQuestion();this.injectNav();Academy.snapshotCoding();
};
Exam.injectNav=function(){
  assessmentNav();const nav=document.getElementById('exam-nav');if(!nav)return;
  nav.classList.add('assessment-nav');const id=this.qids[this.index];
  nav.querySelectorAll('.qdot').forEach((dot,i)=>{const key=this.qids[i];dot.classList.toggle('review',!!CodingReview.marked[key]);dot.title=(CodingReview.visited[key]?'Visited':'Not visited')+(CodingReview.marked[key]?' · Marked for review':'');dot.setAttribute('role','button');dot.tabIndex=0;dot.setAttribute('aria-label',`Question ${i+1}${CodingReview.marked[key]?', marked for review':''}`);dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();Exam.goto(i);}};});
  const mark=document.createElement('button');mark.className='btn-ghost';mark.textContent=CodingReview.marked[id]?'Unmark review':'Mark for review';mark.onclick=()=>CodingReview.mark();
  const leave=document.createElement('button');leave.className='btn-ghost';leave.textContent='Save & leave';leave.title='Your exam deadline continues while away';leave.onclick=()=>CodingReview.leave();
  nav.querySelector('.btn-submit').before(mark,leave);
  const status=document.createElement('span');status.className='coding-save-status';status.textContent=`${Object.keys(CodingReview.visited).length}/${this.qids.length} visited · ${Object.values(CodingReview.marked).filter(Boolean).length} marked · Drafts saved locally`;nav.append(status);
  if(!nav.dataset.measured){nav.dataset.measured='true';CodingReview.navObserver?.disconnect();CodingReview.navObserver=new ResizeObserver(()=>document.documentElement.style.setProperty('--coding-nav-height',nav.offsetHeight+'px'));CodingReview.navObserver.observe(nav);}
  document.documentElement.style.setProperty('--coding-nav-height',nav.offsetHeight+'px');
};
Academy.snapshotCoding=function(){assessmentSnapshot();const s=Store.get('coding_session',null);if(this===Academy&&Exam.active&&s){s.review=CodingReview.clone(CodingReview.metadata());s.contestId=Exam._contestId||null;Store.set('coding_session',s);}};
Academy.resumeCoding=()=>CodingReview.resume();
const assessmentRetry=Academy.retryCodingEvaluation.bind(Academy);
Academy.retryCodingEvaluation=function(){const s=Store.get('coding_session',null);if(s)CodingReview.restore(s.review);assessmentRetry();};
Academy.examHome=function(){assessmentHome();const button=document.createElement('button');button.className='btn-ghost';button.textContent='Coding exam history';button.onclick=()=>CodingReview.history();document.querySelector('#view-exam .academy-actions').append(button);};
Exam.showResults=function(score,rows){
  assessmentResults(score,rows);const report=CodingReview.capture(score,rows),box=document.querySelector('#view-result .modal-foot');
  const review=box.querySelector('button');review.textContent='Review coding feedback';review.onclick=()=>CodingReview.show(report.id);
  const history=document.createElement('button');history.className='btn-ghost';history.textContent='Coding exam history';history.onclick=()=>CodingReview.history();box.append(history);
};
const assessmentSubmit=Exam.submitExam.bind(Exam);
Exam.submitExam=async function(auto){
  if(this.submitting)return;
  const select=document.getElementById('lang-select');Editor.instance?.updateOptions({readOnly:true});if(select)select.disabled=true;
  try{await assessmentSubmit(auto);}finally{Editor.instance?.updateOptions({readOnly:false});if(select)select.disabled=false;}
};
window.addEventListener('beforeunload',()=>{if(Exam.active&&!Exam.submitting)Academy.snapshotCoding();});
const assessmentContestStart=Contest.start.bind(Contest);
Contest.start=function(id){CodingReview.restore();assessmentContestStart(id);Exam.deadline=Date.now()+this.contest.minutes*60000;CodingReview.visited[Exam.qids[0]]=true;clearInterval(Exam.saveInterval);Exam.saveInterval=setInterval(()=>Academy.snapshotCoding(),1000);Academy.snapshotCoding();};
const assessmentInject=Exam.injectNav.bind(Exam);
Exam.injectNav=function(){assessmentInject();if(Contest.active&&this._contestId){document.querySelector('#exam-nav .btn-submit').onclick=()=>Confirm.show('Submit Contest?','End this coding contest and see feedback?','Submit',()=>Contest.finish(false));}};
const assessmentMode=App.setMode.bind(App),assessmentAppHome=App.home.bind(App);
App.setMode=function(mode){if(Exam.submitting){Toast.show('Wait for the current evaluation to finish.','info');return;}if(Exam.active){Confirm.show('Save and leave coding round?','Your drafts will be saved. The original deadline keeps running while you are away.','Save & leave',()=>{CodingReview.leave();assessmentMode(mode);});return;}assessmentMode(mode);};
App.home=function(){if(Exam.active){App.setMode(App.mode);return;}assessmentAppHome();};
