import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Renderer} from '../src/renderer.js';

const data=JSON.parse(readFileSync(new URL('../assets/atlas.json',import.meta.url)));

for(const backend of ['WebGL','Canvas 2D']){
 test(`${backend}: every artwork frame uses the DOS offset and hotspot at a fixed world anchor`,()=>{
  // Exercise the real sprite placement path without requiring a GPU in Node.
  const renderer=Object.create(Renderer.prototype);renderer.data=data;
  let placement;
  if(backend==='WebGL'){
   renderer.gl={};renderer.quad=(...args)=>{placement=args.slice(0,4);};
  }else{
   renderer.gl=null;renderer.ctx={drawImage:(...args)=>{placement=args.slice(5,9);}};
  }
  let checked=0;
  for(const [key,evidence] of Object.entries(data.palettes)){
   const raw=readFileSync(new URL(`../../unpacked/gdl/${evidence.member}.bin`,import.meta.url));
   const count=raw.readUInt16LE(6);
   assert.equal(data.groups[key].length,count);
   for(let frame=0;frame<count;frame++){
    const record=0x28+frame*26;
    const trimX=raw.readUInt16LE(record+6),trimY=raw.readUInt16LE(record+8);
    const hotspotX=raw.readUInt16LE(record+10),hotspotY=raw.readUInt16LE(record+12);
    const [, ,w,h]=data.frames[data.groups[key][frame]];
    // Stationary actor, advancing animation: match add trim / subtract hotspot
    // from 0x43AF6–0x43B17, including renderer rounding at fractional positions.
    for(const scale of [1,1.5]){
     placement=null;
     renderer.sprite(key,frame,160.25,100.25,scale);
     assert.deepEqual(placement,[
      Math.round(160.25+(trimX-hotspotX)*scale),
      Math.round(100.25+(trimY-hotspotY)*scale),w*scale,h*scale,
     ],`${key} frame ${frame}, scale ${scale}`);
    }
    checked++;
   }
   // The animation seam and negative indices must preserve the same origin.
   renderer.sprite(key,-1,160,100);const last=placement;
   renderer.sprite(key,count-1,160,100);assert.deepEqual(placement,last);
   renderer.sprite(key,count,160,100);const wrapped=placement;
   renderer.sprite(key,0,160,100);assert.deepEqual(placement,wrapped);
  }
  assert.equal(checked,data.frames.length-1);
 });
}

test('WebGL residual rotation turns vertices around the hotspot without changing atlas UVs or flushing',()=>{
 const r=Object.create(Renderer.prototype);r.data={width:100,height:100,groups:{test:[0]},frames:[[10,20,30,18,3,13]]};
 r.gl={};r.count=0;r.vertices=new Float32Array(96);r.flush=()=>assert.fail('Rotation must stay in the sprite batch');
 r.sprite('test',0,160.25,100.25);const plain=r.vertices.slice(0,48);
 const angle=.1;r.sprite('test',0,160.25,100.25,1,1,angle);
 assert.equal(r.count,2);
 for(let n=0;n<48;n+=8){
  const dx=plain[n]-160,dy=plain[n+1]-100;
  assert.ok(Math.abs(r.vertices[48+n]-(160+dx*Math.cos(angle)-dy*Math.sin(angle)))<1e-5);
  assert.ok(Math.abs(r.vertices[49+n]-(100+dx*Math.sin(angle)+dy*Math.cos(angle)))<1e-5);
  assert.deepEqual(r.vertices.slice(50+n,56+n),plain.slice(n+2,n+8));
 }
});

test('Canvas 2D rotates about the hotspot, restores its transform, and retains nearest-neighbor drawing',()=>{
 const r=Object.create(Renderer.prototype);r.data={groups:{test:[0]},frames:[[10,20,30,18,3,13]]};r.gl=null;
 const calls=[];r.ctx={imageSmoothingEnabled:false,save(){calls.push('save');},restore(){calls.push('restore');},translate(...args){calls.push(['translate',...args]);},rotate(...args){calls.push(['rotate',...args]);},drawImage(...args){calls.push(['draw',...args.slice(1)]);}};
 r.sprite('test',0,160.25,100.25,1.5,.75,-.1);
 assert.deepEqual(calls,['save',['translate',160.5,100.5],['rotate',-.1],['draw',10,20,30,18,-4.5,-19.5,45,27],'restore']);
 assert.equal(r.ctx.imageSmoothingEnabled,false);
});

test('rotated sprites that reach into the viewport are not rejected by their unrotated bounds',()=>{
 const r=Object.create(Renderer.prototype);r.data={width:32,height:32,groups:{test:[0]},frames:[[0,0,2,20,1,10]]};r.gl={};let draws=0;r.quad=()=>draws++;
 r.sprite('test',0,-3,100);assert.equal(draws,0);
 r.sprite('test',0,-3,100,1,1,Math.PI/2);assert.equal(draws,1);
});
