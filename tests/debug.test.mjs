import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from './helpers.mjs';
import {TICK} from '../src/game.js';
import {collisionLayer,colorizeLayer,debugSnapshot,stepGame,idColor} from '../src/debug-data.js';

test('layer export copies actual IDs, including players above 255 and optional gutters',()=>{
  const g=new Game();g.start(3);const w=g.collision,layer=collisionLayer(w);
  assert.equal(layer.width,320);assert.equal(layer.height,200);
  assert.ok(layer.ids.includes(265));assert.ok(layer.ids.includes(267));
  for(let y=0;y<200;y++)assert.deepEqual(layer.ids.subarray(y*320,(y+1)*320),w.layer.subarray((y+w.gutter)*w.width+w.gutter,(y+w.gutter)*w.width+w.gutter+320));
  const all=collisionLayer(w,true);assert.equal(all.originX,-128);assert.equal(all.originY,-128);assert.deepEqual(all.ids,w.layer);
  all.ids.fill(0);layer.ids.fill(0);assert.ok(w.layer.includes(265));
});
test('debug pixels exactly encode layer occupancy and deterministic ID colors',()=>{
  const g=new Game();g.start();const ids=collisionLayer(g.collision).ids,rgba=new Uint8ClampedArray(320*200*4);
  colorizeLayer(g.collision,rgba,170);
  for(let i=0;i<ids.length;i++){
    assert.equal(rgba[i*4+3],ids[i]?170:0);
    if(ids[i])assert.deepEqual([...rgba.subarray(i*4,i*4+3)],idColor(ids[i]));
  }
  g.collision.layer.fill(0);colorizeLayer(g.collision,rgba);assert.ok(rgba.every(v=>v===0));
});
test('inspection reports recovered mask origins, alpha fallbacks and independent snapshots',()=>{
  const g=new Game();g.start(2);g.collision.setDebug(true);const s=debugSnapshot(g),ship=s.objects.find(o=>o.id===265),coop=s.objects.find(o=>o.id===266);
  assert.match(ship.maskSource,/\$M$/);assert.equal(coop.maskSource,'sprite alpha > 0');
  assert.equal(ship.mask.originX,g.collision.bodies[265].mask.ox);assert.equal(ship.copies,1);
  ship.hp=0;s.collision.tick.shotQueries=999;assert.equal(g.players[0].hp,200);assert.equal(g.collision.debug.tick.shotQueries,0);
});
test('collision instrumentation counts tested pixels and keeps a bounded hit history',()=>{
  const g=new Game();g.start();const w=g.collision,b=w.bodies[265];w.setDebug(true);
  for(let i=0;i<40;i++)assert.equal(w.hit(b.mask,b.x,b.y),265);
  assert.equal(w.debug.tick.shotQueries,40);assert.equal(w.debug.tick.projectileHits,40);assert.ok(w.debug.tick.circleTests>=40);assert.ok(w.debug.tick.layerPixels>=40);assert.equal(w.debug.hits.length,32);
  const hit=w.debug.hits.at(-1);assert.equal(w.layer[(hit.y+w.gutter)*w.width+hit.x+w.gutter],265);
  w.beginDebugTick();assert.equal(w.debug.tick.shotQueries,0);assert.equal(w.debug.hits.length,32);
  w.setDebug(false);assert.equal(w.debug,null);
});
test('enabling debug instrumentation and taking snapshots do not change simulation or collisions',()=>{
  const a=new Game(),b=new Game();a.start(2,6);b.start(2,6);b.collision.setDebug(true);
  for(let i=0;i<350;i++){
    const input=[{thrust:i%3===0,fire:true,left:i%70<35},{fire:true,right:true}];
    a.update(TICK,input);b.update(TICK,input);
    if(i%10===0){debugSnapshot(b);collisionLayer(b.collision);}
  }
  assert.deepEqual(a.players,b.players);assert.deepEqual(a.actors,b.actors);assert.deepEqual(a.shots,b.shots);assert.deepEqual(a.effects,b.effects);assert.deepEqual(a.collision.layer,b.collision.layer);
  assert.equal(a.score,b.score);assert.equal(a.seed,b.seed);assert.equal(a.state,b.state);
});
test('step advances exactly the requested fixed ticks and remains paused',()=>{
  const g=new Game();g.start(1,2);assert.equal(stepGame(g),0);g.pause();const ticks=g.levelTicks,timer=g.spawnTimer;
  assert.equal(stepGame(g,3),3);assert.equal(g.levelTicks,ticks+3);assert.equal(g.spawnTimer,timer-3);assert.equal(g.state,'paused');
  assert.throws(()=>stepGame(g,0),/1–70/);assert.throws(()=>stepGame(g,71),/1–70/);assert.throws(()=>stepGame(g,1.5),/1–70/);
});
test('step preserves real level-clear and game-over transitions instead of forcing pause',()=>{
  const g=new Game();g.start();g.actors.clear();g.clearTime=1;g.pause();
  assert.equal(stepGame(g,10),1);assert.equal(g.state,'cleared');assert.equal(stepGame(g),0);
  const h=new Game();h.start();h.pause();h.update=function(){this.state='gameover';};assert.equal(stepGame(h,10),1);assert.equal(h.state,'gameover');
});
test('level changes and coin continues refresh the collision layer before rendering',()=>{
  const g=new Game();g.start(1,2);g.players[0].x=20;g.prepareCollisions();g.collision.draw();
  g.loadLevel(3);assert.equal(g.collision.bodies[265].x,g.players[0].x);
  g.players[0].dead=true;g.prepareCollisions();g.collision.draw();assert.ok(!g.collision.layer.includes(265));g.state='gameover';g.insertCoin();assert.ok(g.collision.layer.includes(265));
});
