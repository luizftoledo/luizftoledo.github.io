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
    id: 'leitor_esq_gov',
    emoji: '🔴',
    name: 'Esquerda governista',
    role: 'Leitor alinhado ao governo de esquerda atual',
    sentiment_hint: 'supports the investigation if it exposes opposition corruption, suspicious if it involves gov allies; uses social justice framing',
  },
  {
    id: 'leitor_esq_rad',
    emoji: '🚩',
    name: 'Esquerda radical',
    role: 'Leitor de esquerda crítica e radical',
    sentiment_hint: 'critical of both establishment right and institutional left; uses class-struggle and systemic anti-capitalist framing',
  },
  {
    id: 'leitor_dir_rad',
    emoji: '🟡',
    name: 'Direita radical',
    role: 'Leitor alinhado à direita conservadora radical',
    sentiment_hint: 'accuses media bias, defends traditional values; uses terms like "mídia tradicional", "doutrinação", "conservadorismo"',
  },
  {
    id: 'leitor_dir_lib',
    emoji: '🎩',
    name: 'Direita liberal',
    role: 'Leitor de direita liberal e pró-mercado',
    sentiment_hint: 'focuses on institutional rule of law, fiscal responsibility; critical of state intervention and polarization',
  },
  {
    id: 'leitor_cético_rad',
    emoji: '🕳️',
    name: 'Cético radical',
    role: 'Leitor que desconfia de narrativas oficiais',
    sentiment_hint: 'dismisses the article as a distraction from hidden agendas; references "élites", "ajuste de contas" or "distração planejada"; uses sarcasm',
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
    id: 'leitor_duvida',
    emoji: '🧐',
    name: 'Leitor em dúvida',
    role: 'Leitor focado em clareza e didatismo',
    sentiment_hint: 'asks for clarification on complex terms or logical gaps; wants to truly understand the facts before forming an opinion; polite but demanding of the journalist\'s clarity; points out if something remained confusing',
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
const customPersonasContainer = document.getElementById('custom-personas-container');
const addPersonaBtn = document.getElementById('addPersonaBtn');

// ——— Init ————————————————————————————————————————————————
window.addEventListener('DOMContentLoaded', () => {
  const savedProvider = localStorage.getItem('sim_provider') || 'openai';
  providerSelect.value = savedProvider;
  updateProviderUI(savedProvider);

  const savedKey = localStorage.getItem(`sim_key_${savedProvider}`) || '';
  if (savedKey) apiKeyInput.value = savedKey;

  const savedProxy = localStorage.getItem('sim_proxy') || '';
  if (proxyUrlInput && savedProxy) proxyUrlInput.value = savedProxy;

  // Custom persona logic
  if (addPersonaBtn) {
    addPersonaBtn.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'custom-persona-row';
      row.innerHTML = `
        <button type="button" class="btn-remove-persona" title="Remover"><i class="fas fa-times"></i></button>
        <div class="form-group">
          <label class="form-label">Nome do perfil</label>
          <input type="text" class="form-input custom-persona-name" placeholder="Ex: Engenheiro civil / Crítico de arte">
        </div>
        <div class="form-group">
          <label class="form-label">Comportamento (Personalidade)</label>
          <textarea class="form-textarea short custom-persona-role" placeholder="Ex: Analisa a viabilidade técnica / Foca no impacto estético..."></textarea>
        </div>
      `;
      customPersonasContainer.appendChild(row);
      
      row.querySelector('.btn-remove-persona').addEventListener('click', () => {
        row.remove();
      });
    });
  }
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

  // Collect custom personas
  const customPersonaRows = document.querySelectorAll('.custom-persona-row');
  const customPersonas = [];
  customPersonaRows.forEach(row => {
    const name = row.querySelector('.custom-persona-name').value.trim();
    const role = row.querySelector('.custom-persona-role').value.trim();
    if (name && role) {
      customPersonas.push({ name, role });
    }
  });

  renderPostPreview(article, outlet);
  showSkeleton();

  try {
    let result;
    if (provider === 'openai')      result = await callOpenAI(apiKey, model, article, context, outlet, customPersonas);
    else if (provider === 'gemini') result = await callGemini(apiKey, model, article, context, outlet, customPersonas);
    else                            result = await callAnthropic(apiKey, model, proxyUrl, article, context, outlet, customPersonas);
    const { reactions, thread } = result;
    renderComments(reactions, thread);
  } catch (err) {
    showError(humanizeError(err, provider));
  } finally {
    clearLoader();
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simular reações';
  }
});

