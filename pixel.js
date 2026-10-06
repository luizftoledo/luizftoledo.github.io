/* =====================================================================
   LFT — PIXEL EDITION (comportamento)
   Loader com criatura, chão de pixels no hero, criaturas sobre os
   títulos, rastro de pixels no cursor, efeito "decode" nos títulos e
   revelação das imagens. Nenhum texto ou link do site é alterado.
   ===================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('px');
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- tema: mantém o tema claro (o mesmo do site no ar) ---------- */
  function forceDark() {
    if (root.getAttribute('data-site-theme') !== 'light') root.setAttribute('data-site-theme', 'light');
    var ed = document.getElementById('editorial-theme');
    if (ed && ed.disabled) ed.disabled = false;
  }
  forceDark();
  new MutationObserver(forceDark).observe(root, { attributes: true, attributeFilter: ['data-site-theme'] });
  document.addEventListener('DOMContentLoaded', forceDark);

  /* ---------- fonte pixel ---------- */
  if (!document.querySelector('link[href*="Silkscreen"]')) {
    var f = document.createElement('link');
    f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap';
    document.head.appendChild(f);
  }

  /* ---------- sprite: lupa de investigação em pixel art ---------- */
  var COLORS = { K: '#17191e', L: '#e7e2da', W: '#fffdf8', C: '#c8283a' };
  var LUPA = [
    '...KKKK....',
    '..KLLLLK...',
    '.KLWLLLLK..',
    '.KLWLLLLK..',
    '.KLLLLLLK..',
    '.KLLLLLLK..',
    '..KLLLLK...',
    '...KKKKCC..',
    '.......CCC.',
    '........CCC',
    '.........C.'
  ];
  function svgFrame(rows, cls, dy) {
    var s = '<svg class="' + cls + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 -1 11 12" shape-rendering="crispEdges">';
    rows.forEach(function (r, y) {
      for (var x = 0; x < r.length; x++) {
        var c = COLORS[r[x]];
        if (c) s += '<rect x="' + x + '" y="' + (y + dy) + '" width="1" height="1" fill="' + c + '"/>';
      }
    });
    return s + '</svg>';
  }
  // dois quadros: a lupa "balança" 1 pixel enquanto procura
  var SPRITE = svgFrame(LUPA, 'f1', 0) + svgFrame(LUPA, 'f2', -1);
  function makeCritter() {
    var el = document.createElement('div');
    el.className = 'px-critter';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = SPRITE;
    return el;
  }

  /* ---------- LOADER ---------- */
  // Roda assim que o script é lido no <head>: a tela de carregamento cobre
  // a página ANTES de o conteúdo aparecer e fica uns 2,5 segundos.
  var domReady = document.readyState !== 'loading';
  document.addEventListener('DOMContentLoaded', function () { domReady = true; });
  function whenReady(fn) { if (domReady) fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function runLoader() {
    if (reduce) { whenReady(afterIntro); return; }

    var L = document.createElement('div');
    L.id = 'px-loader';
    L.innerHTML = '<div class="px-stage"></div><div class="px-name">LFT.</div>' +
      '<button type="button" class="px-skip">Skip intro <kbd>ESC</kbd></button>';
    root.appendChild(L); // ainda não existe <body>: entra direto no <html>
    root.style.overflow = 'hidden';

    var stage = L.querySelector('.px-stage');
    var critter = makeCritter();
    critter.classList.add('walk');
    critter.style.width = '40px'; critter.style.height = '44px';
    stage.appendChild(critter);
    var bubble = document.createElement('div');
    bubble.className = 'px-bubble';
    bubble.textContent = 'LOADING 0%';
    stage.appendChild(bubble);

    var W = stage.clientWidth, H = stage.clientHeight, B = 16;
    var cols = Math.floor(W / B);
    // caminho em degraus: sobe, plana, sobe de novo
    function yAt(i) {
      var t = i / cols;
      var lvl = Math.round(3 * Math.sin(t * Math.PI * 2.2) + t * 4);
      return H / 2 + 40 - lvl * B;
    }
    var blocks = [], placed = 0, start = performance.now(), MIN = 2400, killed = false;

    function tick(now) {
      if (killed) return;
      var t = Math.min(1, (now - start) / MIN);
      var cap = domReady ? 1 : 0.9; // só termina quando o HTML terminou de chegar
      var p = Math.min(t, cap);
      var target = Math.floor(p * cols);
      while (placed < target) {
        var b = document.createElement('i');
        b.className = 'px-block';
        b.style.left = (placed * B) + 'px';
        b.style.top = yAt(placed) + 'px';
        stage.appendChild(b);
        blocks.push(b);
        if (placed > 3) blocks[placed - 4].classList.add('old');
        placed++;
      }
      var x = placed * B - 6, y = yAt(Math.max(0, placed - 1)) - 40;
      critter.style.left = x + 'px'; critter.style.top = y + 'px';
      bubble.style.left = (x + 22) + 'px'; bubble.style.top = (y - 8) + 'px';
      bubble.textContent = 'LOADING ' + Math.round(p * 100) + '%';
      if (p >= 1) { bubble.textContent = 'READY!'; setTimeout(finish, 140); return; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // segurança: nunca prender o visitante
    setTimeout(function () { domReady = true; }, 2500);

    function finish() {
      if (killed) return; killed = true;
      L.classList.add('out');
      var tiles = document.createElement('div');
      tiles.className = 'px-tiles';
      var c = 16, r = Math.ceil(c * innerHeight / innerWidth);
      tiles.style.gridTemplateColumns = 'repeat(' + c + ',1fr)';
      tiles.style.gridTemplateRows = 'repeat(' + r + ',1fr)';
      var list = [];
      for (var i = 0; i < c * r; i++) { var k = document.createElement('i'); tiles.appendChild(k); list.push(k); }
      L.appendChild(tiles);
      list.sort(function () { return Math.random() - .5; });
      var step = Math.ceil(list.length / 6), n = 0;
      var iv = setInterval(function () {
        for (var j = 0; j < step && n < list.length; j++, n++) list[n].style.visibility = 'hidden';
        if (n >= list.length) {
          clearInterval(iv); L.remove(); root.style.overflow = '';
          whenReady(afterIntro);
        }
      }, 35);
    }
    L.querySelector('.px-skip').addEventListener('click', finish);
    document.addEventListener('keydown', function onKey(e) { if (e.key === 'Escape') { finish(); document.removeEventListener('keydown', onKey); } });
  }

  /* ---------- efeito máquina de escrever (texto final idêntico ao original) ---------- */
  function decode(el, dur) {
    if (reduce || el.__px) return;
    if (el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return;
    el.__px = true;
    var node = el.firstChild, final = node.nodeValue, len = final.length, t0 = performance.now();
    var label = el.getAttribute('aria-label');
    if (!label) el.setAttribute('aria-label', final.trim());
    el.classList.add('px-typing');
    (function frame(now) {
      var p = Math.min(1, (now - t0) / dur);
      node.nodeValue = final.slice(0, Math.floor(p * len));
      if (p < 1) requestAnimationFrame(frame);
      else {
        node.nodeValue = final;
        if (!label) el.removeAttribute('aria-label');
        setTimeout(function () { el.classList.remove('px-typing'); }, 900);
      }
    })(t0);
  }

  /* ---------- criatura caminhando num trilho ---------- */
  function patrol(host, opts) {
    var c = makeCritter();
    c.classList.add('walk');
    host.appendChild(c);
    var x = opts.start || 0, dir = 1, pause = 0, last = performance.now(), visible = false, running = false;
    c.style.left = x + 'px';
    if (opts.top != null) c.style.top = opts.top + 'px';
    if (opts.bottom != null) c.style.bottom = opts.bottom + 'px';
    function loop(now) {
      if (!visible) { running = false; return; }
      var dt = Math.min(50, now - last); last = now;
      var max = Math.max(0, (opts.width ? opts.width() : host.clientWidth) - 33);
      if (pause > 0) { pause -= dt; c.classList.remove('walk'); }
      else {
        c.classList.add('walk');
        x += dir * (opts.speed || 0.045) * dt;
        if (x >= max) { x = max; dir = -1; pause = 900 + Math.random() * 1600; }
        if (x <= 0) { x = 0; dir = 1; pause = 900 + Math.random() * 1600; }
        if (Math.random() < 0.0015) pause = 600 + Math.random() * 1200;
      }
      c.classList.toggle('flip', dir < 0);
      c.style.left = Math.round(x / 3) * 3 + 'px'; // anda em "pixels" de 3px
      requestAnimationFrame(loop);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
      }).observe(host);
    } else { visible = true; running = true; requestAnimationFrame(loop); }
    return c;
  }

  /* ---------- rastro de pixels sob o cursor ---------- */
  function trail() {
    if (reduce || !(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches)) return;
    var cv = document.createElement('canvas');
    cv.id = 'px-trail';
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d'), G = 22, cells = {}, active = false, dpr = Math.min(2, devicePixelRatio || 1);
    function size() { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; }
    size(); addEventListener('resize', size);
    addEventListener('mousemove', function (e) {
      var oy = scrollY % G;
      var cx = Math.floor(e.clientX / G), cy = Math.floor((e.clientY + oy) / G);
      cells[cx + ',' + cy] = 1;
      if (!active) { active = true; requestAnimationFrame(draw); }
    }, { passive: true });
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      var oy = scrollY % G, any = false;
      for (var k in cells) {
        var a = cells[k];
        if (a <= 0.02) { delete cells[k]; continue; }
        any = true;
        var p = k.split(',');
        ctx.fillStyle = 'rgba(161,42,67,' + (a * 0.16).toFixed(3) + ')';
        ctx.fillRect(p[0] * G + 4, p[1] * G - oy + 4, G - 8, G - 8);
        cells[k] = a * 0.93;
      }
      if (any) requestAnimationFrame(draw); else { active = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    }
  }

  /* ---------- montagem ---------- */
  var built = false;
  function build() {
    if (built) return; built = true;

    // hero: chão de pixels + criatura
    var hero = document.getElementById('newsroom');
    if (hero) {
      var ground = document.createElement('div');
      ground.className = 'px-ground';
      ground.setAttribute('aria-hidden', 'true');
      hero.appendChild(ground); // a lupa aparece só na tela de carregamento
    }

    // revelação das imagens dos cards
    var imgs = document.querySelectorAll('.card-article img, .featured-article > img, .ai-doctors-image img');
    if ('IntersectionObserver' in window && !reduce) {
      // observa o elemento-pai: o clip-path da própria imagem zeraria a interseção
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { (e.target.__pxImgs || []).forEach(function (im) { im.classList.add('px-in'); }); io.unobserve(e.target); }
        });
      }, { threshold: 0.1 });
      imgs.forEach(function (im) {
        var p = im.parentElement;
        im.classList.add('px-reveal-img');
        (p.__pxImgs = p.__pxImgs || []).push(im);
        io.observe(p);
      });
    }

    trail();
  }

  function afterIntro() {
    build();
    var h = document.querySelector('#newsroom .nr-hud h2');
    if (h) decode(h, 900);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { decode(e.target, 700); io.unobserve(e.target); } });
      }, { threshold: 0.6 });
      document.querySelectorAll('h2.section-title, h3.subsection-title, .footer h2').forEach(function (t) { io.observe(t); });
    }
  }

  runLoader();
})();
