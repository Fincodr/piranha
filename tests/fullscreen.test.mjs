import test from 'node:test';
import assert from 'node:assert/strict';
import {FullscreenView} from '../src/fullscreen.js';

function node(){return {classList:{values:new Set(),toggle(key,on){on?this.values.add(key):this.values.delete(key);}},style:{values:{},setProperty(key,value){this.values[key]=value;},removeProperty(key){delete this.values[key];}},setAttribute(key,value){this[key]=value;}};}
function setup({touch=true,landscape=false,native='missing'}={}){
  const win=new EventTarget(),doc=new EventTarget(),cabinet=node(),button=node();
  const orientation=Object.assign(new EventTarget(),{matches:landscape}),coarse=Object.assign(new EventTarget(),{matches:touch});
  Object.assign(win,{navigator:{maxTouchPoints:touch?1:0},matchMedia:q=>q.includes('orientation')?orientation:coarse,scrollX:0,scrollY:320,innerWidth:844,innerHeight:390,scrollTo(x,y){this.restored=[x,y];}});
  win.visualViewport=Object.assign(new EventTarget(),{width:844,height:330,offsetTop:0,offsetLeft:0});
  doc.documentElement=node();doc.fullscreenElement=null;doc.fullscreenEnabled=native!=='missing';let requests=0;
  if(native!=='missing')cabinet.requestFullscreen=async()=>{requests++;if(native==='denied')throw Error('Denied');doc.fullscreenElement=cabinet;doc.dispatchEvent(new Event('fullscreenchange'));};
  doc.exitFullscreen=async()=>{doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));};
  const view=new FullscreenView(win,doc,cabinet,button);
  return {win,doc,cabinet,button,view,get requests(){return requests;},rotate(value){orientation.matches=value;orientation.dispatchEvent(new Event('change'));}};
}
test('touch landscape automatically expands only during a flight, without requesting native fullscreen',()=>{
  const s=setup({native:'supported'});s.rotate(true);assert.equal(s.view.expanded,false);
  s.view.setActive(true);assert.equal(s.view.source,'auto');assert.equal(s.requests,0);
  assert.ok(s.doc.documentElement.classList.values.has('viewport-mode'));
  s.view.setActive(false);assert.equal(s.view.expanded,false);assert.deepEqual(s.win.restored,[0,320]);
});
test('portrait restores the page; rotating back expands again',()=>{
  const s=setup({landscape:true});s.view.setActive(true);s.rotate(false);
  assert.equal(s.view.expanded,false);assert.equal(s.doc.documentElement.classList.values.has('viewport-mode'),false);
  s.rotate(true);assert.equal(s.view.source,'auto');
});
test('Exit is respected during repeated HUD updates until the next rotation',async()=>{
  const s=setup({landscape:true});s.view.setActive(true);await s.view.toggle();
  for(let i=0;i<10;i++)s.view.setActive(true);
  assert.equal(s.view.expanded,false);assert.equal(s.button['aria-pressed'],'false');
  s.rotate(false);s.rotate(true);assert.equal(s.view.expanded,true);
});
test('Expand falls back when native fullscreen is missing or rejected',async()=>{
  for(const native of ['missing','denied']){
    const s=setup({native});await s.view.toggle();assert.equal(s.view.source,'manual');
    assert.equal(s.button['aria-pressed'],'true');await s.view.toggle();assert.equal(s.view.expanded,false);
    assert.deepEqual(s.win.restored,[0,320]);
  }
});
test('explicit native fullscreen works and browser exit does not trigger automatic reentry',async()=>{
  const s=setup({native:'supported',landscape:true});await s.view.toggle();
  assert.equal(s.view.native,true);assert.equal(s.view.source,null);assert.equal(s.requests,1);
  s.view.setActive(true);await s.doc.exitFullscreen();s.view.setActive(true);assert.equal(s.view.expanded,false);
});
test('desktop landscape never automatically expands',()=>{
  const s=setup({touch:false,landscape:true});s.view.setActive(true);assert.equal(s.view.expanded,false);
});
test('visual viewport changes resize the fallback around browser bars and clean up on exit',async()=>{
  const s=setup();await s.view.toggle();assert.equal(s.cabinet.style.values['--play-height'],'330px');
  s.win.visualViewport.height=300;s.win.visualViewport.offsetTop=5;s.win.visualViewport.dispatchEvent(new Event('resize'));
  assert.equal(s.cabinet.style.values['--play-height'],'300px');assert.equal(s.cabinet.style.values['--play-top'],'5px');
  await s.view.exit();assert.deepEqual(s.cabinet.style.values,{});
});
