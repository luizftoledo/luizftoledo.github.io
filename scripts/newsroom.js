/* Isometric newsroom intro for luizftoledo.github.io
   An illustrative open-plan broadcast newsroom seen from above. Objects on the floor
   (the studio, the video wall, a monitor, the printer…) open real stories and videos
   from the portfolio. Self-contained: needs <section id="newsroom"> with a <canvas>,
   .nr-hotspots and .nr-panel inside. Pauses off-screen, honours reduced motion and
   follows the site's light/dark toggle. */
(function () {
  'use strict';
  var root = document.getElementById('newsroom');
  if (!root) return;
  var canvas = root.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var hotLayer = root.querySelector('.nr-hotspots');
  var panel = root.querySelector('.nr-panel');
  var panelBody = panel && panel.querySelector('.nr-panel-body');
  var clockEl = root.querySelector('[data-nr-clock]');
  var pauseBtn = root.querySelector('[data-nr-pause]');
  var LINK = root.hasAttribute('data-link-base') ? root.getAttribute('data-link-base') : null; // '' = same page: tags scroll to that section // standalone mode: name tags link to the portfolio instead of opening a panel
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ================= content (all from the portfolio) ================= */
  var YT = {
    featured: { id: 'QlunKw_CKPY', start: 169, title: 'AI, deepfakes and the fight for Brazil\'s vote', src: 'Global Eye, BBC World Service' },
    timeline: { id: 'SkX6MKU9gAQ', start: 22, title: 'A curiosa linha do tempo da evolução da inteligência artificial', src: 'BBC News Brasil' },
    alcohol: { id: 'r5Ihpa2DQIg', start: 0, title: 'The fake alcohol killing people in Brazil', src: 'What in the World podcast, BBC World Service' },
    bubble: { id: '65AnDszCevA', start: 0, title: 'Por que cada vez mais analistas falam em "bolha" da inteligência artificial', src: 'BBC News Brasil' },
    deepfakes: { id: 'M46TWtihWMs', start: 0, title: 'Os deepfakes que tentam te enganar - e gerar dinheiro | Eleições 2026', src: 'BBC News Brasil' },
    epstein: { id: 'Nl5eRXVkW9Y', start: 0, title: 'Brasileira conta à BBC como foi aliciada para Epstein em São Paulo', src: 'BBC News Brasil' },
    chatgpt: { id: 'HEwY0WKeKjc', start: 0, title: 'ChatGPT: o que você não vê', src: 'BBC News Brasil' },
    trafico: { id: 'RhHz-bizvs0', start: 0, title: 'Como redes sociais estão influenciando ida de jovens para o tráfico', src: 'BBC News Brasil' },
    bukele: { id: 'CzK178HYEB8', start: 0, title: 'Brasil poderia imitar política de detenção em massa de Bukele?', src: 'BBC News Brasil' },
    doctors: { id: 'ZPbhHhE22uY', start: 0, title: 'Os médicos falsos feitos por IA que viralizam entre idosos no Brasil', src: 'BBC News Brasil' },
    lacres: { id: '4NTyfMsgtY4', start: 0, title: 'Como funciona a venda de lacres falsos, tampas e garrafas de bebidas alcoólicas no Facebook', src: 'BBC News Brasil' },
    estudos: { id: 'HNGaWGIAnso', start: 0, title: 'Como não deixar o ChatGPT atrapalhar seus estudos', src: 'BBC News Brasil' },
    pets: { id: 'rTybgh71xFU', start: 0, title: 'Os influencers que ganham fama exibindo animais selvagens como pets', src: 'BBC News Brasil' },
    tarifaco: { id: '3KnxcFxVcF0', start: 0, title: 'Tarifaço prejudica Estados \'bolsonaristas\'', src: 'BBC News Brasil' },
    donamaria: { id: 'PZBbBkKNAxk', start: 0, title: 'Quem é Dona Maria, a personagem de IA que viraliza falando mal de Lula e do STF', src: 'BBC News Brasil' },
    pituca: { id: '0KVyLHjj1Fs', start: 0, title: 'Ibama x influenciadora: a briga na Justiça pela guarda da jaguatirica Pituca', src: 'BBC News Brasil' },
    entrevista: { id: 'QcZqdD7_gLA', start: 0, title: 'Entrevista de emprego feita por IA?', src: 'BBC News Brasil' },
    bilionarios: { id: 'gGn1hGMyKt0', start: 0, title: 'Os bilionários que aparecem nos novos arquivos do caso Epstein', src: 'BBC News Brasil' },
    textoia: { id: 'M-Z_CBMsC9k', start: 0, title: 'Dá para identificar texto gerado por inteligência artificial?', src: 'BBC News Brasil' },
    pirarucu: { id: 'EbfqG95jozQ', start: 0, title: 'Peixe gigante da Amazônia vira bolsa de luxo de $ 8 mil. Quanto ganham os pescadores?', src: 'BBC News Brasil' },
    itau: { id: 'tzmMq7WpeUc', start: 0, title: 'Demitido do Itaú por produtividade baixa no home office', src: 'BBC News Brasil' },
    gijc: { id: 'urDaCInPdvY', start: 19, title: 'Investigating environmental crimes', src: 'GIJC 2023, Gothenburg' },
    sbt: { id: 'rqvT39YIsP0', start: 149, title: 'Transparency and investigative journalism in Brazil', src: 'SBT News' },
    fil: { id: 'dw5q9ZXMaWE', start: 26, title: 'Presenting DataFixers.org', src: 'FIL Lisbon Conference' },
    cnn: { id: 'PP8bv7osKMo', start: 35, title: 'The air-charter investigation and transparency in government spending', src: 'CNN Brasil' },
    course: { id: '-hXN1-wq8Kk', start: 0, title: 'Como usar IA no jornalismo?', src: 'Course, in Portuguese' }
  };
  var HERO = ['featured', 'timeline', 'alcohol', 'bubble']; // the four videos in the player at the top of the home page
  var DECOR = ['M46TWtihWMs', 'CzK178HYEB8', 'RhHz-bizvs0', 'HEwY0WKeKjc', 'ZPbhHhE22uY'];
  var TICKER = 'EPSTEIN FILES  ·  BBC series prompts a federal prosecution inquiry in Brazil      AI DOCTORS  ·  YouTube removes most channels after BBC investigation      FAKE ALCOHOL  ·  network of 10,000+ sellers of bottle seals exposed      SECRET BUDGET  ·  amendment funded stones cut with slave labour      ';

  var BBCPT = 'https://www.bbc.com/portuguese/articles/';
  var SECTIONS = {
    videos: {
      label: 'Video reporting', kicker: 'On air', title: 'Video reporting', anchor: '#short-videos',
      intro: 'Reporting, scripting and presenting for BBC News Brasil and the BBC World Service. Pick a video:',
      playlist: HERO.concat(['deepfakes', 'epstein', 'doctors', 'chatgpt', 'trafico', 'bukele', 'donamaria', 'bilionarios', 'lacres', 'pirarucu', 'entrevista', 'textoia', 'estudos', 'pets', 'pituca', 'tarifaco', 'itau'])
    },
    investigative: {
      label: 'Investigative Reporting', kicker: 'The investigations desk', title: 'Investigative Reporting', anchor: '#investigative', video: 'epstein',
      items: [
        { t: 'The Epstein–Brazil connection', k: 'BBC News Brasil · 9-part series', img: 'images/epstein.jpeg', d: 'Millions of released files searched with scrapers; the series led to a Federal Prosecution investigation in Brazil.', links: [['#epstein-investigation', 'Read the series'], ['https://www.bbc.com/news/articles/cr4576v66kno', 'In English ↗']] },
        { t: 'The global industry of AI-generated fake doctors targeting elderly Brazilians', k: 'BBC News Brasil', img: 'images/ai_fake_doctors_youtube.png', links: [[BBCPT + 'cz0j8lp5xmvo', 'Read the original ↗'], [BBCPT + 'cn4ddgl7vkno', 'Follow-up ↗']] },
        { t: 'Sexual abuse in Brazil\'s military schools', k: 'BBC News Brasil', img: 'images/military_schools_abuse_1770375222284.png', links: [[BBCPT + 'c5ydlv11pe1o', 'Read the original ↗'], ['portfolio-investigativo/escolas-militares/index.html', 'In English']] },
        { t: 'How fake bottle caps and seals fuel Brazil\'s counterfeit alcohol market', k: 'BBC News Brasil', img: 'images/metanol.jpg', links: [[BBCPT + 'ce84kg923ero', 'Read the original ↗'], ['portfolio-investigativo/metanol/index.html', 'In English']] },
        { t: 'Giant Amazon fish turned into luxury handbags – but who profits?', k: 'BBC News Brasil', img: 'images/amazon_fish_pirarucu.png', links: [[BBCPT + 'cy40vwy4v13o.amp', 'Read the original ↗'], ['portfolio-investigativo/pirarucu/index.html', 'In English']] },
        { t: 'Secret Budget Amendment Linked to Slave Labor', k: 'BBC News Brasil', img: 'images/slave_labor_stone.png', links: [[BBCPT + 'c1drv0wkr9ro', 'Read the original ↗'], ['portfolio-investigativo/orcamento-secreto/index.html', 'In English']] },
        { t: 'Brazilians Face Abuse in Irish Meat Industry', k: 'BBC News Brasil', img: 'images/irish_meat_industry.png', links: [[BBCPT + 'cdd900l6dnmo', 'Read the original ↗'], ['portfolio-investigativo/irlanda/index.html', 'In English']] },
        { t: 'Failed enforcement: indigenous objects containing animal parts are freely sold online', k: 'UOL', img: 'images/indigenous_artifacts_smuggling.png', links: [['https://tab.uol.com.br/noticias/redacao/2024/07/31/venda-ilegal-de-artefatos-indigenas-cresce-com-baixa-fiscalizacao-nas-redes.htm', 'Read the original ↗'], ['portfolio-investigativo/artefatos-indigenas/index.html', 'In English']] },
        { t: 'Political Backing Fuels Land Grabbing in Brazil\'s Distrito Federal', k: 'Revista Piauí', img: 'images/land_grabbing_df.png', links: [['https://piaui.folha.uol.com.br/distrito-federal-grileiros-car-brasilia/', 'Read the original ↗'], ['portfolio-investigativo/grileiros-df/index.html', 'In English']] },
        { t: 'A world heritage site under attack in Brazil', k: 'Revista Piauí · OCCRP', img: 'images/violin.jpg', links: [['https://piaui.folha.uol.com.br/um-parque-no-coracao-do-contrabando-de-pau-brasil/', 'Read the original ↗'], ['portfolio-investigativo/pau-brasil/index.html', 'In English']] }
      ]
    },
    ai: {
      label: 'Investigating AI', kicker: 'The AI desk', title: 'Investigating AI', anchor: '#investigating-ai', video: 'doctors',
      items: [
        { t: 'AI-generated videos that eroticise Brazil\'s brutal history are reaching millions on YouTube', k: 'BBC News Brasil · featured', img: 'images/ai_fake_doctors_illustration.png', links: [[BBCPT + 'c3r0194grx2o', 'Read ↗'], ['https://www.instagram.com/p/DcosT9TE5T3/', 'Instagram ↗']] },
        { t: 'The global underground industry of fake AI doctors', k: 'BBC News Brasil', links: [[BBCPT + 'cz0j8lp5xmvo', 'Read ↗']] },
        { t: '‘Fatal harm’: a doctor finds his face cloned by AI', k: 'BBC News Brasil · follow-up', links: [[BBCPT + 'cn4ddgl7vkno', 'Read ↗']] },
        { t: 'Workers saying goodbye to formal employment to chase the dream of making AI videos', k: 'Work and platforms', links: [[BBCPT + 'c5yzyy730nro', 'Read ↗']] },
        { t: 'The flood of AI videos designed to ‘hypnotise’ children on YouTube', k: 'Children and attention', links: [[BBCPT + 'cx2xx1gp6jgo', 'Read ↗']] },
        { t: 'The clandestine market for AI-made ‘candidate supporters’', k: 'Elections', links: [[BBCPT + 'c1k2zj3gdg7o', 'Read ↗']] },
        { t: 'We asked AI who to vote for — here\'s what it said', k: 'Political influence', links: [[BBCPT + 'c5y0kv55j11o', 'Read ↗']] },
        { t: 'The AI character going viral with attacks on Lula\'s government and Brazil\'s Supreme Court', k: 'Synthetic personas', links: [[BBCPT + 'c7vq10lvv15o', 'Read ↗']] },
        { t: 'Your therapist is human — but may be using AI in therapy', k: 'Mental health', links: [[BBCPT + 'c1j9gnxnk4zo', 'Read ↗']] },
        { t: 'The Brazilian creator translating the chaos of AI', k: 'Public understanding', links: [[BBCPT + 'c9v1292nrzro', 'Read ↗']] },
        { t: 'What it\'s like to interview for a job with artificial intelligence', k: 'Workplaces', links: [[BBCPT + 'cewyng440vro', 'Read ↗']] }
      ]
    },
    osint: {
      label: 'OSINT Investigations', kicker: 'The OSINT board', title: 'OSINT Investigations', anchor: '#osint-investigations',
      intro: 'Reporting on Brazil from another country is a challenge. I have increasingly turned to open-source tools and public records to investigate public officials, companies and policy decisions.',
      items: [
        { t: 'Jaques Wagner: what a takedown request got wrong', k: '01 / Source code', links: [[BBCPT + 'cr3wj2jljej0o', 'Read the investigation ↗']] },
        { t: 'Tracing a phone number linked to a Supreme Court justice', k: '02 / Digital traces', links: [[BBCPT + 'c4gqm6vqd33o', 'Digital accounts ↗'], [BBCPT + 'c4gk300l15eo', 'Further evidence ↗']] },
        { t: 'Who was behind false health advice online?', k: '03 / Website forensics', links: [[BBCPT + 'cz0j8lp5xmvo', 'Read the investigation ↗']] },
        { t: 'Jeffrey Epstein\'s property in São Paulo', k: '04 / Public records', links: [[BBCPT + 'cm21e7gnx0ro', 'Read the investigation ↗']] },
        { t: 'Allegations at a civic-military school', k: '05 / Accountability', links: [[BBCPT + 'c5ydlv11pe1o', 'Read the investigation ↗']] }
      ]
    },
    interviews: {
      label: 'Interviews', kicker: 'On the sofa', title: 'Interviews', anchor: '#interviews',
      playlist: ['gijc', 'cnn', 'sbt', 'fil'],
      items: [
        { t: 'Bellingcat\'s Stage Talks', k: 'Podcast · in English', d: 'Using public records and data to investigate environmental crimes in Brazil.', links: [['https://open.spotify.com/episode/4qtV3XWFUwFtan4jThFKX1', 'Listen on Spotify ↗']] },
        { t: 'TV Globo/G1 Podcast (O Assunto)', k: 'Podcast', d: 'The corporate expenses investigation.', links: [['https://open.spotify.com/episode/1UsnrR0DjRKHyd1fPlVtmn', 'Listen on Spotify ↗']] }
      ]
    },
    initiatives: {
      label: 'Initiatives I\'ve led', kicker: 'The FOI archive', title: 'Initiatives I\'ve led', anchor: '#initiatives-led',
      items: [
        { t: 'Datafixers', k: '2022 – present · Founder', d: 'US$100,000 grant from the Brown Institute (Columbia). Gabo Prize 2024 with InfoAmazonia. Best data project in Brazil 2023. Published with ICIJ, OCCRP and the BBC.', links: [['https://datafixers.org/', 'datafixers.org ↗']] },
        { t: 'Abraji', k: '2019 – 2024 · Director for FOIA projects', d: 'National research on Brazil\'s access to information law; contributed to training 2,000+ journalists.' },
        { t: 'Fiquem Sabendo', k: '2019 – 2023 · Cofounder, content director', d: 'Nonprofit specialised in public records requests. The presidential corporate-card project triggered investigations against current and former presidents.' },
        { t: 'Jeduca', k: 'Present · Director, course co-creator', d: 'Co-created a course taken by 1,000+ journalists and students.' }
      ]
    },
    awards: {
      label: 'Awards', kicker: 'The trophy shelf', title: 'Awards and Honorable Mentions', anchor: '#awards',
      items: [
        { t: 'Prêmio Gabo 2024 — coverage with InfoAmazonia and Datafixers.org', k: '2024 · Winner · Fundación Gabo' },
        { t: 'Sigma Awards', k: '2024 · Shortlist' },
        { t: 'Prêmio Claudio Weber Abramo — Dados Abertos', k: '2023 · Winner · Escola de Dados / Open Knowledge Brasil' },
        { t: 'Prêmio Claudio Weber Abramo — Investigação', k: '2023 · Winner · Escola de Dados / Open Knowledge Brasil' },
        { t: 'Transparency and Public Oversight Prize, with Fiquem Sabendo', k: '2022 · Winner · Câmara dos Deputados' },
        { t: 'Prêmio Estado de Jornalismo, reporting and service', k: '2017–2018 · Winner · O Estado de S. Paulo' },
        { t: 'ANPR Prize — exposing a child sexual abuse material network', k: '2017 · Winner · ANPR' },
        { t: 'Allianz Ayrton Senna Prize — school closures in São Paulo', k: '2016 · Winner · Instituto Ayrton Senna' }
      ],
      more: 'See all 25 awards and shortlists'
    },
    research: {
      label: 'Research & fellowships', kicker: 'The library', title: 'Research & fellowships', anchor: '#research-fellowships',
      items: [
        { t: 'Cambridge · POLIS', k: '2024 – present', d: 'Research assistant, Prison Consensus Project.' },
        { t: 'National Endowment for Democracy', k: '2023 – 2024', d: 'Reagan-Fascell fellow on AI in investigative journalism.' },
        { t: 'Brown Institute, Columbia', k: '2022 – 2023', d: 'Media innovation fellowship; US$100k grant to Datafixers.' },
        { t: 'Columbia University', k: '2021 – 2022', d: 'MS Data Journalism (full scholarship).' },
        { t: 'Oxford · Reuters Institute', k: '2021', d: 'Trust in News fellow; course for 300+ journalists.' },
        { t: 'FGV-EAESP', k: '2019 – 2021', d: 'MS Public Administration (full scholarship); FOI research adopted by government.' }
      ],
      more: 'Research, fellowships and grants'
    },
    academic: {
      label: 'Academic research', kicker: 'Peer-reviewed research', title: 'Academic research', anchor: '#academic-research',
      intro: 'Research on state secrecy and transparency in Brazil, and on the political economy of the country\'s prison expansion with the Prison Consensus Project at the University of Cambridge.',
      items: [
        { t: 'Growing in and from Crisis: Environment, Labor, and Capital in Brazil\u2019s Exponential Prison Expansion', k: 'Annals of the American Association of Geographers · 2026', d: 'How prison managers claim the prison is useful against economic and environmental problems, and why those claims entrench the carceral system.', links: [['https://doi.org/10.1080/24694452.2026.2688357', 'Read the article ↗']] },
        { t: 'The legal regime of classified information in Brazil', k: 'Cadernos EBAPE.BR (FGV)', d: 'With Marcio Cunha Filho. Classification escapes effective accountability and can lead agencies to overclassify public information.', links: [['https://www.scielo.br/j/cebape/a/JbgP4kK8GsbkPK8gL7c6MqK/?lang=en', 'Read the article ↗']] },
        { t: 'Failing to Grow: How Walls Become Doorways in the Making of Brazilian Mass Incarceration', k: 'Comparative Studies in Society and History · forthcoming' },
        { t: 'Policy and its Underside: Planning for the Prison', k: 'Routledge Companion to Urban Planning · forthcoming' },
        { t: 'Desclassificação tarjada: o sigilo de documentos das forças armadas brasileiras', k: 'Master\'s thesis · FGV EAESP · 2021', d: 'The Armed Forces declassified 394,400+ documents since 2013, but released them so heavily redacted that they stayed incomprehensible.', links: [['https://repositorio.fgv.br/items/e0088610-e3e2-4c40-afad-4461cf6e2df6', 'Read the thesis ↗']] }
      ]
    },
    courses: {
      label: 'Courses & workshops', kicker: 'The training corner', title: 'Courses & workshops', anchor: '#courses-workshops', video: 'course',
      items: [
        { t: 'Investigate public spending with the Brazilian Freedom of Information Act', k: 'Udemy · Portuguese · 4.6/5 · 428 students', links: [['https://www.udemy.com/course/investigue-gastos-publicos-com-a-lei-de-acesso-a-informacao/', 'View on Udemy ↗']] },
        { t: 'Kit de Ferramentas Gemini para Jornalistas', k: 'Abraji, with Google support', links: [['https://www.abraji.org.br/noticias/abraji-lanca-iniciativa-para-auxiliar-investigacoes-com-o-uso-da-ia', 'Read more ↗']] },
        { t: 'Jornalismo de Educação: Bases para a Cobertura', k: 'Jeduca · Abraji · 11 sessions', links: [['https://jeduca.org.br/noticia/inscricoes-abertas-para-o-curso-especial-de-jornalismo-de-educacao-de-10-anos-da-jeduca', 'Read more ↗']] }
      ]
    }
  };

  /* ================= world ================= */
  var GW = 24, GD = 16, WALL = 130;
  function iso(x, y, z) { return [(x - y) * 32, (x + y) * 16 - (z || 0)]; }

  var PAL = {
    light: {
      ink: '#23262e', carpet: '#cfd0d0', carpetLine: 'rgba(35,38,46,.06)', redCarpet: '#a33440', slabL: '#5c6068', slabR: '#474a52',
      red: '#c8283a', redD: '#9e1f2d', redL: '#e0525f', white: '#f7f7f4', whiteL: '#e3e4e3', whiteR: '#c8cacc',
      wall: '#e4e1db', wallR: '#d9d5ce', upper: '#c9c5bd', upperR: '#bdb8af', cap: '#f3f1ec', glass: 'rgba(170,205,214,.55)', glassLine: 'rgba(35,38,46,.35)',
      mon: '#2a2e36', monL: '#3a3f49', screen: '#dbeef0', screenLine: '#3f7d79', chair: '#383b43', chairD: '#24272d',
      gold: '#e3ab3a', goldD: '#b8862a', wood: '#c99f6b', woodD: '#a97f4f', woodDD: '#8a6437', plant: '#4f8a67', plantD: '#35664b',
      paper: '#fffdf8', metal: '#cfd3d6', metalD: '#9aa1a6', shade: 'rgba(35,38,46,.15)', dot: 'rgba(35,38,46,.16)', studio: '#4a4d56', night: 0
    },
    dark: {
      ink: '#0b0d12', carpet: '#34373f', carpetLine: 'rgba(255,255,255,.035)', redCarpet: '#5e1f28', slabL: '#1c1e24', slabR: '#15171b',
      red: '#b4283a', redD: '#801c29', redL: '#e0525f', white: '#b9bbbd', whiteL: '#9a9c9f', whiteR: '#7b7e82',
      wall: '#3a3d48', wallR: '#32353f', upper: '#2b2e37', upperR: '#262830', cap: '#474b57', glass: 'rgba(90,130,160,.35)', glassLine: 'rgba(0,0,0,.45)',
      mon: '#16181d', monL: '#22252c', screen: '#8ff5ea', screenLine: '#177068', chair: '#202228', chairD: '#15171b',
      gold: '#d49c2c', goldD: '#a6781f', wood: '#8e7556', woodD: '#735e44', woodDD: '#5b4a35', plant: '#3f7055', plantD: '#2c523d',
      paper: '#d9d6cd', metal: '#6f7580', metalD: '#555a64', shade: 'rgba(0,0,0,.30)', dot: 'rgba(0,0,0,.30)', studio: '#2a2c33', night: 1
    }
  };
  var P = PAL.light, dotPattern = null;
  function readTheme() {
    P = document.documentElement.getAttribute('data-site-theme') === 'dark' ? PAL.dark : PAL.light;
    var c = document.createElement('canvas'); c.width = c.height = 8;
    var g = c.getContext('2d'); g.fillStyle = P.dot; g.beginPath(); g.arc(2, 2, 1, 0, 7); g.arc(6, 6, 1, 0, 7); g.fill();
    dotPattern = ctx.createPattern(c, 'repeat');
  }

  /* thumbnails for screens */
  var THUMB = {};
  // thumbnails are downscaled once into small canvases: drawing a 320px photo through a skew
  // transform every frame is the most expensive thing on the page, a 96px canvas is cheap
  function thumb(id) {
    if (!THUMB[id]) {
      var holder = { complete: false, naturalWidth: 0 };
      var im = new Image(); im.decoding = 'async';
      im.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = 96; c.height = 54;
          c.getContext('2d').drawImage(im, 0, 0, 96, 54);
          holder.canvas = c; holder.complete = true; holder.naturalWidth = 96;
        } catch (e) { /* ignore */ }
      };
      im.src = 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
      THUMB[id] = holder;
    }
    return THUMB[id];
  }
  function ready(im) { return !!(im && im.canvas); }

  /* ================= drawing helpers ================= */
  function path(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
  function poly(pts, fill, stroke, dots) {
    path(pts);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (dots) { ctx.fillStyle = dotPattern; ctx.fill(); }
    if (stroke !== false) { ctx.strokeStyle = stroke || P.ink; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function box(x, y, z, w, d, h, c) {
    poly([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], c.l, c.s, c.dl);
    poly([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)], c.r, c.s, c.dr === true);
    poly([iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], c.t, c.s);
  }
  function C3(t, l, r) { return { t: t, l: l, r: r }; }
  function line(a, b, col, w) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = col || P.ink; ctx.lineWidth = w || 1; ctx.stroke(); }
  function ell(x, y, rx, ry, fill, stroke) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } }
  function circ(cx, cy, R, z, a0, a1, n) {
    var pts = [], k; n = n || 28;
    for (k = 0; k <= n; k++) { var a = a0 + (a1 - a0) * k / n; pts.push(iso(cx + Math.cos(a) * R, cy + Math.sin(a) * R, z)); }
    return pts;
  }
  // Planes. Wall y=Y faces +y; text/images run left→right with transform (1,.5). Wall x=X faces +x: (1,-.5).
  function onPlaneY(Y, u, v, fn) { var o = iso(u, Y, v); ctx.save(); ctx.transform(1, .5, 0, 1, o[0], o[1]); fn(); ctx.restore(); }
  function onPlaneX(X, u, v, fn) { var o = iso(X, u, v); ctx.save(); ctx.transform(1, -.5, 0, 1, o[0], o[1]); fn(); ctx.restore(); }
  function rectY(Y, u0, u1, v0, v1, fill, stroke, dots) { poly([iso(u0, Y, v0), iso(u1, Y, v0), iso(u1, Y, v1), iso(u0, Y, v1)], fill, stroke, dots); }
  function rectX(X, u0, u1, v0, v1, fill, stroke, dots) { poly([iso(X, u0, v0), iso(X, u1, v0), iso(X, u1, v1), iso(X, u0, v1)], fill, stroke, dots); }

  /* build-in animation */
  var time = 0;
  function appear(key) {
    if (reduce) return 1;
    var t = (time - 700 - key * 38) / 480;
    return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
  }
  function drop(key, fn) {
    var a = appear(key); if (a <= 0) return false;
    if (a >= 1) { fn(); return true; }
    ctx.save(); ctx.globalAlpha *= Math.min(1, a * 1.5); ctx.translate(0, -(1 - a) * 70); fn(); ctx.restore(); return true;
  }

  /* ================= room shell ================= */
  function drawFloor() {
    var dz = 14;
    poly([iso(0, GD, 0), iso(GW, GD, 0), iso(GW, GD, -dz), iso(0, GD, -dz)], P.slabL, undefined, true);
    poly([iso(GW, 0, 0), iso(GW, GD, 0), iso(GW, GD, -dz), iso(GW, 0, -dz)], P.slabR, undefined, true);
    poly([iso(0, 0), iso(GW, 0), iso(GW, GD), iso(0, GD)], P.carpet);
    ctx.save(); path([iso(0, 0), iso(GW, 0), iso(GW, GD), iso(0, GD)]); ctx.clip();
    ctx.globalAlpha = .45; ctx.fillStyle = dotPattern; ctx.fill(); ctx.globalAlpha = 1;
    for (var i = 1; i < GW; i++) line(iso(i, 0), iso(i, GD), P.carpetLine);
    for (var j = 1; j < GD; j++) line(iso(0, j), iso(GW, j), P.carpetLine);
    // red carpet "rivers" along the main aisles and around the studio
    poly(circ(4.5, 4.2, 3.4, 0, 0, Math.PI * 2, 40), P.redCarpet, false);
    poly([iso(0, 9.55), iso(GW, 9.55), iso(GW, 10.65), iso(0, 10.65)], P.redCarpet, false);
    poly([iso(13.75, 5.2), iso(14.85, 5.2), iso(14.85, GD), iso(13.75, GD)], P.redCarpet, false);
    ctx.globalAlpha = .25; poly([iso(0, 9.55), iso(GW, 9.55), iso(GW, 10.65), iso(0, 10.65)], dotPattern, false); ctx.globalAlpha = 1;
    if (P.night) {
      [[4.5, 4.2, 4], [12, 8, 3], [17, 4, 3], [21, 12, 3], [5, 12, 3]].forEach(function (L) {
        var c = iso(L[0], L[1]), r = L[2] * 40; ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(1, .5);
        var g = ctx.createRadialGradient(0, 0, 4, 0, 0, r); g.addColorStop(0, 'rgba(255,200,120,.20)'); g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.restore();
      });
    }
    ctx.restore();
  }

  function drawWalls() {
    var grow = reduce ? 1 : Math.min(1, time / 650); grow = 1 - Math.pow(1 - grow, 3);
    var H = WALL * grow;
    poly([iso(0, 0, 0), iso(0, GD, 0), iso(0, GD, H), iso(0, 0, H)], P.wall);
    poly([iso(0, 0, 0), iso(GW, 0, 0), iso(GW, 0, H), iso(0, 0, H)], P.wallR);
    var t = .25;
    poly([iso(0, 0, H), iso(0, GD, H), iso(-t, GD, H), iso(-t, -t, H), iso(GW, -t, H), iso(GW, 0, H)], P.cap);
    poly([iso(-t, GD, H), iso(0, GD, H), iso(0, GD, -14), iso(-t, GD, -14)], P.slabL, undefined, true);
    poly([iso(GW, -t, H), iso(GW, 0, H), iso(GW, 0, -14), iso(GW, -t, -14)], P.slabR, undefined, true);
    if (grow < .98) return;

    var u;
    for (u = 0; u < GW; u += 2) {
      if ((u / 2) % 3 === 1) rectY(0, u, u + 2, 0, 54, P.red, undefined, true);
      else { rectY(0, u, u + 2, 0, 54, P.glass, P.glassLine); line(iso(u + 1, 0, 0), iso(u + 1, 0, 54), P.glassLine); }
    }
    for (u = 0; u < GD; u += 2) {
      if ((u / 2) % 3 === 2) rectX(0, u, u + 2, 0, 54, P.red, undefined, true);
      else { rectX(0, u, u + 2, 0, 54, P.glass, P.glassLine); line(iso(0, u + 1, 0), iso(0, u + 1, 54), P.glassLine); }
    }
    rectY(0, 0, GW, 54, 61, P.cap, undefined); rectX(0, 0, GD, 54, 61, P.cap, undefined);
    rectY(0, 0, GW, 61, WALL, P.upperR, false, true); rectX(0, 0, GD, 61, WALL, P.upper, false, true);
    for (u = 3; u < GW - 1; u += 5) rectY(0, u, Math.min(GW, u + 2.4), 61, 96, P.red, undefined);
    for (u = 9; u < GD - 1; u += 5) rectX(0, u, Math.min(GD, u + 2.2), 61, 96, P.red, undefined);
    for (u = .8; u < GW; u += 1.25) onPlaneY(0, u, 116, function () { ell(0, 0, 10, 10, P.upper, P.ink); ell(0, 0, 5, 5, P.upperR, P.ink); });
    for (u = GD - .8; u > 0; u -= 1.25) onPlaneX(0, u, 116, function () { ell(0, 0, 10, 10, P.wall, P.ink); ell(0, 0, 5, 5, P.upper, P.ink); });
    rectY(.12, 0, GW, 61, 74, P.glass, false); line(iso(0, .12, 74), iso(GW, .12, 74), P.ink, 1.4);
    rectX(.12, 0, GD, 61, 74, P.glass, false); line(iso(.12, 0, 74), iso(.12, GD, 74), P.ink, 1.4);
    for (u = 1.5; u < GW; u += 1.5) line(iso(u, .12, 61), iso(u, .12, 74), P.glassLine);
    for (u = 1.5; u < GD; u += 1.5) line(iso(.12, u, 61), iso(.12, u, 74), P.glassLine);
    // row of small screens on the balcony front above the studio (x = 0 wall)
    for (var k = 0; k < 5; k++) {
      var u0 = 1.2 + k * 1.25;
      rectX(.2, u0, u0 + 1.05, 76, 92, P.mon, undefined);
      (function (id, u0) {
        var im = thumb(id);
        onPlaneX(.2, u0 + 1.0, 90.5, function () { if (ready(im)) { ctx.globalAlpha = .92; ctx.drawImage(im.canvas, 0, 0, 30.4, 13); } else { ctx.fillStyle = P.screen; ctx.fillRect(0, 0, 30.4, 13); } });
      })(DECOR[k], u0);
    }
    // investigation board on the ground floor, x = 0 wall
    rectX(.05, 10.7, 14.4, 12, 50, '#d9b58a', P.woodDD);
    [[11.0, 20, P.paper], [11.7, 34, P.gold], [12.5, 18, P.paper], [13.1, 36, '#f2d6d9'], [13.8, 22, P.paper], [11.2, 38, P.paper]].forEach(function (n) {
      rectX(.06, n[0], n[0] + .5, n[1], n[1] + 11, n[2], P.ink);
    });
    var pins = [[11.25, 27], [12.0, 42], [12.75, 25], [13.35, 43], [14.05, 29], [11.45, 45]];
    [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [0, 3]].forEach(function (s) { line(iso(.06, pins[s[0]][0], pins[s[0]][1]), iso(.06, pins[s[1]][0], pins[s[1]][1]), P.red, 1.1); });
    pins.forEach(function (p) { var q = iso(.06, p[0], p[1]); ell(q[0], q[1], 1.6, 1.6, P.red); });
    // clock (London time)
    var cp = iso(0, 13.2, 108), now = londonNow(), hh = now.h % 12 + now.m / 60, mm = now.m + now.s / 60;
    ctx.save(); ctx.translate(cp[0], cp[1]); ctx.transform(1, -.5, 0, 1, 0, 0);
    ell(0, 0, 10, 10, P.paper, P.ink);
    line([0, 0], [Math.sin(hh / 12 * 6.283) * 5.5, -Math.cos(hh / 12 * 6.283) * 5.5], P.ink, 1.6);
    line([0, 0], [Math.sin(mm / 60 * 6.283) * 8, -Math.cos(mm / 60 * 6.283) * 8], P.ink, 1);
    ctx.restore();
  }

  var LONDON_FMT = null;
  function londonNow() {
    var d = new Date();
    try {
      LONDON_FMT = LONDON_FMT || new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      var o = {}; LONDON_FMT.formatToParts(d).forEach(function (x) { o[x.type] = +x.value; });
      return { h: o.hour % 24, m: o.minute, s: o.second };
    } catch (e) { return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() }; }
  }

  /* ================= video wall (hangs in front of the balcony) ================= */
  var wallIdx = 0, wallT = 0;
  function drawVideoWall() {
    var Y = .45, u0 = 1.3, u1 = 9.0, v0 = 76, v1 = 118;
    line(iso(u0 + .6, Y, v1), iso(u0 + .6, Y, WALL), P.ink); line(iso(u1 - .6, Y, v1), iso(u1 - .6, Y, WALL), P.ink);
    poly([iso(u1, Y - .12, v0), iso(u1, Y, v0), iso(u1, Y, v1), iso(u1, Y - .12, v1)], P.whiteR);
    poly([iso(u0, Y - .12, v1), iso(u1, Y - .12, v1), iso(u1, Y, v1), iso(u0, Y, v1)], P.white);
    rectY(Y, u0, u1, v0, v1, P.white, undefined);
    var W2 = (u1 - u0) * 32 - 8, Hh = v1 - v0 - 6;
    onPlaneY(Y, u0, v1, function () {
      ctx.fillStyle = '#16181d'; ctx.fillRect(4, 3, W2, Hh);
      var tw = (W2 - 5 * 4) / 4, th = tw * 9 / 16;
      HERO.forEach(function (key, i) {
        var x = 8 + i * (tw + 4), y = 6, im = thumb(YT[key].id);
        if (ready(im)) ctx.drawImage(im.canvas, x, y, tw, th); else { ctx.fillStyle = '#2f333b'; ctx.fillRect(x, y, tw, th); }
        if (i !== wallIdx) { ctx.fillStyle = 'rgba(10,11,15,.45)'; ctx.fillRect(x, y, tw, th); }
        else { ctx.strokeStyle = '#e8414f'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, tw + 2, th + 2); }
      });
      var ty = 6 + th + 3, tH = Hh - th - 6;
      ctx.fillStyle = '#c8283a'; ctx.fillRect(4, ty, W2, tH);
      ctx.fillStyle = '#fff'; ctx.fillRect(4, ty, 30, tH);
      ctx.fillStyle = '#c8283a'; ctx.font = '700 6px "DM Mono",monospace'; ctx.fillText('NEWS', 9, ty + tH / 2 + 2.2);
      ctx.save(); ctx.beginPath(); ctx.rect(35, ty, W2 - 31, tH); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.font = '600 5.6px "DM Sans",sans-serif';
      var tw2 = ctx.measureText(TICKER).width, off = (time / 40) % tw2;
      ctx.fillText(TICKER, 38 - off, ty + tH / 2 + 2); ctx.fillText(TICKER, 38 - off + tw2, ty + tH / 2 + 2);
      ctx.restore();
    });
    var live = (Math.floor(time / 900) % 5) !== 4;
    rectY(Y, 9.4, 10.6, 104, 116, live ? '#d42c3d' : '#7a1c26', undefined);
    onPlaneY(Y, 9.4, 116, function () { ctx.fillStyle = live ? '#fff' : 'rgba(255,255,255,.5)'; ctx.font = '700 7px "DM Mono",monospace'; ctx.fillText('ON AIR', 6, 9); });
    if (live) { var c = iso(10, Y + .5, 110); var g = ctx.createRadialGradient(c[0], c[1], 1, c[0], c[1], 26); g.addColorStop(0, 'rgba(232,60,70,.35)'); g.addColorStop(1, 'rgba(232,60,70,0)'); ctx.fillStyle = g; ctx.fillRect(c[0] - 30, c[1] - 30, 60, 60); }
  }

  /* ================= props ================= */
  var props = [];
  function prop(k, fn, delay) { props.push({ key: k, draw: fn, delay: delay == null ? k : delay }); }

  function chair(x, y, dir) {
    prop(x + y - .02, function () {
      line(iso(x, y, 0), iso(x, y, 11), P.ink, 1.6);
      var b = iso(x, y); ell(b[0], b[1], 7, 3, P.shade);
      box(x - .2, y - .2, 11, .4, .4, 3, C3(P.chair, P.chairD, P.chairD));
    }, x + y);
    var by = y + (dir > 0 ? .24 : -.24);
    prop(x + by, function () { box(x - .2, by - .04, 14, .4, .08, 15, C3(P.chair, P.chair, P.chairD)); }, x + y);
  }
  // one desk unit: x..x+1, y..y+.8 ; side 'A' person sits at smaller y (sees backs of monitors), 'B' faces -y (screens visible)
  function deskUnit(x, y, side, opt) {
    opt = opt || {};
    prop(x + .5 + y + .4, function () {
      line(iso(x + .06, y + .06, 0), iso(x + .06, y + .06, 26), P.ink, 1.3);
      line(iso(x + .94, y + .74, 0), iso(x + .94, y + .74, 26), P.ink, 1.3);
      line(iso(x + .06, y + .74, 0), iso(x + .06, y + .74, 26), P.ink, 1.3);
      box(x, y, 26, 1, .8, 3, { t: P.white, l: P.whiteL, r: P.whiteR });
      var mz = 29;
      if (side === 'A') {
        var my = y + .62;
        box(x + .08, my, mz + 5, .4, .07, 15, { t: P.mon, l: P.monL, r: P.mon, dr: false }); box(x + .52, my, mz + 5, .4, .07, 15, { t: P.mon, l: P.monL, r: P.mon, dr: false });
        box(x + .45, my - .02, mz, .1, .1, 5, C3(P.metalD, P.metalD, P.metalD));
        box(x + .25, y + .18, mz, .5, .16, 1.2, C3(P.paper, P.metal, P.metalD));
      } else {
        var sy = y + .1;
        box(x + .45, sy + .05, mz, .1, .1, 5, C3(P.metalD, P.metalD, P.metalD));
        var mons = opt.single ? [[x + .1, .8]] : [[x + .07, .42], [x + .51, .42]];
        mons.forEach(function (m, i) {
          var hgt = opt.single ? 20 : 15, w = m[1] * 32 - 3;
          box(m[0], sy, mz + 5, m[1], .07, hgt, { t: P.mon, l: P.mon, r: P.mon, dr: false });
          onPlaneY(sy + .07, m[0] + .05, mz + 5 + hgt - 1.5, function () {
            var im = opt.thumb ? thumb(opt.thumb) : null;
            if (im && ready(im)) { ctx.drawImage(im.canvas, 0, 0, w, hgt - 3); }
            else {
              ctx.fillStyle = P.screen; ctx.fillRect(0, 0, w, hgt - 3);
              ctx.fillStyle = P.screenLine; var off = ((time / 110 + x * 7 + i * 3) % 12) | 0;
              for (var r = 0; r < 4; r++) ctx.fillRect(1.5, 1.5 + ((r * 3 + off) % 11), 3 + ((r * 5 + x * 3 + i) % 7) * 1.4, .9);
            }
          });
          if (P.night) { var gc = iso(m[0] + m[1] / 2, sy + .4, mz + 12); var g = ctx.createRadialGradient(gc[0], gc[1], 1, gc[0], gc[1], 22); g.addColorStop(0, 'rgba(143,245,234,.18)'); g.addColorStop(1, 'rgba(143,245,234,0)'); ctx.fillStyle = g; ctx.fillRect(gc[0] - 24, gc[1] - 24, 48, 48); }
        });
        box(x + .25, y + .5, mz, .5, .16, 1.2, C3(P.paper, P.metal, P.metalD));
        if (opt.mug) box(x + .82, y + .55, mz, .1, .1, 4, C3(P.red, P.red, P.redD));
        if (opt.bottle) drawBottle(x + .8, y + .45, mz);
        if (opt.papers) box(x + .05, y + .5, mz, .18, .24, 3, C3(P.paper, P.paper, P.metal));
      }
    }, x + y);
  }
  function drawBottle(x, y, z) {
    var b = iso(x, y, z);
    ctx.beginPath(); ctx.moveTo(b[0] - 3, b[1]); ctx.lineTo(b[0] - 3, b[1] - 10); ctx.quadraticCurveTo(b[0] - 3, b[1] - 14, b[0] - 1.2, b[1] - 15);
    ctx.lineTo(b[0] - 1.2, b[1] - 19); ctx.lineTo(b[0] + 1.2, b[1] - 19); ctx.lineTo(b[0] + 1.2, b[1] - 15); ctx.quadraticCurveTo(b[0] + 3, b[1] - 14, b[0] + 3, b[1] - 10); ctx.lineTo(b[0] + 3, b[1]); ctx.closePath();
    ctx.fillStyle = 'rgba(120,170,110,.9)'; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = P.red; ctx.fillRect(b[0] - 1.6, b[1] - 21, 3.2, 2.5);
    ctx.fillStyle = P.paper; ctx.fillRect(b[0] - 2.4, b[1] - 8, 4.8, 4);
  }

  var seated = [];
  function pod(x0, y0, n, special) {
    special = special || {};
    for (var i = 0; i < n; i++) {
      var sa = special['A' + i] || {}, sb = special['B' + i] || {};
      deskUnit(x0 + i, y0, 'A', sa);
      deskUnit(x0 + i, y0 + .8, 'B', sb);
      chair(x0 + i + .5, y0 - .45, -1);
      chair(x0 + i + .5, y0 + 2.05, 1);
      if (rnd() < .78) seated.push({ x: x0 + i + .5, y: y0 - .45, face: 1 });
      if (rnd() < .78) seated.push({ x: x0 + i + .5, y: y0 + 2.05, face: -1 });
    }
    prop(x0 + n / 2 + y0 + .8, function () { box(x0, y0 + .78, 29, n, .04, 10, { t: P.whiteR, l: P.whiteL, r: P.whiteR, s: false }); }, x0 + y0);
    if (special.tv) hangingScreen(x0 + special.tv.at, y0, special.tv.key, special.tv.hot);
  }
  function hangingScreen(x, y0, key, hot) {
    var y = y0 + .82;
    prop(x + y + .45, function () {
      line(iso(x, y, 29), iso(x, y, 78), P.ink, 1.6);
      box(x - .55, y, 78, 1.1, .08, 28, { t: P.mon, l: P.mon, r: P.monL, dr: false });
      var im = thumb(YT[key].id);
      onPlaneY(y + .08, x - .5, 104, function () {
        if (ready(im)) ctx.drawImage(im.canvas, 0, 0, 32, 18); else { ctx.fillStyle = P.screen; ctx.fillRect(0, 0, 32, 18); }
        ctx.fillStyle = '#c8283a'; ctx.fillRect(0, 18, 32, 4); ctx.fillStyle = '#fff'; ctx.font = '700 3.4px "DM Sans",sans-serif'; ctx.fillText(YT[key].title.slice(0, 22), 1.5, 21.2);
      });
    }, x + y0);
    if (hot) hotspotAt(hot, function () { return [x, y, 110]; });
  }

  function studio() {
    var cx = 4.5, cy = 4.2, R = 2.75;
    prop(1, function () {
      var front = circ(cx, cy, R, 5, -Math.PI / 4, Math.PI * .75, 24), frontLow = circ(cx, cy, R, 0, Math.PI * .75, -Math.PI / 4, 24);
      poly(front.concat(frontLow), P.redD, undefined, true);
      poly(circ(cx, cy, R, 5, 0, Math.PI * 2, 40), P.studio);
      ctx.save(); ctx.globalAlpha = .6; poly(circ(cx, cy, R - .25, 5, 0, Math.PI * 2, 40), false, P.red); ctx.restore();
      var a0 = Math.PI * .8, a1 = Math.PI * 1.7, Rb = 2.45;
      var top = circ(cx, cy, Rb, 80, a0, a1, 24), bot = circ(cx, cy, Rb, 5, a1, a0, 24);
      poly(top.concat(bot), P.red);
      poly(circ(cx, cy, Rb, 56, a0, a1, 24).concat(circ(cx, cy, Rb, 46, a1, a0, 24)), P.white, false);
      ctx.save(); ctx.globalAlpha = .35; poly(top.concat(bot), false, false, true); ctx.restore();
      poly(top.concat(circ(cx, cy, Rb + .12, 80, a1, a0, 24)), P.redD);
      anchor.draw();
      var d0 = -Math.PI * .15, d1 = Math.PI * .65, Ro = 1.55, Ri = 1.05, dcx = 4.0, dcy = 3.7;
      poly(circ(dcx, dcy, Ro, 27, d0, d1, 18).concat(circ(dcx, dcy, Ro, 5, d1, d0, 18)), P.white);
      poly(circ(dcx, dcy, Ro, 17, d0, d1, 18).concat(circ(dcx, dcy, Ro, 10, d1, d0, 18)), P.red, false);
      poly(circ(dcx, dcy, Ro, 27, d0, d1, 18).concat(circ(dcx, dcy, Ri, 27, d1, d0, 18)), P.whiteL);
      var lp = iso(4.6, 4.3, 27); ctx.fillStyle = P.mon; ctx.beginPath(); ctx.moveTo(lp[0] - 7, lp[1]); ctx.lineTo(lp[0] + 5, lp[1] - 5); ctx.lineTo(lp[0] + 5, lp[1] - 14); ctx.lineTo(lp[0] - 7, lp[1] - 9); ctx.closePath(); ctx.fill();
      box(4.9, 3.55, 27, .3, .22, 1, C3(P.paper, P.paper, P.metal));
    }, 1);
    [[7.35, 5.75, 0], [5.9, 7.2, 1]].forEach(function (c) {
      prop(c[0] + c[1], function () {
        var b = iso(c[0], c[1]); ell(b[0], b[1], 9, 4, P.shade);
        [[-.25, 0], [.2, -.2], [.1, .25]].forEach(function (l) { line(iso(c[0] + l[0], c[1] + l[1], 0), iso(c[0], c[1], 22), P.ink, 1.4); });
        line(iso(c[0], c[1], 20), iso(c[0], c[1], 34), P.ink, 2.4);
        box(c[0] - .45, c[1] - .2, 34, .7, .4, 13, C3(P.mon, P.monL, P.mon));
        box(c[0] - .62, c[1] - .12, 38, .18, .24, 7, C3(P.monL, P.mon, P.mon));
        box(c[0] - .1, c[1] - .12, 47, .3, .24, 7, C3(P.metal, P.metalD, P.metalD));
        var t = iso(c[0] + .2, c[1] + .15, 45); ell(t[0], t[1], 1.4, 1.4, (Math.floor(time / 700) + c[2]) % 2 ? '#ff4a4a' : '#6b1a1a');
      }, 3);
    });
  }

  function lounge() {
    // training corner (bottom-right): whiteboard facing the viewer, stools in front of it
    var WB = 11.45;
    prop(21.7 + WB, function () {
      [[20.7, WB], [22.7, WB]].forEach(function (l) { line(iso(l[0], l[1], 0), iso(l[0], l[1], 52), P.ink, 1.4); });
      rectY(WB, 20.55, 22.85, 22, 56, P.white, undefined);
      onPlaneY(WB, 20.62, 55, function () {
        ctx.fillStyle = '#c8283a'; ctx.font = '700 5.4px "DM Sans",sans-serif'; ctx.fillText('IA no jornalismo', 4, 7.5);
        ctx.strokeStyle = '#3f7d79'; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(4, 12.5); ctx.lineTo(30, 12.5); ctx.moveTo(4, 17); ctx.lineTo(24, 17); ctx.moveTo(4, 21.5); ctx.lineTo(34, 21.5); ctx.stroke();
        ctx.strokeStyle = '#c8283a'; ctx.beginPath(); ctx.moveTo(46, 28); ctx.lineTo(52, 20); ctx.lineTo(58, 24); ctx.lineTo(66, 12); ctx.stroke();
      });
    }, 30);
    [[20.95, 12.95], [21.75, 13.1], [22.55, 12.9]].forEach(function (st) {
      prop(st[0] + st[1] - .02, function () { box(st[0] - .18, st[1] - .18, 0, .36, .36, 13, C3(P.red, P.red, P.redD)); }, 31);
    });
    // coffee bar against the left wall (walkers stop here for a refill)
    prop(.4 + 8.6, function () {
      box(.08, 7.75, 0, .72, 1.75, 28, { t: P.white, l: P.whiteL, r: P.whiteR });
      box(.18, 7.95, 28, .45, .45, 20, C3(P.mon, P.monL, P.mon));
      var led = iso(.63, 8.15, 42); ell(led[0], led[1], 1.2, 1.2, '#e05a4a');
      box(.25, 8.65, 28, .16, .16, 5, C3(P.paper, P.paper, P.metal)); box(.25, 8.9, 28, .16, .16, 5, C3(P.red, P.red, P.redD));
      box(.2, 9.15, 28, .45, .28, 7, C3(P.gold, P.gold, P.goldD));
      if (Math.sin(time / 1700) > .2) for (var i = 0; i < 3; i++) { var sp = iso(.4, 8.2, 50 + ((time / 25 + i * 9) % 22)); ctx.globalAlpha = .45; ell(sp[0] + Math.sin(time / 240 + i) * 2, sp[1], 2.4, 2.4, P.paper); ctx.globalAlpha = 1; }
    }, 8);
    [[3.0, 15.1], [4.7, 15.2]].forEach(function (e) { eggChair(e[0], e[1]); });
    prop(3.85 + 15.55, function () { line(iso(3.85, 15.55, 0), iso(3.85, 15.55, 14), P.ink, 1.6); poly(circ(3.85, 15.55, .34, 14, 0, 6.3, 20), P.white); box(3.7, 15.45, 14, .22, .16, 1, C3(P.paper, P.paper, P.metal)); }, 20);
    [[5.8, 8.4], [7.3, 8.5]].forEach(function (e) { eggChair(e[0], e[1]); });
    plant(8.7, 7.8, true); plant(.6, 15.3, true); plant(23.4, 15.4, true); plant(13.7, .45, false); plant(1.5, 7.9, false);
  }
  function eggChair(x, y) {
    prop(x + y, function () {
      var b = iso(x, y, 0); ell(b[0], b[1], 13, 6, P.shade);
      line(b, [b[0], b[1] - 8], P.ink, 2); ell(b[0], b[1], 6, 2.5, P.ink);
      ctx.beginPath(); ctx.ellipse(b[0], b[1] - 20, 14, 15, 0, Math.PI * .92, Math.PI * 2.08); ctx.closePath(); ctx.fillStyle = P.red; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.stroke();
      ell(b[0] + 2, b[1] - 16, 9.5, 7, P.redD, P.ink);
      ell(b[0] + 3, b[1] - 13, 7, 3.2, P.redL);
    }, x + y);
  }
  function plant(x, y, big) {
    prop(x + y, function () {
      var h = big ? 16 : 11, r = big ? .24 : .17;
      box(x - r, y - r, 0, r * 2, r * 2, h, C3(P.white, P.whiteL, P.whiteR));
      var c = iso(x, y, h), sw = Math.sin(time / 1300 + x) * 1.1, n = big ? 7 : 5;
      for (var i = 0; i < n; i++) {
        var a = -1.4 + i * (2.8 / (n - 1)), L = (big ? 30 : 18) * (.7 + (i % 2) * .3);
        ctx.beginPath(); ctx.moveTo(c[0], c[1]);
        var tx = c[0] + Math.sin(a) * L * .7 + sw, ty = c[1] - Math.cos(a) * L;
        ctx.quadraticCurveTo(c[0] + Math.sin(a) * L * .2, ty + 6, tx, ty);
        ctx.quadraticCurveTo(c[0] + Math.sin(a) * L * .5 + 4, ty + 10, c[0], c[1]);
        ctx.fillStyle = i % 2 ? P.plant : P.plantD; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = .8; ctx.stroke();
      }
    }, x + y);
  }

  function backWallStuff() {
    prop(10.7 + .55, function () {
      box(10.3, .2, 0, .8, .7, 22, C3(P.white, P.whiteL, P.whiteR));
      box(10.35, .25, 22, .7, .6, 9, C3(P.metal, P.whiteL, P.whiteR));
      var k = Math.floor(printOut);
      for (var i = 0; i < k; i++) box(10.45, .62, 13 + i * 1.2, .5, .26, 1, C3(P.paper, P.paper, P.metal));
      var f = printOut % 1; if (f > .02) box(10.45, .62 - .3 * (1 - f), 22 - 8 * f, .5, .3, 1, C3(P.paper, P.paper, P.metal));
      var led = iso(11.05, .8, 28); ell(led[0], led[1], 1.3, 1.3, (time / 450 | 0) % 2 ? '#43c46b' : '#2c7a45');
      for (var j = 0; j < 4; j++) box(11.3, .35, j * 2.4, .5, .36, 2.4, C3(P.paper, P.paper, P.metal));
      var lb = iso(11.3, .71, 5); ctx.fillStyle = P.red; ctx.font = '700 4.5px "DM Mono",monospace'; ctx.fillText('EFTA', lb[0] + 1, lb[1] + 1);
    }, 12);
    prop(22.6 + .3, function () {
      box(21.3, .08, 0, 2.6, .42, 62, { t: P.wood, l: P.woodD, r: P.woodDD, dr: true });
      var cols = [P.red, '#3f7d79', P.gold, P.paper, P.mon, '#7a5c8e', P.red, '#3f7d79'];
      for (var s = 0; s < 3; s++) for (var b = 0; b < 12; b++) {
        var bx = 21.4 + b * .2, bh = 11 + ((b * 7 + s * 3) % 5);
        rectY(.5, bx, bx + .16, 4 + s * 19, 4 + s * 19 + bh, cols[(b + s * 3) % cols.length], P.ink);
      }
      var m = iso(23.2, .3, 62); ctx.fillStyle = P.mon; ctx.beginPath(); ctx.moveTo(m[0] - 10, m[1] - 4); ctx.lineTo(m[0], m[1] - 9); ctx.lineTo(m[0] + 10, m[1] - 4); ctx.lineTo(m[0], m[1] + 1); ctx.closePath(); ctx.fill();
      ctx.fillRect(m[0] - 5, m[1] - 4, 10, 5); line([m[0] + 8, m[1] - 4], [m[0] + 9, m[1] + 4], P.gold, 1.2);
    }, 13);
    prop(16.3 + .45, function () {
      for (var i = 0; i < 3; i++) {
        var x = 15.2 + i * .74; box(x, .1, 0, .72, .7, 46, { t: '#3f7d79', l: '#3f7d79', r: '#2e5f5c', dr: true });
        for (var k = 0; k < 3; k++) { line(iso(x + .05, .8, 13 + k * 14), iso(x + .67, .8, 13 + k * 14), '#2e5f5c'); var h = iso(x + .36, .8, 7 + k * 14); ell(h[0], h[1], 2.2, 1, P.ink); }
      }
      for (var j = 0; j < 3; j++) { var l = iso(15.34 + j * .74, .8, 42); ctx.fillStyle = '#fffdf8'; ctx.font = '700 4.4px "DM Mono",monospace'; ctx.fillText(['LAI', 'FOI', 'LAI'][j], l[0] + 1, l[1] + 3); }
      box(15.3, .2, 46, .5, .42, 10, C3('#e8d7b8', '#d6c19c', '#b99f75')); box(16.1, .15, 46, .5, .5, 14, C3('#e8d7b8', '#d6c19c', '#b99f75'));
    }, 15);
    column(9.3, .55); column(19.3, .55);
  }
  function column(x, y) {
    prop(x + y + .2, function () {
      var R = .36, b = iso(x, y, 0), t = iso(x, y, WALL), rx = R * 45.25, ry = R * 22.6;
      ctx.beginPath(); ctx.moveTo(b[0] - rx, t[1]); ctx.lineTo(b[0] - rx, b[1]); ctx.ellipse(b[0], b[1], rx, ry, 0, Math.PI, 0, true); ctx.lineTo(b[0] + rx, t[1]); ctx.closePath();
      var g = ctx.createLinearGradient(b[0] - rx, 0, b[0] + rx, 0); g.addColorStop(0, P.white); g.addColorStop(.6, P.whiteL); g.addColorStop(1, P.whiteR);
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.stroke();
      ell(t[0], t[1], rx, ry, P.cap, P.ink);
    }, 2);
  }
  function frontStuff() {
    prop(13.3 + 15.5, function () {
      box(12.0, 15.2, 0, 2.6, .55, 20, { t: P.white, l: P.whiteL, r: P.whiteR });
      [[12.35, 14], [12.95, 18], [13.55, 12], [14.15, 16]].forEach(function (c, i) {
        var p = iso(c[0], 15.47, 20);
        ctx.fillStyle = i === 3 ? P.metal : P.gold;
        ctx.fillRect(p[0] - 3, p[1] - 3, 6, 3);
        ctx.beginPath(); ctx.moveTo(p[0] - 1, p[1] - 3); ctx.lineTo(p[0] + 1, p[1] - 3); ctx.lineTo(p[0] + 1.2, p[1] - c[1] + 7); ctx.lineTo(p[0] - 1.2, p[1] - c[1] + 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(p[0] - 5, p[1] - c[1] + 7); ctx.quadraticCurveTo(p[0], p[1] - c[1] + 14, p[0] + 5, p[1] - c[1] + 7); ctx.lineTo(p[0] + 5, p[1] - c[1]); ctx.lineTo(p[0] - 5, p[1] - c[1]); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = P.ink; ctx.lineWidth = .8; ctx.stroke();
      });
    }, 25);
    prop(21 + 15.4, function () {
      for (var r = 0; r < 3; r++) for (var i = 0; i < 3 - r; i++) {
        var x = 20.2, y = 15.05 + i * .28 + r * .14, z = 4 + r * 7.5;
        var a = iso(x, y, z), b = iso(x + 1.6, y, z);
        ctx.strokeStyle = P.ink; ctx.lineWidth = 8.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ctx.strokeStyle = '#b5462e'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        ell(b[0], b[1], 3.6, 3.6, '#e07a4a', P.ink); ell(b[0], b[1], 1.5, 1.5, '#b5462e');
      }
      var tg = iso(21.4, 15.1, 26); ctx.fillStyle = '#fffdf8'; ctx.fillRect(tg[0] - 7, tg[1] - 4, 14, 7); ctx.strokeStyle = P.ink; ctx.lineWidth = .8; ctx.strokeRect(tg[0] - 7, tg[1] - 4, 14, 7);
      ctx.fillStyle = '#c8283a'; ctx.font = '700 3.6px "DM Mono",monospace'; ctx.fillText('SEIZED', tg[0] - 5.6, tg[1] + 1);
    }, 26);
  }

  /* the floating "AI bubble" */
  var bubble = { x: 12.3, y: 5.3 };
  function drawBubble() {
    var z = 70 + Math.sin(time / 900) * 8, bx = bubble.x + Math.sin(time / 2600) * .5, by = bubble.y + Math.cos(time / 3100) * .4;
    var p = iso(bx, by, z), r = 12;
    var sh = iso(bx, by, 0); ell(sh[0], sh[1], 8, 3, P.shade);
    var g = ctx.createRadialGradient(p[0] - 4, p[1] - 5, 1, p[0], p[1], r);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.35, 'rgba(180,230,255,.35)'); g.addColorStop(.75, 'rgba(230,160,255,.28)'); g.addColorStop(1, 'rgba(120,200,220,.55)');
    ell(p[0], p[1], r, r, g); ctx.strokeStyle = P.night ? 'rgba(220,240,255,.8)' : 'rgba(35,38,46,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.stroke();
    ctx.fillStyle = P.night ? '#e7e9ee' : '#23262e'; ctx.font = '700 6px "DM Mono",monospace'; ctx.fillText('AI', p[0] - 3.8, p[1] + 2.4);
    bubble.px = bx; bubble.py = by; bubble.pz = z;
  }

  /* ================= people ================= */
  var SKIN = ['#f1c7a5', '#d9a07a', '#b97a52', '#8a5a3c', '#5e3b26', '#e8b995'];
  var HAIR = ['#1b1512', '#3b2a20', '#6b3a1e', '#b58a4a', '#9aa1a6', '#2a1d17', '#c9a064'];
  var SHIRT = ['#3a4150', '#f2efe8', '#c8283a', '#3f7d79', '#e3ab3a', '#6c7a8a', '#23262e', '#8d5a7a', '#d8d2c4'];
  var STYLE = ['short', 'short', 'long', 'bun', 'curly', 'short', 'long'];
  var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function pickR(a) { return a[Math.floor(rnd() * a.length)]; }
  function look() { return { skin: pickR(SKIN), hair: pickR(HAIR), shirt: pickR(SHIRT), style: pickR(STYLE), glasses: rnd() < .25 }; }

  function drawPerson(p) {
    var L = p.look, sit = p.sit, walking = p.walking;
    var base = iso(p.x, p.y, p.z || 0), bx = base[0], by = base[1];
    var flip = p.sx < 0 ? -1 : 1, away = p.turn > 0 ? true : p.away;
    if (p.s) { ctx.save(); ctx.translate(bx, by); ctx.scale(p.s, p.s); ctx.translate(-bx, -by); }
    var hip = sit ? 15 : 16;
    var bob = walking ? Math.abs(Math.sin(p.walkT)) * 1.4 : (sit ? 0 : Math.sin(time / 900 + p.x) * .4);
    if (!sit) {
      ell(bx, by, 7, 3, P.shade);
      var sw = walking ? Math.sin(p.walkT) * 3.6 : 0;
      line([bx - 2, by - hip - bob], [bx - 2 + sw * flip, by], P.ink, 2.8);
      line([bx + 2, by - hip - bob], [bx + 2 - sw * flip, by], P.ink, 2.8);
    }
    var ty = by - hip - bob;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx - 5.5, ty - 16, 11, 17, 4); else ctx.rect(bx - 5.5, ty - 16, 11, 17);
    ctx.fillStyle = L.shirt; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.stroke();
    if (L.tee && !away) { ctx.fillStyle = L.tee; ctx.fillRect(bx - 1.8 + flip, ty - 15, 3.6, 12); }
    var armSw = walking ? Math.sin(p.walkT) * 3.2 : 0;
    if (sit && !away && !p.hold) { var ty2 = Math.sin(time / 75 + p.x * 3) * 1.1; line([bx - 5, ty - 12], [bx - 4 + 5 * flip, ty - 5 + ty2], L.shirt, 2.8); line([bx + 5, ty - 12], [bx + 4 + 5 * flip, ty - 5 - ty2], L.shirt, 2.8); }
    else if (p.gesture || p.turn > 0) { var wv = p.hold === 'trophy' ? Math.max(0, Math.sin(time / 700)) * -6 : Math.sin(time / 260 + p.x) * 3; p._hand = [bx + 11 * flip, ty - 16 + wv]; line([bx + 5 * flip, ty - 13], p._hand, L.shirt, 2.8); line([bx - 5 * flip, ty - 13], [bx - 6 * flip, ty - 2], L.shirt, 2.8); }
    else { line([bx - 5.5, ty - 13], [bx - 6.5 - armSw, ty - 2], L.shirt, 2.8); line([bx + 5.5, ty - 13], [bx + 6.5 + armSw, ty - 2], L.shirt, 2.8); }
    if (walking && p.carry === 'papers') { ctx.fillStyle = P.paper; ctx.fillRect(bx + 3 * flip - 4, ty - 9, 8, 6); ctx.strokeStyle = P.ink; ctx.strokeRect(bx + 3 * flip - 4, ty - 9, 8, 6); }
    if (walking && p.carry === 'coffee') { ctx.fillStyle = P.paper; ctx.fillRect(bx + 7 * flip - 2, ty - 5, 4, 5); ctx.strokeStyle = P.ink; ctx.strokeRect(bx + 7 * flip - 2, ty - 5, 4, 5); }
    if (walking && p.carry === 'laptop') { ctx.fillStyle = P.metal; ctx.fillRect(bx - 6, ty - 8, 12, 3); ctx.strokeStyle = P.ink; ctx.strokeRect(bx - 6, ty - 8, 12, 3); }
    var hx = bx, hy = ty - 23;
    ctx.beginPath(); ctx.arc(hx, hy, 6, 0, 7); ctx.fillStyle = L.skin; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = L.hair;
    if (away) { ctx.beginPath(); ctx.arc(hx, hy, 6, 0, 7); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(hx, hy - 1, 6.1, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); }
    if (L.style === 'bun') ell(hx - 2 * flip, hy - 6.5, 3, 2.8, L.hair);
    if (L.style === 'long') { ctx.fillRect(hx - 6, hy - 2, 2.8, 8); ctx.fillRect(hx + 3.2, hy - 2, 2.8, 8); if (away) ctx.fillRect(hx - 6, hy - 2, 12, 8); }
    if (L.style === 'curly') for (var c = 0; c < 5; c++) ell(hx - 5.5 + c * 2.8, hy - 4.8 - (c % 2), 2.4, 2.4, L.hair);
    if (L.style === 'quiff') ell(hx + flip, hy - 5.8, 5.2, 3, L.hair);
    if (!away) {
      if (L.beard) { ctx.beginPath(); ctx.arc(hx, hy + .3, 5.7, Math.PI * .08, Math.PI * .92); ctx.closePath(); ctx.fillStyle = L.hair; ctx.fill(); ctx.fillStyle = '#b5695a'; ctx.fillRect(hx + 1.2 * flip - 1.4, hy + 2.8, 2.8, .9); }
      ctx.fillStyle = P.ink; ctx.fillRect(hx + 1.4 * flip - .6, hy - .6, 1.2, 1.5); ctx.fillRect(hx + 3.9 * flip - .6, hy - .6, 1.2, 1.5);
      if (L.glasses) { ctx.strokeStyle = '#111'; ctx.lineWidth = .9; ctx.strokeRect(hx + (flip > 0 ? -.2 : -3.0), hy - 1.9, 3.2, 3); ctx.strokeRect(hx + (flip > 0 ? 2.8 : -6.0), hy - 1.9, 3.2, 3); }
    }
    if (p.hold) drawHeld(p, bx, ty, flip, away);
    if (p.s) ctx.restore();
  }


  function drawHeld(p, bx, ty, flip, away) {
    var h = p._hand || [bx + 6 * flip, ty - 8];
    ctx.lineWidth = 1; ctx.strokeStyle = P.ink;
    switch (p.hold) {
      case 'magnifier':
        line(h, [h[0] + 3 * flip, h[1] - 4], P.ink, 1.8);
        ctx.beginPath(); ctx.arc(h[0] + 5 * flip, h[1] - 7, 4, 0, 7); ctx.fillStyle = 'rgba(190,225,235,.85)'; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 1.4; ctx.stroke(); break;
      case 'trophy':
        ctx.fillStyle = '#e3ab3a'; ctx.beginPath(); ctx.moveTo(h[0] - 4, h[1] - 9); ctx.quadraticCurveTo(h[0], h[1] - 1, h[0] + 4, h[1] - 9); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(h[0] - .8, h[1] - 3, 1.6, 3); ctx.fillRect(h[0] - 2.5, h[1] - .5, 5, 1.6);
        if ((time / 400 | 0) % 3 === 0) { ctx.fillStyle = '#fff3c8'; ctx.fillRect(h[0] + 5, h[1] - 12, 1.5, 1.5); ctx.fillRect(h[0] - 7, h[1] - 10, 1.5, 1.5); } break;
      case 'marker':
        line(h, [h[0] + 3 * flip, h[1] - 3], '#c8283a', 2); break;
      case 'papers':
        var f = Math.sin(time / 1400 + p.x) > .85 ? 1 : 0;
        ctx.save(); ctx.translate(bx + 3 * flip, ty - 11); ctx.rotate(flip * -.12);
        ctx.fillStyle = P.paper; ctx.fillRect(-5, -6, 10, 12); ctx.strokeRect(-5, -6, 10, 12);
        if (f) { ctx.fillStyle = P.paper; ctx.fillRect(-5 - 6 * flip, -6, 6, 12); ctx.strokeRect(-5 - 6 * flip, -6, 6, 12); }
        ctx.fillStyle = '#c8283a'; ctx.fillRect(-3.5, -4.5, 5, 1.2); ctx.fillStyle = P.metalD; for (var i = 0; i < 4; i++) ctx.fillRect(-3.5, -2 + i * 2, 7 - (i % 2) * 2, .8);
        ctx.restore();
        line([bx - 5 * flip, ty - 12], [bx - 1 * flip, ty - 8], p.look.shirt, 2.8); line([bx + 5 * flip, ty - 12], [bx + 7 * flip, ty - 9], p.look.shirt, 2.8); break;
      case 'journal':
        ctx.save(); ctx.translate(bx + 3 * flip, ty - 11); ctx.rotate(flip * -.1);
        ctx.fillStyle = '#f7f3ea'; ctx.fillRect(-5, -7, 10, 13); ctx.strokeRect(-5, -7, 10, 13);
        ctx.fillStyle = '#23262e'; ctx.fillRect(-5, -7, 10, 3.2); ctx.fillStyle = '#c8283a'; ctx.fillRect(-3.5, -1.5, 7, 1);
        ctx.fillStyle = '#9aa1a6'; for (var jj = 0; jj < 3; jj++) ctx.fillRect(-3.5, .8 + jj * 1.7, 7 - (jj % 2) * 2, .7);
        ctx.restore();
        line([bx - 5 * flip, ty - 12], [bx - 1 * flip, ty - 8], p.look.shirt, 2.8); line([bx + 5 * flip, ty - 12], [bx + 7 * flip, ty - 9], p.look.shirt, 2.8); break;
      case 'book':
        ctx.fillStyle = '#3f7d79'; ctx.fillRect(bx + 3 * flip - 3, ty - 11, 7, 8); ctx.strokeRect(bx + 3 * flip - 3, ty - 11, 7, 8); break;
      case 'folder':
        ctx.fillStyle = '#e3ab3a'; ctx.fillRect(bx + 3 * flip - 4, ty - 10, 8, 6); ctx.strokeRect(bx + 3 * flip - 4, ty - 10, 8, 6);
        ctx.fillStyle = P.ink; ctx.font = '700 3px "DM Mono",monospace'; ctx.fillText('LAI', bx + 3 * flip - 2.6, ty - 6); break;
      case 'mic':
        line([bx + 5 * flip, ty - 12], [bx + 6 * flip, ty - 18], p.look.shirt, 2.8);
        line([bx + 6 * flip, ty - 18], [bx + 7 * flip, ty - 22], P.ink, 1.6); ell(bx + 7.3 * flip, ty - 23.5, 1.9, 1.9, '#c8283a', P.ink); break;
    }
  }

  /* the presenter on air: Luiz */
  var anchor = {
    x: 3.35, y: 3.05, z: 5, s: 1.3, sit: true, sx: 1, away: false, walking: false, walkT: 0,
    look: { skin: '#d9a07a', hair: '#1f1813', shirt: '#3c5578', tee: '#5b6148', style: 'quiff', glasses: true, beard: true },
    draw: function () { drawPerson(anchor); }
  };

  /* walkers on an aisle graph */
  var HA = [[1.5, 9.3, 23.4], [5.8, 9.3, 23.4], [10.1, .8, 23.4], [14.2, .8, 23.4]];
  var VA = [[.8, 10.1, 14.2], [9.3, 1.5, 14.2], [14.3, 1.5, 14.2], [19.3, 1.5, 14.2], [23.4, 1.5, 14.2]];
  var nodes = [], adj = [];
  (function () {
    HA.forEach(function (h) { VA.forEach(function (v) { if (v[0] >= h[1] - .01 && v[0] <= h[2] + .01 && h[0] >= v[1] - .01 && h[0] <= v[2] + .01) nodes.push([v[0], h[0]]); }); });
    nodes.forEach(function () { adj.push([]); });
    function link(list) { list.sort(function (a, b) { return a.k - b.k; }); for (var i = 1; i < list.length; i++) { adj[list[i - 1].i].push(list[i].i); adj[list[i].i].push(list[i - 1].i); } }
    HA.forEach(function (h) { link(nodes.map(function (n, i) { return { i: i, k: n[0], ok: Math.abs(n[1] - h[0]) < .01 }; }).filter(function (o) { return o.ok; })); });
    VA.forEach(function (v) { link(nodes.map(function (n, i) { return { i: i, k: n[1], ok: Math.abs(n[0] - v[0]) < .01 }; }).filter(function (o) { return o.ok; })); });
  })();
  function bfs(a, b) {
    var prev = {}, q = [a]; prev[a] = -1;
    while (q.length) { var c = q.shift(); if (c === b) break; adj[c].forEach(function (n) { if (!(n in prev)) { prev[n] = c; q.push(n); } }); }
    var out = [], k = b; while (k !== -1 && k != null) { out.unshift(nodes[k]); k = prev[k]; } return out;
  }
  var walkers = [];
  function Walker(i) {
    this.node = Math.floor(rnd() * nodes.length); var n = nodes[this.node];
    this.x = n[0]; this.y = n[1]; this.look = look(); this.path = []; this.wait = .3 + i * .5; this.walking = false; this.walkT = rnd() * 10;
    this.sx = 1; this.away = false; this.speed = 1.25 + rnd() * .4; this.carry = pickR([null, 'papers', 'coffee', 'laptop', null]); this.alpha = 0;
  }
  // errands: desk visits (stand on the aisle behind a seated colleague and talk), coffee, printer
  function nearestNodeOnRow(y, x) {
    var best = -1, bd = 1e9;
    nodes.forEach(function (n, i) { if (Math.abs(n[1] - y) < .01 && Math.abs(n[0] - x) < bd) { bd = Math.abs(n[0] - x); best = i; } });
    return best;
  }
  var COFFEE = [1.15, 10.1], PRINTER = [11.9, 1.5];
  function pickErrand(w) {
    var r = Math.random();
    if (r < .5 && seatedPeople.length) {
      var rowA = seatedPeople.filter(function (p) { return p.sit && !p.away && !p.key && !p.z && !p.busy && [1.95, 6.25, 10.55].some(function (y) { return Math.abs(p.y - y) < .02; }); });
      var who = rowA[Math.floor(Math.random() * rowA.length)];
      if (who) return { spot: [who.x, who.y - .45], who: who, kind: 'desk' };
    }
    if (r < .68) return { spot: COFFEE, kind: 'coffee' };
    if (r < .8) return { spot: PRINTER, kind: 'printer' };
    return null;
  }
  Walker.prototype.update = function (dt) {
    this.alpha = Math.min(1, this.alpha + dt * 1.5);
    if (!this.walking) {
      this.wait -= dt; this.gesture = this.wait > 0 && this.chat;
      if (this.errand && this.errand.who) this.errand.who.turn = this.wait;
      if (this.wait <= 0) {
        var path = [];
        if (this.off) { path.push(nodes[this.node]); this.off = false; }
        if (this.errand && this.errand.who) { this.errand.who.busy = false; this.errand.who.turn = 0; }
        var e = pickErrand(this);
        var t = e ? nearestNodeOnRow(e.spot[1], e.spot[0]) : Math.floor(Math.random() * nodes.length);
        if (t < 0) { e = null; t = Math.floor(Math.random() * nodes.length); }
        if (t === this.node && !e) t = adj[this.node][0];
        path = path.concat(bfs(this.node, t).slice(1));
        if (e) { path.push(e.spot); if (e.who) e.who.busy = true; }
        this.path = path; this.target = t; this.errand = e; this.walking = true; this.chat = false; this.gesture = false;
      }
      return;
    }
    var tg = this.path[0];
    if (!tg) {
      this.walking = false; this.node = this.target; var e = this.errand;
      if (e) {
        this.off = true;
        if (e.kind === 'desk') { this.wait = 3 + Math.random() * 4; this.chat = true; this.sx = -1; this.away = false; if (Math.random() < .5) this.carry = 'papers'; }
        else if (e.kind === 'coffee') { this.wait = 2 + Math.random() * 2; this.chat = false; this.sx = 1; this.away = true; this.carry = 'coffee'; }
        else { this.wait = 2.5; this.chat = false; this.sx = 1; this.away = true; this.carry = 'papers'; }
      } else { this.wait = 1 + Math.random() * 3; this.chat = Math.random() < .3; }
      return;
    }
    var dx = tg[0] - this.x, dy = tg[1] - this.y, d = Math.hypot(dx, dy), st = this.speed * dt;
    if (d <= st) { this.x = tg[0]; this.y = tg[1]; this.path.shift(); }
    else { this.x += dx / d * st; this.y += dy / d * st; this.sx = dx - dy; this.away = (dx + dy) < -.05; }
    this.walkT += dt * 9;
  };

  /* ================= tap sound (Web Audio, no files; plays only after a tap) ================= */
  var audioCtx = null, soundOn = true;
  try { soundOn = localStorage.getItem('nr-sound') !== 'off'; } catch (e) { /* storage optional */ }
  function blip() {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var t = audioCtx.currentTime;
      [[880, 0], [1318.5, .075]].forEach(function (n) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0, t + n[1]); g.gain.linearRampToValueAtTime(.12, t + n[1] + .01); g.gain.exponentialRampToValueAtTime(.0001, t + n[1] + .16);
        o.connect(g); g.connect(audioCtx.destination); o.start(t + n[1]); o.stop(t + n[1] + .18);
      });
    } catch (e) { /* audio unavailable */ }
  }
  (function soundToggle() {
    var foot = root.querySelector('.nr-foot > span:last-child'); if (!foot) return;
    var sb = document.createElement('button'); sb.type = 'button'; sb.setAttribute('aria-pressed', String(soundOn));
    function label() { sb.textContent = soundOn ? 'Sound on' : 'Sound off'; sb.setAttribute('aria-pressed', String(soundOn)); }
    label();
    sb.addEventListener('click', function () { soundOn = !soundOn; try { localStorage.setItem('nr-sound', soundOn ? 'on' : 'off'); } catch (e) { } label(); blip(); });
    foot.insertBefore(document.createTextNode('\u00a0\u00a0·\u00a0\u00a0'), foot.firstChild); foot.insertBefore(sb, foot.firstChild);
  })();

  /* ================= hotspots ================= */
  var hots = [];
  var hoverKey = null;
  function hotspotAt(key, posFn) { hots.push({ key: key, pos: posFn }); }
  function buildHotButtons() {
    if (!hotLayer) return;
    hotLayer.innerHTML = '';
    hots.forEach(function (h, i) {
      var d = SECTIONS[h.key], b = document.createElement(LINK !== null ? 'a' : 'button');
      if (LINK !== null) b.href = LINK + d.anchor; else b.type = 'button';
      b.className = 'nr-hot is-hidden'; b.style.setProperty('--d', (i * 110) + 'ms');
      b.setAttribute('aria-label', d.label + ': ' + d.title);
      b.setAttribute('aria-label', 'Open ' + d.title);
      b.innerHTML = '<i aria-hidden="true"></i><span></span>';
      b.querySelector('span').textContent = d.label;
      b.addEventListener('click', function (e) {
        if (LINK !== null) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0 || b.target === '_blank') { blip(); return; }
          e.preventDefault(); blip();
          var target = LINK === '' && document.querySelector(d.anchor);
          if (target) {
            target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
            try { history.replaceState(null, '', d.anchor); } catch (err) { /* ignore */ }
          } else setTimeout(function () { location.href = b.href; }, 170);
        } else { blip(); openPanel(h.key, b); }
      });
      function on() { hoverKey = h.key; root.classList.add('has-hover'); b.classList.add('is-hot'); if (!running) frame(performance.now()); }
      function off() { if (hoverKey === h.key) hoverKey = null; root.classList.remove('has-hover'); b.classList.remove('is-hot'); if (!running) frame(performance.now()); }
      b.addEventListener('pointerenter', on); b.addEventListener('pointerleave', off); b.addEventListener('focus', on); b.addEventListener('blur', off);
      b.addEventListener('pointerdown', on);
      hotLayer.appendChild(b); h.el = b;
    });
  }
  function placeHots() {
    var shown = appear(40) >= 1;
    hots.forEach(function (h) {
      if (!h.el) return;
      var w = h.pos(), p = iso(w[0], w[1], w[2]);
      var sx = p[0] * scale + ox + panX, sy = p[1] * scale + oy;
      var vis = shown && sx > 6 && sx < W - 6 && sy > 6 && sy < H - 6;
      // keep the whole tag inside the stage (the tail still points at the character)
      var hw = (h.w || (h.w = h.el.offsetWidth || 120)) / 2 + 8;
      if (vis) sx = Math.max(hw, Math.min(W - hw, sx));
      h.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';
      if (vis === h.el.classList.contains('is-hidden')) { h.el.classList.toggle('is-hidden', !vis); if (vis) h.el.removeAttribute('tabindex'); else h.el.tabIndex = -1; }
    });
    if (shown && !root.classList.contains('hots-ready')) { root.classList.add('hots-ready'); showCoach(); }
  }

  /* ================= coach mark: a one-line tutorial, touch or mouse ================= */
  var ICON_TOUCH = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-3.9-1.9L4.3 15.8a1.6 1.6 0 0 1 2.4-2.1L9 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle class="ripple" cx="10.5" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  var ICON_MOUSE = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 3l12 7.2-5.3 1.3 3 5.8-2.3 1.2-3-5.9L6 16.8z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>';
  var coachDone = false;
  function showCoach() {
    if (coachDone) return; coachDone = true;
    try { if (sessionStorage.getItem('nr-coach')) return; sessionStorage.setItem('nr-coach', '1'); } catch (e) { /* storage optional */ }
    var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
    var el = document.createElement('div');
    el.className = 'nr-coach ' + (fine ? 'is-mouse' : 'is-touch'); el.setAttribute('role', 'status');
    el.innerHTML = '<span class="nr-coach-ico">' + (fine ? ICON_MOUSE : ICON_TOUCH) + '</span><span><b>' + (fine ? 'Hover' : 'Tap') + '</b> a name tag ' + (fine ? '· click to open that section' : 'to open that section') + '</span>';
    root.appendChild(el);
    root.classList.add('is-coaching');
    requestAnimationFrame(function () { el.classList.add('show'); });
    function hide() {
      if (!el.parentNode) return; el.classList.remove('show'); root.classList.remove('is-coaching');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
      root.removeEventListener('pointerdown', hide); if (hotLayer) hotLayer.removeEventListener('pointerover', hide);
    }
    setTimeout(hide, 5200);
    root.addEventListener('pointerdown', hide); if (hotLayer) hotLayer.addEventListener('pointerover', hide);
  }

  /* ================= panel ================= */
  var lastOpener = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function embed(key) {
    var v = YT[key];
    return '<div class="nr-video"><iframe src="https://www.youtube-nocookie.com/embed/' + v.id + '?autoplay=1&rel=0&playsinline=1' + (v.start ? '&start=' + v.start : '') + '" title="' + esc(v.title) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
      '<p class="nr-vcap">' + esc(v.title) + ' <span>· ' + esc(v.src) + '</span></p>';
  }
  function linkHtml(l) {
    var ext = /^https?:/.test(l[0]);
    return '<a href="' + esc(l[0]) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l[1]) + '</a>';
  }
  function openPanel(key, opener) {
    if (!panel) return;
    var d = SECTIONS[key]; lastOpener = opener || null;
    var html = '<p class="nr-kicker">' + esc(d.kicker) + '</p><h3 id="nr-panel-title">' + esc(d.title) + '</h3>';
    if (d.intro) html += '<p>' + esc(d.intro) + '</p>';
    if (d.playlist) {
      var cur = key === 'videos' ? (HERO[wallIdx] || d.playlist[0]) : d.playlist[0];
      html += '<div class="nr-vslot">' + embed(cur) + '</div><ol class="nr-playlist">' + d.playlist.map(function (k) {
        return '<li><button type="button" data-v="' + k + '"' + (k === cur ? ' aria-current="true"' : '') + '><img src="https://i.ytimg.com/vi/' + YT[k].id + '/mqdefault.jpg" alt="" loading="lazy"><span>' + esc(YT[k].title) + '<small>' + esc(YT[k].src) + '</small></span></button></li>';
      }).join('') + '</ol>';
    } else if (d.video) html += embed(d.video);
    if (d.items) {
      html += '<ol class="nr-items">' + d.items.map(function (it) {
        return '<li>' + (it.img ? '<img src="' + esc(it.img) + '" alt="" loading="lazy">' : '') + '<div>' +
          (it.k ? '<span class="nr-ik">' + esc(it.k) + '</span>' : '') + '<b>' + esc(it.t) + '</b>' +
          (it.d ? '<p>' + esc(it.d) + '</p>' : '') +
          (it.links ? '<span class="nr-il">' + it.links.map(linkHtml).join('') + '</span>' : '') + '</div></li>';
      }).join('') + '</ol>';
    }
    html += '<p class="nr-links">' + linkHtml([d.anchor, (d.more || 'Go to ' + d.title) + ' ↓']) + '</p>';
    panelBody.innerHTML = html;
    panelBody.querySelectorAll('.nr-items img').forEach(function (im) { im.addEventListener('error', function () { im.remove(); }); });
    panelBody.querySelectorAll('[data-v]').forEach(function (b) {
      b.addEventListener('click', function () {
        panelBody.querySelector('.nr-vslot').innerHTML = embed(b.getAttribute('data-v'));
        panelBody.querySelectorAll('[data-v]').forEach(function (x) { x.removeAttribute('aria-current'); });
        b.setAttribute('aria-current', 'true');
        panelBody.scrollTop = 0;
      });
    });
    panelBody.querySelectorAll('a[href^="#"]').forEach(function (a) { a.addEventListener('click', function () { closePanel(true); }); });
    panel.hidden = false; root.classList.add('has-panel');
    panelBody.scrollTop = 0;
    requestAnimationFrame(function () { panel.classList.add('open'); });
    var t = panel.querySelector('.nr-close'); if (t) t.focus({ preventScroll: true });
    if (!running) frame(performance.now());
  }
  function closePanel(silent) {
    if (!panel || panel.hidden) return;
    panel.classList.remove('open'); root.classList.remove('has-panel');
    panelBody.innerHTML = ''; panel.hidden = true;
    if (!silent && lastOpener) lastOpener.focus({ preventScroll: true });
  }
  if (panel) {
    var cb = panel.querySelector('.nr-close'); if (cb) cb.addEventListener('click', function () { closePanel(); });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
  }

  /* ================= layout / camera ================= */
  var W = 1, H = 1, dpr = 1, scale = 1, ox = 0, oy = 0, panX = 0, panMin = 0, panMax = 0, dragging = false, autoPan = true;
  var SC = { minX: iso(0, GD)[0] - 12, maxX: iso(GW, 0)[0] + 12, minY: iso(0, 0, WALL)[1] - 8, maxY: iso(GW, GD, -14)[1] + 4 };
  function resize() {
    var r = root.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    var bw = SC.maxX - SC.minX, bh = SC.maxY - SC.minY, narrow = W < 760;
    var padT = 10, padB = narrow ? 38 : 26;
    var fit = Math.min((W - 20) / bw, (H - padT - padB) / bh);
    scale = narrow ? Math.max(fit, Math.min(.6, (H - padT - padB) / bh)) : Math.min(fit, 1.3);
    var sceneW = bw * scale;
    oy = padT + ((H - padT - padB) - bh * scale) / 2 - SC.minY * scale;
    if (sceneW <= W) { var left = (W - sceneW) / 2; if (W > 1180) left = Math.max(left, Math.min(W * .22, W - sceneW - 16)); ox = left - SC.minX * scale; panMin = panMax = 0; panX = 0; }
    else { ox = -SC.minX * scale; panMin = W - sceneW; panMax = 0; panX = Math.max(panMin, Math.min(panMax, panX || panMin * .5)); }
    root.classList.toggle('can-pan', panMin < 0);
    var hint = root.querySelector('.nr-hint'); if (hint) hint.textContent = panMin < 0 ? '↔ Drag' : 'Click a name tag to jump to that section';
    if (!running) frame(performance.now());
  }

  function drawOnAirSign() {
    var live = (Math.floor(time / 900) % 5) !== 4, x = 3.6, y = 1.7, z = 92, w = 2.6, h = 24;
    line(iso(x + .3, y, z + h), iso(x + .3, y, 124), P.ink, 1); line(iso(x + w - .3, y, z + h), iso(x + w - .3, y, 124), P.ink, 1);
    box(x, y - .12, z, w, .12, h, { t: P.mon, l: P.mon, r: P.monL, dr: false });
    onPlaneY(y, x + .07, z + h - 1.5, function () {
      var W = (w - .14) * 32, Hh = h - 3;
      ctx.fillStyle = live ? '#d42c3d' : '#5a1a22'; ctx.fillRect(0, 0, W, Hh);
      ctx.fillStyle = live ? '#fff' : 'rgba(255,255,255,.45)'; ctx.font = '700 14px "DM Mono",ui-monospace,monospace'; ctx.textBaseline = 'middle';
      var tw = ctx.measureText('ON AIR').width; ctx.fillText('ON AIR', (W - tw) / 2 + 5, Hh / 2 + 1); ctx.textBaseline = 'alphabetic';
      ctx.beginPath(); ctx.arc((W - tw) / 2 - 5, Hh / 2, 3, 0, 7); ctx.fill();
    });
    if (live) { var c = iso(x + w / 2, y + .3, z + 10); var g = ctx.createRadialGradient(c[0], c[1], 2, c[0], c[1], 56); g.addColorStop(0, 'rgba(232,60,70,.30)'); g.addColorStop(1, 'rgba(232,60,70,0)'); ctx.fillStyle = g; ctx.fillRect(c[0] - 58, c[1] - 58, 116, 116); }
  }
  function drawTruss() {
    var z = 124, a = [1.4, 1.2], b = [7.8, 7.4];
    var c1 = iso(a[0], a[1], z), c2 = iso(b[0], a[1], z), c3 = iso(b[0], b[1], z), c4 = iso(a[0], b[1], z);
    [[c1, c2], [c2, c3], [c3, c4], [c4, c1]].forEach(function (s) { line(s[0], s[1], P.ink, 4.2); line(s[0], s[1], P.white, 2.4); });
    for (var i = 0; i < 6; i++) {
      var t = (i + .5) / 6, p = iso(a[0] + (b[0] - a[0]) * t, b[1], z), q = iso(b[0], a[1] + (b[1] - a[1]) * t, z);
      [p, q].forEach(function (pt, j) {
        line(pt, [pt[0], pt[1] + 5], P.ink, 1.2);
        ctx.fillStyle = P.mon; ctx.fillRect(pt[0] - 2.5, pt[1] + 5, 5, 5);
        var on = ((i + j) % 3) !== 0;
        ell(pt[0], pt[1] + 10.5, 2.2, 1.2, on ? '#fff3c8' : P.metalD);
        if (P.night && on) { var g = ctx.createRadialGradient(pt[0], pt[1] + 11, 1, pt[0], pt[1] + 11, 16); g.addColorStop(0, 'rgba(255,240,190,.35)'); g.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = g; ctx.fillRect(pt[0] - 16, pt[1] - 5, 32, 32); }
      });
    }
  }

  var cache = null, cacheKey = '';
  function shellKey() {
    var n = 0; DECOR.forEach(function (id) { if (ready(thumb(id))) n++; });
    return [W, H, dpr, scale, P.night, n, londonNow().m].join('|');
  }
  function drawShell() {
    var k = shellKey();
    if (!cache || k !== cacheKey) {
      cacheKey = k;
      cache = cache || document.createElement('canvas');
      cache.width = Math.ceil((SC.maxX - SC.minX) * scale * dpr); cache.height = Math.ceil((SC.maxY - SC.minY) * scale * dpr);
      var main = ctx; ctx = cache.getContext('2d');
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -SC.minX * scale * dpr, -SC.minY * scale * dpr);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      drawFloor(); drawWalls();
      ctx = main;
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(cache, Math.round(dpr * (ox + panX + SC.minX * scale)), Math.round(dpr * (oy + SC.minY * scale)));
    ctx.restore();
  }
  var seatedPeople = [];
  function drawSpot(key) {
    var who = key === 'videos' ? anchor : seatedPeople.filter(function (p) { return p.key === key; })[0];
    if (!who) return;
    var c = iso(who.x, who.y, 0), pulse = 1 + Math.sin(time / 260) * .06;
    ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(1, .5);
    var g = ctx.createRadialGradient(0, 0, 4, 0, 0, 46 * pulse);
    g.addColorStop(0, 'rgba(232,60,70,.45)'); g.addColorStop(.6, 'rgba(232,60,70,.16)'); g.addColorStop(1, 'rgba(232,60,70,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(200,40,58,.85)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, 22 * pulse, 0, 7); ctx.stroke();
    ctx.restore();
  }
  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (ox + panX), dpr * oy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (!reduce && time < 1200) { drawFloor(); drawWalls(); } else drawShell();
    drop(0, drawVideoWall);
    if (hoverKey) drawSpot(hoverKey);
    var list = [];
    props.forEach(function (p) { list.push({ k: p.key, f: p.draw, d: p.delay }); });
    seatedPeople.forEach(function (p) { list.push({ k: p.x + p.y + .01, f: function () { drawPerson(p); }, d: p.x + p.y }); });
    if (time > 2400 || reduce) walkers.forEach(function (w) { list.push({ k: w.x + w.y, f: function () { ctx.save(); ctx.globalAlpha = w.alpha; drawPerson(w); ctx.restore(); }, d: -1 }); });
    list.sort(function (a, b) { return a.k - b.k; });
    list.forEach(function (it) { if (it.d < 0) it.f(); else drop(it.d, it.f); });
    drop(24, drawBubble);
    drop(4, drawTruss);
    drop(5, drawOnAirSign);
  }

  var printOut = 0, printing = 0, last = 0, running = false, visible = true, paused = false, rafId = 0, clockTick = 0;
  var lastDraw = 0, frameGap = 31, dprCap = (window.innerWidth < 760 ? 1.5 : 2), ema = 0, tuned = 0;
  function frame(now) {
    rafId = 0;
    if (running && !reduce && now - lastDraw < frameGap) { rafId = requestAnimationFrame(frame); return; }
    lastDraw = now;
    var dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (!reduce && !paused) {
      time += dt * 1000;
      if (time > 2400) walkers.forEach(function (w) { w.update(dt); });
      wallT += dt; if (wallT > 4.5) { wallT = 0; wallIdx = (wallIdx + 1) % HERO.length; }
      printing -= dt; if (printing <= 0) { printing = 7 + Math.random() * 5; printOut = 0; }
      else if (printOut < 3.99) printOut = Math.min(3.99, printOut + dt * .9);
      if (autoPan && !dragging && panMin < 0) panX = panMin / 2 + Math.sin(time / 9000) * (-panMin / 2);
    }
    clockTick -= dt; if (clockTick <= 0 && clockEl) { clockTick = 5; var n = londonNow(); clockEl.textContent = pad(n.h) + ':' + pad(n.m); }
    var t0 = performance.now(); render(); placeHots();
    // adaptive quality: slower devices get fewer pixels, then fewer frames
    var ms = performance.now() - t0; ema = ema ? ema * .9 + ms * .1 : ms; window.__nrRenderMs = ema;
    if (time > 3500 && ++tuned % 30 === 0) {
      if (ema > 16 && dprCap > 1) { dprCap = 1; cacheKey = ''; resize(); }
      else if (ema > 22 && frameGap < 45) frameGap = 48;
    }
    if (running && !reduce) rafId = requestAnimationFrame(frame);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function start() { if (running || reduce) return; running = true; last = 0; rafId = requestAnimationFrame(frame); }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = 0; }
  function sync() { (visible && !document.hidden && !paused) ? start() : stop(); }

  /* drag to pan on narrow screens (horizontal only; vertical scrolling stays native) */
  var dragX0 = 0, pan0 = 0;
  canvas.addEventListener('pointerdown', function (e) { if (panMin >= 0) return; dragging = true; autoPan = false; dragX0 = e.clientX; pan0 = panX; });
  window.addEventListener('pointermove', function (e) { if (!dragging) return; panX = Math.max(panMin, Math.min(panMax, pan0 + e.clientX - dragX0)); if (!running) frame(performance.now()); });
  window.addEventListener('pointerup', function () { dragging = false; });
  window.addEventListener('pointercancel', function () { dragging = false; });

  if (pauseBtn) pauseBtn.addEventListener('click', function () {
    paused = !paused; pauseBtn.setAttribute('aria-pressed', String(paused)); pauseBtn.textContent = paused ? 'Play' : 'Pause'; sync();
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; sync(); }, { threshold: .02 }).observe(root);
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(function () { readTheme(); if (!running) frame(performance.now()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-site-theme'] });
  var rT = 0; window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(resize, 80); });

  /* ================= build ================= */
  readTheme();
  studio();
  pod(9.8, 2.4, 4, { B1: { single: true, thumb: YT.timeline.id }, B3: { mug: true } });
  pod(14.8, 2.4, 4, { B2: { papers: true } });
  pod(19.8, 2.4, 3, { B0: { mug: true } });
  pod(9.8, 6.7, 4, { tv: { at: 1.5, key: 'doctors' }, B2: { papers: true } });
  pod(14.8, 6.7, 4, { B1: { bottle: true }, B3: { mug: true } });
  pod(19.8, 6.7, 3, { B2: { papers: true } });
  pod(9.8, 11.0, 4, { B0: { mug: true } });
  pod(14.8, 11.0, 4, { tv: { at: 2.5, key: 'chatgpt' }, B3: { papers: true } });
  pod(1.6, 11.0, 7, { B4: { mug: true } });
  lounge(); backWallStuff(); frontStuff();
  var ST = [
    { key: 'investigative', x: 11.05, y: 1.2, sx: -1, hold: 'papers', look: { skin: '#b97a52', hair: '#1b1512', shirt: '#f2efe8', style: 'short', glasses: true } },
    { key: 'ai', x: 11.3, y: 4.45, sit: true, sx: -1, away: true, look: { skin: '#f1c7a5', hair: '#6b3a1e', shirt: '#3f7d79', style: 'long' } },
    { key: 'research', x: 22.55, y: .98, sx: 1, away: true, hold: 'book', look: { skin: '#8a5a3c', hair: '#2a1d17', shirt: '#8d5a7a', style: 'bun' } },
    { key: 'initiatives', x: 16.3, y: 1.18, sx: 1, away: true, hold: 'folder', look: { skin: '#e8b995', hair: '#b58a4a', shirt: '#3a4150', style: 'short' } },
    { key: 'osint', x: .5, y: 12.4, sx: -1, away: true, gesture: true, hold: 'magnifier', look: { skin: '#d9a07a', hair: '#3b2a20', shirt: '#e3ab3a', style: 'curly' } },
    { key: 'interviews', x: 3.0, y: 15.1, z: 9, sit: true, sx: 1, hold: 'mic', look: { skin: '#5e3b26', hair: '#1b1512', shirt: '#c8283a', style: 'long' } },
    { x: 4.7, y: 15.2, z: 9, sit: true, sx: -1, hold: 'none', look: { skin: '#f1c7a5', hair: '#9aa1a6', shirt: '#6c7a8a', style: 'short', glasses: true } },
    { key: 'courses', x: 23.05, y: 12.1, sx: -1, gesture: true, hold: 'marker', look: { skin: '#b97a52', hair: '#2a1d17', shirt: '#3f7d79', style: 'bun' } },
    { x: 20.95, y: 12.95, z: 13, sit: true, sx: 1, away: true, look: look() },
    { x: 21.75, y: 13.1, z: 13, sit: true, sx: 1, away: true, look: look() },
    { x: 22.55, y: 12.9, z: 13, sit: true, sx: 1, away: true, look: look() },
    { key: 'academic', x: 8.6, y: 15.25, sx: -1, hold: 'journal', look: { skin: '#e8b995', hair: '#3b2a20', shirt: '#7a5c8e', style: 'short', glasses: true } },
    { key: 'awards', x: 13.3, y: 14.8, sx: -1, gesture: true, hold: 'trophy', look: { skin: '#e8b995', hair: '#c9a064', shirt: '#23262e', style: 'long' } }
  ];
  seated = seated.filter(function (s) { return !(Math.abs(s.x - 11.3) < .01 && Math.abs(s.y - 4.45) < .01); });
  hotspotAt('videos', function () { return [anchor.x + .6, anchor.y + .6, 64]; });
  ST.forEach(function (st) {
    st.z = st.z || 0; st.walkT = 0;
    if (st.key) hotspotAt(st.key, function () { return [st.x, st.y, st.z + (st.sit ? 60 : 68)]; });
  });
  seatedPeople = seated.map(function (s) { return { x: s.x, y: s.y, z: 0, sit: true, sx: s.face > 0 ? 1 : -1, away: s.face < 0, look: look(), walkT: 0 }; }).concat(ST);
  for (var i = 0; i < 11; i++) walkers.push(new Walker(i));
  buildHotButtons();
  if (reduce) { time = 99999; walkers.forEach(function (w) { w.alpha = 1; }); if (pauseBtn) pauseBtn.hidden = true; }
  resize(); sync();
  if (reduce) frame(performance.now());
})();
