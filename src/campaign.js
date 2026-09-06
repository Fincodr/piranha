import {LEVELS,LEVEL_CODE,ROCK_VELOCITIES} from './campaign-data.js';
export {LEVELS};
const REG={eax:['eax',0,32],ax:['eax',0,16],al:['eax',0,8],ah:['eax',8,8],ebx:['ebx',0,32],bx:['ebx',0,16],bl:['ebx',0,8],bh:['ebx',8,8],ecx:['ecx',0,32],cx:['ecx',0,16],cl:['ecx',0,8],ch:['ecx',8,8],edx:['edx',0,32],dx:['edx',0,16],dl:['edx',0,8],dh:['edx',8,8]};
export const FIELD={hp:0x45d12,vx:0x49342,vy:0x49782,kind:0x48df2,size:0x49012,update:0x4b322,weapon:0x4ca82,speed:0x4cf26,direction:0x4a112,frame:0x467b2,frameCount:0x468c2,animationDelay:0x469d2,animationTimer:0x46ae2};
// Only recovered level instructions run here. Host calls cannot access the DOM,
// files, network, or arbitrary JavaScript. Unknown instructions/calls fail closed.
export class Campaign {
 constructor(game){this.game=game;this.memory=new DataView(new ArrayBuffer(0xa0000));this.reg={eax:0,ebx:0,ecx:0,edx:0};this.enemyVariants={};this.velocityIndex=0;this.compare=0;}
 get(address,size=4){return size===1?this.memory.getUint8(address):size===2?this.memory.getUint16(address,true):this.memory.getUint32(address,true);}
 set(address,value,size=4){if(size===1)this.memory.setUint8(address,value);else if(size===2)this.memory.setUint16(address,value,true);else this.memory.setUint32(address,value,true);this.game.scriptWrite?.(address,this.get(address,size),size);}
 register(name,value){const [base,shift,bits]=REG[name];const mask=bits===32?0xffffffff:2**bits-1;if(value===undefined)return (this.reg[base]>>>shift)&mask;this.reg[base]=((this.reg[base]&~(mask<<shift))|((value&mask)<<shift))>>>0;}
 address(o){return o[2]+(o[3]?this.register(o[3]):0)+(o[4]?this.register(o[4])*o[5]:0);}
 read(o){return typeof o==='number'?o:o[0]==='r'?this.register(o[1]):this.get(this.address(o),o[1]);}
 write(o,v){if(o[0]==='r')this.register(o[1],v);else this.set(this.address(o),v,o[1]);}
 run(entry){
  let pc=entry;const stack=[];
  for(let budget=0;budget<12000;budget++){
   const ins=LEVEL_CODE[pc];if(!ins)throw Error(`Unknown campaign address ${pc.toString(16)}`);
   const [op,next,a,b]=ins;pc=next;
   switch(op){
    case 'nop':break;
    case 'mov':this.write(a,this.read(b));break;
    case 'add':this.write(a,this.read(a)+this.read(b));break;
    case 'sub':this.write(a,this.read(a)-this.read(b));break;
    case 'inc':this.write(a,this.read(a)+1);break;
    case 'dec':this.write(a,this.read(a)-1);break;
    case 'cmp':this.compare=(this.read(a)>>>0)-(this.read(b)>>>0);break;
    case 'je':if(this.compare===0)pc=a;break;
    case 'jne':if(this.compare!==0)pc=a;break;
    case 'jb':if(this.compare<0)pc=a;break;
    case 'ja':if(this.compare>0)pc=a;break;
    case 'jae':if(this.compare>=0)pc=a;break;
    case 'jbe':if(this.compare<=0)pc=a;break;
    case 'jmp':pc=a;break;
    case 'call':if(LEVEL_CODE[a]){stack.push(pc);pc=a;}else this.host(a);break;
    case 'ret':if(!stack.length)return;pc=stack.pop();break;
    default:throw Error(`Unsupported campaign operation ${op}`);
   }
  }
  throw Error('Campaign instruction budget exceeded');
 }
 velocity(){this.velocityIndex=(this.velocityIndex+1)%500;return ROCK_VELOCITIES[this.velocityIndex];}
 host(address){
  switch(address){
   case 0x5544c:case 0x50b7b:break; // Scene selection is stored by the original script.
   case 0x51aff:this.enemyVariants[this.get(0x51a24,1)]=this.get(0x51a20);break;
   case 0x3d62f:this.set(0x4f3f8,this.velocity());this.set(0x4f3f4,this.velocity());break;
   case 0x5f0b9:{
    const signed=v=>(v<<16)>>16;
    const id=this.game.scriptSpawn(this.register('al'),this.register('ah'),signed(this.register('dx')),signed(this.register('cx')));
    if(id<0)throw Error('Campaign actor pool exhausted');
    this.register('ebx',id+3);break;
   }
   case 0x4fade:this.game.pickups.configure(this.register('eax'));break;
   case 0x5d150:this.game.clearEncounter();break; // Stage transition clears actors.
   case 0x90d29:break; // Level-19 pattern queue call remains unported; pickups use recovered patterns 21–26.
   default:throw Error(`Unmapped campaign host call ${address.toString(16)}`);
  }
 }
 tick(){this.run(this.get(0x5070f));}
 get pending(){
  const callback=this.get(0x5070f);
  return !!this.get(0x5070e,1)||(callback===0x214c9&&this.get(0x21362)>0)||callback===0x23052;
 }
 increment(address){this.set(address,this.get(address,1)+1,1);}
 defeated(kind,size){this.increment(kind===1?0x50706+size:0x50705);}
}
