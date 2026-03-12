const INITIAL_ROWS = 12;
const EDITABLE_FIELDS = ["date", "value"];
const SERIES_CONFIG = {
  extended: {
    label: "Série histórica estendida",
    description:
      "Encadeia IPC-SP (11/1942 a 01/1944) e IGP-DI (02/1944 em diante) para cobrir o maior intervalo histórico disponível nas séries oficiais listadas na Calculadora do Cidadão.",
    segments: [
      { code: "193", name: "IPC-SP", start: "1942-11", end: "1944-01" },
      { code: "190", name: "IGP-DI", start: "1944-02" },
    ],
  },
  igpdi: {
    label: "IGP-DI",
    description: "Série oficial do BCB/FGV com cobertura desde 02/1944.",
    segments: [{ code: "190", name: "IGP-DI", start: "1944-02" }],
  },
  ipca: {
    label: "IPCA",
    description: "IPCA do IBGE, disponível no BCB desde 01/1980.",
    segments: [{ code: "433", name: "IPCA", start: "1980-01" }],
  },
  inpc: {
    label: "INPC",
    description: "INPC do IBGE, disponível no BCB desde 04/1979.",
    segments: [{ code: "188", name: "INPC", start: "1979-04" }],
  },
  igpm: {
    label: "IGP-M",
    description: "IGP-M da FGV, disponível no BCB desde 06/1989.",
    segments: [{ code: "28655", name: "IGP-M", start: "1989-06" }],
  },
  ipcsp: {
    label: "IPC-SP",
    description: "IPC-SP da FIPE, disponível no BCB desde 11/1942.",
    segments: [{ code: "193", name: "IPC-SP", start: "1942-11" }],
  },
};

const FX_CONFIG = {
  USD: { label: "Dólar", symbol: "US$", seriesCode: "1" },
  EUR: { label: "Euro", symbol: "€", seriesCode: "21619" },
  GBP: { label: "Libra", symbol: "£", seriesCode: "21623" },
};

const state = {
  ready: false,
  seriesData: new Map(),
  fxRates: new Map(),
  seriesError: null,
  fxError: null,
};

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const usdFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
});

const eurFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "EUR",
});

const gbpFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "GBP",
});

