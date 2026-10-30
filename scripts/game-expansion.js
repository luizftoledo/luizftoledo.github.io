/* Authored exploration routes; original entrances stay at their saved coordinates. */
window.EXPANSION=(()=>{
 const grid=(w,h,c)=>Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>!x||!y||x===w-1||y===h-1?'#':c));
 const copy=(g,base)=>base.forEach((r,y)=>{for(let x=0;x<base[0].length;x++)g[y][x]=r[x]||(x===base[0].length-1?'#':g[y][x]);});
 const line=(g,x1,y1,x2,y2,c)=>{for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++)for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)g[y][x]=c;};
 const box=(g,x,y,w,h,c)=>line(g,x,y,x+w-1,y+h-1,c);
 const rows=g=>g.map(r=>r.join(''));
 const sites=[
  {id:'registry',name:'ARQUIVO MUNICIPAL',x:36,y:3,w:5,h:4,art:0,doorX:38,doorY:6,note:'registro',lines:['O registro tem duas datas.','A copia antiga e a original.','Pista: o sinal veio da estacao.']},
  {id:'reading',name:'SALA DE LEITURA',x:30,y:22,w:5,h:4,art:1,doorX:32,doorY:25,note:'relato',lines:['Uma moradora guardou um recorte.','O mesmo simbolo aparece nele.','Pista: a antena ainda funciona.']},
  {id:'station',name:'ESTACAO DO SINAL',x:52,y:25,w:5,h:4,art:2,doorX:54,doorY:28}
 ];
 function pokemon(base){
  const g=grid(64,40,',');copy(g,base);
  line(g,26,6,62,6,'=');line(g,28,6,28,12,'=');line(g,28,8,62,8,'=');line(g,38,7,38,32,'=');line(g,12,18,12,33,'=');line(g,2,33,60,33,'=');line(g,32,26,32,33,'=');line(g,54,29,54,33,'=');line(g,28,12,60,12,'=');line(g,57,7,57,12,'=');
  for(let y=2;y<18;y++)for(let x=30;x<61;x++)if(g[y][x]===','&&x%7<4&&y%7<4)g[y][x]=';';
  for(let y=22;y<37;y++)for(let x=3;x<59;x++)if(g[y][x]===','&&(x+2*y)%11<4)g[y][x]=';';
  box(g,43,20,5,6,'~');box(g,17,24,6,4,'~');
  for(let y=27;y<=29;y++)for(let x=15;x<=62;x++)g[y][x]=g[y][x]==='='?'J':'~';
  for(let y=24;y<=29;y++)for(let x=44;x<=46;x++)g[y][x]='~';
  for(const [x,y,w,h]of [[30,2,4,3],[45,2,5,3],[59,9,3,5],[29,14,4,3],[44,15,6,3]])for(let b=y;b<y+h;b++)for(let a=x;a<x+w;a++)if([',',';'].includes(g[b][a]))g[b][a]='#';
  for(const [x,y]of [[29,3],[44,3],[61,17],[28,22],[42,35],[24,31],[7,25],[58,23],[29,35]]){g[y][x]='#';g[y][x-1]='#';}
  for(const [x,y]of [[34,9],[45,14],[28,28],[50,34],[8,31],[24,22]])if(g[y][x]===',')g[y][x]='*';
  sites.forEach(s=>{box(g,s.x,s.y,s.w,s.h,',');if(g[s.doorY+1][s.doorX]!=='J')g[s.doorY+1][s.doorX]='=';});
  g[12][57]='!';g[6][28]='=';g[19][12]='=';
  return rows(g);
 }
 function farm(base,cave=false){
  const g=grid(44,30,cave?'.':',');copy(g,base);
  if(cave){
   line(g,20,7,42,7,'.');line(g,12,14,12,27,'.');line(g,12,23,40,23,'.');
   box(g,27,2,1,19,'#');g[7][27]='.';g[15][27]='.';box(g,29,14,13,1,'#');g[14][35]='.';
   for(const [x,y]of [[6,3],[20,9],[34,22],[30,5],[38,9],[31,17],[39,20],[25,25],[18,23],[8,21],[22,18]])g[y][x]='O';
  }else{
   line(g,22,5,42,5,'=');line(g,25,3,25,25,'=');line(g,12,14,12,25,'=');line(g,12,25,40,25,'=');line(g,25,20,39,20,'=');
   for(let y=3;y<=13;y+=4)for(let x=29;x<42;x+=4)g[y][x]='#';
   box(g,29,16,6,3,'t');box(g,37,22,4,4,'~');
   for(const [x,y]of [[30,6],[33,21],[18,24]])g[y][x]='!';
   for(const [x,y]of [[28,7],[37,12],[17,21],[34,26],[7,20]])g[y][x]='*';
   for(const [x,y]of [[26,9],[31,23],[19,22],[36,19]])g[y][x]='L';
  }
  return rows(g);
 }
 function palace(base){
  const g=grid(46,30,'.');copy(g,base.map(r=>r.replace(/[MP]/g,'.')));
  line(g,24,5,44,5,'r');line(g,24,15,44,15,'r');line(g,35,5,35,27,'r');
  line(g,27,12,44,12,'#');g[12][35]='r';line(g,27,26,44,26,'#');g[26][35]='r';
  line(g,34,1,34,11,'#');[5,6,10].forEach(y=>g[y][34]='r');
  line(g,39,14,39,25,'#');[18,22].forEach(y=>g[y][39]='r');
  line(g,27,20,33,20,'#');g[20][31]='.';
  for(const [x,y]of [[29,3],[41,3],[29,22],[42,23],[31,17]])g[y][x]='v';
  for(const [x,y]of [[31,3],[39,9],[29,20]])g[y][x]='s';
  for(const [x,y]of [[33,3],[39,3],[31,24],[40,24]])g[y][x]='c';
  g[5][40]='P';g[22][38]='M';g[5][25]='r';g[15][25]='r';
  return rows(g);
 }
 function drawMap(ctx,map,player,points=[],title='MAPA',theme={}){
  ctx.save();ctx.fillStyle='rgba(9,16,23,.97)';ctx.fillRect(4,4,248,184);
  ctx.font='6px "Press Start 2P"';ctx.textBaseline='top';ctx.fillStyle='#f3e8cb';ctx.fillText(title,12,12);ctx.font='4px "Press Start 2P"';ctx.fillText('M / ESC / TOQUE: FECHAR',12,23);
  const s=Math.min(232/map[0].length,137/map.length),ox=(256-map[0].length*s)/2,oy=35;
  const colors={'#':theme.wall||'#355442','~':'#3e97b2',';':'#638c4f','=':'#c4b487','J':'#ac8a5b','r':'#a33b47','t':'#94734c','!':'#ecd69b','s':'#d5bc7c','D':'#c9a34d','E':'#75cba4','M':'#d5bc7c','B':'#d5bc7c','P':'#d5bc7c'};
  map.forEach((r,y)=>[...r].forEach((c,x)=>{ctx.fillStyle=colors[c]||theme.floor||'#6b7565';ctx.fillRect(ox+x*s,oy+y*s,s+.1,s+.1);}));
  points.forEach((p,i)=>{const x=ox+(p.x+.5)*s,y=oy+(p.y+.5)*s;ctx.fillStyle=p.color||'#ffd46b';ctx.fillRect(x-3,y-3,6,6);ctx.font='4px "Press Start 2P"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#17262d';ctx.fillText(String(i+1),x,y+.25);});
  ctx.textAlign='left';ctx.textBaseline='top';ctx.font='3.5px "Press Start 2P"';ctx.fillStyle='#f3e8cb';const legend=points.map((p,i)=>(i+1)+' '+(p.label||'PONTO')).join('  ');ctx.fillText(legend,12,178);
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ox+(player.x+.5)*s,oy+(player.y+.5)*s,Math.max(1.5,s*.6),0,Math.PI*2);ctx.fill();ctx.restore();
 }
 function attachMap(game,canvas,draw){
  const button=document.createElement('button');button.textContent='MAPA';button.type='button';button.setAttribute('aria-label','Abrir mapa (M)');document.querySelector('.audio-ctl')?.append(button);
  const toggle=()=>{if(game.state==='world'&&!game.msg){game.showMap=!game.showMap;if(game.showMap)draw();}};
  button.addEventListener('click',toggle);
  window.addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;if(e.key.toLowerCase()==='m'){e.preventDefault();e.stopImmediatePropagation();toggle();}else if(game.showMap){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')game.showMap=false;}},true);
  canvas.addEventListener('pointerdown',e=>{if(game.showMap){e.preventDefault();e.stopImmediatePropagation();game.showMap=false;}},true);
 }
 return{pokemon,farm,palace,sites,drawMap,attachMap};
})();
