import test from 'node:test';
import assert from 'node:assert/strict';
import {bindTouchControls} from '../src/touch-controls.js';

class Button extends EventTarget {
  constructor(control){super();this.dataset={control};this.classes=new Set();this.attrs={};this.captured=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  setAttribute(name,value){this.attrs[name]=value;}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);send(this,'lostpointercapture',id);}
}
function send(button,type,pointerId,extra={}){
  const event=new Event(type,{cancelable:true});
  Object.assign(event,{pointerId,pointerType:'touch',button:0,...extra});button.dispatchEvent(event);return event;
}
function setup(){
  const buttons=Object.fromEntries(['left','right','thrust','brake','fire','slow'].map(key=>[key,new Button(key)]));
  const state={},controls=bindTouchControls(Object.values(buttons),state);controls.setEnabled(true);
  return {buttons,state,controls};
}
test('multiple fingers can steer, thrust, fire and slow independently',()=>{
  const {buttons:b,state:s}=setup();
  for(const [i,key] of ['left','thrust','fire','slow'].entries())assert.equal(send(b[key],'pointerdown',i).defaultPrevented,true);
  assert.ok(s.left&&s.thrust&&s.fire&&s.slow);
  send(b.left,'pointerup',0);assert.equal(s.left,false);assert.ok(s.thrust&&s.fire&&s.slow);
  send(b.fire,'pointercancel',2);assert.equal(s.fire,false);assert.ok(s.thrust&&s.slow);
  send(b.slow,'lostpointercapture',3);assert.equal(s.slow,false);
});
test('releasing one of two fingers on the same button does not stop the other',()=>{
  const {buttons:b,state:s}=setup();send(b.fire,'pointerdown',1);send(b.fire,'pointerdown',2);
  send(b.fire,'pointerup',1);assert.equal(s.fire,true);assert.equal(b.fire.attrs['aria-pressed'],'true');
  send(b.fire,'lostpointercapture',1);assert.equal(s.fire,true);
  send(b.fire,'pointerup',2);assert.equal(s.fire,false);assert.equal(b.fire.attrs['aria-pressed'],'false');
});
test('pause, focus loss and menus clear captured touches and pressed styles',()=>{
  const {buttons:b,state:s,controls}=setup();send(b.brake,'pointerdown',4);send(b.slow,'pointerdown',5);
  controls.setEnabled(false);
  for(const button of Object.values(b)){assert.equal(button.disabled,true);assert.equal(button.captured.size,0);assert.equal(button.classes.size,0);}
  assert.ok(Object.values(s).every(value=>!value));send(b.fire,'pointerdown',9);assert.equal(s.fire,false);
  controls.setEnabled(true);send(b.fire,'pointerdown',10);assert.equal(s.fire,true);
  controls.reset();assert.equal(s.fire,false);
});
test('buttons support keyboard holds while ignoring secondary mouse clicks',()=>{
  const {buttons:b,state:s}=setup();send(b.fire,'pointerdown',1,{pointerType:'mouse',button:2});assert.ok(!s.fire);
  send(b.fire,'keydown',undefined,{code:'Space'});send(b.fire,'pointerdown',2);send(b.fire,'keyup',undefined,{code:'Space'});assert.equal(s.fire,true);
  send(b.fire,'pointerup',2);assert.equal(s.fire,false);
  send(b.thrust,'keydown',undefined,{code:'Enter'});assert.equal(s.thrust,true);
  send(b.thrust,'blur');assert.equal(s.thrust,false);
});
