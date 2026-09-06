import test from 'node:test';
import assert from 'node:assert/strict';
import {residualRotation,Kind,TICK} from '../src/game.js';
import {Game,atlas} from './helpers.mjs';

test('rotation is only the fractional frame correction and resets at every sprite boundary',()=>{
 const step=2*Math.PI/64,steps=Array(64).fill(step);
 for(const whole of [-65,-1,0,1,63,64,129]){
  assert.equal(residualRotation(whole,steps),0);
  assert.equal(residualRotation(whole+.5,steps),step*.5);
  assert.ok(Math.abs(residualRotation(whole+1-1e-6,steps)-step)<1e-6);
 }
 assert.equal(residualRotation(-.25,steps),step*.75);
 assert.equal(residualRotation(.5,steps.map(x=>-x)),-step*.5);
});

test('all asteroid animations include measured turns, including the last-to-first transition',()=>{
 const entries=Object.entries(atlas.rockRotation);assert.equal(entries.length,40);
 for(const [key,steps] of entries){
  assert.equal(steps.length,atlas.groups[key].length);
  assert.ok(steps.every(x=>Number.isFinite(x)&&Math.abs(x)<=2*Math.PI/steps.length+1e-8));
 }
 const sum=a=>a.reduce((s,x)=>s+x,0);
 assert.ok(sum(atlas.rockRotation.rock1a)>0);assert.ok(sum(atlas.rockRotation.rock1b)<0);
});

test('render smoothing follows spin in both directions without changing stepped collision masks',()=>{
 for(const spin of [-.4,.4]){
  const g=new Game();g.start();g.actors.clear();const i=g.spawnRock(1,0,100,100,0,0);
  g.actors.animationFrame[i]=4;g.actors.animationAge[i]=1;g.actors.spin[i]=spin;g.prepareCollisions();
  const before=g.collision.bodies[i+1].mask,angle=g.actors.angle[i],age=g.actors.age[i];
  const draws=[];const renderer={data:atlas,begin(){},end(){},rect(){},sprite(...args){draws.push(args);}};
  g.render(renderer,TICK/2);
  const rock=draws.find(([key])=>key==='rock1a'),phase=g.actorFrame(i,TICK/2);
  assert.equal(rock[1],phase);assert.equal(rock[6],residualRotation(phase,atlas.rockRotation.rock1a));
  assert.notEqual(rock[6],0);assert.equal(g.actors.angle[i],angle);assert.equal(g.actors.age[i],age);
  assert.equal(g.collision.bodies[i+1].mask,before);
  g.pause();draws.length=0;g.render(renderer,TICK/2);
  assert.equal(draws.find(([key])=>key==='rock1a')[1],g.actorFrame(i,0));
 }
});

for(const delay of [1,2])for(const direction of [-1,1]){
 test(`original asteroid timer ${delay} and direction ${direction} retain exact frame boundaries`,()=>{
  const g=new Game();g.start();g.actors.clear();const i=g.spawnRock(1,0,100,100,0,0),a=g.actors;
  a.animationDelay[i]=delay;a.spin[i]=direction*2*Math.PI/(64*(delay+1)*TICK);
  for(let tick=0;tick<64*(delay+1);tick++){
   g.updateRock(i);
   const expected=((direction*(Math.floor(tick/(delay+1))+1))%64+64)%64;
   assert.equal(g.actorFrame(i),expected);
   assert.ok(Math.abs(g.actorFrame(i,TICK/2)-expected)<1);
  }
  assert.equal(g.actorFrame(i),0);
 });
}
