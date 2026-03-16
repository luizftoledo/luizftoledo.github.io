/**
 * Journalistic Reaction Simulator — app.js
 * Supports OpenAI, Google Gemini, and Anthropic (via CORS proxy)
 */

// ——— Provider config —————————————————————————————————————
const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    placeholder: 'sk-...',
    hint: 'Salva só no seu navegador. Nunca enviada a nenhum servidor.',
    models: [
      { value: 'gpt-4o-mini',  label: 'gpt-4o-mini — mais econômico ⭐' },
      { value: 'gpt-4o',       label: 'gpt-4o — mais preciso' },
      { value: 'gpt-4-turbo',  label: 'gpt-4-turbo' },
    ],
    modelHint: 'gpt-4o-mini custa ~$0,01 por simulação completa.',
  },
  gemini: {
    label: 'Google Gemini',
    placeholder: 'AIza...',
    hint: 'Chave do Google AI Studio (aistudio.google.com). Salva só no seu navegador.',
    models: [
      { value: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite — mais econômico ⭐' },
      { value: 'gemini-2.5-flash',      label: 'gemini-2.5-flash — equilíbrio custo/qualidade' },
      { value: 'gemini-2.5-pro',        label: 'gemini-2.5-pro — mais preciso' },
    ],
    modelHint: 'Obtenha sua chave gratuita em aistudio.google.com. Os modelos 1.5 foram descontinuados.',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-...',
    hint: 'A API da Anthropic bloqueia chamadas diretas do navegador. Você precisa de um proxy CORS.',
    models: [
      { value: 'claude-haiku-3-5',  label: 'claude-3-5-haiku — mais econômico ⭐' },
      { value: 'claude-sonnet-3-7', label: 'claude-3-7-sonnet — mais preciso' },
    ],
    modelHint: 'Requer um servidor proxy por limitações CORS da Anthropic.',
  },
};

