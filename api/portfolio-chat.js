const { readFile } = require("node:fs/promises");
const path = require("node:path");

const GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CORPUS_PATH = path.join(
  process.cwd(),
  "data",
  "portfolio-chat-corpus.json",
);
const CHAT_MODEL = process.env.PORTFOLIO_CHAT_MODEL || "gemini-2.5-flash";
const EMBEDDING_MODEL =
  process.env.PORTFOLIO_CHAT_EMBEDDING_MODEL || "gemini-embedding-2-preview";
const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://luizftoledo.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:4181",
  "http://127.0.0.1:4181",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

let corpusPromise;
let cachedChunkEmbeddings;

function getAllowedOrigins() {
  const envOrigins = (process.env.PORTFOLIO_CHAT_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(envOrigins.length ? envOrigins : [...DEFAULT_ALLOWED_ORIGINS]);
}

function getCorsHeaders(origin = "") {
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = allowedOrigins.has(origin)
    ? origin
    : [...allowedOrigins][0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  }).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value) {
  const stopwords = new Set([
    "a",
    "about",
    "an",
    "and",
    "ao",
    "as",
    "at",
    "com",
    "como",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "for",
    "how",
    "i",
    "in",
    "is",
    "la",
    "me",
    "my",
    "na",
    "nas",
    "no",
    "nos",
    "o",
    "of",
    "on",
    "or",
    "os",
    "para",
    "por",
    "que",
    "se",
    "sobre",
    "the",
    "to",
    "um",
    "uma",
    "what",
    "who",
  ]);

  return (normalizeText(value).match(/[\p{L}\p{N}]{2,}/gu) || []).filter(
    (token) => !stopwords.has(token),
  );
}

function dotProduct(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += (a[i] || 0) * (b[i] || 0);
  }
  return total;
}

function magnitude(vector) {
  return Math.sqrt(dotProduct(vector, vector));
}

function cosineSimilarity(a, b) {
  const denominator = magnitude(a) * magnitude(b);
  if (!denominator) {
    return 0;
  }
  return dotProduct(a, b) / denominator;
}

