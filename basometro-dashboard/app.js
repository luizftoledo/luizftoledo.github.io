const DATA_URL = "./data/report_data.json";

const currencyFmt = new Intl.NumberFormat("pt-BR");
const percentFmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

let payload = null;
let charts = {
  monthlyRate: null,
  monthlyVolume: null,
  governments: null,
  parties: null,
};

const refs = {
  updated: document.getElementById("status-updated"),
  range: document.getElementById("status-range"),
  govFilter: document.getElementById("filter-government"),
  minParty: document.getElementById("filter-min-party"),
  minDeputy: document.getElementById("filter-min-deputy"),

  kpiAlignment: document.getElementById("kpi-alignment"),
  kpiPro: document.getElementById("kpi-pro"),
  kpiAnti: document.getElementById("kpi-anti"),
  kpiVotes: document.getElementById("kpi-votes"),
  kpiNote: document.getElementById("kpi-note"),

  methodList: document.getElementById("method-list"),
  notesList: document.getElementById("notes-list"),

  tableGovernments: document.getElementById("table-governments"),
  partyNote: document.getElementById("party-note"),
  deputyNote: document.getElementById("deputy-note"),

  tablePartiesPro: document.getElementById("table-parties-pro"),
  tablePartiesAnti: document.getElementById("table-parties-anti"),
  tableDeputies: document.getElementById("table-deputies"),
  tableRecent: document.getElementById("table-recent"),
};

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatInt(v) {
  return currencyFmt.format(safeNumber(v));
}

function formatPct(v) {
  return `${percentFmt.format(safeNumber(v))}%`;
}

