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
    return load(name,img=>{const f=frames(img,4,4,14,18,true);['down','left','right','up'].forEach((d,row)=>{
      target[d]=f.slice(row*4,row*4+4);
    });});
  }
  // Animation sheets share one scale and baseline across all poses.
  function frames(img, cols, rows, width, height, grounded=false) {
    const regions = [];
    for(let i=0;i<cols*rows;i++) {
      const sw=img.width/cols,sh=img.height/rows;
      const tile=document.createElement('canvas');tile.width=Math.round(sw);tile.height=Math.round(sh);
      const t=tile.getContext('2d');t.drawImage(img,(i%cols)*sw,Math.floor(i/cols)*sh,sw,sh,0,0,tile.width,tile.height);
      const p=t.getImageData(0,0,tile.width,tile.height).data;
      let l=tile.width,r=-1,top=tile.height,bottom=-1;
      if(grounded) {
        // Keep the connected character, excluding adjacent-cell scraps and baked soft shadows.
        const count=tile.width*tile.height,seen=new Uint8Array(count),queue=new Int32Array(count);
        let best=new Int32Array(0);
        for(let start=0;start<count;start++) {
          if(seen[start]||p[start*4+3]<160)continue;
          let head=0,tail=1;queue[0]=start;seen[start]=1;
          while(head<tail){const at=queue[head++],x=at%tile.width,y=Math.floor(at/tile.width);
            for(const next of [x>0?at-1:-1,x<tile.width-1?at+1:-1,y>0?at-tile.width:-1,y<tile.height-1?at+tile.width:-1])
              if(next>=0&&!seen[next]&&p[next*4+3]>=160){seen[next]=1;queue[tail++]=next;}
          }
          if(tail>best.length)best=queue.slice(0,tail);
        }
        let sole=-1;
        for(const at of best){const x=at%tile.width,y=Math.floor(at/tile.width);l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);bottom=Math.max(bottom,y);if(p[at*4+3]>=220)sole=Math.max(sole,y);}
        if(sole>=top)bottom=sole;
      } else {
        for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++)if(p[(y*tile.width+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      }
      regions.push({tile,l,top,w:Math.max(1,r-l+1),h:Math.max(1,bottom-top+1)});
    }
    const scale=Math.min(width*8*.94/Math.max(...regions.map(r=>r.w)),height*8*.94/Math.max(...regions.map(r=>r.h)));
    return regions.map(r=>{
      const out=document.createElement('canvas');out.width=width*8;out.height=height*8;
      out.getContext('2d').drawImage(r.tile,r.l,r.top,r.w,r.h,(out.width-r.w*scale)/2,(grounded?out.height-1:out.height*.97)-r.h*scale,r.w*scale,r.h*scale);
      sizes.set(out,[width,height]);return out;
    });
  }
  function idle(name,target) {
    return load(name,img=>{const f=frames(img,4,4,14,18,true);target.idle={};['down','left','right','up'].forEach((d,i)=>target.idle[d]=f.slice(i*4,i*4+4));});
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
  function drawGroundedActor(frame,footX,footY) {
    ctx.save();ctx.fillStyle='rgba(25,39,27,.24)';ctx.beginPath();ctx.ellipse(footX,footY,4.2,.8,0,0,Math.PI*2);ctx.fill();
    // Grounded frames end one native pixel above their 18 logical-pixel baseline.
    ctx.drawImage(frame,footX-7,footY-18+1/8,14,18);ctx.restore();
  }
  function creatureFrame(creature,time,attack=0,hurt=0) {
    return creature.animation?.[poseIndex(time,attack,hurt)]||creature.sprite;
  }
  function creature(name,target) {
    return load(name,img=>{target.animation=frames(img,4,2,24,24);target.sprite=target.animation[0];});
  }
  let waterFrames;
  const worldSizes = {
    coffee:[4,4],stone:[6,4.5],rock:[9,6.5],branch:[8,3.5],doc:[5,5],lead:[5,4],photo:[5,5],
    scoop:[4.5,5],ore:[5,4],seedbag:[5,6],energybar:[5,3],luckypen:[4,4],fertilizer:[5,6]
  };
  function worldObject(sprite,key,x,y,time=0,floating=false) {
    const [w,h]=worldSizes[key]||[7,7], bob=floating?Math.sin(time*2.2+x*.05)*.3:0;
    ctx.save();ctx.fillStyle='rgba(26,39,24,.18)';ctx.beginPath();ctx.ellipse(x+8,y+13,w*.42,Math.max(.6,h*.14),0,0,Math.PI*2);ctx.fill();
    ctx.drawImage(sprite,x+8-w/2,y+13-h+bob,w,h);ctx.restore();
  }
  function water(name) {return load(name,img=>{waterFrames=Array.from({length:8},(_,i)=>cell(img,4,2,i,64,64));});}
  const waterRegions = new Map();
  function waterRegion(tileAt,x,y,map='world') {
    if(tileAt(x,y)!=='water')return null;
    const key=(x,y)=>map+':'+x+','+y;
    if(waterRegions.has(key(x,y)))return waterRegions.get(key(x,y));
    const cells=[],seen=new Set(),queue=[[x,y]];
    let minX=x,maxX=x,minY=y,maxY=y;
    while(queue.length){const [a,b]=queue.pop(),k=key(a,b);if(seen.has(k)||tileAt(a,b)!=='water')continue;seen.add(k);cells.push([a,b]);minX=Math.min(minX,a);maxX=Math.max(maxX,a);minY=Math.min(minY,b);maxY=Math.max(maxY,b);queue.push([a-1,b],[a+1,b],[a,b-1],[a,b+1]);}
    const region={minX,minY,width:maxX-minX+1,height:maxY-minY+1};
    cells.forEach(([a,b])=>waterRegions.set(key(a,b),region));return region;
  }
  function worldTile(key,tiles,x,y,time,wx,wy,nature,bank={}) {
    const props={flower:[6,5],flower2:[6,5],sign:[10,11],fence:[16,7],mailbox:[7,11],shop:[16,17],tall:[15,10]};
    if(key==='tree') {ctx.drawImage(tiles.grass,x,y);nature.push({x,y,wx,wy,sprite:tiles.tree});return;}
    if(key==='water'||key==='water2') {
      if(waterFrames) {
        const clock=time*3, frame=Math.floor(clock)%8, blend=clock-Math.floor(clock);
        const r=bank.region||{minX:0,minY:0,width:4,height:4};
        const sw=64/r.width,sh=64/r.height,sx=(wx-r.minX)*sw,sy=(wy-r.minY)*sh;
        ctx.drawImage(waterFrames[frame],sx,sy,sw,sh,x,y,16,16);
        ctx.save();ctx.globalAlpha=blend;ctx.drawImage(waterFrames[(frame+1)%8],sx,sy,sw,sh,x,y,16,16);ctx.restore();
      } else ctx.drawImage(tiles[key],x,y);
      ctx.save();ctx.fillStyle='rgba(24,70,73,.35)';
      if(bank.left)ctx.fillRect(x,y,1.2,16);if(bank.right)ctx.fillRect(x+14.8,y,1.2,16);
      if(bank.top)ctx.fillRect(x,y,16,1.2);if(bank.bottom)ctx.fillRect(x,y+14.8,16,1.2);
      ctx.fillStyle='rgba(163,186,105,.85)';
      if(bank.left)ctx.fillRect(x,y,.55,16);if(bank.right)ctx.fillRect(x+15.45,y,.55,16);
      if(bank.top)ctx.fillRect(x,y,16,.55);if(bank.bottom)ctx.fillRect(x,y+15.45,16,.55);
      ctx.restore();return;
    }
    if(key==='tilled'||key==='tilledwet') {
      ctx.drawImage(tiles.soil,x,y);ctx.save();
      if(key==='tilledwet'){ctx.fillStyle='rgba(29,21,13,.3)';ctx.fillRect(x,y,16,16);}
      ctx.strokeStyle='rgba(63,38,20,.22)';ctx.lineWidth=.8;
      for(let row=3;row<16;row+=4){ctx.beginPath();ctx.moveTo(x,y+row);ctx.lineTo(x+16,y+row);ctx.stroke();}
      ctx.restore();return;
    }
    if(props[key]) {
      ctx.drawImage(tiles.grass,x,y);const [w,h]=props[key];
      const moving=['flower','flower2','tall'].includes(key), sway=moving?Math.sin(time*1.4+wx*.3+wy*.2)*.35:0;
      ctx.drawImage(tiles[key],x+8-w/2+sway,y+16-h,w,h);return;
    }
    ctx.drawImage(tiles[key],x,y);
  }
  function natureLayer(nature,time,playerBase,front=false) {
    for(const n of nature) {
      if((n.y+16>playerBase)!==front)continue;
      const w=23,h=30,x=n.x+8-w/2,y=n.y+16-h;
      ctx.save();ctx.fillStyle='rgba(19,48,29,.22)';ctx.beginPath();ctx.ellipse(n.x+9,n.y+15,9,2.5,0,0,Math.PI*2);ctx.fill();
      for(let band=0;band<12;band++) {
        const v=band/11, leaf=Math.max(0,1-v*1.5);
        const shift=(Math.sin(time*1.25+n.wx*.24+n.wy*.17)*.65+Math.sin(time*.45)*.3)*leaf*leaf;
        ctx.drawImage(n.sprite,0,band*16/12,16,16/12,x+shift,y+band*h/12,w,h/12+.04);
      }
      ctx.restore();
    }
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
  return {worldObject,worldSizes,water,waterRegion,worldTile,natureLayer,atlas,actor,load,cell,frames,idle,idleIndex,poseIndex,actorFrame,drawGroundedActor,creature,creatureFrame,titleLoad,titleDraw,loaded,ready:()=>Promise.all(pending)};
};
