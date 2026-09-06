import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from './helpers.mjs';
import {TICK} from '../src/game.js';
import {PICKUP_LIFETIME} from '../src/pickups.js';
const encounter=()=>{const g=new Game();g.start();g.clearEncounter();return g;};
const ticks=(g,n)=>{for(let i=0;i<n;i++)g.update(TICK);};
test('all pickup types last twice as long and keep the level alive until they time out',()=>{
 const g=encounter();assert.equal(PICKUP_LIFETIME,24);
 for(let type=1;type<=8;type++)g.pickups.spawn(type,280,180);
 ticks(g,12/TICK);assert.equal(g.remainingPickups,8);assert.equal(g.state,'playing');assert.equal(g.waitingForPickups,true);
 const age=g.actors.age[0];g.pause();g.update(100);assert.equal(g.actors.age[0],age);g.pause();
 ticks(g,12.1/TICK);assert.equal(g.remainingPickups,0);assert.equal(g.waitingForPickups,false);
 ticks(g,1.1/TICK);assert.equal(g.state,'cleared');
});
test('collecting the final pickup ends the level without waiting out its remaining lifetime',()=>{
 const g=encounter(),a=g.pickups.spawn(1,250,160),b=g.pickups.spawn(2,280,180);
 ticks(g,100);g.pickups.collect(a,0);ticks(g,100);assert.equal(g.state,'playing');assert.equal(g.remainingPickups,1);
 g.pickups.collect(b,0);ticks(g,72);assert.equal(g.state,'cleared');assert.equal(g.credits,60);
});
test('a newer pickup retains its full collection window after older pickups expire',()=>{
 const g=encounter(),a=g.pickups.spawn(1,280,180);g.actors.age[a]=23.95;
 const b=g.pickups.spawn(2,260,180);ticks(g,80);assert.equal(g.actors.active[a],0);assert.equal(g.actors.active[b],1);assert.equal(g.state,'playing');assert.ok(g.pickupSecondsLeft>=22);
});
test('pickup collection cannot bypass outstanding enemies or delayed waves',()=>{
 const g=encounter();g.spawnRock(1,3,10,10,0,0);assert.equal(g.waitingForPickups,false);ticks(g,80);assert.equal(g.state,'playing');
 g.start(1,2);g.clearEncounter();const i=g.pickups.spawn(1,280,180);g.pickups.collect(i,0);ticks(g,80);assert.equal(g.state,'playing');assert.equal(g.waitingForPickups,false);
});