const dom = {
  seriesMode: document.getElementById("seriesMode"),
  methodologyHint: document.getElementById("methodologyHint"),
  addRowsBtn: document.getElementById("addRowsBtn"),
  demoBtn: document.getElementById("demoBtn"),
  clearBtn: document.getElementById("clearBtn"),
  statusPanel: document.getElementById("statusPanel"),
  fxTimestamp: document.getElementById("fxTimestamp"),
  ratesGrid: document.getElementById("ratesGrid"),
  sheetBody: document.getElementById("sheetBody"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  renderRows(INITIAL_ROWS);
  bindEvents();
  updateMethodologyHint();
  await loadSources();
  recalculateAllRows();
}

function bindEvents() {
  dom.seriesMode.addEventListener("change", () => {
    updateMethodologyHint();
    updateStatusPanel();
    recalculateAllRows();
  });

  dom.addRowsBtn.addEventListener("click", () => renderRows(10));

  dom.demoBtn.addEventListener("click", () => {
    fillDemoRows();
    recalculateAllRows();
  });

  dom.clearBtn.addEventListener("click", () => {
    clearRows();
    recalculateAllRows();
  });

  dom.sheetBody.addEventListener("input", (event) => {
    const row = event.target.closest("tr");
    if (row) {
      calculateRow(row);
    }
  });

  dom.sheetBody.addEventListener("paste", handleSheetPaste);
}

function renderRows(count) {
  const startIndex = dom.sheetBody.children.length;

  for (let index = startIndex; index < startIndex + count; index += 1) {
    const tr = document.createElement("tr");
    tr.dataset.row = String(index);
    tr.innerHTML = `
      <td class="mono">${index + 1}</td>
      <td>
        <input
          class="sheet-input mono"
          type="text"
          inputmode="text"
          data-field="date"
          data-row="${index}"
          placeholder="${index === 0 ? "15/01/1995" : "DD/MM/AAAA"}"
          aria-label="Data da linha ${index + 1}">
      </td>
      <td>
        <input
          class="sheet-input mono"
          type="text"
          inputmode="decimal"
          data-field="value"
          data-row="${index}"
          placeholder="${index === 0 ? "1000" : "0,00"}"
          aria-label="Valor da linha ${index + 1}">
      </td>
      <td class="result-cell" data-output="month"><span class="empty-result">-</span></td>
      <td class="result-cell" data-output="series"><span class="empty-result">-</span></td>
      <td class="result-cell mono" data-output="factor"><span class="empty-result">-</span></td>
      <td class="result-cell" data-output="brl"><span class="empty-result">-</span></td>
      <td class="result-cell" data-output="usd"><span class="empty-result">-</span></td>
      <td class="result-cell" data-output="eur"><span class="empty-result">-</span></td>
      <td class="result-cell" data-output="gbp"><span class="empty-result">-</span></td>
      <td class="result-cell" data-output="note"><span class="empty-result">-</span></td>
    `;
    dom.sheetBody.appendChild(tr);
  }
}

async function loadSources() {
  const allSeriesCodes = new Set();

  Object.values(SERIES_CONFIG).forEach((config) => {
    config.segments.forEach((segment) => allSeriesCodes.add(segment.code));
  });

  const [seriesResult, fxResult] = await Promise.allSettled([
    Promise.all([...allSeriesCodes].map((code) => loadSeries(code))),
    Promise.all(Object.keys(FX_CONFIG).map((currencyCode) => loadFxRate(currencyCode))),
  ]);

  state.seriesData.clear();
  state.fxRates.clear();

  if (seriesResult.status === "fulfilled") {
    seriesResult.value.forEach(([code, model]) => {
      state.seriesData.set(code, model);
    });
    state.seriesError = null;
  } else {
    state.seriesError = seriesResult.reason;
  }

  if (fxResult.status === "fulfilled") {
    fxResult.value.forEach(([currencyCode, quote]) => {
      state.fxRates.set(currencyCode, quote);
    });
    state.fxError = null;
  } else {
    state.fxError = fxResult.reason;
  }

  state.ready = !state.seriesError;

  updateStatusPanel();
  updateRatesPanel();
}

async function loadSeries(code) {
  const response = await fetch(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json`
  );

  if (!response.ok) {
    throw new Error(`Falha ao carregar a série ${code}.`);
  }

  const payload = await response.json();
  return [code, buildSeriesModel(payload)];
}

function buildSeriesModel(payload) {
  const entries = payload
    .map((item) => {
      const parts = item.data.split("/");
      const monthKey = `${parts[2]}-${parts[1]}`;
      return {
        monthKey,
        value: Number.parseFloat(String(item.valor).replace(",", ".")),
      };
    })
    .sort((left, right) => compareMonthKeys(left.monthKey, right.monthKey));

  const cumulative = new Map();
  const monthValues = new Map();
  let runningFactor = 1;

  entries.forEach((entry) => {
    runningFactor *= 1 + entry.value / 100;
    cumulative.set(entry.monthKey, runningFactor);
    monthValues.set(entry.monthKey, entry.value);
  });

  return {
    firstMonthKey: entries[0]?.monthKey ?? null,
    latestMonthKey: entries[entries.length - 1]?.monthKey ?? null,
    cumulative,
    monthValues,
  };
}

async function loadFxRate(currencyCode) {
  const meta = FX_CONFIG[currencyCode];
  const response = await fetch(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${meta.seriesCode}/dados/ultimos/1?formato=json`
  );

  if (!response.ok) {
    throw new Error(`Falha ao carregar a cotação para ${currencyCode}.`);
  }

  const payload = await response.json();
  const quote = payload?.[0];

  if (!quote) {
    throw new Error(`Nenhuma cotação disponível para ${currencyCode}.`);
  }

  return [
    currencyCode,
    {
      rate: Number.parseFloat(String(quote.valor).replace(",", ".")),
      timestamp: quote.data,
    },
  ];
}

function updateMethodologyHint() {
  const config = getCurrentSeriesConfig();
  dom.methodologyHint.textContent = config.description;
}

function updateStatusPanel() {
  if (state.seriesError) {
    dom.statusPanel.innerHTML = `
      <p class="panel-label">Status</p>
      <h2>Não foi possível carregar uma das fontes do BCB</h2>
      <p class="status-copy">Verifique sua conexão e recarregue a página. O erro recebido foi: ${escapeHtml(
        state.seriesError.message
      )}</p>
    `;
    return;
  }

  const config = getCurrentSeriesConfig();
  const coverageStart = config.segments[0].start;
  const coverageEnd = getLatestMonthForConfig(config);
  const statusBits = [
    `Cobertura: ${monthKeyToLabel(coverageStart)} a ${monthKeyToLabel(coverageEnd)}`,
    `Índice padrão: ${config.label}`,
  ];

  if (state.fxError) {
    statusBits.push("Câmbio indisponível: a correção em R$ continua funcionando");
  } else {
    statusBits.push("Câmbio carregado para dólar, euro e libra");
  }

  dom.statusPanel.innerHTML = `
    <p class="panel-label">Status</p>
    <h2>${config.label}</h2>
    <p class="status-copy">${config.description}</p>
    <div class="status-details">
      ${statusBits.map((text) => `<span>${escapeHtml(text)}</span>`).join("")}
    </div>
  `;
}

function updateRatesPanel() {
  if (state.fxError) {
    dom.fxTimestamp.textContent = "Falha ao carregar cotações.";
    dom.ratesGrid.innerHTML = `
      <div class="rate-card">
        <p>As cotações do Banco Central não puderam ser carregadas.</p>
        <small>${escapeHtml(state.fxError.message)}</small>
      </div>
    `;
    return;
  }

  const cards = [];
  let newestTimestamp = null;

  Object.entries(FX_CONFIG).forEach(([currencyCode, meta]) => {
    const quote = state.fxRates.get(currencyCode);
    if (!quote) {
      return;
    }

    newestTimestamp = quote.timestamp;
    cards.push(`
      <div class="rate-card">
        <p>${meta.label}</p>
        <strong>1 ${currencyCode} = ${brlFormatter.format(quote.rate)}</strong>
        <small>PTAX de fechamento</small>
      </div>
    `);
  });

  dom.ratesGrid.innerHTML = cards.join("");
  dom.fxTimestamp.textContent = newestTimestamp
    ? `Última cotação disponível: ${newestTimestamp}`
    : "Sem cotação disponível.";
}

function handleSheetPaste(event) {
  const target = event.target.closest("input[data-field]");
  if (!target) {
    return;
  }

  const rawText = event.clipboardData?.getData("text/plain") ?? "";
  if (!rawText.includes("\n") && !rawText.includes("\t")) {
    return;
  }

  event.preventDefault();

  const startRow = Number(target.dataset.row);
  const startFieldIndex = EDITABLE_FIELDS.indexOf(target.dataset.field);
  const rows = rawText
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim() !== "");

  ensureRowCount(startRow + rows.length);

  rows.forEach((line, rowOffset) => {
    const cells = line.split("\t");
    cells.forEach((cell, columnOffset) => {
      const field = EDITABLE_FIELDS[startFieldIndex + columnOffset];
      if (!field) {
        return;
      }

      const input = dom.sheetBody.querySelector(
        `input[data-row="${startRow + rowOffset}"][data-field="${field}"]`
      );
      if (input) {
        input.value = cell.trim();
      }
    });
  });

  recalculateAllRows();
}