// ——— Prompt builder ——————————————————————————————————————
function buildPrompt(article, context, outlet, customPersonas = []) {
  const personaDescriptions = PERSONAS.map(p =>
    `{"id":"${p.id}","emoji":"${p.emoji}","name":"${p.name}","role":"${p.role}","sentiment_hint":"${p.sentiment_hint}"}`
  ).join(',\n');

  // Add custom personas to the description list for the AI
  const customDescriptions = customPersonas.map((cp, idx) => 
    `{"id":"custom_${idx}","emoji":"👤","name":"${cp.name}","role":"${cp.role}","sentiment_hint":"comentário baseado estritamente nesta personalidade definida pelo usuário"}`
  ).join(',\n');

  const totalPersonaDescriptions = customDescriptions 
    ? personaDescriptions + ',\n' + customDescriptions
    : personaDescriptions;

  const totalCount = PERSONAS.length + customPersonas.length;

  const system = `You are a social simulation engine for investigative journalism.
Generate realistic, distinct simulated reactions to a journalistic article.
Each reaction must be from a DIFFERENT persona with a unique voice and perspective.
Comments must be in Brazilian Portuguese.
Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:
{
  "reactions": [
    ...
  ],
  "threads": {
    "persona_id_X": [
      {
        "emoji": string,
        "name": string,
        "role": string,
        "comment": string (1-2 sentences, responding to persona_id_X, in PT-BR)
      }
    ]
  }
}
The "threads" object should contain deep interactions for at least the 5 comments you assigned more likes. The personas in the threads should debate with each other, referencing previous points or the article. Make it feel like a real conversation.`;

  const user = `Artigo / texto jornalístico:
"""
${article}
"""

${context ? `Contexto adicional:\n"""\n${context}\n"""\n` : ''}Veículo: ${outlet}

Gere um comentário realista para cada uma das ${totalCount} personas:
[${totalPersonaDescriptions}]

Retorne o JSON com "reactions" (${totalCount} itens com likes) e "threads" (interações ricas nos 5 comentários mais populares).`;

  return { system, user };
}

function parseResponse(raw) {
  let obj;
  try { obj = JSON.parse(raw); } catch { throw new Error('A IA retornou um formato inválido. Tente novamente.'); }
  
  if (Array.isArray(obj)) return { reactions: obj, threads: {} };
  
  const reactions = obj.reactions ?? Object.values(obj).find(v => Array.isArray(v)) ?? [];
  const threads   = obj.threads || {};
  
  // Backward compatibility with single 'thread' field
  if (Array.isArray(obj.thread) && reactions.length > 0) {
    const topId = [...reactions].sort((a,b) => (b.likes||0) - (a.likes||0))[0]?.id;
    if (topId) threads[topId] = obj.thread;
  }

  return { reactions, threads };
}


