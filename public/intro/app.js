gsap.registerPlugin(MorphSVGPlugin,MotionPathPlugin);
const $=s=>document.querySelector(s), letters=[...document.querySelectorAll('.letter-line span')];
async function start(){
const response=await fetch('assets/shapes.json');if(!response.ok)throw Error('Shapes unavailable');const paths=await response.json();
await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));
const image=new Image();image.src='assets/suresh.png';await image.decode();
const audio=new ChromeScore('assets/chrome-score.wav'),sound=$('#sound');
let soundEnabled=false,firstSound=true;
function soundUI(){sound.setAttribute('aria-pressed',String(soundEnabled));sound.setAttribute('aria-label',soundEnabled?'Mute music':'Enable music'+(firstSound?' and replay animation':''));$('#sound-label').textContent=soundEnabled?'SOUND ON':'SOUND OFF';}
function syncAudio(){
    audio.sync(tl.time(),soundEnabled&&!tl.paused()&&tl.progress()<1);
}
const shape=$('#shape'),shadow=$('#shadow'),outline=$('#outline');
[shape,shadow,outline].forEach(p=>p.setAttribute('d',paths[0]));
const brush=$('#brush'),length=brush.getTotalLength();
gsap.set(brush,{strokeDasharray:length,strokeDashoffset:length});gsap.set('#final,#comet',{opacity:0});
const tl=gsap.timeline({paused:true,onUpdate:update,onComplete:()=>{audio.stop();$('#play').textContent='▶';$('#play').setAttribute('aria-label','Play animation')}});
window.animation=tl;
tl.fromTo('#letter',{opacity:0,scale:.72,transformOrigin:'50% 50%'},{opacity:1,scale:1,duration:1.2,ease:'expo.out'},0);
for(let i=1;i<6;i++){
const t=1.5+(i-1)*1.65;
tl.to([shape,shadow,outline],{morphSVG:{shape:paths[i],shapeIndex:'auto'},duration:1.1,ease:'power3.inOut'},t);
tl.to('#letter',{rotation:i%2? -3:3,transformOrigin:'50% 50%',duration:.5,ease:'sine.inOut',yoyo:true,repeat:1},t);
}
const end=10.25;
tl.to('#letter',{scale:.42,opacity:0,duration:.8,ease:'power3.in'},end-.6);
tl.to('.letter-line',{opacity:0,duration:.4},end-.2);
tl.set('#final',{opacity:1},end);
tl.to('#comet',{opacity:1,duration:.2},end);
tl.to(brush,{strokeDashoffset:0,duration:3.6,ease:'none'},end);
tl.to('#comet',{motionPath:{path:'#flight',align:'#flight',alignOrigin:[.5,.5]},duration:3.6,ease:'none'},end);
tl.to('#comet',{opacity:0,duration:.4},end+3.3);
tl.fromTo('#final',{scale:.94,transformOrigin:'50% 50%'},{scale:1,duration:4.5,ease:'power2.out'},end);
tl.to('.final-title',{opacity:1,duration:1},end+3.3);
// A full-white mask guarantees that every corner of the original artwork is visible.
tl.to(brush,{strokeWidth:1800,duration:.8,ease:'power2.out'},end+3.1);
const stars=$('#stars');[[330,270],[1000,230],[1270,540],[700,630]].forEach(([x,y],i)=>{const star=document.createElementNS('http://www.w3.org/2000/svg','path');star.setAttribute('d',`M${x-20} ${y}Q${x} ${y} ${x} ${y-25}Q${x} ${y} ${x+20} ${y}Q${x} ${y} ${x} ${y+25}Q${x} ${y} ${x-20} ${y}`);stars.append(star);gsap.set(star,{opacity:0,transformOrigin:'50% 50%'});tl.to(star,{opacity:.9,scale:1.4,duration:.35,yoyo:true,repeat:1},end+3.2+i*.24)});
tl.to({}, {duration:1.2});
function update(){const t=tl.time(),progress=tl.progress()*100;$('#seek').value=String(progress*10);$('#seek').style.setProperty('--progress',progress+'%');$('#time').textContent=t.toFixed(1).padStart(4,'0');$('#duration').textContent=tl.duration().toFixed(1);const index=Math.min(5,Math.max(0,Math.floor((t-1.5)/1.65)+1));letters.forEach((el,i)=>el.classList.toggle('active',i===index));$('#phase').textContent=t>=end?'02 — THE REVEAL':'01 — THE MORPH';syncAudio();}
$('#play').onclick=()=>{if(tl.progress()===1)tl.restart();else tl.paused(!tl.paused());syncButton()};
$('#replay').onclick=()=>{tl.restart();syncButton()};
$('#seek').oninput=e=>{tl.pause().progress(Number(e.target.value)/1000);syncButton()};
function syncButton(){$('#play').textContent=tl.paused()?'▶':'Ⅱ';$('#play').setAttribute('aria-label',tl.paused()?'Play animation':'Pause animation');syncAudio()}
sound.disabled=false;
sound.onclick=async()=>{
    if(soundEnabled){soundEnabled=false;audio.mute();soundUI();return;}
    sound.disabled=true;sound.setAttribute('aria-busy','true');$('#sound-label').textContent='LOADING';
    try{await audio.enable();soundEnabled=true;if(firstSound||tl.progress()===1){firstSound=false;tl.restart();syncButton()}soundUI();syncAudio()}
    catch(error){console.error(error);soundEnabled=false;audio.mute();soundUI();$('#sound-label').textContent='RETRY SOUND'}
    finally{sound.disabled=false;sound.removeAttribute('aria-busy')}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden){tl.pause();syncButton()}});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target===document.body){e.preventDefault();$('#play').click()}});
if(matchMedia('(prefers-reduced-motion: reduce)').matches){tl.progress(1).pause();syncButton()}else tl.play();update();
}
start().catch(e=>{console.error(e);$('#error').hidden=false});
