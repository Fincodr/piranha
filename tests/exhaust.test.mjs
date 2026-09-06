import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,atlas} from './helpers.mjs';
import {TICK} from '../src/game.js';
import {EXHAUST_OFFSETS,EXHAUST_VELOCITIES} from '../src/original-data.js';
test('exhaust restores the original sprite and anchored rear emission for all ship angles',()=>{
 const g=new Game();g.start();const p=g.players[0],e=g.effects;
 assert.equal(atlas.palettes.exhaust.member,'MISC/o8_Explosion.02c');assert.equal(atlas.groups.exhaust.length,12);
 for(let frame=0;frame<64;frame++){
  e.clear();p.angle=(frame+.01)/64*Math.PI*2;p.vx=13;p.vy=-17;g.emitExhaust(p);
  const [dx,dy]=EXHAUST_OFFSETS[frame],[vx,vy]=EXHAUST_VELOCITIES[frame];
  assert.equal(e.x[0],p.x+dx);assert.equal(e.y[0],p.y+dy);
  assert.ok(Math.abs(e.vx[0]-(13+vx/65536/TICK))<.001);assert.ok(Math.abs(e.vy[0]-(-17+vy/65536/TICK))<.001);
 }
});
test('thrust emits every tick using original opaque animation frames and stops on release',()=>{
 const g=new Game();g.start();g.actors.clear();const e=g.effects;
 for(let n=0;n<5;n++)g.update(TICK,[{thrust:true}]);assert.equal(e.count,5);
 const draws=[],r={data:atlas,begin(){},end(){},rect(){},sprite(...args){draws.push(args);}};g.render(r);
 const flames=draws.filter(([key])=>key==='exhaust');assert.equal(flames.length,5);
 assert.ok(flames.every(args=>args[1]>=5&&args[1]<=11&&args[5]===undefined));
 const age=e.age[0];g.pause();g.update(TICK,[{thrust:true}]);assert.equal(e.age[0],age);g.pause();
 for(let n=0;n<10;n++)g.update(TICK);assert.equal(e.count,0);
 g.update(TICK,[{thrust:true}]);assert.equal(e.count,1);g.start();assert.equal(e.count,0);
});
