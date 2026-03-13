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
  process.env.PORTFOLIO_CHAT_EMBEDDING_MODEL || "gemini-embedding-001";
const EMBEDDING_OUTPUT_DIMENSIONS = 768;
const EMBEDDING_BATCH_SIZE = 50;
const MAX_REQUEST_BYTES = 3.5 * 1024 * 1024;
const MAX_QUESTION_CHARS = 800;
const MAX_HISTORY_ITEMS = 8;
const MAX_HISTORY_CHARS = 1_200;
const MAX_TEXT_ATTACHMENT_BYTES = 180 * 1024;
const MAX_TEXT_ATTACHMENT_CHARS = 12_000;
const MAX_BINARY_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_ATTACHMENT_SUMMARY_CHARS = 280;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const SUPPORTED_TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
]);
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
const rateLimitBuckets = new Map();

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeFileName(value = "") {
  return value.replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 120);
}

function estimateBase64Bytes(value) {
  const clean = value.replace(/\s+/g, "");
  const paddingMatch = clean.match(/=+$/);
  const padding = paddingMatch ? paddingMatch[0].length : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

function extractTextFromResponse(response) {
  return (response.candidates || [])
    .flatMap((candidate) => (((candidate || {}).content || {}).parts || []))
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function stripInlineCitations(value) {
  return value.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, "").trim();
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => {
      const role = item?.role === "assistant" ? "assistant" : "user";
      const content =
        typeof item?.content === "string"
          ? (role === "assistant"
              ? stripInlineCitations(item.content)
              : item.content.trim()
            ).slice(0, MAX_HISTORY_CHARS)
          : "";

      return content ? { role, content } : null;
    })
    .filter(Boolean);
}

function normalizeAttachment(rawAttachment) {
  if (!rawAttachment || typeof rawAttachment !== "object") {
    return null;
  }

  const name = sanitizeFileName(
    typeof rawAttachment.name === "string" ? rawAttachment.name : "attachment",
  );
  const mimeType =
    typeof rawAttachment.mimeType === "string"
      ? rawAttachment.mimeType.trim().toLowerCase()
      : "";

  if (typeof rawAttachment.text === "string") {
    const text = rawAttachment.text.trim().slice(0, MAX_TEXT_ATTACHMENT_CHARS);
    const byteLength = Buffer.byteLength(text, "utf8");

    if (!text) {
      return null;
    }

    if (
      mimeType &&
      !SUPPORTED_TEXT_MIME_TYPES.has(mimeType) &&
      !mimeType.startsWith("text/")
    ) {
      throw createHttpError(400, "Unsupported text attachment type.");
    }

    if (byteLength > MAX_TEXT_ATTACHMENT_BYTES) {
      throw createHttpError(
        413,
        "Text attachment is too large. Keep it under 180 KB.",
      );
    }

    return {
      kind: "text",
      mimeType: mimeType || "text/plain",
      name,
      text,
    };
  }

  const dataBase64 =
    typeof rawAttachment.dataBase64 === "string"
      ? rawAttachment.dataBase64.replace(/\s+/g, "")
      : "";

  if (!dataBase64) {
    return null;
  }

  const isImage = SUPPORTED_IMAGE_MIME_TYPES.has(mimeType);
  const isAudio = SUPPORTED_AUDIO_MIME_TYPES.has(mimeType);

  if (!isImage && !isAudio) {
    throw createHttpError(
      400,
      "Unsupported attachment type. Use image, audio, or plain text.",
    );
  }

  const byteLength = estimateBase64Bytes(dataBase64);
  if (byteLength > MAX_BINARY_ATTACHMENT_BYTES) {
    throw createHttpError(
      413,
      "Image or audio attachment is too large. Keep it under 2 MB.",
    );
  }

  return {
    kind: isImage ? "image" : "audio",
    mimeType,
    name,
    dataBase64,
  };
}

function getClientAddress(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown";
}

