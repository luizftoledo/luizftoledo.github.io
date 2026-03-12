const YEARS = 30;
const DEFAULTS = {
  currentAge: 35,
  currentBalance: 250000,
  monthlyContribution: 3000,
};
const DEFAULT_SCENARIO_ID = "netBase";
const FIXED_INCOME_TAX_RATE = 15;
const TESOURO_CUSTODY_FEE_RATE = 0.2;

const EVENT_TYPES = [
  { id: "lumpSum", label: "Entrada unica" },
  { id: "monthlyStep", label: "Aporte mensal extra" },
];

const state = {
  ready: false,
  error: null,
  references: null,
  scenarios: [],
  selectedScenarioId: DEFAULT_SCENARIO_ID,
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
  currentAge: document.getElementById("currentAge"),
  currentBalance: document.getElementById("currentBalance"),
  monthlyContribution: document.getElementById("monthlyContribution"),
  inflationRate: document.getElementById("inflationRate"),
  inflationHint: document.getElementById("inflationHint"),
  displayCurrency: document.getElementById("displayCurrency"),
  currencyHint: document.getElementById("currencyHint"),
  addEventBtn: document.getElementById("addEventBtn"),
  eventRows: document.getElementById("eventRows"),
  customRateRow: document.getElementById("customRateRow"),
  customRate: document.getElementById("customRate"),
  statusPanel: document.getElementById("statusPanel"),
  referencesTimestamp: document.getElementById("referencesTimestamp"),
  referencesGrid: document.getElementById("referencesGrid"),
  scenarioGridPlanning: document.getElementById("scenarioGridPlanning"),
  scenarioGridReference: document.getElementById("scenarioGridReference"),
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
  addEventRow();
  await loadReferences();
  runSimulation();
}

function bindEvents() {
  [dom.currentAge, dom.currentBalance, dom.monthlyContribution, dom.inflationRate, dom.customRate].forEach((input) => {
    input.addEventListener("input", runSimulation);
  });

  dom.displayCurrency.addEventListener("change", () => {
    state.displayCurrency = dom.displayCurrency.value;
    runSimulation();
  });

  [dom.scenarioGridPlanning, dom.scenarioGridReference].forEach((grid) => {
    grid.addEventListener("click", handleScenarioSelection);
  });

  dom.addEventBtn.addEventListener("click", () => {
    addEventRow();
    runSimulation();
  });

  dom.eventRows.addEventListener("input", runSimulation);
  dom.eventRows.addEventListener("change", runSimulation);
  dom.eventRows.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".event-remove");
    if (!removeButton) {
      return;
    }

    removeButton.closest(".event-row")?.remove();
    if (!dom.eventRows.children.length) {
      addEventRow();
    }
    runSimulation();
  });
}

function handleScenarioSelection(event) {
  const card = event.target.closest("[data-scenario-id]");
  if (!card) {
    return;
  }

  state.selectedScenarioId = card.dataset.scenarioId;
  updateScenarioSelection();
  runSimulation();
}

function setDefaultInputs() {
  dom.currentAge.value = String(DEFAULTS.currentAge);
  dom.currentBalance.value = String(DEFAULTS.currentBalance);
  dom.monthlyContribution.value = String(DEFAULTS.monthlyContribution);
  dom.displayCurrency.value = state.displayCurrency;
}