// ——— Personas ——————————————————————————————————————————————
// Based on: Reuters Institute Digital News Report, Pew Research social media typologies,
// academic studies on online commenting behavior (lurkers, trolls, self-promoters, engagers)
// and Brazilian political media consumption patterns.
const PERSONAS = [
  // ── Political spectrum ─────────────────────────────────
  {
    id: 'leitor_neutro',
    emoji: '🗣️',
    name: 'Leitor neutro',
    role: 'Cidadão sem filiação política clara',
    sentiment_hint: 'pragmatic, neither strongly supportive nor critical, asks practical questions about what will change in practice',
  },
  {
    id: 'leitor_petista',
    emoji: '🔴',
    name: 'Leitor petista',
    role: 'Apoiador do PT / esquerda brasileira',
    sentiment_hint: 'supports the investigation if it exposes right-wing corruption, suspicious if it involves PT allies; uses leftist class-struggle framing',
  },
  {
    id: 'leitor_bolsonarista',
    emoji: '🟡',
    name: 'Leitor bolsonarista',
    role: 'Apoiador de Bolsonaro / direita conservadora',
    sentiment_hint: 'accuses media bias (especially BBC/Globo/folha), defends the right-wing; uses terms like "mídia podre", "comunismo", "globolixo"',
  },
  {
    id: 'leitor_liberal',
    emoji: '🎩',
    name: 'Leitor liberal',
    role: 'Direita liberal, pró-mercado, antipetista e antiBolsonaro',
    sentiment_hint: 'criticizes both PT and Bolsonaro camps, focuses on institutional rule of law, fiscal responsibility; frustrated with Brazilian political dysfunction',
  },
  {
    id: 'leitor_conspiracao',
    emoji: '🕳️',
    name: 'Leitor conspiração',
    role: 'Adepto de teorias da conspiração',
    sentiment_hint: 'dismisses the article as a distraction from the "real" story controlled by globalists or elites; references "agenda oculta", deep state, Davos, NWO; uses sarcasm and all-caps',
  },
  // ── Professional voices ────────────────────────────────
  {
    id: 'advogado',
    emoji: '⚖️',
    name: 'Especialista jurídico',
    role: 'Advogado / jurista',
    sentiment_hint: 'analytical, focuses precisely on legal implications, due process, constitutional angles; may point out what the reporting gets legally wrong or right',
  },
  {
    id: 'abordado',
    emoji: '🛡️',
    name: 'Pessoa abordada',
    role: 'Sujeito direto da matéria (nota de defesa)',
    sentiment_hint: 'defensive, denying wrongdoing; attacks the journalist\'s methodology or cherry-picking; claims to have been misquoted or that context is missing',
  },
  {
    id: 'ativista',
    emoji: '📢',
    name: 'Ativista / ONG',
    role: 'Ativista de direitos humanos ou meio ambiente',
    sentiment_hint: 'celebrates the exposure, calls for concrete policy action; references systemic failures and structural causes beyond the individual story',
  },
  {
    id: 'jornalista',
    emoji: '🎙️',
    name: 'Jornalista concorrente',
    role: 'Colega de imprensa',
    sentiment_hint: 'professional tone; notes methodologically what the story confirms or is missing; subtly competitive; may link to their own related coverage',
  },
  {
    id: 'academico',
    emoji: '🎓',
    name: 'Acadêmico / analista',
    role: 'Pesquisador / professor universitário',
    sentiment_hint: 'neutral, measured; contextualizes the story within broader historical patterns in Brazil; may cite data or academic studies; avoids emotional language',
  },
  // ── Social media behavior typologies (research-based) ─
  {
    id: 'humorista',
    emoji: '😂',
    name: 'Comentarista humorista',
    role: 'Usuário que usa humor e memes para reagir',
    sentiment_hint: 'reacts with jokes, irony, memes or puns about the story; humor can be sympathetic or critical; never takes a serious stance; short comment, very informal, emoji-heavy',
  },
  {
    id: 'auto_promotor',
    emoji: '📣',
    name: 'Auto-promotor',
    role: 'Usuário que usa a notícia para se promover',
    sentiment_hint: 'barely engages with the actual story; pivot to promoting themselves, their newsletter, podcast or "thread" on the topic; ends with a follow/subscribe CTA',
  },
  {
    id: 'especialista_autoproclamado',
    emoji: '🧠',
    name: 'Especialista autoproclamado',
    role: 'Usuário que alega saber mais do que o jornalista',
    sentiment_hint: 'condescending, claims insider knowledge or experience; points out things the journalist "missed" or "got wrong"; may be right about some things but overstates their expertise',
  },
  {
    id: 'compartilhador_sem_ler',
    emoji: '🔁',
    name: 'Compartilhador sem ler',
    role: 'Usuário que reage só à manchete',
    sentiment_hint: 'very short comment, clearly based only on the headline; gets at least one factual detail visibly wrong or asks something answered in the article body; shares anyway',
  },
  {
    id: 'engajado_emocional',
    emoji: '😢',
    name: 'Leitor emocionalmente engajado',
    role: 'Usuário com reação emocional intensa',
    sentiment_hint: 'reacts emotionally and empathetically, identifying with victims or affected parties; personal anecdote or family reference; calls for empathy from others; not necessarily political',
  },
  {
    id: 'debatedor',
    emoji: '💬',
    name: 'Debatedor compulsivo',
    role: 'Usuário que quer brigar nos comentários',
    sentiment_hint: 'intentionally provocative; challenges other commenters or the journalist directly; asks aggressive or rhetorical questions; wants to start or sustain an argument',
  },
  {
    id: 'gen_z',
    emoji: '📱',
    name: 'Leitor Gen Z / jovem',
    role: 'Jovem brasileiro de 18-25 anos, muito online',
    sentiment_hint: 'very informal language, uses internet slang ("mds", "isso aí", "surreal", "absurdo"), brief reactions, dark humor, may reference internet culture or memes; politically aware but cynical',
  },
  {
    id: 'diaspora',
    emoji: '🌍',
    name: 'Brasileiro da diáspora',
    role: 'Brasileiro vivendo no exterior',
    sentiment_hint: 'compares Brazil to their host country; frustrated but hopeful; notes how the story resonates or differs from international coverage; may comment in mixed PT/EN',
  },
  {
    id: 'conservador_tradicional',
    emoji: '👴',
    name: 'Conservador tradicional',
    role: 'Leitor mais velho, valores tradicionais',
    sentiment_hint: 'not explicitly partisan; reacts through a moral/religious lens ("onde foi parar os valores?"); nostalgic about a perceived better past; cautious about conclusions; formal language',
  },
  {
    id: 'lurker_ativado',
    emoji: '👀',
    name: 'Lurker ativado',
    role: 'Leitor silencioso que raramente comenta',
    sentiment_hint: 'explicitly says they rarely comment but this story made them break the silence; brief, direct, earnest; no political posturing; focused on one specific fact that shocked them',
  },
];

