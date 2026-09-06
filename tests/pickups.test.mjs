import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,atlas} from './helpers.mjs';
import {Kind,TICK} from '../src/game.js';
import {PICKUPS} from '../src/pickups.js';
import {FIELD} from '../src/campaign.js';
const encounter=()=>{const g=new Game();g.start();g.clearEncounter();return g;};
const collect=(g,type,owner=0)=>g.pickups.collect(g.pickups.spawn(type,90,60),owner);

test('every pickup has original artwork and collision geometry',()=>{
 const g=encounter();
 for(const [type,{key}] of Object.entries(PICKUPS)){
  const i=g.pickups.spawn(Number(type),100,100);assert.equal(g.actorKey(i),key);
  assert.equal(atlas.groups[key].length,32);g.prepareCollisions();assert.ok(g.collision.bodies[i+1].mask);
 }
});
test('original drop schedules apply before breakup, wrap, and respect level overrides',()=>{
 const g=encounter(),a=g.actors,c=g.campaign;g.pickups.configure(2);
 const large=g.spawnRock(1,0,80,80,0,0);g.destroy(large);
 assert.equal(a.hostileCount(),3);
 assert.equal(Array.from(a.active.keys()).filter(i=>a.active[i]&&a.pickup[i]===4).length,1);
 g.clearEncounter();c.set(0x50539,2,1);c.set(0x5053e,0,1);c.set(0x5033c,2,1);c.set(0x5033d,3,1);
 for(let n=0;n<3;n++)g.pickups.drop(Kind.ROCK,1,20,20,0,0);
 assert.deepEqual(Array.from(a.active.keys()).filter(i=>a.active[i]).map(i=>a.pickup[i]),[2,3,2]);
 g.pickups.configure(0);g.clearEncounter();g.pickups.drop(Kind.ROCK,3,20,20,0,0);assert.equal(a.count,0);
});
test('random drop codes follow original conditional rolls and rejection sampling',()=>{
 const g=encounter();
 for(const [code,digits,result] of [[10,[0],1],[10,[5],0],[10,[6,0],4],[10,[7,0],8],[10,[7,4],7],[10,[8,9],0],[11,[8,8,9,2],3],[11,[9,0],4]]){
  let n=0;g.originalDigit=()=>{assert.ok(n<digits.length);return digits[n++];};
  assert.equal(g.pickups.resolve(code),result);assert.equal(n,digits.length);
 }
});
test('cash, energy, extra ships and weapon upgrades apply their separate effects',()=>{
 const g=encounter();collect(g,1);collect(g,2);collect(g,3);assert.equal(g.credits,160);assert.equal(g.score,160);
 g.players[0].hp=130;collect(g,7);assert.equal(g.players[0].hp,200);collect(g,8);assert.equal(g.players[0].lives,4);
 collect(g,6);assert.equal(g.players[0].weapon,2);g.update(TICK,[{fire:true}]);assert.equal(g.shots.count,3);
 g.shots.clear();g.players[0].cooldown=0;collect(g,6);g.update(TICK,[{fire:true}]);
 assert.equal(g.shots.count,3);assert.ok(Array.from(g.shots.active.keys()).filter(i=>g.shots.active[i]).every(i=>g.shotKey(i)==='energyShot'));
 g.start(1,1,'normal');g.players[0].hp=20;collect(g,7);assert.equal(g.players[0].hp,100);
 g.start(3);g.players[2].dead=true;g.players[2].lives=0;collect(g,8);assert.deepEqual(g.players.map(p=>p.lives),[4,4,0]);
});
for(const [pattern,count] of [[21,8],[22,16],[23,8],[24,16],[25,12],[26,33]]){
 test(`mystery pattern ${pattern} emits its recovered ${count} shots at the coin location`,()=>{
  const g=encounter();g.pickups.startPattern(75,45,0,5,pattern);
  for(let n=0;n<40;n++)g.pickups.tick();assert.equal(g.shots.count,count);assert.equal(g.pickups.patterns.length,0);
  const s=g.shots;for(let i=0;i<s.capacity;i++)if(s.active[i]){
   assert.equal(s.x[i],75);assert.equal(s.y[i],45);assert.equal(s.owner[i],0);assert.equal(s.damage[i],150);assert.equal(g.shotKey(i),'fireball');assert.equal(g.shotFrame(i),10);
   assert.ok(Math.abs(Math.hypot(s.vx[i],s.vy[i])-245)<71);
  }
  const first=s.active.findIndex(Boolean);assert.equal(s.vx[first],0);assert.equal(s.vy[first],-245);
 });
}
test('question mark selects both source fireball types and does not hurt the collecting pilot',()=>{
 for(const weaponDigit of [0,9]){
  const g=encounter(),p=g.players[0];let digits=[weaponDigit,9,2];g.originalDigit=()=>digits.shift();p.invincible=0;
  collect(g,4);assert.equal(g.pickups.patterns[0].pattern,23);assert.equal(g.pickups.patterns[0].weapon,weaponDigit?6:5);
  p.x=90;p.y=60;g.update(TICK);assert.equal(p.hp,200);assert.equal(g.shots.count,8);
 }
});
test('bomb damages up to eleven original eligible actors and leaves pilots and ordinary enemies alone',()=>{
 const g=encounter(),a=g.actors;
 for(let n=0;n<12;n++)g.spawnRock(1,0,10,10,0,0);
 const enemy=a.add(Kind.ENEMY,10,10);a.hp[enemy]=150;a.scriptType[enemy]=1;
 collect(g,5);assert.equal(g.players[0].hp,200);assert.equal(a.hp[enemy],150);
 assert.equal(Array.from(a.hp).filter(hp=>hp===950).length,11);assert.equal(Array.from(a.hp).filter(hp=>hp===1000).length,1);
 assert.equal(g.campaign.get(FIELD.hp+3*4),950);assert.ok(g.shakeTime>0);assert.ok(g.flashTime>0);
});
test('bomb collection rebuilds collision ownership after destroying nearby rocks',()=>{
 const g=encounter(),p=g.players[0],rock=g.spawnRock(1,3,100,70,0,0);g.actors.hp[rock]=50;
 g.pickups.spawn(5,p.x,p.y);g.update(TICK);
 assert.equal(g.actors.active[rock],0);assert.equal(g.collision.bodies[rock+1].mask,null);
});
test('asteroid contact shakes only on damage; pause freezes and restart clears effects',()=>{
 const g=encounter(),p=g.players[0];g.damagePlayer(p,30,true);assert.equal(g.shakeTime,0);
 p.invincible=0;g.spawnRock(1,3,p.x,p.y,0,0);g.update(TICK);assert.equal(p.hp,170);assert.ok(g.shakeTime>0);
 const time=g.shakeTime;g.pause();g.update(1);assert.equal(g.shakeTime,time);
 g.pause();g.actors.clear();for(let n=0;n<30;n++)g.update(TICK);assert.deepEqual(g.cameraOffset,[0,0]);
 g.shake(4,.5);g.pickups.startPattern(0,0,0,5,21);g.start();assert.equal(g.shakeTime,0);assert.equal(g.pickups.patterns.length,0);
});