function enforceRateLimit(req) {
  const now = Date.now();
  const clientAddress = getClientAddress(req);
  const recent = (rateLimitBuckets.get(clientAddress) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw createHttpError(
      429,
      "Too many chat requests from this address. Wait a minute and try again.",
    );
  }

  recent.push(now);
  rateLimitBuckets.set(clientAddress, recent);

  if (rateLimitBuckets.size > 2_000) {
    for (const [address, timestamps] of rateLimitBuckets.entries()) {
      const active = timestamps.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
      );
      if (active.length) {
        rateLimitBuckets.set(address, active);
      } else {
        rateLimitBuckets.delete(address);
      }
    }
  }
}

function getAllowedOrigins() {
  const envOrigins = (process.env.PORTFOLIO_CHAT_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set(envOrigins.length ? envOrigins : [...DEFAULT_ALLOWED_ORIGINS]);
}

function isAllowedOrigin(origin = "") {
  return !origin || getAllowedOrigins().has(origin);
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
  let totalBytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_REQUEST_BYTES) {
      throw createHttpError(
        413,
        "Request is too large. Shorten the message or use a smaller file.",
      );
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw createHttpError(400, "Invalid JSON payload.");
  }
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

async function embedSingleText(apiKey, text, taskType = "RETRIEVAL_QUERY") {
  const endpoint = `${GOOGLE_API_BASE}/${EMBEDDING_MODEL}:embedContent`;
  const data = await callGoogleApi(endpoint, apiKey, {
    model: `models/${EMBEDDING_MODEL}`,
    content: {
      parts: [{ text: text.slice(0, 3_000) }],
    },
    taskType,
    outputDimensionality: EMBEDDING_OUTPUT_DIMENSIONS,
  });

  return data?.embedding?.values || [];
}

async function getChunkEmbeddings(apiKey, corpus) {
  if (cachedChunkEmbeddings) {
    return cachedChunkEmbeddings;
  }

  const endpoint = `${GOOGLE_API_BASE}/${EMBEDDING_MODEL}:batchEmbedContents`;
  const allEmbeddings = [];

  for (let index = 0; index < corpus.chunks.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = corpus.chunks.slice(index, index + EMBEDDING_BATCH_SIZE);
    const data = await callGoogleApi(endpoint, apiKey, {
      requests: batch.map((chunk) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: `${chunk.sourceLabel}\n${chunk.text}`.slice(0, 3_000) }],
        },
        taskType: "RETRIEVAL_DOCUMENT",
        title: chunk.sourceLabel.slice(0, 512),
        outputDimensionality: EMBEDDING_OUTPUT_DIMENSIONS,
      })),
    });

    allEmbeddings.push(...(data.embeddings || []).map((item) => item.values || []));
  }

  cachedChunkEmbeddings = allEmbeddings;
  return cachedChunkEmbeddings;
}

