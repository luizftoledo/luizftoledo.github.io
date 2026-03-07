const CATEGORY_ORDER = [
  "reportagem_autoral",
  "eco_republicacao",
  "mencao",
  "entrevista",
  "palestra_curso",
  "perfil_bio",
];

const CATEGORY_LABELS = {
  reportagem_autoral: "Reportagens publicadas por mim",
  eco_republicacao: "Republicações / ecos",
  mencao: "Menções ao meu nome",
  entrevista: "Entrevistas / podcasts",
  palestra_curso: "Palestras / cursos",
  perfil_bio: "Perfis / bios",
};

const WINDOW_OPTIONS = {
  all: null,
  1: 1,
  7: 7,
  30: 30,
  365: 365,
};

const state = {
  items: [],
  metadata: null,
  search: "",
  category: "all",
  window: "all",
};

const refs = {
  heroMeta: document.getElementById("heroMeta"),
  headlineStack: document.getElementById("headlineStack"),
  summaryGrid: document.getElementById("summaryGrid"),
  statusLine: document.getElementById("statusLine"),
  categoryFilters: document.getElementById("categoryFilters"),
  narrativeList: document.getElementById("narrativeList"),
  categoryBars: document.getElementById("categoryBars"),
  timelineBars: document.getElementById("timelineBars"),
  domainList: document.getElementById("domainList"),
  recentGrid: document.getElementById("recentGrid"),
  resultList: document.getElementById("resultList"),
  resultTable: document.getElementById("resultTable"),
  resultCountNote: document.getElementById("resultCountNote"),
  methodologyBox: document.getElementById("methodologyBox"),
  searchInput: document.getElementById("searchInput"),
  windowSelect: document.getElementById("windowSelect"),
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function foldText(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function formatDate(value) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return dateFormatter.format(parsed);
}

function formatDateTime(value) {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--";
  return dateTimeFormatter.format(parsed);
}

function getReferenceDate(item) {
  return item.published_at || item.first_seen_at || item.last_seen_at || null;
}

function daysAgo(item) {
  const raw = getReferenceDate(item);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = Date.now() - parsed.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function excerptFor(item) {
  const source = cleanText(item.text_excerpt || item.description || "");
  if (!source) return "Sem trecho disponível.";
  return source.length > 280 ? `${source.slice(0, 277)}...` : source;
}

function compareByDate(a, b) {
  const first = new Date(getReferenceDate(a) || 0).getTime();
  const second = new Date(getReferenceDate(b) || 0).getTime();
  return second - first;
}

function matchesSearch(item, search) {
  if (!search) return true;
  const haystack = foldText([
    item.title,
    item.description,
    item.domain,
    item.site_name,
    item.category_label,
    item.relation,
    item.text_excerpt,
  ].join(" "));
  return haystack.includes(foldText(search));
}

function matchesWindow(item, windowKey) {
  const limit = WINDOW_OPTIONS[windowKey];
  if (!limit) return true;
  const age = daysAgo(item);
  if (age === null) return false;
  return age <= limit;
}

function getFilteredItems() {
  return state.items
    .filter((item) => state.category === "all" || item.category === state.category)
    .filter((item) => matchesWindow(item, state.window))
    .filter((item) => matchesSearch(item, state.search))
    .sort(compareByDate);
}

function countByCategory(items) {
  const counts = Object.fromEntries(CATEGORY_ORDER.map((key) => [key, 0]));
  items.forEach((item) => {
    counts[item.category] = (counts[item.category] || 0) + 1;
  });
  return counts;
}

function countByYear(items) {
  const counts = new Map();
  items.forEach((item) => {
    const raw = getReferenceDate(item);
    if (!raw) return;
    const year = new Date(raw).getUTCFullYear();
    if (!year || Number.isNaN(year)) return;
    counts.set(year, (counts.get(year) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[0] - a[0]);
}

function countByDomain(items) {
  const counts = new Map();
  items.forEach((item) => {
    const domain = item.domain || "desconhecido";
    counts.set(domain, (counts.get(domain) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function topItems(items, limit = 3) {
  return [...items].sort(compareByDate).slice(0, limit);
}

function topPublishedItems(items, limit = 3) {
  return [...items]
    .filter((item) => item.published_at)
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, limit);
}

function categoryLead(counts) {
  const ordered = CATEGORY_ORDER.map((key) => ({ key, count: counts[key] || 0 }));
  ordered.sort((a, b) => b.count - a.count);
  return ordered[0] || { key: "reportagem_autoral", count: 0 };
}

function renderHero(filteredItems) {
  const meta = state.metadata;
  refs.heroMeta.innerHTML = `
    <span class="hero-pill"><strong>Foco:</strong> lista de menções e contexto</span>
    <span class="hero-pill"><strong>Filtros:</strong> termo, categoria e período</span>
    <span class="hero-pill"><strong>Atualizado:</strong> ${formatDateTime(meta?.generated_at)}</span>
  `;

  const latest = topPublishedItems(filteredItems.length ? filteredItems : state.items, 3);
  if (!latest.length) {
    refs.headlineStack.innerHTML = `
      <div class="empty-state">Sem itens com data publicada neste recorte.</div>
    `;
    return;
  }

  refs.headlineStack.innerHTML = latest.map((item) => `
    <article class="headline-item">
      <span class="headline-kicker">${CATEGORY_LABELS[item.category] || item.category_label}</span>
      <a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a>
      <p>${formatDate(item.published_at)} · ${item.domain || item.site_name || "fonte"}</p>
    </article>
  `).join("");
}

function renderSummary(filteredItems) {
  const total = filteredItems.length;
  const counts = countByCategory(filteredItems);
  const authored = counts.reportagem_autoral || 0;
  const lead = categoryLead(counts);
  const last7 = filteredItems.filter((item) => matchesWindow(item, "7")).length;
  const last30 = filteredItems.filter((item) => matchesWindow(item, "30")).length;

  const cards = [
    {
      label: "Itens no recorte",
      value: total,
      detail: state.window === "all" ? "Todo o acervo filtrado." : `Recorte temporal ativo: ${refs.windowSelect.selectedOptions[0].text}.`,
    },
    {
      label: "Produção autoral",
      value: authored,
      detail: total ? `${Math.round((authored / total) * 100)}% do recorte atual.` : "Sem itens no recorte.",
    },
    {
      label: "Categoria dominante",
      value: CATEGORY_LABELS[lead.key] || "Sem dados",
      detail: `${lead.count} ocorrência(s) no recorte atual.`,
    },
    {
      label: "Últimos 7 dias",
      value: last7,
      detail: "Itens com data ou aparição recente na última semana.",
    },
    {
      label: "Últimos 30 dias",
      value: last30,
      detail: "Itens com data ou aparição recente no último mês.",
    },
  ];

  refs.summaryGrid.innerHTML = cards.map((card) => `
    <article class="hero-card metric-card">
      <span class="metric-label">${card.label}</span>
      <span class="metric-value">${card.value}</span>
      <p class="metric-detail">${card.detail}</p>
    </article>
  `).join("");
}

function renderStatus() {
  refs.statusLine.innerHTML = `
    <span class="status-chip">A lista abaixo é o foco principal da página</span>
    <span class="status-chip alt">Use a busca para achar um veículo, tema ou contexto específico</span>
    <span class="status-chip">Use os filtros para ver só entrevistas, perfis, ecos ou reportagens</span>
  `;
}

function renderCategoryFilters() {
  const options = [{ key: "all", label: "Todas" }, ...CATEGORY_ORDER.map((key) => ({ key, label: CATEGORY_LABELS[key] }))];
  refs.categoryFilters.innerHTML = options.map((option) => `
    <button class="filter-pill ${state.category === option.key ? "is-active" : ""}" data-category="${option.key}">${option.label}</button>
  `).join("");

  refs.categoryFilters.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      render();
    });
  });
}

function renderNarrative(filteredItems) {
  const counts = countByCategory(filteredItems);
  const lead = categoryLead(counts);
  const last30Items = filteredItems.filter((item) => matchesWindow(item, "30"));
  const last30Lead = categoryLead(countByCategory(last30Items));
  const topDomain = countByDomain(filteredItems)[0];

  const narrative = [
    {
      title: "Núcleo principal do acervo",
      text: filteredItems.length
        ? `${CATEGORY_LABELS[lead.key]} lidera o recorte com ${lead.count} item(ns). Isso indica onde o seu rastro público está mais consolidado hoje.`
        : "Nenhum item encontrado com esse filtro. Ajuste busca, janela temporal ou categoria.",
    },
    {
      title: "O que mexeu mais recentemente",
      text: last30Items.length
        ? `Nos últimos 30 dias, o acervo somou ${last30Items.length} item(ns). A frente recente está em ${CATEGORY_LABELS[last30Lead.key].toLowerCase()} com ${last30Lead.count} ocorrência(s).`
        : "Não houve itens no último mês dentro do recorte atual.",
    },
    {
      title: "Ambiente de circulação",
      text: topDomain
        ? `O domínio mais recorrente do recorte é ${topDomain[0]}, com ${topDomain[1]} item(ns). Isso ajuda a separar produção própria, páginas institucionais e citações de terceiros.`
        : "Sem domínio dominante identificável neste recorte.",
    },
  ];

  refs.narrativeList.innerHTML = narrative.map((entry) => `
    <article class="narrative-item">
      <strong>${entry.title}</strong>
      <p>${entry.text}</p>
    </article>
  `).join("");
}

function renderBars(container, entries, total, alt = false) {
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">Sem dados suficientes neste recorte.</div>';
    return;
  }
  container.innerHTML = entries.map(([label, value]) => {
    const width = total ? Math.max(6, Math.round((value / total) * 100)) : 0;
    return `
      <div class="mini-bar">
        <div class="mini-bar-head"><span>${label}</span><strong>${value}</strong></div>
        <div class="mini-bar-track"><div class="mini-bar-fill ${alt ? "alt" : ""}" style="width:${width}%"></div></div>
      </div>
    `;
  }).join("");
}

function renderAnalysis(filteredItems) {
  const counts = countByCategory(filteredItems);
  const categoryEntries = CATEGORY_ORDER
    .map((key) => [CATEGORY_LABELS[key], counts[key] || 0])
    .filter(([, value]) => value > 0);
  renderBars(refs.categoryBars, categoryEntries, filteredItems.length || 1);

  const timelineEntries = countByYear(filteredItems).map(([year, count]) => [String(year), count]);
  renderBars(refs.timelineBars, timelineEntries, timelineEntries[0]?.[1] || 1, true);

  const domains = countByDomain(filteredItems);
  if (!domains.length) {
    refs.domainList.innerHTML = '<div class="empty-state">Sem domínios no recorte atual.</div>';
  } else {
    refs.domainList.innerHTML = domains.map(([domain, count]) => `
      <article class="source-item">
        <div class="meta-line"><span class="tag">${count} item(ns)</span></div>
        <strong>${domain}</strong>
        <p>${count} ocorrência(s) no recorte atual.</p>
      </article>
    `).join("");
  }
}

function windowItems(days) {
  return state.items.filter((item) => matchesWindow(item, String(days))).sort(compareByDate);
}

function renderRecentWindows() {
  const windows = [
    { key: 1, title: "Último dia", deck: "Tudo que entrou ou foi datado nas últimas 24h." },
    { key: 7, title: "Últimos 7 dias", deck: "Recorte para leituras semanais do seu clipping." },
    { key: 30, title: "Últimos 30 dias", deck: "Janela útil para acompanhar tendência e recorrência." },
  ];

  refs.recentGrid.innerHTML = windows.map((window) => {
    const items = topItems(windowItems(window.key), 5);
    const body = items.length ? items.map((item) => `
      <article class="recent-item">
        <div class="meta-line">
          <span class="tag">${CATEGORY_LABELS[item.category] || item.category_label}</span>
          <span>${formatDate(getReferenceDate(item))}</span>
        </div>
        <h3><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a></h3>
        <p>${excerptFor(item)}</p>
      </article>
    `).join("") : '<div class="empty-state">Nenhum item nesta janela.</div>';

    return `
      <section class="panel">
        <h2 class="recent-window-title">${window.title}</h2>
        <span class="count-badge">${windowItems(window.key).length} item(ns)</span>
        <p class="section-deck">${window.deck}</p>
        <div class="recent-list">${body}</div>
      </section>
    `;
  }).join("");
}

function renderResults(filteredItems) {
  if (!filteredItems.length) {
    refs.resultList.innerHTML = '<div class="empty-state">Nenhum item encontrado com esse filtro.</div>';
    refs.resultTable.innerHTML = "";
    refs.resultCountNote.textContent = "0 item encontrado no recorte atual.";
    return;
  }

  refs.resultList.innerHTML = filteredItems.map((item) => `
    <article class="result-item">
      <div class="result-meta">
        <span class="tag">${CATEGORY_LABELS[item.category] || item.category_label}</span>
        <span class="tag alt">${item.relation || "contexto não classificado"}</span>
        <span>${formatDate(getReferenceDate(item))}</span>
        <span>${item.domain || item.site_name || "fonte"}</span>
      </div>
      <h3><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a></h3>
      <p>${excerptFor(item)}</p>
    </article>
  `).join("");

  refs.resultTable.innerHTML = filteredItems.map((item) => `
    <tr>
      <td>${formatDate(getReferenceDate(item))}</td>
      <td>${CATEGORY_LABELS[item.category] || item.category_label}</td>
      <td>${item.relation || "-"}</td>
      <td><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a></td>
      <td>${item.domain || item.site_name || "-"}</td>
    </tr>
  `).join("");

  refs.resultCountNote.textContent = `${filteredItems.length} item(ns) no recorte atual.`;
}

function renderMethodology() {
  const meta = state.metadata || {};
  const discovery = meta.sources?.discovery || {};
  const searches = discovery.searches || {};
  const enrich = meta.sources?.enrich || {};
  const searchLines = Object.entries(searches)
    .map(([label, count]) => `<li><strong>${label.replace(/\"/g, "")}</strong>: ${count} link(s) brutos.</li>`)
    .join("");

  refs.methodologyBox.innerHTML = `
    <p>
      <strong>Nomes monitorados:</strong> ${(meta.methodology?.names || []).join("; ") || "--"}.
      O clipping combina sementes curadas do seu portfólio/resume com descoberta automatizada em notícias indexadas e páginas institucionais.
    </p>
    <p>
      <strong>Como a classificação funciona:</strong> o script cruza byline, tipo de página, palavras-chave e contexto institucional para separar produção autoral, entrevistas, perfis, ecos de apuração e outras aparições.
    </p>
    <p>
      <strong>Filtro contra ruído:</strong> ${enrich.dropped || 0} candidato(s) foram descartados no último processamento por parecerem homônimos, páginas genéricas ou ruído de busca.
    </p>
    <ul>${searchLines || "<li>Sem buscas externas registradas nesta execução.</li>"}</ul>
    <p>
      <strong>Limite metodológico:</strong> esta base é ampla, mas não exaustiva. A cobertura é mais forte em produção autoral, notícias indexadas e páginas institucionais. Menções dispersas fora desse circuito podem escapar, e alguns sites bloqueiam raspagem direta.
    </p>
  `;
}

function render() {
  const filteredItems = getFilteredItems();
  renderHero(filteredItems);
  renderSummary(filteredItems);
  renderStatus();
  renderCategoryFilters();
  renderNarrative(filteredItems);
  renderAnalysis(filteredItems);
  renderRecentWindows();
  renderResults(filteredItems);
  renderMethodology();
}

async function loadData() {
  const [itemsResponse, metadataResponse] = await Promise.all([
    fetch("./data/items.json", { cache: "no-store" }),
    fetch("./data/metadata.json", { cache: "no-store" }),
  ]);
  if (!itemsResponse.ok || !metadataResponse.ok) {
    throw new Error("Falha ao carregar os dados do clipping.");
  }
  state.items = await itemsResponse.json();
  state.metadata = await metadataResponse.json();
}

function bindControls() {
  refs.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value || "";
    render();
  });

  refs.windowSelect.addEventListener("change", (event) => {
    state.window = event.target.value;
    render();
  });
}

async function init() {
  bindControls();
  try {
    await loadData();
    render();
  } catch (error) {
    refs.summaryGrid.innerHTML = '<article class="panel empty-state">Não foi possível carregar a base do clipping agora.</article>';
    refs.resultList.innerHTML = `<div class="empty-state">${error.message}</div>`;
  }
}

init();
