const YEARS = 30;
const DEFAULTS = {
  currentBalance: 250000,
  monthlyContribution: 3000,
};

const state = {
  ready: false,
  error: null,
  references: null,
  scenarios: [],
  selectedScenarioId: "cdi100",
  displayCurrency: "BRL",
  charts: {
    portfolio: null,
    income: null,
  },
};

const percentageFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dom = {
  currentBalance: document.getElementById("currentBalance"),
  monthlyContribution: document.getElementById("monthlyContribution"),
  inflationRate: document.getElementById("inflationRate"),
  inflationHint: document.getElementById("inflationHint"),
  displayCurrency: document.getElementById("displayCurrency"),
  currencyHint: document.getElementById("currencyHint"),
  customRateRow: document.getElementById("customRateRow"),
  customRate: document.getElementById("customRate"),
  statusPanel: document.getElementById("statusPanel"),
  referencesTimestamp: document.getElementById("referencesTimestamp"),
  referencesGrid: document.getElementById("referencesGrid"),
  scenarioGrid: document.getElementById("scenarioGrid"),
  metricsGrid: document.getElementById("metricsGrid"),
  summaryHelper: document.getElementById("summaryHelper"),
  tableHelper: document.getElementById("tableHelper"),
  headerNominalBalance: document.getElementById("headerNominalBalance"),
  headerRealBalance: document.getElementById("headerRealBalance"),
  headerNominalIncome: document.getElementById("headerNominalIncome"),
  headerRealIncome: document.getElementById("headerRealIncome"),
  headerContributed: document.getElementById("headerContributed"),
  projectionBody: document.getElementById("projectionBody"),
  portfolioChart: document.getElementById("portfolioChart"),
  incomeChart: document.getElementById("incomeChart"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  setDefaultInputs();
  await loadReferences();
  runSimulation();
}

function bindEvents() {
  [dom.currentBalance, dom.monthlyContribution, dom.inflationRate, dom.customRate].forEach((input) => {
    input.addEventListener("input", runSimulation);
  });

  dom.displayCurrency.addEventListener("change", () => {
    state.displayCurrency = dom.displayCurrency.value;
    runSimulation();
  });

  dom.scenarioGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-scenario-id]");
    if (!card) {
      return;
    }

    state.selectedScenarioId = card.dataset.scenarioId;
    updateScenarioSelection();
    runSimulation();
  });
}

function setDefaultInputs() {
  dom.currentBalance.value = String(DEFAULTS.currentBalance);
  dom.monthlyContribution.value = String(DEFAULTS.monthlyContribution);
  dom.displayCurrency.value = state.displayCurrency;
}

