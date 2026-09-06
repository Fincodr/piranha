import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,atlas,masks} from './helpers.mjs';
import {TICK} from '../src/game.js';
import {CollisionMasks,CollisionWorld} from '../src/collision.js';
import {forEachWrappedPosition,wrap} from '../src/wrapping.js';
const positions=(x,y,ox=2,oy=2,w=5,h=5)=>{const out=[];forEachWrappedPosition(x,y,ox,oy,w,h,(x,y)=>out.push([x,y]));return out;};
const encounter=()=>{const g=new Game();g.start();g.clearEncounter();g.players[0].invincible=0;return g;};
const fixture=()=>new CollisionMasks({groups:{point:[0],ring:[1]},collision:{bytes:4,frames:[[0,1,1,0,0,1],[1,3,3,1,1,3]]}},new Uint8Array([1,7,5,7]));

test('edge copies begin at rounded pixel boundaries and include diagonal corner copies',()=>{
 assert.deepEqual(positions(100,100),[[100,100]]);
 assert.deepEqual(positions(2,2),[[2,2]]);
 assert.deepEqual(positions(1,1),[[1,1],[321,1],[1,201],[321,201]]);
 assert.deepEqual(positions(319,199),[[319,199],[-1,199],[319,-1],[-1,-1]]);
 assert.deepEqual(positions(1.5,100),[[1.5,100]]);assert.equal(positions(1.49,100).length,2);
 assert.deepEqual(positions(-1,201),positions(319,1));
});
test('every player frame stamps exactly its wrapped solid pixels, with no invisible gutter targets',()=>{
 const w=new CollisionWorld(masks);
 for(const key of ['ship1','ship2','ship3'])for(let frame=0;frame<64;frame++)for(const [x,y] of [[0,100],[319,100],[160,0],[160,199],[0,0],[319,199]]){
  const mask=masks.get(key,frame),left=Math.round(x-mask.ox),top=Math.round(y-mask.oy);
  const expected=new Set();
  for(let n=0;n<mask.spans.length;n+=3)for(let px=mask.spans[n+1];px<mask.spans[n+2];px++)expected.add(wrap(top+mask.spans[n],200)*320+wrap(left+px,320));
  w.clear();w.set(265,key,frame,x,y);w.draw();let count=0;
  // Only inspect occupied pixels; missing and duplicated pieces change count.
  for(let n=0;n<w.layer.length;n++)if(w.layer[n]){
   const px=n%w.width-w.gutter,py=Math.floor(n/w.width)-w.gutter;
   assert.ok(px>=0&&px<320&&py>=0&&py<200);assert.ok(expected.has(py*320+px));count++;
  }
  assert.equal(count,expected.size,`${key} frame ${frame} at ${x},${y}`);
 }
});
test('wrapped player pieces retain player-last priority, transparent holes and co-op ownership',()=>{
 const m=fixture(),w=new CollisionWorld(m),point=m.get('point',0);
 w.set(1,'point',0,319,199);w.set(265,'ring',0,0,0);w.draw();
 assert.equal(w.hit(point,319,199),265);assert.equal(w.hit(point,319,199,0,true),0);
 assert.equal(w.hit(point,0,0),0); // Hollow center stays transparent.
 assert.equal(w.hit(point,-1,-1),0); // The hidden continuation is not a target.
 assert.equal(w.touchesPlayer(1,0),true);
 w.set(265,'ring',0,100,100);w.draw();assert.equal(w.hit(point,319,199),1);assert.equal(w.touchesPlayer(1,0),false);
});
for(const [edge,x,y,angle,mx,my] of [
 ['left',3,80,-Math.PI/2,311,80],['right',317,80,Math.PI/2,9,80],
 ['top',80,3,0,80,191],['bottom',80,197,Math.PI,80,9],
 ['corner',319,1,Math.PI/4,wrap(319+Math.SQRT1_2*12,320),wrap(1-Math.SQRT1_2*12,200)],
])test(`${edge}: muzzle wraps before the ship origin for every weapon tier`,()=>{
 const g=encounter(),p=g.players[0];p.x=x;p.y=y;p.angle=angle;
 for(const weapon of [1,2,3]){
  g.shots.clear();p.weapon=weapon;g.firePlayer(0);const s=g.shots;
  assert.equal(s.count,weapon===1?1:3);
  for(let i=0;i<s.capacity;i++)if(s.active[i]){assert.ok(Math.abs(s.x[i]-mx)<.0001);assert.ok(Math.abs(s.y[i]-my)<.0001);assert.equal(s.owner[i],0);}
  assert.equal(p.x,x);assert.equal(p.y,y);
 }
});
test('a tail crossing the edge does not move the muzzle to the wrong side',()=>{
 const g=encounter(),p=g.players[0];p.x=3;p.y=90;p.angle=Math.PI/2;g.firePlayer(0);
 assert.equal(g.shots.x[0],15);assert.equal(g.shots.y[0],90);
});
test('opposite-side shots hit there and never wrap again in flight',()=>{
 const g=encounter(),p=g.players[0];p.x=319;p.y=80;p.angle=Math.PI/2;
 const i=g.spawnRock(1,3,15,80,0,0);g.actors.hp[i]=35;g.actors.spin[i]=0;
 g.firePlayer(0);g.update(TICK);assert.equal(g.score,50);assert.equal(g.shots.count,0);
 g.clearEncounter();p.x=319;p.y=80;p.angle=-Math.PI/2;g.firePlayer(0);const shot=g.shots.active.findIndex(Boolean);
 g.shots.vx[shot]=1400;g.update(TICK);assert.ok(g.shots.x[shot]>320);
});
test('visible wrapped wings collect pickups and take asteroid and projectile damage',()=>{
 const g=encounter(),p=g.players[0];p.x=0;p.y=0;
 g.pickups.spawn(2,318,198);g.update(TICK);assert.equal(g.credits,50);
 g.spawnRock(1,3,318,198,0,0);g.update(TICK);assert.equal(p.hp,170);
 g.clearEncounter();p.invincible=0;g.shoot(318,198,0,-1);g.update(TICK);assert.equal(p.hp,135);
});
test('ship and exhaust rendering duplicate only visible edge pieces in the existing batch',()=>{
 const g=encounter(),p=g.players[0];p.x=0;p.y=0;
 const calls=[],r={data:atlas,begin(){},end(){},rect(){},sprite(...args){calls.push(args);}};
 g.render(r);const ships=calls.filter(([key])=>key==='ship1');assert.equal(ships.length,4);
 assert.deepEqual(ships.map(a=>a.slice(2,4)),[[0,0],[320,0],[0,200],[320,200]]);
 g.effects.clear();const i=g.effects.add(4,-1,99);g.effects.life[i]=8*TICK;calls.length=0;g.render(r);
 const flames=calls.filter(([key])=>key==='exhaust');assert.equal(flames.length,2);
 assert.deepEqual(flames.map(a=>a[2]),[319,-1]);
 p.dead=true;g.prepareCollisions();g.collision.draw();calls.length=0;g.render(r);
 assert.equal(calls.filter(([key])=>key==='ship1').length,0);assert.ok(!g.collision.layer.includes(265));
});
