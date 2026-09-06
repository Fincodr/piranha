import {ShopUI} from './shop-ui.js';
import {Game,TICK,LEVELS} from './game.js';
import {Renderer,loadImage} from './renderer.js';
import {AudioSystem} from './audio.js';
import {CollisionMasks,CollisionWorld} from './collision.js';
import {SlowMotion} from './slow-motion.js';
import {bindTouchControls} from './touch-controls.js';
import {FullscreenView} from './fullscreen.js';
import {DebugUI} from './debug-ui.js';
const slowMotion=new SlowMotion();
const $=id=>document.getElementById(id),canvas=$('game'),audio=new AudioSystem(),keys=new Set(),touch={};
const touchControls=bindTouchControls(document.querySelectorAll('[data-control]'),touch);
function clearInput(){keys.clear();touchControls.reset();}
const fullscreenView=new FullscreenView(window,document,$('cabinet'),$('fullscreen'),clearInput);
let renderer,backgrounds,shopUI,debugView,ready=false,launching=false,accumulator=0,last=0,hudAt=0,fps=60,noticeUntil=0,best=0;
try{best=Number(localStorage.getItem('piranha.best'))||0;}catch{}
$('best').textContent=String(best).padStart(6,'0');
for(const {level} of LEVELS){const option=document.createElement('option');option.value=level;option.textContent=`Level ${String(level).padStart(2,'0')}`;$('start-level').append(option);}
const game=new Game((event,value)=>{
  debugView?.record(event,value);
  if(event==='level'){
    slowMotion.reset();
    renderer.setBackground(backgrounds[game.config.background]);$('overlay').hidden=true;$('pause').disabled=false;$('launch').innerHTML='Restart flight <span>↗</span>';
    $('notice').textContent=`LEVEL ${String(value).padStart(2,'0')}`;noticeUntil=performance.now()+2500;
    audio.playMusic(audio.manifest.campaignMusic[value-1]);
  }
  if(event==='shot')audio.effect(0,15000);
  if(event==='explosion')audio.effect(3,25000);
  if(event==='hit')audio.effect(1,22000);
  if(event==='pickup'){$('notice').textContent=value.toUpperCase();noticeUntil=performance.now()+1800;audio.effect(1,22000);}
  if(event==='pause'){audio.pause();showOverlay('FLIGHT SUSPENDED','Paused','Take a breath. The stars can wait.','Resume flight');}
  if(event==='resume'){$('overlay').hidden=true;audio.resume();}
  if(event==='continue'){
    $('overlay').hidden=true;audio.resume();
    $('notice').textContent='COIN ACCEPTED · GOOD LUCK, PILOT!';noticeUntil=performance.now()+2500;
  }
  if(event==='cleared')showOverlay('SECTOR CLEAR',`Level ${game.level} complete`,game.level===LEVELS.length?'You have completed the first 20 converted levels. The remaining campaign is still being recovered.':'Spend your collected credits on repairs and upgrades, then launch the next sector.',game.level===LEVELS.length?'Finish flight':'Shop & next level');
  if(event==='shop'){clearInput();accumulator=0;audio.pause();$('overlay').hidden=true;shopUI.show();}
  if(event==='purchase')audio.effect(1,22000);
  if(event==='gameover'){
    audio.pause();saveBest();showOverlay('INSERT COIN TO CONTINUE','Game over',`Score: ${game.score.toLocaleString()}. Insert a coin for 3 more ships${game.players.length>1?' per pilot':''} and continue where you left off. Press 5 or use the button below.`,'Insert coin · 5');
  }
  if(event==='complete'){
    audio.pause();saveBest();showOverlay('FLIGHT COMPLETE','Good flying.',`Final score: ${game.score.toLocaleString()}. Personal best: ${best.toLocaleString()}.`,'Fly again');
  }
  updateHud();
});
function saveBest(){best=Math.max(best,game.score);try{localStorage.setItem('piranha.best',String(best));}catch{}$('best').textContent=String(best).padStart(6,'0');}
function showOverlay(label,title,copy,button){$('overlay-label').textContent=label;$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('overlay-action').textContent=button;$('overlay').hidden=false;$('overlay-action').focus();}
function updateHud(){
  fullscreenView.setActive(ready&&game.state!=='title');
  touchControls.setEnabled(game.state==='playing');
  const intro=ready&&game.state==='title';$('intro-start').hidden=!intro;$('screen').classList.toggle('title-ready',intro);
  $('level').textContent=String(game.level).padStart(2,'0');$('score').textContent=String(game.score).padStart(6,'0');$('credits').textContent=String(game.credits).padStart(4,'0');
  const p=game.players.find(p=>!p.dead)||game.players[0];let hp=game.state==='title'?100:p&&!p.dead?Math.max(0,Math.min(100,Math.round(p.hp/game.maxHealth*100))):0;
  $('hull-value').textContent=`${hp}%`;$('hull-bar').style.width=`${hp}%`;$('hull-bar').style.background=hp<35?'#d77667':'#97b391';$('lives').textContent=String(p?p.lives:3);
  $('pause').disabled=!['playing','paused'].includes(game.state);
  $('salvage').hidden=!game.waitingForPickups;if(game.waitingForPickups)$('salvage').textContent=`Collect ${game.remainingPickups} pickup${game.remainingPickups===1?'':'s'} · ${game.pickupSecondsLeft}s until timeout`;
  $('pause').innerHTML=game.state==='paused'?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>';
}
async function launch(){
  if(!ready||launching)return;
  launching=true;const count=Number($('players').value),difficulty=$('difficulty').value,level=Number($('start-level').value);
  try{
    saveBest();clearInput();
    await audio.unlock().catch(e=>console.warn(e));
    game.start(count,level,difficulty);canvas.focus();accumulator=0;
  }finally{launching=false;}
}
function startFromIntro(){if(game.state==='title')launch();}
canvas.addEventListener('click',startFromIntro);
$('intro-start').addEventListener('click',startFromIntro);
function insertCoin(){
  if(game.state!=='gameover')return;
  clearInput();
  accumulator=0;game.insertCoin();canvas.focus();
}
$('launch').addEventListener('click',launch);
$('overlay-action').addEventListener('click',()=>{if(game.state==='gameover')insertCoin();else if(game.state==='paused'){game.pause();canvas.focus();}else if(game.state==='cleared'){if(game.level<LEVELS.length)game.shop.open();else{game.next();canvas.focus();}}else launch();});
$('return-title').addEventListener('click',()=>{saveBest();game.state='title';fullscreenView.exit();audio.pause();clearInput();$('overlay').hidden=true;$('pause').disabled=true;$('launch').innerHTML='Launch game <span>↗</span>';renderer.setBackground(backgrounds.title);renderer.begin();renderer.end();$('notice').textContent='';noticeUntil=0;updateHud();canvas.focus();});
$('pause').addEventListener('click',()=>{game.pause();canvas.focus();});
function mute(){let enabled=audio.mute();$('mute').innerHTML=enabled?'♪ <span>Sound on</span>':'♩ <span>Sound off</span>';if(enabled&&game.state==='playing')audio.resume();}
$('mute').addEventListener('click',mute);
function fullscreen(){return fullscreenView.toggle();}
$('fullscreen').addEventListener('click',fullscreen);
$('crt').addEventListener('change',e=>$('scanlines').classList.toggle('enabled',e.target.checked));
$('players').addEventListener('change',()=>$('coop-controls').hidden=Number($('players').value)===1);
const controls=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyA','KeyD','KeyW','KeyS','KeyE','ShiftLeft','ShiftRight','KeyJ','KeyL','KeyI','KeyK','KeyU'];
window.addEventListener('keydown',e=>{
 if($('audio-dialog').open||$('shop-dialog').open)return;
 if(e.code==='F2'){e.preventDefault();if(!e.repeat)debugView?.toggle();return;}
 if(e.code==='F3'&&debugView?.enabled){e.preventDefault();if(!e.repeat)debugView.step();return;}
 if(e.target.closest?.('#debug-panel')||['INPUT','SELECT'].includes(document.activeElement.tagName))return;
 if(e.code==='Escape'&&fullscreenView.source){e.preventDefault();fullscreenView.exit();return;}
 if(game.state==='title'){
   // Preserve form/button navigation and browser shortcuts on the intro.
   if(e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||
      ['Tab','Shift','Control','Alt','Meta','CapsLock','Escape'].includes(e.key)||
      e.target.closest?.('button,a,input,select,textarea,[contenteditable]'))return;
   e.preventDefault();startFromIntro();return;
 }
 if(controls.includes(e.code)){e.preventDefault();keys.add(e.code);}
 if(e.repeat)return;
 if((e.code==='Digit5'||e.code==='Numpad5')&&game.state==='gameover'){e.preventDefault();insertCoin();}
 if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();game.pause();}
 if(e.code==='KeyM')mute();if(e.code==='KeyF')fullscreen();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
function loseFocus(){clearInput();if(game.state==='playing')game.pause();}
window.addEventListener('blur',loseFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden){loseFocus();last=0;accumulator=0;}});
for(const type of ['selectstart','contextmenu','dragstart'])$('cabinet').addEventListener(type,e=>e.preventDefault());
function inputs(){return [
 {left:keys.has('ArrowLeft')||touch.left,right:keys.has('ArrowRight')||touch.right,thrust:keys.has('ArrowUp')||touch.thrust,brake:keys.has('ArrowDown')||touch.brake,fire:keys.has('Space')||touch.fire},
 {left:keys.has('KeyA'),right:keys.has('KeyD'),thrust:keys.has('KeyW'),brake:keys.has('KeyS'),fire:keys.has('KeyE')},
 {left:keys.has('KeyJ'),right:keys.has('KeyL'),thrust:keys.has('KeyI'),brake:keys.has('KeyK'),fire:keys.has('KeyU')}
];}
function frame(now){
 if(last){
   const dt=Math.min((now-last)/1000,.1);fps=fps*.95+(1/Math.max(dt,.001))*.05;
   if(game.state==='playing'){
     accumulator+=slowMotion.advance(dt,keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.slow)*(debugView?.enabled?debugView.speed:1);
     const input=inputs();
     const started=debugView?.enabled?performance.now():0;
     while(accumulator>=TICK&&game.state==='playing'){game.update(TICK,input);accumulator-=TICK;}
     if(debugView?.enabled)debugView.updateMs=performance.now()-started;
   }else{accumulator=0;slowMotion.reset();}
 }
 last=now;
 const [shakeX,shakeY]=game.state==='playing'||game.state==='paused'?game.cameraOffset:[0,0];
 canvas.style.transform=shakeX||shakeY?`translate(${shakeX/320*100}%,${shakeY/200*100}%)`:'';
 if(game.state!=='title')game.render(renderer,accumulator);else{renderer.begin();renderer.end();}
 debugView?.render(now,canvas.style.transform);
 if(noticeUntil&&now>noticeUntil){$('notice').textContent='';noticeUntil=0;}
 if(now-hudAt>250){updateHud();hudAt=now;$('runtime').innerHTML=`<i class="status-dot"></i> ${renderer.name} · ${Math.round(fps)} FPS · ${renderer.drawCalls} draws`;}
 requestAnimationFrame(frame);
}
function buildArchive(manifest){
 $('music-list').textContent='';$('sfx-list').textContent='';
 for(const track of manifest.music){
   const row=document.createElement('div');row.className='track';
   const num=document.createElement('span');num.className='num';num.textContent=String(track.number).padStart(2,'0');row.append(num);
   const label=document.createElement('div'),title=document.createElement('strong');title.textContent=track.title;label.append(title);
   const small=document.createElement('small');small.textContent=`${Math.floor(track.seconds/60)}:${String(Math.floor(track.seconds%60)).padStart(2,'0')} · `;label.append(small);
   for(const ext of ['ogg','mp3']){const a=document.createElement('a');a.href=`assets/audio/${track[ext]}`;a.download='';a.textContent=ext.toUpperCase();label.append(a);}
   const credits=document.createElement('a');credits.href=`assets/audio/music/music${String(track.number).padStart(2,'0')}.txt`;credits.target='_blank';credits.textContent='CREDITS';label.append(credits);row.append(label);
   const player=document.createElement('audio');player.controls=true;player.preload='none';
   for(const ext of ['ogg','mp3']){const src=document.createElement('source');src.src=`assets/audio/${track[ext]}`;src.type=ext==='ogg'?'audio/ogg':'audio/mpeg';player.append(src);}row.append(player);$('music-list').append(row);
 }
 for(const sfx of manifest.sfx){
   const row=document.createElement('div');row.className='track';row.innerHTML=`<span class="num">${sfx.slot}</span><div><strong>${sfx.name}</strong><small>${sfx.rate.toLocaleString()} Hz · ${sfx.seconds.toFixed(2)} s</small><br><a href="assets/audio/${sfx.wav}" download>WAV</a><a href="assets/audio/${sfx.raw}" download>RAW PCM</a></div><audio controls preload="none" src="assets/audio/${sfx.wav}"></audio>`;$('sfx-list').append(row);
 }
 for(const player of document.querySelectorAll('dialog audio'))player.addEventListener('play',()=>{for(const other of document.querySelectorAll('dialog audio'))if(other!==player)other.pause();});
}
$('audio-open').addEventListener('click',()=>{if(game.state==='playing')game.pause();audio.archiveOpen=true;audio.pause();$('audio-dialog').showModal();});
$('audio-close').addEventListener('click',()=>$('audio-dialog').close());
$('audio-dialog').addEventListener('close',()=>{for(const player of document.querySelectorAll('dialog audio'))player.pause();audio.archiveOpen=false;/* Resume explicitly so closing a dialog never restarts a battle unexpectedly. */});
$('volume').addEventListener('input',e=>audio.setVolume(Number(e.target.value)));
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();loseFocus();$('notice').textContent='Graphics context lost. Reload to restore the renderer.';noticeUntil=0;});
try{
 const [atlas,data,bg,title,manifest,maskBytes]=await Promise.all([loadImage('assets/atlas.png?v=effects2'),fetch('assets/atlas.json?v=effects2').then(r=>r.json()),loadImage('assets/background1.png'),loadImage('assets/title-normal.png'),audio.init(),fetch('assets/collision.bin?v=effects2').then(r=>{if(!r.ok)throw Error('Could not load collision masks');return r.arrayBuffer();})]);
 game.collision=new CollisionWorld(new CollisionMasks(data,new Uint8Array(maskBytes)));
 renderer=new Renderer(canvas,atlas,data);shopUI=new ShopUI(game,atlas,data,()=>{clearInput();accumulator=0;if(game.state==='playing')canvas.focus();});backgrounds={1:bg,title};
 debugView=new DebugUI(game,renderer,{resetClock:()=>{clearInput();accumulator=0;},refresh:updateHud});
 for(const n of new Set(LEVELS.map(level=>level.background)))if(n!==1)backgrounds[n]=await loadImage(`assets/background${n}.png`);
 renderer.setBackground(title);renderer.begin();renderer.end();buildArchive(manifest);ready=true;updateHud();
 $('launch').disabled=false;$('launch').innerHTML='Launch game <span>↗</span>';$('runtime').textContent=`${renderer.name} · Original assets loaded`;requestAnimationFrame(frame);
 // Snapshot/layer APIs return copies; explicit debug controls change time only.
 window.piranha={debug:{enable:(value=true)=>debugView.enable(value),snapshot:()=>debugView.snapshot(),layer:(gutter=false)=>debugView.layer(gutter),inspect:(x,y)=>debugView.inspect(x,y),step:(count=1)=>debugView.step(count)},get state(){return game.state;},get metrics(){return {renderer:renderer.name,drawCalls:renderer.drawCalls,actors:game.actors.count,shots:game.shots.count,effects:game.effects.count,level:game.level,score:game.score,difficulty:game.difficulty,maxHealth:game.maxHealth,players:game.players.map(p=>({x:p.x,y:p.y,hp:p.hp,lives:p.lives}))};}};
}catch(error){console.error(error);$('runtime').textContent='Could not load game assets';$('notice').textContent=error.message;$('launch').textContent='Reload to retry';}
