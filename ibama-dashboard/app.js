    const queryInput = document.getElementById('query');
    const ufFilter = document.getElementById('uf-filter');
    const btnSearch = document.getElementById('btn-search');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const btnExportCsv2 = document.getElementById('btn-export-csv-2');
    const btnOpenSheets = document.getElementById('btn-open-sheets');
    const tabIbama = document.getElementById('tab-ibama');
    const tabIcmbio = document.getElementById('tab-icmbio');
    const datasetSummary = document.getElementById('dataset-summary');
    const googleClientIdInput = document.getElementById('google-client-id');
    const sheetsStatus = document.getElementById('sheets-status');

    const metricLoadedNow = document.getElementById('metric-loaded-now');
    const metricRange = document.getElementById('metric-range');
    const metricBaseFines = document.getElementById('metric-base-fines');
    const metricFilteredFines = document.getElementById('metric-filtered-fines');
    const statusLine = document.getElementById('status-line');
    const updatedBadge = document.getElementById('updated-badge');

    const storyStepsEl = document.getElementById('story-steps');
    const mapTitle = document.getElementById('map-title');
    const mapDescription = document.getElementById('map-description');
    const resultsBody = document.getElementById('results-body');

    const geminiKeyInput = document.getElementById('gemini-key');
    const aiQuestion = document.getElementById('ai-question');
    const btnAskAi = document.getElementById('btn-ask-ai');
    const btnAiReset = document.getElementById('btn-ai-reset');
    const aiChat = document.getElementById('ai-chat');

    const numberFmt = new Intl.NumberFormat('pt-BR');
    const moneyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    let baseStats = null;
    let currentSearchData = null;
    let searchDataByDataset = { ibama: null, icmbio: null };
    let activeDataset = 'ibama';
    let map = null;
    let mapLayer = null;
    let stepObserver = null;

    const GEMINI_STORAGE_KEY = 'ibama_gemini_key';
    const GOOGLE_CLIENT_ID_STORAGE_KEY = 'ibama_google_client_id';
    const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/drive.file';
    const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const GEMINI_CONTINUE_PROMPT = 'Continue exatamente de onde parou, sem repetir o que ja escreveu.';
    const AI_HISTORY_MAX_ITEMS = 16;
    const AI_WELCOME_MESSAGE = 'Pronto. Pergunte sobre os dados filtrados e eu vou responder direto ao ponto.';
    const DATA_METADATA_FILE = './data/metadata.json';
    const DATA_FILES = {
      ibama: './data/ibama_records.jsonl.gz',
      icmbio: './data/icmbio_records.jsonl.gz',
    };
    const SEARCH_LIMIT = 120;
    const MAP_LIMIT = 1400;
    const EXPORT_MAX_ROWS = 300000;

    let googleAccessToken = '';
    let googleTokenExpiresAt = 0;
    let aiConversationHistory = [];
    let aiChatMessages = [];
    let aiLastContextStamp = '';
    let dashboardMetadata = null;
    const recordsCache = { ibama: null, icmbio: null };

    function esc(text) {
      return (text || '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function formatDate(isoDate) {
      if (!isoDate) return '-';
      const d = new Date(`${isoDate}T00:00:00`);
      if (Number.isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('pt-BR');
    }

    function formatDateTime(isoDateTime) {
      if (!isoDateTime) return '-';
      const d = new Date(isoDateTime);
      if (Number.isNaN(d.getTime())) return '-';
      return d.toLocaleString('pt-BR');
    }

    async function fetchJson(url) {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) {
        const bodyText = await resp.text();
        throw new Error(`HTTP ${resp.status} - ${bodyText.slice(0, 120)}`);
      }
      return resp.json();
    }

    function initMap() {
      if (map) return;
      map = L.map('story-map', { preferCanvas: true, zoomControl: true }).setView([-14.2, -51.9], 4);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap &copy; CARTO'
      }).addTo(map);
      mapLayer = L.layerGroup().addTo(map);
    }

    function normalizeText(value) {
      return (value || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    }

    function parseSearchParams() {
      const q = normalizeText(queryInput.value.trim());
      const uf = normalizeText(ufFilter.value.trim());
      const tokens = q ? q.split(' ').filter(Boolean) : [];
      return { q, tokens, uf };
    }

    function setBaseStats(stats) {
      baseStats = stats;
      metricBaseFines.textContent = moneyFmt.format(stats.total_multas || 0);
      updatedBadge.textContent = `base: ${formatDateTime(stats.atualizado_em)}`;

      if (Array.isArray(stats.ufs) && stats.ufs.length > 0) {
        const already = new Set([...ufFilter.options].map((opt) => opt.value));
        stats.ufs.forEach((uf) => {
          if (already.has(uf)) return;
          const opt = document.createElement('option');
          opt.value = uf;
          opt.textContent = uf.toUpperCase();
          ufFilter.appendChild(opt);
        });
      }
    }

    function getDatasetLabel(dataset) {
      return dataset === 'icmbio' ? 'ICMBio' : 'IBAMA';
    }

    function updateDatasetTabs() {
      const ibamaTotal = (searchDataByDataset.ibama || {}).total_match || 0;
      const icmbioTotal = (searchDataByDataset.icmbio || {}).total_match || 0;
      tabIbama.textContent = `IBAMA (${numberFmt.format(ibamaTotal)})`;
      tabIcmbio.textContent = `ICMBio (${numberFmt.format(icmbioTotal)})`;
      tabIbama.classList.toggle('active', activeDataset === 'ibama');
      tabIcmbio.classList.toggle('active', activeDataset === 'icmbio');
      datasetSummary.textContent = `Busca dividida: IBAMA ${numberFmt.format(ibamaTotal)} registros, ICMBio ${numberFmt.format(icmbioTotal)} registros.`;
    }

    function getDatasetMeta(dataset) {
      return (((dashboardMetadata || {}).datasets || {})[dataset]) || {};
    }

    function buildStatsFromMetadata() {
      const ibamaMeta = getDatasetMeta('ibama');
      const icmbioMeta = getDatasetMeta('icmbio');
      const allUfs = [...new Set([...(ibamaMeta.ufs || []), ...(icmbioMeta.ufs || [])])].sort();
      return {
        total_multas: Number(ibamaMeta.total_fines || 0) + Number(icmbioMeta.total_fines || 0),
        atualizado_em: (dashboardMetadata || {}).updated_at || '',
        ufs: allUfs,
      };
    }

    function parseDatasetRecord(raw) {
      const value = Number(raw.v || 0);
      return {
        seq_auto_infracao: (raw.i || '').toString(),
        nome_infrator: (raw.n || '').toString(),
        des_auto_infracao: (raw.d || '').toString(),
        municipio: (raw.m || '').toString(),
        uf: (raw.u || '').toString(),
        valor_multa: Number.isFinite(value) ? value : 0,
        data_evento: (raw.dt || '').toString(),
        num_processo: (raw.p || '').toString(),
        cpf_cnpj_infrator: (raw.cp || '').toString(),
        num_latitude_auto: Number.isFinite(Number(raw.lat)) ? Number(raw.lat) : null,
        num_longitude_auto: Number.isFinite(Number(raw.lon)) ? Number(raw.lon) : null,
      };
    }

    async function fetchGzipText(url) {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ao carregar ${url}`);
      }
      const gzBuffer = await resp.arrayBuffer();
      if ('DecompressionStream' in window) {
        const stream = new Blob([gzBuffer]).stream().pipeThrough(new DecompressionStream('gzip'));
        return new Response(stream).text();
      }
      const pako = await import('https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm');
      const unzipped = pako.ungzip(new Uint8Array(gzBuffer), { to: 'string' });
      return unzipped;
    }

    async function ensureDatasetLoaded(dataset) {
      if (recordsCache[dataset]) {
        return recordsCache[dataset];
      }
      const filePath = DATA_FILES[dataset];
      if (!filePath) {
        throw new Error(`Dataset invalido: ${dataset}`);
      }

      const rawText = await fetchGzipText(filePath);
      const lines = rawText.split('\n');
      const rows = [];
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          const record = parseDatasetRecord(parsed);
          record.search_blob = `${record.nome_infrator} ${record.des_auto_infracao} ${record.municipio} ${record.uf} ${record.num_processo} ${record.cpf_cnpj_infrator}`.trim();
          rows.push(record);
        } catch (error) {
          // Ignore malformed line instead of aborting whole dataset load.
          continue;
        }
      }
      recordsCache[dataset] = rows;
      return rows;
    }

    function upsertTopRow(topRows, row, limit) {
      topRows.push(row);
      if (topRows.length > limit * 2) {
        topRows.sort((a, b) => {
          const valueDiff = (b.valor_multa || 0) - (a.valor_multa || 0);
          if (valueDiff !== 0) return valueDiff;
          return String(b.data_evento || '').localeCompare(String(a.data_evento || ''));
        });
        topRows.length = limit;
      }
    }

    async function localSearchDataset(dataset) {
      const records = await ensureDatasetLoaded(dataset);
      const { tokens, uf } = parseSearchParams();
      const meta = getDatasetMeta(dataset);

      const matchedIndices = [];
      const topResults = [];
      const topMapPoints = [];
      const statesMap = new Map();
      const offendersMap = new Map();
      const timelineMap = new Map();

      let totalMatch = 0;
      let totalMultas = 0;
      let maiorMulta = 0;
      let menorMulta = 0;
      let hasPositiveFine = false;
      let dateMin = '';
      let dateMax = '';

      for (let i = 0; i < records.length; i += 1) {
        const row = records[i];

        if (uf && row.uf !== uf) continue;
        if (tokens.length && !tokens.every((token) => row.search_blob.includes(token))) continue;

        totalMatch += 1;
        if (matchedIndices.length < EXPORT_MAX_ROWS) {
          matchedIndices.push(i);
        }

        const fine = Number(row.valor_multa || 0);
        totalMultas += fine;
        if (fine > maiorMulta) maiorMulta = fine;
        if (fine > 0) {
          if (!hasPositiveFine || fine < menorMulta) {
            menorMulta = fine;
          }
          hasPositiveFine = true;
        }

        if (row.data_evento) {
          if (!dateMin || row.data_evento < dateMin) dateMin = row.data_evento;
          if (!dateMax || row.data_evento > dateMax) dateMax = row.data_evento;
          const year = row.data_evento.slice(0, 4);
          if (/^\d{4}$/.test(year)) {
            const existingYear = timelineMap.get(year) || { ano: year, quantidade: 0, total_multas: 0 };
            existingYear.quantidade += 1;
            existingYear.total_multas += fine;
            timelineMap.set(year, existingYear);
          }
        }

        if (row.uf) {
          const stateRow = statesMap.get(row.uf) || { uf: row.uf, quantidade: 0, total_multas: 0 };
          stateRow.quantidade += 1;
          stateRow.total_multas += fine;
          statesMap.set(row.uf, stateRow);
        }

        if (row.nome_infrator) {
          const offenderRow = offendersMap.get(row.nome_infrator) || { nome_infrator: row.nome_infrator, quantidade: 0, total_multas: 0 };
          offenderRow.quantidade += 1;
          offenderRow.total_multas += fine;
          offendersMap.set(row.nome_infrator, offenderRow);
        }

        upsertTopRow(topResults, row, SEARCH_LIMIT);
        if (Number.isFinite(row.num_latitude_auto) && Number.isFinite(row.num_longitude_auto)) {
          upsertTopRow(topMapPoints, row, MAP_LIMIT);
        }
      }

      topResults.sort((a, b) => {
        const valueDiff = (b.valor_multa || 0) - (a.valor_multa || 0);
        if (valueDiff !== 0) return valueDiff;
        return String(b.data_evento || '').localeCompare(String(a.data_evento || ''));
      });

      topMapPoints.sort((a, b) => (b.valor_multa || 0) - (a.valor_multa || 0));

      const topStates = [...statesMap.values()]
        .sort((a, b) => (b.quantidade - a.quantidade) || (b.total_multas - a.total_multas))
        .slice(0, 10);
      const topOffenders = [...offendersMap.values()]
        .sort((a, b) => (b.total_multas - a.total_multas) || (b.quantidade - a.quantidade))
        .slice(0, 10);
      const timeline = [...timelineMap.values()]
        .sort((a, b) => a.ano.localeCompare(b.ano));

      return {
        dataset,
        total_match: totalMatch,
        matched_indices: matchedIndices,
        export_limited: totalMatch > matchedIndices.length,
        datas_futuras_ignoradas: Number(meta.future_dates_ignored || 0),
        summary: {
          total_multas: totalMultas,
          media_multa: totalMatch > 0 ? totalMultas / totalMatch : 0,
          maior_multa: maiorMulta,
          menor_multa: hasPositiveFine ? menorMulta : 0,
          data_inicial: dateMin || '',
          data_final: dateMax || '',
        },
        top_states: topStates,
        top_offenders: topOffenders,
        timeline,
        map_points: topMapPoints.slice(0, MAP_LIMIT),
        results: topResults.slice(0, SEARCH_LIMIT),
      };
    }

    function renderActiveDataset() {
      currentSearchData = searchDataByDataset[activeDataset];
      if (!currentSearchData) {
        storyStepsEl.innerHTML = `<article class="story-step active"><h3>Sem dados</h3><p class="empty">Ainda nao ha resultado para ${esc(getDatasetLabel(activeDataset))}.</p></article>`;
        resultsBody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum dado para ${esc(getDatasetLabel(activeDataset))}.</td></tr>`;
        return;
      }

      const summary = currentSearchData.summary || {};
      metricLoadedNow.textContent = `${numberFmt.format(currentSearchData.total_match || 0)} (${getDatasetLabel(activeDataset)})`;
      metricFilteredFines.textContent = moneyFmt.format(summary.total_multas || 0);
      metricRange.textContent = `${formatDate(summary.data_inicial)} ate ${formatDate(summary.data_final)}`;
      syncAiContextStamp();

      renderResultTable(currentSearchData.results || []);
      renderStory(currentSearchData);
    }

    function setActiveDataset(dataset) {
      activeDataset = dataset === 'icmbio' ? 'icmbio' : 'ibama';
      updateDatasetTabs();
      renderActiveDataset();
    }

    function renderResultTable(rows) {
      resultsBody.innerHTML = '';
      if (!rows || rows.length === 0) {
        resultsBody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum resultado para este filtro.</td></tr>`;
        return;
      }

      const frag = document.createDocumentFragment();
      rows.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${esc(formatDate(row.data_evento))}</td>
          <td>${esc(row.nome_infrator || '-')}</td>
          <td>${esc(row.des_auto_infracao || '-')}</td>
          <td>${esc(row.municipio || '-')} / ${esc((row.uf || '-').toUpperCase())}</td>
          <td class="money">${moneyFmt.format(row.valor_multa || 0)}</td>
          <td class="mono">${esc(row.num_processo || '-')}</td>
        `;
        frag.appendChild(tr);
      });
      resultsBody.appendChild(frag);
    }

    function buildTopList(items, labelA, labelB, valueFormatter) {
      if (!items || items.length === 0) {
        return '<p class="empty">Sem dados suficientes para este bloco.</p>';
      }
      return `<ul>${items.slice(0, 6).map((item) => {
        return `<li><strong>${esc(item[labelA])}</strong> - ${esc(numberFmt.format(item[labelB]))} registros - ${esc(valueFormatter(item.total_multas || 0))}</li>`;
      }).join('')}</ul>`;
    }

    function buildTimelineSummary(timeline) {
      if (!timeline || timeline.length === 0) {
        return '<p class="empty">Sem datas validas nesta busca.</p>';
      }
      const topYear = timeline.reduce((best, current) => {
        if (!best) return current;
        return current.quantidade > best.quantidade ? current : best;
      }, null);
      const startYear = timeline[0].ano;
      const endYear = timeline[timeline.length - 1].ano;
      return `
        <p>Janela temporal observada: <strong>${esc(startYear)}</strong> a <strong>${esc(endYear)}</strong>.</p>
        <ul>
          <li>Ano com maior quantidade: <strong>${esc(topYear.ano)}</strong> (${esc(numberFmt.format(topYear.quantidade))} autos)</li>
          <li>Total financeiro no ano pico: <strong>${esc(moneyFmt.format(topYear.total_multas || 0))}</strong></li>
        </ul>
      `;
    }

    function buildStorySteps(data) {
      const summary = data.summary || {};
      const qText = queryInput.value.trim() ? `"${queryInput.value.trim()}"` : 'toda a base';
      const ufText = ufFilter.value ? ` na UF ${ufFilter.value.toUpperCase()}` : '';
      const pointsCount = (data.map_points || []).length;
      const datasetLabel = getDatasetLabel(data.dataset || activeDataset);

      const statesHtml = buildTopList(
        data.top_states || [],
        'uf',
        'quantidade',
        (val) => moneyFmt.format(val)
      );

      const offendersHtml = buildTopList(
        data.top_offenders || [],
        'nome_infrator',
        'quantidade',
        (val) => moneyFmt.format(val)
      );

      const timelineHtml = buildTimelineSummary(data.timeline || []);

      return [
        {
          id: 'overview',
          mode: 'all',
          title: `1) Panorama geral da busca (${datasetLabel})`,
          html: `
            <p>Busca aplicada para <strong>${esc(qText)}</strong>${esc(ufText)} resultou em <strong>${esc(numberFmt.format(data.total_match || 0))} autos</strong>.</p>
            <ul>
              <li>Total de multas nesta busca: <strong>${esc(moneyFmt.format(summary.total_multas || 0))}</strong></li>
              <li>Ticket medio: <strong>${esc(moneyFmt.format(summary.media_multa || 0))}</strong></li>
              <li>Maior multa encontrada: <strong>${esc(moneyFmt.format(summary.maior_multa || 0))}</strong></li>
            </ul>
          `,
          mapTitle: 'Mapa completo da busca',
          mapDescription: 'Pontos georreferenciados ordenados por valor da multa.'
        },
        {
          id: 'states',
          mode: 'top_states',
          title: '2) Estados mais impactados',
          html: statesHtml,
          mapTitle: 'Foco por UF lider',
          mapDescription: 'Neste passo o mapa destaca os pontos das UFs com maior concentracao de autos.'
        },
        {
          id: 'timeline',
          mode: 'peak_year',
          title: '3) Linha do tempo da busca',
          html: timelineHtml,
          mapTitle: 'Ano mais intenso da serie',
          mapDescription: 'Mostra somente os pontos do ano com maior quantidade de ocorrencias.'
        },
        {
          id: 'offenders',
          mode: 'top_offenders',
          title: '4) Autuados de maior recorrencia financeira',
          html: offendersHtml,
          mapTitle: 'Pontos dos autuados lideres',
          mapDescription: 'Mapa filtrado para os principais autuados por soma de multas.'
        },
        {
          id: 'hotspots',
          mode: 'largest',
          title: '5) Hotspots de alta multa',
          html: `
            <p>Foram encontrados <strong>${esc(numberFmt.format(pointsCount))}</strong> pontos com coordenadas validas para esta busca.</p>
            <ul>
              <li>Data inicial valida: <strong>${esc(formatDate(summary.data_inicial))}</strong></li>
              <li>Data final valida: <strong>${esc(formatDate(summary.data_final))}</strong></li>
              <li>Datas futuras ignoradas na base: <strong>${esc(numberFmt.format(data.datas_futuras_ignoradas || 0))}</strong></li>
            </ul>
          `,
          mapTitle: 'Maiores multas georreferenciadas',
          mapDescription: 'Visual orientado para os casos de maior valor, com bolhas proporcionalmente maiores.'
        },
      ];
    }

    function getPointsForMode(mode) {
      if (!currentSearchData) return [];
      const points = currentSearchData.map_points || [];
      if (points.length === 0) return [];

      if (mode === 'all') return points;

      if (mode === 'largest') return points.slice(0, 420);

      if (mode === 'top_states') {
        const topStates = (currentSearchData.top_states || []).slice(0, 3).map((s) => s.uf);
        return points.filter((p) => topStates.includes(p.uf));
      }

      if (mode === 'top_offenders') {
        const topNames = (currentSearchData.top_offenders || []).slice(0, 6).map((p) => p.nome_infrator);
        return points.filter((p) => topNames.includes(p.nome_infrator));
      }

      if (mode === 'peak_year') {
        const timeline = currentSearchData.timeline || [];
        if (!timeline.length) return [];
        const peakYear = timeline.reduce((best, current) => {
          if (!best) return current;
          return current.quantidade > best.quantidade ? current : best;
        }, null).ano;
        return points.filter((p) => (p.data_evento || '').startsWith(peakYear));
      }

      return points;
    }

    function drawMap(mode) {
      initMap();
      mapLayer.clearLayers();

      const points = getPointsForMode(mode);
      if (!points.length) {
        map.setView([-14.2, -51.9], 4);
        return;
      }

      const bounds = [];
      points.slice(0, 1500).forEach((p) => {
        const lat = Number(p.num_latitude_auto);
        const lng = Number(p.num_longitude_auto);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const value = Number(p.valor_multa || 0);
        const radius = Math.max(3.6, Math.min(16, Math.log10(value + 10) * 2.1));
        const marker = L.circleMarker([lat, lng], {
          radius,
          color: '#ffffff',
          weight: 0.6,
          opacity: 0.9,
          fillOpacity: 0.62,
          fillColor: mode === 'largest' ? '#d96e30' : (mode === 'top_states' ? '#3454d1' : '#1e7e6d')
        });

        const popup = `
          <strong>${esc(p.nome_infrator || '-')}</strong><br>
          ${esc(p.municipio || '-')} / ${esc((p.uf || '').toUpperCase())}<br>
          <em>${esc(formatDate(p.data_evento))}</em><br>
          <strong>${esc(moneyFmt.format(value))}</strong><br>
          <span>${esc((p.des_auto_infracao || '-').slice(0, 220))}</span>
        `;
        marker.bindPopup(popup);
        mapLayer.addLayer(marker);
        bounds.push([lat, lng]);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 8);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 9 });
      }
    }

    function activateStep(stepEl, stepData) {
      document.querySelectorAll('.story-step').forEach((el) => el.classList.remove('active'));
      stepEl.classList.add('active');
      mapTitle.textContent = stepData.mapTitle;
      mapDescription.textContent = stepData.mapDescription;
      drawMap(stepData.mode);
    }

    function renderStory(data) {
      const steps = buildStorySteps(data);
      storyStepsEl.innerHTML = '';

      const fragment = document.createDocumentFragment();
      steps.forEach((step, index) => {
        const article = document.createElement('article');
        article.className = 'story-step';
        article.dataset.stepIndex = String(index);
        article.innerHTML = `<h3>${esc(step.title)}</h3>${step.html}`;
        fragment.appendChild(article);
      });
      storyStepsEl.appendChild(fragment);

      if (stepObserver) {
        stepObserver.disconnect();
      }

      const allStepEls = [...storyStepsEl.querySelectorAll('.story-step')];
      stepObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = Number(entry.target.dataset.stepIndex || 0);
          activateStep(entry.target, steps[idx]);
        });
      }, { threshold: 0.58 });

      allStepEls.forEach((el) => stepObserver.observe(el));
      if (allStepEls[0]) {
        activateStep(allStepEls[0], steps[0]);
      }
    }

    function emptyDatasetPayload(dataset) {
      return {
        dataset,
        total_match: 0,
        datas_futuras_ignoradas: 0,
        summary: {
          total_multas: 0,
          media_multa: 0,
          maior_multa: 0,
          menor_multa: 0,
          data_inicial: '',
          data_final: '',
        },
        top_states: [],
        top_offenders: [],
        timeline: [],
        map_points: [],
        results: [],
        matched_indices: [],
        export_limited: false,
      };
    }

    async function runSearch() {
      btnSearch.disabled = true;
      statusLine.textContent = 'Buscando IBAMA + ICMBio nos dados locais otimizados...';

      try {
        const [ibamaResult, icmbioResult] = await Promise.allSettled([
          localSearchDataset('ibama'),
          localSearchDataset('icmbio'),
        ]);

        const ibamaData = ibamaResult.status === 'fulfilled' ? ibamaResult.value : emptyDatasetPayload('ibama');
        const icmbioData = icmbioResult.status === 'fulfilled' ? icmbioResult.value : emptyDatasetPayload('icmbio');

        searchDataByDataset = {
          ibama: ibamaData,
          icmbio: icmbioData,
        };

        const ibamaCount = ibamaData.total_match || 0;
        const icmbioCount = icmbioData.total_match || 0;
        const ibamaResultCount = (ibamaData.results || []).length;
        const icmbioResultCount = (icmbioData.results || []).length;
        const futures = (ibamaData.datas_futuras_ignoradas || 0) + (icmbioData.datas_futuras_ignoradas || 0);
        const warnings = [];
        if (ibamaResult.status === 'rejected') warnings.push('IBAMA indisponivel');
        if (icmbioResult.status === 'rejected') warnings.push('ICMBio indisponivel');

        const exportWarnings = [];
        if (ibamaData.export_limited) exportWarnings.push('IBAMA exporta ate 300k linhas por busca');
        if (icmbioData.export_limited) exportWarnings.push('ICMBio exporta ate 300k linhas por busca');
        statusLine.textContent = `IBAMA ${numberFmt.format(ibamaCount)} (amostra ${numberFmt.format(ibamaResultCount)}) | ICMBio ${numberFmt.format(icmbioCount)} (amostra ${numberFmt.format(icmbioResultCount)}). Datas futuras ignoradas: ${numberFmt.format(futures)}.${warnings.length ? ` Aviso: ${warnings.join(' / ')}.` : ''}${exportWarnings.length ? ` ${exportWarnings.join(' | ')}.` : ''}`;

        updateDatasetTabs();
        renderActiveDataset();
      } catch (error) {
        searchDataByDataset = { ibama: null, icmbio: null };
        currentSearchData = null;
        storyStepsEl.innerHTML = `<article class="story-step active"><h3>Erro de busca</h3><p class="empty">${esc(error.message)}</p></article>`;
        resultsBody.innerHTML = `<tr><td colspan="6" class="empty">Falha ao buscar dados: ${esc(error.message)}</td></tr>`;
        statusLine.textContent = 'Erro ao consultar a API de busca.';
        updateDatasetTabs();
      } finally {
        btnSearch.disabled = false;
      }
    }

    function csvEscape(value, delimiter) {
      const raw = (value ?? '').toString();
      if (raw.includes('"') || raw.includes('\n') || raw.includes('\r') || raw.includes(delimiter)) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    }

    async function fetchExportCsvBlob(options = {}) {
      const dataset = activeDataset;
      const result = searchDataByDataset[dataset];
      if (!result) {
        throw new Error('Execute a busca antes de exportar.');
      }
      const records = await ensureDatasetLoaded(dataset);
      const indices = (result.matched_indices || []).slice(0, EXPORT_MAX_ROWS);
      if (!indices.length) {
        throw new Error('Nenhum resultado para exportar.');
      }

      const delimiter = options.delimiter === 'comma' ? ',' : ';';
      const includeBom = options.bom !== false;
      const headers = ['data_evento', 'nome_infrator', 'des_auto_infracao', 'municipio', 'uf', 'valor_multa', 'num_processo', 'cpf_cnpj_infrator', 'num_latitude_auto', 'num_longitude_auto'];
      const lines = [headers.join(delimiter)];

      for (let i = 0; i < indices.length; i += 1) {
        const row = records[indices[i]];
        if (!row) continue;
        const values = [
          row.data_evento || '',
          row.nome_infrator || '',
          row.des_auto_infracao || '',
          row.municipio || '',
          row.uf || '',
          Number(row.valor_multa || 0).toFixed(2),
          row.num_processo || '',
          row.cpf_cnpj_infrator || '',
          Number.isFinite(row.num_latitude_auto) ? row.num_latitude_auto : '',
          Number.isFinite(row.num_longitude_auto) ? row.num_longitude_auto : '',
        ];
        lines.push(values.map((value) => csvEscape(value, delimiter)).join(delimiter));
      }

      const prefix = includeBom ? '\uFEFF' : '';
      return new Blob([prefix + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    }

    async function exportCsv() {
      try {
        const csvBlob = await fetchExportCsvBlob({ delimiter: 'semicolon', bom: true });
        const url = URL.createObjectURL(csvBlob);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[T:-]/g, '');
        const filename = `${activeDataset}_busca_${stamp}.csv`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (error) {
        setSheetsStatus(`Falha ao exportar CSV: ${error.message}`, true);
      }
    }

    function setSheetsStatus(message, isError = false) {
      sheetsStatus.textContent = message;
      sheetsStatus.classList.toggle('error', Boolean(isError));
    }

    function saveGoogleClientIdLocally() {
      localStorage.setItem(GOOGLE_CLIENT_ID_STORAGE_KEY, googleClientIdInput.value.trim());
    }

    function restoreGoogleClientId() {
      const cached = localStorage.getItem(GOOGLE_CLIENT_ID_STORAGE_KEY);
      if (cached) {
        googleClientIdInput.value = cached;
      }
    }

    async function getGoogleAccessToken() {
      const clientId = googleClientIdInput.value.trim();
      if (!clientId) {
        throw new Error('Informe o Google OAuth Client ID para exportacao direta.');
      }
      if (!(window.google && google.accounts && google.accounts.oauth2)) {
        throw new Error('Biblioteca Google Identity nao carregou. Recarregue a pagina.');
      }
      if (googleAccessToken && Date.now() < (googleTokenExpiresAt - 30000)) {
        return googleAccessToken;
      }

      return new Promise((resolve, reject) => {
        let settled = false;
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_SHEETS_SCOPE,
          callback: (tokenResponse) => {
            if (settled) return;
            settled = true;
            if (tokenResponse?.error) {
              reject(new Error(tokenResponse.error));
              return;
            }
            if (!tokenResponse?.access_token) {
              reject(new Error('Google nao retornou access token.'));
              return;
            }

            googleAccessToken = tokenResponse.access_token;
            const expiresIn = Number(tokenResponse.expires_in || 1800);
            googleTokenExpiresAt = Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 1800000);
            resolve(googleAccessToken);
          },
          error_callback: (error) => {
            if (settled) return;
            settled = true;
            reject(new Error(error?.type || 'Falha no login Google.'));
          }
        });
        tokenClient.requestAccessToken({ prompt: googleAccessToken ? '' : 'consent' });
      });
    }

    async function uploadCsvBlobToGoogleSheets(csvBlob, accessToken) {
      const boundary = `ibama_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:-]/g, '');
      const metadata = {
        name: `ibama_busca_${timestamp}`,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      };

      const multipartBody = new Blob([
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        `${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\n`,
        'Content-Type: text/csv; charset=UTF-8\r\n\r\n',
        csvBlob,
        `\r\n--${boundary}--`,
      ]);

      const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error?.message || `HTTP ${resp.status}`);
      }
      if (!data?.id) {
        throw new Error('Google nao retornou o ID da planilha.');
      }
      return data;
    }

    async function openGoogleSheetsFlow() {
      btnOpenSheets.disabled = true;
      setSheetsStatus('Autenticando no Google...');
      try {
        saveGoogleClientIdLocally();
        const accessToken = await getGoogleAccessToken();
        setSheetsStatus(`Gerando CSV da busca atual (${getDatasetLabel(activeDataset)})...`);
        const csvBlob = await fetchExportCsvBlob({ delimiter: 'comma', bom: false });
        setSheetsStatus('Enviando para Google Sheets...');
        const createdFile = await uploadCsvBlobToGoogleSheets(csvBlob, accessToken);
        const sheetUrl = createdFile.webViewLink || `https://docs.google.com/spreadsheets/d/${createdFile.id}/edit`;
        setSheetsStatus(`Planilha criada com sucesso para ${getDatasetLabel(activeDataset)} (${createdFile.name || createdFile.id}).`);
        window.open(sheetUrl, '_blank', 'noopener');
      } catch (error) {
        setSheetsStatus(`Falha ao exportar para Google Sheets: ${error.message}`, true);
      } finally {
        btnOpenSheets.disabled = false;
      }
    }

    function saveGeminiKeyLocally() {
      localStorage.setItem(GEMINI_STORAGE_KEY, geminiKeyInput.value.trim());
    }

    function restoreGeminiKey() {
      const cached = localStorage.getItem(GEMINI_STORAGE_KEY);
      if (cached) {
        geminiKeyInput.value = cached;
      }
    }

    function formatAiPlainText(text) {
      return esc((text || '').toString()).replace(/\n/g, '<br>');
    }

    function renderInlineMarkdown(rawText) {
      const codeTokens = [];
      let text = esc((rawText || '').toString());

      text = text.replace(/`([^`\n]+)`/g, (_, code) => {
        const token = `@@CODE_SPAN_${codeTokens.length}@@`;
        codeTokens.push(`<code>${code}</code>`);
        return token;
      });

      text = text
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        .replace(/_([^_\n]+)_/g, '<em>$1</em>');

      return text.replace(/@@CODE_SPAN_(\d+)@@/g, (_, idx) => codeTokens[Number(idx)] || '');
    }

    function splitMarkdownTableLine(line) {
      return line.trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());
    }

    function renderMarkdownBlock(block, codeBlocks) {
      const trimmed = block.trim();
      if (!trimmed) return '';

      const codeTokenMatch = trimmed.match(/^@@CODE_BLOCK_(\d+)@@$/);
      if (codeTokenMatch) {
        return codeBlocks[Number(codeTokenMatch[1])] || '';
      }

      const lines = trimmed.split('\n');

      if (lines.every((line) => /^>\s?/.test(line.trim()))) {
        const quoteText = lines.map((line) => line.replace(/^>\s?/, '')).join('\n');
        return `<blockquote><p>${renderInlineMarkdown(quoteText).replace(/\n/g, '<br>')}</p></blockquote>`;
      }

      if (/^#{1,4}\s+/.test(lines[0].trim())) {
        const level = Math.min(4, lines[0].trim().match(/^#+/)[0].length);
        const title = lines[0].trim().replace(/^#{1,4}\s+/, '');
        const rest = lines.slice(1).join('\n').trim();
        const headingHtml = `<h${level}>${renderInlineMarkdown(title)}</h${level}>`;
        if (!rest) return headingHtml;
        return `${headingHtml}<p>${renderInlineMarkdown(rest).replace(/\n/g, '<br>')}</p>`;
      }

      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }

      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
        return `<ol>${lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
      }

      if (
        lines.length >= 2 &&
        lines.every((line) => line.includes('|')) &&
        /^\s*\|?[:\- ]+\|[:\-| ]+\|?\s*$/.test(lines[1])
      ) {
        const headerCells = splitMarkdownTableLine(lines[0]);
        const bodyLines = lines.slice(2).filter((line) => line.trim() !== '');
        const headHtml = `<thead><tr>${headerCells.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('')}</tr></thead>`;
        const bodyHtml = bodyLines.length
          ? `<tbody>${bodyLines.map((line) => {
            const cells = splitMarkdownTableLine(line);
            return `<tr>${cells.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join('')}</tr>`;
          }).join('')}</tbody>`
          : '';
        return `<table>${headHtml}${bodyHtml}</table>`;
      }

      return `<p>${renderInlineMarkdown(trimmed).replace(/\n/g, '<br>')}</p>`;
    }

    function renderAiMarkdown(text) {
      const codeBlocks = [];
      let normalized = (text || '').toString().replace(/\r\n/g, '\n');

      normalized = normalized.replace(/```([\s\S]*?)```/g, (_, codeBlock) => {
        const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
        const code = codeBlock.replace(/^\n+|\n+$/g, '');
        codeBlocks.push(`<pre><code>${esc(code)}</code></pre>`);
        return token;
      });

      return normalized
        .split(/\n{2,}/)
        .map((block) => renderMarkdownBlock(block, codeBlocks))
        .filter(Boolean)
        .join('');
    }

    function renderAiChat() {
      if (!aiChat) return;
      if (!aiChatMessages.length) {
        aiChat.innerHTML = `<article class="ai-msg bot"><span class="role">analista ia</span><div class="txt">${formatAiPlainText(AI_WELCOME_MESSAGE)}</div></article>`;
        return;
      }
      aiChat.innerHTML = aiChatMessages.map((msg) => {
        const roleClass = msg.role === 'user' ? 'user' : 'bot';
        const roleLabel = msg.role === 'user' ? 'voce' : 'analista ia';
        const pendingClass = msg.pending ? ' pending' : '';
        const bodyHtml = msg.role === 'user' ? formatAiPlainText(msg.text) : renderAiMarkdown(msg.text);
        return `<article class="ai-msg ${roleClass}${pendingClass}"><span class="role">${roleLabel}</span><div class="txt">${bodyHtml}</div></article>`;
      }).join('');
      aiChat.scrollTop = aiChat.scrollHeight;
    }

    function pushAiMessage(role, text, pending = false) {
      aiChatMessages.push({ role, text: (text || '').toString(), pending: Boolean(pending) });
      const index = aiChatMessages.length - 1;
      renderAiChat();
      return index;
    }

    function updateAiMessage(index, text, pending = false) {
      if (!Number.isInteger(index) || !aiChatMessages[index]) return;
      aiChatMessages[index].text = (text || '').toString();
      aiChatMessages[index].pending = Boolean(pending);
      renderAiChat();
    }

    function resetAiConversation(message = AI_WELCOME_MESSAGE) {
      aiConversationHistory = [];
      aiChatMessages = [{ role: 'assistant', text: message, pending: false }];
      aiLastContextStamp = '';
      renderAiChat();
    }

    function computeAiContextStamp() {
      if (!currentSearchData) return '';
      const summary = currentSearchData.summary || {};
      return JSON.stringify({
        dataset: currentSearchData.dataset || activeDataset,
        query: queryInput.value.trim().toLowerCase(),
        uf: ufFilter.value.trim().toLowerCase(),
        total_match: currentSearchData.total_match || 0,
        total_multas: summary.total_multas || 0,
        data_inicial: summary.data_inicial || '',
        data_final: summary.data_final || '',
      });
    }

    function syncAiContextStamp() {
      const newStamp = computeAiContextStamp();
      if (!newStamp) return;
      if (aiLastContextStamp && aiLastContextStamp !== newStamp) {
        aiConversationHistory = [];
        pushAiMessage('assistant', `Filtro atualizado para ${getDatasetLabel(activeDataset)}. Daqui em diante o chat usa apenas este novo recorte.`, false);
      }
      aiLastContextStamp = newStamp;
    }

    function buildGeminiSystemPrompt() {
      const todayIso = new Date().toISOString().slice(0, 10);
      return [
        'Voce e um analista tecnico de autos ambientais (IBAMA e ICMBio).',
        'Responda sempre em portugues do Brasil.',
        'Sem introducao, sem saudacao e sem texto generico. Va direto ao ponto da pergunta.',
        'Destrinche o resultado com o maximo de contexto util da base filtrada.',
        'Sempre priorize evidencias numericas: totais, valores, datas, estados, autuados e recortes temporais.',
        'Se a pergunta pedir comparacao, entregue comparacao objetiva em bullets curtos ou tabela markdown simples.',
        'Formate em markdown limpo e escaneavel: use titulos curtos (###), listas e negrito nos numeros-chave.',
        'Estrutura padrao: resposta objetiva, evidencias do filtro e ressalvas.',
        'Se faltar dado para algum ponto, escreva exatamente: sem evidencia no filtro atual.',
        'Nao invente dados, nao use fontes externas e nao contradiga o contexto JSON.',
        `Datas futuras apos ${todayIso} sao invalidas; ignore e sinalize quando aparecerem.`,
      ].join('\n');
    }

    function buildAiContextPayload() {
      if (!currentSearchData) return null;
      const summary = currentSearchData.summary || {};
      const compactResults = (currentSearchData.results || []).slice(0, 80).map((row) => ({
        data_evento: row.data_evento || '',
        uf: row.uf || '',
        municipio: row.municipio || '',
        nome_infrator: row.nome_infrator || '',
        valor_multa: row.valor_multa || 0,
        num_processo: row.num_processo || '',
        des_auto_infracao: (row.des_auto_infracao || '').slice(0, 320),
      }));

      return {
        dataset: currentSearchData.dataset || activeDataset,
        filtro: {
          query: queryInput.value.trim() || '',
          uf: ufFilter.value.trim() || '',
        },
        resumo: {
          total_match: currentSearchData.total_match || 0,
          total_multas_filtradas: summary.total_multas || 0,
          media_multa: summary.media_multa || 0,
          maior_multa: summary.maior_multa || 0,
          menor_multa: summary.menor_multa || 0,
          data_inicial: summary.data_inicial || '',
          data_final: summary.data_final || '',
        },
        top_states: (currentSearchData.top_states || []).slice(0, 15),
        top_offenders: (currentSearchData.top_offenders || []).slice(0, 15),
        timeline: (currentSearchData.timeline || []).slice(0, 60),
        sample_results: compactResults,
        pontos_com_coordenadas: (currentSearchData.map_points || []).length,
      };
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

    async function callGeminiGenerate(apiKey, contents, systemPrompt) {
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
            temperature: 0.15,
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
      const apiKey = geminiKeyInput.value.trim();
      const question = aiQuestion.value.trim();

      if (!apiKey) {
        pushAiMessage('assistant', 'Informe sua Gemini API key para usar a IA.', false);
        return;
      }
      if (!question) {
        pushAiMessage('assistant', 'Digite uma pergunta sobre os dados filtrados.', false);
        return;
      }
      if (!currentSearchData) {
        pushAiMessage('assistant', 'Execute uma busca antes de perguntar para a IA.', false);
        return;
      }

      saveGeminiKeyLocally();
      btnAskAi.disabled = true;
      syncAiContextStamp();

      const cleanedQuestion = question.replace(/\s+/g, ' ').trim();
      aiQuestion.value = '';
      pushAiMessage('user', cleanedQuestion, false);
      const pendingIndex = pushAiMessage('assistant', 'Consultando Gemini Flash 2.5...', true);

      const context = buildAiContextPayload();
      const systemPrompt = buildGeminiSystemPrompt();
      const contextMessage = [
        'CONTEXTO_JSON_ATUAL:',
        JSON.stringify(context),
      ].join('\n');

      try {
        const conversation = [
          { role: 'user', parts: [{ text: contextMessage }] },
          ...aiConversationHistory,
          { role: 'user', parts: [{ text: cleanedQuestion }] },
        ];
        const chunks = [];
        let finishReason = '';

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const responseData = await callGeminiGenerate(apiKey, conversation, systemPrompt);
          const answerChunk = extractGeminiAnswer(responseData);
          finishReason = extractGeminiFinishReason(responseData);

          if (answerChunk) {
            chunks.push(answerChunk);
            conversation.push({ role: 'model', parts: [{ text: answerChunk }] });
          }

          if (finishReason !== 'MAX_TOKENS') {
            break;
          }

          updateAiMessage(pendingIndex, `${chunks.join('\n').trim()}\n\n[continuando resposta...]`, true);
          conversation.push({ role: 'user', parts: [{ text: GEMINI_CONTINUE_PROMPT }] });
        }

        let answer = chunks.join('\n').trim();
        if (!answer) {
          answer = 'sem evidencia no filtro atual';
        } else if (finishReason === 'MAX_TOKENS') {
          answer += '\n\n[resposta cortada por limite de tokens]';
        }

        updateAiMessage(pendingIndex, answer, false);

        aiConversationHistory.push({ role: 'user', parts: [{ text: cleanedQuestion }] });
        aiConversationHistory.push({ role: 'model', parts: [{ text: answer }] });
        if (aiConversationHistory.length > AI_HISTORY_MAX_ITEMS) {
          aiConversationHistory = aiConversationHistory.slice(-AI_HISTORY_MAX_ITEMS);
        }
      } catch (error) {
        updateAiMessage(pendingIndex, `Falha ao consultar Gemini: ${error.message}`, false);
      } finally {
        btnAskAi.disabled = false;
        aiQuestion.focus();
      }
    }

    async function boot() {
      initMap();
      restoreGeminiKey();
      resetAiConversation();
      restoreGoogleClientId();
      updateDatasetTabs();

      if (googleClientIdInput.value.trim()) {
        setSheetsStatus('Client ID carregado. Pronto para exportar para Google Sheets.');
      }

      try {
        dashboardMetadata = await fetchJson(DATA_METADATA_FILE);
        const stats = buildStatsFromMetadata();
        setBaseStats(stats);
      } catch (error) {
        statusLine.textContent = `Erro ao carregar metadata local: ${error.message}`;
      }

      await runSearch();
    }

    btnSearch.addEventListener('click', runSearch);
    queryInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch();
      }
    });
    ufFilter.addEventListener('change', runSearch);
    tabIbama.addEventListener('click', () => setActiveDataset('ibama'));
    tabIcmbio.addEventListener('click', () => setActiveDataset('icmbio'));

    btnExportCsv.addEventListener('click', exportCsv);
    btnExportCsv2.addEventListener('click', exportCsv);
    btnOpenSheets.addEventListener('click', openGoogleSheetsFlow);

    btnAskAi.addEventListener('click', askGemini);
    btnAiReset.addEventListener('click', () => {
      resetAiConversation('Conversa limpa. Pergunte novamente com o filtro atual.');
      aiLastContextStamp = computeAiContextStamp();
      aiQuestion.focus();
    });
    aiQuestion.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        askGemini();
      }
    });
    geminiKeyInput.addEventListener('change', saveGeminiKeyLocally);
    googleClientIdInput.addEventListener('change', saveGoogleClientIdLocally);

    boot();
