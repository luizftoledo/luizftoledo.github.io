    const queryInput = document.getElementById('query');
    const ufFilter = document.getElementById('uf-filter');
    const btnSearch = document.getElementById('btn-search');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const btnExportCsv2 = document.getElementById('btn-export-csv-2');
    const tabIbama = document.getElementById('tab-ibama');
    const tabIcmbio = document.getElementById('tab-icmbio');
    const datasetSummary = document.getElementById('dataset-summary');
    const viewStoryBtn = document.getElementById('view-story');
    const viewWatchBtn = document.getElementById('view-watch');

    const metricLoadedNow = document.getElementById('metric-loaded-now');
    const metricRange = document.getElementById('metric-range');
    const metricBaseFines = document.getElementById('metric-base-fines');
    const metricFilteredFines = document.getElementById('metric-filtered-fines');
    const statusLine = document.getElementById('status-line');
    const updatedBadge = document.getElementById('updated-badge');
    const loadStatusLabel = document.getElementById('load-status-label');
    const loadStatusSummary = document.getElementById('load-status-summary');
    const loadStatusFill = document.getElementById('load-status-fill');
    const loadStatusIbama = document.getElementById('load-status-ibama');
    const loadStatusIcmbio = document.getElementById('load-status-icmbio');
    const noteValueContext = document.getElementById('note-value-context');
    const noteStatusContext = document.getElementById('note-status-context');
    const noteDescriptionContext = document.getElementById('note-description-context');
    const noteGeoContext = document.getElementById('note-geo-context');
    const noteOutlierContext = document.getElementById('note-outlier-context');

    const storyStepsEl = document.getElementById('story-steps');
    const mapTitle = document.getElementById('map-title');
    const mapDescription = document.getElementById('map-description');
    const storySection = document.getElementById('story-section');
    const watchSection = document.getElementById('watch-section');
    const watchBadge = document.getElementById('watch-badge');
    const watchSummary = document.getElementById('watch-summary');
    const watchCards = document.getElementById('watch-cards');
    const watchDetails = document.getElementById('watch-details');
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
    let activeView = 'story';
    const MAP_ENABLED = false;
    let map = null;
    let mapLayer = null;
    let stepObserver = null;

    const GEMINI_STORAGE_KEY = 'ibama_gemini_key';
    const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    const GEMINI_CONTINUE_PROMPT = 'Continue exatamente de onde parou, sem repetir o que ja escreveu.';
    const AI_HISTORY_MAX_ITEMS = 16;
    const AI_WELCOME_MESSAGE = 'Pronto. Pergunte sobre os dados filtrados e eu vou responder direto ao ponto.';
    const DATA_METADATA_FILE = './data/metadata.json';
    const DATA_FILES = {
      ibama: './data/ibama_records.jsonl.gz',
      icmbio: './data/icmbio_records.jsonl.gz',
    };
    const WATCH_BIG_FINE_MIN = 500000;
    const MOBILE_LIGHT_MODE = (() => {
      const smallScreen = window.matchMedia ? window.matchMedia('(max-width: 900px)').matches : false;
      const lowRam = Number.isFinite(Number(navigator.deviceMemory)) && Number(navigator.deviceMemory) <= 4;
      const saveData = Boolean(navigator.connection && navigator.connection.saveData);
      return smallScreen || lowRam || saveData;
    })();
    const SEARCH_LIMIT = MOBILE_LIGHT_MODE ? 80 : 120;
    const MAP_LIMIT = MOBILE_LIGHT_MODE ? 520 : 1400;
    const EXPORT_MAX_ROWS = MOBILE_LIGHT_MODE ? 150000 : 300000;

    let aiConversationHistory = [];
    let aiChatMessages = [];
    let aiLastContextStamp = '';
    let dashboardMetadata = null;
    let lastSearchFingerprint = '';
    const recordsCache = { ibama: null, icmbio: null };
    const recordsLoadPromises = { ibama: null, icmbio: null };
    const datasetLoadState = {
      ibama: { phase: 'idle', percent: 0, rows: 0, totalLines: 0, error: '' },
      icmbio: { phase: 'idle', percent: 0, rows: 0, totalLines: 0, error: '' },
    };

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

    function getLoadPhaseLabel(phase) {
      if (phase === 'fetching' || phase === 'parsing') return 'carregando';
      if (phase === 'ready') return 'pronto';
      if (phase === 'error') return 'erro';
      return 'aguardando';
    }

    function setDatasetLoadState(dataset, patch) {
      if (!(dataset in datasetLoadState)) return;
      datasetLoadState[dataset] = {
        ...datasetLoadState[dataset],
        ...patch,
      };
      renderLoadStatus();
    }

    function renderLoadStatus() {
      if (!loadStatusLabel || !loadStatusSummary || !loadStatusFill || !loadStatusIbama || !loadStatusIcmbio) return;

      const states = [datasetLoadState.ibama, datasetLoadState.icmbio];
      const averagePercent = Math.round(states.reduce((acc, row) => acc + Number(row.percent || 0), 0) / states.length);
      const inProgress = states.some((row) => row.phase === 'fetching' || row.phase === 'parsing');
      const loadedCount = states.filter((row) => row.phase === 'ready').length;
      const hasErrors = states.some((row) => row.phase === 'error');
      const hasIdle = states.some((row) => row.phase === 'idle');
      const displayPercent = (MOBILE_LIGHT_MODE && loadedCount === 1 && hasIdle && !inProgress && !hasErrors)
        ? 100
        : averagePercent;

      if (inProgress) {
        loadStatusLabel.textContent = 'Carregando dados para busca...';
        loadStatusSummary.textContent = `${displayPercent}%`;
      } else if (hasErrors) {
        loadStatusLabel.textContent = 'Falha parcial ao carregar dados';
        loadStatusSummary.textContent = 'erro';
      } else if (loadedCount === 2) {
        loadStatusLabel.textContent = 'Dados prontos para pesquisar';
        loadStatusSummary.textContent = '100%';
      } else if (loadedCount === 1) {
        loadStatusLabel.textContent = 'Órgão ativo pronto (a outra aba carrega quando você abrir)';
        loadStatusSummary.textContent = `${displayPercent}%`;
      } else {
        loadStatusLabel.textContent = 'Clique em Buscar para carregar os dados';
        loadStatusSummary.textContent = `${displayPercent}%`;
      }

      loadStatusFill.style.width = `${Math.max(0, Math.min(100, displayPercent))}%`;

      const formatDatasetLine = (dataset) => {
        const state = datasetLoadState[dataset];
        const label = getDatasetLabel(dataset);
        const phase = getLoadPhaseLabel(state.phase);
        const rows = Number(state.rows || 0);
        if (state.phase === 'error') {
          return `${label}: indisponível (${state.error || 'falha ao carregar'})`;
        }
        if (state.phase === 'ready') {
          return `${label}: pronto (${numberFmt.format(rows)} autos)`;
        }
        if (state.phase === 'fetching' || state.phase === 'parsing') {
          return `${label}: ${phase} (${state.percent}%)`;
        }
        return `${label}: aguardando`;
      };

      loadStatusIbama.textContent = formatDatasetLine('ibama');
      loadStatusIcmbio.textContent = formatDatasetLine('icmbio');
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
      if (!MAP_ENABLED) return;
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

    function getSearchFingerprint() {
      const parsed = parseSearchParams();
      return `${parsed.q}|${parsed.uf}`;
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
      const ibamaLoaded = Boolean(searchDataByDataset.ibama);
      const icmbioLoaded = Boolean(searchDataByDataset.icmbio);
      const ibamaTotal = ibamaLoaded ? Number((searchDataByDataset.ibama || {}).total_match || 0) : null;
      const icmbioTotal = icmbioLoaded ? Number((searchDataByDataset.icmbio || {}).total_match || 0) : null;
      tabIbama.textContent = `IBAMA (${ibamaTotal === null ? '...' : numberFmt.format(ibamaTotal)})`;
      tabIcmbio.textContent = `ICMBio (${icmbioTotal === null ? '...' : numberFmt.format(icmbioTotal)})`;
      tabIbama.classList.toggle('active', activeDataset === 'ibama');
      tabIcmbio.classList.toggle('active', activeDataset === 'icmbio');
      if (MOBILE_LIGHT_MODE) {
        datasetSummary.textContent = 'Modo leve mobile: a busca carrega um órgão por vez para evitar travamentos. A tabela mostra uma prévia dos maiores valores; use CSV para baixar mais linhas.';
        return;
      }
      datasetSummary.textContent = `Totais no filtro atual: IBAMA ${numberFmt.format(ibamaTotal || 0)} autos e ICMBio ${numberFmt.format(icmbioTotal || 0)} autos. A tabela é uma prévia dos maiores valores.`;
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
      if (window.pako && typeof window.pako.ungzip === 'function') {
        return window.pako.ungzip(new Uint8Array(gzBuffer), { to: 'string' });
      }
      throw new Error('Navegador sem suporte para descompactar gzip (DecompressionStream/pako).');
    }

    async function ensureDatasetLoaded(dataset) {
      if (recordsCache[dataset]) {
        if (datasetLoadState[dataset] && datasetLoadState[dataset].phase !== 'ready') {
          setDatasetLoadState(dataset, {
            phase: 'ready',
            percent: 100,
            rows: Number((recordsCache[dataset] || []).length),
            totalLines: Number((recordsCache[dataset] || []).length),
            error: '',
          });
        }
        return recordsCache[dataset];
      }
      if (recordsLoadPromises[dataset]) {
        return recordsLoadPromises[dataset];
      }
      const filePath = DATA_FILES[dataset];
      if (!filePath) {
        throw new Error(`Dataset invalido: ${dataset}`);
      }

      const loadPromise = (async () => {
        try {
          setDatasetLoadState(dataset, {
            phase: 'fetching',
            percent: 4,
            rows: 0,
            totalLines: 0,
            error: '',
          });

          const rawText = await fetchGzipText(filePath);
          const lines = rawText.split('\n');
          const rows = [];
          const totalLines = Math.max(lines.length, 1);
          const progressStep = Math.max(6000, Math.floor(totalLines / 42));
          const yieldStep = progressStep * 2;

          setDatasetLoadState(dataset, {
            phase: 'parsing',
            percent: 8,
            rows: 0,
            totalLines,
            error: '',
          });

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

            if ((i + 1) % progressStep === 0 || i === lines.length - 1) {
              const parsingPct = Math.max(8, Math.min(99, Math.round(((i + 1) / totalLines) * 92)));
              setDatasetLoadState(dataset, {
                phase: 'parsing',
                percent: parsingPct,
                rows: rows.length,
                totalLines,
              });
            }
            if ((i + 1) % yieldStep === 0) {
              await new Promise((resolve) => {
                setTimeout(resolve, 0);
              });
            }
          }

          recordsCache[dataset] = rows;
          setDatasetLoadState(dataset, {
            phase: 'ready',
            percent: 100,
            rows: rows.length,
            totalLines,
            error: '',
          });
          return rows;
        } catch (error) {
          setDatasetLoadState(dataset, {
            phase: 'error',
            percent: 0,
            error: error?.message || 'falha ao carregar base',
          });
          throw error;
        } finally {
          recordsLoadPromises[dataset] = null;
        }
      })();

      recordsLoadPromises[dataset] = loadPromise;
      return loadPromise;
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

    function isDeforestationRelated(text) {
      const normalized = normalizeText(text || '');
      if (!normalized) return false;
      return (
        normalized.includes('desmat') ||
        normalized.includes('supressao de vegetacao') ||
        normalized.includes('vegetacao nativa') ||
        normalized.includes('corte raso') ||
        normalized.includes('queimada')
      );
    }

    function detectInfractionType(text) {
      const normalized = normalizeText(text || '');
      if (!normalized) return 'Outras infrações ambientais';
      if (
        normalized.includes('desmat') ||
        normalized.includes('supressao de vegetacao') ||
        normalized.includes('corte raso') ||
        normalized.includes('vegetacao nativa')
      ) return 'Desmatamento e vegetação nativa';
      if (
        normalized.includes('queimada') ||
        normalized.includes('incendio') ||
        normalized.includes('uso de fogo')
      ) return 'Queimada e uso de fogo';
      if (
        normalized.includes('fauna') ||
        normalized.includes('animal silvestre') ||
        normalized.includes('caca')
      ) return 'Fauna silvestre';
      if (
        normalized.includes('pesca') ||
        normalized.includes('defeso') ||
        normalized.includes('pescado')
      ) return 'Pesca irregular';
      if (
        normalized.includes('garimpo') ||
        normalized.includes('mineracao') ||
        normalized.includes('lavra')
      ) return 'Mineração e garimpo';
      if (
        normalized.includes('madeira') ||
        normalized.includes('carvao') ||
        normalized.includes('produto florestal')
      ) return 'Madeira e produtos florestais';
      if (
        normalized.includes('licenca') ||
        normalized.includes('autorizacao') ||
        normalized.includes('sem autorizacao')
      ) return 'Atividade sem licença/autorização';
      if (
        normalized.includes('poluicao') ||
        normalized.includes('residuo') ||
        normalized.includes('efluente')
      ) return 'Poluição e resíduos';
      if (
        normalized.includes('unidade de conservacao') ||
        normalized.includes('app') ||
        normalized.includes('area de preservacao')
      ) return 'Área protegida';
      return 'Outras infrações ambientais';
    }

    function compactDescription(text, maxLen = 190) {
      const clean = (text || '').toString().replace(/\s+/g, ' ').trim();
      if (!clean) return '';
      if (clean.length <= maxLen) return clean;
      return `${clean.slice(0, maxLen - 1).trim()}…`;
    }

    function upsertInfractionTypeByYear(container, year, typeLabel, fine, description) {
      if (!year) return;
      let yearMap = container.get(year);
      if (!yearMap) {
        yearMap = new Map();
        container.set(year, yearMap);
      }
      const row = yearMap.get(typeLabel) || {
        tipo: typeLabel,
        quantidade: 0,
        total_multas: 0,
        exemplo_1: '',
        exemplo_2: '',
      };
      row.quantidade += 1;
      row.total_multas += fine;
      const sample = compactDescription(description);
      if (sample && !row.exemplo_1) {
        row.exemplo_1 = sample;
      } else if (sample && row.exemplo_1 !== sample && !row.exemplo_2) {
        row.exemplo_2 = sample;
      }
      yearMap.set(typeLabel, row);
    }

    function upsertDescriptionByYear(container, year, description, fine) {
      if (!year) return;
      const sample = compactDescription(description);
      if (!sample) return;
      let yearMap = container.get(year);
      if (!yearMap) {
        yearMap = new Map();
        container.set(year, yearMap);
      }
      const row = yearMap.get(sample) || {
        descricao: sample,
        tipo: detectInfractionType(sample),
        quantidade: 0,
        total_multas: 0,
      };
      row.quantidade += 1;
      row.total_multas += fine;
      yearMap.set(sample, row);
    }

    function upsertOffenderYearMap(mapObj, name, fine, isBigFine, isDeforestation) {
      const offenderName = (name || '').toString().trim();
      if (!offenderName) return;
      const row = mapObj.get(offenderName) || {
        nome_infrator: offenderName,
        quantidade: 0,
        total_multas: 0,
        big_quantidade: 0,
        big_total: 0,
        desmat_quantidade: 0,
        desmat_total: 0,
      };
      row.quantidade += 1;
      row.total_multas += fine;
      if (isBigFine) {
        row.big_quantidade += 1;
        row.big_total += fine;
      }
      if (isDeforestation) {
        row.desmat_quantidade += 1;
        row.desmat_total += fine;
      }
      mapObj.set(offenderName, row);
    }

    async function localSearchDataset(dataset) {
      const records = await ensureDatasetLoaded(dataset);
      const { tokens, uf } = parseSearchParams();
      const meta = getDatasetMeta(dataset);
      const calendarYear = String(new Date().getFullYear());

      const matchedIndices = [];
      const topResults = [];
      const topMapPoints = [];
      const statesMap = new Map();
      const offendersMap = new Map();
      const timelineMap = new Map();
      const yearWatchMap = new Map();
      const currentYearOffenderMap = new Map();
      let latestYearSeen = '';
      let latestYearOffenderMap = new Map();
      const bigFineEvents = [];
      const desmatByYearMap = new Map();
      const infractionTypeByYearMap = new Map();
      const descriptionByYearMap = new Map();

      let totalMatch = 0;
      let totalMultas = 0;
      let maiorMulta = 0;
      let menorMulta = 0;
      let hasPositiveFine = false;
      let dateMin = '';
      let dateMax = '';
      let geoValidCount = 0;
      let outlierOldBigCount = 0;
      let outlierOldBigMax = 0;

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
        const isBigFine = fine >= WATCH_BIG_FINE_MIN;
        const isDesmat = isDeforestationRelated(row.des_auto_infracao || '');

        if (row.data_evento) {
          if (!dateMin || row.data_evento < dateMin) dateMin = row.data_evento;
          if (!dateMax || row.data_evento > dateMax) dateMax = row.data_evento;
          const year = row.data_evento.slice(0, 4);
          if (/^\d{4}$/.test(year)) {
            const existingYear = timelineMap.get(year) || { ano: year, quantidade: 0, total_multas: 0 };
            existingYear.quantidade += 1;
            existingYear.total_multas += fine;
            timelineMap.set(year, existingYear);

            const watchYear = yearWatchMap.get(year) || { ano: year, quantidade: 0, total_multas: 0, big_quantidade: 0, big_total: 0 };
            watchYear.quantidade += 1;
            watchYear.total_multas += fine;
            if (isBigFine) {
              watchYear.big_quantidade += 1;
              watchYear.big_total += fine;
            }
            yearWatchMap.set(year, watchYear);

            const infractionType = detectInfractionType(row.des_auto_infracao || '');
            upsertInfractionTypeByYear(infractionTypeByYearMap, year, infractionType, fine, row.des_auto_infracao);
            upsertDescriptionByYear(descriptionByYearMap, year, row.des_auto_infracao, fine);

            if (isBigFine && row.nome_infrator) {
              bigFineEvents.push({ ano: year, nome_infrator: row.nome_infrator, valor_multa: fine });
            }
            if (Number(year) < 2000 && fine >= 1000000000) {
              outlierOldBigCount += 1;
              if (fine > outlierOldBigMax) outlierOldBigMax = fine;
            }

            if (!latestYearSeen || year > latestYearSeen) {
              latestYearSeen = year;
              latestYearOffenderMap = new Map();
            }

            if (row.nome_infrator) {
              if (year === calendarYear) {
                upsertOffenderYearMap(currentYearOffenderMap, row.nome_infrator, fine, isBigFine, isDesmat);
              }
              if (year === latestYearSeen) {
                upsertOffenderYearMap(latestYearOffenderMap, row.nome_infrator, fine, isBigFine, isDesmat);
              }
            }

            if (isDesmat) {
              const desmatRow = desmatByYearMap.get(year) || {
                ano: year,
                quantidade: 0,
                total_multas: 0,
                offenders: new Map(),
              };
              desmatRow.quantidade += 1;
              desmatRow.total_multas += fine;
              if (row.nome_infrator) {
                upsertOffenderYearMap(desmatRow.offenders, row.nome_infrator, fine, isBigFine, true);
              }
              desmatByYearMap.set(year, desmatRow);
            }
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
          geoValidCount += 1;
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
      const yearWatchSeries = [...yearWatchMap.values()]
        .sort((a, b) => a.ano.localeCompare(b.ano));

      const availableYears = timeline.map((row) => row.ano);
      const targetYear = availableYears.includes(calendarYear)
        ? calendarYear
        : (availableYears[availableYears.length - 1] || '');
      const targetYearStats = yearWatchMap.get(targetYear) || { quantidade: 0, total_multas: 0, big_quantidade: 0, big_total: 0 };
      const previousYearStats = yearWatchMap.get(String(Number(targetYear) - 1)) || { quantidade: 0, total_multas: 0, big_quantidade: 0, big_total: 0 };

      const baselineRows = yearWatchSeries.filter((row) => Number(row.ano) < Number(targetYear)).slice(-3);
      const baselineBigCountAvg = baselineRows.length
        ? baselineRows.reduce((acc, row) => acc + Number(row.big_quantidade || 0), 0) / baselineRows.length
        : 0;
      const baselineBigValueAvg = baselineRows.length
        ? baselineRows.reduce((acc, row) => acc + Number(row.big_total || 0), 0) / baselineRows.length
        : 0;

      const targetOffenderMap = (targetYear && targetYear === calendarYear)
        ? currentYearOffenderMap
        : latestYearOffenderMap;
      const targetOffenders = [...targetOffenderMap.values()];
      const topCurrentByCount = [...targetOffenders]
        .sort((a, b) => (b.quantidade - a.quantidade) || (b.total_multas - a.total_multas))
        .slice(0, 10);
      const topCurrentByValue = [...targetOffenders]
        .sort((a, b) => (b.total_multas - a.total_multas) || (b.quantidade - a.quantidade))
        .slice(0, 10);

      const seenBigBefore = new Set();
      const currentBigByOffender = new Map();
      for (let i = 0; i < bigFineEvents.length; i += 1) {
        const item = bigFineEvents[i];
        const offender = (item.nome_infrator || '').toString().trim();
        if (!offender) continue;
        if (item.ano < targetYear) {
          seenBigBefore.add(offender);
          continue;
        }
        if (item.ano !== targetYear) continue;
        const row = currentBigByOffender.get(offender) || { nome_infrator: offender, big_quantidade: 0, big_total: 0 };
        row.big_quantidade += 1;
        row.big_total += Number(item.valor_multa || 0);
        currentBigByOffender.set(offender, row);
      }

      const newBigPlayers = [...currentBigByOffender.values()]
        .filter((row) => !seenBigBefore.has(row.nome_infrator))
        .sort((a, b) => (b.big_total - a.big_total) || (b.big_quantidade - a.big_quantidade))
        .slice(0, 10);

      const targetDesmat = desmatByYearMap.get(targetYear) || { quantidade: 0, total_multas: 0, offenders: new Map() };
      const topDesmatOffenders = [...targetDesmat.offenders.values()]
        .sort((a, b) => (b.desmat_total - a.desmat_total) || (b.desmat_quantidade - a.desmat_quantidade))
        .slice(0, 10);

      const topInfractionTypes = [...(infractionTypeByYearMap.get(targetYear) || new Map()).values()]
        .sort((a, b) => (b.quantidade - a.quantidade) || (b.total_multas - a.total_multas))
        .slice(0, 12)
        .map((row) => ({
          ...row,
          exemplo: [row.exemplo_1, row.exemplo_2].filter(Boolean).join(' | '),
        }));

      const topInfractionDescriptions = [...(descriptionByYearMap.get(targetYear) || new Map()).values()]
        .sort((a, b) => (b.quantidade - a.quantidade) || (b.total_multas - a.total_multas))
        .slice(0, 12);

      const deltaPct = (current, previous) => {
        const c = Number(current || 0);
        const p = Number(previous || 0);
        if (p <= 0) return null;
        return (c - p) / p;
      };

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
        geo_valid_count: geoValidCount,
        outlier_old_big_count: outlierOldBigCount,
        outlier_old_big_max: outlierOldBigMax,
        top_states: topStates,
        top_offenders: topOffenders,
        timeline,
        map_points: topMapPoints.slice(0, MAP_LIMIT),
        results: topResults.slice(0, SEARCH_LIMIT),
        watch: {
          threshold: WATCH_BIG_FINE_MIN,
          target_year: targetYear,
          target_year_is_partial: targetYear === calendarYear,
          latest_year_in_data: latestYearSeen || targetYear,
          target_stats: targetYearStats,
          previous_stats: previousYearStats,
          baseline_years: baselineRows.map((row) => row.ano),
          baseline_big_count_avg: baselineBigCountAvg,
          baseline_big_value_avg: baselineBigValueAvg,
          delta_big_count_vs_prev: deltaPct(targetYearStats.big_quantidade, previousYearStats.big_quantidade),
          delta_big_value_vs_prev: deltaPct(targetYearStats.big_total, previousYearStats.big_total),
          delta_big_count_vs_baseline: deltaPct(targetYearStats.big_quantidade, baselineBigCountAvg),
          delta_big_value_vs_baseline: deltaPct(targetYearStats.big_total, baselineBigValueAvg),
          top_current_by_count: topCurrentByCount,
          top_current_by_value: topCurrentByValue,
          new_big_players: newBigPlayers,
          top_infraction_types: topInfractionTypes,
          top_infraction_descriptions: topInfractionDescriptions,
          desmat_target: {
            quantidade: targetDesmat.quantidade || 0,
            total_multas: targetDesmat.total_multas || 0,
            top_offenders: topDesmatOffenders,
          },
        },
      };
    }

    function renderActiveDataset() {
      currentSearchData = searchDataByDataset[activeDataset];
      if (!currentSearchData) {
        storyStepsEl.innerHTML = `<article class="story-step active"><h3>Sem dados</h3><p class="empty">Ainda nao ha resultado para ${esc(getDatasetLabel(activeDataset))}.</p></article>`;
        resultsBody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum dado para ${esc(getDatasetLabel(activeDataset))}.</td></tr>`;
        renderWatchPanel(null);
        updateMethodologyNotes(null);
        return;
      }

      const summary = currentSearchData.summary || {};
      metricLoadedNow.textContent = `${numberFmt.format(currentSearchData.total_match || 0)} (${getDatasetLabel(activeDataset)})`;
      metricFilteredFines.textContent = moneyFmt.format(summary.total_multas || 0);
      metricRange.textContent = `${formatDate(summary.data_inicial)} ate ${formatDate(summary.data_final)}`;
      syncAiContextStamp();

      renderResultTable(currentSearchData.results || []);
      renderStory(currentSearchData);
      renderWatchPanel(currentSearchData);
      updateMethodologyNotes(currentSearchData);
    }

    async function setActiveDataset(dataset) {
      activeDataset = dataset === 'icmbio' ? 'icmbio' : 'ibama';
      updateDatasetTabs();
      const fingerprint = getSearchFingerprint();
      if (!searchDataByDataset[activeDataset] || lastSearchFingerprint !== fingerprint) {
        await runSearch(activeDataset);
        return;
      }
      renderActiveDataset();
    }

    function formatDeltaLabel(delta) {
      if (!Number.isFinite(Number(delta))) return 'sem base comparavel';
      const value = Number(delta);
      const sign = value > 0 ? '+' : '';
      return `${sign}${(value * 100).toFixed(1)}%`;
    }

    function renderWatchPanel(data) {
      if (!watchBadge || !watchSummary || !watchCards || !watchDetails) return;
      if (!data || !data.watch) {
        watchBadge.textContent = `multa de alto valor (>= ${moneyFmt.format(WATCH_BIG_FINE_MIN)})`;
        watchSummary.textContent = 'Sem dados para montar o painel de tendências.';
        watchCards.innerHTML = '';
        watchDetails.innerHTML = '';
        return;
      }

      const watch = data.watch || {};
      const targetYear = watch.target_year || '--';
      const targetLabel = watch.target_year_is_partial ? `${targetYear} (ano em andamento)` : `${targetYear}`;
      const targetStats = watch.target_stats || {};
      const desmat = watch.desmat_target || {};
      const topByCount = watch.top_current_by_count || [];
      const topByValue = watch.top_current_by_value || [];
      const newPlayers = watch.new_big_players || [];
      const desmatTop = desmat.top_offenders || [];
      const infractionTypes = watch.top_infraction_types || [];
      const infractionDescriptions = watch.top_infraction_descriptions || [];

      watchBadge.textContent = `multa de alto valor (>= ${moneyFmt.format(Number(watch.threshold || WATCH_BIG_FINE_MIN))})`;
      watchSummary.innerHTML = [
        `Painel focado em multas de alto valor para <strong>${esc(getDatasetLabel(data.dataset || activeDataset))}</strong>.`,
        `Nesta aba, "multa de alto valor" significa auto com valor igual ou maior que <strong>${esc(moneyFmt.format(Number(watch.threshold || WATCH_BIG_FINE_MIN)))}</strong>.`,
        `Ano monitorado: <strong>${esc(targetLabel)}</strong>.`,
        `Aqui você vê quem merece atenção agora: líderes em quantidade e valor, novos nomes, tipos de infração e descrições mais recorrentes.`,
      ].join(' ');

      watchCards.innerHTML = [
        {
          label: 'Multas de alto valor no ano',
          value: `${numberFmt.format(targetStats.big_quantidade || 0)} autos`,
        },
        {
          label: 'Valor dessas multas',
          value: moneyFmt.format(targetStats.big_total || 0),
        },
        {
          label: 'Variacao vs ano anterior',
          value: `Qtde ${formatDeltaLabel(watch.delta_big_count_vs_prev)} | Valor ${formatDeltaLabel(watch.delta_big_value_vs_prev)}`,
        },
        {
          label: `Variacao vs media (${(watch.baseline_years || []).join(', ') || 'sem base'})`,
          value: `Qtde ${formatDeltaLabel(watch.delta_big_count_vs_baseline)} | Valor ${formatDeltaLabel(watch.delta_big_value_vs_baseline)}`,
        },
        {
          label: 'Autos ligados a desmatamento',
          value: `${numberFmt.format(desmat.quantidade || 0)} autos`,
        },
        {
          label: 'Valor em desmatamento',
          value: moneyFmt.format(desmat.total_multas || 0),
        },
      ].map((card) => `
        <article class="watch-card">
          <div class="label">${esc(card.label)}</div>
          <div class="value">${esc(card.value)}</div>
        </article>
      `).join('');

      const renderRows = (rows, mapper, emptyLabel, colSpan = 3) => {
        if (!rows.length) return `<tr><td colspan="${colSpan}" class="empty">${esc(emptyLabel)}</td></tr>`;
        return rows.map(mapper).join('');
      };

      watchDetails.innerHTML = `
        <article class="watch-detail-card">
          <h3>Quem mais levou multa em ${esc(targetLabel)} (quantidade)</h3>
          <div class="watch-detail-wrap">
            <table>
              <thead>
                <tr>
                  <th>Autuado</th>
                  <th>Autos</th>
                  <th>Valor total</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(topByCount.slice(0, 10), (row) => `
                  <tr>
                    <td>${esc(row.nome_infrator || '-')}</td>
                    <td>${numberFmt.format(row.quantidade || 0)}</td>
                    <td>${esc(moneyFmt.format(row.total_multas || 0))}</td>
                  </tr>
                `, 'Sem evidencias para o filtro atual.')}
              </tbody>
            </table>
          </div>
        </article>
        <article class="watch-detail-card">
          <h3>Quem mais levou multa em ${esc(targetLabel)} (valor)</h3>
          <div class="watch-detail-wrap">
            <table>
              <thead>
                <tr>
                  <th>Autuado</th>
                  <th>Valor total</th>
                  <th>Autos</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(topByValue.slice(0, 10), (row) => `
                  <tr>
                    <td>${esc(row.nome_infrator || '-')}</td>
                    <td>${esc(moneyFmt.format(row.total_multas || 0))}</td>
                    <td>${numberFmt.format(row.quantidade || 0)}</td>
                  </tr>
                `, 'Sem evidencias para o filtro atual.')}
              </tbody>
            </table>
          </div>
        </article>
        <article class="watch-detail-card">
          <h3>Novos autuados com multa de alto valor em ${esc(targetLabel)}</h3>
          <div class="watch-detail-wrap">
            <table>
              <thead>
                <tr>
                  <th>Autuado</th>
                  <th>Multas de alto valor</th>
                  <th>Valor total</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(newPlayers.slice(0, 10), (row) => `
                  <tr>
                    <td>${esc(row.nome_infrator || '-')}</td>
                    <td>${numberFmt.format(row.big_quantidade || 0)}</td>
                    <td>${esc(moneyFmt.format(row.big_total || 0))}</td>
                  </tr>
                `, 'Nenhum novo autuado com multa de alto valor no recorte atual.')}
              </tbody>
            </table>
          </div>
        </article>
        <article class="watch-detail-card">
          <h3>Desmatamento: principais autuados em ${esc(targetLabel)}</h3>
          <div class="watch-detail-wrap">
            <table>
              <thead>
                <tr>
                  <th>Autuado</th>
                  <th>Autos com desmatamento</th>
                  <th>Valor total</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(desmatTop.slice(0, 10), (row) => `
                  <tr>
                    <td>${esc(row.nome_infrator || '-')}</td>
                    <td>${numberFmt.format(row.desmat_quantidade || 0)}</td>
                    <td>${esc(moneyFmt.format(row.desmat_total || 0))}</td>
                  </tr>
                `, 'Sem autos com termos de desmatamento neste filtro.')}
              </tbody>
            </table>
          </div>
        </article>
        <article class="watch-detail-card">
          <h3>Tipos de infração mais frequentes em ${esc(targetLabel)}</h3>
          <div class="watch-detail-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Autos</th>
                  <th>Valor total</th>
                  <th>Exemplo de descrição</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(infractionTypes.slice(0, 10), (row) => `
                  <tr>
                    <td>${esc(row.tipo || '-')}</td>
                    <td>${numberFmt.format(row.quantidade || 0)}</td>
                    <td>${esc(moneyFmt.format(row.total_multas || 0))}</td>
                    <td class="watch-desc">${esc(row.exemplo || '-')}</td>
                  </tr>
                `, 'Sem classificação disponível para este filtro.', 4)}
              </tbody>
            </table>
          </div>
        </article>
        <article class="watch-detail-card">
          <h3>Descrições de multa mais recorrentes em ${esc(targetLabel)}</h3>
          <div class="watch-detail-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Trecho da descrição</th>
                  <th>Autos</th>
                  <th>Valor total</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(infractionDescriptions.slice(0, 12), (row) => `
                  <tr>
                    <td>${esc(row.tipo || '-')}</td>
                    <td class="watch-desc">${esc(row.descricao || '-')}</td>
                    <td>${numberFmt.format(row.quantidade || 0)}</td>
                    <td>${esc(moneyFmt.format(row.total_multas || 0))}</td>
                  </tr>
                `, 'Sem descrições recorrentes para este filtro.', 4)}
              </tbody>
            </table>
          </div>
        </article>
      `;
    }

    function setViewMode(mode) {
      activeView = mode === 'watch' ? 'watch' : 'story';
      if (storySection) storySection.classList.toggle('hidden', activeView !== 'story');
      if (watchSection) watchSection.classList.toggle('hidden', activeView !== 'watch');
      if (viewStoryBtn) viewStoryBtn.classList.toggle('active', activeView === 'story');
      if (viewWatchBtn) viewWatchBtn.classList.toggle('active', activeView === 'watch');
      if (map && activeView === 'story') {
        setTimeout(() => map.invalidateSize(), 120);
      }
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
        const rawLabel = (item[labelA] || '').toString();
        const label = labelA === 'uf' ? rawLabel.toUpperCase() : rawLabel;
        return `<li><strong>${esc(label)}</strong> - ${esc(numberFmt.format(item[labelB]))} registros - ${esc(valueFormatter(item.total_multas || 0))}</li>`;
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
      if (!MAP_ENABLED) return;
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
      if (MAP_ENABLED && mapTitle && mapDescription) {
        mapTitle.textContent = stepData.mapTitle;
        mapDescription.textContent = stepData.mapDescription;
        drawMap(stepData.mode);
      }
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

    function updateMethodologyNotes(data) {
      const datasetLabel = getDatasetLabel((data || {}).dataset || activeDataset);
      const total = Number((data || {}).total_match || 0);
      const geoValid = Number((data || {}).geo_valid_count || 0);
      const geoCoverage = total > 0 ? (geoValid / total) * 100 : 0;
      const outlierCount = Number((data || {}).outlier_old_big_count || 0);
      const outlierMax = Number((data || {}).outlier_old_big_max || 0);

      if (noteValueContext) {
        noteValueContext.textContent = 'Valores das multas: exibidos em valor nominal do registro original da base pública, sem correção por inflação neste painel.';
      }
      if (noteStatusContext) {
        noteStatusContext.textContent = `Status da multa: a base aberta do ${datasetLabel} não traz, neste painel, o andamento completo (paga, anulada, em recurso etc.).`;
      }
      if (noteDescriptionContext) {
        noteDescriptionContext.textContent = 'Texto da infração: descrições são mantidas exatamente como registradas pelos órgãos, com baixa padronização textual.';
      }
      if (noteGeoContext) {
        if (total > 0) {
          noteGeoContext.textContent = `Cobertura geográfica (${datasetLabel}, filtro atual): ${numberFmt.format(geoValid)} de ${numberFmt.format(total)} autos (${geoCoverage.toFixed(1)}%) têm latitude/longitude válidas; os demais não trazem coordenada utilizável na fonte.`;
        } else {
          noteGeoContext.textContent = 'Cobertura geográfica: nem todos os autos possuem latitude/longitude válidas na fonte original.';
        }
      }
      if (noteOutlierContext) {
        if (outlierCount > 0) {
          noteOutlierContext.textContent = `Registros históricos: o recorte atual tem ${numberFmt.format(outlierCount)} auto(s) anterior(es) a 2000 com multa acima de R$ 1 bilhão (maior valor: ${moneyFmt.format(outlierMax)}). Esses casos exigem checagem documental antes de publicação.`;
        } else {
          noteOutlierContext.textContent = 'Registros históricos: multas muito altas em anos antigos exigem checagem documental antes de publicação.';
        }
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
        geo_valid_count: 0,
        outlier_old_big_count: 0,
        outlier_old_big_max: 0,
        top_states: [],
        top_offenders: [],
        timeline: [],
        map_points: [],
        results: [],
        matched_indices: [],
        export_limited: false,
        watch: {
          threshold: WATCH_BIG_FINE_MIN,
          target_year: '',
          target_year_is_partial: false,
          latest_year_in_data: '',
          target_stats: { quantidade: 0, total_multas: 0, big_quantidade: 0, big_total: 0 },
          previous_stats: { quantidade: 0, total_multas: 0, big_quantidade: 0, big_total: 0 },
          baseline_years: [],
          baseline_big_count_avg: 0,
          baseline_big_value_avg: 0,
          delta_big_count_vs_prev: null,
          delta_big_value_vs_prev: null,
          delta_big_count_vs_baseline: null,
          delta_big_value_vs_baseline: null,
          top_current_by_count: [],
          top_current_by_value: [],
          new_big_players: [],
          top_infraction_types: [],
          top_infraction_descriptions: [],
          desmat_target: { quantidade: 0, total_multas: 0, top_offenders: [] },
        },
      };
    }

    async function runSearch(forceDataset = '') {
      btnSearch.disabled = true;
      statusLine.textContent = MOBILE_LIGHT_MODE
        ? 'Buscando dados em modo leve mobile...'
        : 'Buscando IBAMA + ICMBio nos dados locais otimizados...';

      try {
        const currentFingerprint = getSearchFingerprint();
        const filterChanged = currentFingerprint !== lastSearchFingerprint;
        if (filterChanged) {
          searchDataByDataset = { ibama: null, icmbio: null };
          lastSearchFingerprint = currentFingerprint;
        }

        const explicitDataset = forceDataset === 'ibama' || forceDataset === 'icmbio' ? forceDataset : '';
        const datasetsToLoad = explicitDataset
          ? [explicitDataset]
          : (MOBILE_LIGHT_MODE ? [activeDataset] : ['ibama', 'icmbio']);

        const settled = await Promise.allSettled(datasetsToLoad.map((dataset) => localSearchDataset(dataset)));
        const warnings = [];
        settled.forEach((result, idx) => {
          const dataset = datasetsToLoad[idx];
          if (result.status === 'fulfilled') {
            searchDataByDataset[dataset] = result.value;
            return;
          }
          const fallback = emptyDatasetPayload(dataset);
          fallback.error_message = result.reason?.message || 'falha desconhecida';
          searchDataByDataset[dataset] = fallback;
          warnings.push(`${getDatasetLabel(dataset)} indisponivel`);
        });

        const ibamaData = searchDataByDataset.ibama;
        const icmbioData = searchDataByDataset.icmbio;
        const ibamaCount = Number((ibamaData || {}).total_match || 0);
        const icmbioCount = Number((icmbioData || {}).total_match || 0);
        const ibamaResultCount = Number(((ibamaData || {}).results || []).length);
        const icmbioResultCount = Number(((icmbioData || {}).results || []).length);
        const futures = Number((ibamaData || {}).datas_futuras_ignoradas || 0) + Number((icmbioData || {}).datas_futuras_ignoradas || 0);

        const exportLimitedDatasets = [];
        if ((ibamaData || {}).export_limited) exportLimitedDatasets.push('IBAMA');
        if ((icmbioData || {}).export_limited) exportLimitedDatasets.push('ICMBio');
        const exportBaseNote = `A tabela abaixo é uma prévia dos autos de maior valor; o CSV exporta até ${numberFmt.format(EXPORT_MAX_ROWS)} linhas por órgão.`;
        const exportLimitWarning = exportLimitedDatasets.length
          ? ` Atenção: ${exportLimitedDatasets.join(' e ')} têm mais resultados do que o limite de exportação.`
          : '';

        if (MOBILE_LIGHT_MODE) {
          const activeData = searchDataByDataset[activeDataset] || emptyDatasetPayload(activeDataset);
          const activeLabel = getDatasetLabel(activeDataset);
          const otherDataset = activeDataset === 'ibama' ? 'icmbio' : 'ibama';
          const otherLoaded = Boolean(searchDataByDataset[otherDataset]);
          statusLine.textContent = `${activeLabel}: ${numberFmt.format(activeData.total_match || 0)} autos no filtro. Prévia da tabela com ${numberFmt.format((activeData.results || []).length)} linhas. Modo leve mobile ativo.${otherLoaded ? '' : ` Para carregar ${getDatasetLabel(otherDataset)}, toque na aba correspondente.`} Datas futuras ignoradas: ${numberFmt.format(futures)}. ${exportBaseNote}${warnings.length ? ` Aviso: ${warnings.join(' / ')}.` : ''}${exportLimitWarning}`;
        } else {
          statusLine.textContent = `IBAMA: ${numberFmt.format(ibamaCount)} autos (prévia ${numberFmt.format(ibamaResultCount)} linhas) | ICMBio: ${numberFmt.format(icmbioCount)} autos (prévia ${numberFmt.format(icmbioResultCount)} linhas). Datas futuras ignoradas: ${numberFmt.format(futures)}. ${exportBaseNote}${warnings.length ? ` Aviso: ${warnings.join(' / ')}.` : ''}${exportLimitWarning}`;
        }

        updateDatasetTabs();
        renderActiveDataset();
      } catch (error) {
        const fallback = emptyDatasetPayload(activeDataset);
        searchDataByDataset[activeDataset] = fallback;
        currentSearchData = fallback;
        storyStepsEl.innerHTML = `<article class="story-step active"><h3>Erro de busca</h3><p class="empty">${esc(error.message)}</p></article>`;
        resultsBody.innerHTML = `<tr><td colspan="6" class="empty">Falha ao buscar dados: ${esc(error.message)}</td></tr>`;
        renderWatchPanel(null);
        updateMethodologyNotes(null);
        statusLine.textContent = 'Erro ao consultar os dados locais.';
        updateDatasetTabs();
      } finally {
        btnSearch.disabled = false;
        if (MOBILE_LIGHT_MODE && (searchDataByDataset.ibama || searchDataByDataset.icmbio)) {
          btnSearch.textContent = 'Atualizar busca';
        }
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
        statusLine.textContent = `Falha ao exportar CSV: ${error.message}`;
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
      renderLoadStatus();
      const initialView = ((document.body && document.body.dataset && document.body.dataset.initialView) || '').toLowerCase();
      setViewMode(initialView === 'watch' ? 'watch' : 'story');
      restoreGeminiKey();
      resetAiConversation();
      updateDatasetTabs();
      updateMethodologyNotes(null);

      try {
        dashboardMetadata = await fetchJson(DATA_METADATA_FILE);
        const stats = buildStatsFromMetadata();
        setBaseStats(stats);
      } catch (error) {
        statusLine.textContent = `Erro ao carregar metadata local: ${error.message}`;
      }

      if (MOBILE_LIGHT_MODE) {
        btnSearch.textContent = 'Carregar dados';
        statusLine.textContent = 'Modo leve mobile ativo. Os dados completos só serão carregados quando você tocar em "Carregar dados".';
        return;
      }

      await runSearch();
    }

    btnSearch.addEventListener('click', () => runSearch());
    queryInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runSearch();
      }
    });
    ufFilter.addEventListener('change', () => runSearch());
    tabIbama.addEventListener('click', () => setActiveDataset('ibama'));
    tabIcmbio.addEventListener('click', () => setActiveDataset('icmbio'));
    if (viewStoryBtn) {
      viewStoryBtn.addEventListener('click', () => setViewMode('story'));
    }
    if (viewWatchBtn) {
      viewWatchBtn.addEventListener('click', () => setViewMode('watch'));
    }

    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', exportCsv);
    }
    if (btnExportCsv2) {
      btnExportCsv2.addEventListener('click', exportCsv);
    }

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

    boot();
