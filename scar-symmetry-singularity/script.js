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

renderTimeline();
renderTrackButtons();
renderRadar(0);