async function loadReferences() {
  try {
    const [cdiSeries, selicSeries, ipcaSeries, usdSeries, gbpSeries] = await Promise.all([
      fetchSeries(4389, 1),
      fetchSeries(1178, 1),
      fetchSeries(433, 12),
      fetchSeries(1, 1),
      fetchSeries(21623, 1),
    ]);

    const cdiAnnual = toNumber(cdiSeries[0].valor);
    const selicAnnual = toNumber(selicSeries[0].valor);
    const ipca12mAnnual = calculateAccumulatedAnnualRate(ipcaSeries);
    const poupancaAnnual = calculateSavingsApproximation(selicAnnual);
    const usdRate = toNumber(usdSeries[0].valor);
    const gbpRate = toNumber(gbpSeries[0].valor);

    state.references = {
      cdiAnnual,
      cdiDate: cdiSeries[0].data,
      selicAnnual,
      selicDate: selicSeries[0].data,
      ipca12mAnnual,
      ipcaDate: ipcaSeries[ipcaSeries.length - 1].data,
      poupancaAnnual,
      usdRate,
      usdDate: usdSeries[0].data,
      gbpRate,
      gbpDate: gbpSeries[0].data,
    };

    state.scenarios = [
      {
        id: "poupanca",
        label: "Poupanca aprox.",
        rate: poupancaAnnual,
        description: "Regra atual simplificada, sem TR.",
      },
      {
        id: "selic",
        label: "Tesouro Selic / Selic",
        rate: selicAnnual,
        description: "Referencia oficial anualizada base 252.",
      },
      {
        id: "cdi100",
        label: "CDI 100%",
        rate: cdiAnnual,
        description: "Benchmark bruto de renda fixa.",
      },
      {
        id: "cdi110",
        label: "CDB 110% do CDI",
        rate: cdiAnnual * 1.1,
        description: "Cenario simples acima do benchmark.",
      },
      {
        id: "cdi120",
        label: "CDB 120% do CDI",
        rate: cdiAnnual * 1.2,
        description: "Cenario mais agressivo, ainda simples.",
      },
      {
        id: "custom",
        label: "Taxa personalizada",
        rate: cdiAnnual,
        description: "Use a taxa anual que voce quiser.",
      },
    ];

    dom.inflationRate.value = percentageFormatter.format(ipca12mAnnual).replace(".", "").replace(",", ".");
    dom.customRate.value = percentageFormatter.format(cdiAnnual).replace(".", "").replace(",", ".");
    dom.inflationHint.textContent = `Padrao: IPCA acumulado em 12 meses = ${formatPercent(ipca12mAnnual)}.`;
    updateCurrencyHint();

    renderReferenceCards();
    renderScenarioCards();
    updateScenarioSelection();
    updateStatusPanel();
    state.ready = true;
  } catch (error) {
    state.ready = false;
    state.error = error;
    dom.statusPanel.innerHTML = `
      <p class="panel-label">Status</p>
      <h2>Falha ao carregar as referencias do BCB</h2>
      <p class="status-copy">${escapeHtml(error.message)}</p>
    `;
  }
}

