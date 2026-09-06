import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Pool,Kind,TICK,LEVELS,wrap} from '../src/game.js';
import {Game} from './helpers.mjs';
test('all 264 slots participate in the completion scan, including 256–263',()=>{
 const p=new Pool(264);for(let i=0;i<264;i++)assert.equal(p.add(Kind.ROCK,0,0),i);
 assert.equal(p.add(Kind.ROCK,0,0),-1);for(let i=0;i<263;i++)p.remove(i);
 assert.equal(p.hostileCount(),1);p.remove(263);assert.equal(p.hostileCount(),0);
});
test('level transition waits for enemies in the last slot',()=>{
 const g=new Game();g.start();g.actors.clear();g.actors.cursor=263;g.spawnRock(1,3,10,10,0,0);
 for(let i=0;i<150;i++)g.update(TICK);assert.equal(g.state,'playing');g.actors.clear();
 for(let i=0;i<72;i++)g.update(TICK);assert.equal(g.state,'cleared');g.next();assert.equal(g.level,2);
});
test('opening campaign values agree with the recovered binary evidence',()=>{
 const evidence=JSON.parse(readFileSync(new URL('../assets/campaign-evidence.json',import.meta.url)));
 for(const l of LEVELS){const e=evidence[l.level-1];assert.equal(e.entry.toLowerCase(),l.entry.toLowerCase());assert.equal(e.asteroids[0]??null,l.rock);assert.equal(e.backgrounds[0],l.background);}
 const g=new Game();g.start(1,2);assert.equal(g.spawnTimer,840);g.start(1,3);assert.equal(g.remainingSpawns,5);
});
test('pending delayed spawn prevents premature completion',()=>{
 const g=new Game();g.start(1,2);g.actors.clear();for(let i=0;i<840;i++)g.update(TICK);
 assert.equal(g.state,'playing');assert.equal(g.remainingSpawns,1);g.update(TICK);assert.equal(g.remainingSpawns,0);assert.equal(g.actors.hostileCount(),1);
});
test('pause freezes simulation and restart resets pools',()=>{
 const g=new Game();g.start();g.update(TICK,[{thrust:true,fire:true}]);const y=g.players[0].y;g.pause();g.update(2,[{thrust:true}]);assert.equal(g.players[0].y,y);
 g.start(3);assert.equal(g.players.length,3);assert.equal(g.shots.count,0);assert.equal(g.effects.count,0);assert.equal(g.score,0);
});
test('bullets damage asteroids, split them, and expire',()=>{
 const g=new Game();g.start();g.actors.clear();const i=g.spawnRock(1,0,160,70,0,0);g.actors.hp[i]=1;
 g.shoot(160,73,0,0);g.update(TICK);assert.equal(g.score,1000);assert.equal(g.actors.hostileCount(),3);
 g.shoot(30,30,0,0);for(let n=0;n<100;n++)g.update(TICK);assert.equal(g.shots.count,0);
});
test('death leads to game over, without immediately resetting the campaign',()=>{
 const g=new Game();g.start();const p=g.players[0];p.lives=1;p.hp=10;p.invincible=0;g.damagePlayer(p,20);assert.equal(g.state,'gameover');assert.equal(p.dead,true);
});
test('inserting a coin revives the pilot without resetting encounter progress or score',()=>{
 const events=[],g=new Game(event=>events.push(event));g.start(1,2);
 g.update(TICK);g.score=1234;g.credits=70;
 const actor=Array.from(g.actors.active).findIndex(Boolean),x=g.actors.x[actor],timer=g.spawnTimer;
 g.actors.hp[actor]=2;const p=g.players[0];p.lives=1;p.hp=10;p.invincible=0;g.damagePlayer(p,20);
 g.shoot(160,100,0,-1);assert.equal(g.state,'gameover');assert.ok(g.effects.count>0);
 assert.equal(g.insertCoin(),true);assert.equal(g.state,'playing');assert.equal(events.at(-1),'continue');
 assert.equal(g.level,2);assert.equal(g.score,1234);assert.equal(g.credits,70);
 assert.equal(g.actors.x[actor],x);assert.equal(g.actors.hp[actor],2);assert.equal(g.remainingSpawns,1);assert.equal(g.spawnTimer,timer);
 assert.equal(p.dead,false);assert.equal(p.hp,200);assert.equal(p.lives,3);assert.equal(p.invincible,2.5);
 assert.equal(g.shots.count,0);assert.equal(g.effects.count,0);
 g.damagePlayer(p,100);assert.equal(p.hp,200);g.update(TICK,[{thrust:true}]);assert.ok(p.y<100);
});
test('a coin restores the whole co-op crew only when all pilots are out of ships',()=>{
 const g=new Game();g.start(3);
 for(let i=0;i<3;i++){
  const p=g.players[i];p.lives=1;p.hp=10;p.invincible=0;g.damagePlayer(p,20);
  if(i<2){assert.equal(g.insertCoin(),false);assert.equal(p.dead,true);}
 }
 assert.equal(g.insertCoin(),true);
 assert.deepEqual(g.players.map(p=>p.lives),[3,3,3]);assert.deepEqual(g.players.map(p=>p.x),[124,160,196]);
 assert.ok(g.players.every(p=>!p.dead&&p.hp===200));
 g.players[0].lives=2;assert.equal(g.insertCoin(),false);assert.equal(g.players[0].lives,2);
});
test('coin insertion cannot start a game or bypass pause, level clear, or campaign completion',()=>{
 const g=new Game();assert.equal(g.insertCoin(),false);g.start();
 for(const state of ['playing','paused','cleared','complete']){g.state=state;assert.equal(g.insertCoin(),false);assert.equal(g.state,state);}
});
test('twenty converted levels finish explicitly; unsupported levels are rejected',()=>{
 const g=new Game();g.start(1,20);g.state='cleared';g.next();assert.equal(g.state,'complete');assert.throws(()=>g.start(1,21),/not been translated/);
});
test('deterministic inputs are stable across long runs and stay bounded',()=>{
 const a=new Game(),b=new Game();a.start();b.start();
 for(let i=0;i<10000;i++){const input=[{thrust:i%5===0,fire:true,right:i%100<30}];a.update(TICK,input);b.update(TICK,input);}
 assert.equal(a.score,b.score);assert.equal(a.players[0].x,b.players[0].x);assert.ok(a.actors.count<=264);assert.ok(a.shots.count<=512);assert.ok(Number.isFinite(a.players[0].y));
 assert.equal(wrap(-1,320),319);assert.equal(wrap(320,320),0);
});

