import {SHOP_ITEMS} from './shop.js';

export class ShopUI {
 constructor(game,atlas,data,onNext=()=>{}){
  this.game=game;this.dialog=document.getElementById('shop-dialog');this.pilot=document.getElementById('shop-pilot');this.cards=new Map();
  for(const item of SHOP_ITEMS){
   const card=document.createElement('article');card.className='shop-item';
   const icon=document.createElement('canvas');icon.width=icon.height=40;icon.className='shop-icon';icon.setAttribute('aria-hidden','true');
   const f=data.frames[data.groups[item.key][0]],ctx=icon.getContext('2d');ctx.imageSmoothingEnabled=false;
   const scale=Math.min(2,36/f[2],36/f[3]);ctx.drawImage(atlas,f[0],f[1],f[2],f[3],Math.round((40-f[2]*scale)/2),Math.round((40-f[3]*scale)/2),f[2]*scale,f[3]*scale);
   const copy=document.createElement('div'),name=document.createElement('h3'),description=document.createElement('p');name.textContent=item.name;description.textContent=item.description;copy.append(name,description);
   const action=document.createElement('div');action.className='shop-item-action';const button=document.createElement('button'),reason=document.createElement('small');reason.id=`shop-reason-${item.id}`;button.setAttribute('aria-describedby',reason.id);button.dataset.item=item.id;
   button.addEventListener('click',()=>{const result=game.shop.buy(item.id,Number(this.pilot.value));document.getElementById('shop-message').textContent=result.ok?`${item.name} purchased for Pilot ${Number(this.pilot.value)+1}.`:result.reason;this.render();});
   action.append(button,reason);card.append(icon,copy,action);document.getElementById('shop-items').append(card);this.cards.set(item.id,{button,reason});
  }
  this.pilot.addEventListener('change',()=>{document.getElementById('shop-message').textContent='';this.render();});
  document.getElementById('shop-close').addEventListener('click',()=>this.dialog.close());
  this.dialog.addEventListener('close',()=>{if(game.shop.close())document.getElementById('overlay-action')?.focus();});
  document.getElementById('shop-next').addEventListener('click',()=>{if(game.state!=='shop')return;game.shop.close();this.dialog.close();game.next();onNext();});
 }
 show(){
  this.pilot.textContent='';this.game.players.forEach((p,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`Pilot ${i+1}`;this.pilot.append(option);});
  this.pilot.value=String(Math.max(0,this.game.players.findIndex(p=>!p.dead)));
  document.getElementById('shop-message').textContent='';document.getElementById('shop-next').textContent=`Launch level ${this.game.level+1}`;
  this.render();this.dialog.showModal();this.dialog.scrollTop=0;document.getElementById('shop-close').focus({preventScroll:true});
 }
 render(){
  const g=this.game,p=g.players[Number(this.pilot.value)];document.getElementById('shop-credits').textContent=g.credits.toLocaleString();
  document.getElementById('shop-status').textContent=p.dead?'Pilot eliminated · an extra ship returns them to flight.':`Hull ${Math.ceil(p.hp)}/${g.maxHealth} · ${p.lives} ship${p.lives===1?'':'s'} · Weapon ${p.weapon}/3 · Ammo speed +${p.ammoLevel*20}% · Thrust +${p.engineLevel*20}%`;
  for(const item of SHOP_ITEMS){const quote=g.shop.quote(item.id,Number(this.pilot.value)),card=this.cards.get(item.id);card.button.textContent=`Buy · ${quote.price} credits`;card.button.setAttribute('aria-label',`Buy ${item.name} for ${quote.price} credits`);card.button.disabled=!quote.available;card.reason.textContent=quote.reason;}
 }
}