async function fetchSeries(code, count) {
  const response = await fetch(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${count}?formato=json`
  );

  if (!response.ok) {
    throw new Error(`Nao foi possivel carregar a serie ${code}.`);
  }

  return response.json();
}

function renderReferenceCards() {
  const cards = [
    {
      label: "CDI anualizado",
      value: formatPercent(state.references.cdiAnnual),
      note: `Ultimo valor disponivel: ${state.references.cdiDate}`,
    },
    {
      label: "Selic anualizada",
      value: formatPercent(state.references.selicAnnual),
      note: `Ultimo valor disponivel: ${state.references.selicDate}`,
    },
    {
      label: "IPCA 12 meses",
      value: formatPercent(state.references.ipca12mAnnual),
      note: `Deflator padrao ate ${state.references.ipcaDate}`,
    },
    {
      label: "Dolar comercial",
      value: formatCurrency(state.references.usdRate, "BRL", false),
      note: `1 US$ = ${formatCurrency(state.references.usdRate, "BRL", true)} em ${state.references.usdDate}`,
    },
    {
      label: "Libra esterlina",
      value: formatCurrency(state.references.gbpRate, "BRL", false),
      note: `1 £ = ${formatCurrency(state.references.gbpRate, "BRL", true)} em ${state.references.gbpDate}`,
    },
  ];

  dom.referencesGrid.innerHTML = cards
    .map(
      (card) => `
        <div class="rate-card">
          <p>${escapeHtml(card.label)}</p>
          <strong>${escapeHtml(card.value)}</strong>
          <small>${escapeHtml(card.note)}</small>
        </div>
      `
    )
    .join("");

  dom.referencesTimestamp.textContent = `Atualizado com base nas series oficiais mais recentes do BCB.`;
}

function renderScenarioCards() {
  dom.scenarioGrid.innerHTML = state.scenarios
    .map(
      (scenario) => `
        <article class="scenario-card" data-scenario-id="${scenario.id}">
          <p>${escapeHtml(scenario.label)}</p>
          <h3>${escapeHtml(formatPercent(scenario.rate))}</h3>
          <small>${escapeHtml(scenario.description)}</small>
        </article>
      `
    )
    .join("");
}

function updateScenarioSelection() {
  const isCustom = state.selectedScenarioId === "custom";
  dom.customRateRow.classList.toggle("hidden", !isCustom);

  [...dom.scenarioGrid.querySelectorAll(".scenario-card")].forEach((card) => {
    card.classList.toggle("is-active", card.dataset.scenarioId === state.selectedScenarioId);
  });
}

function runSimulation() {
  if (!state.ready) {
    return;
  }

  const currentBalance = parseMoneyInput(dom.currentBalance.value);
  const monthlyContribution = parseMoneyInput(dom.monthlyContribution.value);
  const inflationAnnual = parsePercentageInput(dom.inflationRate.value);
  const selectedScenario = state.scenarios.find((scenario) => scenario.id === state.selectedScenarioId);
  const annualRate =
    state.selectedScenarioId === "custom"
      ? parsePercentageInput(dom.customRate.value)
      : selectedScenario.rate;

  if (
    !Number.isFinite(currentBalance) ||
    !Number.isFinite(monthlyContribution) ||
    !Number.isFinite(inflationAnnual) ||
    !Number.isFinite(annualRate) ||
    currentBalance < 0 ||
    monthlyContribution < 0 ||
    inflationAnnual < 0 ||
    annualRate < 0
  ) {
    dom.summaryHelper.textContent = "Preencha os campos com numeros validos e positivos.";
    return;
  }

  const rows = simulateProjection({
    currentBalance,
    monthlyContribution,
    annualRate,
    inflationAnnual,
  });

  const currencyMeta = getDisplayCurrencyMeta();
  updateCurrencyHint();
  updateTableHeaders(currencyMeta);

  renderMetrics(rows, {
    annualRate,
    inflationAnnual,
    selectedScenario,
    currentBalance,
    monthlyContribution,
    currencyMeta,
  });
  renderTable(rows, currencyMeta);
  renderCharts(rows, currencyMeta);
}

function simulateProjection({ currentBalance, monthlyContribution, annualRate, inflationAnnual }) {
  const monthlyReturn = toEffectiveMonthlyRate(annualRate);
  const monthlyInflation = toEffectiveMonthlyRate(inflationAnnual);
  let balance = currentBalance;
  let contributed = currentBalance;
  let inflationFactor = 1;
  const rows = [];

  for (let year = 1; year <= YEARS; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      balance = balance * (1 + monthlyReturn) + monthlyContribution;
      contributed += monthlyContribution;
      inflationFactor *= 1 + monthlyInflation;
    }

    const monthlyIncomeNominal = balance * monthlyReturn;
    rows.push({
      year,
      nominalBalance: balance,
      realBalance: balance / inflationFactor,
      nominalMonthlyIncome: monthlyIncomeNominal,
      realMonthlyIncome: monthlyIncomeNominal / inflationFactor,
      contributed,
    });
  }

  return rows;
}

function renderMetrics(rows, inputs) {
  const lastRow = rows[rows.length - 1];
  const realAnnualReturn = ((1 + inputs.annualRate / 100) / (1 + inputs.inflationAnnual / 100) - 1) * 100;
  const currencyLabel =
    inputs.currencyMeta.code === "BRL"
      ? "reais"
      : `${inputs.currencyMeta.label.toLowerCase()} na cotacao atual`;

  dom.summaryHelper.textContent = `${inputs.selectedScenario.label} com ${formatPercent(
    inputs.annualRate
  )}, inflacao de ${formatPercent(inputs.inflationAnnual)} e aportes mensais de ${formatCurrency(
    inputs.monthlyContribution,
    "BRL",
    false
  )}. Mostrando os resultados em ${currencyLabel}.`;

  const cards = [
    {
      label: "Patrimonio nominal em 30 anos",
      value: formatDisplayAmount(lastRow.nominalBalance, inputs.currencyMeta, false),
      note: "Valor bruto no fim do periodo.",
    },
    {
      label: "Patrimonio em reais de hoje",
      value: formatDisplayAmount(lastRow.realBalance, inputs.currencyMeta, false),
      note: "Mesmo valor, ja descontando a inflacao assumida.",
    },
    {
      label: "Rendimento mensal nominal no ano 30",
      value: formatDisplayAmount(lastRow.nominalMonthlyIncome, inputs.currencyMeta, false),
      note: "Renda mensal estimada se a taxa continuar igual.",
    },
    {
      label: "Rendimento mensal real no ano 30",
      value: formatDisplayAmount(lastRow.realMonthlyIncome, inputs.currencyMeta, false),
      note: `Retorno real implicito: ${formatPercent(realAnnualReturn)} ao ano.`,
    },
  ];

  dom.metricsGrid.innerHTML = cards
    .map(
      (card) => `
        <div class="metric-card">
          <p>${escapeHtml(card.label)}</p>
          <strong>${escapeHtml(card.value)}</strong>
          <small>${escapeHtml(card.note)}</small>
        </div>
      `
    )
    .join("");
}

function renderTable(rows, currencyMeta) {
  dom.projectionBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.year}</td>
          <td>${formatDisplayAmount(row.nominalBalance, currencyMeta, true)}</td>
          <td>${formatDisplayAmount(row.realBalance, currencyMeta, true)}</td>
          <td>${formatDisplayAmount(row.nominalMonthlyIncome, currencyMeta, true)}</td>
          <td>${formatDisplayAmount(row.realMonthlyIncome, currencyMeta, true)}</td>
          <td>${formatDisplayAmount(row.contributed, currencyMeta, true)}</td>
        </tr>
      `
    )
    .join("");
}