test('Easy is the default and doubles player health',()=>{
 const g=new Game();g.start(3);
 assert.equal(g.difficulty,'easy');assert.equal(g.maxHealth,200);
 assert.ok(g.players.every(p=>p.hp===200&&p.lives===3));
 const p=g.players[0];p.invincible=0;g.damagePlayer(p,100);
 assert.equal(p.hp,100);assert.equal(p.lives,3);
});
for(const [difficulty,health] of [['easy',200],['normal',100]]){
 test(`${difficulty} health persists through respawn, next level, and co-op coin continue`,()=>{
  const g=new Game();g.start(3,1,difficulty);
  assert.equal(g.maxHealth,health);assert.ok(g.players.every(p=>p.hp===health));
  const p=g.players[0];p.invincible=0;g.damagePlayer(p,health);
  assert.equal(p.hp,health);assert.equal(p.lives,2);
  p.invincible=0;g.damagePlayer(p,30);
  g.state='cleared';g.next();
  assert.equal(g.difficulty,difficulty);assert.equal(p.hp,health-30);
  for(const pilot of g.players){pilot.lives=1;pilot.invincible=0;g.damagePlayer(pilot,health);}
  assert.equal(g.state,'gameover');assert.equal(g.insertCoin(),true);
  assert.equal(g.difficulty,difficulty);assert.equal(g.level,2);
  assert.ok(g.players.every(p=>p.hp===health&&p.lives===3&&!p.dead));
 });
}
test('restarting applies the selected difficulty without changing enemies',()=>{
 const g=new Game();g.start();const hp=Array.from(g.actors.hp);
 g.start(1,1,'normal');assert.equal(g.players[0].hp,100);assert.deepEqual(Array.from(g.actors.hp),hp);
 g.start();assert.equal(g.players[0].hp,200);assert.deepEqual(Array.from(g.actors.hp),hp);
 assert.throws(()=>g.start(1,1,'unknown'),/Unknown difficulty/);
});
