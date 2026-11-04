import Phaser from 'phaser';
import {newMission,moveStage,validate,finish,type Mission} from './mission';
import './style.css';
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><span class="brand">❯_ SHIFT LEFT</span><span>MISSION 01 / APPRENTICE</span></header><main><section class="brief"><div class="patch">▣ <strong>PATCH</strong></div><h1>Hello, Pipeline!</h1><p>SHIP wants a release, but our delivery stages are scrambled. Arrange them in the order software travels from code to users.</p><p class="hint">Select a stage, then use ← or → to move it. You can also use the buttons below each card.</p></section><div id="game" aria-label="Animated pipeline display"></div><section><h2>PIPELINE CONTROL ROOM</h2><div id="stages" class="stages"></div><div class="actions"><button id="validate">Run pipeline</button><button id="reset" class="secondary">Reset</button><button id="help" class="secondary">Ask DOC</button></div><p id="feedback" role="status" aria-live="polite"></p><p id="summary" hidden><strong>What you learned:</strong> Source changes are built, tested, checked in staging, then deployed to production. Automated checks reduce risk, but a green pipeline alone does not guarantee secure software.</p></section></main>`;
let state:Mission=newMission();let selected=0;
const labels:Record<string,string>={SOURCE:'Where developers commit code',BUILD:'Turn source into a runnable artifact',TEST:'Check expected behavior automatically',STAGE:'Validate in a production-like environment',PROD:'Deliver the application to users'};
class PipelineScene extends Phaser.Scene {
  constructor(){super('Pipeline')}
  create(){this.cameras.main.setBackgroundColor('#091a30');this.add.text(22,22,'DEPLOYMENT MONITOR',{fontFamily:'monospace',fontSize:'18px',color:'#50e6c2'});
    this.add.text(22,65,'SOURCE  →  BUILD  →  TEST  →  STAGE  →  PROD',{fontFamily:'monospace',fontSize:'17px',color:'#dbe9ff'});
    this.add.text(22,120,'PATCH: “Let’s ship something that actually works.”',{fontFamily:'monospace',fontSize:'14px',color:'#a4b7d2'});
    const dots=[0,1,2,3,4].map(i=>this.add.circle(55+i*135,195,12,0x283c59));
    this.events.on('update',()=>dots.forEach((d,i)=>d.setFillStyle(state.completed?0x35e0aa:state.running?0x21b8ed:i===selected?0x21b8ed:0x283c59)));
  }
}
new Phaser.Game({type:Phaser.AUTO,width:720,height:250,parent:'game',scene:[PipelineScene],scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_HORIZONTALLY}});
function render(){const container=document.querySelector<HTMLDivElement>('#stages')!;container.innerHTML='';
state.order.forEach((stage,i)=>{const card=document.createElement('div');card.className='stage'+(selected===i?' selected':'');card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label',stage+' stage');
  const name=document.createElement('strong');name.textContent=stage;const desc=document.createElement('small');desc.textContent=labels[stage];const controls=document.createElement('div');controls.className='move';
  for(const [label,to] of [['←',i-1],['→',i+1]] as const){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label','Move '+stage+(label==='←'?' left':' right'));b.disabled=to<0||to>=5||state.completed||state.running;b.onclick=()=>{state=moveStage(state,i,to);selected=to;render()};controls.append(b)}
  card.onclick=(e)=>{if(e.target===card||e.target===name||e.target===desc){selected=i;render()}};card.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const to=i+(e.key==='ArrowLeft'?-1:1);state=moveStage(state,i,to);selected=Math.max(0,Math.min(4,to));render();container.children[selected]?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()}};card.append(name,desc,controls);container.append(card)});
  document.querySelector<HTMLParagraphElement>('#feedback')!.textContent=state.feedback;
  document.querySelector<HTMLButtonElement>('#validate')!.disabled=state.completed||state.running;
  document.querySelector<HTMLParagraphElement>('#summary')!.hidden=!state.completed;
}
document.querySelector<HTMLButtonElement>('#validate')!.onclick=()=>{state=validate(state);render();if(state.running)setTimeout(()=>{state=finish(state);render()},1100)};
document.querySelector<HTMLButtonElement>('#reset')!.onclick=()=>{state=newMission();selected=0;render()};
document.querySelector<HTMLButtonElement>('#help')!.onclick=()=>{state={...state,feedback:'DOC: Start with SOURCE. BUILD creates an artifact; TEST checks it; STAGE is rehearsal; PROD is the live show.'};render()};
render();
