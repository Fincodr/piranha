import {SHOP_PRICES} from './original-data.js';
import {LEVELS} from './campaign.js';

export const SHOP_ITEMS=Object.freeze([
 {id:'repair',name:'Hull repair',key:'energy',priceIndex:1,description:'Restore 50 hull points, up to full health.'},
 {id:'ship',name:'Extra ship',key:'health',priceIndex:0,description:'Add one spare ship. Brings an eliminated pilot back.'},
 {id:'weapon',name:'Weapon upgrade',key:'power',priceIndex:8,description:'Single shot → yellow spread → energy spread.'},
 {id:'ammo',name:'Ammunition speed',key:'shot',priceIndex:3,description:'+20% shot speed per upgrade. Three upgrades available.'},
 {id:'engine',name:'Ship speed',key:'ship1',priceIndex:4,description:'+20% thrust and +15% top speed per upgrade. Three upgrades available.'},
]);
export class Shop {
 constructor(game){this.game=game;}
 open(){const g=this.game;if(g.state!=='cleared'||g.level>=LEVELS.length)return false;g.state='shop';g.onEvent('shop');return true;}
 close(){const g=this.game;if(g.state!=='shop')return false;g.state='cleared';g.onEvent('cleared');return true;}
 quote(id,pilot=0){
  const g=this.game,item=SHOP_ITEMS.find(item=>item.id===id),p=Number.isInteger(pilot)?g.players[pilot]:null;
  if(!item||!p)return {available:false,reason:'Choose a valid item and pilot',price:0};
  // 0x7C5D3..0x7C619 select the original price table by living crew size.
  const crew=Math.max(1,g.players.filter(p=>!p.dead&&p.lives>0).length);
  const index=item.priceIndex+(id==='weapon'?Math.max(0,p.weapon-1):0);
  const price=SHOP_PRICES[crew-1][index];let reason='';
  if(g.state!=='shop')reason='Shop opens between levels';
  else if(id!=='ship'&&(p.dead||p.lives<=0))reason='Buy an extra ship first';
  else if(id==='repair'&&p.hp>=g.maxHealth)reason='Hull is full';
  else if(id==='weapon'&&p.weapon>=3)reason='Fully upgraded';
  else if((id==='ammo'&&p.ammoLevel>=3)||(id==='engine'&&p.engineLevel>=3))reason='Fully upgraded';
  else if(g.credits<price)reason='Not enough credits';
  return {available:!reason,reason,price};
 }
 buy(id,pilot=0){
  const g=this.game,quote=this.quote(id,pilot);if(!quote.available)return {ok:false,...quote};
  const p=g.players[pilot];g.credits-=quote.price;
  if(id==='repair')p.hp=Math.min(g.maxHealth,p.hp+50);
  if(id==='ship'){p.lives++;if(p.dead){p.dead=false;p.hp=g.maxHealth;p.vx=p.vy=0;p.invincible=2.5;}}
  if(id==='weapon')p.weapon++;
  if(id==='ammo')p.ammoLevel++;
  if(id==='engine')p.engineLevel++;
  const name=SHOP_ITEMS.find(item=>item.id===id).name;g.onEvent('purchase',`Pilot ${pilot+1} · ${name}`);
  return {ok:true,price:quote.price};
 }
}
