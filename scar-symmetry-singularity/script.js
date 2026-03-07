const discography = [
  {
    year: 2005,
    album: "Symmetric in Design",
    subtitle: "Fundação",
    color: "#84fff5",
    y: 286,
  },
  {
    year: 2006,
    album: "Pitch Black Progress",
    subtitle: "Fundação",
    color: "#5ec4ff",
    y: 222,
  },
  {
    year: 2008,
    album: "Holographic Universe",
    subtitle: "Fundação",
    color: "#79a8ff",
    y: 168,
  },
  {
    year: 2009,
    album: "Dark Matter Dimensions",
    subtitle: "Dualidade",
    color: "#928cff",
    y: 246,
  },
  {
    year: 2011,
    album: "The Unseen Empire",
    subtitle: "Dualidade",
    color: "#c98cff",
    y: 318,
  },
  {
    year: 2014,
    album: "The Singularity (Phase I - Neohumanity)",
    subtitle: "Singularity",
    color: "#ff78a8",
    y: 210,
  },
  {
    year: 2023,
    album: "The Singularity (Phase II - Xenotaph)",
    subtitle: "Singularity",
    color: "#ffd999",
    y: 128,
  },
];

const trackProfiles = [
  {
    key: "illusionist",
    title: "The Illusionist",
    era: "Pitch Black Progress / 2006",
    note: "Entrada mais imediata: refrão grande, precisão cirúrgica e impacto sem perder clareza.",
    values: { melodia: 9, impacto: 8, prog: 6, escala: 6 },
    color: "#84fff5",
  },
  {
    key: "holographic",
    title: "Holographic Universe",
    era: "Holographic Universe / 2008",
    note: "Equilibra técnica e grandiosidade espacial com uma fluidez quase futurista.",
    values: { melodia: 9, impacto: 7, prog: 8, escala: 9 },
    color: "#6ea0ff",
  },
  {
    key: "ghost",
    title: "Ghost Prototype II",
    era: "Holographic Universe / 2008",
    note: "Puxa mais para a máquina de guerra: rápido, afiado e com senso de missão.",
    values: { melodia: 7, impacto: 9, prog: 7, escala: 8 },
    color: "#8f90ff",
  },
  {
    key: "limits",
    title: "Limits To Infinity",
    era: "Neohumanity / 2014",
    note: "Um manifesto da fase transumana: narrativa conceitual, arranjo amplo e refrão elevado.",
    values: { melodia: 8, impacto: 7, prog: 9, escala: 10 },
    color: "#ff7fab",
  },
  {
    key: "chrononautilus",
    title: "Chrononautilus",
    era: "Xenotaph / 2023",
    note: "Sci-fi melódica em alta rotação, com brilho futurista e sensação de expansão.",
    values: { melodia: 9, impacto: 7, prog: 8, escala: 10 },
    color: "#ffd999",
  },
  {
    key: "quadrant",
    title: "Scorched Quadrant",
    era: "Xenotaph / 2023",
    note: "Mais frio e mecânico, como se a banda comprimisse precisão clínica em forma de canção.",
    values: { melodia: 7, impacto: 8, prog: 8, escala: 9 },
    color: "#ff4e7d",
  },
];

const axisLabels = [
  { key: "melodia", label: "Melodia" },
  { key: "impacto", label: "Impacto" },
  { key: "prog", label: "Prog" },
  { key: "escala", label: "Escala sci-fi" },
];

