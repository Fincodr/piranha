// Automatic landscape mode uses CSS: native fullscreen requires user activation.
export class FullscreenView {
  constructor(win,doc,cabinet,button,onChange=()=>{}){
    Object.assign(this,{win,doc,cabinet,button,onChange});
    this.active=false;this.source=null;this.suppressed=false;this.busy=false;this.wasNative=false;
    this.landscape=win.matchMedia('(orientation: landscape)');
    this.coarse=win.matchMedia('(any-pointer: coarse)');
    this.landscape.addEventListener('change',()=>{
      this.suppressed=false;
      if(!this.landscape.matches)this.setFallback(null);
      this.onChange();this.sync();
    });
    this.coarse.addEventListener('change',()=>this.sync());
    doc.addEventListener('fullscreenchange',()=>{
      if(this.wasNative&&!this.native)this.suppressed=true;
      this.wasNative=this.native;this.sync();this.onChange();
    });
    win.addEventListener('resize',()=>this.size());
    win.visualViewport?.addEventListener('resize',()=>this.size());
    win.visualViewport?.addEventListener('scroll',()=>this.size());
    this.sync();
  }
  get native(){return this.doc.fullscreenElement===this.cabinet;}
  get expanded(){return this.native||!!this.source;}
  setActive(value){if(value&&!this.active)this.suppressed=false;this.active=value;this.sync();}
  sync(){
    const touch=this.coarse.matches||this.win.navigator.maxTouchPoints>0;
    this.cabinet.classList.toggle('touch-device',touch);
    if(this.native)this.setFallback(null);
    else if(!this.source||this.source==='auto')this.setFallback(this.active&&touch&&this.landscape.matches&&!this.suppressed?'auto':null);
    this.button.innerHTML=this.expanded?'↙ <span>Exit</span>':'⛶ <span>Expand</span>';
    this.button.title=this.expanded?'Exit expanded view (F)':'Expand game (F)';
    this.button.setAttribute('aria-label',this.button.title);
    this.button.setAttribute('aria-pressed',String(this.expanded));
  }
  size(){
    if(!this.source)return;
    const v=this.win.visualViewport;
    this.cabinet.style.setProperty('--play-height',`${v?.height??this.win.innerHeight}px`);
    this.cabinet.style.setProperty('--play-width',`${v?.width??this.win.innerWidth}px`);
    this.cabinet.style.setProperty('--play-top',`${v?.offsetTop??0}px`);
    this.cabinet.style.setProperty('--play-left',`${v?.offsetLeft??0}px`);
  }
  setFallback(source){
    if(this.source===source)return;
    const entering=!this.source&&source,leaving=this.source&&!source;
    if(entering)this.scroll=[this.win.scrollX,this.win.scrollY];
    this.source=source;
    this.cabinet.classList.toggle('expanded',!!source);
    this.doc.documentElement.classList.toggle('viewport-mode',!!source);
    if(source)this.size();
    else{
      for(const key of ['height','width','top','left'])this.cabinet.style.removeProperty(`--play-${key}`);
      if(leaving)this.win.scrollTo(...this.scroll);
    }
    this.onChange();
  }
  async exit(){
    this.suppressed=true;this.setFallback(null);
    if(this.native){try{await this.doc.exitFullscreen();}catch{/* Browser may already have exited. */}}
    this.sync();
  }
  async toggle(){
    if(this.busy)return;
    if(this.expanded){await this.exit();return;}
    this.busy=true;
    try{
      if(this.cabinet.requestFullscreen&&this.doc.fullscreenEnabled!==false){
        try{await this.cabinet.requestFullscreen();}
        catch{this.setFallback('manual');}
      }else this.setFallback('manual');
    }finally{this.busy=false;this.sync();}
  }
}
