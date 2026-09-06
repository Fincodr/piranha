import {TICK} from './game.js';

const colors=Array.from({length:268},(_,id)=>id>=265?[70,230,255]:[80+(id*67)%176,80+(id*113)%176,80+(id*149)%176]);
export function idColor(id){return colors[id];}
// A copy of the actual bullet-test layer, never a reconstruction from artwork.
export function collisionLayer(world,gutter=false){
  const width=gutter?world.width:320,height=gutter?world.height:200,ids=new Uint16Array(width*height),offset=gutter?0:world.gutter;
  for(let y=0;y<height;y++)ids.set(world.layer.subarray((y+offset)*world.width+offset,(y+offset)*world.width+offset+width),y*width);
  return {width,height,originX:gutter?-world.gutter:0,originY:gutter?-world.gutter:0,ids};
}
export function colorizeLayer(world,rgba,alpha=180){
  for(let y=0;y<200;y++)for(let x=0;x<320;x++){
    const id=world.layer[(y+world.gutter)*world.width+x+world.gutter],p=(y*320+x)*4;
    if(!id){rgba[p]=rgba[p+1]=rgba[p+2]=rgba[p+3]=0;continue;}
    const color=idColor(id);rgba[p]=color[0];rgba[p+1]=color[1];rgba[p+2]=color[2];rgba[p+3]=alpha;
  }
}
export function debugObjects(game){
  const result=[],world=game.collision,a=game.actors,s=game.shots;
  const maskInfo=(key,frame)=>{
    const m=world.masks.get(key,frame),count=world.masks.groups[key].length;
    return {key,frame:((Math.floor(frame)%count)+count)%count,maskSource:world.masks.sources[key],mask:{width:m.w,height:m.h,originX:m.ox,originY:m.oy,radius:m.radius}};
  };
  for(let i=0;i<a.capacity;i++)if(a.active[i])result.push({id:i+1,generation:a.generation[i],kind:['','asteroid','enemy','pickup'][a.kind[i]],x:a.x[i],y:a.y[i],vx:a.vx[i],vy:a.vy[i],hp:a.hp[i],age:a.age[i],life:a.life[i],blocking:!!world.blocking[i+1],weapon:a.weapon[i],behavior:`0x${a.behavior[i].toString(16)}`,...maskInfo(game.actorKey(i),game.actorFrame(i))});
  for(let i=0;i<game.players.length;i++){
    const p=game.players[i];if(p.dead)continue;
    result.push({id:265+i,kind:'player',...p,copies:world.playerCopies[i],blocking:true,...maskInfo(`ship${i+1}`,p.angle/(Math.PI*2)*64)});
  }
  for(let i=0;i<s.capacity;i++)if(s.active[i])result.push({id:`shot:${i}`,generation:s.generation[i],kind:'projectile',x:s.x[i],y:s.y[i],vx:s.vx[i],vy:s.vy[i],owner:s.owner[i],source:s.source[i],damage:s.damage[i],age:s.age[i],life:s.life[i],...maskInfo(game.shotKey(i),game.shotFrame(i))});
  return result;
}
export function debugSnapshot(game){
  const c=game.campaign;
  return {state:game.state,level:game.level,tick:game.levelTicks||0,simulationSeconds:game.time||0,difficulty:game.difficulty,score:game.score,credits:game.credits,
    pools:{actors:game.actors.count,shots:game.shots.count,effects:game.effects.count},
    campaign:c?{callback:`0x${c.get(0x5070f).toString(16)}`,pending:c.pending,spawnTimer:game.spawnTimer,remainingSpawns:game.remainingSpawns,completionMask:c.get(0x5070d,1),completionHold:c.get(0x5070e,1),completionCount:game.completionCount(),pickups:game.remainingPickups,pickupTimeout:game.pickupSecondsLeft}:null,
    collision:game.collision?.debug?{tick:{...game.collision.debug.tick},hits:game.collision.debug.hits.map(hit=>({...hit}))}:null,
    objects:game.state==='title'?[]:debugObjects(game)};
}
export function stepGame(game,count=1,inputs=[]){
  if(!Number.isInteger(count)||count<1||count>70)throw Error('Step count must be 1–70');
  if(game.state!=='paused')return 0;
  let steps=0;
  for(;steps<count;steps++){
    game.state='playing';
    try{game.update(TICK,inputs);}finally{if(game.state==='playing')game.state='paused';}
    if(game.state!=='paused'){steps++;break;}
  }
  return steps;
}
