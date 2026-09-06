import {WIDTH,HEIGHT,forEachWrappedPosition} from './wrapping.js';
// CPU-only collision data. One bit per source pixel on disk; row spans are
// decoded once for fast ID-layer fills. No canvas/WebGL pixel readback.
export class CollisionMasks {
  constructor(data, bytes) {
    this.groups=data.groups;
    this.sources=data.collision?.sources||{};
    if(!data.collision||bytes.length!==data.collision.bytes)throw Error('Invalid collision assets');
    this.frames=data.collision.frames.map(info=>{
      if(!info)return null;
      const [offset,w,h,ox,oy,radius]=info,stride=(w+7)>>3;
      if(offset+stride*h>bytes.length)throw Error('Truncated collision mask');
      const bits=bytes.subarray(offset,offset+stride*h),spans=[];
      for(let y=0;y<h;y++)for(let x=0;x<w;){
        if(!(bits[y*stride+(x>>3)]&(1<<(x&7)))){x++;continue;}
        const start=x++;
        while(x<w&&(bits[y*stride+(x>>3)]&(1<<(x&7))))x++;
        spans.push(y,start,x);
      }
      return {w,h,ox,oy,radius,stride,bits,spans:new Uint16Array(spans)};
    });
  }
  get(key,frame){
    const ids=this.groups[key];
    if(!ids)throw Error(`Missing collision group ${key}`);
    const mask=this.frames[ids[((Math.floor(frame)%ids.length)+ids.length)%ids.length]];
    if(!mask)throw Error(`Missing collision mask ${key}`);
    return mask;
  }
}

export function place(body,mask,x,y){
  body.mask=mask;body.x=x;body.y=y;
  body.left=Math.round(x-mask.ox);body.top=Math.round(y-mask.oy);
  return body;
}
export function circlesOverlap(a,b){
  const dx=a.x-b.x,dy=a.y-b.y,r=a.mask.radius+b.mask.radius;
  return dx*dx+dy*dy<=r*r;
}
function solid(mask,x,y){return mask.bits[y*mask.stride+(x>>3)]&(1<<(x&7));}
export function masksOverlap(a,b,clipToScreen=false){
  if(!a.mask||!b.mask||!circlesOverlap(a,b))return false;
  const left=Math.max(a.left,b.left,clipToScreen?0:-Infinity),right=Math.min(a.left+a.mask.w,b.left+b.mask.w,clipToScreen?WIDTH:Infinity);
  const top=Math.max(a.top,b.top,clipToScreen?0:-Infinity),bottom=Math.min(a.top+a.mask.h,b.top+b.mask.h,clipToScreen?HEIGHT:Infinity);
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    if(solid(a.mask,x-a.left,y-a.top)&&solid(b.mask,x-b.left,y-b.top))return true;
  }
  return false;
}

export class CollisionWorld {
  constructor(masks){
    this.masks=masks;this.gutter=128;this.width=320+2*this.gutter;this.height=200+2*this.gutter;
    this.layer=new Uint16Array(this.width*this.height);
    // Zero is empty; actors 1..264, players 265..267. Record order is
    // render order, so players overwrite actor IDs only at solid pixels.
    this.bodies=Array.from({length:268},()=>({mask:null,x:0,y:0,left:0,top:0}));
    // Copies share the pilot's ID; they are placements, not extra actors.
    this.playerBodies=Array.from({length:3},(_,k)=>[this.bodies[265+k],{},{},{}]);
    this.playerCopies=new Uint8Array(3);
    this.blocking=new Uint8Array(268);this.candidates=new Uint8Array(268);this.projectile={};
    this.debug=null;
  }
  setDebug(enabled){this.debug=enabled?{tick:{},hits:[]}:null;this.beginDebugTick();}
  beginDebugTick(){if(this.debug)for(const key of ['shotQueries','circleTests','layerPixels','projectileHits','contactChecks','contactHits'])this.debug.tick[key]=0;}
  clear(){this.playerCopies.fill(0);this.blocking.fill(0);for(const body of this.bodies)body.mask=null;}
  set(id,key,frame,x,y,blocking=true){
    const mask=this.masks.get(key,frame);
    place(this.bodies[id],mask,x,y);this.blocking[id]=blocking?1:0;
    if(id>=265){
      const k=id-265;let count=0;
      forEachWrappedPosition(x,y,mask.ox,mask.oy,mask.w,mask.h,(px,py)=>place(this.playerBodies[k][count++],mask,px,py));
      this.playerCopies[k]=count;
    }
  }
  touchesPlayer(actorId,k){
    if(!this.bodies[265+k].mask)return false;
    for(let n=0;n<this.playerCopies[k];n++){
      if(this.debug)this.debug.tick.contactChecks++;
      if(masksOverlap(this.bodies[actorId],this.playerBodies[k][n],true)){if(this.debug)this.debug.tick.contactHits++;return true;}
    }
    return false;
  }
  stamp(id,b,clipToScreen=false){
    const spans=b.mask.spans,gutter=this.gutter;
    const minX=clipToScreen?gutter:0,maxX=clipToScreen?gutter+WIDTH:this.width;
    const minY=clipToScreen?gutter:0,maxY=clipToScreen?gutter+HEIGHT:this.height;
    for(let n=0;n<spans.length;n+=3){
      const y=b.top+spans[n]+gutter;if(y<minY||y>=maxY)continue;
      const left=Math.max(minX,b.left+spans[n+1]+gutter),right=Math.min(maxX,b.left+spans[n+2]+gutter);
      if(left<right)this.layer.fill(id,y*this.width+left,y*this.width+right);
    }
  }
  draw(){
    this.layer.fill(0);
    for(let id=1;id<this.bodies.length;id++){
      const b=this.bodies[id];if(!b.mask||!this.blocking[id])continue;
      if(id<265)this.stamp(id,b);
      else for(let n=0;n<this.playerCopies[id-265];n++)this.stamp(id,this.playerBodies[id-265][n],true);
    }
  }
  hit(mask,x,y,source=0,playerShot=false){
    const debug=this.debug;if(debug)debug.tick.shotQueries++;
    const shot=place(this.projectile,mask,x,y);let possible=false;
    this.candidates.fill(0);
    for(let id=1;id<this.bodies.length;id++){
      const b=this.bodies[id];
      // Keep co-op friendly fire disabled and exclude the firing actor.
      if(id===source||(playerShot&&id>=265)||!this.blocking[id]||!b.mask)continue;
      if(id<265){if(debug)debug.tick.circleTests++;if(circlesOverlap(shot,b)){this.candidates[id]=1;possible=true;}}
      else for(let n=0;n<this.playerCopies[id-265];n++){
        if(debug)debug.tick.circleTests++;
        if(circlesOverlap(shot,this.playerBodies[id-265][n])){this.candidates[id]=1;possible=true;break;}
      }
    }
    if(!possible)return 0;
    const spans=mask.spans;
    for(let n=0;n<spans.length;n+=3){
      const py=shot.top+spans[n]+this.gutter;if(py<0||py>=this.height)continue;
      const left=Math.max(0,shot.left+spans[n+1]+this.gutter),right=Math.min(this.width,shot.left+spans[n+2]+this.gutter);
      for(let px=left;px<right;px++){
        if(debug)debug.tick.layerPixels++;
        const id=this.layer[py*this.width+px];if(this.candidates[id]){
          if(debug){debug.tick.projectileHits++;debug.hits.push({id,source,playerShot,x:px-this.gutter,y:py-this.gutter,shotX:x,shotY:y});if(debug.hits.length>32)debug.hits.shift();}
          return id;
        }
      }
    }
    return 0;
  }
}