function ensureRowCount(targetCount) {
  const missingRows = targetCount - dom.sheetBody.children.length;
  if (missingRows > 0) {
    renderRows(missingRows);
  }
}

function recalculateAllRows() {
  [...dom.sheetBody.children].forEach((row) => calculateRow(row));
}

function calculateRow(row) {
  const dateInput = row.querySelector('input[data-field="date"]');
  const valueInput = row.querySelector('input[data-field="value"]');

  const rawDate = dateInput.value.trim();
  const rawValue = valueInput.value.trim();

  if (!rawDate && !rawValue) {
    resetOutputCells(row);
    return;
  }

  if (state.seriesError) {
    writeRowError(row, "As fontes do BCB não carregaram.");
    return;
  }

  if (!state.ready) {
    writeRowMessage(row, "Carregando dados oficiais...");
    return;
  }

  const parsedDate = parseDateInput(rawDate);
  if (!parsedDate) {
    writeRowError(row, "Data inválida.");
    return;
  }

  const parsedValue = parseCurrencyInput(rawValue);
  if (!Number.isFinite(parsedValue)) {
    writeRowError(row, "Valor inválido.");
    return;
  }

  const correction = calculateCorrection(getCurrentSeriesConfig(), parsedDate.monthKey);
  if (!correction.ok) {
    writeRowError(row, correction.message);
    return;
  }

  const correctedBrl = parsedValue * correction.factor;
  const usdQuote = state.fxRates.get("USD");
  const eurQuote = state.fxRates.get("EUR");
  const gbpQuote = state.fxRates.get("GBP");

  setOutput(row, "month", `<strong>${monthKeyToLabel(parsedDate.monthKey)}</strong><small>${escapeHtml(parsedDate.label)}</small>`);
  setOutput(
    row,
    "series",
    `<strong>${escapeHtml(correction.appliedLabel)}</strong><small>Fechado até ${monthKeyToLabel(
      correction.latestMonthKey
    )}</small>`
  );
  setOutput(row, "factor", `<strong>x${formatFactor(correction.factor)}</strong>`);
  setOutput(row, "brl", `<strong>${brlFormatter.format(correctedBrl)}</strong>`);
  setOutput(
    row,
    "usd",
    usdQuote
      ? `<strong>${usdFormatter.format(correctedBrl / usdQuote.rate)}</strong>`
      : '<span class="empty-result">-</span>'
  );
  setOutput(
    row,
    "eur",
    eurQuote
      ? `<strong>${eurFormatter.format(correctedBrl / eurQuote.rate)}</strong>`
      : '<span class="empty-result">-</span>'
  );
  setOutput(
    row,
    "gbp",
    gbpQuote
      ? `<strong>${gbpFormatter.format(correctedBrl / gbpQuote.rate)}</strong>`
      : '<span class="empty-result">-</span>'
  );
  setOutput(
    row,
    "note",
    `<span class="${state.fxError ? "mono" : "ok-text"}">${escapeHtml(
      state.fxError ? `${correction.note} | câmbio indisponível.` : correction.note
    )}</span>`
  );
}

