/* =========================================================================
   Planos de Governo 2024 – Dashboard
   =========================================================================
   Todos os dados vêm de JSONs em ./data/ gerados pelo script Python.
   Estratégia de carregamento:
     • metadata.json  → sempre carregado (lista leve de todos os candidatos)
     • report.json    → estatísticas gerais (carregado na inicialização)
     • themes.json    → índice de temas (carregado na inicialização)
     • themes/{slug}  → lazy: só quando o usuário clica no tema
     • states/{UF}    → lazy: só quando o usuário filtra por UF
     • candidates/{id}→ lazy: só para comparação ou detalhe
     • parties.json   → lazy: quando abre a aba partidos
     • plagiarism.json→ lazy: quando abre a aba plágio
   ========================================================================= */

"use strict";

(function () {

/* ── constantes ──────────────────────────────────────────────────────────── */

const DATA  = "./data";
const STATES = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA",
  "MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN",
  "RO","RR","RS","SC","SE","SP","TO",
];
const PAGE_SIZE = 20;

/* ── estado global ───────────────────────────────────────────────────────── */

const S = {
  metadata:   null,   // array de todos os candidatos (sem texto)
  report:     null,
  themes:     null,   // índice [{name,slug,count}]
  parties:    null,
  plagiarism: null,
  stateCache: {},     // {UF: [candidatos com snippet]}
  themeCache: {},     // {slug: data}
  candCache:  {},     // {id: {text,...}}

  // busca keyword
  kwResults:  [],
  kwPage:     0,

  // tema selecionado
  activeTheme:    null,
  activeThemeAll: [],
  activeThemeFlt: [],
  trPage:         0,

  // plágio
  plagFiltered: [],
  plagPage:     0,

  // VS
  vsA: null,
  vsB: null,

  partyData: null,
};

/* ── utilidades ──────────────────────────────────────────────────────────── */

const nFmt  = new Intl.NumberFormat("pt-BR");
const pFmt  = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function norm(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function esc(s = "") {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function highlight(text = "", kw = "") {
  if (!kw) return esc(text);
  const re = new RegExp("(" + kw.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + ")", "gi");
  return esc(text).replace(re, "<mark>$1</mark>");
}

/** Marca no texto normalizado e extrai o trecho do texto original */
function extractSnippet(text = "", kw = "", len = 300) {
  if (!text) return "";
  const tn  = norm(text);
  const kwn = norm(kw);
  const idx = tn.indexOf(kwn);
  if (idx === -1) return text.slice(0, len);
  const s = Math.max(0, idx - 80);
  const e = Math.min(text.length, idx + kwn.length + 180);
  return (s > 0 ? "…" : "") + text.slice(s, e).trim() + (e < text.length ? "…" : "");
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

function spinner() {
  return `<div class="loading"><div class="spinner"></div> carregando…</div>`;
}

/* ── tabs ────────────────────────────────────────────────────────────────── */

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const id = "tab-" + btn.dataset.tab;
    document.getElementById(id).classList.add("active");

    // lazy loads por aba
    if (btn.dataset.tab === "partidos" && !S.parties) loadParties();
    if (btn.dataset.tab === "plagio"   && !S.plagiarism) loadPlagiarism();
  });
});

/* ── inicialização ───────────────────────────────────────────────────────── */

async function init() {
  try {
    const [meta, report, themes] = await Promise.all([
      fetchJSON(`${DATA}/metadata.json`),
      fetchJSON(`${DATA}/report.json`),
      fetchJSON(`${DATA}/themes.json`),
    ]);
    S.metadata = meta;
    S.report   = report;
    S.themes   = themes;

    renderKPIs();
    renderHeroReport();
    populateFilters();
    renderStateCoverage();
    renderThemeGrid();
    renderThemeBarChart();
    renderPartyBarChart();
    renderMetodologiaTabela();
    setupBuscador();
    setupVS();
    setupPartidosTab();

  } catch (e) {
    console.error(e);
    document.getElementById("hero-report").innerHTML =
      `<div class="alert alert-warn">Dados ainda não gerados. Execute o script Python primeiro.</div>`;
  }
}

/* ── KPIs ────────────────────────────────────────────────────────────────── */

function renderKPIs() {
  const r = S.report;
  setText("kpi-total", nFmt.format(r.total_candidates));
  setText("kpi-with",  nFmt.format(r.with_plan));
  setText("kpi-pct",   pFmt.format(r.pct_with_plan) + "%");
  const scan = r.extraction?.empty_scan || 0;
  setText("kpi-scan",  nFmt.format(scan));
  // plágio vem depois
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderHeroReport() {
  const r = S.report;
  const el = document.getElementById("hero-report");
  const d  = new Date(r.generated_at);
  const fmt = new Intl.DateTimeFormat("pt-BR", {dateStyle:"short",timeStyle:"short"});
  el.innerHTML = `
    <div style="font-size:.8rem;color:var(--muted)">
      <strong style="color:var(--ink)">Atualizado em:</strong><br>
      ${fmt.format(d)}<br><br>
      <strong style="color:var(--ink)">Fonte:</strong><br>
      TSE – Dados Abertos<br>
      candidatos 2024
    </div>`;
}

/* ── popular selects de filtros ──────────────────────────────────────────── */

function populateFilters() {
  const meta = S.metadata;

  // UFs únicas
  const ufs = [...new Set(meta.map(c => c.uf).filter(Boolean))].sort();
  // Partidos únicos
  const parties = [...new Set(meta.map(c => c.partido).filter(Boolean))].sort();

  // Buscador
  fillSelect("kw-uf",    ufs,     true);
  fillSelect("kw-party", parties, true);

  // Tema filter
  fillSelect("tr-uf",    ufs,     true);
  fillSelect("tr-party", parties, true);

  // Plágio
  fillSelect("plag-uf",    ufs,     true);
  fillSelect("plag-party", parties, true);

  // VS tema
  fillThemeSelect("vs-theme");

  // Preencher selects de UF de comparação de estado nas outras abas
  STATES.forEach(uf => {
    ["kw-uf","tr-uf","plag-uf"].forEach(id => {
      // já preenchido acima — noop
    });
  });
}

function fillSelect(id, options, blank = false) {
  const sel = document.getElementById(id);
  if (!sel) return;
  if (blank) sel.innerHTML = `<option value="">Todos</option>`;
  options.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    sel.appendChild(opt);
  });
}

