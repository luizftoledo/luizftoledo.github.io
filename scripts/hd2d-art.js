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
  function frames(img, cols, rows, width, height, grounded=false, rowLayout=null) {
    const regions = [];
    for(let i=0;i<cols*rows;i++) {
      const row=Math.floor(i/cols),layout=rowLayout?.[row],sourceCols=layout?.columns||cols;
      const sourceColumn=layout?.indices?.[i%cols]??i%cols;
      const sw=img.width/sourceCols,sh=img.height/rows;
      const tile=document.createElement('canvas');tile.width=Math.round(sw);tile.height=Math.round(sh);
      const t=tile.getContext('2d');t.drawImage(img,sourceColumn*sw,row*sh,sw,sh,0,0,tile.width,tile.height);
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
  // Ground-space lighting: cached alpha silhouettes, contact occlusion and bounded scene grading.
  const shadowMasks=new WeakMap();
  let lighting='route';
  function setLighting(profile){lighting=profile;}
  function maskFor(sprite){
    if(shadowMasks.has(sprite))return shadowMasks.get(sprite);
    const out=document.createElement('canvas'),w=sprite.naturalWidth||sprite.width,h=sprite.naturalHeight||sprite.height;
    const scale=Math.min(1,256/Math.max(w,h));out.width=Math.max(1,Math.round(w*scale));out.height=Math.max(1,Math.round(h*scale));
    const c=out.getContext('2d');c.drawImage(sprite,0,0,out.width,out.height);const pixels=c.getImageData(0,0,out.width,out.height);for(let i=3;i<pixels.data.length;i+=4){const a=pixels.data[i];pixels.data[i]=a<70?0:Math.min(255,(a-70)*1.5);}c.putImageData(pixels,0,0);c.globalCompositeOperation='source-in';c.fillStyle='#152031';c.fillRect(0,0,out.width,out.height);const soft=document.createElement('canvas');soft.width=out.width;soft.height=out.height;const sc=soft.getContext('2d');sc.filter='blur(2px)';sc.drawImage(out,0,0);shadowMasks.set(sprite,soft);return soft;
  }
  function contactShadow(x,y,rx,ry,alpha=.35){
    ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);
    const grad=ctx.createRadialGradient(0,0,0,0,0,1);grad.addColorStop(0,`rgba(11,20,29,${alpha})`);grad.addColorStop(.45,`rgba(15,24,31,${alpha*.65})`);grad.addColorStop(1,'rgba(15,24,31,0)');
    ctx.fillStyle=grad;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  function castShadow(sprite,footX,footY,w,h,alpha=.24,stretch=.33){
    if(!sprite||footX+w+h<0||footY+h<0||footX-w-h>256||footY>205)return;
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(footX,footY);ctx.transform(1,0,-.52,-stretch,0,0);
    ctx.drawImage(maskFor(sprite),-w/2,-h,w,h);ctx.restore();
  }
  function building(sprite,x,y,w,h){
    castShadow(sprite,x+w/2,y+h-1,w,h,.22,.22);
    contactShadow(x+w/2,y+h-1,w*.53,3,.48);
    ctx.drawImage(sprite,x,y,w,h);
  }
  function depthPass(tileAt,camX,camY,kind='route'){
    const x0=Math.floor(camX/16),y0=Math.floor(camY/16);
    const raised=key=>(kind==='farm'?['cwall','rockface']:['wall','cwall','rockface','door']).includes(key);
    ctx.save();
    for(let j=y0;j<=y0+13;j++)for(let i=x0;i<=x0+17;i++){
      const t=tileAt(i,j),x=i*16-camX,y=j*16-camY;if(raised(t)||t==='tree'||t==='water')continue;
      if(raised(tileAt(i,j-1))){
        const grad=ctx.createLinearGradient(0,y,0,y+6);grad.addColorStop(0,'rgba(12,16,31,.44)');grad.addColorStop(.28,'rgba(19,25,39,.23)');grad.addColorStop(1,'rgba(19,25,39,0)');ctx.fillStyle=grad;ctx.fillRect(x,y,16,6);
      }
      if(raised(tileAt(i-1,j))){
        const grad=ctx.createLinearGradient(x,0,x+4,0);grad.addColorStop(0,'rgba(12,16,31,.25)');grad.addColorStop(1,'rgba(19,25,39,0)');ctx.fillStyle=grad;ctx.fillRect(x,y,4,16);
      }
      if(kind!=='palace'&&t==='soil'&&tileAt(i,j-1)!=='soil'){
        const grad=ctx.createLinearGradient(0,y,0,y+2.5);grad.addColorStop(0,'rgba(40,30,20,.24)');grad.addColorStop(1,'rgba(40,30,20,0)');ctx.fillStyle=grad;ctx.fillRect(x,y,16,2.5);
      }
    }
    ctx.restore();
  }
  function natureShadows(nature,time){
    for(const n of nature){
      const w=n.w||23,h=n.h||30,base=n.y+16;
      castShadow(n.sprite,n.x+8,base,w,h,n.kind==='tree'?.24:.18,n.kind==='tree'?.43:.29);
      contactShadow(n.x+8,base,w*.38,n.kind==='tree'?2:1,.36);
    }
  }
  function glow(x,y,r,color,alpha=.2){
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=alpha;
    const gradient=ctx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,color);gradient.addColorStop(.25,color+'a0');gradient.addColorStop(1,color+'00');ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
  }
  function groundLighting(camX,camY,time,kind='route'){
    if(kind==='cave'||kind==='palace')return;
    // Slow cloud shadows remain in world space as the camera moves.
    ctx.save();
    for(let i=0;i<4;i++){
      const x=((i*173+time*1.5-camX*.25)%430+430)%430-80,y=((i*79-camY*.22)%280+280)%280-40;
      ctx.save();ctx.translate(x,y);ctx.scale(70,24);const gr=ctx.createRadialGradient(0,0,0,0,0,1);gr.addColorStop(0,'rgba(19,38,49,.09)');gr.addColorStop(.45,'rgba(19,38,49,.05)');gr.addColorStop(1,'rgba(19,38,49,0)');ctx.fillStyle=gr;ctx.fillRect(-1,-1,2,2);ctx.restore();
    }ctx.restore();
  }
  function atmosphere(time,kind='route',camX=0,camY=0,lights=[]){
    ctx.save();
    const grade=ctx.createLinearGradient(15,0,235,192);
    if(kind==='palace'){grade.addColorStop(0,'rgba(255,213,148,.06)');grade.addColorStop(.45,'rgba(64,77,128,.045)');grade.addColorStop(1,'rgba(31,34,64,.12)');}
    else if(kind==='cave'){grade.addColorStop(0,'rgba(41,65,96,.14)');grade.addColorStop(1,'rgba(13,17,34,.27)');}
    else{grade.addColorStop(0,'rgba(255,221,153,.10)');grade.addColorStop(.45,'rgba(255,231,183,.025)');grade.addColorStop(1,'rgba(21,43,71,.15)');}
    ctx.fillStyle=grade;ctx.fillRect(0,0,256,192);
    const vignette=ctx.createRadialGradient(128,92,65,128,92,160);vignette.addColorStop(0,'rgba(10,17,31,0)');vignette.addColorStop(1,kind==='cave'?'rgba(5,8,20,.4)':'rgba(8,16,29,.19)');ctx.fillStyle=vignette;ctx.fillRect(0,0,256,192);
    if(kind!=='cave'&&kind!=='palace'){
      ctx.save();ctx.globalCompositeOperation='screen';
      const sun=ctx.createLinearGradient(0,0,170,150);sun.addColorStop(0,'rgba(255,229,170,.13)');sun.addColorStop(1,'rgba(255,229,170,0)');ctx.fillStyle=sun;
      const drift=Math.sin(time*.13)*5-camX*.04;ctx.beginPath();ctx.moveTo(12+drift,0);ctx.lineTo(28+drift,0);ctx.lineTo(190+drift,192);ctx.lineTo(151+drift,192);ctx.fill();ctx.restore();
    }
    for(const l of lights)if(l.x>-40&&l.y>-40&&l.x<296&&l.y<232)glow(l.x,l.y,l.r||22,l.color||'#ffe1a2',l.alpha||.19);
    // Sparse dust/pollen: sub-pixel flecks only, never over the HUD.
    for(let i=0;i<12;i++){
      const x=((i*61.7+Math.sin(time*.35+i)*2-camX*.3)%270+270)%270-7;
      const y=((i*41.3-time*(kind==='palace'?.5:1.2)-camY*.35)%210+210)%210-9;
      const a=(.5+.5*Math.sin(time*.8+i*1.7))*(kind==='cave'?.13:.25);
      ctx.fillStyle=`rgba(255,235,184,${a})`;ctx.fillRect(x,y,.35+(i%3)*.12,.35+(i%3)*.12);
    }
    ctx.restore();
  }
  function drawGroundedActor(frame,footX,footY,reflect=false) {
    castShadow(frame,footX,footY,14,18,lighting==='palace'?.2:.27,lighting==='palace'?.23:.35);
    if(reflect){ctx.save();ctx.globalAlpha=.065;ctx.translate(footX,footY);ctx.scale(1,-.23);ctx.drawImage(frame,-7,-18,14,18);ctx.restore();}

    ctx.save();contactShadow(footX,footY,4.3,1.05,.48);
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
    ctx.save();castShadow(sprite,x+8,y+13,w,h,.23,.36);contactShadow(x+8,y+13,w*.5,Math.max(.6,h*.15),.38);
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
    if(key==='tree') {ctx.drawImage(tiles.grass,x,y);nature.push({x,y,wx,wy,sprite:tiles.tree,kind:'tree'});return;}
    if(key==='water'||key==='water2') {
      if(waterFrames) {
        const clock=time*3, frame=Math.floor(clock)%8, blend=clock-Math.floor(clock);
        const r=bank.region||{minX:0,minY:0,width:4,height:4};
        const ax=wx-r.minX,ay=wy-r.minY,flipX=r.width>6&&Math.floor(ax/4)%2===1,flipY=r.height>6&&Math.floor(ay/4)%2===1;
        const sw=r.width>6?16:64/r.width,sh=r.height>6?16:64/r.height;
        const sx=r.width>6?(flipX?3-ax%4:ax%4)*16:ax*sw,sy=r.height>6?(flipY?3-ay%4:ay%4)*16:ay*sh;
        ctx.save();ctx.translate(x+(flipX?16:0),y+(flipY?16:0));ctx.scale(flipX?-1:1,flipY?-1:1);
        ctx.drawImage(waterFrames[frame],sx,sy,sw,sh,0,0,16,16);
        ctx.globalAlpha=blend;ctx.drawImage(waterFrames[(frame+1)%8],sx,sy,sw,sh,0,0,16,16);ctx.restore();
      } else ctx.drawImage(tiles[key],x,y);
      ctx.save();
      const waterShade=ctx.createLinearGradient(x,y,x,y+16);waterShade.addColorStop(0,'rgba(12,42,62,.20)');waterShade.addColorStop(1,'rgba(8,47,65,.05)');ctx.fillStyle=waterShade;ctx.fillRect(x,y,16,16);
      ctx.globalCompositeOperation='screen';ctx.strokeStyle='rgba(229,246,216,.25)';ctx.lineWidth=.35;
      for(let r=0;r<2;r++){const phase=time*.6+wx*.72+wy*.39+r*2.1;const cx=x+4+r*7+Math.sin(phase)*1.5,cy=y+4+r*7+Math.cos(phase*.8);ctx.beginPath();ctx.moveTo(cx-1.2,cy);ctx.lineTo(cx+1.2,cy);ctx.stroke();}
      ctx.restore();
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
      nature.push({x,y,wx,wy,sprite:tiles[key],kind:key,w,h,sway});return;
    }
    ctx.drawImage(tiles[key],x,y);
  }
  function natureLayer(nature,time,playerBase,front=false) {
    for(const n of [...nature].sort((a,b)=>(a.y-b.y)||(a.x-b.x))) {
      if((n.y+16>playerBase)!==front)continue;
      const w=n.w||23,h=n.h||30,x=n.x+8-w/2,y=n.y+16-h;
      ctx.save();
      if(n.kind!=='tree')ctx.drawImage(n.sprite,x+(n.sway||0),y,w,h);
      else for(let band=0;band<12;band++) {
        const v=band/11,leaf=Math.max(0,1-v*1.5);
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
  return {setLighting,contactShadow,castShadow,building,depthPass,natureShadows,groundLighting,glow,atmosphere,worldObject,worldSizes,water,waterRegion,worldTile,natureLayer,atlas,actor,load,cell,frames,idle,idleIndex,poseIndex,actorFrame,drawGroundedActor,creature,creatureFrame,titleLoad,titleDraw,loaded,ready:()=>Promise.all(pending)};
};
