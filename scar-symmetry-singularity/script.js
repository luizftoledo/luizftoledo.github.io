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

const spotifySignalTracks = [
  {
    title: "2012 - The Demise of the 5th Sun",
    shortTitle: "2012",
    album: "Symmetric in Design",
    year: 2005,
    tempo: 140,
    durationLabel: "3:51",
    durationSeconds: 231,
    popularity: 18,
    key: "C# major",
    partial: true,
    note: "No recorte publico consultado, esta faixa expunha com mais facilidade tempo, duracao e popularidade do que os demais campos.",
  },
  {
    title: "The Illusionist",
    shortTitle: "The Illusionist",
    album: "Pitch Black Progress",
    year: 2006,
    tempo: 75,
    durationLabel: "4:31",
    durationSeconds: 271,
    popularity: 40,
    danceability: 40,
    energy: 96,
    liveness: 14,
    instrumentalness: 0,
    valence: 40,
    loudness: -3.67,
    key: "D major",
  },
  {
    title: "Mind Machine",
    shortTitle: "Mind Machine",
    album: "Pitch Black Progress",
    year: 2006,
    tempo: 85,
    durationLabel: "3:53",
    durationSeconds: 233,
    popularity: 31,
    danceability: 44,
    energy: 98,
    liveness: 9,
    instrumentalness: 1,
    valence: 57,
    loudness: -3.0,
    key: "F# minor",
  },
  {
    title: "Morphogenesis",
    shortTitle: "Morphogenesis",
    album: "Holographic Universe",
    year: 2008,
    tempo: 120,
    durationLabel: "3:54",
    durationSeconds: 234,
    popularity: 43,
    danceability: 46,
    energy: 94,
    liveness: 38,
    instrumentalness: 2,
    valence: 48,
    loudness: -3.15,
    key: "D minor",
  },
  {
    title: "Quantumleaper",
    shortTitle: "Quantumleaper",
    album: "Holographic Universe",
    year: 2008,
    tempo: 167,
    durationLabel: "4:09",
    durationSeconds: 249,
    popularity: 35,
    danceability: 38,
    energy: 99,
    liveness: 9,
    instrumentalness: 0,
    valence: 31,
    loudness: -2.84,
    key: "B minor",
  },
  {
    title: "Artificial Sun Projection",
    shortTitle: "Artificial Sun",
    album: "Holographic Universe",
    year: 2008,
    tempo: 100,
    durationLabel: "4:00",
    durationSeconds: 240,
    popularity: 38,
    danceability: 43,
    energy: 96,
    liveness: 35,
    instrumentalness: 9,
    valence: 30,
    loudness: -3.27,
    key: "E minor",
  },
  {
    title: "Ghost Prototype I - Measurement of Thought",
    shortTitle: "Ghost Prototype I",
    album: "Holographic Universe",
    year: 2008,
    tempo: 90,
    durationLabel: "4:35",
    durationSeconds: 275,
    popularity: 36,
    danceability: 46,
    energy: 98,
    liveness: 10,
    instrumentalness: 0,
    valence: 60,
    loudness: -3.0,
    key: "B minor",
  },
  {
    title: "Ghost Prototype II - Deus Ex Machina",
    shortTitle: "Ghost Prototype II",
    album: "Holographic Universe",
    year: 2008,
    tempo: 200,
    durationLabel: "6:03",
    durationSeconds: 363,
    popularity: 32,
    danceability: 35,
    energy: 98,
    liveness: 11,
    instrumentalness: 2,
    valence: 30,
    loudness: -4.0,
    key: "B major",
  },
  {
    title: "Chaosweaver",
    shortTitle: "Chaosweaver",
    album: "Holographic Universe",
    year: 2008,
    tempo: 165,
    durationLabel: "3:40",
    durationSeconds: 220,
    popularity: 30,
    danceability: 28,
    energy: 98,
    liveness: 36,
    instrumentalness: 33,
    valence: 23,
    loudness: -3.92,
    key: "B minor",
  },
  {
    title: "The Spiral Timeshift",
    shortTitle: "Spiral Timeshift",
    album: "Dark Matter Dimensions",
    year: 2009,
    tempo: 90,
    durationLabel: "4:50",
    durationSeconds: 290,
    popularity: 20,
    danceability: 45,
    energy: 99,
    liveness: 39,
    instrumentalness: 0,
    valence: 36,
    loudness: -2.46,
    key: "A major",
  },
  {
    title: "The Anomaly",
    shortTitle: "The Anomaly",
    album: "The Unseen Empire",
    year: 2011,
    tempo: 95,
    durationLabel: "3:50",
    durationSeconds: 230,
    popularity: 42,
    danceability: 39,
    energy: 99,
    liveness: 33,
    instrumentalness: 0,
    valence: 14,
    loudness: -3.1,
    key: "C# minor",
  },
  {
    title: "Limits To Infinity",
    shortTitle: "Limits To Infinity",
    album: "The Singularity (Phase I - Neohumanity)",
    year: 2014,
    tempo: 139,
    durationLabel: "4:57",
    durationSeconds: 297,
    popularity: 32,
    danceability: 46,
    energy: 98,
    liveness: 34,
    instrumentalness: 0,
    valence: 34,
    loudness: -2.77,
    key: "D major",
  },
  {
    title: "Technocalyptic Cybergeddon",
    shortTitle: "Technocalyptic",
    album: "The Singularity (Phase I - Neohumanity)",
    year: 2014,
    tempo: 120,
    durationLabel: "10:12",
    durationSeconds: 612,
    popularity: 13,
    danceability: 24,
    energy: 99,
    liveness: 13,
    instrumentalness: 1,
    valence: 9,
    loudness: -3.83,
    key: "C# minor",
  },
  {
    title: "Chrononautilus",
    shortTitle: "Chrononautilus",
    album: "The Singularity (Phase II - Xenotaph)",
    year: 2023,
    tempo: 120,
    durationLabel: "5:04",
    durationSeconds: 304,
    popularity: 27,
    danceability: 50,
    energy: 98,
    liveness: 33,
    instrumentalness: 8,
    valence: 14,
    loudness: -6.52,
    key: "C# minor",
  },
  {
    title: "Scorched Quadrant",
    shortTitle: "Scorched Quadrant",
    album: "The Singularity (Phase II - Xenotaph)",
    year: 2023,
    tempo: 170,
    durationLabel: "5:05",
    durationSeconds: 305,
    popularity: 31,
    danceability: 34,
    energy: 98,
    liveness: 37,
    instrumentalness: 47,
    valence: 42,
    loudness: -7.13,
    key: "F# major",
  },
];

