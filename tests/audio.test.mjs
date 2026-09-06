import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {AudioSystem} from '../src/audio.js';

const originals={Audio:globalThis.Audio,AudioContext:globalThis.AudioContext,fetch:globalThis.fetch};
class Media {
  constructor(){this.paused=true;this.currentTime=0;this.src='';this.calls=0;}
  canPlayType(){return 'probably';}
  play(){this.calls++;this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
}
class Context {
  constructor(){this.state='suspended';}
  createGain(){return {gain:{value:0},connect(){}};}
  resume(){this.state='running';return Promise.resolve();}
  decodeAudioData(){return Promise.resolve({});}
}
beforeEach(()=>{
  globalThis.Audio=Media;globalThis.AudioContext=Context;
  globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)});
});
afterEach(()=>{for(const [key,value] of Object.entries(originals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
function audio(){
  const a=new AudioSystem();a.manifest={music:[{number:2,title:'Chromosphere',ogg:'music02.ogg',mp3:'music02.mp3'},{number:3,title:'Next',ogg:'music03.ogg',mp3:'music03.mp3'}],sfx:[{slot:0,name:'shot',wav:'shot.wav'}]};return a;
}
test('launch starts music synchronously before context resume or effects finish loading',async()=>{
  let resume;Context.prototype.resume=function(){return new Promise(resolve=>{resume=()=>{this.state='running';resolve();};});};
  const a=audio(),unlock=a.unlock(2);
  assert.equal(a.music.calls,1);assert.match(a.music.src,/music02.ogg$/);assert.equal(a.buffers.size,0);
  resume();await unlock;assert.equal(a.buffers.size,1);assert.equal(a.status.playing,true);
  Context.prototype.resume=function(){this.state='running';return Promise.resolve();};
});
test('blocked playback is visible and can be retried directly on the next gesture',async()=>{
  const a=audio();a.music.play=function(){this.calls++;return Promise.reject(Object.assign(Error('Tap required'),{name:'NotAllowedError'}));};
  await a.playMusic(2);assert.equal(a.blocked,true);assert.equal(a.status.error.name,'NotAllowedError');
  a.music.play=Media.prototype.play;await a.resume();assert.equal(a.blocked,false);assert.equal(a.status.error,null);assert.equal(a.music.paused,false);
});
test('duplicate level-start request preserves pending playback and same-track position',async()=>{
  const a=audio();let finish;a.music.play=function(){this.calls++;return new Promise(resolve=>finish=resolve);};
  const first=a.playMusic(2),second=a.playMusic(2);assert.equal(first,second);assert.equal(a.music.calls,1);
  finish();await first;a.music.currentTime=12;a.music.play=Media.prototype.play;await a.playMusic(2);assert.equal(a.music.currentTime,12);
});
test('pause invalidates late errors, and resume restarts both audio systems',async()=>{
  const a=audio();let reject;a.music.play=()=>new Promise((_,r)=>reject=r);const pending=a.playMusic(2);a.pause();reject(Object.assign(Error('interrupted'),{name:'AbortError'}));await pending;
  assert.equal(a.lastError,null);assert.equal(a.music.paused,true);
  a.ctx=new Context();a.music.play=Media.prototype.play;await a.resume();assert.equal(a.ctx.state,'running');assert.equal(a.music.paused,false);
});
test('stale track failure cannot overwrite successful playback of the new level track',async()=>{
  const a=audio();let reject;a.music.play=()=>new Promise((_,r)=>reject=r);const old=a.playMusic(2);
  a.music.play=Media.prototype.play;await a.playMusic(3);reject(Object.assign(Error('old track blocked'),{name:'NotAllowedError'}));await old;
  assert.equal(a.track,3);assert.equal(a.blocked,false);assert.equal(a.lastError,null);
});
test('muting and the archive suppress playback; unsupported Ogg selects MP3',async()=>{
  const a=audio();a.music.canPlayType=()=>'';a.mute();assert.equal(a.music.muted,true);
  await a.playMusic(2);assert.equal(a.music.calls,0);assert.match(a.music.src,/music02.mp3$/);
  a.mute();assert.equal(a.music.muted,false);a.archiveOpen=true;await a.resume();assert.equal(a.music.calls,0);
  a.archiveOpen=false;await a.resume();assert.equal(a.music.calls,1);
});
test('non-policy playback errors are retained in independent diagnostic snapshots',async()=>{
  const a=audio();a.music.play=()=>Promise.reject(Object.assign(Error('Unsupported source'),{name:'NotSupportedError'}));
  await a.playMusic(2);assert.equal(a.blocked,false);const s=a.status;assert.equal(s.error.name,'NotSupportedError');s.error.name='changed';assert.equal(a.lastError.name,'NotSupportedError');
});