// ——— DOM refs ————————————————————————————————————————————
const formEl          = document.getElementById('simForm');
const providerSelect  = document.getElementById('providerSelect');
const modelSelect     = document.getElementById('modelSelect');
const modelHint       = document.getElementById('modelHint');
const apiKeyInput     = document.getElementById('apiKey');
const keyHint         = document.getElementById('keyHint');
const keyToggleBtn    = document.getElementById('keyToggle');
const articleInput    = document.getElementById('articleText');
const contextInput    = document.getElementById('contextText');
const outletInput     = document.getElementById('outletName');
const submitBtn       = document.getElementById('submitBtn');
const resultsArea     = document.getElementById('resultsArea');
const postPreview     = document.getElementById('postPreview');
const previewTitle    = document.getElementById('previewTitle');
const previewBody     = document.getElementById('previewBody');
const previewOutlet   = document.getElementById('previewOutlet');
const corsWarning     = document.getElementById('corsWarning');
const proxyGroup      = document.getElementById('proxyGroup');
const proxyUrlInput   = document.getElementById('proxyUrl');

// ——— Init ————————————————————————————————————————————————
window.addEventListener('DOMContentLoaded', () => {
  const savedProvider = localStorage.getItem('sim_provider') || 'openai';
  providerSelect.value = savedProvider;
  updateProviderUI(savedProvider);

  const savedKey = localStorage.getItem(`sim_key_${savedProvider}`) || '';
  if (savedKey) apiKeyInput.value = savedKey;

  const savedProxy = localStorage.getItem('sim_proxy') || '';
  if (proxyUrlInput && savedProxy) proxyUrlInput.value = savedProxy;
});

// ——— Provider change ————————————————————————————————————
providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value;
  localStorage.setItem('sim_provider', provider);
  updateProviderUI(provider);
  // Restore saved key for this provider
  apiKeyInput.value = localStorage.getItem(`sim_key_${provider}`) || '';
});

function updateProviderUI(provider) {
  const cfg = PROVIDERS[provider];

  // Update model list
  modelSelect.innerHTML = cfg.models
    .map(m => `<option value="${m.value}">${m.label}</option>`)
    .join('');

  // Restore saved model
  const savedModel = localStorage.getItem(`sim_model_${provider}`);
  if (savedModel) modelSelect.value = savedModel;

  // Update hints and placeholder
  modelHint.textContent  = cfg.modelHint;
  keyHint.textContent    = cfg.hint;
  apiKeyInput.placeholder = cfg.placeholder;

  // Show/hide Anthropic proxy warning
  const isAnthropic = provider === 'anthropic';
  corsWarning.classList.toggle('hidden', !isAnthropic);
  proxyGroup.classList.toggle('hidden', !isAnthropic);
}

// ——— Persist settings ———————————————————————————————————
apiKeyInput.addEventListener('change', () => {
  const provider = providerSelect.value;
  localStorage.setItem(`sim_key_${provider}`, apiKeyInput.value.trim());
});
modelSelect.addEventListener('change', () => {
  const provider = providerSelect.value;
  localStorage.setItem(`sim_model_${provider}`, modelSelect.value);
});
if (proxyUrlInput) {
  proxyUrlInput.addEventListener('change', () => {
    localStorage.setItem('sim_proxy', proxyUrlInput.value.trim());
  });
}

// ——— API key toggle ——————————————————————————————————————
keyToggleBtn.addEventListener('click', () => {
  const isPwd = apiKeyInput.type === 'password';
  apiKeyInput.type = isPwd ? 'text' : 'password';
  keyToggleBtn.innerHTML = isPwd ? '🙈' : '👁️';
});

// ——— Form submit ——————————————————————————————————————————
formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const provider = providerSelect.value;
  const model    = modelSelect.value;
  const apiKey   = apiKeyInput.value.trim();
  const article  = articleInput.value.trim();
  const context  = contextInput.value.trim();
  const outlet   = outletInput.value.trim() || 'Veículo jornalístico';
  const proxyUrl = proxyUrlInput ? proxyUrlInput.value.trim() : '';

  if (!apiKey)                       return showError('Insira sua chave de API para continuar.');
  if (!article || article.length < 40) return showError('Insira o texto jornalístico completo (ao menos 40 caracteres).');
  if (provider === 'anthropic' && !proxyUrl) return showError('Informe a URL do proxy CORS para usar a API da Anthropic.');

  localStorage.setItem(`sim_key_${provider}`, apiKey);

  submitBtn.disabled = true;
  submitBtn.textContent = 'Simulando reações…';

  renderPostPreview(article, outlet);
  showSkeleton();

  try {
    let comments;
    if (provider === 'openai')     comments = await callOpenAI(apiKey, model, article, context, outlet);
    else if (provider === 'gemini') comments = await callGemini(apiKey, model, article, context, outlet);
    else                            comments = await callAnthropic(apiKey, model, proxyUrl, article, context, outlet);
    renderComments(comments);
  } catch (err) {
    showError(humanizeError(err, provider));
  } finally {
    clearLoader();
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simular reações';
  }
});

