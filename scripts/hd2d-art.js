/* Generated raster assets retain native resolution; gameplay stays in logical pixels. */
window.HD2D = function (ctx) {
  const sizes = new WeakMap(), original = ctx.drawImage.bind(ctx);
  ctx.drawImage = function (img, ...a) {
    const size = sizes.get(img);
    if (size && a.length === 2) a.push(size[0], size[1]);
    else if (size && a.length === 8) {
      a[0] *= img.width / size[0]; a[1] *= img.height / size[1];
      a[2] *= img.width / size[0]; a[3] *= img.height / size[1];
    }
    const smooth = ctx.imageSmoothingEnabled;
    if (size || img instanceof HTMLImageElement) ctx.imageSmoothingEnabled = true;
    original(img, ...a); ctx.imageSmoothingEnabled = smooth;
  };
  const pending = [], loaded = {};
  function load(name, fn) {
    const job = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { loaded[name] = img; Promise.resolve(fn(img)).then(resolve,reject); };
      img.onerror = () => reject(new Error('HD2D asset unavailable: ' + name));
      img.src = 'images/hd2d/' + name + '.webp';
    });
    pending.push(job); return job;
  }
  function cell(img, cols, rows, index, width, height, fit = false) {
    const sx = index % cols * img.width / cols, sy = Math.floor(index / cols) * img.height / rows;
    const sw = img.width / cols, sh = img.height / rows;
    const out = document.createElement('canvas'); out.width = width * 8; out.height = height * 8;
    const c = out.getContext('2d');
    if (fit) {
      const temp = document.createElement('canvas'); temp.width = Math.round(sw); temp.height = Math.round(sh);
      const t = temp.getContext('2d');
      const isCreature = img.src.includes('pokemonCreatures'), isFarmItem = img.src.includes('stardewObjects');
      const trimTop = isCreature ? .045 : isFarmItem ? .025 : 0;
      const trimBottom = isCreature ? .08 : isFarmItem ? .12 : 0;
      t.drawImage(img, sx, sy + sh*trimTop, sw, sh*(1-trimTop-trimBottom), 0, 0, temp.width, temp.height);
      const p = t.getImageData(0, 0, temp.width, temp.height).data;
      let l=temp.width, r=0, top=temp.height, bottom=0;
      for(let y=0;y<temp.height;y++)for(let x=0;x<temp.width;x++)if(p[(y*temp.width+x)*4+3]>24){l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      const w=r-l+1,h=bottom-top+1, scale=Math.min(out.width*.94/w,out.height*.94/h);
      if(w>0&&h>0)c.drawImage(temp,l,top,w,h,(out.width-w*scale)/2,out.height*.97-h*scale,w*scale,h*scale);
    } else c.drawImage(img,sx+sw*.012,sy+sh*.012,sw*.976,sh*.976,0,0,out.width,out.height);
    sizes.set(out,[width,height]);return out;
  }
  function atlas(name,cols,rows,target,keys,fit=false) {
    return load(name,img=>keys.forEach((key,i)=>{
      const old=target[key]; target[key]=cell(img,cols,rows,i,old?.width||16,old?.height||16,fit);
    }));
  }
  function actor(name,target) {
    return load(name,img=>{const f=frames(img,4,4,14,18);['down','left','right','up'].forEach((d,row)=>{
      target[d]=f.slice(row*4,row*4+4);
    });});
  }
  // Animation sheets share one scale and baseline across all poses.
  function frames(img, cols, rows, width, height) {
    const regions = [];
    for(let i=0;i<cols*rows;i++) {
      const sw=img.width/cols,sh=img.height/rows;
      const tile=document.createElement('canvas');tile.width=Math.round(sw);tile.height=Math.round(sh);
      const t=tile.getContext('2d');t.drawImage(img,(i%cols)*sw,Math.floor(i/cols)*sh,sw,sh,0,0,tile.width,tile.height);
      const p=t.getImageData(0,0,tile.width,tile.height).data;
      let l=tile.width,r=-1,top=tile.height,bottom=-1;
      for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++)if(p[(y*tile.width+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      regions.push({tile,l,top,w:Math.max(1,r-l+1),h:Math.max(1,bottom-top+1)});
    }
    const scale=Math.min(width*8*.94/Math.max(...regions.map(r=>r.w)),height*8*.94/Math.max(...regions.map(r=>r.h)));
    return regions.map(r=>{
      const out=document.createElement('canvas');out.width=width*8;out.height=height*8;
      out.getContext('2d').drawImage(r.tile,r.l,r.top,r.w,r.h,(out.width-r.w*scale)/2,out.height*.97-r.h*scale,r.w*scale,r.h*scale);
      sizes.set(out,[width,height]);return out;
    });
  }
  function idle(name,target) {
    return load(name,img=>{const f=frames(img,4,4,14,18);target.idle={};['down','left','right','up'].forEach((d,i)=>target.idle[d]=f.slice(i*4,i*4+4));});
  }
  function idleIndex(time,offset=0) {
    const p=((time+offset)%4.6+4.6)%4.6;
    return p<1.1?0:p<2?1:p<2.16?2:p<3?3:p<3.9?1:0;
  }
  function poseIndex(time,attack=0,hurt=0,offset=0) {
    if(hurt>.16)return 6;
    if(hurt>0)return 7;
    if(attack>.62)return 4;
    if(attack>.18)return 5;
    if(attack>0)return 7;
    return idleIndex(time,offset);
  }
  function actorFrame(target,dir,moving,time,phase=0,offset=0) {
    return moving?target[dir][phase%target[dir].length]:target.idle?.[dir]?.[idleIndex(time,offset)]||target[dir][0];
  }
  function creatureFrame(creature,time,attack=0,hurt=0) {
    return creature.animation?.[poseIndex(time,attack,hurt)]||creature.sprite;
  }
  function creature(name,target) {
    return load(name,img=>{target.animation=frames(img,4,2,24,24);target.sprite=target.animation[0];});
  }
  let title;
  function titleLoad(name){load(name,img=>{title=img;});}
  function titleDraw(){
    ctx.fillStyle='#171a22';ctx.fillRect(0,0,256,192);
    if(title)original(title,0,0,title.width,title.height,0,0,256,192);
    const shade=ctx.createLinearGradient(0,0,0,192);
    shade.addColorStop(0,'rgba(5,8,16,.65)');shade.addColorStop(.6,'rgba(5,8,16,.22)');shade.addColorStop(1,'rgba(5,8,16,.65)');
    ctx.fillStyle=shade;ctx.fillRect(0,0,256,192);
  }
  return {atlas,actor,load,cell,frames,idle,idleIndex,poseIndex,actorFrame,creature,creatureFrame,titleLoad,titleDraw,loaded,ready:()=>Promise.all(pending)};
};