function fillThemeSelect(id) {
  const sel = document.getElementById(id);
  if (!sel || !S.themes) return;
  sel.innerHTML = `<option value="">Texto completo</option>`;
  S.themes.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.slug; opt.textContent = t.name;
    sel.appendChild(opt);
  });
}

/* ── Panorama: cobertura por estado ──────────────────────────────────────── */

function renderStateCoverage() {
  const el = document.getElementById("state-coverage");
  if (!S.report?.by_state) return;
  const rows = Object.entries(S.report.by_state)
    .sort((a, b) => b[1].pct - a[1].pct);

  el.innerHTML = rows.map(([uf, d]) => `
    <div class="prog-row">
      <span>${uf}</span>
      <div class="prog-bar-bg">
        <div class="prog-bar-fill" style="width:${d.pct}%"></div>
      </div>
      <span class="prog-pct">${pFmt.format(d.pct)}%</span>
    </div>`).join("");
}

/* ── Panorama: gráfico temas ──────────────────────────────────────────────── */

function renderThemeBarChart() {
  const ctx = document.getElementById("chart-themes");
  if (!ctx || !S.themes) return;
  const sorted = [...S.themes].sort((a, b) => b.count - a.count).slice(0, 20);
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(t => t.name),
      datasets: [{
        data: sorted.map(t => t.count),
        backgroundColor: "#2660c6cc",
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { size: 11 } } },
        y: { ticks: { font: { size: 11 } } },
      },
    },
  });
}

/* ── Panorama: gráfico partidos ───────────────────────────────────────────── */

function renderPartyBarChart() {
  const ctx = document.getElementById("chart-parties");
  if (!ctx || !S.metadata) return;
  const cnt = {};
  S.metadata.forEach(c => {
    if (!c.has_plan) return;
    cnt[c.partido] = (cnt[c.partido] || 0) + 1;
  });
  const sorted = Object.entries(cnt).sort((a,b) => b[1]-a[1]).slice(0, 25);
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(e => e[0]),
      datasets: [{
        data: sorted.map(e => e[1]),
        backgroundColor: "#c17c3fcc",
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { ticks: { font: { size: 11 } } } },
    },
  });
}

/* ── Buscador: grade de temas ─────────────────────────────────────────────── */

