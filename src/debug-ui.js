import {place} from './collision.js';
import {colorizeLayer,collisionLayer,debugSnapshot,stepGame,idColor} from './debug-data.js';

export class DebugUI {
  constructor(game,renderer,{resetClock,refresh}){
    Object.assign(this,{game,renderer,resetClock,refresh});
    this.enabled=false;this.speed=1;this.updateMs=0;this.events=[];this.lastHud=0;
    this.cabinet=document.getElementById('cabinet');this.button=document.getElementById('debug-toggle');
    this.canvas=document.createElement('canvas');this.canvas.width=320;this.canvas.height=200;this.canvas.className='debug-canvas';this.canvas.hidden=true;this.canvas.setAttribute('aria-hidden','true');
    document.getElementById('game').after(this.canvas);this.ctx=this.canvas.getContext('2d');this.pixels=this.ctx.createImageData(320,200);
    this.panel=document.createElement('section');this.panel.id='debug-panel';this.panel.hidden=true;this.panel.setAttribute('aria-label','Game debugging');
    this.panel.innerHTML=`<div class="debug-head"><strong>DEBUG · F2</strong><button data-action="hide" aria-label="Hide debug panel">−</button><button data-action="off" aria-label="Disable debugging">×</button></div>
      <div class="debug-options"><label><input type="checkbox" data-option="layer" checked> Bullet ID layer</label><label><input type="checkbox" data-option="solo"> Layer only</label><label><input type="checkbox" data-option="circles"> Conservative circles</label><label><input type="checkbox" data-option="origins"> Origins & IDs</label><label><input type="checkbox" data-option="masks"> Pickup / bullet masks</label><label><input type="checkbox" data-option="hits"> Last 32 bullet hits</label></div>
      <label class="debug-range">Layer opacity <input type="range" data-option="opacity" min="0" max="1" step=".1" value=".6"></label>
      <div class="debug-actions"><button data-action="pause">Pause</button><button data-action="step">Step · F3</button><label>Speed <select data-option="speed" aria-label="Debug simulation speed"><option value="1">1×</option><option value="0.5">½×</option><option value="0.25">¼×</option><option value="0.1">⅒×</option></select></label></div>
      <p>Colors identify actors; cyan = players. Pickups do not block bullets. Tap the playfield to inspect its topmost collision ID. Masks use stepped frames; smooth asteroid rotation is visual only.</p>
      <pre data-readout="stats"></pre><label>Inspect object <select data-readout="objects" aria-label="Inspect debug object"><option value="">Choose object…</option></select></label><pre data-readout="object">No object selected.</pre>
      <div class="debug-actions"><button data-action="json">Save state JSON</button><button data-action="png">Save layer PNG</button></div><pre data-readout="events"></pre>`;
    this.cabinet.append(this.panel);
    this.options=Object.fromEntries([...this.panel.querySelectorAll('[data-option]')].map(el=>[el.dataset.option,el]));
    this.readouts=Object.fromEntries([...this.panel.querySelectorAll('[data-readout]')].map(el=>[el.dataset.readout,el]));
    this.actions=Object.fromEntries([...this.panel.querySelectorAll('[data-action]')].map(el=>[el.dataset.action,el]));
    this.button.disabled=false;this.button.addEventListener('click',()=>{if(this.enabled&&this.panel.hidden)this.panel.hidden=false;else this.toggle();});
    this.actions.off.onclick=()=>this.enable(false);this.actions.hide.onclick=()=>{this.panel.hidden=true;document.getElementById('game').focus({preventScroll:true});};
    this.actions.pause.onclick=()=>{this.resetClock();game.pause();this.renderHud();};
    this.actions.step.onclick=()=>this.step();
    this.options.speed.onchange=()=>{this.speed=Number(this.options.speed.value);this.resetClock();};
    this.readouts.objects.onchange=()=>this.renderHud();
    this.actions.json.onclick=()=>this.download(new Blob([JSON.stringify(this.snapshot(),null,2)],{type:'application/json'}),'state.json');
    this.actions.png.onclick=()=>this.saveLayer();
    document.getElementById('game').addEventListener('click',e=>{
      if(!this.enabled||game.state==='title')return;
      const rect=e.currentTarget.getBoundingClientRect();this.inspect((e.clientX-rect.left)*320/rect.width,(e.clientY-rect.top)*200/rect.height);
    });
  }
  enable(value=true){
    this.enabled=!!value;this.canvas.hidden=!this.enabled;this.panel.hidden=!this.enabled;
    this.cabinet.classList.toggle('debugging',this.enabled);this.button.setAttribute('aria-pressed',String(this.enabled));
    this.game.collision.setDebug(this.enabled);this.events=[];this.speed=1;this.options.speed.value='1';this.resetClock();this.renderHud();
    if(!this.enabled)this.cabinet.classList.remove('debug-paused');
  }
  toggle(){this.enable(!this.enabled);}
  record(event,value){
    if(!this.enabled)return;
    if(event==='level'){this.game.collision.debug.hits.length=0;this.events=[];}
    this.events.push({tick:this.game.levelTicks||0,event,value});if(this.events.length>12)this.events.shift();
  }
  step(count=1){
    if(!this.enabled)return 0;
    this.resetClock();if(this.game.state==='playing')this.game.pause();
    const n=stepGame(this.game,count);this.refresh();this.renderHud();return n;
  }
  snapshot(){return {...debugSnapshot(this.game),debug:{enabled:this.enabled,speed:this.speed,frameUpdateMs:this.updateMs,renderer:this.renderer.name,drawCalls:this.renderer.drawCalls,events:this.events.map(e=>({...e}))}};}
  layer(gutter=false){return collisionLayer(this.game.collision,gutter);}
  inspect(x,y){
    if(!this.enabled||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>=320||y<0||y>=200)return null;
    const w=this.game.collision,id=w.layer[(Math.floor(y)+w.gutter)*w.width+Math.floor(x)+w.gutter];
    this.panel.hidden=false;this.renderHud();this.readouts.objects.value=id?String(id):'';this.renderHud();
    return this.snapshot().objects.find(o=>o.id===id)||null;
  }
  download(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`piranha-level${this.game.level}-tick${this.game.levelTicks||0}-${name}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  saveLayer(){
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=200;
    const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(320,200);colorizeLayer(this.game.collision,pixels.data,255);ctx.putImageData(pixels,0,0);
    canvas.toBlob(blob=>{if(blob)this.download(blob,'collision.png');});
  }
  renderHud(){
    if(!this.enabled)return;
    const s=this.snapshot(),c=s.campaign,t=s.collision?.tick||{};
    this.cabinet.classList.toggle('debug-paused',s.state==='paused');
    this.actions.pause.textContent=s.state==='paused'?'Resume':'Pause';this.actions.pause.disabled=!['playing','paused'].includes(s.state);this.actions.step.disabled=this.actions.pause.disabled;
    this.readouts.stats.textContent=`${s.state} · level ${s.level} · tick ${s.tick}\n${s.simulationSeconds.toFixed(3)} simulation seconds · update ${this.updateMs.toFixed(2)} ms/frame\nPools: ${s.pools.actors}/264 actors · ${s.pools.shots}/512 bullets · ${s.pools.effects}/1024 FX\n${c?`Callback ${c.callback} · pending ${c.pending}\nWave timer ${c.spawnTimer} · remaining spawns ${c.remainingSpawns}\nCompletion mask ${c.completionMask} · hold ${c.completionHold} · targets ${c.completionCount}\nPickups ${c.pickups} · timeout ${c.pickupTimeout}s`:'No campaign running'}\nLast physics tick: ${t.shotQueries||0} shot samples · ${t.circleTests||0} circle tests\n${t.layerPixels||0} layer pixels tested · ${t.projectileHits||0} bullet hits\n${t.contactChecks||0} contact checks · ${t.contactHits||0} overlaps`;
    const list=this.readouts.objects,signature=s.objects.map(o=>`${o.id}:${o.generation||0}`).join(',');
    if(signature!==this.objectSignature){
      const selected=list.value;list.replaceChildren(new Option('Choose object…',''));
      for(const o of s.objects)list.add(new Option(`${o.id} · ${o.kind} · ${o.key}`,String(o.id)));
      list.value=selected;this.objectSignature=signature;
    }
    const object=s.objects.find(o=>String(o.id)===list.value);
    this.readouts.object.textContent=object?JSON.stringify(object,null,2):'No object selected (or it has despawned).';
    this.readouts.events.textContent=this.events.slice(-6).map(e=>`${e.tick} · ${e.event}${e.value!==undefined?' · '+e.value:''}`).join('\n');
  }
  render(now,transform=''){
    if(!this.enabled)return;
    const ctx=this.ctx,w=this.game.collision,opts=this.options;
    this.canvas.style.transform=transform;ctx.clearRect(0,0,320,200);
    if(this.game.state==='title'){if(now-this.lastHud>250){this.renderHud();this.lastHud=now;}return;}
    if(opts.solo.checked){ctx.fillStyle='#000';ctx.fillRect(0,0,320,200);}
    if(opts.layer.checked){
      colorizeLayer(w,this.pixels.data,opts.solo.checked?255:Math.round(Number(opts.opacity.value)*255));
      // putImageData replaces pixels, so use opaque empty pixels in layer-only mode.
      if(opts.solo.checked)for(let n=3;n<this.pixels.data.length;n+=4)this.pixels.data[n]=255;
      ctx.putImageData(this.pixels,0,0);
    }
    const drawBody=(b,label,color,mask=false)=>{
      if(!b.mask)return;
      ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=.5;
      if(mask){ctx.globalAlpha=.55;const spans=b.mask.spans;for(let n=0;n<spans.length;n+=3)ctx.fillRect(b.left+spans[n+1],b.top+spans[n],spans[n+2]-spans[n+1],1);ctx.globalAlpha=1;}
      if(opts.circles.checked){ctx.beginPath();ctx.arc(b.x,b.y,b.mask.radius,0,Math.PI*2);ctx.stroke();}
      if(opts.origins.checked){ctx.beginPath();ctx.moveTo(b.x-2,b.y);ctx.lineTo(b.x+2,b.y);ctx.moveTo(b.x,b.y-2);ctx.lineTo(b.x,b.y+2);ctx.stroke();ctx.font='6px monospace';ctx.fillText(label,b.x+3,b.y-3);}
    };
    if(opts.circles.checked||opts.origins.checked||opts.masks.checked){
      for(let id=1;id<w.bodies.length;id++){
        const b=w.bodies[id];if(!b.mask)continue;
        if(id>=265){for(let n=0;n<w.playerCopies[id-265];n++)drawBody(w.playerBodies[id-265][n],String(id),'#46e6ff');}
        else drawBody(b,String(id),w.blocking[id]?`rgb(${idColor(id).join(',')})`:'#ff80d5',opts.masks.checked&&!w.blocking[id]);
      }
      const s=this.game.shots,body={};
      for(let i=0;i<s.capacity;i++)if(s.active[i])drawBody(place(body,w.masks.get(this.game.shotKey(i),this.game.shotFrame(i)),s.x[i],s.y[i]),`s${i}`,'#ffff55',opts.masks.checked);
    }
    if(opts.hits.checked){ctx.strokeStyle='#ff5555';ctx.lineWidth=.75;for(const h of w.debug.hits){ctx.strokeRect(h.x-1.5,h.y-1.5,3,3);}}
    if(now-this.lastHud>250){this.renderHud();this.lastHud=now;}
  }
}