function addEventRow(initial = {}) {
  const row = document.createElement("div");
  row.className = "event-row";
  row.innerHTML = `
    <input
      class="event-age"
      type="number"
      min="0"
      max="120"
      step="1"
      value="${initial.age ?? ""}"
      placeholder="40"
      aria-label="Idade do evento">
    <select class="event-type" aria-label="Tipo do evento">
      ${EVENT_TYPES.map(
        (type) =>
          `<option value="${type.id}" ${initial.type === type.id ? "selected" : ""}>${type.label}</option>`
      ).join("")}
    </select>
    <input
      class="event-value money-input"
      type="text"
      inputmode="decimal"
      value="${initial.value ?? ""}"
      placeholder="50000 ou 1500">
    <input
      class="event-label"
      type="text"
      value="${initial.label ?? ""}"
      placeholder="Bonus, promocao, venda de casa...">
    <button type="button" class="secondary event-remove" aria-label="Remover evento">x</button>
  `;
  dom.eventRows.appendChild(row);
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

    dom.inflationRate.value = percentageFormatter.format(ipca12mAnnual).replace(".", "").replace(",", ".");
    dom.customRate.value = percentageFormatter.format(cdiAnnual).replace(".", "").replace(",", ".");
    state.scenarios = buildScenarios(ipca12mAnnual);
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

function buildScenarios(inflationAnnual) {
  const safeInflationAnnual =
    Number.isFinite(inflationAnnual) && inflationAnnual >= 0 ? inflationAnnual : state.references.ipca12mAnnual;
  const customRate = parsePercentageInput(dom.customRate.value);
  const customScenarioRate =
    Number.isFinite(customRate) && customRate >= 0 ? customRate : state.references.cdiAnnual;
  const netSelicRate = estimateNetFixedIncomeRate(
    state.references.selicAnnual,
    FIXED_INCOME_TAX_RATE,
    TESOURO_CUSTODY_FEE_RATE
  );

  return [
    {
      id: "netConservative",
      label: "Realista conservador",
      category: "planning",
      tone: "planning",
      badge: "Liquido",
      rate: toNominalAnnualRate(safeInflationAnnual, 2),
      note: "IPCA + 2,0% real",
      description: "Planejamento prudente para horizontes longos.",
    },
    {
      id: "netBase",
      label: "Realista base",
      category: "planning",
      tone: "planning",
      badge: "Liquido",
      rate: toNominalAnnualRate(safeInflationAnnual, 3.5),
      note: "IPCA + 3,5% real",
      description: "Ponto de partida mais equilibrado para simular a vida real.",
    },
    {
      id: "netOptimistic",
      label: "Realista otimista",
      category: "planning",
      tone: "planning",
      badge: "Liquido",
      rate: toNominalAnnualRate(safeInflationAnnual, 5),
      note: "IPCA + 5,0% real",
      description: "Supoe carteira eficiente e constancia por muitos anos.",
    },
    {
      id: "selicNet",
      label: "Selic liquida hoje",
      category: "planning",
      tone: "planning",
      badge: "Liquido aprox.",
      rate: netSelicRate,
      note: "Selic atual menos IR e custodia",
      description: "Aproximacao simples com 15% de IR e 0,20% a.a. de custodia.",
    },
    {
      id: "poupanca",
      label: "Poupanca aprox.",
      category: "reference",
      tone: "reference",
      badge: "Referencia",
      rate: state.references.poupancaAnnual,
      note: "Regra atual simplificada",
      description: "Sem TR. Serve mais como piso de comparacao.",
    },
    {
      id: "cdi100",
      label: "CDI 100%",
      category: "reference",
      tone: "reference",
      badge: "Bruto hoje",
      rate: state.references.cdiAnnual,
      note: "CDI anualizado atual",
      description: "Benchmark bruto de renda fixa sem descontos.",
    },
    {
      id: "cdi110",
      label: "CDB 110% do CDI",
      category: "reference",
      tone: "reference",
      badge: "Bruto hoje",
      rate: state.references.cdiAnnual * 1.1,
      note: "110% da taxa CDI atual",
      description: "Comparacao simples acima do benchmark bruto.",
    },
    {
      id: "cdi120",
      label: "CDB 120% do CDI",
      category: "reference",
      tone: "reference",
      badge: "Bruto hoje",
      rate: state.references.cdiAnnual * 1.2,
      note: "120% da taxa CDI atual",
      description: "Cenario agressivo e pouco realista para 30 anos.",
    },
    {
      id: "custom",
      label: "Taxa personalizada",
      category: "reference",
      tone: "custom",
      badge: "Livre",
      rate: customScenarioRate,
      note: "Escolhida por voce",
      description: "Use qualquer taxa anual nominal que queira testar.",
    },
  ];
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
  const renderCards = (category) =>
    state.scenarios
      .filter((scenario) => scenario.category === category)
      .map(
        (scenario) => `
          <article class="scenario-card scenario-card--${scenario.tone}" data-scenario-id="${scenario.id}">
            <div class="scenario-card-header">
              <p>${escapeHtml(scenario.label)}</p>
              <span class="scenario-badge scenario-badge--${scenario.tone}">${escapeHtml(scenario.badge)}</span>
            </div>
            <h3>${escapeHtml(formatPercent(scenario.rate))}</h3>
            <span class="scenario-note">${escapeHtml(scenario.note)}</span>
            <small>${escapeHtml(scenario.description)}</small>
          </article>
        `
      )
      .join("");

  dom.scenarioGridPlanning.innerHTML = renderCards("planning");
  dom.scenarioGridReference.innerHTML = renderCards("reference");
}

function updateScenarioSelection() {
  const isCustom = state.selectedScenarioId === "custom";
  dom.customRateRow.classList.toggle("hidden", !isCustom);

  [...document.querySelectorAll(".scenario-card")].forEach((card) => {
    card.classList.toggle("is-active", card.dataset.scenarioId === state.selectedScenarioId);
  });
}

function runSimulation() {
  if (!state.ready) {
    return;
  }

  const currentAge = Number.parseInt(dom.currentAge.value, 10);
  const currentBalance = parseMoneyInput(dom.currentBalance.value);
  const monthlyContribution = parseMoneyInput(dom.monthlyContribution.value);
  const inflationAnnual = parsePercentageInput(dom.inflationRate.value);
  const events = collectEvents(currentAge);
  state.scenarios = buildScenarios(inflationAnnual);
  renderScenarioCards();
  updateScenarioSelection();
  let selectedScenario = state.scenarios.find((scenario) => scenario.id === state.selectedScenarioId);
  if (!selectedScenario) {
    state.selectedScenarioId = DEFAULT_SCENARIO_ID;
    updateScenarioSelection();
    selectedScenario = state.scenarios.find((scenario) => scenario.id === state.selectedScenarioId);
  }
  const annualRate =
    state.selectedScenarioId === "custom"
      ? parsePercentageInput(dom.customRate.value)
      : selectedScenario.rate;

  if (
    !Number.isInteger(currentAge) ||
    currentAge < 0 ||
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
    currentAge,
    currentBalance,
    monthlyContribution,
    annualRate,
    inflationAnnual,
    events,
  });

  const currencyMeta = getDisplayCurrencyMeta();
  updateCurrencyHint();
  updateTableHeaders(currencyMeta);

  renderMetrics(rows, {
    annualRate,
    inflationAnnual,
    selectedScenario,
    currentAge,
    currentBalance,
    monthlyContribution,
    currencyMeta,
    events,
  });
  renderTable(rows, currencyMeta);
  renderCharts(rows, currencyMeta);
}