// ——— Prompt builder ——————————————————————————————————————
function buildPrompt(article, context, outlet) {
  const personaDescriptions = PERSONAS.map(p =>
    `{"id":"${p.id}","emoji":"${p.emoji}","name":"${p.name}","role":"${p.role}","sentiment_hint":"${p.sentiment_hint}"}`
  ).join(',\n');

  const system = `You are a social simulation engine for investigative journalism.
Generate realistic, distinct simulated reactions to a journalistic article.
Each reaction must be from a DIFFERENT persona with a unique voice and perspective.
Comments must be in Brazilian Portuguese.
Return ONLY a valid JSON object with a key "reactions" containing an array of exactly ${PERSONAS.length} objects.
No markdown. No explanation.
Each object must have: id (string), emoji (string), name (string), role (string), sentiment (one of: positive/critical/neutral/mixed), comment (string, 2-4 realistic sentences in the persona's authentic voice).`;

  const user = `Artigo / texto jornalístico:
"""
${article}
"""

${context ? `Contexto adicional:\n"""\n${context}\n"""\n` : ''}Veículo: ${outlet}

Gere um comentário realista para cada uma das ${PERSONAS.length} personas:
[${personaDescriptions}]

Retorne um objeto JSON: { "reactions": [ ... ] }`;

  return { system, user };
}

function parseResponse(raw) {
  let obj;
  try { obj = JSON.parse(raw); } catch { throw new Error('A IA retornou um formato inválido. Tente novamente.'); }
  if (Array.isArray(obj))                                  return obj;
  const arr = obj.reactions ?? Object.values(obj).find(v => Array.isArray(v));
  if (!arr) throw new Error('Formato de resposta inesperado da IA.');
  return arr;
}

// ——— OpenAI ——————————————————————————————————————————————
async function callOpenAI(apiKey, model, article, context, outlet) {
  const { system, user } = buildPrompt(article, context, outlet);
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.85,
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return parseResponse(data.choices?.[0]?.message?.content || '');
}

// ——— Google Gemini ———————————————————————————————————————
async function callGemini(apiKey, model, article, context, outlet) {
  const { system, user } = buildPrompt(article, context, outlet);
  const fullPrompt = `${system}\n\n${user}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.85 },
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseResponse(raw);
}

// ——— Anthropic (via proxy) ———————————————————————————————
async function callAnthropic(apiKey, model, proxyBase, article, context, outlet) {
  const { system, user } = buildPrompt(article, context, outlet);
  const base = proxyBase.replace(/\/$/, '');
  const resp = await fetch(`${base}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const raw  = data.content?.[0]?.text || '';
  return parseResponse(raw);
}

// ——— Render post preview ————————————————————————————————
function renderPostPreview(article, outlet) {
  const lines = article.split('\n').filter(l => l.trim());
  const title = lines[0].length > 100 ? lines[0].substring(0, 97) + '…' : lines[0];
  const body  = lines.slice(1).join(' ');
  previewOutlet.textContent = outlet;
  previewTitle.textContent  = title;
  previewBody.textContent   = body || '(sem lead adicional)';
  postPreview.classList.remove('hidden');
}

// ——— Animated loading state —————————————————————————————
let _loaderInterval = null;

