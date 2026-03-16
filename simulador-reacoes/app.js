/**
 * Journalistic Reaction Simulator — app.js
 * Calls the OpenAI API from the browser to generate simulated comments
 */

// ——— Constants ——————————————————————————————————————————
const LS_KEY_API = 'sim_openai_key';
const LS_KEY_MODEL = 'sim_model';

const PERSONAS = [
  {
    id: 'leitor_neutro',
    emoji: '🗣️',
    name: 'Leitor Neutro',
    role: 'Cidadão sem filiação política clara',
    sentiment_hint: 'pragmatic, neither strongly supportive nor critical, asks practical questions',
  },
  {
    id: 'leitor_petista',
    emoji: '🔴',
    name: 'Leitor Petista',
    role: 'Apoiador do PT / esquerda brasileira',
    sentiment_hint: 'supports the investigation if it exposes right-wing corruption, suspicious if it involves PT allies, uses leftist framing',
  },
  {
    id: 'leitor_bolsonarista',
    emoji: '🟡',
    name: 'Leitor Bolsonarista',
    role: 'Apoiador de Bolsonaro / direita conservadora',
    sentiment_hint: 'accuses media bias (especially BBC/Globo), defends the right-wing, suspicious of "communism" or left-wing motives, may use terms like "mídia podre"',
  },
  {
    id: 'leitor_liberal',
    emoji: '🎩',
    name: 'Leitor Liberal',
    role: 'Direita liberal, pró-mercado, antipetista e antiBolsonaro',
    sentiment_hint: 'criticizes both sides, focus on rule of law and institutions, uses economic and institutional framing, frustrated with Brazilian politics overall',
  },
  {
    id: 'leitor_conspiracao',
    emoji: '🕳️',
    name: 'Leitor Conspiração',
    role: 'Adepto de teorias da conspiração',
    sentiment_hint: 'dismisses the article as a distraction from the "real" story, accuses globalists or powerful elites, references globalism, deep state or "agenda oculta", uses memes and sarcasm',
  },
  {
    id: 'advogado',
    emoji: '⚖️',
    name: 'Especialista Jurídico',
    role: 'Advogado / jurista',
    sentiment_hint: 'analytical, focuses on legal implications, constitutional angles, and due process, neutral or mixed',
  },
  {
    id: 'abordado',
    emoji: '🛡️',
    name: 'Pessoa Abordada',
    role: 'Sujeito da matéria (defesa)',
    sentiment_hint: 'defensive, denying wrongdoing, reframing the narrative, accusing the journalist of bias or selective use of data',
  },
  {
    id: 'ativista',
    emoji: '📢',
    name: 'Ativista / ONG',
    role: 'Ativista de direitos humanos ou meio ambiente',
    sentiment_hint: 'positive about exposure, calls for accountability and concrete action, references systemic failures',
  },
  {
    id: 'jornalista',
    emoji: '🎙️',
    name: 'Jornalista Concorrente',
    role: 'Colega de imprensa',
    sentiment_hint: 'professional tone, notes what the story confirms or what it might be missing methodologically, may be impressed or subtly competitive',
  },
  {
    id: 'academico',
    emoji: '🎓',
    name: 'Acadêmico / Analista',
    role: 'Pesquisador / professor universitário',
    sentiment_hint: 'neutral, analytical, contextualizes the story within broader historical or structural patterns in Brazil',
  },
];

// ——— DOM refs ————————————————————————————————————————————
const formEl        = document.getElementById('simForm');
const apiKeyInput   = document.getElementById('apiKey');
const modelSelect   = document.getElementById('modelSelect');
const articleInput  = document.getElementById('articleText');
const contextInput  = document.getElementById('contextText');
const outletInput   = document.getElementById('outletName');
const keyToggleBtn  = document.getElementById('keyToggle');
const submitBtn     = document.getElementById('submitBtn');
const resultsArea   = document.getElementById('resultsArea');
const postPreview   = document.getElementById('postPreview');
const previewTitle  = document.getElementById('previewTitle');
const previewBody   = document.getElementById('previewBody');
const previewOutlet = document.getElementById('previewOutlet');

// ——— Init: restore saved values ——————————————————————————
window.addEventListener('DOMContentLoaded', () => {
  const savedKey   = localStorage.getItem(LS_KEY_API) || '';
  const savedModel = localStorage.getItem(LS_KEY_MODEL) || 'gpt-4o-mini';
  if (savedKey)   apiKeyInput.value = savedKey;
  if (modelSelect) modelSelect.value = savedModel;
});