function renderThemeGrid() {
  const el = document.getElementById("theme-grid");
  if (!S.themes) return;
  el.innerHTML = S.themes
    .sort((a,b) => b.count - a.count)
    .map(t => {
      const kws = (t.keywords || []).slice(0, 8).join(", ");
      return `
      <button class="theme-card" data-slug="${esc(t.slug)}" data-name="${esc(t.name)}" title="Palavras-chave: ${esc(kws)}">
        <div class="tc-name">${esc(t.name)}</div>
        <div class="tc-cnt">${nFmt.format(t.count)} candidatos</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:.25rem;line-height:1.3">${esc(kws)}</div>
      </button>`;
    }).join("");

  el.querySelectorAll(".theme-card").forEach(card => {
    card.addEventListener("click", () => {
      el.querySelectorAll(".theme-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      loadTheme(card.dataset.slug, card.dataset.name);
    });
  });
}

async function loadTheme(slug, name) {
  const panel = document.getElementById("theme-results-panel");
  const title = document.getElementById("theme-results-title");
  panel.style.display = "grid";
  title.textContent = `Tema: ${name}`;

  document.getElementById("tr-results").innerHTML = spinner();
  document.getElementById("tr-status").textContent = "";
  document.getElementById("tr-pager").innerHTML = "";

  if (!S.themeCache[slug]) {
    try {
      S.themeCache[slug] = await fetchJSON(`${DATA}/themes/${slug}.json`);
    } catch {
      document.getElementById("tr-results").innerHTML =
        `<div class="no-data">Dados do tema não encontrados.</div>`;
      return;
    }
  }

  S.activeTheme    = slug;
  S.activeThemeAll = S.themeCache[slug].candidates || [];
  S.trPage         = 0;

  // popular filtros de UF/partido com os valores presentes neste tema
  const ths_ufs     = [...new Set(S.activeThemeAll.map(c => c.uf).filter(Boolean))].sort();
  const ths_parties = [...new Set(S.activeThemeAll.map(c => c.partido).filter(Boolean))].sort();
  fillSelect("tr-uf",    ths_ufs,     true);
  fillSelect("tr-party", ths_parties, true);

  applyThemeFilter();
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function applyThemeFilter() {
  const uf     = document.getElementById("tr-uf").value;
  const party  = document.getElementById("tr-party").value;
  const city   = norm(document.getElementById("tr-city").value);
  const cand   = norm((document.getElementById("tr-cand")?.value) || "");

  S.activeThemeFlt = S.activeThemeAll.filter(c =>
    (!uf    || c.uf      === uf) &&
    (!party || c.partido === party) &&
    (!city  || norm(c.municipio || "").includes(city)) &&
    (!cand  || norm(c.nome || "").includes(cand) || norm(c.nome_urna || "").includes(cand))
  );
  S.trPage = 0;
  renderThemeResults();
}

function renderThemeResults() {
  const el   = document.getElementById("tr-results");
  const data = S.activeThemeFlt;
  const page = S.trPage;
  const slice = data.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);

  document.getElementById("tr-status").textContent =
    `${nFmt.format(data.length)} candidatos encontrados`;

  if (!slice.length) {
    el.innerHTML = `<div class="no-data">Nenhum candidato neste filtro.</div>`;
    document.getElementById("tr-pager").innerHTML = "";
    return;
  }

  el.innerHTML = `
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th>Nome</th><th>Partido</th><th>Município</th><th>UF</th><th>Trecho</th>
        </tr></thead>
        <tbody>
          ${slice.map(c => `
            <tr>
              <td>${esc(c.nome)}</td>
              <td><span class="pill">${esc(c.partido)}</span></td>
              <td>${esc(c.municipio)}</td>
              <td>${esc(c.uf)}</td>
              <td><div class="snippet">${esc(c.snippet || "")}</div></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  renderPager("tr-pager", data.length, page, p => { S.trPage = p; renderThemeResults(); });
}

document.getElementById("tr-filter-btn").addEventListener("click", applyThemeFilter);

/* ── Buscador: busca por palavra-chave ───────────────────────────────────── */

function setupBuscador() {
  document.getElementById("kw-search-btn").addEventListener("click", runKwSearch);
  document.getElementById("kw-input").addEventListener("keydown", e => {
    if (e.key === "Enter") runKwSearch();
  });
}

async function runKwSearch() {
  const kw    = document.getElementById("kw-input").value.trim();
  const uf    = document.getElementById("kw-uf").value;
  const party = document.getElementById("kw-party").value;
  const city  = norm(document.getElementById("kw-city").value);

  if (!kw) {
    document.getElementById("kw-status").textContent = "Digite uma palavra-chave.";
    return;
  }

  const kwn = norm(kw);
  document.getElementById("kw-results").innerHTML = spinner();
  document.getElementById("kw-status").textContent = "";
  document.getElementById("kw-pager").innerHTML = "";

  // Se UF selecionado, carregamos dados completos com snippet daquele estado
  let pool;
  if (uf) {
    pool = await loadStateData(uf);
  } else {
    // Busca no metadata (usa snippet curto – comportamento esperado sem filtro de UF)
    pool = S.metadata.map(c => ({
      ...c,
      snippet: c.text_snippet || "",
    }));
  }

  // Filtrar
  const kwRe = new RegExp(kwn, "i");
  S.kwResults = pool.filter(c => {
    if (!c.has_plan) return false;
    if (party && c.partido !== party) return false;
    if (city  && !norm(c.municipio || "").includes(city)) return false;
    // Busca no snippet/texto disponível
    const haystack = norm(c.snippet || "") + " " + norm(c.nome || "");
    return haystack.includes(kwn);
  });

  S.kwPage = 0;
  renderKwResults(kw);
}

function renderKwResults(kw = "") {
  const el   = document.getElementById("kw-results");
  const data = S.kwResults;
  const page = S.kwPage;
  const slice = data.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);

  document.getElementById("kw-status").textContent =
    `${nFmt.format(data.length)} candidatos encontrados`;

  if (!slice.length) {
    el.innerHTML = `<div class="no-data">Nenhum resultado para esta busca.</div>`;
    document.getElementById("kw-pager").innerHTML = "";
    return;
  }

  el.innerHTML = `
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th>Nome</th><th>Partido</th><th>Município</th><th>UF</th><th>Trecho</th>
        </tr></thead>
        <tbody>
          ${slice.map(c => {
            const snip = extractSnippet(c.snippet || "", kw);
            return `<tr>
              <td>${esc(c.nome_urna || c.nome)}</td>
              <td><span class="pill">${esc(c.partido)}</span></td>
              <td>${esc(c.municipio)}</td>
              <td>${esc(c.uf)}</td>
              <td><div class="snippet">${highlight(snip, kw)}</div></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;

  renderPager("kw-pager", data.length, page, p => { S.kwPage = p; renderKwResults(kw); });
}

/* ── loader de estado ────────────────────────────────────────────────────── */

async function loadStateData(uf) {
  if (!S.stateCache[uf]) {
    try {
      S.stateCache[uf] = await fetchJSON(`${DATA}/states/${uf}.json`);
    } catch {
      S.stateCache[uf] = [];
    }
  }
  return S.stateCache[uf];
}

