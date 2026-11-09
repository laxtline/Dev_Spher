/* Original training games. Results are practice feedback, not psychometric or company scores. */
'use strict';
window.CODELAB_COGNITIVE={
  random(seed){let value=(seed>>>0)||1;return n=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value%n;};},
  generate(kind,seed){
    const rand=this.random(seed),rounds=[];
    if(kind==='memory')for(let i=0;i<5;i++){
      const cells=Array.from({length:16},(_,j)=>j);for(let j=15;j>0;j--){const k=rand(j+1);[cells[j],cells[k]]=[cells[k],cells[j]];}
      rounds.push({size:4,target:cells.slice(0,3+i).sort((a,b)=>a-b)});
    }
    else if(kind==='switch')for(let i=0;i<12;i++){
      const number=1+rand(99),rule=i%3;
      rounds.push({number,rule,label:['Is the number even?','Is the number strictly greater than 50?','Is the number divisible by 3?'][rule],expected:rule===0?number%2===0:rule===1?number>50:number%3===0});
    }
    else if(kind==='path')for(let i=0;i<10;i++){
      let row=2,col=2;const steps=[];
      for(let j=0;j<6+i%3;j++){
        const moves=[['North',-1,0],['East',0,1],['South',1,0],['West',0,-1]].filter(([,dr,dc])=>row+dr>=0&&row+dr<5&&col+dc>=0&&col+dc<5);
        const [name,dr,dc]=moves[rand(moves.length)];steps.push(name);row+=dr;col+=dc;
      }
      rounds.push({size:5,steps,target:row*5+col});
    }
    else throw new Error('Unknown drill type.');
    return rounds;
  },
  correct(kind,round,answer){if(kind==='memory')return Array.isArray(answer)&&JSON.stringify([...answer].sort((a,b)=>a-b))===JSON.stringify(round.target);return answer===(kind==='switch'?round.expected:round.target);},
  cell(index,size){return `row ${Math.floor(index/size)+1}, column ${index%size+1}`;}
};
const Cognitive={
  labels:{memory:'Grid memory',switch:'Rule switching',path:'Direction tracking'},interval:null,
  state(){return ExamHub.state();},
  active(){return this.state().activeDrill;},
  write(session){ExamHub.save('activeDrill',session);},
  now(){return Date.now();},
  start(kind){
    if(!this.labels[kind])return;if(this.active()){Toast.show('Resume or finish the saved drill first.','info');return;}
    const started=this.now(),seed=crypto.getRandomValues(new Uint32Array(1))[0],rounds=CODELAB_COGNITIVE.generate(kind,seed);
    this.write({version:1,id:started+'-'+seed,kind,seed,started,deadline:started+180000,rounds,index:0,answers:[],selection:[],revealUntil:kind==='memory'?started+3000:0});this.render();
  },
  render(){
    clearInterval(this.interval);const h=ExamHub.h.bind(ExamHub),session=this.active();
    if(session&&session.deadline<=this.now()){this.finish(true);return;}
    if(!session){
      const history=this.state().drillHistory||[];
      ExamHub.mount(`<h2>Cognitive drills</h2><p>Three original drill types for memory, attention and rule following. Patterns are generated for each attempt. These are independent preparation games, with no company cutoff or psychometric interpretation.</p><div class="exam-grid">${Object.entries(this.labels).map(([kind,title])=>`<article class="exam-card"><span class="exam-badge">3-minute practice</span><h3>${title}</h3><p>${kind==='memory'?'Memorise highlighted cells for three seconds, then reproduce the exact set. Five rounds increase from three to seven target cells.':kind==='switch'?'Apply the rule shown on each round: even, greater than 50 or divisible by 3. Twelve rounds test careful switching.':'Start at row 3, column 3 and follow every one-cell move. Pick the final square. Ten rounds use only valid in-grid paths.'}</p><button class="btn-primary" onclick="Cognitive.start('${kind}')">Start ${title.toLowerCase()}</button></article>`).join('')}</div><div class="exam-note">The 3-minute deadline continues while away or after reload. A drill saves after each action; returning resumes the same pattern and deadline. Memory rounds use exact-set scoring. Unanswered rounds count as unanswered. Results and review are included in Export progress.</div><h3>Recent drill results</h3>${history.length?`<div class="exam-table-wrap"><table class="exam-table"><thead><tr><th>Drill</th><th>Correct / total</th><th>Unanswered</th><th>Review</th></tr></thead><tbody>${history.map(r=>`<tr><td>${h(this.labels[r.kind])}<div class="exam-meta">${h(new Date(r.finished).toLocaleString())}</div></td><td>${r.correct}/${r.rounds.length}</td><td>${r.unanswered}</td><td><button class="btn-ghost" onclick="Cognitive.review('${h(r.id)}')">Review attempt</button></td></tr>`).join('')}</tbody></table></div>`:'<p>No completed drills yet. Choose a drill above.</p>'}`);
      return;
    }
    const round=session.rounds[session.index],preview=session.kind==='memory'&&this.now()<session.revealUntil;
    const grid=(size,body)=>`<div class="cognitive-grid" style="--cognitive-columns:${size}">${Array.from({length:size*size},(_,i)=>body(i)).join('')}</div>`;
    const exercise=session.kind==='memory'?`<p id="cognitive-instruction">${preview?'Remember the highlighted cells. The pattern will hide after three seconds.':'Select exactly the cells that were highlighted, then submit the round.'}</p>${grid(4,i=>`<button class="cognitive-cell ${preview&&round.target.includes(i)?'remember':!preview&&session.selection.includes(i)?'selected':''}" aria-label="${h(CODELAB_COGNITIVE.cell(i,4))}" aria-pressed="${!preview&&session.selection.includes(i)}" ${preview?'disabled':''} onclick="Cognitive.toggle(${i})">${Math.floor(i/4)+1},${i%4+1}${preview&&round.target.includes(i)?'<span>Remember</span>':''}</button>`)}<p>${preview?'Pattern visible':`${session.selection.length} cells selected`}</p><button class="btn-primary" ${preview?'disabled':''} onclick="Cognitive.answer()">Submit memory round</button>`:
      session.kind==='switch'?`<p class="cognitive-rule">${h(round.label)}</p><div class="cognitive-number">${round.number}</div><div class="exam-actions"><button class="btn-primary" onclick="Cognitive.answer(true)">Yes</button><button class="btn-ghost" onclick="Cognitive.answer(false)">No</button></div>`:
      `<p>Start at <strong>row 3, column 3</strong>. North is up; east is right. Each instruction moves one cell.</p><p class="cognitive-rule">${round.steps.map(h).join(' → ')}</p>${grid(5,i=>`<button class="cognitive-cell" aria-label="${h(CODELAB_COGNITIVE.cell(i,5))}" onclick="Cognitive.answer(${i})">${Math.floor(i/5)+1},${i%5+1}</button>`)}`;
    ExamHub.mount(`<article class="exam-card"><span class="exam-badge">Original timed drill</span><h2>${h(this.labels[session.kind])}</h2><p>Round ${session.index+1} of ${session.rounds.length} · <strong id="cognitive-clock" role="timer"></strong> remaining</p>${exercise}<div class="exam-actions"><button class="btn-ghost" onclick="Cognitive.finish(false)">Finish & review</button><button class="btn-ghost" onclick="ExamHub.nav('practice')">Save & leave</button></div></article>`);
    this.tick();this.interval=setInterval(()=>this.tick(),200);
  },
  tick(){
    const s=this.active();if(!s||Router.current!=='exam-questions'||ExamHub.tab!=='cognitive'){clearInterval(this.interval);return;}
    const now=this.now();if(now>=s.deadline){this.finish(true);return;}
    const left=Math.ceil((s.deadline-now)/1000),clock=document.getElementById('cognitive-clock');if(clock)clock.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;
    if(s.kind==='memory'&&now>=s.revealUntil&&document.querySelector('.cognitive-cell.remember'))this.render();
  },
  toggle(cell){
    const s=this.active();if(!s||s.kind!=='memory')return;if(this.now()>=s.deadline){this.finish(true);return;}if(this.now()<s.revealUntil)return;
    if(!Number.isInteger(cell)||cell<0||cell>=16)return;s.selection=s.selection.includes(cell)?s.selection.filter(i=>i!==cell):[...s.selection,cell];this.write(s);this.render();
  },
  answer(value){
    const s=this.active();if(!s)return;const now=this.now();if(now>=s.deadline){this.finish(true);return;}if(s.kind==='memory'&&now<s.revealUntil)return;
    const answer=s.kind==='memory'?s.selection.slice():value;
    if(s.kind==='switch'&&typeof answer!=='boolean'||s.kind==='path'&&(!Number.isInteger(answer)||answer<0||answer>=25))return;
    s.answers[s.index]=answer;s.index++;s.selection=[];s.revealUntil=s.kind==='memory'?now+3000:0;this.write(s);
    if(s.index===s.rounds.length)this.finish(false);else this.render();
  },
  finish(expired){
    const s=this.active();if(!s)return;clearInterval(this.interval);const finished=this.now(),rows=s.rounds.map((r,i)=>({round:i+1,answer:s.answers[i]??null,correct:s.answers[i]!==undefined&&CODELAB_COGNITIVE.correct(s.kind,r,s.answers[i])}));
    const result={...s,finished,expired:!!expired,elapsedMs:Math.max(0,Math.min(finished,s.deadline)-s.started),correct:rows.filter(r=>r.correct).length,unanswered:s.rounds.length-s.answers.length};
    const state=this.state();state.activeDrill=null;state.drillHistory=[result,...(state.drillHistory||[]).filter(r=>r.id!==s.id)].slice(0,20);Store.set('exam_hub',state);this.review(s.id);
  },
  format(kind,round,answer){if(answer===undefined||answer===null)return 'Unanswered';if(kind==='memory')return answer.length?answer.map(i=>CODELAB_COGNITIVE.cell(i,4)).join('; '):'No cells selected';if(kind==='switch')return answer?'Yes':'No';return CODELAB_COGNITIVE.cell(answer,round.size);},
  review(id){
    clearInterval(this.interval);const s=(this.state().drillHistory||[]).find(r=>r.id===id);if(!s)return;const h=ExamHub.h.bind(ExamHub);
    ExamHub.mount(`<h2>${h(this.labels[s.kind])} · attempt review</h2><p>${s.correct}/${s.rounds.length} correct · ${s.unanswered} unanswered · ${Math.round(s.elapsedMs/1000)} seconds elapsed ${s.expired?'· deadline reached':''}</p><p>Practice feedback only. Compare your answer with the rule or target, then retry a fresh generated attempt.</p><div class="exam-actions"><button class="btn-primary" onclick="Cognitive.render()">Choose another drill</button></div><div class="exam-grid">${s.rounds.map((r,i)=>{const answer=s.answers[i],expected=s.kind==='memory'?r.target:s.kind==='switch'?r.expected:r.target,ok=answer!==undefined&&CODELAB_COGNITIVE.correct(s.kind,r,answer);return `<article class="exam-card"><span class="exam-badge">Round ${i+1} · ${answer===undefined?'Unanswered':ok?'Correct':'Needs review'}</span><h3>${s.kind==='switch'?h(r.label+' Number: '+r.number):s.kind==='path'?h(r.steps.join(' → ')):'Reproduce the remembered cells'}</h3><p>Your answer: ${h(this.format(s.kind,r,answer))}</p><p>Expected: ${h(this.format(s.kind,r,expected))}</p>${s.kind==='memory'?`<div class="cognitive-grid" style="--cognitive-columns:4">${Array.from({length:16},(_,j)=>`<span class="cognitive-cell ${r.target.includes(j)?'remember':''}">${Math.floor(j/4)+1},${j%4+1}</span>`).join('')}</div>`:''}</article>`;}).join('')}</div>`);
  }
};
const cognitiveLeave=Navigation.leaveSession.bind(Navigation);
Navigation.leaveSession=function(){clearInterval(Cognitive.interval);return cognitiveLeave();};
