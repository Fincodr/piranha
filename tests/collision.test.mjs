import test from 'node:test';
import assert from 'node:assert/strict';
import {CollisionMasks,CollisionWorld,place,circlesOverlap,masksOverlap} from '../src/collision.js';
import {TICK,Kind} from '../src/game.js';
import {Game,masks,atlas} from './helpers.mjs';

function fixture(){
 // One point and a hollow 3x3 square. The empty middle is inside its circle.
 const data={groups:{point:[0],ring:[1]},collision:{bytes:4,frames:[[0,1,1,0,0,1],[1,3,3,1,1,3]]}};
 return new CollisionMasks(data,new Uint8Array([1,7,5,7]));
}
test('circle overlap alone cannot hit a transparent mask pixel',()=>{
 const m=fixture(),w=new CollisionWorld(m),ring=place({},m.get('ring',0),10,10),point=place({},m.get('point',0),10,10);
 assert.equal(circlesOverlap(ring,point),true);assert.equal(masksOverlap(ring,point),false);
 w.set(1,'ring',0,10,10);w.draw();assert.equal(w.hit(point.mask,10,10),0);
 assert.equal(w.hit(point.mask,9,10),1);assert.equal(masksOverlap(ring,place(point,point.mask,9,10)),true);
});
test('players are stamped last, with transparent holes preserving underlying actor IDs',()=>{
 const m=fixture(),w=new CollisionWorld(m),point=m.get('point',0);
 w.set(1,'ring',0,10,10);w.set(265,'ring',0,11,10);w.draw();
 assert.equal(w.hit(point,10,9),265); // Both silhouettes overlap.
 assert.equal(w.hit(point,11,10),1); // Player's transparent center.
 assert.equal(w.hit(point,9,10),1);
 assert.equal(w.hit(point,10,9,0,true),0); // Co-op friendly fire stays off.
});
test('source exclusion, high actor IDs, gutter clipping, and stale pixels',()=>{
 const m=fixture(),w=new CollisionWorld(m),point=m.get('point',0);
 w.set(264,'point',0,-50,-50);w.draw();
 assert.equal(w.hit(point,-50,-50),264);assert.equal(w.hit(point,-50,-50,264),0);
 w.clear();w.set(1,'point',0,1000,1000);w.draw();assert.equal(w.hit(point,-50,-50),0);
});
test('all frame masks use their own origin, and animation wraps in both directions',()=>{
 for(const [key,ids] of Object.entries(atlas.groups)){
  if(key==='white')continue;
  assert.equal(masks.get(key,-1),masks.get(key,ids.length-1));assert.equal(masks.get(key,ids.length),masks.get(key,0));
  for(let n=0;n<ids.length;n++){
   const mask=masks.get(key,n),b=place({},mask,160.49,100.51);
   assert.equal(b.left,Math.round(160.49-mask.ox));assert.equal(b.top,Math.round(100.51-mask.oy));
  }
 }
 // Original normal-bullet mask differs from visible artwork, including origin.
 const id=atlas.groups.shot[0];assert.notEqual(masks.get('shot',0).ox,atlas.frames[id][4]);
});
test('rotating sprite contacts follow the selected frame, including wing tips',()=>{
 const point=fixture().get('point',0),first=masks.get('ship1',0),quarter=masks.get('ship1',16);
 const a=place({},first,100,100),b=place({},quarter,100,100);let differing=0;
 for(let y=75;y<125;y++)for(let x=75;x<125;x++){
  const p=place({},point,x,y);
  if(masksOverlap(a,p)!==masksOverlap(b,p))differing++;
 }
 assert.ok(differing>100);
});