const storyAlbums = [
  {
    year: 2005,
    album: "Symmetric in Design",
    phase: "Origem interior",
    color: "#84fff5",
    accent: "#6ea0ff",
    dek: "O primeiro capitulo olha para dentro: subconsciente, simbolos, assombro e cicatrizes emocionais.",
    summary:
      "No comeco, Scar Symmetry escreve como quem abre um laboratorio mental. Em entrevista, Henrik Ohlsson explicou que a proposta era explorar o subconsciente para recuperar imaginacao e senso de misterio; ouvindo o disco hoje, a leitura que fica e de feridas emocionais transformadas em arquitetura melodica.",
    members:
      "Henrik assume as letras; Christian Alvestam cristaliza o contraste entre gutural e clean; Per Nilsson, Jonas Kjellgren e Kenneth Seil ajudam a fixar a assinatura inicial.",
    songs: ["Dominion", "Veil of Illusions", "2012, The Demise of the 5th Sun"],
    tags: ["subconsciente", "misticismo", "cicatriz", "despertar"],
    axes: [
      { label: "interior", value: 92 },
      { label: "controle", value: 18 },
      { label: "cosmos", value: 48 },
      { label: "pos-humano", value: 8 },
    ],
  },
  {
    year: 2006,
    album: "Pitch Black Progress",
    phase: "Vigilia social",
    color: "#5ec4ff",
    accent: "#8d90ff",
    dek: "A camera sai da mente e encara sistemas de poder, programacao social e obediencia fabricada.",
    summary:
      "No segundo disco, a banda desloca o drama do intimo para o corpo social. Ao falar da transicao para esta fase, Henrik resumiu o album como uma historia sobre populacoes mantidas sob controle; titulos como 'Slaves to the Subliminal' e 'Mind Machine' fazem o disco soar como alerta contra engenharia mental.",
    members:
      "A mesma formacao da estreia fica mais ambiciosa e mais precisa, ja com o impulso de uma banda que comeca a ampliar o proprio alcance.",
    songs: ["The Illusionist", "Slaves to the Subliminal", "Mind Machine"],
    tags: ["controle", "vigilia", "engenharia social", "manipulacao"],
    axes: [
      { label: "interior", value: 38 },
      { label: "controle", value: 84 },
      { label: "cosmos", value: 56 },
      { label: "pos-humano", value: 22 },
    ],
  },
  {
    year: 2008,
    album: "Holographic Universe",
    phase: "Despertar cosmico",
    color: "#79a8ff",
    accent: "#c98cff",
    dek: "O discurso vira expansao: percepcao, livre-arbitrio, fisica quantica e um universo menos mecanico.",
    summary:
      "Aqui a banda descreveu as letras como uma reacao ao velho mundo mecanico. Em entrevista, Henrik ligou o disco a fisica quantica e filosofia oriental, sugerindo que a realidade depende mais da consciencia do que de um motor cego; por isso o album soa como despertar e nao apenas como ficcao cientifica.",
    members:
      "E o auge da primeira grande formacao. Pouco depois do lancamento, Christian deixa a banda e fecha a era vocal que definiu os tres primeiros discos.",
    songs: ["Holographic Universe", "Ghost Prototype II", "Prism and Gate"],
    tags: ["quantico", "livre-arbitrio", "consciencia", "expansao"],
    axes: [
      { label: "interior", value: 62 },
      { label: "controle", value: 52 },
      { label: "cosmos", value: 94 },
      { label: "pos-humano", value: 30 },
    ],
  },
  {
    year: 2009,
    album: "Dark Matter Dimensions",
    phase: "Reconstrucao",
    color: "#928cff",
    accent: "#ff78a8",
    dek: "A identidade vocal se quebra em duas e a narrativa ganha um tom de travessia entre planos, formas e ausencias.",
    summary:
      "O primeiro album sem Christian tem menos manifesto e mais vertigem. Esta e uma leitura editorial: com faixas como 'Noumenon and Phenomenon' e 'A Parenthesis in Eternity', o disco parece processar a ruptura da banda escrevendo sobre limiares, dualidades e passagem entre estados de existencia.",
    members:
      "Entram Lars Palmqvist e Roberth Karlsson, dividindo a funcao vocal. O som continua Scar Symmetry, mas agora o drama interno da banda aparece tambem na propria arquitetura das vozes.",
    songs: ["Noumenon and Phenomenon", "Ascension Chamber", "A Parenthesis in Eternity"],
    tags: ["limiar", "dualidade", "fratura", "metafisica"],
    axes: [
      { label: "interior", value: 54 },
      { label: "controle", value: 34 },
      { label: "cosmos", value: 86 },
      { label: "pos-humano", value: 48 },
    ],
  },
  {
    year: 2011,
    album: "The Unseen Empire",
    phase: "Paranoia explicita",
    color: "#c98cff",
    accent: "#ff7fab",
    dek: "O que antes era suspeita vira denuncia frontal: elites ocultas, governos-sombra e massas hipnotizadas.",
    summary:
      "Henrik apresentou este disco como uma tentativa de nomear a maquina escondida por tras do mundo visivel. Ao comentar o conceito, falou de ordens secretas, bloodlines, governanca invisivel e imaginacao reptiliana; o resultado e o trabalho mais conspiratorio e mais direto da banda.",
    members:
      "Com Lars e Roberth ja estabilizados, Scar Symmetry para de tentar substituir a antiga fase e assume outra identidade: duas vozes para um mundo dividido entre superficie e subterraneo.",
    songs: ["The Anomaly", "Extinction Mantra", "Illuminoid Dream Sequence"],
    tags: ["conspiracao", "elite", "governo-sombra", "paranoia"],
    axes: [
      { label: "interior", value: 22 },
      { label: "controle", value: 96 },
      { label: "cosmos", value: 66 },
      { label: "pos-humano", value: 28 },
    ],
  },
  {
    year: 2014,
    album: "The Singularity (Phase I - Neohumanity)",
    phase: "Transumanismo",
    color: "#ff78a8",
    accent: "#ffd999",
    dek: "A guerra deixa de ser secreta e vira projeto aberto de especie: IA, clonagem, criogenia e desigualdade evolutiva.",
    summary:
      "Na fase I da saga Singularity, Henrik e Per deslocam a narrativa para o futuro biologico e tecnologico. Em entrevista, eles citaram inteligencia artificial, roboetica, crionica, clonagem, artilects e a divisao entre quem tera acesso ao upgrade e quem ficara para tras; as letras deixam de perguntar quem manda e passam a perguntar quem ainda sera humano.",
    members:
      "Jonas deixa a banda em 2013. Per Nilsson assume o centro criativo e transforma Singularity no projeto mais ambicioso e mais coeso da historia do grupo.",
    songs: ["Limits To Infinity", "Cryonic Harvest", "Children of the Integrated Circuit"],
    tags: ["transumanismo", "IA", "criogenia", "classe biologica"],
    axes: [
      { label: "interior", value: 28 },
      { label: "controle", value: 54 },
      { label: "cosmos", value: 76 },
      { label: "pos-humano", value: 98 },
    ],
  },
  {
    year: 2023,
    album: "The Singularity (Phase II - Xenotaph)",
    phase: "Guerra do futuro",
    color: "#ffd999",
    accent: "#ff4e7d",
    dek: "A segunda fase afunda no lado mais sombrio da saga: alteridade, guerra simbolica e futuro sem inocencia.",
    summary:
      "Depois de um hiato longo, a saga volta mais densa. Per descreveu 'Xenotaph' como a entrada no lado mais sombrio do conceito e falou de uma presenca alienigena dentro da historia; por isso o disco parece menos utopico e mais belico, como se a banda observasse a proxima etapa da evolucao ja sob combustao.",
    members:
      "Per segura composicao, producao e direcao do projeto; Lars e Roberth seguem como dupla dramatica, alternando proclamacao e colapso sobre um pano de fundo cada vez mais cinematografico.",
    songs: ["Chrononautilus", "Scorched Quadrant", "Xenotaph"],
    tags: ["guerra", "alteridade", "singularity", "colapso"],
    axes: [
      { label: "interior", value: 18 },
      { label: "controle", value: 62 },
      { label: "cosmos", value: 88 },
      { label: "pos-humano", value: 100 },
    ],
  },
];