// ——— API key visibility toggle ——————————————————————————
keyToggleBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  keyToggleBtn.innerHTML = isPassword ? '🙈' : '👁️';
});

// ——— Persist settings on change ——————————————————————————
apiKeyInput.addEventListener('change', () => {
  localStorage.setItem(LS_KEY_API, apiKeyInput.value.trim());
});
modelSelect.addEventListener('change', () => {
  localStorage.setItem(LS_KEY_MODEL, modelSelect.value);
});

// ——— Form submit ——————————————————————————————————————————
formEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const apiKey  = apiKeyInput.value.trim();
  const model   = modelSelect.value;
  const article = articleInput.value.trim();
  const context = contextInput.value.trim();
  const outlet  = outletInput.value.trim() || 'Veículo jornalístico';

  // Basic validation
  if (!apiKey) return showError('Insira sua chave de API OpenAI para continuar.');
  if (!article || article.length < 40) return showError('Insira o texto jornalístico completo (ao menos 40 caracteres).');

  // Persist
  localStorage.setItem(LS_KEY_API, apiKey);

  // Update UI
  submitBtn.disabled = true;
  submitBtn.textContent = 'Simulando reações…';

  renderPostPreview(article, outlet);
  showSkeleton();

  try {
    const comments = await callLLM(apiKey, model, article, context, outlet);
    renderComments(comments);
  } catch (err) {
    showError(err.message || 'Erro desconhecido. Verifique sua chave de API e tente novamente.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Simular reações';
  }
});

// ——— Build + call LLM ————————————————————————————————————
async function callLLM(apiKey, model, article, context, outlet) {
  const personaDescriptions = PERSONAS.map(p =>
    `{"id":"${p.id}","emoji":"${p.emoji}","name":"${p.name}","role":"${p.role}","sentiment_hint":"${p.sentiment_hint}"}`
  ).join(',\n');

  const systemPrompt = `You are a social simulation engine for investigative journalism.
Your task is to generate realistic, distinct simulated reactions to a journalistic article.
Each reaction must be from a DIFFERENT persona type with a unique voice, tone and perspective.
Comments must be in Brazilian Portuguese.
Return ONLY a valid JSON array with exactly ${PERSONAS.length} objects. No markdown. No explanation.
Each object must have these keys: id (string), emoji (string), name (string), role (string), sentiment (one of: positive/critical/neutral/mixed), comment (string, 2-4 realistic sentences).`;

  const userPrompt = `Article / journalistic text:
"""
${article}
"""

${context ? `Additional context about people/organizations mentioned:\n"""\n${context}\n"""\n` : ''}
Outlet / publication: ${outlet}

Generate one realistic comment for each of these ${PERSONAS.length} personas:
[${personaDescriptions}]

Return a JSON array. Each element: { "id", "emoji", "name", "role", "sentiment", "comment" }.`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      temperature: 0.85,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    const msg = errBody?.error?.message || `Erro HTTP ${resp.status}`;
    throw new Error(msg);
  }

  const data = await resp.json();
  const raw  = data.choices?.[0]?.message?.content || '';

  // Parse JSON — the model may wrap in a key
  let parsed;
  try {
    const obj = JSON.parse(raw);
    // Some models return { "comments": [...] } or { "reactions": [...] } or the array directly
    if (Array.isArray(obj)) {
      parsed = obj;
    } else {
      // find first array value
      const arr = Object.values(obj).find(v => Array.isArray(v));
      if (!arr) throw new Error('Formato de resposta inesperado da IA.');
      parsed = arr;
    }
  } catch {
    throw new Error('A IA retornou um formato inválido. Tente novamente.');
  }

  return parsed;
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

// ——— Skeleton loader —————————————————————————————————————
function showSkeleton() {
  resultsArea.innerHTML = `
    <div class="skeleton-feed">
      ${Array.from({length: 5}, () => `
      <div class="skeleton-card">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line s"></div>
          <div class="skeleton-line l"></div>
          <div class="skeleton-line m"></div>
          <div class="skeleton-line f"></div>
        </div>
      </div>`).join('')}
    </div>`;
}

// ——— Render comment cards ————————————————————————————————
function renderComments(comments) {
  if (!comments || !comments.length) {
    showError('A IA não retornou comentários. Tente novamente.');
    return;
  }

  // Sentiment legend
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

// ——— Error state —————————————————————————————————————————
function showError(msg) {
  resultsArea.innerHTML = `
    <div class="error-state">
      <span class="err-icon">⚠️</span>
      <span class="err-title">Algo deu errado</span>
      <span class="err-desc">${escHtml(msg)}</span>
    </div>`;
}

// ——— Helpers —————————————————————————————————————————————
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