function encounter(){const g=new Game();g.start();g.actors.clear();g.players[0].x=250;g.players[0].y=150;return g;}
test('a fast projectile hits a tiny rock between its starting and ending positions',()=>{
 const g=encounter(),i=g.spawnRock(1,3,100,50,0,0);g.actors.spin[i]=0;g.actors.hp[i]=35;
 g.shoot(60,50,Math.PI/2,0);const shot=g.shots.active.findIndex(Boolean);g.shots.vx[shot]=5600;
 g.update(TICK);assert.equal(g.actors.active[i],0);assert.equal(g.shots.active[shot],0);assert.equal(g.score,50);
});
test('destroyed masks are removed before the next projectile checks the layer',()=>{
 const g=encounter(),i=g.spawnRock(1,3,100,50,0,0);g.actors.spin[i]=0;g.actors.hp[i]=35;
 g.shoot(100,50,0,0);g.shoot(100,50,0,0);g.update(TICK);
 assert.equal(g.actors.active[i],0);assert.equal(g.shots.count,1);
});
test('enemy fire is blocked by solid actors without damaging them',()=>{
 const g=encounter(),i=g.spawnRock(1,3,100,50,0,0),hp=g.actors.hp[i];
 g.shoot(100,50,0,-1);g.update(TICK);
 assert.equal(g.shots.count,0);assert.equal(g.actors.hp[i],hp);
});
test('the firing actor is excluded but a replacement in the same pool slot is not',()=>{
 const g=encounter(),i=g.spawnRock(1,3,100,50,0,0);
 g.shoot(100,50,0,-1,0,0,15,1,i+1);g.update(TICK);assert.equal(g.shots.count,1);
 g.actors.remove(i);g.actors.cursor=i;assert.equal(g.spawnRock(1,3,100,50,0,0),i);
 g.update(TICK);assert.equal(g.shots.count,0);
});
test('player silhouette hits damage the hull and continue clears pending projectiles',()=>{
 const g=encounter(),p=g.players[0];p.x=100;p.y=100;p.invincible=0;
 g.shoot(100,100,0,-1,0,0,15);g.update(TICK);assert.equal(p.hp,185);
 p.lives=1;p.invincible=0;g.damagePlayer(p,200);g.shoot(100,100,0,-1);
 assert.equal(g.insertCoin(),true);assert.equal(g.shots.count,0);g.update(TICK);assert.equal(p.hp,200);
});

for(const [edge,x,y,vx,vy,oppositeX,oppositeY] of [
 ['left',1,20,-1400,0,317,20],['right',319,20,1400,0,3,20],
 ['top',20,1,0,-1400,20,197],['bottom',20,199,0,1400,20,3],
])for(const owner of [0,-1])for(const type of [1,3,5,6]){
 test(`weapon ${type}, ${owner<0?'enemy':'player'}: ${edge} exit never hits the opposite edge`,()=>{
  const g=encounter(),target=g.spawnRock(1,3,oppositeX,oppositeY,0,0),hp=g.actors.hp[target];
  g.actors.spin[target]=0;
  g.shoot(x,y,Math.atan2(vx,-vy),owner,0,0,15,type);
  const i=g.shots.active.findIndex(Boolean);g.shots.vx[i]=vx;g.shots.vy[i]=vy;
  g.update(TICK);
  assert.equal(g.actors.hp[target],hp);assert.equal(g.shots.active[i],1);
  assert.ok(Math.abs(g.shots.x[i]-(x+vx*TICK))<1e-4);
  assert.ok(Math.abs(g.shots.y[i]-(y+vy*TICK))<1e-4);
  g.update(TICK);g.update(TICK);
  assert.equal(g.shots.active[i],0);assert.equal(g.actors.hp[target],hp);
 });
}

test('projectile cleanup includes the exact DOS gutter boundary and deletes beyond it',()=>{
 for(const [x,y,vx,vy] of [[-50,20,-70,0],[370,20,70,0],[20,-50,0,-70],[20,250,0,70]]){
  const g=encounter();g.shoot(x,y,0,0);
  const i=g.shots.active.findIndex(Boolean);g.shots.vx[i]=g.shots.vy[i]=0;
  g.update(TICK);assert.equal(g.shots.active[i],1);
  g.shots.vx[i]=vx;g.shots.vy[i]=vy;g.update(TICK);assert.equal(g.shots.active[i],0);
 }
});
