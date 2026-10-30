/* Fit the 4:3 game to the available viewport instead of a fixed desktop cap. */
(() => {
  const wrap=document.querySelector('.screen-wrap'),pad=document.querySelector('.pad'),hint=document.querySelector('.kbd-bar');
  if(!wrap)return;
  const controls=document.querySelector('.audio-ctl');
  let button=document.getElementById('fullscreenBtn');
  const nativeButton=!!button;
  if(!button){
    button=document.createElement('button');button.id='fullscreenBtn';button.type='button';button.textContent='TELA CHEIA';button.setAttribute('aria-label','Abrir jogo em tela cheia');controls?.append(button);
    const toggle=async()=>{
      try {
        const active=document.fullscreenElement||document.webkitFullscreenElement;
        if(active){const exit=document.exitFullscreen||document.webkitExitFullscreen;await exit.call(document);}
        else {const enter=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;if(enter)await enter.call(document.documentElement);}
      }catch(e){console.warn('Fullscreen unavailable',e.message);}
    };
    button.addEventListener('click',toggle);
    document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='f'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();toggle();}});
  }
  function fit(){
    const fs=document.fullscreenElement||document.webkitFullscreenElement;
    if(!nativeButton){const active=!!fs;button.textContent=active?'SAIR':'TELA CHEIA';button.setAttribute('aria-label',active?'Sair da tela cheia':'Abrir jogo em tela cheia');button.setAttribute('aria-pressed',String(active));}
    if(fs===wrap||wrap.classList.contains('fullscreen-fallback')){wrap.style.removeProperty('width');wrap.style.removeProperty('height');return;}
    const visibleHeight=el=>el&&getComputedStyle(el).display!=='none'?el.getBoundingClientRect().height:0;
    const height=window.visualViewport?.height||window.innerHeight;
    const width=window.visualViewport?.width||window.innerWidth;
    const top=Math.max(controls?.getBoundingClientRect().bottom||0,document.querySelector('.quit-link')?.getBoundingClientRect().bottom||0)+10;
    const gap=6,bottom=8,extras=visibleHeight(pad)+visibleHeight(hint)+(visibleHeight(pad)?gap:0)+(visibleHeight(hint)?gap:0);
    const style=getComputedStyle(wrap),bx=parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth),by=parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
    const contentWidth=Math.max(80,Math.min(width-20-bx,(height-top-bottom-extras-by)*4/3));
    document.body.style.paddingTop=top+'px';
    wrap.style.width=(contentWidth+bx)+'px';wrap.style.height=(contentWidth*3/4+by)+'px';
    if(pad)pad.style.width=(contentWidth+bx)+'px';
  }
  window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);
  document.addEventListener('fullscreenchange',fit);document.addEventListener('webkitfullscreenchange',fit);
  new ResizeObserver(fit).observe(controls||wrap);
  document.fonts.ready.then(fit);fit();
})();
