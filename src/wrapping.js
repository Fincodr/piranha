export const WIDTH=320,HEIGHT=200;
export const wrap=(value,max)=>((value%max)+max)%max;

// Up to four visible pieces of one anchored sprite. Use the same rounded
// top-left as the renderer and masks; corner crossings need both offsets.
export function forEachWrappedPosition(x,y,ox,oy,w,h,visit){
  x=wrap(x,WIDTH);y=wrap(y,HEIGHT);
  const left=Math.round(x-ox),top=Math.round(y-oy);
  const dx=left<0?WIDTH:left+w>WIDTH?-WIDTH:0;
  const dy=top<0?HEIGHT:top+h>HEIGHT?-HEIGHT:0;
  visit(x,y);
  if(dx)visit(x+dx,y);
  if(dy)visit(x,y+dy);
  if(dx&&dy)visit(x+dx,y+dy);
}
