import test from 'node:test';
import assert from 'node:assert/strict';
import {SlowMotion} from '../src/slow-motion.js';
import {TICK} from '../src/game.js';
import {Game} from './helpers.mjs';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('Shift ramps to half speed in half a second and release restores normal speed',()=>{
  const clock=new SlowMotion();
  near(clock.advance(.25,true),.21875);near(clock.scale,.75);
  near(clock.advance(.25,true),.15625);near(clock.scale,.5);
  near(clock.advance(2,true),1);near(clock.scale,.5);
  near(clock.advance(.25,false),.15625);near(clock.scale,.75);
  near(clock.advance(.25,false),.21875);near(clock.scale,1);
  near(clock.advance(2,false),2);
});

test('releasing or pressing again during a ramp reverses smoothly without overshoot',()=>{
  const clock=new SlowMotion();clock.advance(.2,true);near(clock.scale,.8);
  clock.advance(.1,false);near(clock.scale,.9);
  clock.advance(.1,true);near(clock.scale,.8);
  near(clock.advance(1,false),.98);near(clock.scale,1);
  clock.advance(1,true);clock.reset();near(clock.scale,1);
});

test('integrated simulation time is identical at different display refresh rates',()=>{
  function run(hz){
    const clock=new SlowMotion();let elapsed=0;
    for(const held of [true,false])for(let i=0;i<hz;i++)elapsed+=clock.advance(1/hz,held);
    near(clock.scale,1);return elapsed;
  }
  for(const hz of [30,60,120,144])near(run(hz),1.5);
});

test('half speed preserves fixed ticks and advances the whole game half as far',()=>{
  const clock=new SlowMotion();clock.advance(.5,true);
  const slow=new Game(),reference=new Game();slow.start(1,2);reference.start(1,2);
  let accumulator=0,ticks=0;
  for(let i=0;i<140;i++){
    accumulator+=clock.advance(TICK,true);
    while(accumulator>=TICK){slow.update(TICK,[{thrust:true,fire:true}]);accumulator-=TICK;ticks++;}
  }
  for(let i=0;i<70;i++)reference.update(TICK,[{thrust:true,fire:true}]);
  assert.equal(ticks,70);
  assert.equal(slow.spawnTimer,reference.spawnTimer);
  assert.deepEqual(slow.players,reference.players);
  assert.deepEqual(slow.shots,reference.shots);
  assert.deepEqual(slow.effects,reference.effects);
});