async function loadCorpus() {
  if (!corpusPromise) {
    corpusPromise = readFile(CORPUS_PATH, "utf8").then((raw) => {
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        chunks: (parsed.chunks || []).map((chunk) => {
          const text = `${chunk.sourceLabel}. ${chunk.text}`;
          const tokens = tokenize(text);
          return {
            ...chunk,
            normalizedText: normalizeText(text),
            tokenCounts: tokens.reduce((counts, token) => {
              counts[token] = (counts[token] || 0) + 1;
              return counts;
            }, {}),
          };
        }),
      };
    });
  }

  return corpusPromise;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function callGoogleApi(endpoint, apiKey, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Google API error (${response.status})`);
  }

  return data;
}

async function embedSingleText(apiKey, text) {
  const endpoint = `${GOOGLE_API_BASE}/${EMBEDDING_MODEL}:embedContent`;
  const data = await callGoogleApi(endpoint, apiKey, {
    model: `models/${EMBEDDING_MODEL}`,
    content: {
      parts: [{ text }],
    },
  });

  return data?.embedding?.values || [];
}

async function getChunkEmbeddings(apiKey, corpus) {
  if (cachedChunkEmbeddings) {
    return cachedChunkEmbeddings;
  }

  const endpoint = `${GOOGLE_API_BASE}/${EMBEDDING_MODEL}:batchEmbedContents`;
  const data = await callGoogleApi(endpoint, apiKey, {
    requests: corpus.chunks.map((chunk) => ({
      model: `models/${EMBEDDING_MODEL}`,
      content: {
        parts: [{ text: `${chunk.sourceLabel}\n${chunk.text}` }],
      },
    })),
  });

  cachedChunkEmbeddings = (data.embeddings || []).map((item) => item.values || []);
  return cachedChunkEmbeddings;
}

function lexicalScore(question, chunk) {
  const questionTokens = [...new Set(tokenize(question))];
  if (!questionTokens.length) {
    return 0;
  }

  const questionText = normalizeText(question);
  let score = 0;

  for (const token of questionTokens) {
    const count = chunk.tokenCounts[token] || 0;
    if (count) {
      score += 1 + Math.log1p(count);
    }
    if (chunk.sectionTitle && normalizeText(chunk.sectionTitle).includes(token)) {
      score += 1.5;
    }
  }

  if (questionText.length > 10 && chunk.normalizedText.includes(questionText)) {
    score += 4;
  }

  return score;
}

async function rankChunks(apiKey, corpus, question) {
  const lexical = corpus.chunks.map((chunk) => ({
    chunk,
    lexicalScore: lexicalScore(question, chunk),
  }));

  try {
    const [queryEmbedding, chunkEmbeddings] = await Promise.all([
      embedSingleText(apiKey, question),
      getChunkEmbeddings(apiKey, corpus),
    ]);

    return lexical
      .map((item, index) => ({
        ...item,
        semanticScore: cosineSimilarity(queryEmbedding, chunkEmbeddings[index] || []),
      }))
      .sort((a, b) => {
        const scoreA = a.semanticScore * 0.75 + a.lexicalScore * 0.25;
        const scoreB = b.semanticScore * 0.75 + b.lexicalScore * 0.25;
        return scoreB - scoreA;
      });
  } catch (error) {
    return lexical.sort((a, b) => b.lexicalScore - a.lexicalScore);
  }
}

function buildConversationContents(history, question) {
  const relevantHistory = Array.isArray(history) ? history.slice(-8) : [];
  const contents = relevantHistory
    .filter((item) => item && typeof item.content === "string" && item.content.trim())
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content.trim() }],
    }));

  contents.push({
    role: "user",
    parts: [{ text: question }],
  });

  return contents;
}

function dedupeSources(rankedChunks, limit = 4) {
  const seen = new Set();
  const sources = [];

  for (const item of rankedChunks) {
    if (sources.length >= limit) {
      break;
    }
    const key = item.chunk.url;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    sources.push({
      label: item.chunk.sourceLabel,
      url: item.chunk.url,
      excerpt: item.chunk.excerpt,
    });
  }

  return sources;
}

function buildSystemInstruction(sources) {
  const sourceContext = sources
    .map(
      (source, index) =>
        `[${index + 1}] ${source.label}\nURL: ${source.url}\nExcerpt: ${source.excerpt}`,
    )
    .join("\n\n");

  return [
    "You are the portfolio assistant for Luiz Fernando Toledo.",
    "Answer using only the site excerpts below.",
    "Reply in the same language as the user's latest message.",
    "If the answer is not supported by the excerpts, say you could not confirm it from the site.",
    "Keep the answer concise, factual, and useful.",
    "Do not invent achievements, dates, roles, clients, awards, or employers.",
    "Do not output a sources section; the UI renders sources separately.",
    "",
    "Available site excerpts:",
    sourceContext,
  ].join("\n");
}

async function generateAnswer(apiKey, question, history, sources) {
  const endpoint = `${GOOGLE_API_BASE}/${CHAT_MODEL}:generateContent`;
  const response = await callGoogleApi(endpoint, apiKey, {
    contents: buildConversationContents(history, question),
    systemInstruction: {
      parts: [{ text: buildSystemInstruction(sources) }],
    },
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      maxOutputTokens: 900,
      responseMimeType: "text/plain",
    },
  });

  return (response.candidates || [])
    .flatMap((candidate) => (((candidate || {}).content || {}).parts || []))
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(
      res,
      405,
      { error: "Method not allowed. Use POST." },
      corsHeaders,
    );
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    sendJson(
      res,
      503,
      {
        error:
          "Missing GEMINI_API_KEY. Configure the environment variable in your deployment platform.",
      },
      corsHeaders,
    );
    return;
  }

  try {
    const body = await readJsonBody(req);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const history = Array.isArray(body.history) ? body.history : [];

    if (!question) {
      sendJson(
        res,
        400,
        { error: "Question is required." },
        corsHeaders,
      );
      return;
    }

    const corpus = await loadCorpus();
    const rankedChunks = await rankChunks(apiKey, corpus, question);
    const topRanked = rankedChunks.filter((item) => item.lexicalScore > 0 || item.semanticScore > 0).slice(0, 6);
    const fallbackRanked = topRanked.length ? topRanked : rankedChunks.slice(0, 4);
    const sources = dedupeSources(fallbackRanked);
    const answer = await generateAnswer(apiKey, question, history, sources);

    sendJson(
      res,
      200,
      {
        answer,
        sources,
        debug: {
          usedEmbeddingModel: EMBEDDING_MODEL,
          usedChatModel: CHAT_MODEL,
          matchedChunks: fallbackRanked.length,
        },
      },
      corsHeaders,
    );
  } catch (error) {
    sendJson(
      res,
      500,
      {
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      corsHeaders,
    );
  }
};