async function summarizeAttachmentForRetrieval(apiKey, attachment, question) {
  if (!attachment || attachment.kind === "text") {
    return "";
  }

  const endpoint = `${GOOGLE_API_BASE}/${CHAT_MODEL}:generateContent`;
  const response = await callGoogleApi(endpoint, apiKey, {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Summarize this attachment in at most 40 words.",
              "Focus on people, organizations, places, projects, skills, beats, or topics that can help match it to Luiz Fernando Toledo's portfolio.",
              question ? `User question: ${question}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
          {
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.dataBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 100,
      responseMimeType: "text/plain",
    },
  });

  return extractTextFromResponse(response).slice(0, MAX_ATTACHMENT_SUMMARY_CHARS);
}

async function buildRetrievalQuery(apiKey, question, attachment) {
  const parts = [];

  if (question) {
    parts.push(question.trim());
  }

  if (attachment?.kind === "text") {
    parts.push(attachment.text.slice(0, 1_600));
  } else if (attachment) {
    const summary = await summarizeAttachmentForRetrieval(apiKey, attachment, question);
    if (summary) {
      parts.push(summary);
    }
  }

  return parts.join("\n\n").trim() || "Luiz Fernando Toledo portfolio overview";
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
      embedSingleText(apiKey, question, "RETRIEVAL_QUERY"),
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

function buildCurrentTurnParts(question, attachment) {
  const normalizedQuestion = question.trim();
  const prompt =
    normalizedQuestion ||
    (attachment
      ? "The user uploaded a file without a written question. Describe it briefly and connect it to relevant parts of Luiz Fernando Toledo's portfolio when the sources support that."
      : "Answer based on the portfolio excerpts.");

  const parts = [{ text: prompt }];

  if (!attachment) {
    return parts;
  }

  if (attachment.kind === "text") {
    parts.push({
      text: `User uploaded a text file named "${attachment.name}":\n${attachment.text}`,
    });
    return parts;
  }

  parts.push({
    text: `User uploaded ${attachment.kind} file "${attachment.name}" (${attachment.mimeType}).`,
  });
  parts.push({
    inlineData: {
      mimeType: attachment.mimeType,
      data: attachment.dataBase64,
    },
  });

  return parts;
}

function buildConversationContents(history, question, attachment) {
  const relevantHistory = normalizeHistory(history);
  const contents = relevantHistory
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content.trim() }],
    }));

  contents.push({
    role: "user",
    parts: buildCurrentTurnParts(question, attachment),
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
    "Use the portfolio-linked source excerpts below for facts about Luiz Fernando Toledo and his work.",
    "If the user uploaded a file, you may describe that file too, but keep portfolio claims grounded only in those source excerpts.",
    "Reply in the same language as the user's latest message.",
    "Default to a tight answer: at most 1 short paragraph or 3 bullets unless the user explicitly asks for detail.",
    "Unless the user asks for depth, stay under roughly 90 words.",
    "If the answer is not supported by the excerpts, say you could not confirm it from the portfolio sources.",
    "Keep the answer concise, factual, and useful.",
    "Do not invent achievements, dates, roles, clients, awards, or employers.",
    "Every factual claim grounded in the portfolio must end with citation markers like [1] or [2].",
    "Use only the citation numbers provided below.",
    "Do not output a separate sources section or bibliography.",
    "If you mention something from the user's uploaded file itself, do not invent a portfolio citation for that part.",
    "",
    "Available source excerpts:",
    sourceContext,
  ].join("\n");
}

async function generateAnswer(apiKey, question, history, sources, attachment) {
  const endpoint = `${GOOGLE_API_BASE}/${CHAT_MODEL}:generateContent`;
  const response = await callGoogleApi(endpoint, apiKey, {
    contents: buildConversationContents(history, question, attachment),
    systemInstruction: {
      parts: [{ text: buildSystemInstruction(sources) }],
    },
    generationConfig: {
      temperature: 0.15,
      topP: 0.8,
      maxOutputTokens: 800,
      responseMimeType: "text/plain",
    },
  });

  return extractTextFromResponse(response);
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  const corsHeaders = getCorsHeaders(origin);

  if (!isAllowedOrigin(origin)) {
    sendJson(
      res,
      403,
      { error: "Origin not allowed." },
      getCorsHeaders(""),
    );
    return;
  }

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

  try {
    enforceRateLimit(req);
  } catch (error) {
    sendJson(
      res,
      error?.statusCode || 429,
      {
        error: error instanceof Error ? error.message : "Too many requests.",
      },
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
    const question =
      typeof body.question === "string"
        ? body.question.trim().slice(0, MAX_QUESTION_CHARS)
        : "";
    const history = normalizeHistory(body.history);
    const attachment = normalizeAttachment(body.attachment);

    if (!question && !attachment) {
      sendJson(
        res,
        400,
        { error: "Send a question or upload one file." },
        corsHeaders,
      );
      return;
    }

    const corpus = await loadCorpus();
    const retrievalQuery = await buildRetrievalQuery(apiKey, question, attachment);
    const rankedChunks = await rankChunks(apiKey, corpus, retrievalQuery);
    const topRanked = rankedChunks
      .filter((item) => item.lexicalScore > 0 || item.semanticScore > 0)
      .slice(0, 6);
    const fallbackRanked = topRanked.length ? topRanked : rankedChunks.slice(0, 4);
    const sources = dedupeSources(fallbackRanked, 5);
    const answer = await generateAnswer(apiKey, question, history, sources, attachment);

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
      error?.statusCode || 500,
      {
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      corsHeaders,
    );
  }
};
