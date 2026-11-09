'use strict';
// This bridge joins the two workspaces without replacing StudyLab's UI or effects.
const PraticeBridge={active:null,original:null,timer:null,bound:false};
function sendParent(data){if(window.parent!==window)window.parent.postMessage(data,location.origin);}
function sendStudioDraft(type='studio:draft'){
 const context=PraticeBridge.active;if(!context||!Playground.instance)return;
 sendParent({type,id:context.id,language:Playground.lang,code:Playground.instance.getValue()});
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==window.parent||window.parent===window)return;
 const d=event.data;if(!d||typeof d!=='object')return;
 if(d.type==='pratice:open'){
   if(typeof d.id!=='string'||typeof d.code!=='string'||d.code.length>60000||!['python','javascript'].includes(d.language))return;
   if(!Navigation.leaveSession()){sendParent({type:'studio:error',message:'Finish the current evaluation before opening a question draft.'});return;}
   App.setMode('normal');Playground.init();
   if(!PraticeBridge.original)PraticeBridge.original={language:Playground.lang,code:Playground.instance.getValue()};
   PraticeBridge.active=null;Playground.changeLang(d.language);Playground.instance.setValue(d.code);PraticeBridge.active={id:d.id,title:d.title};Playground.save();
   if(!PraticeBridge.bound){PraticeBridge.bound=true;Playground.instance.onDidChangeModelContent(()=>{clearTimeout(PraticeBridge.timer);PraticeBridge.timer=setTimeout(()=>sendStudioDraft(),300);});}
   sendStudioDraft();
 }else if(d.type==='pratice:return'){
   if(!PraticeBridge.active)return;
   if(!['python','javascript'].includes(Playground.lang)){sendParent({type:'studio:error',message:'The question runner uses Python or JavaScript. Your other-language draft remains saved in Code Studio.'});return;}
   if(!Navigation.leaveSession()){sendParent({type:'studio:error',message:'Wait for the current evaluation to finish.'});return;}
   clearTimeout(PraticeBridge.timer);sendStudioDraft('studio:return');PraticeBridge.active=null;
   if(PraticeBridge.original){Playground.changeLang(PraticeBridge.original.language);Playground.instance.setValue(PraticeBridge.original.code);Playground.save();PraticeBridge.original=null;}
 }
});
window.addEventListener('DOMContentLoaded',()=>sendParent({type:'studio:ready'}));
