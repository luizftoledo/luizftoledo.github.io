(function () {
  const nFmt = new Intl.NumberFormat('pt-BR');
  const moneyFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
  const pctFmt = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 1,
  });

  const els = {
    statusUpdate: document.getElementById('status-update'),
    statusSnapshot: document.getElementById('status-snapshot'),
    statusSource: document.getElementById('status-source'),

    tabViewSnapshot: document.getElementById('tab-view-snapshot'),
    tabViewDocs: document.getElementById('tab-view-docs'),
    viewSnapshot: document.getElementById('view-snapshot'),
    viewDocs: document.getElementById('view-docs'),

    kpiDeltaPositive: document.getElementById('kpi-delta-positive'),
    kpiDeltaNet: document.getElementById('kpi-delta-net'),
    kpiAuthorsUp: document.getElementById('kpi-authors-up'),
    kpiDestinationsUp: document.getElementById('kpi-destinations-up'),
    spotlight: document.getElementById('spotlight'),

    docKpiTotalToCommit: document.getElementById('doc-kpi-total-to-commit'),
    docKpiCommittedSoFar: document.getElementById('doc-kpi-committed-so-far'),
    docKpiCommittedLastDay: document.getElementById('doc-kpi-committed-last-day'),
    docKpiPaidYear: document.getElementById('doc-kpi-paid-year'),
    docSpotlight: document.getElementById('doc-spotlight'),

    tablePairs: document.getElementById('table-pairs'),
    tableAuthorsTotal: document.getElementById('table-authors-total'),
    tableDestinationsTotal: document.getElementById('table-destinations-total'),

    tableDocsAuthorsYear: document.getElementById('table-docs-authors-year'),
    tableDocsAuthorsDay: document.getElementById('table-docs-authors-day'),
    tableDocsDestDay: document.getElementById('table-docs-dest-day'),
    tableApoiamentoTop: document.getElementById('table-apoiamento-top'),
    apoiamentoNote: document.getElementById('apoiamento-note'),

    sourcesList: document.getElementById('sources-list'),

    chartHistory: document.getElementById('chart-history'),
    chartAuthors: document.getElementById('chart-authors'),
    chartDestinations: document.getElementById('chart-destinations'),
    chartDocsDaily: document.getElementById('chart-docs-daily'),
  };

  const chartInstances = [];

  function esc(value) {
    return (value || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatIsoDateTime(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  }

  function money(value) {
    return moneyFmt.format(Number(value || 0));
  }

  function destroyCharts() {
    while (chartInstances.length) {
      const chart = chartInstances.pop();
      chart.destroy();
    }
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${url}`);
    }
    return resp.json();
  }

  function setActiveView(viewId) {
    const isSnapshot = viewId === 'snapshot';
    els.viewSnapshot.hidden = !isSnapshot;
    els.viewDocs.hidden = isSnapshot;
    els.tabViewSnapshot.classList.toggle('active', isSnapshot);
    els.tabViewDocs.classList.toggle('active', !isSnapshot);
  }

  function setKpis(metrics) {
    const deltaNet = Number(metrics.delta_liquido_desde_snapshot_anterior || 0);
    const deltaPositive = Number(metrics.delta_positivo_desde_snapshot_anterior || 0);

    els.kpiDeltaPositive.textContent = money(deltaPositive);
    els.kpiDeltaNet.textContent = money(deltaNet);
    els.kpiDeltaNet.classList.toggle('good', deltaNet >= 0);
    els.kpiDeltaNet.classList.toggle('bad', deltaNet < 0);
    els.kpiAuthorsUp.textContent = nFmt.format(metrics.autores_com_aumento || 0);
    els.kpiDestinationsUp.textContent = nFmt.format(metrics.destinos_com_aumento || 0);
  }

  function setSpotlight(report) {
    const topAuthor = (report.top_authors_today || [])[0];
    const topDestination = (report.top_destinations_today || [])[0];
    const delta = Number((report.metrics || {}).delta_positivo_desde_snapshot_anterior || 0);
    const rows = Number((report.metrics || {}).total_linhas_csv || 0);
    const baseline = Boolean((report.metrics || {}).baseline_initialized);

    if (baseline) {
      els.spotlight.innerHTML = `Primeira carga do monitor concluída. Este snapshot serve como linha de base para calcular o movimento diário a partir da próxima atualização. Base processada: <strong>${nFmt.format(rows)}</strong> linhas.`;
      return;
    }

    if (!topAuthor || !topDestination) {
      els.spotlight.innerHTML = `Hoje não houve variação positiva identificada. Base processada: <strong>${nFmt.format(rows)}</strong> linhas.`;
      return;
    }

    els.spotlight.innerHTML = `
      No snapshot de <strong>${esc(report.snapshot_date || '--')}</strong>, o monitor identificou
      <strong>${money(delta)}</strong> de aumento positivo em empenhos.
      Quem mais cresceu no dia foi <strong>${esc(topAuthor.author)}</strong>
      (${esc(topAuthor.party || 'sem partido mapeado')}, ${money(topAuthor.delta_empenhado)}),
      e o principal destino foi <strong>${esc(topDestination.destination)}</strong>
      (${money(topDestination.delta_empenhado)}).
    `;
  }

  function renderPairsTable(rows) {
    if (!rows.length) {
      els.tablePairs.innerHTML = '<tr><td colspan="5">Sem variação positiva no dia.</td></tr>';
      return;
    }
    els.tablePairs.innerHTML = rows.slice(0, 40).map((row) => `
      <tr>
        <td>${esc(row.author)}</td>
        <td>${esc(row.party || 'Nao identificado')}</td>
        <td>${esc(row.destination)}</td>
        <td>${money(row.delta_empenhado)}</td>
        <td>${money(row.current_empenhado)}</td>
      </tr>
    `).join('');
  }

  function renderAuthorsTotalTable(rows) {
    if (!rows.length) {
      els.tableAuthorsTotal.innerHTML = '<tr><td colspan="3">Sem dados.</td></tr>';
      return;
    }
    els.tableAuthorsTotal.innerHTML = rows.slice(0, 20).map((row) => `
      <tr>
        <td>${esc(row.author)}</td>
        <td>${esc(row.party || 'Nao identificado')}</td>
        <td>${money(row.total_empenhado)}</td>
      </tr>
    `).join('');
  }

  function renderSimpleTable(target, rows, nameKey, valueKey) {
    if (!rows.length) {
      target.innerHTML = '<tr><td colspan="2">Sem dados.</td></tr>';
      return;
    }
    target.innerHTML = rows.slice(0, 20).map((row) => `
      <tr>
        <td>${esc(row[nameKey])}</td>
        <td>${money(row[valueKey])}</td>
      </tr>
    `).join('');
  }

  function renderHistoryChart(dailyHistory) {
    const labels = dailyHistory.map((row) => row.date || '--');
    const positive = dailyHistory.map((row) => Number(row.delta_positivo || 0));
    const net = dailyHistory.map((row) => Number(row.delta_liquido || 0));

    const chart = new Chart(els.chartHistory, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Empenhado no dia (positivo)',
            data: positive,
            borderColor: '#c1733f',
            backgroundColor: 'rgba(193, 115, 63, 0.20)',
            borderWidth: 2,
            tension: 0.22,
            pointRadius: 2,
            fill: true,
          },
          {
            label: 'Variação líquida',
            data: net,
            borderColor: '#3f6b7b',
            borderWidth: 1.8,
            tension: 0.2,
            pointRadius: 1.8,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: {
              callback: (value) => moneyFmt.format(value),
            },
          },
        },
        plugins: {
          legend: {
            labels: { boxWidth: 14, boxHeight: 8 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}`,
            },
          },
        },
      },
    });
    chartInstances.push(chart);
  }

  function renderBarChart(canvas, rows, labelKey, valueKey, title, color) {
    const sliced = rows.slice(0, 10);
    const labels = sliced.map((row) => row[labelKey] || '--');
    const values = sliced.map((row) => Number(row[valueKey] || 0));
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: title,
            data: values,
            backgroundColor: color,
            borderRadius: 6,
            maxBarThickness: 26,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => money(ctx.parsed.x),
            },
          },
        },
        scales: {
          x: {
            ticks: {
              callback: (value) => moneyFmt.format(value),
            },
          },
        },
      },
    });
    chartInstances.push(chart);
  }

  function renderDocsDailyChart(dailySeries) {
    const labels = dailySeries.map((row) => row.date || '--');
    const empenhado = dailySeries.map((row) => Number(row.empenhado || 0));
    const pago = dailySeries.map((row) => Number(row.pago || 0));

    const chart = new Chart(els.chartDocsDaily, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Empenhado por dia',
            data: empenhado,
            borderColor: '#c1733f',
            backgroundColor: 'rgba(193, 115, 63, 0.18)',
            borderWidth: 2,
            tension: 0.18,
            fill: true,
            pointRadius: 1.2,
          },
          {
            label: 'Pago por dia',
            data: pago,
            borderColor: '#3f6b7b',
            borderWidth: 1.8,
            tension: 0.18,
            fill: false,
            pointRadius: 1.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: {
              callback: (value) => moneyFmt.format(value),
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y)}`,
            },
          },
        },
      },
    });
    chartInstances.push(chart);
  }

  function renderDocsTable(target, rows, rowBuilder, emptyColspan) {
    if (!rows.length) {
      target.innerHTML = `<tr><td colspan="${emptyColspan}">Sem dados.</td></tr>`;
      return;
    }
    target.innerHTML = rows.map(rowBuilder).join('');
  }

  function renderParallelMonitor(report) {
    const parallel = report.parallel_monitor || {};
    const execucao = parallel.execucao_ano_corrente || {};
    const docs = parallel.documents || {};
    const apoiamento = parallel.apoiamento || {};
    const unicoYear = report.unico_year_summary || {};

    const stageValues = execucao.stage_values || {};
    const totalToCommit = Number(stageValues.a_empenhar || 0) > 0
      ? Number(stageValues.a_empenhar || 0) + Number(stageValues.empenhado || 0)
      : (Number(stageValues.empenhado || 0) || null);

    els.docKpiTotalToCommit.textContent = totalToCommit === null ? 'não disponível' : money(totalToCommit);
    els.docKpiCommittedSoFar.textContent = money(unicoYear.total_empenhado || (docs.totals || {}).total_empenhado_year || 0);
    els.docKpiCommittedLastDay.textContent = money((docs.totals || {}).total_empenhado_last_day || 0);
    els.docKpiPaidYear.textContent = money((docs.totals || {}).total_pago_year || 0);

    const maxDate = docs.date_max || '--';
    const minDate = docs.date_min || '--';
    const rowsValid = Number(docs.rows_valid_year || 0);
    els.docSpotlight.innerHTML = `
      Série diária de <strong>${esc(minDate)}</strong> até <strong>${esc(maxDate)}</strong>.
      Último dia com movimentação: <strong>${esc(maxDate)}</strong>.
      Registros processados na fonte de documentos: <strong>${nFmt.format(rowsValid)}</strong>.
    `;

    renderDocsTable(
      els.tableDocsAuthorsYear,
      (docs.top_authors_year || []).slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(row.author)}</td>
          <td>${esc(row.party || 'Nao identificado')}</td>
          <td>${money(row.empenhado)}</td>
          <td>${money(row.pago)}</td>
        </tr>
      `,
      4
    );

    renderDocsTable(
      els.tableDocsAuthorsDay,
      (docs.top_authors_last_day || []).slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(row.author)}</td>
          <td>${esc(row.party || 'Nao identificado')}</td>
          <td>${money(row.empenhado)}</td>
        </tr>
      `,
      3
    );

    renderDocsTable(
      els.tableDocsDestDay,
      (docs.top_destinations_last_day || []).slice(0, 20),
      (row) => `
        <tr>
          <td>${esc(row.destination)}</td>
          <td>${money(row.empenhado)}</td>
        </tr>
      `,
      2
    );

    if (apoiamento.available) {
      els.apoiamentoNote.textContent = `Base de apoiamento disponível para ${apoiamento.year}.`;
      renderDocsTable(
        els.tableApoiamentoTop,
        (apoiamento.top_supporters || []).slice(0, 20),
        (row) => `
          <tr>
            <td>${esc(row.supporter)}</td>
            <td>${money(row.empenhado)}</td>
            <td>${money(row.pago)}</td>
            <td>${nFmt.format(row.authors_count || 0)}</td>
          </tr>
        `,
        4
      );
    } else {
      els.apoiamentoNote.textContent = 'Não houve arquivo de apoiamento disponível no momento desta atualização.';
      els.tableApoiamentoTop.innerHTML = '<tr><td colspan="4">Sem dados de apoiamento disponíveis.</td></tr>';
    }

    renderDocsDailyChart(docs.daily_series || []);
  }

  function renderSources(report) {
    const source = report.source || {};
    const topAuthor = (report.top_authors_today || [])[0];
    const topDestination = (report.top_destinations_today || [])[0];
    const dayTotal = Number((report.metrics || {}).delta_positivo_desde_snapshot_anterior || 0);
    const authorShare = topAuthor ? Number(topAuthor.share_in_day || 0) : 0;
    const destinationShare = topDestination ? Number(topDestination.share_in_day || 0) : 0;

    const parallel = report.parallel_monitor || {};
    const docsSource = ((parallel.documents || {}).source) || {};
    const apoiamentoSource = ((parallel.apoiamento || {}).source) || {};
    const execucao = parallel.execucao_ano_corrente || {};

    const items = [
      `<li><strong>Base principal (snapshot):</strong> <a href="${esc(source.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Portal da Transparência - Emendas (UNICO)</a>.</li>`,
      `<li><strong>Aba paralela - documentos:</strong> <a href="${esc(docsSource.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Emendas por documentos de despesa (ano corrente)</a>.</li>`,
      `<li><strong>Aba paralela - apoiamento:</strong> <a href="${esc(apoiamentoSource.requested_url || '#')}" target="_blank" rel="noopener noreferrer">Apoiamento de emendas parlamentares por documentos</a>.</li>`,
      `<li><strong>Endpoint de execução (ano corrente):</strong> <a href="${esc(execucao.endpoint_url || '#')}" target="_blank" rel="noopener noreferrer">execucao-despesas-ano-corrente/resultadoGrafico</a>.</li>`,
      `<li><strong>Regra do monitor principal:</strong> “Empenhado no dia” = variação positiva no acumulado entre snapshots consecutivos da mesma base.</li>`,
      `<li><strong>Leitura rápida do dia:</strong> total positivo de ${money(dayTotal)}.`
      + (topAuthor ? ` Autor líder: ${esc(topAuthor.author)} (${pctFmt.format(authorShare)} do total do dia).` : '')
      + (topDestination ? ` Destino líder: ${esc(topDestination.destination)} (${pctFmt.format(destinationShare)} do total do dia).` : '')
      + '</li>',
    ];
    els.sourcesList.innerHTML = items.join('');
  }

  function setStatus(report, metadata) {
    const source = report.source || {};
    els.statusUpdate.textContent = `Atualizado: ${formatIsoDateTime(report.generated_at || metadata.updated_at || '')}`;
    els.statusSnapshot.textContent = `Snapshot: ${report.snapshot_date || metadata.snapshot_date || '--'}`;
    els.statusSource.textContent = `Fonte: ${source.last_modified || metadata.source_last_modified || '--'}`;
  }

  async function boot() {
    destroyCharts();
    let report = null;
    let metadata = null;
    try {
      [report, metadata] = await Promise.all([
        fetchJson('./data/report_data.json'),
        fetchJson('./data/metadata.json').catch(() => ({})),
      ]);
    } catch (error) {
      els.spotlight.textContent = `Falha ao carregar dados: ${error.message}`;
      return;
    }

    setStatus(report, metadata || {});
    setKpis(report.metrics || {});
    setSpotlight(report);

    renderPairsTable(report.top_author_destination_today || []);
    renderAuthorsTotalTable(report.top_authors_total || []);
    renderSimpleTable(els.tableDestinationsTotal, report.top_destinations_total || [], 'destination', 'total_empenhado');

    renderHistoryChart(report.daily_history || []);
    renderBarChart(
      els.chartAuthors,
      report.top_authors_today || [],
      'author',
      'delta_empenhado',
      'Aumento por autor',
      'rgba(193, 115, 63, 0.72)'
    );
    renderBarChart(
      els.chartDestinations,
      report.top_destinations_today || [],
      'destination',
      'delta_empenhado',
      'Aumento por destino',
      'rgba(63, 107, 123, 0.72)'
    );

    renderParallelMonitor(report);
    renderSources(report);

    els.tabViewSnapshot.addEventListener('click', () => setActiveView('snapshot'));
    els.tabViewDocs.addEventListener('click', () => setActiveView('docs'));
    setActiveView('snapshot');
  }

  boot();
})();