function renderTimeline() {
  const container = document.querySelector("#timeline-chart");
  if (!container) return;

  const minYear = 2005;
  const maxYear = 2023;
  const left = 96;
  const right = 1120;
  const yearToX = (year) => left + ((year - minYear) / (maxYear - minYear)) * (right - left);

  const linePath = discography
    .map((entry, index) => `${index === 0 ? "M" : "L"} ${yearToX(entry.year).toFixed(1)} ${entry.y}`)
    .join(" ");

  container.innerHTML = `
    <svg viewBox="0 0 1200 430" role="img" aria-labelledby="timelineTitle timelineDesc">
      <title id="timelineTitle">Linha do tempo da discografia da Scar Symmetry</title>
      <desc id="timelineDesc">Sete álbuns entre 2005 e 2023 agrupados em três eras.</desc>
      <defs>
        <linearGradient id="timelineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#84fff5"></stop>
          <stop offset="55%" stop-color="#928cff"></stop>
          <stop offset="100%" stop-color="#ff9abb"></stop>
        </linearGradient>
        <linearGradient id="bandFoundation" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(132,255,245,0.16)"></stop>
          <stop offset="100%" stop-color="rgba(110,160,255,0.06)"></stop>
        </linearGradient>
        <linearGradient id="bandDuality" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(110,160,255,0.14)"></stop>
          <stop offset="100%" stop-color="rgba(201,140,255,0.06)"></stop>
        </linearGradient>
        <linearGradient id="bandSingularity" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(255,126,171,0.16)"></stop>
          <stop offset="100%" stop-color="rgba(255,217,153,0.08)"></stop>
        </linearGradient>
      </defs>

      <rect x="82" y="58" width="312" height="276" rx="22" fill="url(#bandFoundation)" stroke="rgba(132,255,245,0.18)"></rect>
      <rect x="402" y="58" width="220" height="276" rx="22" fill="url(#bandDuality)" stroke="rgba(146,140,255,0.18)"></rect>
      <rect x="630" y="58" width="500" height="276" rx="22" fill="url(#bandSingularity)" stroke="rgba(255,126,171,0.18)"></rect>

      <text x="102" y="88" fill="#84fff5" font-size="16" font-family="Orbitron, sans-serif">Fundação</text>
      <text x="422" y="88" fill="#b9b7ff" font-size="16" font-family="Orbitron, sans-serif">Dualidade</text>
      <text x="650" y="88" fill="#ffc0d3" font-size="16" font-family="Orbitron, sans-serif">Singularity</text>

      ${Array.from({ length: maxYear - minYear + 1 }, (_, idx) => {
        const year = minYear + idx;
        const x = yearToX(year);
        return `
          <line x1="${x}" y1="110" x2="${x}" y2="340" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 10"></line>
          <text x="${x}" y="374" text-anchor="middle" fill="#8ea5bb" font-size="14">${year}</text>
        `;
      }).join("")}

      <path d="${linePath}" fill="none" stroke="url(#timelineStroke)" stroke-width="4" stroke-linecap="round"></path>

      ${discography.map((entry) => {
        const x = yearToX(entry.year);
        const labelY = entry.y - 24;
        const lineY = entry.y + 42;
        const textAnchor = entry.year >= 2014 ? "end" : "start";
        const textX = entry.year >= 2014 ? x - 18 : x + 18;
        return `
          <circle cx="${x}" cy="${entry.y}" r="10" fill="${entry.color}" stroke="#071322" stroke-width="4"></circle>
          <circle cx="${x}" cy="${entry.y}" r="24" fill="none" stroke="${entry.color}" stroke-opacity="0.26"></circle>
          <line x1="${x}" y1="${entry.y + 10}" x2="${x}" y2="${lineY}" stroke="${entry.color}" stroke-opacity="0.35"></line>
          <text x="${textX}" y="${labelY}" text-anchor="${textAnchor}" fill="#f4fbff" font-size="16" font-family="Orbitron, sans-serif">${entry.album}</text>
          <text x="${textX}" y="${labelY + 22}" text-anchor="${textAnchor}" fill="#90a6bc" font-size="13">${entry.year} • ${entry.subtitle}</text>
        `;
      }).join("")}
    </svg>
  `;
}

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function buildPolygon(points) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function renderRadar(index) {
  const chart = document.querySelector("#radar-chart");
  const title = document.querySelector("#radar-title");
  const note = document.querySelector("#radar-note");
  const buttons = document.querySelectorAll(".track-button");

  if (!chart || !title || !note) return;

  const profile = trackProfiles[index];
  const centerX = 280;
  const centerY = 250;
  const maxRadius = 150;
  const levels = 5;

  const levelPolygons = Array.from({ length: levels }, (_, idx) => {
    const radius = (maxRadius / levels) * (idx + 1);
    const points = axisLabels.map((_, axisIndex) => {
      const angle = axisIndex * (360 / axisLabels.length);
      return polarToCartesian(centerX, centerY, radius, angle);
    });
    return `<polygon points="${buildPolygon(points)}" fill="none" stroke="rgba(255,255,255,0.08)"></polygon>`;
  }).join("");

  const axisLines = axisLabels.map((axis, axisIndex) => {
    const angle = axisIndex * (360 / axisLabels.length);
    const outer = polarToCartesian(centerX, centerY, maxRadius + 26, angle);
    const textPos = polarToCartesian(centerX, centerY, maxRadius + 52, angle);
    return `
      <line x1="${centerX}" y1="${centerY}" x2="${outer.x}" y2="${outer.y}" stroke="rgba(255,255,255,0.1)"></line>
      <text x="${textPos.x}" y="${textPos.y}" text-anchor="middle" fill="#9eb4ca" font-size="14">${axis.label}</text>
    `;
  }).join("");

  const polygonPoints = axisLabels.map((axis, axisIndex) => {
    const angle = axisIndex * (360 / axisLabels.length);
    const value = profile.values[axis.key];
    const radius = (value / 10) * maxRadius;
    return polarToCartesian(centerX, centerY, radius, angle);
  });

  const valueDots = polygonPoints
    .map(
      (point) =>
        `<circle cx="${point.x}" cy="${point.y}" r="5.5" fill="${profile.color}" stroke="#03101d" stroke-width="3"></circle>`
    )
    .join("");

  chart.innerHTML = `
    <svg viewBox="0 0 560 500" role="img" aria-labelledby="radarTitle radarDesc">
      <title id="radarTitle">Mapa editorial da faixa ${profile.title}</title>
      <desc id="radarDesc">Gráfico radar com quatro eixos: melodia, impacto, ambição progressiva e escala sci-fi.</desc>
      <defs>
        <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${profile.color}" stop-opacity="0.86"></stop>
          <stop offset="100%" stop-color="#6e8cff" stop-opacity="0.26"></stop>
        </linearGradient>
      </defs>
      <rect x="50" y="40" width="460" height="420" rx="28" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)"></rect>
      ${levelPolygons}
      ${axisLines}
      <polygon points="${buildPolygon(polygonPoints)}" fill="url(#radarGradient)" stroke="${profile.color}" stroke-width="3"></polygon>
      ${valueDots}
    </svg>
  `;

  title.textContent = profile.title;
  note.textContent = `${profile.era}. ${profile.note}`;

  buttons.forEach((button, buttonIndex) => {
    button.classList.toggle("is-active", buttonIndex === index);
    button.setAttribute("aria-pressed", buttonIndex === index ? "true" : "false");
  });
}