function parseDate(dateString) {
  if (!dateString) return null;
  const value = new Date(`${dateString}T12:00:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function latestMonthRange(monthlySeries) {
  if (!monthlySeries.length) return "--";
  const first = monthlySeries[0].month;
  const last = monthlySeries[monthlySeries.length - 1].month;
  return `${first} até ${last}`;
}

function pickGovStats(baseItem, govId) {
  if (!baseItem) return { pro_votes: 0, anti_votes: 0, total_votes: 0, alignment_pct: 0 };
  if (govId === "all") {
    return {
      pro_votes: safeNumber(baseItem.pro_votes),
      anti_votes: safeNumber(baseItem.anti_votes),
      total_votes: safeNumber(baseItem.total_votes),
      alignment_pct: safeNumber(baseItem.alignment_pct),
    };
  }
  const byGov = baseItem.by_government || {};
  const row = byGov[govId];
  if (!row) return { pro_votes: 0, anti_votes: 0, total_votes: 0, alignment_pct: 0 };
  return {
    pro_votes: safeNumber(row.pro_votes),
    anti_votes: safeNumber(row.anti_votes),
    total_votes: safeNumber(row.total_votes),
    alignment_pct: safeNumber(row.alignment_pct),
  };
}

function selectedGovernment() {
  return refs.govFilter.value || "all";
}

function filterMonthly(series, govId) {
  if (govId === "all") return series.slice();
  return series.filter((row) => row.government_id === govId);
}

function buildSummary(govId) {
  if (govId === "all") {
    return {
      pro_votes: payload.summary.pro_votes,
      anti_votes: payload.summary.anti_votes,
      total_votes: payload.summary.total_votes,
      alignment_pct: payload.summary.alignment_pct,
      votacoes: payload.summary.votacoes_validas,
      label: "Série completa",
    };
  }

  const gov = payload.government_series.find((row) => row.id === govId);
  if (!gov) {
    return {
      pro_votes: 0,
      anti_votes: 0,
      total_votes: 0,
      alignment_pct: 0,
      votacoes: 0,
      label: "Sem dados",
    };
  }

  return {
    pro_votes: gov.pro_votes,
    anti_votes: gov.anti_votes,
    total_votes: gov.total_votes,
    alignment_pct: gov.alignment_pct,
    votacoes: gov.votacoes,
    label: gov.label,
  };
}

function setMethodology() {
  refs.methodList.innerHTML = "";
  refs.notesList.innerHTML = "";

  for (const item of payload.methodology.items || []) {
    const li = document.createElement("li");
    li.textContent = item;
    refs.methodList.appendChild(li);
  }

  for (const note of payload.methodology.notes || []) {
    const li = document.createElement("li");
    li.textContent = note;
    refs.notesList.appendChild(li);
  }
}

function setStatus() {
  const metadata = payload.metadata || {};
  const updatedAt = metadata.generated_at ? new Date(metadata.generated_at) : null;
  refs.updated.textContent = `Atualizado: ${updatedAt ? dateFmt.format(updatedAt) : "--"}`;
  refs.range.textContent = `Período: ${metadata.start_year || "--"} até ${metadata.end_year || "--"}`;
}

function setGovFilterOptions() {
  refs.govFilter.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "Todos os governos";
  refs.govFilter.appendChild(optAll);

  for (const gov of payload.governments || []) {
    const opt = document.createElement("option");
    opt.value = gov.id;
    opt.textContent = gov.label;
    refs.govFilter.appendChild(opt);
  }
}

function setKpis(summary, filteredMonthly) {
  refs.kpiAlignment.textContent = formatPct(summary.alignment_pct);
  refs.kpiPro.textContent = formatInt(summary.pro_votes);
  refs.kpiAnti.textContent = formatInt(summary.anti_votes);
  refs.kpiVotes.textContent = formatInt(summary.votacoes);

  refs.kpiNote.textContent = `${summary.label}. ${formatInt(summary.total_votes)} votos de deputados considerados, em ${filteredMonthly.length} meses com votações válidas.`;
}

function drawMonthlyRate(filteredMonthly) {
  const ctx = document.getElementById("chart-monthly-rate");
  if (charts.monthlyRate) charts.monthlyRate.destroy();

  const labels = filteredMonthly.map((row) => row.month);
  const data = filteredMonthly.map((row) => safeNumber(row.alignment_pct));

  charts.monthlyRate = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "% de alinhamento",
          data,
          borderColor: "#0f6aa6",
          backgroundColor: "rgba(15, 106, 166, 0.15)",
          pointBackgroundColor: "#0f6aa6",
          pointRadius: 2,
          tension: 0.22,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: (value) => `${value}%`,
          },
          grid: { color: "rgba(0, 0, 0, 0.08)" },
        },
        x: {
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
          },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function drawMonthlyVolume(filteredMonthly) {
  const ctx = document.getElementById("chart-monthly-volume");
  if (charts.monthlyVolume) charts.monthlyVolume.destroy();

  const labels = filteredMonthly.map((row) => row.month);
  const pro = filteredMonthly.map((row) => safeNumber(row.pro_votes));
  const anti = filteredMonthly.map((row) => safeNumber(row.anti_votes));

  charts.monthlyVolume = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Pró-governo",
          data: pro,
          backgroundColor: "rgba(47, 143, 119, 0.86)",
          borderColor: "#2f8f77",
          borderWidth: 1,
          stack: "votes",
        },
        {
          label: "Contra-governo",
          data: anti,
          backgroundColor: "rgba(196, 91, 77, 0.82)",
          borderColor: "#c45b4d",
          borderWidth: 1,
          stack: "votes",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
          },
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: "rgba(0, 0, 0, 0.08)" },
        },
      },
      plugins: {
        legend: { position: "top" },
      },
    },
  });
}

function setGovernmentTable() {
  refs.tableGovernments.innerHTML = "";

  const rows = (payload.government_series || []).slice().sort((a, b) => {
    const da = parseDate(a.start);
    const db = parseDate(b.start);
    return da - db;
  });

  if (!rows.length) {
    refs.tableGovernments.innerHTML = '<tr><td colspan="6">Sem dados de governos.</td></tr>';
    return;
  }

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.label}</td>
      <td><span class="chip chip-pro">${formatPct(row.alignment_pct)}</span></td>
      <td>${formatInt(row.pro_votes)}</td>
      <td>${formatInt(row.anti_votes)}</td>
      <td>${formatInt(row.total_votes)}</td>
      <td>${formatInt(row.votacoes)}</td>
    `;
    refs.tableGovernments.appendChild(tr);
  }
}