function showSkeleton() {
  if (_loaderInterval) clearInterval(_loaderInterval);

  resultsArea.innerHTML = `
    <div class="loader-state">
      <div class="loader-header">
        <span class="loader-label" id="loaderLabel">Consultando a IA…</span>
        <span class="loader-count" id="loaderCount">0 / ${PERSONAS.length}</span>
      </div>
      <div class="loader-bar-track">
        <div class="loader-bar-fill" id="loaderBarFill"></div>
      </div>
    </div>
    <div class="skeleton-feed">
      ${Array.from({length: 6}, (_, i) => `
      <div class="skeleton-card" style="animation-delay:${i * 0.12}s">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line s"></div>
          <div class="skeleton-line l"></div>
          <div class="skeleton-line m"></div>
          <div class="skeleton-line f"></div>
        </div>
      </div>`).join('')}
    </div>`;

  // Cycle through persona names in the status label
  const label   = document.getElementById('loaderLabel');
  const counter = document.getElementById('loaderCount');
  const bar     = document.getElementById('loaderBarFill');
  let   idx     = 0;
  const total   = PERSONAS.length;

  _loaderInterval = setInterval(() => {
    if (!label || !counter || !bar) { clearInterval(_loaderInterval); return; }
    const p = PERSONAS[idx % total];
    label.textContent   = `Gerando reação de ${p.emoji} ${p.name}…`;
    counter.textContent = `${idx + 1} / ${total}`;
    bar.style.width     = `${Math.round(((idx + 1) / total) * 100)}%`;
    idx++;
    if (idx >= total) clearInterval(_loaderInterval);
  }, 900);
}

function clearLoader() {
  if (_loaderInterval) { clearInterval(_loaderInterval); _loaderInterval = null; }
}


// ——— Render comments ————————————————————————————————————
function renderComments(comments) {
  if (!comments?.length) { showError('A IA não retornou comentários. Tente novamente.'); return; }

  const legendHtml = `
    <div class="legend">
      <span class="legend-item"><span class="legend-dot" style="background:var(--s-pos)"></span> Positivo</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--s-crit)"></span> Crítico</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--s-neu)"></span> Neutro</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--s-mix)"></span> Misto</span>
    </div>`;

  const cardsHtml = comments.map(c => {
    const sentiment = ['positive','critical','neutral','mixed'].includes(c.sentiment) ? c.sentiment : 'neutral';
    return `
      <div class="comment-card" data-sentiment="${escHtml(sentiment)}">
        <div class="comment-avatar">${escHtml(c.emoji || '💬')}</div>
        <div class="comment-body">
          <div class="comment-meta">
            <span class="comment-name">${escHtml(c.name || 'Anônimo')}</span>
            <span class="comment-role">${escHtml(c.role || '')}</span>
          </div>
          <p class="comment-text">${escHtml(c.comment || '')}</p>
        </div>
      </div>`;
  }).join('');

  resultsArea.innerHTML = `
    <div class="comments-header">
      <span>reações simuladas</span>
      <span class="comments-count">${comments.length} personas</span>
    </div>
    ${legendHtml}
    <div class="comments-feed">${cardsHtml}</div>`;
}

// ——— Error ———————————————————————————————————————————————
function showError(msg) {
  resultsArea.innerHTML = `
    <div class="error-state">
      <span class="err-icon">⚠️</span>
      <span class="err-title">Algo deu errado</span>
      <span class="err-desc">${escHtml(msg)}</span>
    </div>`;
}

// ——— Error humanizer ————————————————————————————————————
function humanizeError(err, provider) {
  const msg = err.message || '';
  // Gemini quota / rate limit
  if (msg.includes('free_tier') || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'Cota gratuita do Gemini atingida. Tente trocar para gemini-1.5-flash no seletor de modelo, ou aguarde alguns minutos e tente novamente.';
  }
  if (msg.includes('retry') && msg.includes('s.')) {
    // extract seconds from message like "retry in 16.9s"
    const match = msg.match(/(\d+\.?\d*)\s*s/);
    const secs  = match ? Math.ceil(parseFloat(match[1])) : 30;
    return `Limite de requisições atingido. Aguarde ${secs} segundo${secs !== 1 ? 's' : ''} e tente novamente.`;
  }
  if (msg.includes('API key') || msg.includes('invalid') || msg.includes('401')) {
    return 'Chave de API inválida. Verifique se você copiou a chave corretamente.';
  }
  if (msg.includes('CORS') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return `Erro de rede ao conectar à API${provider === 'anthropic' ? ' — a Anthropic bloqueia chamadas diretas do navegador (precisa de proxy CORS)' : '. Verifique sua conexão'}.`;
  }
  // Trim long technical messages (e.g. Gemini quota dumps)
  if (msg.length > 200) {
    return msg.substring(0, 197) + '…';
  }
  return msg;
}

// ——— Util ————————————————————————————————————————————————
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