async function loadCandidateText(id) {
  if (!S.candCache[id]) {
    try {
      S.candCache[id] = await fetchJSON(`${DATA}/candidates/${id}.json`);
    } catch {
      S.candCache[id] = null;
    }
  }
  return S.candCache[id];
}

/* ── Partidos ─────────────────────────────────────────────────────────────── */

async function loadParties() {
  try {
    S.parties = await fetchJSON(`${DATA}/parties.json`);
    S.partyData = S.parties;
    populatePartySelects();
  } catch (e) {
    document.getElementById("party-results").innerHTML =
      `<div class="no-data">Dados de partidos não encontrados.</div>`;
  }
}

function setupPartidosTab() {
  document.getElementById("party-compare-btn").addEventListener("click", runPartyCompare);
}

function populatePartySelects() {
  if (!S.parties) return;
  const parties = Object.keys(S.parties).sort();
  ["party-a","party-b"].forEach(id => {
    const sel = document.getElementById(id);
    const blank = id === "party-b" ? `<option value="">— nenhum —</option>` : `<option value="">selecione…</option>`;
    sel.innerHTML = blank;
    parties.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p; opt.textContent = p + ` (${nFmt.format(S.parties[p].total)})`;
      sel.appendChild(opt);
    });
  });

  // Preencher select de temas
  const tsel = document.getElementById("party-theme");
  tsel.innerHTML = `<option value="">selecione…</option>`;
  if (S.themes) {
    S.themes.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.slug; opt.textContent = t.name;
      tsel.appendChild(opt);
    });
  }
}

function runPartyCompare() {
  if (!S.parties) {
    document.getElementById("party-results").innerHTML =
      `<div class="alert alert-warn">Clique na aba "Por partido" para carregar os dados.</div>`;
    return;
  }
  const pA    = document.getElementById("party-a").value;
  const pB    = document.getElementById("party-b").value;
  const theme = document.getElementById("party-theme").value;

  if (!pA) {
    document.getElementById("party-results").innerHTML =
      `<div class="alert alert-warn">Selecione ao menos o Partido A.</div>`;
    return;
  }

  const el = document.getElementById("party-results");
  const cols = [pA, pB].filter(Boolean).map(p => renderPartyCol(p, theme));

  el.innerHTML = `<div class="party-compare-grid">${cols.join("")}</div>`;
}

function renderPartyCol(party, themeSlug) {
  const d = S.parties[party];
  if (!d) return `<div class="compare-col"><div class="no-data">Partido não encontrado.</div></div>`;

  // Ordenar temas por contagem
  const themesSorted = Object.entries(d.themes || {}).sort((a,b) => b[1]-a[1]);

  let themeHighlight = "";
  if (themeSlug && S.themeCache[themeSlug]) {
    // Candidatos deste partido que mencionam o tema
    const tname = (S.themes || []).find(t => t.slug === themeSlug)?.name || themeSlug;
    const cands = (S.themeCache[themeSlug].candidates || [])
      .filter(c => c.partido === party).slice(0, 6);
    themeHighlight = `
      <div class="theme-section">
        <div class="theme-section-title">Tema: ${esc(tname)}</div>
        ${cands.length
          ? cands.map(c => `
              <div style="font-size:.82rem;margin-bottom:.4rem">
                <strong>${esc(c.nome)}</strong> – ${esc(c.municipio)}/${esc(c.uf)}<br>
                <span class="snippet">${esc(c.snippet || "").slice(0,200)}</span>
              </div>`).join("")
          : `<span class="snippet">Nenhum candidato deste partido menciona o tema selecionado.</span>`
        }
      </div>`;
  }

  return `
    <div class="compare-col">
      <div class="compare-header">${esc(party)}</div>
      <div style="font-size:.82rem;color:var(--muted);margin-bottom:.7rem">
        ${nFmt.format(d.total)} candidatos ·
        ${nFmt.format(d.with_plan)} com plano (${pFmt.format(d.pct_plan)}%)
      </div>
      ${themeHighlight}
      <div class="panel-sub" style="margin-bottom:.4rem">Temas mais citados:</div>
      <div class="party-theme-list">
        ${themesSorted.slice(0,15).map(([th, cnt]) => `
          <div class="ptl-row">
            <span>${esc(th)}</span>
            <span class="ptl-cnt">${nFmt.format(cnt)}</span>
          </div>`).join("")}
      </div>
      <div class="panel-sub" style="margin-top:.7rem;margin-bottom:.4rem">Exemplos de candidatos:</div>
      ${(d.cands_sample || []).slice(0,5).map(c =>
        `<div style="font-size:.82rem;margin-bottom:.3rem">
          ${esc(c.nome)} – ${esc(c.municipio)}/${esc(c.uf)}
         </div>`).join("")}
    </div>`;
}

/* ── VS: candidato vs candidato ──────────────────────────────────────────── */