// ——— OpenAI ——————————————————————————————————————————————
async function callOpenAI(apiKey, model, article, context, outlet, customPersonas) {
  const { system, user } = buildPrompt(article, context, outlet, customPersonas);
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
async function callGemini(apiKey, model, article, context, outlet, customPersonas) {
  const { system, user } = buildPrompt(article, context, outlet, customPersonas);
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
async function callAnthropic(apiKey, model, proxyBase, article, context, outlet, customPersonas) {
  const { system, user } = buildPrompt(article, context, outlet, customPersonas);
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
  const customCount = document.querySelectorAll('.custom-persona-row').length;
  const total = PERSONAS.length + customCount;

  if (_loaderInterval) clearInterval(_loaderInterval);

  resultsArea.innerHTML = `
    <div class="loader-state">
      <div class="loader-header">
        <span class="loader-label" id="loaderLabel">Consultando a IA…</span>
        <span class="loader-count" id="loaderCount">0 / ${total}</span>
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
  
  // Combine native personas and custom ones for the label cycle
  const customPersonaNames = Array.from(document.querySelectorAll('.custom-persona-row'))
    .map(row => ({ 
      emoji: '👤', 
      name: row.querySelector('.custom-persona-name').value.trim() || 'Persona Customizada' 
    }));
  
  const allDisplayPersonas = [
    ...PERSONAS.map(p => ({ emoji: p.emoji, name: p.name })),
    ...customPersonaNames
  ];

  _loaderInterval = setInterval(() => {
    if (!label || !counter || !bar) { clearInterval(_loaderInterval); return; }
    const p = allDisplayPersonas[idx % total];
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
function renderComments(reactions, threads = {}) {
  if (!reactions?.length) { showError('A IA não retornou comentários. Tente novamente.'); return; }

  // Sort descending by likes so highest engagement appears first
  const sorted = [...reactions].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const topId  = sorted[0]?.id;

  const legendHtml = `
    <div class="legend">
      <span class="legend-item"><span class="legend-dot" style="background:var(--s-pos)"></span> Positivo</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--s-crit)"></span> Crítico</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--s-neu)"></span> Neutro</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--s-mix)"></span> Misto</span>
    </div>`;

  const likesLabel = (n) => {
    if (!n && n !== 0) return '';
    if (n >= 1000) return `${(n/1000).toFixed(1).replace('.0','')}k`;
    return String(n);
  };

  const renderThread = (thread, isTop) => {
    if (!thread || !thread.length) return '';
    return `
      <div class="thread-block">
        <div class="thread-header">${isTop ? 'Respostas em destaque' : 'Mais respostas'}</div>
        ${thread.map(r => `
          <div class="thread-reply">
            <span class="thread-avatar">${escHtml(r.emoji || '💬')}</span>
            <div class="thread-reply-body">
              <span class="thread-reply-name">${escHtml(r.name || 'Anônimo')}</span>
              <span class="thread-reply-role">${escHtml(r.role || '')}</span>
              <p class="thread-reply-text">${escHtml(r.comment || '')}</p>
            </div>
          </div>`).join('')}
      </div>`;
  };

  const cardsHtml = sorted.map((c, i) => {
    const sentiment = ['positive','critical','neutral','mixed'].includes(c.sentiment) ? c.sentiment : 'neutral';
    const isTop     = c.id === topId;
    const likes     = likesLabel(c.likes);
    return `
      <div class="comment-card${isTop ? ' comment-card--top' : ''}" data-sentiment="${escHtml(sentiment)}">
        <div class="comment-avatar">${escHtml(c.emoji || '💬')}</div>
        <div class="comment-body">
          <div class="comment-meta">
            <span class="comment-name">${escHtml(c.name || 'Anônimo')}</span>
            <span class="comment-role">${escHtml(c.role || '')}</span>
            ${isTop ? '<span class="top-badge">🔥 mais curtido</span>' : ''}
          </div>
          <p class="comment-text">${escHtml(c.comment || '')}</p>
          ${likes ? `<div class="comment-likes">♥︎ ${likes} curtidas</div>` : ''}
        </div>
      </div>
      ${renderThread(threads[c.id], isTop)}`;
  }).join('');

  resultsArea.innerHTML = `
    <div class="comments-header">
      <span>reações simuladas</span>
      <span class="comments-count">${reactions.length} personas</span>
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