const signalTracksFull = spotifySignalTracks.filter((track) => !track.partial);
const albumStoryLookup = new Map(storyAlbums.map((story) => [story.album, story]));

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricAverage(tracks, key) {
  return average(tracks.map((track) => track[key]).filter((value) => Number.isFinite(value)));
}

function metricBarValue(metric, value) {
  if (!Number.isFinite(value)) return 0;
  if (metric === "tempo") return Math.min((value / 200) * 100, 100);
  if (metric === "durationSeconds") return Math.min((value / 612) * 100, 100);
  if (metric === "loudness") return Math.min(Math.max((value + 8) * 12.5, 0), 100);
  return Math.min(Math.max(value, 0), 100);
}

function metricLabel(metric, value) {
  if (!Number.isFinite(value)) return "n/d";
  if (metric === "tempo") return `${Math.round(value)} BPM`;
  if (metric === "durationSeconds") return formatDuration(value);
  if (metric === "loudness") return `${value.toFixed(1)} dB`;
  return `${Math.round(value)}`;
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function energyColor(energy) {
  if (energy >= 99) return "#ff4e7d";
  if (energy >= 98) return "#ffc05e";
  if (energy >= 96) return "#84fff5";
  return "#6e8cff";
}

function textEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function albumTrackData(albumName) {
  return spotifySignalTracks.filter((track) => track.album === albumName);
}

function albumSignalSummaries() {
  return discography.map((entry) => {
    const tracks = albumTrackData(entry.album);
    const story = albumStoryLookup.get(entry.album);
    const metrics = {
      energy: metricAverage(tracks, "energy"),
      valence: metricAverage(tracks, "valence"),
      danceability: metricAverage(tracks, "danceability"),
      liveness: metricAverage(tracks, "liveness"),
      instrumentalness: metricAverage(tracks, "instrumentalness"),
      popularity: metricAverage(tracks, "popularity"),
      tempo: metricAverage(tracks, "tempo"),
      durationSeconds: metricAverage(tracks, "durationSeconds"),
    };

    return {
      ...entry,
      story,
      tracks,
      metrics,
      partial: tracks.some((track) => track.partial),
    };
  });
}

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

function renderSignalFocus(index) {
  const container = document.querySelector("#signal-focus");
  if (!container) return;

  const track = signalTracksFull[index];
  container.innerHTML = `
    <p class="micro-label">Faixa ativa</p>
    <h3>${track.title}</h3>
    <p class="signal-focus-meta">${track.album} • ${track.year} • ${track.key}</p>
    <div class="signal-focus-grid">
      <div><span>tempo</span><br><strong>${Math.round(track.tempo)} BPM</strong></div>
      <div><span>duracao</span><br><strong>${track.durationLabel}</strong></div>
      <div><span>valencia</span><br><strong>${track.valence}</strong></div>
      <div><span>energia</span><br><strong>${track.energy}</strong></div>
      <div><span>danceability</span><br><strong>${track.danceability}</strong></div>
      <div><span>instrumental</span><br><strong>${track.instrumentalness}</strong></div>
    </div>
  `;
}

function renderSignalInsights() {
  const container = document.querySelector("#signal-insights");
  if (!container) return;

  const longest = signalTracksFull.reduce((best, track) =>
    track.durationSeconds > best.durationSeconds ? track : best
  );
  const brightest = signalTracksFull.reduce((best, track) => (track.valence > best.valence ? track : best));
  const fastest = signalTracksFull.reduce((best, track) => (track.tempo > best.tempo ? track : best));
  const strangest = signalTracksFull.reduce((best, track) =>
    track.instrumentalness > best.instrumentalness ? track : best
  );

  const insights = [
    {
      title: "Pulso maximo",
      body: `${fastest.shortTitle} e o ponto mais veloz do recorte, com ${Math.round(fastest.tempo)} BPM e energia quase saturada.`,
    },
    {
      title: "Brilho raro",
      body: `${brightest.shortTitle} e a faixa mais alta em valencia, mostrando que a banda pode soar luminosa mesmo quando continua pesada.`,
    },
    {
      title: "Orbita longa",
      body: `${longest.shortTitle} dilata o tempo em ${longest.durationLabel}, transformando o painel em uma faixa de longa combustao.`,
    },
    {
      title: "Zona estranha",
      body: `${strangest.shortTitle} leva a maior carga instrumental do recorte e empurra a banda para um terreno mais mecanico e abstrato.`,
    },
  ];

  container.innerHTML = insights
    .map(
      (insight) => `
        <div class="signal-insight">
          <strong>${insight.title}</strong>
          <p>${insight.body}</p>
        </div>
      `
    )
    .join("");
}

function renderSignalConstellation(activeIndex = 0) {
  const container = document.querySelector("#signal-constellation");
  if (!container) return;

  const width = 900;
  const height = 560;
  const margin = { top: 34, right: 44, bottom: 64, left: 78 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const bpmMin = 70;
  const bpmMax = 205;
  const valenceMin = 0;
  const valenceMax = 65;

  const xScale = (value) => margin.left + ((value - bpmMin) / (bpmMax - bpmMin)) * plotWidth;
  const yScale = (value) =>
    margin.top + plotHeight - ((value - valenceMin) / (valenceMax - valenceMin)) * plotHeight;

  const durationMin = Math.min(...signalTracksFull.map((track) => track.durationSeconds));
  const durationMax = Math.max(...signalTracksFull.map((track) => track.durationSeconds));

  const radiusFor = (track) =>
    10 + ((track.durationSeconds - durationMin) / (durationMax - durationMin || 1)) * 18;

  const annotationTitles = new Set([
    "Mind Machine",
    "Ghost Prototype II - Deus Ex Machina",
    "Technocalyptic Cybergeddon",
    "Scorched Quadrant",
  ]);

  const points = signalTracksFull
    .map((track, index) => {
      const x = xScale(track.tempo);
      const y = yScale(track.valence);
      const radius = radiusFor(track);
      const glow = radius + 9;
      const selected = index === activeIndex;
      return `
        <g class="signal-point ${selected ? "is-selected" : ""}" data-index="${index}">
          <circle cx="${x}" cy="${y}" r="${glow}" fill="${energyColor(track.energy)}" opacity="${selected ? 0.16 : 0.09}"></circle>
          <circle
            cx="${x}"
            cy="${y}"
            r="${radius}"
            fill="${energyColor(track.energy)}"
            fill-opacity="${selected ? 0.94 : 0.76}"
            stroke="${selected ? "#f7fbff" : "#081321"}"
            stroke-width="${selected ? 3 : 2}"
            tabindex="0"
            role="button"
            aria-label="${textEscape(track.title)}"
            data-index="${index}"
          ></circle>
          <circle cx="${x}" cy="${y}" r="${radius - 5}" fill="none" stroke="rgba(255,255,255,0.14)" data-index="${index}"></circle>
        </g>
      `;
    })
    .join("");

  const annotations = signalTracksFull
    .filter((track) => annotationTitles.has(track.title))
    .map((track) => {
      const x = xScale(track.tempo);
      const y = yScale(track.valence);
      const labelX = track.tempo > 150 ? x - 18 : x + 18;
      const labelAnchor = track.tempo > 150 ? "end" : "start";
      const labelY = track.title.includes("Technocalyptic") ? y + 42 : y - 18;
      return `
        <line x1="${x}" y1="${y}" x2="${labelX}" y2="${labelY + 4}" stroke="rgba(255,255,255,0.14)"></line>
        <text x="${labelX}" y="${labelY}" text-anchor="${labelAnchor}" fill="#f4fbff" font-size="13">${track.shortTitle}</text>
      `;
    })
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="signalTitle signalDesc">
      <title id="signalTitle">Mapa cosmico com variaveis de audio do Spotify</title>
      <desc id="signalDesc">Faixas-farol posicionadas por tempo e valencia; energia muda a cor e a duracao muda o tamanho.</desc>
      <defs>
        <linearGradient id="signalAxis" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="rgba(132,255,245,0.55)"></stop>
          <stop offset="100%" stop-color="rgba(255,78,125,0.28)"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="28" fill="rgba(255,255,255,0.01)"></rect>
      ${[10, 20, 30, 40, 50, 60]
        .map((tick) => {
          const y = yScale(tick);
          return `
            <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 10"></line>
            <text x="${margin.left - 16}" y="${y + 4}" text-anchor="end" fill="#8ea5bb" font-size="12">${tick}</text>
          `;
        })
        .join("")}
      ${[80, 100, 120, 140, 160, 180, 200]
        .map((tick) => {
          const x = xScale(tick);
          return `
            <line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 10"></line>
            <text x="${x}" y="${height - margin.bottom + 24}" text-anchor="middle" fill="#8ea5bb" font-size="12">${tick}</text>
          `;
        })
        .join("")}
      <rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" rx="24" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)"></rect>
      ${annotations}
      ${points}
      <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="url(#signalAxis)"></line>
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="url(#signalAxis)"></line>
      <text x="${width / 2}" y="${height - 16}" text-anchor="middle" fill="#9eb4ca" font-size="14">tempo / BPM</text>
      <text transform="translate(20 ${height / 2}) rotate(-90)" text-anchor="middle" fill="#9eb4ca" font-size="14">valencia / positividade</text>
      <text x="${width - margin.right}" y="${margin.top - 10}" text-anchor="end" fill="#84fff5" font-size="13">mais veloz</text>
      <text x="${margin.left}" y="${margin.top - 10}" text-anchor="start" fill="#ff9abb" font-size="13">mais sombria</text>
    </svg>
  `;
}

function renderAlbumCards() {
  const container = document.querySelector("#album-cards");
  if (!container) return;

  const metricOrder = [
    { key: "energy", label: "energia" },
    { key: "valence", label: "valencia" },
    { key: "danceability", label: "dance" },
    { key: "liveness", label: "liveness" },
    { key: "instrumentalness", label: "instrumental" },
    { key: "popularity", label: "popularidade" },
  ];

  container.innerHTML = albumSignalSummaries()
    .map((album) => {
      const pills = [
        `<span class="album-card-pill">${album.tracks.length} faixa${album.tracks.length > 1 ? "s" : ""}</span>`,
        album.partial ? `<span class="album-card-pill">sinal parcial</span>` : "",
        album.story ? `<span class="album-card-pill">${album.story.phase}</span>` : "",
      ]
        .filter(Boolean)
        .join("");

      const metrics = metricOrder
        .map(({ key, label }) => {
          const value = album.metrics[key];
          return `
            <div class="album-metric">
              <div class="album-metric-top">
                <span>${label}</span>
                <strong>${metricLabel(key, value)}</strong>
              </div>
              <div class="album-metric-bar">
                <div class="album-metric-fill" style="--value:${metricBarValue(key, value)}"></div>
              </div>
            </div>
          `;
        })
        .join("");

      const note = album.partial
        ? "Este cartao mistura uma faixa-farol com sinal incompleto e por isso serve mais como farol de direcao do que como media fechada."
        : "Leitura derivada apenas das faixas-farol exibidas nesta pagina, para deixar cada era mais legivel visualmente.";

      return `
        <article class="album-card">
          <div class="album-card-head">
            <div>
              <p class="micro-label">${album.year}</p>
              <h3>${album.album}</h3>
              <p class="album-card-year">${album.story ? album.story.phase : "Sinal de album"}</p>
            </div>
            <div class="album-card-pills">${pills}</div>
          </div>
          <p class="album-card-dek">${album.story ? album.story.dek : "Recorte de atributos de audio inspirado nas faixas centrais do album."}</p>
          <div class="album-metric-grid">${metrics}</div>
          <div class="album-card-footer">
            <p><strong>Tempo medio:</strong> ${metricLabel("tempo", album.metrics.tempo)} • <strong>Duracao media:</strong> ${metricLabel("durationSeconds", album.metrics.durationSeconds)}</p>
            <p><strong>Faixas-farol:</strong> ${album.tracks.map((track) => track.shortTitle).join(", ")}</p>
            <p>${note}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRuntimeStrips() {
  const container = document.querySelector("#runtime-strips");
  if (!container) return;

  const width = 520;
  const rowHeight = 34;
  const margin = { top: 34, right: 18, bottom: 34, left: 150 };
  const maxDuration = Math.max(...spotifySignalTracks.map((track) => track.durationSeconds));
  const height = margin.top + margin.bottom + rowHeight * spotifySignalTracks.length;

  const xScale = (seconds) => margin.left + (seconds / maxDuration) * (width - margin.left - margin.right);

  const rows = spotifySignalTracks
    .slice()
    .sort((first, second) => first.year - second.year || first.durationSeconds - second.durationSeconds)
    .map((track, index) => {
      const y = margin.top + index * rowHeight;
      const x = xScale(track.durationSeconds);
      const stroke = energyColor(track.energy || 95);
      const dash = `${Math.max(6, 220 / track.tempo)} ${Math.max(4, 120 / track.tempo)}`;
      const endRadius = 5 + ((track.popularity || 20) / 100) * 8;
      return `
        <text x="${margin.left - 12}" y="${y + 20}" text-anchor="end" fill="#eaf4ff" font-size="12">${track.shortTitle}</text>
        <text x="${margin.left - 12}" y="${y + 9}" text-anchor="end" fill="#7f95aa" font-size="10">${track.year}</text>
        <line x1="${margin.left}" y1="${y + 16}" x2="${width - margin.right}" y2="${y + 16}" stroke="rgba(255,255,255,0.05)"></line>
        <line x1="${margin.left}" y1="${y + 16}" x2="${x}" y2="${y + 16}" stroke="${stroke}" stroke-width="8" stroke-linecap="round"></line>
        <line x1="${margin.left}" y1="${y + 16}" x2="${x}" y2="${y + 16}" stroke="rgba(7,17,32,0.58)" stroke-width="3" stroke-dasharray="${dash}"></line>
        <circle cx="${x}" cy="${y + 16}" r="${endRadius}" fill="${stroke}" stroke="#071322" stroke-width="2"></circle>
        <text x="${x + 12}" y="${y + 13}" fill="#f7fbff" font-size="11">${track.durationLabel}</text>
        <text x="${x + 12}" y="${y + 27}" fill="#8ea5bb" font-size="10">${Math.round(track.tempo)} BPM</text>
      `;
    })
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="runtimeTitle runtimeDesc">
      <title id="runtimeTitle">Duracao e tempo das faixas-farol</title>
      <desc id="runtimeDesc">Cada faixa cresce de acordo com a duracao e ganha estrias de acordo com o BPM.</desc>
      ${[180, 300, 420, 540, 600]
        .map((tick) => {
          const x = xScale(tick);
          return `
            <line x1="${x}" y1="${margin.top - 12}" x2="${x}" y2="${height - margin.bottom + 8}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 10"></line>
            <text x="${x}" y="${height - 8}" text-anchor="middle" fill="#8ea5bb" font-size="11">${formatDuration(tick)}</text>
          `;
        })
        .join("")}
      ${rows}
    </svg>
  `;
}

function initSignalLab() {
  const container = document.querySelector("#signal-constellation");
  if (!container) return;

  let activeIndex = 0;

  const setActive = (index) => {
    activeIndex = index;
    renderSignalConstellation(activeIndex);
    renderSignalFocus(activeIndex);
  };

  renderSignalInsights();
  renderAlbumCards();
  renderRuntimeStrips();
  setActive(0);

  container.addEventListener("pointerover", (event) => {
    const target = event.target.closest("[data-index]");
    if (!target) return;
    setActive(Number(target.dataset.index));
  });

  container.addEventListener("focusin", (event) => {
    const target = event.target.closest("[data-index]");
    if (!target) return;
    setActive(Number(target.dataset.index));
  });

  container.addEventListener("click", (event) => {
    const target = event.target.closest("[data-index]");
    if (!target) return;
    setActive(Number(target.dataset.index));
  });
}

renderTimeline();
initStorytelling();
initSignalLab();
renderTrackButtons();
renderRadar(0);