function drawGovernmentChart() {
  const ctx = document.getElementById("chart-governments");
  if (charts.governments) charts.governments.destroy();

  const rows = (payload.government_series || []).slice().sort((a, b) => {
    const da = parseDate(a.start);
    const db = parseDate(b.start);
    return da - db;
  });

  charts.governments = new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: "% de alinhamento",
          data: rows.map((row) => safeNumber(row.alignment_pct)),
          backgroundColor: rows.map((row) => (row.id === "lula3" ? "rgba(47, 143, 119, 0.86)" : "rgba(15, 106, 166, 0.78)")),
          borderColor: rows.map((row) => (row.id === "lula3" ? "#2f8f77" : "#0f6aa6")),
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { callback: (value) => `${value}%` },
          grid: { color: "rgba(0, 0, 0, 0.08)" },
        },
        x: {
          grid: { display: false },
          ticks: {
            autoSkip: false,
            maxRotation: 20,
            minRotation: 0,
          },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

function buildPartyRows(govId, minVotes) {
  const out = [];
  for (const item of payload.party_ranking || []) {
    const stats = pickGovStats(item, govId);
    if (stats.total_votes < minVotes) continue;
    out.push({
      party: item.party,
      ...stats,
    });
  }
  out.sort((a, b) => b.alignment_pct - a.alignment_pct || b.total_votes - a.total_votes);
  return out;
}

function setPartyTables(govId, minVotes) {
  const rows = buildPartyRows(govId, minVotes);
  refs.partyNote.textContent = `Filtro aplicado: mínimo de ${formatInt(minVotes)} votos por partido (${rows.length} partidos no recorte).`;

  refs.tablePartiesPro.innerHTML = "";
  refs.tablePartiesAnti.innerHTML = "";

  if (!rows.length) {
    refs.tablePartiesPro.innerHTML = '<tr><td colspan="5">Sem partidos com o mínimo de votos definido.</td></tr>';
    refs.tablePartiesAnti.innerHTML = '<tr><td colspan="5">Sem partidos com o mínimo de votos definido.</td></tr>';
    return;
  }

  const topPro = rows.slice(0, 12);
  const topAnti = rows.slice(-12).reverse();

  for (const row of topPro) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.party}</td>
      <td><span class="chip chip-pro">${formatPct(row.alignment_pct)}</span></td>
      <td>${formatInt(row.pro_votes)}</td>
      <td>${formatInt(row.anti_votes)}</td>
      <td>${formatInt(row.total_votes)}</td>
    `;
    refs.tablePartiesPro.appendChild(tr);
  }

  for (const row of topAnti) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.party}</td>
      <td><span class="chip chip-anti">${formatPct(row.alignment_pct)}</span></td>
      <td>${formatInt(row.pro_votes)}</td>
      <td>${formatInt(row.anti_votes)}</td>
      <td>${formatInt(row.total_votes)}</td>
    `;
    refs.tablePartiesAnti.appendChild(tr);
  }

  drawPartyChart(rows);
}

