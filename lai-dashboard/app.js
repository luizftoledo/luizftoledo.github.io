(() => {
  const DATA_FILE = './data/report_data.json';
  const METADATA_FILE = './data/metadata.json';

  const GEMINI_STORAGE_KEY = 'lai_dashboard_gemini_key';
  const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  const GEMINI_CONTINUE_PROMPT = 'Continue exatamente de onde parou, sem repetir trecho anterior.';

  const nFmt = new Intl.NumberFormat('pt-BR');
  const pFmt = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const updatedLine = document.getElementById('updated-line');
  const yearsPill = document.getElementById('years-pill');

  const metricTotalRequests = document.getElementById('metric-total-requests');
  const metricDeniedTotal = document.getElementById('metric-denied-total');
  const metricRestrictedTotal = document.getElementById('metric-restricted-total');
  const metricPersonalTotal = document.getElementById('metric-personal-total');

  const narrativeList = document.getElementById('narrative-list');

  const tableYearly = document.getElementById('table-yearly');
  const tableReasons = document.getElementById('table-reasons');
  const tableOrgTop = document.getElementById('table-org-top');
  const tablePersonalTop = document.getElementById('table-personal-top');

  const orgCards = document.getElementById('org-cards');

  const geminiKeyInput = document.getElementById('gemini-key');
  const aiYearFilter = document.getElementById('ai-year-filter');
  const aiOrgFilter = document.getElementById('ai-org-filter');
  const aiChat = document.getElementById('ai-chat');
  const aiQuestion = document.getElementById('ai-question');
  const aiAskBtn = document.getElementById('btn-ask-ai');
  const aiResetBtn = document.getElementById('btn-ai-reset');
  const aiStatus = document.getElementById('ai-status');

  const chartInstances = [];

  let reportData = null;
  let metadata = null;

  let aiMessages = [];
  let aiHistory = [];
  let aiContextStamp = '';

  function esc(text) {
    return (text || '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateTime(iso) {
    if (!iso) return '--';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });
  }

  function shortOrgName(name) {
    if (!name) return '';
    if (name.length <= 38) return name;
    return `${name.slice(0, 37)}...`;
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`HTTP ${resp.status} ao carregar ${url}: ${body.slice(0, 120)}`);
    }
    return resp.json();
  }

  function destroyCharts() {
    while (chartInstances.length) {
      const chart = chartInstances.pop();
      chart.destroy();
    }
  }

  function pushChart(instance) {
    chartInstances.push(instance);
  }

  function renderMetrics() {
    const overall = reportData.overall || {};
    metricTotalRequests.textContent = nFmt.format(overall.total_requests || 0);
    metricDeniedTotal.textContent = `${nFmt.format(overall.denied_total || 0)} (${pFmt.format(overall.denied_rate || 0)})`;
    metricRestrictedTotal.textContent = `${nFmt.format(overall.restricted_total || 0)} (${pFmt.format(overall.restricted_rate || 0)})`;
    metricPersonalTotal.textContent = `${nFmt.format(overall.personal_restricted_total || 0)} (${pFmt.format(overall.personal_share_in_restricted || 0)})`;
  }

  function renderHeaderMeta() {
    const years = (((metadata || {}).years_covered) || ((reportData.source || {}).years_covered) || []);
    const minYear = years.length ? Math.min(...years) : '--';
    const maxYear = years.length ? Math.max(...years) : '--';
    yearsPill.textContent = `anos: ${minYear}-${maxYear}`;
    updatedLine.textContent = `Atualizado em ${formatDateTime((metadata || {}).updated_at || reportData.generated_at)} (America/Cuiaba)`;
  }

  function renderNarrative() {
    const series = reportData.series || [];
    const topReasons = reportData.top_reasons || [];
    const topOrgs = reportData.org_top5_plus_pf || [];

    if (!series.length) {
      narrativeList.innerHTML = '<li>Sem dados para exibir.</li>';
      return;
    }

    const first = series[0];
    const last = series[series.length - 1];
    const peakDenied = [...series].sort((a, b) => b.denied_total - a.denied_total)[0];
    const peakRestricted = [...series].sort((a, b) => b.restricted_rate - a.restricted_rate)[0];
    const mainReason = topReasons[0] || { reason: 'Sem informação', count: 0 };
    const topOrg = topOrgs[0] || { org: 'Sem informação', denied_total: 0 };

    const items = [
      `No período analisado (${first.year} a ${last.year}), a base registra <strong>${nFmt.format(reportData.overall.total_requests || 0)}</strong> pedidos, dos quais <strong>${nFmt.format(reportData.overall.denied_total || 0)}</strong> foram negados totalmente e <strong>${nFmt.format(reportData.overall.restricted_total || 0)}</strong> tiveram algum tipo de restrição.`,
      `O ano com mais negativas totais foi <strong>${peakDenied.year}</strong>, com <strong>${nFmt.format(peakDenied.denied_total)}</strong> casos. Já a maior taxa de restrição apareceu em <strong>${peakRestricted.year}</strong> (<strong>${pFmt.format(peakRestricted.restricted_rate)}</strong>).`,
      `O motivo mais comum entre as restrições é <strong>${esc(mainReason.reason)}</strong>, com <strong>${nFmt.format(mainReason.count || 0)}</strong> ocorrências na série histórica.`,
      `Entre os órgãos, o que mais concentra negativas no período é <strong>${esc(topOrg.org)}</strong> (<strong>${nFmt.format(topOrg.denied_total || 0)}</strong> negativas).`,
      `No recorte de informação pessoal, há <strong>${nFmt.format(reportData.overall.personal_restricted_total || 0)}</strong> negativas/restrições ligadas a esse tema, o que representa <strong>${pFmt.format(reportData.overall.personal_share_in_restricted || 0)}</strong> das restrições totais.`,
    ];

    narrativeList.innerHTML = items.map((text) => `<li>${text}</li>`).join('');
  }

  function renderCharts() {
    destroyCharts();

    const series = reportData.series || [];
    const years = series.map((row) => String(row.year));

    const palette = ['#2f6f9f', '#3f8f6d', '#8d5f2c', '#7a4f9e', '#b36f18', '#5a7a2d', '#a04747', '#65758f'];

    const chartYearlyVolume = new Chart(document.getElementById('chart-yearly-volume'), {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          {
            type: 'line',
            label: 'Pedidos',
            data: series.map((row) => row.total_requests),
            borderColor: '#2f6f9f',
            backgroundColor: 'rgba(47,111,159,0.18)',
            yAxisID: 'y',
            tension: 0.25,
            pointRadius: 2,
          },
          {
            type: 'bar',
            label: 'Negados',
            data: series.map((row) => row.denied_total),
            backgroundColor: 'rgba(182,66,66,0.85)',
            borderRadius: 6,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { position: 'left', beginAtZero: true, ticks: { callback: (v) => nFmt.format(v) } },
          y1: { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { callback: (v) => nFmt.format(v) } },
        },
      },
    });
    pushChart(chartYearlyVolume);

    const chartYearlyRate = new Chart(document.getElementById('chart-yearly-rate'), {
      type: 'line',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Taxa de negado total',
            data: series.map((row) => row.denied_rate * 100),
            borderColor: '#b64242',
            backgroundColor: 'rgba(182,66,66,0.12)',
            tension: 0.25,
            fill: true,
          },
          {
            label: 'Taxa com restrição (negado + parcial)',
            data: series.map((row) => row.restricted_rate * 100),
            borderColor: '#3f8f6d',
            backgroundColor: 'rgba(63,143,109,0.12)',
            tension: 0.25,
            fill: true,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => `${v.toFixed(1)}%` },
          },
        },
      },
    });
    pushChart(chartYearlyRate);

    const reasonLabels = [];
    const topReasonsRaw = (reportData.top_reasons || []).map((row) => row.reason);
    for (const reason of topReasonsRaw) {
      if (reasonLabels.length >= 6) break;
      if (!reasonLabels.includes(reason)) reasonLabels.push(reason);
    }
    if (!reasonLabels.includes('Dados pessoais')) reasonLabels.push('Dados pessoais');
    if (!reasonLabels.includes('Outros motivos')) reasonLabels.push('Outros motivos');

    const reasonMapByYear = new Map();
    for (const row of (reportData.reason_series || [])) {
      const key = String(row.year);
      if (!reasonMapByYear.has(key)) reasonMapByYear.set(key, {});
      reasonMapByYear.get(key)[row.reason] = row.count;
    }

    const reasonDatasets = reasonLabels.map((reason, idx) => ({
      label: reason,
      data: years.map((year) => {
        const yearMap = reasonMapByYear.get(String(year)) || {};
        return yearMap[reason] || 0;
      }),
      backgroundColor: `${palette[idx % palette.length]}cc`,
      borderColor: palette[idx % palette.length],
      borderWidth: 1,
      stack: 'motivos',
    }));

    const chartReasons = new Chart(document.getElementById('chart-reasons'), {
      type: 'bar',
      data: {
        labels: years,
        datasets: reasonDatasets,
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, ticks: { callback: (v) => nFmt.format(v) } },
        },
      },
    });
    pushChart(chartReasons);

    const topOrg = reportData.org_top5_plus_pf || [];
    const chartOrgTop = new Chart(document.getElementById('chart-org-top'), {
      type: 'bar',
      data: {
        labels: topOrg.map((row) => shortOrgName(row.org)),
        datasets: [
          {
            type: 'bar',
            label: 'Negados (qtde)',
            data: topOrg.map((row) => row.denied_total),
            backgroundColor: 'rgba(47,111,159,0.85)',
            borderRadius: 6,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'Taxa de negado',
            data: topOrg.map((row) => row.denied_rate * 100),
            borderColor: '#b64242',
            backgroundColor: 'rgba(182,66,66,0.15)',
            yAxisID: 'y1',
            tension: 0.22,
            pointRadius: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => nFmt.format(v) } },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { callback: (v) => `${v.toFixed(1)}%` },
          },
        },
      },
    });
    pushChart(chartOrgTop);

    const lowOrg = (reportData.org_lowest_denial_high_volume || []).slice(0, 8);
    const chartOrgLow = new Chart(document.getElementById('chart-org-low'), {
      type: 'bar',
      data: {
        labels: lowOrg.map((row) => shortOrgName(row.org)),
        datasets: [
          {
            label: 'Taxa de negado',
            data: lowOrg.map((row) => row.denied_rate * 100),
            backgroundColor: 'rgba(63,143,109,0.88)',
            borderRadius: 6,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { callback: (v) => `${v.toFixed(1)}%` } },
        },
      },
    });
    pushChart(chartOrgLow);

    const personalSeries = (reportData.personal_info || {}).series || [];
    const chartPersonal = new Chart(document.getElementById('chart-personal'), {
      type: 'line',
      data: {
        labels: personalSeries.map((row) => String(row.year)),
        datasets: [
          {
            label: 'Qtde de negativas/restrições por informação pessoal',
            data: personalSeries.map((row) => row.count),
            borderColor: '#8d5f2c',
            backgroundColor: 'rgba(141,95,44,0.16)',
            yAxisID: 'y',
            tension: 0.22,
            fill: true,
          },
          {
            label: '% pessoal dentro das restrições',
            data: personalSeries.map((row) => row.share_in_restricted * 100),
            borderColor: '#2f6f9f',
            backgroundColor: 'rgba(47,111,159,0.12)',
            yAxisID: 'y1',
            tension: 0.22,
            fill: true,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => nFmt.format(v) } },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { callback: (v) => `${v.toFixed(1)}%` },
          },
        },
      },
    });
    pushChart(chartPersonal);
  }

  function renderTables() {
    tableYearly.innerHTML = (reportData.series || []).map((row) => `
      <tr>
        <td>${row.year}</td>
        <td>${nFmt.format(row.total_requests)}</td>
        <td>${nFmt.format(row.denied_total)}</td>
        <td>${nFmt.format(row.restricted_total)}</td>
        <td>${pFmt.format(row.denied_rate)}</td>
        <td>${pFmt.format(row.restricted_rate)}</td>
        <td>${nFmt.format(row.personal_restricted_total)}</td>
        <td>${pFmt.format(row.personal_share_in_restricted)}</td>
      </tr>
    `).join('');

    const totalRestricted = Number((reportData.overall || {}).restricted_total || 0);
    tableReasons.innerHTML = (reportData.top_reasons || []).slice(0, 15).map((row) => `
      <tr>
        <td>${esc(row.reason)}</td>
        <td>${nFmt.format(row.count || 0)}</td>
        <td>${totalRestricted ? pFmt.format((row.count || 0) / totalRestricted) : '--'}</td>
      </tr>
    `).join('');

    tableOrgTop.innerHTML = (reportData.org_top5_plus_pf || []).map((row) => `
      <tr>
        <td>${esc(row.org)}</td>
        <td>${nFmt.format(row.total_requests)}</td>
        <td>${nFmt.format(row.denied_total)}</td>
        <td>${nFmt.format(row.restricted_total)}</td>
        <td>${pFmt.format(row.denied_rate)}</td>
        <td>${pFmt.format(row.restricted_rate)}</td>
      </tr>
    `).join('');

    tablePersonalTop.innerHTML = (((reportData.personal_info || {}).top_orgs) || []).slice(0, 15).map((row) => `
      <tr>
        <td>${esc(row.org)}</td>
        <td>${nFmt.format(row.personal_restricted_total || 0)}</td>
        <td>${nFmt.format(row.restricted_total || 0)}</td>
        <td>${pFmt.format(row.share_in_org_restricted || 0)}</td>
      </tr>
    `).join('');
  }

  function renderOrgCards() {
    const selected = reportData.org_top5_plus_pf || [];
    const profiles = reportData.org_profiles || {};

    orgCards.innerHTML = selected.map((row) => {
      const profile = profiles[row.org] || null;
      const topSubjects = (profile && profile.top_subjects ? profile.top_subjects : []).slice(0, 4);

      const subjectsHtml = topSubjects.length
        ? `<div class="table-wrap"><table><thead><tr><th>Tema mais pedido</th><th>Qtde</th><th>Restrição</th><th>Resposta mais comum</th></tr></thead><tbody>${topSubjects.map((item) => {
          const topDecision = (item.top_decisions || [])[0] || { decision: 'Sem padrão claro' };
          return `<tr><td>${esc(item.subject)}</td><td>${nFmt.format(item.total_requests)}</td><td>${pFmt.format(item.restricted_rate || 0)}</td><td>${esc(topDecision.decision || 'Sem padrão claro')}</td></tr>`;
        }).join('')}</tbody></table></div>`
        : '<p class="org-note">Sem temas suficientes para este órgão no recorte atual.</p>';

      const tags = [
        `<span class="mini-tag">Pedidos: ${nFmt.format(row.total_requests)}</span>`,
        `<span class="mini-tag">Negados: ${nFmt.format(row.denied_total)}</span>`,
        `<span class="mini-tag">Taxa negado: ${pFmt.format(row.denied_rate)}</span>`,
      ].join('');

      return `
        <article class="org-card">
          <div class="org-head">
            <div class="org-name">${esc(row.org)}</div>
            <div class="org-tags">${tags}</div>
          </div>
          <p class="org-note">Leitura simples: estes são os assuntos mais frequentes enviados pelos cidadãos para este órgão e qual decisão aparece mais vezes em cada assunto.</p>
          ${subjectsHtml}
        </article>
      `;
    }).join('');
  }

  function saveGeminiKey() {
    localStorage.setItem(GEMINI_STORAGE_KEY, geminiKeyInput.value.trim());
  }

  function restoreGeminiKey() {
    const saved = localStorage.getItem(GEMINI_STORAGE_KEY);
    if (saved) geminiKeyInput.value = saved;
  }

  function formatAiPlain(text) {
    return esc((text || '').toString()).replace(/\n/g, '<br>');
  }

  function renderInlineMarkdown(raw) {
    let text = esc((raw || '').toString());
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    return text;
  }

  function renderAiMarkdown(text) {
    const blocks = (text || '').toString().split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    return blocks.map((block) => {
      const lines = block.split('\n');
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        const items = lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
        const items = lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('');
        return `<ol>${items}</ol>`;
      }
      return `<p>${renderInlineMarkdown(block).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }

  function renderAiChat() {
    if (!aiMessages.length) {
      aiChat.innerHTML = `<article class="ai-msg"><span class="role">analista ia</span><div class="txt"><p>Pronto. Descreva seu caso e eu ajudo a entender a negativa e a melhorar o pedido.</p></div></article>`;
      return;
    }
    aiChat.innerHTML = aiMessages.map((msg) => {
      const roleClass = msg.role === 'user' ? 'user' : 'assistant';
      const roleLabel = msg.role === 'user' ? 'você' : 'analista ia';
      const body = msg.role === 'user' ? formatAiPlain(msg.text) : renderAiMarkdown(msg.text);
      return `<article class="ai-msg ${roleClass}"><span class="role">${roleLabel}</span><div class="txt">${body}</div></article>`;
    }).join('');
    aiChat.scrollTop = aiChat.scrollHeight;
  }

  function pushAiMessage(role, text) {
    aiMessages.push({ role, text: (text || '').toString() });
    renderAiChat();
    return aiMessages.length - 1;
  }

  function updateAiMessage(index, text) {
    if (!Number.isInteger(index) || !aiMessages[index]) return;
    aiMessages[index].text = (text || '').toString();
    renderAiChat();
  }

  function resetAiConversation(message) {
    aiHistory = [];
    aiMessages = [];
    if (message) aiMessages.push({ role: 'assistant', text: message });
    aiContextStamp = '';
    renderAiChat();
  }

  function populateAiFilters() {
    const years = (reportData.series || []).map((row) => row.year);
    aiYearFilter.innerHTML = `<option value="">Contexto: todos os anos</option>${years.map((year) => `<option value="${year}">Contexto: ano ${year}</option>`).join('')}`;

    const orgs = (reportData.org_top5_plus_pf || []).map((row) => row.org);
    aiOrgFilter.innerHTML = `<option value="">Sem foco em órgão</option>${orgs.map((org) => `<option value="${esc(org)}">Foco em ${esc(shortOrgName(org))}</option>`).join('')}`;
  }

  function computeAiContextStamp() {
    return JSON.stringify({
      year: aiYearFilter.value || '',
      org: aiOrgFilter.value || '',
      updated: (metadata || {}).updated_at || reportData.generated_at || '',
    });
  }

  function maybeResetHistoryOnContextChange() {
    const stamp = computeAiContextStamp();
    if (aiContextStamp && aiContextStamp !== stamp) {
      aiHistory = [];
      pushAiMessage('assistant', 'Contexto do chat atualizado. A conversa vai seguir apenas com o novo recorte.');
    }
    aiContextStamp = stamp;
  }

  function buildAiContextPayload() {
    const selectedYear = aiYearFilter.value ? Number(aiYearFilter.value) : null;
    const selectedOrg = aiOrgFilter.value || null;

    const yearSeries = reportData.series || [];
    const yearData = selectedYear
      ? yearSeries.find((row) => Number(row.year) === selectedYear) || null
      : null;

    const orgProfile = selectedOrg
      ? ((reportData.org_profiles || {})[selectedOrg] || null)
      : null;

    return {
      pagina: 'LAI Dashboard',
      atualizado_em: (metadata || {}).updated_at || reportData.generated_at || '',
      fonte: (reportData.source || {}).portal_url || '',
      foco_ano: yearData,
      foco_orgao: orgProfile,
      geral: reportData.overall || {},
      serie: yearSeries,
      top_motivos: (reportData.top_reasons || []).slice(0, 12),
      top_orgaos_negativas: (reportData.org_top5_plus_pf || []).slice(0, 8),
      orgaos_pessoal: (((reportData.personal_info || {}).top_orgs) || []).slice(0, 10),
      precedentes_url: 'https://www.gov.br/cgu/pt-br/acesso-a-informacao/dados-abertos/arquivos/busca-de-precedentes',
    };
  }

  function buildSystemPrompt() {
    return [
      'Você é um analista em transparência pública e Lei de Acesso à Informação (LAI) no Brasil.',
      'Responda sempre em português brasileiro, sem jargão e em linguagem simples.',
      'Objetivo do chat: ajudar o usuário a entender por que pedidos são negados e como aumentar a chance de atendimento.',
      'Sempre que possível, entregue em 4 partes curtas: 1) leitura do caso, 2) motivo provável da negativa, 3) como argumentar no recurso, 4) exemplo de texto de pedido/recurso.',
      'Use o contexto JSON enviado. Não invente números nem fatos fora do contexto.',
      'Quando faltar base suficiente, diga explicitamente: "sem evidência suficiente na base desta página".',
      'Quando falar de precedentes, conecte à ideia de precedentes da CGU/CMRI e recomende checagem no link informado no contexto.',
      'Se o usuário pedir orientação prática, inclua checklist simples: o que pedir, para qual órgão, qual período, qual formato, e por que isso é informação pública.',
      'Não dê aconselhamento jurídico definitivo; mantenha tom informativo e prático.',
    ].join('\n');
  }

  function extractGeminiAnswer(data) {
    return (data.candidates || [])
      .flatMap((candidate) => (((candidate || {}).content || {}).parts || []))
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
  }

  function extractGeminiFinishReason(data) {
    return ((data.candidates || [])[0] || {}).finishReason || '';
  }

  async function callGemini(apiKey, contents, systemPrompt) {
    const resp = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'text/plain',
        },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || `HTTP ${resp.status}`);
    }
    return data;
  }

  async function askGemini() {
    aiStatus.textContent = '';

    const apiKey = geminiKeyInput.value.trim();
    const question = aiQuestion.value.trim();

    if (!apiKey) {
      pushAiMessage('assistant', 'Cole sua Gemini API key para usar o chat.');
      return;
    }

    if (!question) {
      pushAiMessage('assistant', 'Escreva uma pergunta primeiro.');
      return;
    }

    saveGeminiKey();
    maybeResetHistoryOnContextChange();

    aiAskBtn.disabled = true;
    aiQuestion.value = '';

    const cleanedQuestion = question.replace(/\s+/g, ' ').trim();
    pushAiMessage('user', cleanedQuestion);
    const pendingIndex = pushAiMessage('assistant', 'Analisando seu caso com base nos dados da página...');

    const contextPayload = buildAiContextPayload();
    const systemPrompt = buildSystemPrompt();
    const contextText = `CONTEXTO_JSON_DASHBOARD:\n${JSON.stringify(contextPayload)}`;

    try {
      const conversation = [
        { role: 'user', parts: [{ text: contextText }] },
        ...aiHistory,
        { role: 'user', parts: [{ text: cleanedQuestion }] },
      ];

      const chunks = [];
      let finishReason = '';

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await callGemini(apiKey, conversation, systemPrompt);
        const piece = extractGeminiAnswer(response);
        finishReason = extractGeminiFinishReason(response);

        if (piece) {
          chunks.push(piece);
          conversation.push({ role: 'model', parts: [{ text: piece }] });
          updateAiMessage(pendingIndex, `${chunks.join('\n\n')}\n\n${finishReason === 'MAX_TOKENS' ? '[continuando...]' : ''}`);
        }

        if (finishReason !== 'MAX_TOKENS') break;
        conversation.push({ role: 'user', parts: [{ text: GEMINI_CONTINUE_PROMPT }] });
      }

      let answer = chunks.join('\n\n').trim();
      if (!answer) answer = 'Sem evidência suficiente na base desta página para responder com segurança.';
      if (finishReason === 'MAX_TOKENS') answer += '\n\n[resposta cortada por limite de tokens]';

      updateAiMessage(pendingIndex, answer);

      aiHistory.push({ role: 'user', parts: [{ text: cleanedQuestion }] });
      aiHistory.push({ role: 'model', parts: [{ text: answer }] });
      if (aiHistory.length > 16) aiHistory = aiHistory.slice(-16);
    } catch (error) {
      updateAiMessage(pendingIndex, `Falha ao consultar Gemini: ${error.message}`);
      aiStatus.textContent = `Erro no Gemini: ${error.message}`;
    } finally {
      aiAskBtn.disabled = false;
      aiQuestion.focus();
    }
  }

  async function boot() {
    try {
      [reportData, metadata] = await Promise.all([
        fetchJson(DATA_FILE),
        fetchJson(METADATA_FILE).catch(() => null),
      ]);
    } catch (error) {
      narrativeList.innerHTML = `<li class="error">Falha ao carregar os dados: ${esc(error.message)}</li>`;
      return;
    }

    renderHeaderMeta();
    renderMetrics();
    renderNarrative();
    renderCharts();
    renderTables();
    renderOrgCards();

    restoreGeminiKey();
    populateAiFilters();
    resetAiConversation('Pronto. Conte seu caso e eu te ajudo a entender a negativa e como melhorar o pedido.');
  }

  aiAskBtn.addEventListener('click', askGemini);

  aiQuestion.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      askGemini();
    }
  });

  aiResetBtn.addEventListener('click', () => {
    resetAiConversation('Nova conversa iniciada. Pode mandar seu caso.');
  });

  aiYearFilter.addEventListener('change', maybeResetHistoryOnContextChange);
  aiOrgFilter.addEventListener('change', maybeResetHistoryOnContextChange);

  boot();
})();