test('bomb breakup never applies a second hit to newly allocated fragments',()=>{
 const g=encounter(),a=g.actors;g.pickups.configure(0);
 for(let n=0;n<12;n++){const i=g.spawnRock(1,2,10,10,0,0);a.hp[i]=50;}
 g.pickups.bomb(0);
 const ids=Array.from(a.active.keys()).filter(i=>a.active[i]);
 assert.equal(ids.filter(i=>a.size[i]===2).length,1);assert.equal(ids.filter(i=>a.size[i]===3).length,44);
 assert.ok(ids.every(i=>a.hp[i]===50));
});
test('mystery queues and exhaust remain bounded and coin continuation clears pending bursts',()=>{
 const g=encounter();for(let n=0;n<100;n++)g.pickups.startPattern(30,30,0,6,26);
 assert.equal(g.pickups.patterns.length,32);for(let n=0;n<40;n++)g.pickups.tick();
 assert.equal(g.shots.count,g.shots.capacity);assert.equal(g.pickups.patterns.length,0);
 g.pickups.startPattern(30,30,0,6,26);g.shake(4,.5);g.state='gameover';assert.equal(g.insertCoin(),true);
 assert.equal(g.pickups.patterns.length,0);assert.equal(g.shots.count,0);assert.equal(g.shakeTime,0);
});