function calculateCorrection(config, startMonthKey) {
  const earliestMonthKey = config.segments[0].start;
  const latestMonthKey = getLatestMonthForConfig(config);

  if (compareMonthKeys(startMonthKey, earliestMonthKey) < 0) {
    return {
      ok: false,
      message: `A série começa em ${monthKeyToLabel(earliestMonthKey)}.`,
    };
  }

  if (compareMonthKeys(startMonthKey, latestMonthKey) > 0) {
    return {
      ok: false,
      message: `A data está após o último mês fechado disponível (${monthKeyToLabel(
        latestMonthKey
      )}).`,
    };
  }

  let totalFactor = 1;
  const usedSegments = [];

  for (const segment of config.segments) {
    const model = state.seriesData.get(segment.code);
    if (!model) {
      return {
        ok: false,
        message: `Série ${segment.name} indisponível.`,
      };
    }

    const segmentStart = maxMonthKey(startMonthKey, segment.start);
    const segmentEnd = minMonthKey(segment.end ?? latestMonthKey, latestMonthKey);

    if (compareMonthKeys(segmentStart, segmentEnd) > 0) {
      continue;
    }

    const factor = getFactorForRange(model, segmentStart, segmentEnd);
    if (factor == null) {
      return {
        ok: false,
        message: `Sem dados entre ${monthKeyToLabel(segmentStart)} e ${monthKeyToLabel(
          segmentEnd
        )}.`,
      };
    }

    totalFactor *= factor;
    usedSegments.push(
      segmentStart === segmentEnd
        ? `${segment.name} (${monthKeyToLabel(segmentStart)})`
        : `${segment.name} (${monthKeyToLabel(segmentStart)} a ${monthKeyToLabel(segmentEnd)})`
    );
  }

  return {
    ok: true,
    factor: totalFactor,
    latestMonthKey,
    appliedLabel: config.label,
    note:
      config.segments.length > 1
        ? usedSegments.join(" + ")
        : "Usa o mês de referência da data informada.",
  };
}

function getFactorForRange(model, startMonthKey, endMonthKey) {
  if (!model.cumulative.has(startMonthKey) || !model.cumulative.has(endMonthKey)) {
    return null;
  }

  const endCumulative = model.cumulative.get(endMonthKey);
  const previousMonthKey = getPreviousMonthKey(startMonthKey);
  const previousCumulative = model.cumulative.get(previousMonthKey) ?? 1;

  return endCumulative / previousCumulative;
}

