import {WIDTH,HEIGHT,wrap,forEachWrappedPosition} from './wrapping.js';
export {WIDTH,HEIGHT,wrap};
export const TICK=1/70;
export const Kind={ROCK:1, ENEMY:2, COIN:3};
export const DIFFICULTIES=Object.freeze({easy:200,normal:100});
export const delta=(a,b,max)=>wrap(a-b+max/2,max)-max/2;
const TAU=Math.PI*2;
// Projectile callback 0x5978C calls 0x59F4B: delete outside these
// bounds. DOS coordinates are 16.16 values biased by 1100 pixels.
const SHOT_MARGIN=50;
export function residualRotation(frame,steps){
  if(!steps)return 0;
  const whole=Math.floor(frame),index=((whole%steps.length)+steps.length)%steps.length;
  return (frame-whole)*steps[index];
}
import {Shop} from './shop.js';
import {PickupSystem,PICKUPS} from './pickups.js';
import {RANDOM_DIGITS,EXHAUST_OFFSETS,EXHAUST_VELOCITIES} from './original-data.js';
import {Campaign,FIELD,LEVELS} from './campaign.js';
import {CollisionWorld} from './collision.js';
export {LEVELS};
export class Pool {
  constructor(capacity) {
    this.capacity=capacity;this.generation=new Uint32Array(capacity);this.sourceGeneration=new Uint32Array(capacity);this.active=new Uint8Array(capacity);this.kind=new Uint8Array(capacity);
    for(const key of ['x','y','vx','vy','age','life','hp','angle','spin','cooldown','size','variant','owner','damage','scriptType','part','behavior','weapon','shotType','source','pickup','frameOffset','animationFrame','animationDelay','animationTimer','animationAge'])this[key]=new Float32Array(capacity);
    this.count=0;this.cursor=0;
  }
  add(kind,x,y) {
    if(this.count>=this.capacity)return -1;
    for(let n=0;n<this.capacity;n++) {
      const i=(this.cursor+n)%this.capacity;
      if(this.active[i])continue;
      for(const key of ['vx','vy','age','life','hp','angle','spin','cooldown','size','variant','owner','damage','scriptType','part','behavior','weapon','shotType','source','pickup','frameOffset','animationFrame','animationDelay','animationTimer','animationAge'])this[key][i]=0;
      this.generation[i]++;this.sourceGeneration[i]=0;this.active[i]=1;this.kind[i]=kind;this.x[i]=x;this.y[i]=y;this.count++;this.cursor=(i+1)%this.capacity;return i;
    }
    return -1;
  }
  remove(i){if(this.active[i]){this.active[i]=0;this.count--;}}
  clear(){this.active.fill(0);this.count=0;this.cursor=0;}
  hostileCount(){let n=0;for(let i=0;i<this.capacity;i++)if(this.active[i]&&(this.kind[i]===Kind.ROCK||this.kind[i]===Kind.ENEMY))n++;return n;}
}
export class Game {
  constructor(onEvent=()=>{},masks=null) {
    this.collision=masks?new CollisionWorld(masks):null;
    this.onEvent=onEvent;this.actors=new Pool(264);this.shots=new Pool(512);this.effects=new Pool(1024);
    this.pickups=new PickupSystem(this);this.shop=new Shop(this);this.digitIndex=0;this.shakeTime=0;this.shakeDuration=0;this.shakePower=0;this.flashTime=0;
    this.state='title';this.players=[];this.level=1;this.score=0;this.credits=0;this.elapsed=0;this.seed=1996;this.difficulty='easy';
  }
  get tickDuration(){return TICK;}
  originalDigit(){this.digitIndex=(this.digitIndex+1)%RANDOM_DIGITS.length;return RANDOM_DIGITS[this.digitIndex];}
  shake(power,duration){this.shakePower=Math.max(this.shakePower,power);this.shakeTime=Math.max(this.shakeTime,duration);this.shakeDuration=this.shakeTime;}
  get cameraOffset(){if(!this.shakeTime)return [0,0];const power=this.shakeDuration?this.shakePower*this.shakeTime/this.shakeDuration:0;return [Math.round(Math.sin(this.levelTicks*2.4)*power),Math.round(Math.cos(this.levelTicks*1.7)*power)];}
  get maxHealth(){return DIFFICULTIES[this.difficulty];}
  random(){let x=this.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x;return (x>>>0)/4294967296;}
  start(count=1,level=1,difficulty='easy') {
    if(!LEVELS[level-1])throw Error('This level has not been translated yet');
    if(!this.collision)throw Error('Collision masks must be loaded before starting');
    if(!Object.hasOwn(DIFFICULTIES,difficulty))throw Error('Unknown difficulty');
    this.difficulty=difficulty;
    this.seed=1996;this.digitIndex=0;this.score=0;this.credits=0;this.elapsed=0;this.playerCount=count;
    this.players=Array.from({length:count},(_,i)=>({x:160+(i-(count-1)/2)*36,y:100,vx:0,vy:0,angle:0,hp:this.maxHealth,lives:3,cooldown:0,invincible:2,thrust:false,dead:false,weapon:1,ammoLevel:0,engineLevel:0}));
    this.loadLevel(level);
  }
  loadLevel(level) {
    this.pickups.patterns.length=0;this.shakeTime=this.shakeDuration=this.shakePower=this.flashTime=0;
    this.level=level;this.config=LEVELS[level-1];this.actors.clear();this.shots.clear();this.effects.clear();this.time=0;this.levelTicks=0;this.clearTime=0;
    this.state='playing';this.campaign=new Campaign(this);
    this.campaign.run(Number(this.config.entry));
    for(let i=0;i<this.players.length;i++){let p=this.players[i];p.x=this.campaign.get(0x44cfc+i*4,2)||160+(i-(this.players.length-1)/2)*36;p.y=this.campaign.get(0x44cfe+i*4,2)||100;p.vx=p.vy=0;p.invincible=2;}
    this.prepareCollisions();this.collision.draw();this.collision.beginDebugTick();
    this.onEvent('level',level);
  }
  pause(){if(this.state==='playing'){this.state='paused';this.onEvent('pause');}else if(this.state==='paused'){this.state='playing';this.onEvent('resume');}}
  insertCoin() {
    if(this.state!=='gameover')return false;
    for(let i=0;i<this.players.length;i++) {
      const p=this.players[i];
      p.x=160+(i-(this.players.length-1)/2)*36;p.y=100;
      p.vx=p.vy=p.angle=p.cooldown=0;p.thrust=false;
      p.hp=this.maxHealth;p.lives=3;p.dead=false;p.invincible=2.5;
    }
    // Keep the current encounter and pending waves; remove incoming fire for re-entry.
    this.shots.clear();this.effects.clear();this.pickups.patterns.length=0;this.shakeTime=this.flashTime=0;this.clearTime=0;
    this.state='playing';this.prepareCollisions();this.collision.draw();this.onEvent('continue');return true;
  }
  next(){if(this.state!=='cleared')return;if(this.level===LEVELS.length){this.state='complete';this.onEvent('complete');}else this.loadLevel(this.level+1);}
  spawnRock(variant,size,x,y,vx,vy) {
    const a=this.actors,i=a.add(Kind.ROCK,x,y);if(i<0)return;
    a.variant[i]=variant;a.size[i]=size;a.vx[i]=vx;a.vy[i]=vy;
    // 0x6096F / 0x59A09: initial timer zero, then a frame every delay+1 ticks.
    const roll=this.originalDigit()+1;a.animationDelay[i]=roll>=3?1:roll;
    a.spin[i]=(this.originalDigit()>=5?-1:1)*TAU/(64*(a.animationDelay[i]+1)*TICK);
    a.hp[i]=[1000,300,180,50][size];a.behavior[i]=0x599f6;return i;
  }
  clearEncounter(){this.actors.clear();this.shots.clear();this.effects.clear();this.pickups.patterns.length=0;}
  get remainingPickups(){let count=0;const a=this.actors;for(let i=0;i<a.capacity;i++)if(a.active[i]&&a.kind[i]===Kind.COIN)count++;return count;}
  get pickupSecondsLeft(){let time=0;const a=this.actors;for(let i=0;i<a.capacity;i++)if(a.active[i]&&a.kind[i]===Kind.COIN)time=Math.max(time,a.life[i]-a.age[i]);return Math.ceil(time);}
  get waitingForPickups(){return this.state==='playing'&&!this.campaign.pending&&this.completionCount()===0&&this.remainingPickups>0;}
  get remainingSpawns(){return this.campaign.get(0x21362);}
  get spawnTimer(){return this.campaign.get(0x2134e);}
  scriptWrite(address,value,size){
    const a=this.actors;
    for(const [base,field,convert] of [[FIELD.hp,'hp',v=>v],[FIELD.vx,'vx',v=>(v|0)/65536/TICK],[FIELD.vy,'vy',v=>(v|0)/65536/TICK],[FIELD.update,'behavior',v=>v]]){
      const slot=(address-base)/4-3;
      if(size===4&&Number.isInteger(slot)&&slot>=0&&slot<a.capacity&&a.active[slot]){a[field][slot]=convert(value);return;}
    }
    const slot=address-FIELD.weapon-3;
    if(size===1&&slot>=0&&slot<a.capacity&&a.active[slot])a.weapon[slot]=value;
  }
  scriptSpawn(type,size,x,y){
    const c=this.campaign,a=this.actors,vx=(c.get(0x4f3f8)|0)/65536/TICK,vy=(c.get(0x4f3f4)|0)/65536/TICK;
    let i;
    if(type===30)i=this.spawnRock(c.get(0x50a94),size-1,x,y,vx,vy);
    else if(type===80){
      i=a.add(Kind.ENEMY,x,y);if(i<0)return i;
      const variant=c.enemyVariants[size],part=c.get(0x44e2a,1)||1;
      if(size===1)a.variant[i]=variant===2?1:0;
      else if(size===4)a.variant[i]=(variant===2?[13,14,15]:[11,5,12])[part-1];
      else if(size===5)a.variant[i]=part===1?6:16;
      else throw Error(`Unsupported campaign enemy class ${size}`);
      a.part[i]=part;a.vx[i]=vx;a.vy[i]=vy;a.cooldown[i]=1.5;
      a.hp[i]=size===4?50:size===5?2000:150;
      a.behavior[i]=size===1?0x5885b:size===4?0x578c4:0x578e1;
    }else throw Error(`Unsupported campaign actor ${type}`);
    if(i===undefined||i<0)return -1;
    a.scriptType[i]=size;
    const slot=i+3;
    c.set(FIELD.kind+slot,type,1);c.set(FIELD.size+slot,size,1);
    c.set(FIELD.hp+slot*4,a.hp[i]);c.set(FIELD.update+slot*4,a.behavior[i]||0x599f6);
    c.set(FIELD.weapon+slot,0,1);c.set(FIELD.speed+slot,size===1?3:12,1);
    c.set(FIELD.direction+slot,3,1);c.set(FIELD.animationDelay+slot,type===30?a.animationDelay[i]:size===5?3:2,1);c.set(FIELD.animationTimer+slot,0,1);
    c.set(FIELD.frame+slot,0,1);c.set(FIELD.frameCount+slot,size===5?32:64,1);
    return i;
  }
  updateRock(i){
    const a=this.actors;if(!a.spin[i])return;
    if(a.animationTimer[i]){a.animationTimer[i]--;a.animationAge[i]++;}
    else{a.animationTimer[i]=a.animationDelay[i];a.animationAge[i]=0;a.animationFrame[i]=wrap(a.animationFrame[i]+Math.sign(a.spin[i]),64);}
  }
  emitExhaust(p){
    const frame=Math.floor(p.angle/TAU*64)%64,[dx,dy]=EXHAUST_OFFSETS[frame],[vx,vy]=EXHAUST_VELOCITIES[frame];
    const e=this.effects,i=e.add(4,p.x+dx,p.y+dy);if(i<0)return;
    e.vx[i]=p.vx+vx/65536/TICK;e.vy[i]=p.vy+vy/65536/TICK;e.life[i]=8*TICK;
  }
  updateEnemy(i,dt){
    const a=this.actors,c=this.campaign,slot=i+3,p=this.players.find(p=>!p.dead);
    // The final boss callback retires its remaining visual part by setting
    // its frame to the frame count (0x3609F–0x360A5).
    if(c.get(FIELD.frame+slot,1)>=c.get(FIELD.frameCount+slot,1)){
      a.remove(i);c.set(FIELD.kind+slot,0,1);return;
    }
    // Animation counters are shared with the original level-19 staging script.
    let timer=c.get(FIELD.animationTimer+slot,1);
    if(timer)c.set(FIELD.animationTimer+slot,timer-1,1);
    else{c.set(FIELD.animationTimer+slot,c.get(FIELD.animationDelay+slot,1),1);c.set(FIELD.frame+slot,(c.get(FIELD.frame+slot,1)+1)%c.get(FIELD.frameCount+slot,1),1);}
    if(a.behavior[i]!==0x599f6&&p){
      if(a.scriptType[i]===1){
        const direction=c.get(FIELD.direction+slot,1);
        const angle=(direction-1)*Math.PI/4;
        // Route steering remains a browser approximation; source entry edges,
        // direction codes, weapon selection, and callback timing are retained.
        a.vx[i]=Math.sin(angle)*28;a.vy[i]=-Math.cos(angle)*28;
        if(c.get(0x5070f)===0x214c9){a.vx[i]=28;a.vy[i]=Math.sin(a.age[i]*1.8)*19+12;}
      }else if(a.scriptType[i]===4){
        const angle=Math.atan2(p.x-a.x[i],p.y-a.y[i]);a.vx[i]+=Math.sin(angle)*dt*35;a.vy[i]+=Math.cos(angle)*dt*35;
        const speed=Math.hypot(a.vx[i],a.vy[i]);if(speed>42){a.vx[i]*=42/speed;a.vy[i]*=42/speed;}
      }
    }
    a.cooldown[i]-=dt;
    if(a.weapon[i]>0&&a.cooldown[i]<=0&&p&&a.x[i]>=0&&a.x[i]<=WIDTH&&a.y[i]>=0&&a.y[i]<=HEIGHT){
      const angle=Math.atan2(delta(p.x,a.x[i],WIDTH),-delta(p.y,a.y[i],HEIGHT));
      this.shoot(a.x[i],a.y[i],angle,-1,0,0,15,a.weapon[i],i+1);a.cooldown[i]=2;
    }
  }
  firePlayer(k){
    const p=this.players[k];
    // The muzzle crosses the seam independently of the ship's origin.
    const x=wrap(p.x+Math.sin(p.angle)*12,WIDTH),y=wrap(p.y-Math.cos(p.angle)*12,HEIGHT);
    for(const offset of p.weapon>=2?[-.14,0,.14]:[0]){
      const angle=p.angle+offset,id=this.shoot(x,y,angle,k,p.vx*.5,p.vy*.5,35,p.weapon>=3?6:1);
      if(id!==undefined){const extra=190*.2*p.ammoLevel;this.shots.vx[id]+=Math.sin(angle)*extra;this.shots.vy[id]-=Math.cos(angle)*extra;}
    }
    p.cooldown=.16;this.onEvent('shot');
  }
  shoot(x,y,angle,owner,vx=0,vy=0,damage=35,shotType=1,source=0) {
    const s=this.shots,i=s.add(owner<0?2:1,x,y);if(i<0)return;
    const speed=owner<0?65:190;s.vx[i]=Math.sin(angle)*speed+vx;s.vy[i]=-Math.cos(angle)*speed+vy;s.angle[i]=angle;s.owner[i]=owner;s.damage[i]=damage;s.shotType[i]=shotType;s.source[i]=source;s.sourceGeneration[i]=source?this.actors.generation[source-1]:0;s.life[i]=owner<0?3:1.15;return i;
  }
  burst(x,y,big=true) {
    const e=this.effects,i=e.add(big?1:2,x,y);if(i>=0)e.life[i]=.65;
    for(let j=0;j<12;j++){const n=e.add(3,x,y);if(n<0)break;let a=this.random()*TAU,s=10+this.random()*45;e.vx[n]=Math.cos(a)*s;e.vy[n]=Math.sin(a)*s;e.life[n]=.2+this.random()*.5;}
  }
  destroy(i,owner=0) {
    const a=this.actors;if(!a.active[i])return;
    const kind=a.kind[i],x=a.x[i],y=a.y[i],size=a.size[i],variant=a.variant[i],vx=a.vx[i],vy=a.vy[i],type=a.scriptType[i],part=a.part[i];a.remove(i);
    this.campaign.set(FIELD.kind+i+3,0,1);this.campaign.defeated(kind,size);
    this.burst(x,y,size<2);this.score+=kind===Kind.ENEMY?500:[1000,300,100,50][size];this.onEvent('explosion');
    this.pickups.drop(kind,size,x,y,vx,vy);
    if(kind===Kind.ROCK&&size<3) {
      // Original normal breakup counts: 3 medium, then 4 small, then 4 tiny.
      for(let k=0;k<[3,4,4][size];k++){const angle=this.random()*TAU;this.spawnRock(variant,size+1,x+(k?4:-4),y,vx*.65+Math.cos(angle)*25,vy*.65+Math.sin(angle)*25);}
    } else if(kind===Kind.ENEMY&&type===4&&part===2){
      // 0x5DA9E / 0x5DC21–0x5DCFD: medium mines release four small
      // mines. Level 4 waits for all five kills before the next wave.
      const c=this.campaign;c.set(0x44e2a,1,1);
      for(const [dx,dy] of [[-10,-5],[10,-5],[-5,5],[5,5]]){
        c.set(0x4f3f8,c.velocity());c.set(0x4f3f4,c.velocity());this.scriptSpawn(80,4,x+dx,y+dy);
      }
    }
  }
  damagePlayer(p,damage,asteroid=false) {
    if(p.invincible>0||p.dead)return;
    p.hp-=damage;p.invincible=.75;if(asteroid)this.shake(2.5,.22);this.onEvent('hit');
    if(p.hp<=0){this.burst(p.x,p.y);p.lives--;p.hp=this.maxHealth;p.x=160;p.y=100;p.vx=p.vy=0;p.invincible=2.5;if(p.lives<=0)p.dead=true;}
    if(this.players.every(p=>p.dead)){this.state='gameover';this.onEvent('gameover');}
  }
  update(dt,inputs=[]) {
    if(this.state!=='playing')return;
    this.collision.beginDebugTick();
    this.time+=dt;this.elapsed+=dt;this.levelTicks++;
    this.shakeTime=Math.max(0,this.shakeTime-dt);if(!this.shakeTime)this.shakePower=0;this.flashTime=Math.max(0,this.flashTime-dt);
    this.campaign.tick();this.pickups.tick();
    for(let k=0;k<this.players.length;k++) {
      const p=this.players[k],input=inputs[k]||{};if(p.dead)continue;
      p.invincible=Math.max(0,p.invincible-dt);p.cooldown-=dt;p.angle=wrap(p.angle+((input.right?1:0)-(input.left?1:0))*3.5*dt,TAU);p.thrust=!!input.thrust;
      if(input.thrust){const acceleration=95*(1+.2*p.engineLevel);p.vx+=Math.sin(p.angle)*acceleration*dt;p.vy-=Math.cos(p.angle)*acceleration*dt;}
      const drag=Math.exp(-(input.brake?4:0.16)*dt);p.vx*=drag;p.vy*=drag;
      const speed=Math.hypot(p.vx,p.vy),maxSpeed=95*(1+.15*p.engineLevel);if(speed>maxSpeed){p.vx*=maxSpeed/speed;p.vy*=maxSpeed/speed;}
      p.x=wrap(p.x+p.vx*dt,WIDTH);p.y=wrap(p.y+p.vy*dt,HEIGHT);
      if(input.fire&&p.cooldown<=0)this.firePlayer(k);
      if(input.thrust)this.emitExhaust(p);
    }
    const a=this.actors,s=this.shots,e=this.effects;
    for(let i=0;i<a.capacity;i++) {
      if(!a.active[i])continue;a.age[i]+=dt;
      if(a.kind[i]===Kind.ROCK)this.updateRock(i);
      if(a.kind[i]===Kind.ENEMY)this.updateEnemy(i,dt);
      if(!a.active[i])continue;
      a.x[i]+=a.vx[i]*dt;a.y[i]+=a.vy[i]*dt;
      // Sprite gutters preserve the original offscreen entry at (-50,-50).
      if(a.x[i]>WIDTH+50)a.x[i]=-50;if(a.x[i]<-50)a.x[i]=WIDTH+50;
      if(a.y[i]>HEIGHT+50)a.y[i]=-50;if(a.y[i]<-50)a.y[i]=HEIGHT+50;
      if(a.kind[i]===Kind.COIN&&a.age[i]>=a.life[i]){a.remove(i);continue;}
    }
    this.prepareCollisions();
    const world=this.collision;
    for(let i=0;i<a.capacity;i++)if(a.active[i]){
      for(let k=0;k<this.players.length;k++){
        const p=this.players[k];if(p.dead)continue;
        if(world.touchesPlayer(i+1,k)){
          if(a.kind[i]===Kind.COIN){this.pickups.collect(i,k);this.prepareCollisions();break;}
          this.damagePlayer(p,a.kind[i]===Kind.ROCK?30:20,a.kind[i]===Kind.ROCK);
          // Death can respawn the player at a different position immediately.
          this.placePlayer(k);
        }
      }
    }
    world.draw();
    for(let i=0;i<s.capacity;i++) {
      if(!s.active[i])continue;s.age[i]+=dt;
      if(s.age[i]>=s.life[i]){s.remove(i);continue;}
      const x=s.x[i],y=s.y[i],dx=s.vx[i]*dt,dy=s.vy[i]*dt;
      const key=this.shotKey(i),mask=world.masks.get(key,this.shotFrame(i));
      // Sample the travel path at <= 1 px per axis so small silhouettes
      // cannot be skipped. Bullets leave the screen without wrapping.
      const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))));
      let hit=0;
      for(let n=0;n<=steps;n++){
        s.x[i]=x+dx*n/steps;s.y[i]=y+dy*n/steps;
        if(s.x[i]<-SHOT_MARGIN||s.x[i]>WIDTH+SHOT_MARGIN||s.y[i]<-SHOT_MARGIN||s.y[i]>HEIGHT+SHOT_MARGIN){s.remove(i);break;}
        const source=s.source[i]&&a.generation[s.source[i]-1]===s.sourceGeneration[i]?s.source[i]:0;
        hit=world.hit(mask,s.x[i],s.y[i],source,s.owner[i]>=0);
        if(hit)break;
      }
      if(!hit)continue;
      s.remove(i);
      let changed=false;
      if(hit>=265){
        const p=this.players[hit-265],lives=p.lives;
        this.damagePlayer(p,s.damage[i]);changed=p.lives!==lives;
      }else if(s.owner[i]>=0){
        const j=hit-1;a.hp[j]-=s.damage[i];this.campaign.set(FIELD.hp+(j+3)*4,Math.max(0,a.hp[j]));
        if(a.hp[j]<=0){this.destroy(j,s.owner[i]);changed=true;}
        else{const n=e.add(2,s.x[i],s.y[i]);if(n>=0)e.life[n]=.18;}
      }
      // Hostile fire is absorbed by other solid actors without friendly
      // damage. Rebuild after a hit to reflect deaths, splits and respawns.
      if(changed){this.prepareCollisions();world.draw();}
    }
    for(let i=0;i<e.capacity;i++)if(e.active[i]){e.age[i]+=dt;if(e.age[i]>=e.life[i])e.remove(i);else{e.x[i]+=e.vx[i]*dt;e.y[i]+=e.vy[i]*dt;}}
    if(this.state!=='playing')return;
    if(!this.campaign.pending&&this.completionCount()===0&&this.remainingPickups===0){this.clearTime+=dt;if(this.clearTime>1){this.state='cleared';this.onEvent('cleared');}}else this.clearTime=0;
  }
  completionCount(){
    const mask=this.campaign.get(0x5070d,1),a=this.actors;let count=0;
    for(let i=0;i<a.capacity;i++)if(a.active[i]&&((a.kind[i]===Kind.ROCK&&(mask&1))||(a.kind[i]===Kind.ENEMY&&(mask&2))))count++;
    return count;
  }
  actorKey(i){const a=this.actors;return a.kind[i]===Kind.ROCK?`rock${a.variant[i]}${'abcd'[a.size[i]]}`:a.kind[i]===Kind.ENEMY?`enemy${a.variant[i]}`:(PICKUPS[a.pickup[i]||1]?.key||'coin');}
  actorFrame(i,renderAhead){
    const a=this.actors;
    if(a.kind[i]!==Kind.ROCK)return a.age[i]*(a.kind[i]===Kind.ENEMY?12:1/(3*TICK));
    const phase=renderAhead===undefined||!a.spin[i]?0:Math.sign(a.spin[i])*(a.animationAge[i]+renderAhead/TICK)/(a.animationDelay[i]+1);
    return a.animationFrame[i]+phase;
  }
  shotKey(i){return ({1:'shot',3:'enemyShot',5:'fireball',6:'energyShot'})[this.shots.shotType[i]]||'shot';}
  shotFrame(i){const key=this.shotKey(i);return key==='energyShot'||key==='fireball'?this.shots.frameOffset[i]+this.shots.age[i]*30:this.shots.angle[i]/TAU*this.collision.masks.groups[key].length;}
  placePlayer(k){
    const p=this.players[k];
    if(p.dead){this.collision.bodies[265+k].mask=null;return;}
    this.collision.set(265+k,`ship${k+1}`,p.angle/TAU*64,p.x,p.y);
  }
  prepareCollisions(){
    const a=this.actors,w=this.collision;w.clear();
    for(let i=0;i<a.capacity;i++)if(a.active[i])w.set(i+1,this.actorKey(i),this.actorFrame(i),a.x[i],a.y[i],a.kind[i]!==Kind.COIN);
    for(let k=0;k<this.players.length;k++)this.placePlayer(k);
  }
  renderWrapped(r,key,frame,x,y){
    const ids=r.data.groups[key],id=ids[wrap(Math.floor(frame),ids.length)],f=r.data.frames[id];
    forEachWrappedPosition(x,y,f[4],f[5],f[2],f[3],(px,py)=>r.sprite(key,frame,px,py));
  }
  render(r,renderAhead=0) {
    r.begin();const a=this.actors,s=this.shots,e=this.effects;
    const ahead=this.state==='playing'?Math.max(0,Math.min(renderAhead,TICK)):0;
    for(let i=0;i<a.capacity;i++)if(a.active[i]){
      const key=this.actorKey(i),frame=this.actorFrame(i,ahead);
      const rotation=a.kind[i]===Kind.ROCK?residualRotation(frame,r.data.rockRotation?.[key]):0;
      r.sprite(key,frame,a.x[i],a.y[i],1,1,rotation);
    }
    for(let i=0;i<s.capacity;i++)if(s.active[i])r.sprite(this.shotKey(i),this.shotFrame(i),s.x[i],s.y[i]);
    for(let i=0;i<e.capacity;i++)if(e.active[i]){
      if(e.kind[i]<3)r.sprite(e.kind[i]===1?'explosion':'smallExplosion',e.age[i]/e.life[i]*29,e.x[i],e.y[i]);
      else if(e.kind[i]===4)this.renderWrapped(r,'exhaust',Math.min(11,4+Math.floor(e.age[i]/TICK+1e-6)),e.x[i],e.y[i]);
      else r.rect(e.x[i],e.y[i],1,1,1,.8,.3,1-e.age[i]/e.life[i]);
    }
    for(let i=0;i<this.players.length;i++){
      const p=this.players[i];if(p.dead||(p.invincible>0&&Math.floor(p.invincible*12)%2))continue;
      this.renderWrapped(r,`ship${i+1}`,p.angle/TAU*64,p.x,p.y);
      if(this.players.length>1)forEachWrappedPosition(p.x-2,p.y+16,0,0,4,1,(x,y)=>r.rect(x,y,4,1,i===0?1:.4,i===1?1:.5,i===2?1:.3));
    }
    if(this.flashTime>0)r.rect(0,0,WIDTH,HEIGHT,1,.9,.7,.25*this.flashTime/.12);
    r.end();
  }
}
