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
    return load(name,img=>['down','left','right','up'].forEach((d,row)=>{
      target[d]=Array.from({length:4},(_,i)=>cell(img,4,4,row*4+i,14,18,true));
    }));
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
  return {atlas,actor,load,cell,titleLoad,titleDraw,loaded,ready:()=>Promise.all(pending)};
};