function collectEvents(currentAge) {
  return [...dom.eventRows.querySelectorAll(".event-row")]
    .map((row) => {
      const age = Number.parseInt(row.querySelector(".event-age")?.value ?? "", 10);
      const type = row.querySelector(".event-type")?.value ?? "lumpSum";
      const value = parseMoneyInput(row.querySelector(".event-value")?.value ?? "");
      const label = row.querySelector(".event-label")?.value?.trim() ?? "";

      if (!Number.isFinite(value) || value === 0 || !Number.isInteger(age)) {
        return null;
      }

      return {
        age: Math.max(age, currentAge),
        type,
        value,
        label,
      };
    })
    .filter(Boolean);
}

function simulateProjection({ currentAge, currentBalance, monthlyContribution, annualRate, inflationAnnual, events }) {
  const monthlyReturn = toEffectiveMonthlyRate(annualRate);
  const monthlyInflation = toEffectiveMonthlyRate(inflationAnnual);
  const immediateLumpSum = sumEvents(events, "lumpSum", currentAge);
  let activeMonthlyExtra = sumEvents(events, "monthlyStep", currentAge);
  let balance = currentBalance + immediateLumpSum;
  let contributed = currentBalance + immediateLumpSum;
  let inflationFactor = 1;
  const rows = [];

  for (let year = 1; year <= YEARS; year += 1) {
    const age = currentAge + year;
    const yearlyLumpSum = sumEvents(events, "lumpSum", age);
    const newMonthlyExtra = sumEvents(events, "monthlyStep", age);
    balance += yearlyLumpSum;
    contributed += yearlyLumpSum;
    activeMonthlyExtra += newMonthlyExtra;

    for (let month = 1; month <= 12; month += 1) {
      balance = balance * (1 + monthlyReturn) + monthlyContribution + activeMonthlyExtra;
      contributed += monthlyContribution + activeMonthlyExtra;
      inflationFactor *= 1 + monthlyInflation;
    }

    const monthlyIncomeNominal = balance * monthlyReturn;
    rows.push({
      year,
      age,
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
  const eventCount = inputs.events.length;
  const currencyLabel =
    inputs.currencyMeta.code === "BRL"
      ? "reais"
      : `${inputs.currencyMeta.label.toLowerCase()} na cotacao atual`;
  const scenarioKindCopy =
    inputs.selectedScenario.category === "planning"
      ? "cenario liquido de planejamento"
      : "referencia simples do mercado atual";

  dom.summaryHelper.textContent = `${inputs.selectedScenario.label} (${scenarioKindCopy}) com ${formatPercent(
    inputs.annualRate
  )}, ${inputs.selectedScenario.note.toLowerCase()}, inflacao de ${formatPercent(
    inputs.inflationAnnual
  )} e aportes mensais de ${formatCurrency(inputs.monthlyContribution, "BRL", false)}. Mostrando os resultados em ${currencyLabel}${
    eventCount ? ` e considerando ${eventCount} evento(s) extra(s)` : ""
  }.`;

  const cards = [
    {
      label: `Patrimonio nominal aos ${lastRow.age} anos`,
      value: formatDisplayAmount(lastRow.nominalBalance, inputs.currencyMeta, false),
      note: "Valor bruto no fim do periodo.",
    },
    {
      label: `Patrimonio real aos ${lastRow.age} anos`,
      value: formatDisplayAmount(lastRow.realBalance, inputs.currencyMeta, false),
      note: "Mesmo valor, ja descontando a inflacao assumida.",
    },
    {
      label: `Rendimento mensal nominal aos ${lastRow.age}`,
      value: formatDisplayAmount(lastRow.nominalMonthlyIncome, inputs.currencyMeta, false),
      note: "Renda mensal estimada se a taxa continuar igual.",
    },
    {
      label: `Rendimento mensal real aos ${lastRow.age}`,
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
          <td>${row.age}</td>
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

  const labels = rows.map((row) => `${row.age}`);
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
          title: (items) => {
            const row = rows[items[0].dataIndex];
            return `Idade ${row.age} | Ano ${row.year}`;
          },
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

function toNominalAnnualRate(inflationAnnual, realAnnual) {
  return ((1 + inflationAnnual / 100) * (1 + realAnnual / 100) - 1) * 100;
}

function estimateNetFixedIncomeRate(grossAnnual, taxRatePercent, annualFeePercent = 0) {
  return Math.max(grossAnnual * (1 - taxRatePercent / 100) - annualFeePercent, 0);
}

function sumEvents(events, type, age) {
  return events
    .filter((event) => event.type === type && event.age === age)
    .reduce((accumulator, event) => accumulator + event.value, 0);
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
    <p class="status-copy">A pagina combina CDI anualizado, Selic anualizada, IPCA acumulado em 12 meses, cambio atual de dolar/libra e eventos extras por idade, todos do Banco Central. Os cenarios de planejamento usam versoes liquidas ou retornos reais simples; os brutos ficam separados como referencia.</p>
    <div class="status-details">
      <span>Horizonte: ${YEARS} anos</span>
      <span>Planejamento: liquido e realista</span>
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