function drawPartyChart(rows) {
  const ctx = document.getElementById("chart-parties");
  if (charts.parties) charts.parties.destroy();

  const top = rows.slice(0, 10);

  charts.parties = new Chart(ctx, {
    type: "bar",
    data: {
      labels: top.map((row) => row.party),
      datasets: [
        {
          label: "% de alinhamento",
          data: top.map((row) => safeNumber(row.alignment_pct)),
          backgroundColor: "rgba(15, 106, 166, 0.82)",
          borderColor: "#0f6aa6",
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { callback: (value) => `${value}%` },
          grid: { color: "rgba(0, 0, 0, 0.08)" },
        },
        y: {
          grid: { display: false },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function setDeputyTable(govId, minVotes) {
  const rows = [];

  for (const item of payload.deputy_ranking || []) {
    const stats = pickGovStats(item, govId);
    if (stats.total_votes < minVotes) continue;
    rows.push({
      deputy_id: item.deputy_id,
      name: item.name,
      party: item.party,
      uf: item.uf,
      ...stats,
    });
  }

  rows.sort((a, b) => b.total_votes - a.total_votes || b.alignment_pct - a.alignment_pct);
  const top = rows.slice(0, 40);

  refs.deputyNote.textContent = `Mostrando os 40 deputados com mais votos no recorte (mínimo de ${formatInt(minVotes)} votos por deputado; universo filtrado: ${rows.length}).`;
  refs.tableDeputies.innerHTML = "";

  if (!top.length) {
    refs.tableDeputies.innerHTML = '<tr><td colspan="7">Sem deputados com o mínimo de votos definido.</td></tr>';
    return;
  }

  for (const row of top) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.name || "--"}</td>
      <td>${row.party || "--"}</td>
      <td>${row.uf || "--"}</td>
      <td><span class="chip ${row.alignment_pct >= 50 ? "chip-pro" : "chip-anti"}">${formatPct(row.alignment_pct)}</span></td>
      <td>${formatInt(row.pro_votes)}</td>
      <td>${formatInt(row.anti_votes)}</td>
      <td>${formatInt(row.total_votes)}</td>
    `;
    refs.tableDeputies.appendChild(tr);
  }
}

function setRecentVotes(govId) {
  refs.tableRecent.innerHTML = "";
  let rows = (payload.recent_votes || []).slice();
  if (govId !== "all") {
    rows = rows.filter((row) => row.government_id === govId);
  }
  rows = rows.slice(0, 30);

  if (!rows.length) {
    refs.tableRecent.innerHTML = '<tr><td colspan="7">Sem votações recentes no recorte selecionado.</td></tr>';
    return;
  }

  for (const row of rows) {
    const dtObj = parseDate(row.date);
    const summary = (row.description || "").slice(0, 180);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dtObj ? dateFmt.format(dtObj) : (row.date || "--")}</td>
      <td><span class="chip">${row.government_label || "--"}</span></td>
      <td>${row.gov_orientation || "--"}</td>
      <td><span class="chip ${row.alignment_pct >= 50 ? "chip-pro" : "chip-anti"}">${formatPct(row.alignment_pct)}</span></td>
      <td>${formatInt(row.pro_votes)}</td>
      <td>${formatInt(row.anti_votes)}</td>
      <td title="${row.description || ""}">${summary}${(row.description || "").length > summary.length ? "..." : ""}</td>
    `;
    refs.tableRecent.appendChild(tr);
  }
}

function refresh() {
  const govId = selectedGovernment();
  const minPartyVotes = Math.max(1, safeNumber(refs.minParty.value));
  const minDeputyVotes = Math.max(1, safeNumber(refs.minDeputy.value));

  const summary = buildSummary(govId);
  const monthly = filterMonthly(payload.monthly_series || [], govId);

  setKpis(summary, monthly);
  drawMonthlyRate(monthly);
  drawMonthlyVolume(monthly);
  setPartyTables(govId, minPartyVotes);
  setDeputyTable(govId, minDeputyVotes);
  setRecentVotes(govId);
}

async function bootstrap() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Falha ao carregar dados (${response.status})`);
    }

    payload = await response.json();

    setStatus();
    setMethodology();
    setGovFilterOptions();
    setGovernmentTable();
    drawGovernmentChart();

    refs.kpiNote.textContent = `Série carregada: ${latestMonthRange(payload.monthly_series || [])}.`;

    refs.govFilter.addEventListener("change", refresh);
    refs.minParty.addEventListener("change", refresh);
    refs.minDeputy.addEventListener("change", refresh);

    refresh();
  } catch (error) {
    console.error(error);
    refs.kpiNote.textContent = `Erro ao carregar dados: ${error.message}`;
    refs.tableGovernments.innerHTML = '<tr><td colspan="6">Erro ao carregar dados.</td></tr>';
    refs.tablePartiesPro.innerHTML = '<tr><td colspan="5">Erro ao carregar dados.</td></tr>';
    refs.tablePartiesAnti.innerHTML = '<tr><td colspan="5">Erro ao carregar dados.</td></tr>';
    refs.tableDeputies.innerHTML = '<tr><td colspan="7">Erro ao carregar dados.</td></tr>';
    refs.tableRecent.innerHTML = '<tr><td colspan="7">Erro ao carregar dados.</td></tr>';
  }
}

bootstrap();
