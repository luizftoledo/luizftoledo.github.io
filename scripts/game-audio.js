/* Recorded music + generated foley. Unlock playback inside the user's actual gesture. */
window.GameAudio = (() => {
  const names = ['ui','step-grass','step-stone','till','plant','water','stone','wood','pickup','heal','impact','camera','spell','alert','hide','door','success','fail'];
  let ctx, effectsGain, musicGain, musicSource, player, desired, options;
  let volume = Number(localStorage.getItem('lft_game_vol') ?? .6), muted = localStorage.getItem('lft_game_mute') === '1';
  let touched = false, blocked = false, pendingPlay = false, lastError = '', status, loaded = 0, played = 0, playSerial = 0;
  const encoded = new Map(), buffers = new Map(), decoding = new Map(), cooldown = new Map();
  const requests = names.map(name => fetch(`audio/hd2d-v7/${name}.mp3`).then(r => {if(!r.ok)throw Error(name+': '+r.status);return r.arrayBuffer();}).then(data=>{encoded.set(name,data);if(ctx)return decode(name);}).catch(e=>{lastError=e.message;}));
  function decode(name) {
    if (buffers.has(name)) return Promise.resolve(buffers.get(name));
    if (decoding.has(name)) return decoding.get(name);
    if (!ctx || !encoded.has(name)) return Promise.resolve(null);
    const task=ctx.decodeAudioData(encoded.get(name).slice(0)).then(buffer=>{buffers.set(name,buffer);loaded=buffers.size;return buffer;}).catch(e=>{lastError=e.message;return null;});
    decoding.set(name,task);return task;
  }
  function context() {
    if (!ctx) {
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
      ctx=new AC();effectsGain=ctx.createGain();effectsGain.connect(ctx.destination);
      musicGain=ctx.createGain();musicGain.connect(ctx.destination);
      if(player){musicSource=ctx.createMediaElementSource(player);musicSource.connect(musicGain);player.volume=1;}
      for(const name of encoded.keys())decode(name);
      ctx.onstatechange=sync;
    }
    if(ctx.state!=='running')ctx.resume().catch(e=>{lastError=e.name;sync();});
    apply();return ctx;
  }
  function sync() {
    if(!status)return;
    const needs=muted||volume===0||blocked||(touched&&desired&&player.paused);
    status.hidden=!needs;
    status.textContent=(muted||volume===0)?'Ativar som':(lastError==='NotSupportedError'?'Tentar áudio novamente':'Tocar música');
    status.title=lastError||'Ativar música e efeitos';
    const btn=document.getElementById('muteBtn');
    if(btn){btn.textContent=muted?'♪ OFF':'♪ ON';btn.setAttribute('aria-label',muted?'Ativar som':'Silenciar som');btn.setAttribute('aria-pressed',String(muted));}
  }
  function apply() {
    volume=Math.max(0,Math.min(1,Number.isFinite(volume)?volume:.6));
    const v=muted?0:volume;
    if(effectsGain)effectsGain.gain.setTargetAtTime(v*.8,ctx.currentTime,.025);
    if(musicGain)musicGain.gain.setTargetAtTime(v*(desired?.gain??.65),ctx.currentTime,.04);
    else if(player)player.volume=v*(desired?.gain??.65);
    if(player)player.muted=muted;
    const range=document.getElementById('volRange');if(range)range.value=Math.round(volume*100);
    localStorage.setItem('lft_game_vol',String(volume));localStorage.setItem('lft_game_mute',muted?'1':'0');sync();
  }
  function attempt() {
    if(!player||!desired||!touched||document.hidden||pendingPlay)return;
    apply();const serial=++playSerial;pendingPlay=serial;
    // This call must remain synchronous with touchend/click/keydown, not await a fetch/decode.
    const result=player.play();
    Promise.resolve(result).then(()=>{if(serial===playSerial){blocked=false;lastError='';}}).catch(e=>{if(serial===playSerial&&e.name!=='AbortError'){blocked=true;lastError=e.name;}}).finally(()=>{if(pendingPlay===serial)pendingPlay=false;sync();});
  }
  function unlock(event) {
    if(event?.target?.closest?.('a'))return;
    touched=true;context();attempt();
  }
  function music(track) {
    if(!player)return;
    const next=typeof track==='string'?options.tracks.find(t=>t.id===track):options.tracks.find(t=>t.element===track?.id);
    if(!next){desired=null;playSerial++;pendingPlay=false;player.pause();sync();return;}
    if(desired?.id!==next.id){playSerial++;pendingPlay=false;desired=next;const src=new URL(next.src,location.href).href;if(player.src!==src){player.src=next.src;player.load();}player.loop=next.loop!==false;}
    apply();attempt();
  }
  function sound(name,{gain=1,rate=1,pan=0}={}) {
    if(!touched||muted||document.hidden||!ctx||ctx.state!=='running')return;
    const now=performance.now(),minimum=name.startsWith('step-')?110:45;
    if(now-(cooldown.get(name)||-1000)<minimum)return;cooldown.set(name,now);
    const play=buffer=>{if(!buffer||muted||document.hidden)return;const src=ctx.createBufferSource(),amp=ctx.createGain();src.buffer=buffer;src.playbackRate.value=rate;amp.gain.value=gain;src.connect(amp);let node=amp;if(ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=pan;amp.connect(p);node=p;}node.connect(effectsGain);src.start();played++;src.onended=()=>{src.disconnect();amp.disconnect();if(node!==amp)node.disconnect();};};
    if(buffers.has(name))play(buffers.get(name));else decode(name).then(b=>{if(performance.now()-now<180)play(b);});
  }
  function install(config) {
    options=config;player=document.getElementById(config.tracks[0].element);
    player.setAttribute('playsinline','');player.setAttribute('webkit-playsinline','');player.preload='auto';
    config.tracks.slice(1).forEach(t=>{const el=document.getElementById(t.element);if(el){el.pause();el.preload='none';}});
    status=document.createElement('button');status.id='audioStatus';status.type='button';status.hidden=true;
    status.style.cssText='font:inherit;color:inherit;border:1px solid currentColor;border-radius:4px;padding:5px 7px;background:#222;cursor:pointer';
    document.querySelector('.audio-ctl').append(status);
    status.addEventListener('click',()=>{muted=false;if(volume===0)volume=.6;unlock();apply();});
    document.getElementById('volRange').addEventListener('input',e=>{volume=e.target.value/100;muted=false;unlock();apply();});
    document.getElementById('muteBtn').addEventListener('click',()=>{muted=!muted;if(!muted&&volume===0)volume=.6;unlock();apply();});
    // pointerdown is not sufficient on every iPhone version. Retain real touchend and click.
    for(const event of ['pointerdown','touchend','click','keydown'])document.addEventListener(event,unlock,{capture:true,passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){player.pause();ctx?.suspend().catch(()=>{});}else if(touched){context();attempt();}});
    window.addEventListener('pagehide',()=>{player.pause();ctx?.suspend().catch(()=>{});});window.addEventListener('pageshow',()=>{if(touched)attempt();});
    for(const event of ['playing','pause','error'])player.addEventListener(event,sync);
    music(config.initial);apply();
  }
  return {install,music,sound,unlock,ready:()=>Promise.all(requests).then(()=>Promise.all(names.map(decode))),snapshot:()=>({track:desired?.id,src:player?.currentSrc,paused:player?.paused,time:player?.currentTime,ready:player?.readyState,context:ctx?.state,muted,volume,blocked,lastError,effectsLoaded:loaded,effectsPlayed:played})};
})();
