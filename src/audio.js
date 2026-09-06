export class AudioSystem {
  constructor(){this.enabled=true;this.volume=.55;this.buffers=new Map();this.voices=new Set();this.music=new Audio();this.music.loop=true;this.music.preload='none';this.track=0;this.manifest=null;this.archiveOpen=false;}
  async init(){const res=await fetch('assets/audio/manifest.json');if(!res.ok)throw Error('Audio manifest unavailable');this.manifest=await res.json();return this.manifest;}
  async unlock(){
    if(!this.ctx){this.ctx=new AudioContext();this.gain=this.ctx.createGain();this.gain.connect(this.ctx.destination);this.updateVolume();}
    await this.ctx.resume();
    if(!this.loading)this.loading=Promise.all(this.manifest.sfx.map(async s=>{const res=await fetch(`assets/audio/${s.wav}`);if(!res.ok)throw Error(`Missing effect ${s.name}`);this.buffers.set(s.slot,await this.ctx.decodeAudioData(await res.arrayBuffer()));}));
    await this.loading;
  }
  updateVolume(){this.music.volume=this.enabled?this.volume*.5:0;if(this.gain)this.gain.gain.value=this.enabled?this.volume*.4:0;}
  setVolume(value){this.volume=value;this.updateVolume();}
  mute(){this.enabled=!this.enabled;this.updateVolume();return this.enabled;}
  playMusic(number){
    if(!this.manifest)return;
    if(this.track!==number){const track=this.manifest.music.find(t=>t.number===number);if(!track)return;this.track=number;this.music.src=`assets/audio/${this.music.canPlayType('audio/ogg; codecs="vorbis"')?track.ogg:track.mp3}`;}
    this.updateVolume();if(!this.archiveOpen&&this.enabled)this.music.play().catch(()=>{});
  }
  pause(){this.music.pause();for(const voice of this.voices)try{voice.stop();}catch{}this.voices.clear();}
  resume(){if(!this.archiveOpen&&this.enabled&&this.track)this.music.play().catch(()=>{});}
  effect(slot,rate=null){
    if(!this.enabled||!this.ctx||this.ctx.state!=='running'||this.archiveOpen||this.voices.size>=24)return;
    const buffer=this.buffers.get(slot);if(!buffer)return;
    const source=this.ctx.createBufferSource();source.buffer=buffer;
    const info=this.manifest.sfx.find(s=>s.slot===slot);if(rate)source.playbackRate.value=rate/info.rate;
    source.connect(this.gain);this.voices.add(source);source.onended=()=>this.voices.delete(source);source.start();
  }
}
