'use strict';
const PraticeStudio={frame:null,ready:false,pending:null,question:null};
function studioPage(){
 shell('<div class="studio-toolbar"><div><strong>Code Studio</strong><span class="muted"> · Editor, study material, SQL & exams</span></div><div class="button-row"><button class="btn small" data-action="studio-return" id="studio-return" hidden>← Return & test question</button><a class="btn small ghost" href="studio/index.html" target="_blank" rel="noopener">Open in full tab ↗</a></div></div>');
 let host=document.getElementById('studio-host');
 if(!host){host=document.createElement('section');host.id='studio-host';host.innerHTML='<iframe id="studio-frame" title="Code Studio and StudyLab offline workspace" src="studio/index.html" allow="fullscreen; clipboard-write"></iframe>';document.body.appendChild(host);PraticeStudio.frame=host.querySelector('iframe');}
 host.hidden=false;
 if(!PraticeStudio.pending){try{const saved=JSON.parse(sessionStorage.getItem('pratice-studio-question')||'null');if(saved&&catalog.problems.some(p=>p.id===saved.id)){PraticeStudio.pending=saved;PraticeStudio.question=saved.id;}}catch{}}
 if($('#studio-return'))$('#studio-return').hidden=!PraticeStudio.question;
 if(PraticeStudio.ready)deliverStudioTransfer();
 document.title='Code Studio — Pratice Code Offline';
}
function openFullEditor(){
 if(!activeProblem)return;storeDraft();
 const data={id:activeProblem.id,title:activeProblem.title,language,code:$('#code').value};
 PraticeStudio.pending=data;PraticeStudio.question=data.id;
 sessionStorage.setItem('pratice-studio-question',JSON.stringify(data));
 go('studio');
}
function deliverStudioTransfer(){
 const pending=PraticeStudio.pending;
 if(!pending||!PraticeStudio.ready)return;
 const saved=user.progress[pending.id]?.drafts?.[pending.language];
 PraticeStudio.frame.contentWindow.postMessage({type:'pratice:open',...pending,code:saved??pending.code},location.origin);
 PraticeStudio.pending=null;
}
function returnFromStudio(){if(PraticeStudio.frame&&PraticeStudio.ready)PraticeStudio.frame.contentWindow.postMessage({type:'pratice:return'},location.origin);}
window.addEventListener('message',async event=>{
 if(event.origin!==location.origin||event.source!==PraticeStudio.frame?.contentWindow)return;
 const d=event.data;if(!d||typeof d!=='object')return;
 if(d.type==='studio:ready'){PraticeStudio.ready=true;deliverStudioTransfer();return;}
 if(d.type==='studio:error'){toast(d.message);return;}
 if(!['studio:draft','studio:return'].includes(d.type)||!catalog.problems.some(p=>p.id===d.id)||typeof d.code!=='string'||d.code.length>60000||!['python','javascript','cpp','c','java','html','css','sql','mongodb'].includes(d.language))return;
 const drafts={...(user.progress[d.id]?.drafts||{}),[d.language]:d.code};
 await updateProgress(d.id,{drafts},d.type==='studio:return');
 if(d.type==='studio:return'){
   language=d.language;localStorage.setItem('surya-language',language);sessionStorage.removeItem('pratice-studio-question');PraticeStudio.question=null;go('problem/'+d.id);
 }
});