function setupVS() {
  setupVSInput("a");
  setupVSInput("b");
  document.getElementById("vs-compare-btn").addEventListener("click", runVS);
  fillThemeSelect("vs-theme");

  // scroll sincronizado por proporção
  const elA = document.getElementById("vs-a-text");
  const elB = document.getElementById("vs-b-text");
  let syncing = false;
  function syncScroll(src, dst) {
    src.addEventListener("scroll", () => {
      if (syncing) return;
      syncing = true;
      const pct = src.scrollTop / (src.scrollHeight - src.clientHeight || 1);
      dst.scrollTop = pct * (dst.scrollHeight - dst.clientHeight);
      syncing = false;
    });
  }
  syncScroll(elA, elB);
  syncScroll(elB, elA);

  // salto por seleção: selecionar texto num lado → o outro rola até a mesma passagem
  function onSelectJump(src, dst) {
    src.addEventListener("mouseup", () => {
      const sel = window.getSelection().toString().trim();
      if (sel.length < 3) return;
      jumpToText(dst, sel);
    });
  }
  onSelectJump(elA, elB);
  onSelectJump(elB, elA);

  // comparar por cidade
  fillSelect("city-uf", STATES, true);
  fillThemeSelect("city-theme");
  document.getElementById("city-compare-btn").addEventListener("click", runCityCompare);
  document.getElementById("city-input").addEventListener("keydown", e => {
    if (e.key === "Enter") runCityCompare();
  });
}

function setupVSInput(side) {
  const input  = document.getElementById(`vs-${side}-input`);
  const list   = document.getElementById(`vs-${side}-list`);
  const chosen = document.getElementById(`vs-${side}-chosen`);

  input.addEventListener("input", () => {
    const q = norm(input.value.trim());
    if (q.length < 2) { list.innerHTML = ""; return; }

    const matches = (S.metadata || [])
      .filter(c => c.has_plan && (norm(c.nome).includes(q) || norm(c.nome_urna||"").includes(q) || norm(c.municipio||"").includes(q)))
      .slice(0, 8);

    list.innerHTML = matches.map(c => `
      <button class="theme-card" style="width:100%;margin-bottom:.3rem"
        data-id="${esc(c.id)}"
        data-nome="${esc(c.nome_urna||c.nome)}"
        data-partido="${esc(c.partido)}"
        data-municipio="${esc(c.municipio)}"
        data-uf="${esc(c.uf)}">
        <div class="tc-name">${esc(c.nome_urna||c.nome)}</div>
        <div class="tc-cnt">${esc(c.partido)} · ${esc(c.municipio)}/${esc(c.uf)}</div>
      </button>`).join("");

    list.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        S[`vs${side.toUpperCase()}`] = btn.dataset;
        chosen.style.display = "inline-block";
        chosen.textContent   = `✓ ${btn.dataset.nome} (${btn.dataset.municipio}/${btn.dataset.uf})`;
        list.innerHTML = "";
        input.value = "";
      });
    });
  });
}

async function runVS() {
  const vsEl = document.getElementById("vs-results");
  const cA   = S.vsA;
  const cB   = S.vsB;

  if (!cA || !cB) {
    alert("Selecione os dois candidatos.");
    return;
  }

  vsEl.style.display = "none";
  document.getElementById("vs-hint").style.display = "none";
  document.getElementById("vs-a-header").textContent = `${cA.nome} (${cA.municipio}/${cA.uf})`;
  document.getElementById("vs-b-header").textContent = `${cB.nome} (${cB.municipio}/${cB.uf})`;
  document.getElementById("vs-a-text").textContent = "carregando…";
  document.getElementById("vs-b-text").textContent = "carregando…";
  vsEl.style.display = "grid";

  const [dataA, dataB] = await Promise.all([
    loadCandidateText(cA.id),
    loadCandidateText(cB.id),
  ]);

  const themeSlug = document.getElementById("vs-theme").value;

  document.getElementById("vs-hint").style.display = "block";

  if (themeSlug && S.themes) {
    // Mostrar só trechos do tema selecionado
    if (!S.themeCache[themeSlug]) {
      const slug = themeSlug;
      try { S.themeCache[slug] = await fetchJSON(`${DATA}/themes/${slug}.json`); } catch {}
    }
    const tname = S.themes.find(t => t.slug === themeSlug)?.name || themeSlug;
    const keywords = S.themeCache[themeSlug]?.keywords || [];

    document.getElementById("vs-a-text").textContent =
      extractThemeText(dataA?.text || "", keywords) || "(Sem menção a este tema)";
    document.getElementById("vs-b-text").textContent =
      extractThemeText(dataB?.text || "", keywords) || "(Sem menção a este tema)";
  } else {
    document.getElementById("vs-a-text").textContent = dataA?.text || "(Sem plano disponível)";
    document.getElementById("vs-b-text").textContent = dataB?.text || "(Sem plano disponível)";
  }
}

