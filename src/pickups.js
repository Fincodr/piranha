import {DROP_PROFILES,MYSTERY_VELOCITIES} from './original-data.js';

export const PICKUP_LIFETIME=24;
export const PICKUPS={
  1:{key:'coin',label:'+10 credits',value:10},2:{key:'coin50',label:'+50 credits',value:50},3:{key:'coin100',label:'+100 credits',value:100},
  4:{key:'mystery',label:'Mystery'},5:{key:'bomb',label:'Shockwave'},6:{key:'power',label:'Weapon upgrade'},
  7:{key:'energy',label:'Energy restored'},8:{key:'health',label:'Extra ship'},
};
const DROP_BASES=[0x502bd,0x5033c,0x503bb,0x5043a,0x504b9];
export class PickupSystem {
  constructor(game){this.game=game;this.patterns=[];}
  configure(profile){
    const tables=DROP_PROFILES[profile],c=this.game.campaign;
    if(!tables)throw Error(`Unknown original drop profile ${profile}`);
    // 0x4FADE loads drop schedules, including lengths. Level callbacks can
    // subsequently replace individual entries and reset their cursors.
    for(let n=0;n<5;n++){
      c.set(0x50538+n,tables[n].length,1);
      for(let i=0;i<tables[n].length;i++)c.set(DROP_BASES[n]+i,tables[n][i],1);
    }
  }
  resolve(code){
    const digit=()=>this.game.originalDigit();let roll;
    if(code===10){
      roll=digit()+1;
      if(roll<7)return roll<=3?roll:0;
      if(roll===8)return digit()+1<2?8:7;
      if(roll===9)return digit()+1<=5?5:0;
      return digit()+1<=3?4:0;
    }
    if(code===11){
      roll=digit()+1;
      if(roll===8)return digit()+1<2?8:7;
      if(roll===9&&digit()+1<=5)return 5;
      if(roll===10&&digit()+1<=5)return 4;
      do{roll=digit()+1;}while(roll>3);
      return roll;
    }
    return PICKUPS[code]?code:0;
  }
  drop(kind,size,x,y,vx,vy){
    const c=this.game.campaign,table=kind===1?size:4;
    const length=c.get(0x50538+table,1);if(!length)return;
    let cursor=c.get(0x5053d+table,1);if(cursor>=length)cursor=0;
    const type=this.resolve(c.get(DROP_BASES[table]+cursor,1));c.set(0x5053d+table,cursor+1,1);
    if(type)this.spawn(type,x,y,vx*.2,vy*.2);
  }
  spawn(type,x,y,vx=0,vy=0){
    if(!PICKUPS[type])throw Error(`Unknown pickup ${type}`);
    const a=this.game.actors,i=a.add(3,x,y);if(i<0)return -1;
    a.pickup[i]=type;a.life[i]=PICKUP_LIFETIME;a.vx[i]=vx;a.vy[i]=vy;return i;
  }
  collect(i,owner){
    const g=this.game,a=g.actors,type=a.pickup[i]||1,p=g.players[owner],x=a.x[i],y=a.y[i];
    if(!a.active[i]||a.kind[i]!==3||!p||p.dead)return false;
    a.remove(i);let label=PICKUPS[type].label;
    if(type<=3){g.credits+=PICKUPS[type].value;g.score+=PICKUPS[type].value;}
    if(type===4){
      // 0x90C29 chooses fireball type 5/6 and pattern 21..26. The
      // recovered shake belongs to the bomb pickup, not this handler.
      const weapon=g.originalDigit()<5?5:6;let pattern;
      do{pattern=g.originalDigit()+21;}while(pattern>26);
      this.startPattern(x,y,owner,weapon,pattern);label='Mystery · fireball burst';
    }
    if(type===5)this.bomb(owner);
    if(type===6){p.weapon=Math.min(3,p.weapon+1);label=`Weapon level ${p.weapon}`;}
    if(type===7)p.hp=Math.min(g.maxHealth,p.hp+100);
    if(type===8)for(const pilot of g.players)if(!pilot.dead&&pilot.lives>0)pilot.lives++;
    g.onEvent('pickup',label);return true;
  }
  bomb(owner){
    const g=this.game,a=g.actors;g.shake(5,.6);g.flashTime=.12;
    // Original 0x5CE67: 50 damage, at most 11 eligible rocks/mines (and
    // Enemy.H, not yet in the campaign). Snapshot IDs before breakup.
    const targets=[];
    for(let i=0;i<a.capacity&&targets.length<11;i++)if(a.active[i]&&(a.kind[i]===1||(a.kind[i]===2&&a.scriptType[i]===4)))targets.push([i,a.generation[i]]);
    for(const [i,generation] of targets){
      if(!a.active[i]||a.generation[i]!==generation)continue;
      a.hp[i]-=50;g.campaign.set(0x45d12+(i+3)*4,Math.max(0,a.hp[i]));
      if(a.hp[i]<=0)g.destroy(i,owner);
    }
  }
  startPattern(x,y,owner,weapon,pattern){
    if(this.patterns.length>=32)return;
    this.patterns.push({x,y,owner,weapon,pattern,index:0});
  }
  tick(){
    const g=this.game;
    for(let n=this.patterns.length-1;n>=0;n--){
      const p=this.patterns[n],ring=p.pattern===23||p.pattern===24;
      const step=({21:8,22:4,23:8,24:4,25:10,26:4})[p.pattern];
      const limit=p.pattern===25?128:p.pattern===26?132:64;
      const count=ring?64/step:1;
      for(let j=0;j<count&&p.index+step<=limit;j++){
        const [fx,fy]=MYSTERY_VELOCITIES[p.index];p.index+=step;
        const vx=fx/65536/g.tickDuration,vy=fy/65536/g.tickDuration;
        const id=g.shoot(p.x,p.y,Math.atan2(vx,-vy),p.owner,0,0,150,p.weapon);
        if(id!==undefined){g.shots.vx[id]=vx;g.shots.vy[id]=vy;g.shots.frameOffset[id]=10;g.shots.life[id]=3;}
      }
      if(ring||p.index+step>limit)this.patterns.splice(n,1);
    }
  }
}
