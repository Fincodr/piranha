import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from './helpers.mjs';
import {TICK} from '../src/game.js';
import {SHOP_PRICES} from '../src/original-data.js';
const shop=(crew=1,difficulty='easy')=>{const g=new Game();g.start(crew,1,difficulty);g.clearEncounter();g.state='cleared';g.credits=10000;assert.equal(g.shop.open(),true);return g;};

test('shop price tables match the recovered single/co-op original data',()=>{
 const bytes=readFileSync(new URL('../../unpacked/MAIN.FLAT',import.meta.url));
 for(let crew=0;crew<3;crew++)for(let item=0;item<16;item++)assert.equal(SHOP_PRICES[crew][item],bytes.readUInt32LE(0x7b03d+crew*64+item*4));
 for(let crew=1;crew<=3;crew++){const g=shop(crew);assert.equal(g.shop.quote('ship').price,SHOP_PRICES[crew-1][0]);assert.equal(g.shop.quote('repair').price,SHOP_PRICES[crew-1][1]);}
});
test('shop only opens between supported levels and freezes the simulation',()=>{
 const g=new Game();g.start();
 for(const state of ['title','playing','paused','gameover','complete']){g.state=state;assert.equal(g.shop.open(),false);assert.equal(g.shop.buy('ship').ok,false);}
 g.state='cleared';g.level=20;assert.equal(g.shop.open(),false);g.level=1;assert.equal(g.shop.open(),true);
 const before=g.time;g.update(30,[{thrust:true,fire:true}]);assert.equal(g.time,before);assert.equal(g.shots.count,0);
 assert.equal(g.shop.close(),true);assert.equal(g.state,'cleared');assert.equal(g.shop.close(),false);
});
test('buying validates funds and item/pilot eligibility without charging on rejection',()=>{
 const g=shop();g.credits=24;g.players[0].hp=100;const before=JSON.stringify(g.players);
 for(const [id,pilot] of [['repair',0],['invalid',0],['ship',9],['ship',.5]])assert.equal(g.shop.buy(id,pilot).ok,false);
 assert.equal(g.credits,24);assert.equal(JSON.stringify(g.players),before);
 g.credits=25;assert.equal(g.shop.buy('repair').ok,true);assert.equal(g.credits,0);assert.equal(g.players[0].hp,150);
 assert.equal(g.shop.buy('repair').ok,false);assert.equal(g.credits,0);
});
test('repair respects both difficulty caps and cannot charge for a full hull',()=>{
 for(const difficulty of ['easy','normal']){
  const g=shop(1,difficulty),p=g.players[0];assert.equal(g.shop.buy('repair').ok,false);
  p.hp=g.maxHealth-20;assert.equal(g.shop.buy('repair').ok,true);assert.equal(p.hp,g.maxHealth);
  const credits=g.credits;assert.equal(g.shop.buy('repair').ok,false);assert.equal(g.credits,credits);
 }
});
test('co-op purchases affect the chosen pilot, use shared credits, and can revive an eliminated pilot',()=>{
 const g=shop(3),[a,b,c]=g.players;b.hp=70;c.hp=0;c.lives=0;c.dead=true;
 const initial=g.credits,price=g.shop.quote('repair',1).price;
 assert.equal(g.shop.buy('repair',1).ok,true);assert.equal(b.hp,120);assert.equal(a.hp,200);assert.equal(g.credits,initial-price);
 assert.equal(g.shop.buy('weapon',2).ok,false);assert.equal(g.shop.buy('ship',2).ok,true);
 assert.equal(c.dead,false);assert.equal(c.lives,1);assert.equal(c.hp,200);assert.equal(a.lives,3);
 assert.equal(g.shop.quote('ship').price,SHOP_PRICES[2][0]);
});
test('weapon and speed upgrades reach their caps and change actual firing and movement',()=>{
 const g=shop(),p=g.players[0];
 for(let n=0;n<2;n++)assert.equal(g.shop.buy('weapon').ok,true);assert.equal(p.weapon,3);assert.equal(g.shop.buy('weapon').ok,false);
 for(let n=0;n<3;n++){assert.equal(g.shop.buy('ammo').ok,true);assert.equal(g.shop.buy('engine').ok,true);}
 assert.equal(g.shop.buy('ammo').ok,false);assert.equal(g.shop.buy('engine').ok,false);
 g.shop.close();g.next();g.clearEncounter();p.x=160;p.y=100;p.vx=p.vy=0;p.angle=0;
 g.firePlayer(0);assert.equal(g.shots.count,3);const center=1;assert.ok(Math.abs(g.shots.vy[center]+304)<.001);assert.equal(g.shotKey(center),'energyShot');
 g.update(TICK,[{thrust:true}]);assert.ok(-p.vy>95*TICK);
 assert.equal(p.ammoLevel,3);assert.equal(p.engineLevel,3);
});
test('purchases carry across levels and coin continuation; starting a selected level is a fresh run',()=>{
 const g=shop();g.shop.buy('weapon');g.shop.buy('ammo');g.shop.buy('engine');g.shop.buy('ship');const credits=g.credits;
 g.shop.close();g.next();assert.equal(g.level,2);assert.equal(g.credits,credits);assert.equal(g.players[0].lives,4);
 const p=g.players[0];p.lives=1;p.invincible=0;g.damagePlayer(p,1000);g.insertCoin();
 assert.equal(p.weapon,2);assert.equal(p.ammoLevel,1);assert.equal(p.engineLevel,1);
 g.start(2,17,'normal');assert.equal(g.level,17);assert.equal(g.credits,0);assert.equal(g.players.length,2);
 assert.ok(g.players.every(p=>p.weapon===1&&p.ammoLevel===0&&p.engineLevel===0&&p.lives===3&&p.hp===100));
});