async function runCityCompare() {
  const cityQ  = norm(document.getElementById("city-input").value.trim());
  const uf     = document.getElementById("city-uf").value;
  const slug   = document.getElementById("city-theme").value;
  const status = document.getElementById("city-status");
  const resEl  = document.getElementById("city-results");

  if (!cityQ) { status.textContent = "Digite o nome de uma cidade."; return; }

  status.textContent = "buscando candidatos…";
  resEl.innerHTML = spinner();

  // encontrar candidatos na metadata
  let pool = (S.metadata || []).filter(c =>
    c.has_plan &&
    norm(c.municipio || "").includes(cityQ) &&
    (!uf || c.uf === uf)
  );

  if (!pool.length) {
    status.textContent = "Nenhum candidato com plano encontrado nesta cidade.";
    resEl.innerHTML = "";
    return;
  }

  status.textContent = `${pool.length} candidato(s) encontrado(s) — carregando planos…`;

  // carregar textos em paralelo (máx 20)
  const slice = pool.slice(0, 20);
  const texts = await Promise.all(slice.map(c => loadCandidateText(c.id)));

  let keywords = [];
  let themeName = "";
  if (slug) {
    if (!S.themeCache[slug]) {
      try { S.themeCache[slug] = await fetchJSON(`${DATA}/themes/${slug}.json`); } catch {}
    }
    keywords  = S.themeCache[slug]?.keywords || [];
    themeName = (S.themes || []).find(t => t.slug === slug)?.name || slug;
  }

  status.textContent = `${slice.length} candidato(s)${pool.length > 20 ? " (exibindo primeiros 20)" : ""}${themeName ? " · tema: " + themeName : ""}`;

  resEl.innerHTML = `<div class="city-grid">${slice.map((c, i) => {
    const d = texts[i];
    const raw = d?.text || "";
    const display = slug
      ? (extractThemeText(raw, keywords) || "(Sem menção a este tema)")
      : (raw || "(Texto não disponível)");
    return `
      <div class="city-card">
        <div class="city-card-header">${esc(c.nome_urna || c.nome)}</div>
        <div class="city-card-meta">${esc(c.partido)} · ${esc(c.municipio)}/${esc(c.uf)}</div>
        <div class="city-card-text">${esc(display)}</div>
      </div>`;
  }).join("")}</div>`;
}

function jumpToText(container, query) {
  if (!query || query.length < 3) return;

  // remover highlights anteriores
  container.querySelectorAll(".sync-hl").forEach(el => {
    el.replaceWith(document.createTextNode(el.textContent));
  });
  container.normalize(); // reunir text nodes fragmentados

  // coletar todos os text nodes e concatenar
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node, acc = "", nodeMap = [];
  while ((node = walker.nextNode())) {
    nodeMap.push({ node, start: acc.length });
    acc += node.textContent;
  }

  const idx = norm(acc).indexOf(norm(query));
  if (idx === -1) return;

  // encontrar o text node que contém o início da ocorrência
  for (const { node: n, start } of nodeMap) {
    const end = start + n.textContent.length;
    if (idx >= start && idx < end) {
      const localIdx = idx - start;
      const localEnd = Math.min(localIdx + query.length, n.textContent.length);
      try {
        const range = document.createRange();
        range.setStart(n, localIdx);
        range.setEnd(n, localEnd);
        const hl = document.createElement("mark");
        hl.className = "sync-hl";
        range.surroundContents(hl);
        // rolar o container até o highlight
        const cRect = container.getBoundingClientRect();
        const hRect = hl.getBoundingClientRect();
        container.scrollTop += hRect.top - cRect.top - 60;
        // remover highlight após animação
        setTimeout(() => {
          if (hl.parentNode) hl.replaceWith(document.createTextNode(hl.textContent));
        }, 2500);
      } catch { /* ignora se range cruzar elementos */ }
      break;
    }
  }
}

function extractThemeText(text, keywords) {
  if (!text) return "";
  const tn = norm(text);
  const chunks = [];
  for (const kw of keywords) {
    const kwn = norm(kw);
    let idx = 0;
    while (true) {
      const pos = tn.indexOf(kwn, idx);
      if (pos === -1) break;
      const s = Math.max(0, pos - 60);
      const e = Math.min(text.length, pos + kwn.length + 200);
      chunks.push("…" + text.slice(s, e).trim() + "…");
      idx = pos + 1;
      if (chunks.length >= 5) break;
    }
    if (chunks.length >= 5) break;
  }
  return chunks.join("\n\n") || "";
}

/* ── Plágio ───────────────────────────────────────────────────────────────── */

async function loadPlagiarism() {
  document.getElementById("plag-list").innerHTML = spinner();
  try {
    S.plagiarism = await fetchJSON(`${DATA}/plagiarism.json`);
    renderPlagiarism();
    setupPlagFilter();
  } catch (e) {
    document.getElementById("plag-list").innerHTML =
      `<div class="no-data">Dados de plágio não encontrados. Execute o script Python primeiro.</div>`;
  }
}

function renderPlagiarism() {
  const p = S.plagiarism;
  if (!p) return;

  // KPIs de plágio
  document.getElementById("kpi-plag").textContent = pFmt.format(p.pct_with_copies) + "%";
  document.getElementById("plag-kpis").innerHTML = `
    <div class="kpi">
      <div class="kpi-val accent">${nFmt.format(p.total_analyzed)}</div>
      <div class="kpi-lbl">planos analisados</div>
    </div>
    <div class="kpi">
      <div class="kpi-val warn">${nFmt.format(p.candidates_with_copies)}</div>
      <div class="kpi-lbl">candidatos com trechos copiados</div>
    </div>
    <div class="kpi">
      <div class="kpi-val warn">${pFmt.format(p.pct_with_copies)}%</div>
      <div class="kpi-lbl">do total com plano</div>
    </div>
    <div class="kpi">
      <div class="kpi-val">${nFmt.format(p.unique_shared_phrases)}</div>
      <div class="kpi-lbl">trechos únicos copiados</div>
    </div>`;

  S.plagFiltered = p.top_phrases || [];
  S.plagPage = 0;
  renderPlagList();
  renderPlagCandTable();
}

function setupPlagFilter() {
  document.getElementById("plag-filter-btn").addEventListener("click", applyPlagFilter);
}