function getLatestMonthForConfig(config) {
  const lastSegment = config.segments[config.segments.length - 1];
  const model = state.seriesData.get(lastSegment.code);
  return model?.latestMonthKey ?? lastSegment.start;
}

function getCurrentSeriesConfig() {
  return SERIES_CONFIG[dom.seriesMode.value];
}

function fillDemoRows() {
  const demoRows = [
    ["15/01/1995", "1000"],
    ["08/07/2006", "2500"],
    ["11/2014", "700"],
    ["2020-03-10", "15000"],
  ];

  ensureRowCount(demoRows.length);

  demoRows.forEach(([date, value], index) => {
    const dateInput = dom.sheetBody.querySelector(
      `input[data-row="${index}"][data-field="date"]`
    );
    const valueInput = dom.sheetBody.querySelector(
      `input[data-row="${index}"][data-field="value"]`
    );
    if (dateInput && valueInput) {
      dateInput.value = date;
      valueInput.value = value;
    }
  });
}

function clearRows() {
  [...dom.sheetBody.querySelectorAll("input")].forEach((input) => {
    input.value = "";
  });
}

function parseDateInput(rawValue) {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  let match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (!isValidCalendarDate(day, month, year)) {
      return null;
    }
    return {
      monthKey: toMonthKey(year, month),
      label: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
    };
  }

  match = value.match(/^(\d{2})\/(\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    const year = Number(match[2]);
    if (!isValidMonth(month)) {
      return null;
    }
    return {
      monthKey: toMonthKey(year, month),
      label: `${String(month).padStart(2, "0")}/${year}`,
    };
  }

  match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!isValidCalendarDate(day, month, year)) {
      return null;
    }
    return {
      monthKey: toMonthKey(year, month),
      label: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
    };
  }

  return null;
}

function parseCurrencyInput(rawValue) {
  if (!rawValue) {
    return Number.NaN;
  }

  let normalized = rawValue
    .replace(/[R$\s]/g, "")
    .replace(/[^\d,.-]/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  return Number.parseFloat(normalized);
}

function resetOutputCells(row) {
  [
    "month",
    "series",
    "factor",
    "brl",
    "usd",
    "eur",
    "gbp",
    "note",
  ].forEach((key) => {
    setOutput(row, key, '<span class="empty-result">-</span>');
  });
}

function writeRowError(row, message) {
  setOutput(row, "month", '<span class="empty-result">-</span>');
  setOutput(row, "series", '<span class="empty-result">-</span>');
  setOutput(row, "factor", '<span class="empty-result">-</span>');
  setOutput(row, "brl", '<span class="empty-result">-</span>');
  setOutput(row, "usd", '<span class="empty-result">-</span>');
  setOutput(row, "eur", '<span class="empty-result">-</span>');
  setOutput(row, "gbp", '<span class="empty-result">-</span>');
  setOutput(row, "note", `<span class="error-text">${escapeHtml(message)}</span>`);
}

function writeRowMessage(row, message) {
  setOutput(row, "note", `<span class="mono">${escapeHtml(message)}</span>`);
}

function setOutput(row, key, html) {
  const cell = row.querySelector(`[data-output="${key}"]`);
  if (cell) {
    cell.innerHTML = html;
  }
}

function compareMonthKeys(left, right) {
  return left.localeCompare(right);
}

function maxMonthKey(left, right) {
  return compareMonthKeys(left, right) >= 0 ? left : right;
}

function minMonthKey(left, right) {
  return compareMonthKeys(left, right) <= 0 ? left : right;
}

function getPreviousMonthKey(monthKey) {
  const [yearString, monthString] = monthKey.split("-");
  const month = Number(monthString);
  const year = Number(yearString);

  if (month === 1) {
    return `${year - 1}-12`;
  }

  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

function toMonthKey(year, month) {
  return `${String(year)}-${String(month).padStart(2, "0")}`;
}

function monthKeyToLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

function formatFactor(value) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(value);
}

function isValidMonth(month) {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function isValidCalendarDate(day, month, year) {
  if (!isValidMonth(month) || !Number.isInteger(day) || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