function renderTrackButtons() {
  const container = document.querySelector("#track-buttons");
  if (!container) return;

  container.innerHTML = trackProfiles
    .map(
      (profile, index) => `
        <button class="track-button ${index === 0 ? "is-active" : ""}" type="button" data-index="${index}" aria-pressed="${index === 0 ? "true" : "false"}">
          <strong>${profile.title}</strong>
          <span>${profile.era}</span>
        </button>
      `
    )
    .join("");

  container.addEventListener("click", (event) => {
    const target = event.target.closest(".track-button");
    if (!target) return;
    renderRadar(Number(target.dataset.index));
  });
}

function renderStorySteps() {
  const container = document.querySelector("#story-steps");
  if (!container) return;

  container.innerHTML = storyAlbums
    .map(
      (story, index) => `
        <article class="story-step ${index === 0 ? "is-active" : ""}" data-index="${index}" aria-current="${index === 0 ? "step" : "false"}" tabindex="0">
          <div class="story-step-head">
            <div>
              <p class="micro-label">${story.year}</p>
              <h3>${story.album}</h3>
            </div>
            <span class="story-step-phase">${story.phase}</span>
          </div>
          <p class="story-step-body">${story.summary}</p>
          <div class="story-pills">
            ${story.tags.map((tag) => `<span class="story-pill">${tag}</span>`).join("")}
          </div>
          <div class="story-step-meta">
            <p><strong>Faixas-farol:</strong> ${story.songs.join(", ")}</p>
            <p><strong>Membros em foco:</strong> ${story.members}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderStoryStage(index) {
  const stage = document.querySelector("#story-stage");
  const steps = document.querySelectorAll(".story-step");

  if (!stage) return;

  const story = storyAlbums[index];
  stage.style.setProperty("--story-accent", story.color);
  stage.style.setProperty("--story-accent-secondary", story.accent);

  stage.innerHTML = `
    <div class="story-stage-top">
      <p class="micro-label">Capitulo ${index + 1} / ${storyAlbums.length}</p>
      <span class="story-stage-chip">${story.phase}</span>
    </div>
    <div class="story-stage-visual" aria-hidden="true">
      <span class="story-stage-year">${story.year}</span>
    </div>
    <h3>${story.album}</h3>
    <p class="story-stage-dek">${story.dek}</p>
    <div class="story-axis-list" aria-label="Intensidade dos vetores liricos">
      ${story.axes
        .map(
          (axis) => `
            <div class="story-axis-item">
              <span>${axis.label}</span>
              <div class="story-axis-bar">
                <div class="story-axis-fill" style="--value:${axis.value}"></div>
              </div>
              <strong>${axis.value}</strong>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="story-stage-notes">
      <div>
        <p class="micro-label">Faixas-farol</p>
        <p>${story.songs.join(" • ")}</p>
      </div>
      <div>
        <p class="micro-label">Membros em foco</p>
        <p>${story.members}</p>
      </div>
    </div>
  `;

  steps.forEach((step, stepIndex) => {
    const isActive = stepIndex === index;
    step.classList.toggle("is-active", isActive);
    step.setAttribute("aria-current", isActive ? "step" : "false");
  });
}

function initStorytelling() {
  const container = document.querySelector("#story-steps");
  if (!container) return;

  renderStorySteps();
  renderStoryStage(0);

  const steps = Array.from(container.querySelectorAll(".story-step"));
  let activeIndex = 0;

  const setActive = (index) => {
    if (index === activeIndex) return;
    activeIndex = index;
    renderStoryStage(index);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      if (!visible.length) return;

      visible.sort(
        (first, second) =>
          Math.abs(first.boundingClientRect.top - 160) - Math.abs(second.boundingClientRect.top - 160)
      );

      setActive(Number(visible[0].target.dataset.index));
    },
    {
      rootMargin: "-18% 0px -42% 0px",
      threshold: [0.15, 0.5, 0.75],
    }
  );

  steps.forEach((step) => observer.observe(step));

  container.addEventListener("pointerover", (event) => {
    const step = event.target.closest(".story-step");
    if (!step) return;
    setActive(Number(step.dataset.index));
  });

  container.addEventListener("focusin", (event) => {
    const step = event.target.closest(".story-step");
    if (!step) return;
    setActive(Number(step.dataset.index));
  });
}

renderTimeline();
initStorytelling();
renderTrackButtons();
renderRadar(0);