function applyPlagFilter() {
  const uf      = document.getElementById("plag-uf").value;
  const party   = document.getElementById("plag-party").value;
  const minVal  = parseInt(document.getElementById("plag-min").value) || 3;

  if (!S.plagiarism) return;

  S.plagFiltered = (S.plagiarism.top_phrases || []).filter(ph => {
    if (ph.count < minVal) return false;
    if (!uf && !party) return true;
    // verificar se algum exemplo bate com os filtros
    return (ph.examples || []).some(ex =>
      (!uf    || ex.uf      === uf) &&
      (!party || ex.partido === party)
    );
  });

  S.plagPage = 0;
  renderPlagList();
}

function renderPlagList() {
  const el    = document.getElementById("plag-list");
  const data  = S.plagFiltered;
  const page  = S.plagPage;
  const slice = data.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);

  if (!slice.length) {
    el.innerHTML = `<div class="no-data">Nenhum trecho encontrado com estes filtros.</div>`;
    document.getElementById("plag-pager").innerHTML = "";
    return;
  }

  el.innerHTML = slice.map((ph, i) => `
    <div class="plag-phrase">
      <div class="plag-phrase-text">"${esc(ph.phrase)}"</div>
      <span class="plag-cnt">
        Copiado por ${nFmt.format(ph.count)} candidatos
      </span>
      <div class="plag-examples">
        ${(ph.examples || []).slice(0,4).map(ex => `
          <div class="plag-ex">
            <strong>${esc(ex.nome)} · ${esc(ex.partido)} · ${esc(ex.municipio)}/${esc(ex.uf)}</strong>
            "…${esc(ex.context || "").slice(0,250)}…"
          </div>`).join("")}
        ${ph.count > 4
          ? `<div style="font-size:.78rem;color:var(--muted)">
               + ${nFmt.format(ph.count - 4)} outros candidatos
             </div>` : ""}
      </div>
    </div>`).join("");

  renderPager("plag-pager", data.length, page, p => { S.plagPage = p; renderPlagList(); });
}

function renderPlagCandTable() {
  const el = document.getElementById("plag-cands-table");
  if (!S.plagiarism) return;

  // Contar cópias por candidato usando o array `cands` enriquecido
  const countMap = {};   // sq → { cnt, nome, partido, municipio, uf }
  (S.plagiarism.top_phrases || []).forEach(ph => {
    (ph.cands || []).forEach(c => {
      if (!countMap[c.sq]) {
        countMap[c.sq] = { sq: c.sq, cnt: 0, nome: c.nome, partido: c.partido, municipio: c.municipio, uf: c.uf };
      }
      countMap[c.sq].cnt += 1;
    });
  });

  const rows = Object.values(countMap)
    .sort((a, b) => b.cnt - a.cnt)
    .slice(0, 30);

  if (!rows.length) {
    el.innerHTML = `<div class="no-data">Sem dados.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="tbl-wrap">
      <table>
        <thead><tr>
          <th>#</th><th>Nome</th><th>Partido</th><th>Município</th><th>UF</th>
          <th>Trechos em comum</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${esc(r.nome)}</td>
              <td><span class="pill">${esc(r.partido)}</span></td>
              <td>${esc(r.municipio)}</td>
              <td>${esc(r.uf)}</td>
              <td><span class="pill warn">${nFmt.format(r.cnt)}</span></td>
              <td><button class="btn btn-ghost" style="font-size:.78rem;padding:.2rem .55rem"
                data-sq="${esc(r.sq)}" data-nome="${esc(r.nome)}"
                onclick="window._showPlagCandPlan(this)">Ver plano ↗</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div id="plag-plan-viewer" style="display:none;margin-top:1rem;padding:1rem;background:var(--bg);border:1px solid var(--line);border-radius:var(--radius)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
        <strong id="plag-plan-name" style="font-size:.95rem"></strong>
        <button class="btn btn-ghost" style="font-size:.78rem" onclick="document.getElementById('plag-plan-viewer').style.display='none'">✕ Fechar</button>
      </div>
      <div id="plag-plan-text" style="font-size:.83rem;line-height:1.65;white-space:pre-wrap;max-height:420px;overflow-y:auto;color:var(--ink)"></div>
    </div>`;

  // handler global para os botões gerados dinamicamente
  window._showPlagCandPlan = async function(btn) {
    const sq   = btn.dataset.sq;
    const nome = btn.dataset.nome;
    const viewer = document.getElementById("plag-plan-viewer");
    const nameEl = document.getElementById("plag-plan-name");
    const textEl = document.getElementById("plag-plan-text");

    nameEl.textContent = nome;
    textEl.innerHTML   = "<em style='color:var(--muted)'>carregando…</em>";
    viewer.style.display = "block";
    viewer.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const data = await loadCandidateText(sq);
    const rawText = data?.text || "";

    if (!rawText) {
      textEl.textContent = "(Texto do plano não disponível)";
      return;
    }

    // coletar frases que este candidato compartilha
    const phrases = [];
    (S.plagiarism?.top_phrases || []).forEach(ph => {
      if ((ph.cands || []).some(c => c.sq === sq)) {
        phrases.push({ phrase: ph.phrase, count: ph.count });
      }
    });

    textEl.innerHTML = phrases.length
      ? highlightPlagPhrases(rawText, phrases)
      : esc(rawText);

    if (phrases.length) {
      const legendEl = document.createElement("div");
      legendEl.style.cssText = "font-size:.75rem;color:var(--muted);margin-top:.5rem";
      legendEl.textContent = `★ ${phrases.length} trecho(s) com destaque em amarelo são compartilhados com outros planos — passe o mouse para ver quantos.`;
      textEl.parentNode.insertBefore(legendEl, textEl.nextSibling);
    }
  };
}

function highlightPlagPhrases(text, phrases) {
  // Encontrar todas as ocorrências (case-insensitive) e marcar ranges
  const lowerText = text.toLowerCase();
  const ranges = [];

  for (const { phrase, count } of phrases) {
    const lp = phrase.toLowerCase();
    let idx = 0;
    while (true) {
      const pos = lowerText.indexOf(lp, idx);
      if (pos === -1) break;
      ranges.push({ start: pos, end: pos + phrase.length, count });
      idx = pos + 1;
    }
  }

  if (!ranges.length) return esc(text);

  // Ordenar e mesclar overlaps (mantém o maior count)
  ranges.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start < last.end) {
      last.end   = Math.max(last.end, r.end);
      last.count = Math.max(last.count, r.count);
    } else {
      merged.push({ ...r });
    }
  }

  // Construir HTML
  let html = "";
  let pos = 0;
  for (const r of merged) {
    if (r.start > pos) html += esc(text.slice(pos, r.start));
    const outros = nFmt.format(r.count - 1);
    html += `<mark class="plag-mark"><span class="plag-tip">citado em outros ${outros} plano(s)</span>${esc(text.slice(r.start, r.end))}</mark>`;
    pos = r.end;
  }
  if (pos < text.length) html += esc(text.slice(pos));
  return html;
}

