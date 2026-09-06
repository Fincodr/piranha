import test from 'node:test';
import assert from 'node:assert/strict';
import {Kind,TICK,LEVELS} from '../src/game.js';
import {Game} from './helpers.mjs';
import {FIELD} from '../src/campaign.js';

function tick(g){g.players.forEach(p=>p.invincible=100);g.update(TICK);}
function enemies(g){return Array.from(g.actors.active.keys()).filter(i=>g.actors.active[i]&&g.actors.kind[i]===Kind.ENEMY);}

test('all twenty recovered scripts progress to completion after their targets are defeated',()=>{
 assert.equal(LEVELS.length,20);
 for(const {level} of LEVELS){
  const g=new Game();g.start(1,level);
  for(let n=0;n<12000&&g.state==='playing';n++){
   tick(g);
   if(n%3===0)for(let i=0;i<g.actors.capacity;i++){
    if(g.actors.active[i]&&g.actors.kind[i]!==Kind.COIN&&g.actors.hp[i]<999999){g.destroy(i);break;}
   }
  }
  assert.equal(g.state,'cleared',`level ${level} must clear without defeating protected stage components`);
 }
});

for(const [level,weapon] of [[2,0],[3,0],[6,1],[12,1],[14,3],[17,6]]){
 test(`level ${level} enemies use recovered weapon ${weapon}`,()=>{
  const g=new Game();g.start(1,level);
  for(let n=0;n<1000&&!enemies(g).length;n++)tick(g);
  const ids=enemies(g);assert.ok(ids.length);
  for(const i of ids)assert.equal(g.actors.weapon[i],weapon);
  g.shots.clear();
  const i=ids[0];g.actors.x[i]=100;g.actors.y[i]=100;g.actors.cooldown[i]=0;
  g.updateEnemy(i,TICK);
  assert.equal(g.shots.count,weapon===0?0:1);
  if(weapon){const shot=g.shots.active.findIndex(Boolean);assert.equal(g.shots.shotType[shot],weapon);}
 });
}

test('level 4 medium mines release four smaller mines and advance the kill-triggered wave',()=>{
 const g=new Game();g.start(1,4);
 for(let n=0;n<1000&&!enemies(g).length;n++)tick(g);
 const mine=enemies(g).find(i=>g.actors.part[i]===2);assert.notEqual(mine,undefined);
 const before=g.campaign.get(0x50705,1);g.destroy(mine);
 const small=enemies(g).filter(i=>g.actors.part[i]===1);assert.equal(small.length,4);
 for(const i of small)g.destroy(i);
 assert.equal(g.campaign.get(0x50705,1),before+5);
 assert.equal(g.campaign.pending,true);tick(g);
 assert.equal(g.state,'playing');
});

test('level 19 keeps its staged boss protected until activation and retires its companion on defeat',()=>{
 const g=new Game();g.start(1,19);assert.equal(enemies(g).length,32);
 let boss;
 for(let n=0;n<2500;n++){
  tick(g);boss=enemies(g).find(i=>g.actors.scriptType[i]===5&&g.actors.part[i]===1);
  if(boss!==undefined&&g.actors.hp[boss]===4500)break;
  assert.equal(g.state,'playing');
  if(boss!==undefined)assert.ok(g.actors.hp[boss]>999999);
 }
 assert.notEqual(boss,undefined);assert.equal(g.actors.hp[boss],4500);assert.equal(g.actors.weapon[boss],6);
 g.destroy(boss);
 for(let n=0;n<80;n++)tick(g);
 assert.equal(enemies(g).length,0);assert.equal(g.waitingForPickups,true);
 for(let n=0;n<26/TICK&&g.state==='playing';n++)tick(g);
 assert.equal(g.state,'cleared');
});

test('projectile rendering selects the source animation for each recovered weapon',()=>{
 const g=new Game();g.start();g.actors.clear();g.players=[];
 for(const type of [1,3,6])g.shoot(10,20,0,-1,0,0,15,type);
 const rendered=[];g.render({data:{groups:{}},begin(){},end(){},rect(){},sprite(key){rendered.push(key);}});
 assert.deepEqual(rendered,['shot','enemyShot','energyShot']);
});

test('retired boss parts cannot collide on their removal tick',()=>{
 const g=new Game();g.start(1,19);g.clearEncounter();
 const i=g.scriptSpawn(80,5,160,100);g.players[0].invincible=0;
 g.campaign.set(FIELD.frame+i+3,g.campaign.get(FIELD.frameCount+i+3,1),1);
 g.update(TICK);assert.equal(g.actors.active[i],0);assert.equal(g.players[0].hp,200);
});