function renderCharts(rows, currencyMeta) {
  if (typeof window.Chart === "undefined") {
    return;
  }

  const labels = rows.map((row) => `${row.year}`);
  const convert = (value) => convertAmount(value, currencyMeta);
  const portfolioData = {
    labels,
    datasets: [
      {
        label: "Patrimonio nominal",
        data: rows.map((row) => convert(row.nominalBalance)),
        borderColor: "#0d7a53",
        backgroundColor: "rgba(13, 122, 83, 0.12)",
        tension: 0.25,
      },
      {
        label: "Patrimonio real",
        data: rows.map((row) => convert(row.realBalance)),
        borderColor: "#d5842b",
        backgroundColor: "rgba(213, 132, 43, 0.12)",
        tension: 0.25,
      },
    ],
  };

  const incomeData = {
    labels,
    datasets: [
      {
        label: "Rendimento mensal nominal",
        data: rows.map((row) => convert(row.nominalMonthlyIncome)),
        borderColor: "#0d7a53",
        backgroundColor: "rgba(13, 122, 83, 0.12)",
        tension: 0.25,
      },
      {
        label: "Rendimento mensal real",
        data: rows.map((row) => convert(row.realMonthlyIncome)),
        borderColor: "#d5842b",
        backgroundColor: "rgba(213, 132, 43, 0.12)",
        tension: 0.25,
      },
    ],
  };

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    scales: {
      y: {
        ticks: {
          callback: (value) => formatDisplayAmount(value, currencyMeta, false),
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${formatDisplayAmount(context.parsed.y, currencyMeta, true)}`,
        },
      },
    },
  };

  if (state.charts.portfolio) {
    state.charts.portfolio.destroy();
  }

  if (state.charts.income) {
    state.charts.income.destroy();
  }

  state.charts.portfolio = new Chart(dom.portfolioChart, {
    type: "line",
    data: portfolioData,
    options: sharedOptions,
  });

  state.charts.income = new Chart(dom.incomeChart, {
    type: "line",
    data: incomeData,
    options: sharedOptions,
  });
}

function calculateAccumulatedAnnualRate(series) {
  return (
    series.reduce((accumulator, item) => accumulator * (1 + toNumber(item.valor) / 100), 1) - 1
  ) * 100;
}

function calculateSavingsApproximation(selicAnnual) {
  if (selicAnnual <= 8.5) {
    return selicAnnual * 0.7;
  }

  return (Math.pow(1.005, 12) - 1) * 100;
}

function parseMoneyInput(rawValue) {
  let normalized = rawValue.trim().replace(/[R$\s]/gi, "").replace(/[^\d,.-]/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(".")) {
    const parts = normalized.split(".");
    if (parts.length > 2 || parts[parts.length - 1].length === 3) {
      normalized = normalized.replace(/\./g, "");
    }
  }

  return Number.parseFloat(normalized);
}

function parsePercentageInput(rawValue) {
  return Number.parseFloat(String(rawValue).replace(",", "."));
}

function toEffectiveMonthlyRate(annualPercent) {
  return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
}

function toNumber(rawValue) {
  return Number.parseFloat(String(rawValue).replace(",", "."));
}

function formatPercent(value) {
  return `${percentageFormatter.format(value)}% a.a.`;
}

function updateCurrencyHint() {
  if (!state.references) {
    dom.currencyHint.textContent = "Carregando cambio atual...";
    return;
  }

  const currencyMeta = getDisplayCurrencyMeta();
  if (currencyMeta.code === "BRL") {
    dom.currencyHint.textContent = "Resultados mostrados na moeda base da simulacao.";
    return;
  }

  dom.currencyHint.textContent = `Conversao online pelo BCB: 1 ${currencyMeta.symbol} = ${formatCurrency(
    currencyMeta.rate,
    "BRL",
    true
  )} em ${currencyMeta.date}.`;
}

function updateTableHeaders(currencyMeta) {
  const suffix = currencyMeta.code === "BRL" ? "(R$)" : `(${currencyMeta.symbol})`;
  dom.headerNominalBalance.textContent = `Patrimonio nominal ${suffix}`;
  dom.headerRealBalance.textContent = `Patrimonio real ${suffix}`;
  dom.headerNominalIncome.textContent = `Rendimento mensal nominal ${suffix}`;
  dom.headerRealIncome.textContent = `Rendimento mensal real ${suffix}`;
  dom.headerContributed.textContent = `Total aportado ${suffix}`;
  dom.tableHelper.textContent =
    currencyMeta.code === "BRL"
      ? "Os valores reais sao trazidos para valores de hoje usando a inflacao anual escolhida."
      : `Os valores reais sao trazidos para valores de hoje e depois convertidos para ${currencyMeta.label.toLowerCase()} pela cotacao atual do BCB.`;
}

function updateStatusPanel() {
  dom.statusPanel.innerHTML = `
    <p class="panel-label">Status</p>
    <h2>Cenarios prontos para simular</h2>
    <p class="status-copy">A pagina combina CDI anualizado, Selic anualizada, IPCA acumulado em 12 meses e cambio atual de dolar/libra, todos do Banco Central.</p>
    <div class="status-details">
      <span>Horizonte: ${YEARS} anos</span>
      <span>Comparacao: nominal x real</span>
      <span>Base oficial: SGS do BCB</span>
    </div>
  `;
}

function getDisplayCurrencyMeta() {
  if (state.displayCurrency === "USD") {
    return {
      code: "USD",
      label: "Dolar",
      symbol: "US$",
      rate: state.references.usdRate,
      date: state.references.usdDate,
    };
  }

  if (state.displayCurrency === "GBP") {
    return {
      code: "GBP",
      label: "Libra",
      symbol: "£",
      rate: state.references.gbpRate,
      date: state.references.gbpDate,
    };
  }

  return {
    code: "BRL",
    label: "Reais",
    symbol: "R$",
    rate: 1,
    date: "",
  };
}

function convertAmount(amount, currencyMeta) {
  return currencyMeta.code === "BRL" ? amount : amount / currencyMeta.rate;
}

function formatDisplayAmount(amount, currencyMeta, precise) {
  const converted = convertAmount(amount, currencyMeta);
  return formatCurrency(converted, currencyMeta.code, precise);
}

function formatCurrency(value, currencyCode, precise) {
  const formatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: precise ? 2 : 0,
  });

  return formatter.format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