/* ── paginação genérica ───────────────────────────────────────────────────── */

function renderPager(elId, total, currentPage, onPage) {
  const el     = document.getElementById(elId);
  const pages  = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) { el.innerHTML = ""; return; }

  const MAX_BTNS = 7;
  let start = Math.max(0, currentPage - 3);
  let end   = Math.min(pages, start + MAX_BTNS);
  if (end - start < MAX_BTNS) start = Math.max(0, end - MAX_BTNS);

  const btns = [];
  if (currentPage > 0)
    btns.push(`<button data-p="${currentPage-1}">‹</button>`);

  for (let i = start; i < end; i++)
    btns.push(`<button data-p="${i}" class="${i===currentPage?"active":""}">${i+1}</button>`);

  if (currentPage < pages - 1)
    btns.push(`<button data-p="${currentPage+1}">›</button>`);

  btns.push(`<span>${nFmt.format(total)} resultados · pág. ${currentPage+1}/${pages}</span>`);

  el.innerHTML = btns.join("");
  el.querySelectorAll("button[data-p]").forEach(btn => {
    btn.addEventListener("click", () => onPage(+btn.dataset.p));
  });
}

/* ── Metodologia: tabela de cobertura por estado ─────────────────────────── */

function renderMetodologiaTabela() {
  const el = document.getElementById("metodologia-tabela");
  if (!el || !S.report?.by_state) return;

  const rows = Object.entries(S.report.by_state).sort((a, b) => a[0].localeCompare(b[0]));
  const totalCands = rows.reduce((s, [, d]) => s + d.total, 0);
  const totalCom   = rows.reduce((s, [, d]) => s + d.with_plan, 0);
  const totalPct   = totalCands ? (totalCom / totalCands * 100).toFixed(1) : 0;

  el.innerHTML = `
    <div class="tbl-wrap" style="margin-top:.5rem">
      <table>
        <thead><tr>
          <th>Estado</th>
          <th style="text-align:right">Total candidatos</th>
          <th style="text-align:right">Com plano</th>
          <th style="text-align:right">Sem plano</th>
          <th style="text-align:right">% com plano</th>
        </tr></thead>
        <tbody>
          ${rows.map(([uf, d]) => `
            <tr>
              <td><strong>${esc(uf)}</strong></td>
              <td style="text-align:right;font-family:'IBM Plex Mono',monospace">${nFmt.format(d.total)}</td>
              <td style="text-align:right;font-family:'IBM Plex Mono',monospace;color:var(--good)">${nFmt.format(d.with_plan)}</td>
              <td style="text-align:right;font-family:'IBM Plex Mono',monospace;color:var(--bad)">${nFmt.format(d.total - d.with_plan)}</td>
              <td style="text-align:right">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:.4rem">
                  <div class="prog-bar-bg" style="width:70px">
                    <div class="prog-bar-fill" style="width:${d.pct}%"></div>
                  </div>
                  <span class="prog-pct">${pFmt.format(d.pct)}%</span>
                </div>
              </td>
            </tr>`).join("")}
          <tr style="font-weight:700;border-top:2px solid var(--line)">
            <td>TOTAL</td>
            <td style="text-align:right;font-family:'IBM Plex Mono',monospace">${nFmt.format(totalCands)}</td>
            <td style="text-align:right;font-family:'IBM Plex Mono',monospace;color:var(--good)">${nFmt.format(totalCom)}</td>
            <td style="text-align:right;font-family:'IBM Plex Mono',monospace;color:var(--bad)">${nFmt.format(totalCands - totalCom)}</td>
            <td style="text-align:right"><span class="pill">${totalPct}%</span></td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

/* ── arranque ────────────────────────────────────────────────────────────── */

init();

})();
