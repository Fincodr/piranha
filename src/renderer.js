// One padded atlas, reusable vertex storage, one draw call for all gameplay sprites.
const VS = `attribute vec2 a_position; attribute vec2 a_uv; attribute vec4 a_color;
uniform vec2 u_resolution; varying vec2 v_uv; varying vec4 v_color;
void main(){gl_Position=vec4(a_position/u_resolution*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);v_uv=a_uv;v_color=a_color;}`;
const FS = `precision mediump float; uniform sampler2D u_texture; varying vec2 v_uv; varying vec4 v_color;
void main(){gl_FragColor=texture2D(u_texture,v_uv)*v_color;}`;
export async function loadImage(url) {
  const image = new Image(); image.src = url; await image.decode(); return image;
}
export class Renderer {
  constructor(canvas, atlas, data) {
    this.canvas=canvas; this.data=data; this.count=0; this.drawCalls=0;
    this.gl=canvas.getContext('webgl', {alpha:false, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:false});
    if (!this.gl) { this.ctx=canvas.getContext('2d',{alpha:false}); this.ctx.imageSmoothingEnabled=false; this.atlas=atlas; this.name='Canvas 2D'; return; }
    this.name='WebGL'; const gl=this.gl;
    const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,VS));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);gl.uniform2f(gl.getUniformLocation(this.program,'u_resolution'),320,200);
    gl.uniform1i(gl.getUniformLocation(this.program,'u_texture'),0);
    this.vertices=new Float32Array(4096*6*8);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.vertices.byteLength,gl.DYNAMIC_DRAW);
    for (const [name,size,offset] of [['a_position',2,0],['a_uv',2,8],['a_color',4,16]]) {
      const at=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,32,offset);
    }
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.atlasTexture=this.texture(atlas);this.textureWidth=data.width;this.textureHeight=data.height;
  }
  texture(image) {
    const gl=this.gl,t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);return t;
  }
  setBackground(image) {
    this.background=image;
    if(this.gl){ if(this.backgroundTexture)this.gl.deleteTexture(this.backgroundTexture);this.backgroundTexture=this.texture(image); }
  }
  begin() {
    this.count=0;this.drawCalls=0;
    if(!this.gl){this.ctx.globalAlpha=1;this.ctx.drawImage(this.background,0,0,320,200);return;}
    const gl=this.gl;gl.viewport(0,0,320,200);gl.bindTexture(gl.TEXTURE_2D,this.backgroundTexture);
    this.quad(0,0,320,200,0,0,1,1);this.flush();gl.bindTexture(gl.TEXTURE_2D,this.atlasTexture);
  }
  quad(x,y,w,h,u,v,u2,v2,r=1,g=1,b=1,a=1,rotation=0,pivotX=0,pivotY=0) {
    if(this.count>=4096)this.flush();
    const arr=this.vertices,cos=rotation?Math.cos(rotation):1,sin=rotation?Math.sin(rotation):0;let p=this.count++*48;
    for(let corner=0;corner<6;corner++){
      const right=corner===1||corner===4||corner===5, bottom=corner===2||corner===3||corner===5;
      let px=right?x+w:x,py=bottom?y+h:y;
      if(rotation){const dx=px-pivotX,dy=py-pivotY;px=pivotX+dx*cos-dy*sin;py=pivotY+dx*sin+dy*cos;}
      arr[p++]=px;arr[p++]=py;arr[p++]=right?u2:u;arr[p++]=bottom?v2:v;arr[p++]=r;arr[p++]=g;arr[p++]=b;arr[p++]=a;
    }
  }
  sprite(key,frame,x,y,scale=1,alpha=1,rotation=0) {
    const ids=this.data.groups[key];if(!ids)return;
    const id=ids[((Math.floor(frame)%ids.length)+ids.length)%ids.length];const [sx,sy,w,h,ox,oy]=this.data.frames[id];
    // ox/oy are recovered per-frame hotspot-minus-trim offsets, not w/2,h/2.
    x=Math.round(x-ox*scale);y=Math.round(y-oy*scale);
    if(rotation){
      // Rotate around the recovered hotspot, preserving the same rounded
      // placement as the unrotated frame. The padded cell center can differ.
      const px=x+ox*scale,py=y+oy*scale,cos=Math.cos(rotation),sin=Math.sin(rotation);
      const hw=w*scale/2,hh=h*scale/2,dx=x+hw-px,dy=y+hh-py;
      const cx=px+dx*cos-dy*sin,cy=py+dx*sin+dy*cos;
      const ex=Math.abs(cos)*hw+Math.abs(sin)*hh,ey=Math.abs(sin)*hw+Math.abs(cos)*hh;
      if(cx-ex>320||cy-ey>200||cx+ex<0||cy+ey<0)return;
      if(!this.gl){
        const ctx=this.ctx;ctx.save();ctx.globalAlpha=alpha;ctx.translate(px,py);ctx.rotate(rotation);
        ctx.drawImage(this.atlas,sx,sy,w,h,x-px,y-py,w*scale,h*scale);ctx.restore();return;
      }
      this.quad(x,y,w*scale,h*scale,sx/this.data.width,sy/this.data.height,(sx+w)/this.data.width,(sy+h)/this.data.height,1,1,1,alpha,rotation,px,py);return;
    }
    if(x>320||y>200||x+w*scale<0||y+h*scale<0)return;
    if(!this.gl){this.ctx.globalAlpha=alpha;this.ctx.drawImage(this.atlas,sx,sy,w,h,x,y,w*scale,h*scale);return;}
    this.quad(x,y,w*scale,h*scale,sx/this.data.width,sy/this.data.height,(sx+w)/this.data.width,(sy+h)/this.data.height,1,1,1,alpha);
  }
  rect(x,y,w,h,r,g,b,a=1) {
    if(!this.gl){this.ctx.globalAlpha=a;this.ctx.fillStyle=`rgb(${r*255},${g*255},${b*255})`;this.ctx.fillRect(x,y,w,h);return;}
    const [sx,sy]=this.data.frames[this.data.groups.white[0]];
    this.quad(x,y,w,h,(sx+.5)/this.data.width,(sy+.5)/this.data.height,(sx+.5)/this.data.width,(sy+.5)/this.data.height,r,g,b,a);
  }
  flush() {
    if(!this.gl||!this.count)return;
    const gl=this.gl;gl.bufferSubData(gl.ARRAY_BUFFER,0,this.vertices.subarray(0,this.count*48));gl.drawArrays(gl.TRIANGLES,0,this.count*6);this.drawCalls++;this.count=0;
  }
  end(){this.flush();}
}
