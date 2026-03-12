#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteRoot = path.resolve(__dirname, "..");
const outputPath = path.join(siteRoot, "data", "portfolio-chat-corpus.json");
const siteBaseUrl = "https://luizftoledo.github.io";
const siteOrigin = new URL(siteBaseUrl).origin;
const remoteHelperPath = path.join(__dirname, "extract_remote_source.py");
const youtubeTranscriptHelperPath = path.join(
  __dirname,
  "fetch_youtube_transcript.py",
);

const MAX_REMOTE_SOURCES = 48;
const MAX_WEB_CHUNKS_PER_SOURCE = 4;
const MAX_WEB_TEXT_CHARS = 4_800;
const MAX_TRANSCRIPT_CHUNKS_PER_VIDEO = 8;
const MAX_VIDEO_METADATA_CHARS = 2_400;
const REMOTE_CONCURRENCY = 4;
const YOUTUBE_CONCURRENCY = 2;
const REMOTE_FETCH_TIMEOUT_MS = 20_000;
const YOUTUBE_METADATA_TIMEOUT_MS = 25_000;
const YOUTUBE_SUBTITLE_TIMEOUT_MS = 40_000;
const PYTHON_MAX_BUFFER = 12 * 1024 * 1024;
const YTDLP_MAX_BUFFER = 8 * 1024 * 1024;

const pageConfigs = [
  {
    file: "index.html",
    url: `${siteBaseUrl}/`,
    selectors: [
      { tag: "section", requireId: false },
      { tag: "footer", requireId: false, sectionTitle: "Get in touch" },
    ],
  },
  {
    file: "resume.html",
    url: `${siteBaseUrl}/resume.html`,
    selectors: [
      {
        tag: "div",
        pattern:
          /<div class="resume-section"([^>]*)>([\s\S]*?)(?=<div class="resume-section"|\s*<\/div>\s*<\/section>)/gi,
      },
      { tag: "footer", requireId: false, sectionTitle: "Get in touch" },
    ],
  },
];

const CURATED_CHUNKS = [
  {
    id: "index.html:about-curated:1",
    page: "index.html",
    pageTitle: "Luiz Fernando Toledo - Data & Investigative Journalist",
    sectionTitle: "About Luiz Fernando Toledo",
    sourceLabel:
      "Luiz Fernando Toledo - Data & Investigative Journalist - About Luiz Fernando Toledo",
    url: `${siteBaseUrl}/#about`,
    text:
      "Luiz Fernando Toledo is a Brazilian journalist, researcher and instructor based in London. His reporting has been translated into multiple languages and focuses on investigations, public-interest reporting, transparency, environmental crimes and public spending.",
    excerpt:
      "Luiz Fernando Toledo is a Brazilian journalist, researcher and instructor based in London. His reporting has been translated into multiple languages and focuses on investigations, public-interest reporting, transparency, environmental crimes and public spending.",
    position: 9990,
    sourceType: "curated",
  },
  {
    id: "index.html:grants-curated:1",
    page: "index.html",
    pageTitle: "Luiz Fernando Toledo - Data & Investigative Journalist",
    sectionTitle: "Scholarships, Fellowships and Grants",
    sourceLabel:
      "Luiz Fernando Toledo - Data & Investigative Journalist - Scholarships, Fellowships and Grants",
    url: `${siteBaseUrl}/#grants`,
    text:
      "The portfolio lists grants, scholarships and fellowships including Together for Conservation from Earth Journalism Network (2024), the Reagan-Fascell fellowship from the National Endowment for Democracy (2023-2024), Person of the Year 2022 from the Brazilian American Chamber of Commerce, a Columbia Journalism School scholarship covering US$ 91,500 in tuition (2021-2022), ICFJ Latin America Grantee 2020, a full scholarship for the FGV public administration master's program (2019), Instituto Ling's Visionary Journalist scholarship worth US$ 60,000 (2019), and the ICFJ Emerging Leaders Program fellowship (2018).",
    excerpt:
      "The portfolio lists grants, scholarships and fellowships including Together for Conservation from Earth Journalism Network (2024), the Reagan-Fascell fellowship from NED, a Columbia Journalism School scholarship, Instituto Ling's US$ 60,000 scholarship and ICFJ programs.",
    position: 9991,
    sourceType: "curated",
  },
];

const SKIP_SECTION_TITLES = new Set([
  "ask me about my work",
  "phantom thieves",
]);

const BLOCK_TAG_PATTERN =
  /<\/(p|li|h1|h2|h3|h4|div|article|section|ul|ol|footer|header)>/gi;

const SKIP_REMOTE_HOSTNAMES = new Set([
  "twitter.com",
  "www.twitter.com",
  "x.com",
  "www.x.com",
  "linkedin.com",
  "www.linkedin.com",
  "instagram.com",
  "www.instagram.com",
  "open.spotify.com",
  "spotify.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdnjs.cloudflare.com",
  "schema.org",
]);

const SKIP_REMOTE_PATH_PATTERNS = [
  /\.(?:png|jpe?g|gif|webp|svg|mp4|webm|mov|zip|csv)$/i,
];

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&hellip;/gi, "...")
    .replace(/&rsaquo;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function stripHtml(value) {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(BLOCK_TAG_PATTERN, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " "),
  );
}

function normalizeWhitespace(value) {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function splitIntoParagraphs(text) {
  return normalizeWhitespace(text)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(
      (line) =>
        line.length > 35 ||
        (/^[A-Z][A-Za-z0-9/&,.'()\- ]{2,72}$/.test(line) &&
          !/^\d{4}$/.test(line)),
    );
}

function buildTextChunks(lines, maxLength = 750) {
  const chunks = [];
  let current = "";

  const isHeadingLike = (line) => {
    const wordCount = line.split(/\s+/).filter(Boolean).length;
    return line.length <= 72 && wordCount <= 10 && !/[.!?:]$/.test(line);
  };

  for (const line of lines) {
    if (isHeadingLike(line)) {
      if (current) {
        chunks.push(current);
      }
      current = line;
      continue;
    }

    const next = current ? `${current} ${line}` : line;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = line;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function extractTitle(html, fallback) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return normalizeWhitespace(stripHtml(match ? match[1] : fallback));
}

function extractHeading(block, fallback = "") {
  const match = block.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  return normalizeWhitespace(stripHtml(match ? match[1] : fallback));
}

function parseAttributes(rawAttributes = "") {
  const attrs = {};
  for (const match of rawAttributes.matchAll(/([a-zA-Z0-9:-]+)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function selectorMatches(attrs, selector) {
  if (selector.className) {
    const classList = (attrs.class || "").split(/\s+/).filter(Boolean);
    return classList.includes(selector.className);
  }
  return true;
}

function extractBlocks(html, selector) {
  const pattern =
    selector.pattern ||
    new RegExp(`<${selector.tag}\\b([^>]*)>([\\s\\S]*?)<\\/${selector.tag}>`, "gi");
  const blocks = [];

  for (const match of html.matchAll(pattern)) {
    const attrs = parseAttributes(match[1]);
    if (!selectorMatches(attrs, selector)) {
      continue;
    }
    blocks.push({
      attrs,
      html: match[2],
      tag: selector.tag,
    });
  }

  return blocks;
}

function buildChunk({
  chunkId,
  page,
  pageTitle,
  sectionTitle,
  sourceLabel,
  url,
  text,
  excerpt,
  position,
  sourceType = "local",
}) {
  const cleanText = normalizeWhitespace(text);
  if (cleanText.length < 100 && sectionTitle !== "Get in touch") {
    return null;
  }

  return {
    id: chunkId,
    page,
    pageTitle,
    sectionTitle,
    sourceLabel: sourceLabel || (sectionTitle ? `${pageTitle} - ${sectionTitle}` : pageTitle),
    url,
    text: cleanText,
    excerpt: normalizeWhitespace(excerpt || cleanText).slice(0, 240),
    position,
    sourceType,
  };
}

function cleanRemoteLabel(value, fallback = "") {
  const label = normalizeWhitespace(stripHtml(value || ""));
  return label || fallback;
}

function isSameSiteUrl(url) {
  return url.origin === siteOrigin;
}

function isYouTubeHost(hostname) {
  return (
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "youtu.be"
  );
}

function extractYouTubeVideoId(url) {
  if (url.hostname === "youtu.be") {
    return url.pathname.replace(/^\/+/, "").split("/")[0];
  }

  if (url.pathname.startsWith("/embed/")) {
    return url.pathname.split("/")[2] || "";
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v") || "";
  }

  if (url.pathname.startsWith("/shorts/")) {
    return url.pathname.split("/")[2] || "";
  }

  return "";
}

function parseYouTubeStartSeconds(url) {
  const directValue = url.searchParams.get("start") || url.searchParams.get("t");
  const hashValue = url.hash.replace(/^#/, "");
  const raw = directValue || (hashValue.startsWith("t=") ? hashValue.slice(2) : "");

  if (!raw) {
    return 0;
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  const match = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!match) {
    return 0;
  }

  return (
    Number(match[1] || 0) * 3600 +
    Number(match[2] || 0) * 60 +
    Number(match[3] || 0)
  );
}

function buildYouTubeWatchUrl(videoId, seconds = 0) {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", videoId);
  if (seconds > 0) {
    url.searchParams.set("t", `${Math.floor(seconds)}s`);
  }
  return url.toString();
}

function normalizeRemoteSource(rawUrl, baseUrl) {
  try {
    const url = new URL(rawUrl, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    if (isSameSiteUrl(url)) {
      return null;
    }

    const hostname = url.hostname.toLowerCase();
    if (SKIP_REMOTE_HOSTNAMES.has(hostname)) {
      return null;
    }

    if (SKIP_REMOTE_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname))) {
      return null;
    }

    if (isYouTubeHost(hostname)) {
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        return null;
      }

      return {
        kind: "youtube",
        url: buildYouTubeWatchUrl(videoId),
        dedupeKey: `youtube:${videoId}`,
        videoId,
        startSeconds: parseYouTubeStartSeconds(url),
      };
    }

    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["si", "feature", "fbclid", "gclid"].includes(key)) {
        url.searchParams.delete(key);
      }
    }

    return {
      kind: "web",
      url: url.toString(),
      dedupeKey: url.toString(),
    };
  } catch (error) {
    return null;
  }
}

function describeSourceContexts(source) {
  const sections = [...new Set(source.contexts.map((item) => item.sectionTitle).filter(Boolean))];
  const labels = [...new Set(source.contexts.map((item) => item.label).filter(Boolean))];
  const parts = [];

  if (sections.length === 1) {
    parts.push(`Linked from the portfolio section "${sections[0]}".`);
  } else if (sections.length > 1) {
    parts.push(
      `Linked from the portfolio sections ${sections
        .slice(0, 3)
        .map((value) => `"${value}"`)
        .join(", ")}.`,
    );
  }

  if (labels.length === 1 && labels[0].length > 8) {
    parts.push(`Portfolio link label: "${labels[0]}".`);
  }

  return parts.join(" ");
}

function addRemoteSource(remoteSources, descriptor) {
  if (!descriptor || remoteSources.has(descriptor.dedupeKey)) {
    const existing = remoteSources.get(descriptor?.dedupeKey);
    if (existing && descriptor?.contexts?.length) {
      existing.contexts.push(...descriptor.contexts);
    }
    return;
  }

  remoteSources.set(descriptor.dedupeKey, descriptor);
}

function discoverRemoteSourcesInBlock({
  blockHtml,
  pageUrl,
  pageFile,
  pageTitle,
  sectionTitle,
  sourceUrl,
}) {
  const remoteSources = new Map();
  const sharedContext = {
    page: pageFile,
    pageTitle,
    sectionTitle,
    sourceUrl,
  };

  for (const match of blockHtml.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = parseAttributes(match[1]);
    const normalized = normalizeRemoteSource(attrs.href, pageUrl);
    if (!normalized) {
      continue;
    }

    addRemoteSource(remoteSources, {
      ...normalized,
      label:
        cleanRemoteLabel(match[2], attrs.title || attrs["aria-label"] || attrs.href) ||
        normalized.url,
      contexts: [
        {
          ...sharedContext,
          label: cleanRemoteLabel(match[2], attrs.title || attrs["aria-label"] || ""),
        },
      ],
    });
  }

  for (const match of blockHtml.matchAll(/<iframe\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const normalized = normalizeRemoteSource(attrs.src, pageUrl);
    if (!normalized) {
      continue;
    }

    addRemoteSource(remoteSources, {
      ...normalized,
      label: cleanRemoteLabel(attrs.title, "Embedded media"),
      contexts: [
        {
          ...sharedContext,
          label: cleanRemoteLabel(attrs.title, "Embedded media"),
        },
      ],
    });
  }

  return [...remoteSources.values()];
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );

  return results.flat();
}

async function extractRemoteDocument(url) {
  const { stdout } = await execFileAsync("python3", [remoteHelperPath, url], {
    cwd: siteRoot,
    timeout: REMOTE_FETCH_TIMEOUT_MS,
    maxBuffer: PYTHON_MAX_BUFFER,
  });

  return JSON.parse(stdout);
}

async function fetchYouTubeMetadata(url) {
  const { stdout } = await execFileAsync(
    "yt-dlp",
    ["--dump-single-json", "--no-warnings", "--skip-download", url],
    {
      cwd: siteRoot,
      timeout: YOUTUBE_METADATA_TIMEOUT_MS,
      maxBuffer: YTDLP_MAX_BUFFER,
    },
  );

  return JSON.parse(stdout);
}

async function fetchYouTubeTranscriptViaApi(videoId) {
  try {
    const { stdout } = await execFileAsync(
      "python3",
      [youtubeTranscriptHelperPath, videoId],
      {
        cwd: siteRoot,
        timeout: YOUTUBE_METADATA_TIMEOUT_MS,
        maxBuffer: PYTHON_MAX_BUFFER,
      },
    );

    const transcript = JSON.parse(stdout);
    if (!Array.isArray(transcript)) {
      return [];
    }

    return transcript
      .map((segment) => ({
        start: Number(segment.start || 0),
        text: normalizeWhitespace(String(segment.text || "")),
      }))
      .filter((segment) => segment.text);
  } catch (error) {
    return [];
  }
}

function parseVttTimestamp(value = "") {
  const clean = value.trim().split(" ")[0];
  const parts = clean.split(":").map(Number);
  const [hours, minutes, seconds] =
    parts.length === 3 ? parts : [0, parts[0] || 0, parts[1] || 0];

  return hours * 3600 + minutes * 60 + seconds;
}

function parseVttTranscript(rawText) {
  const lines = rawText.replace(/\r/g, "").split("\n");
  const segments = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line || line === "WEBVTT" || /^\d+$/.test(line) || line.startsWith("NOTE")) {
      continue;
    }

    if (!line.includes("-->")) {
      continue;
    }

    const start = parseVttTimestamp(line.split("-->")[0]);
    const textLines = [];
    let cursor = index + 1;

    while (cursor < lines.length && lines[cursor].trim()) {
      textLines.push(lines[cursor]);
      cursor += 1;
    }

    index = cursor;

    const text = normalizeWhitespace(
      decodeHtmlEntities(textLines.join(" ").replace(/<[^>]+>/g, " ")),
    );
    if (!text) {
      continue;
    }

    const previous = segments[segments.length - 1];
    if (previous && (previous.text === text || text.endsWith(previous.text))) {
      continue;
    }

    segments.push({ start, text });
  }

  return segments;
}

function buildTranscriptChunks(segments, maxLength = 720) {
  const chunks = [];
  let current = null;

  for (const segment of segments) {
    if (!current) {
      current = {
        start: segment.start,
        parts: [segment.text],
      };
      continue;
    }

    const nextText = `${current.parts.join(" ")} ${segment.text}`.trim();
    if (nextText.length > maxLength) {
      chunks.push({
        start: current.start,
        text: current.parts.join(" "),
      });
      current = {
        start: segment.start,
        parts: [segment.text],
      };
      continue;
    }

    const last = current.parts[current.parts.length - 1];
    if (last !== segment.text) {
      current.parts.push(segment.text);
    }
  }

  if (current) {
    chunks.push({
      start: current.start,
      text: current.parts.join(" "),
    });
  }

  return chunks;
}

async function downloadYouTubeTranscript(url) {
  const videoId = extractYouTubeVideoId(new URL(url));
  const transcriptApiSegments = await fetchYouTubeTranscriptViaApi(videoId);
  if (transcriptApiSegments.length) {
    return transcriptApiSegments;
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "portfolio-chat-youtube-"));

  try {
    await execFileAsync(
      "yt-dlp",
      [
        "--skip-download",
        "--no-warnings",
        "--write-auto-subs",
        "--write-subs",
        "--sub-langs",
        "en.*,pt-BR.*,pt.*,es.*",
        "--sub-format",
        "vtt",
        "--output",
        path.join(tempDir, "%(id)s.%(ext)s"),
        url,
      ],
      {
        cwd: siteRoot,
        timeout: YOUTUBE_SUBTITLE_TIMEOUT_MS,
        maxBuffer: YTDLP_MAX_BUFFER,
      },
    );

    const files = await readdir(tempDir);
    const subtitleFile = files.find((file) => file.endsWith(".vtt"));
    if (!subtitleFile) {
      return [];
    }

    const subtitlePath = path.join(tempDir, subtitleFile);
    const raw = await readFile(subtitlePath, "utf8");
    return parseVttTranscript(raw);
  } catch (error) {
    return [];
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function fallbackRemoteChunk(source, position, reason = "") {
  const context = describeSourceContexts(source);
  const fallbackText = [
    context,
    source.label ? `Referenced source: ${source.label}.` : "",
    reason ? `Extraction note: ${reason}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return buildChunk({
    chunkId: `${source.dedupeKey}:fallback`,
    page: `remote:${new URL(source.url).hostname}`,
    pageTitle: source.label || new URL(source.url).hostname,
    sectionTitle: "External source",
    sourceLabel: source.label || new URL(source.url).hostname,
    url: source.url,
    text: fallbackText,
    excerpt: source.label || source.url,
    position,
    sourceType: source.kind === "youtube" ? "youtube-metadata" : "remote-fallback",
  });
}

async function buildWebSourceChunks(source, startPosition) {
  try {
    const extracted = await extractRemoteDocument(source.url);
    const finalUrl = extracted.final_url || source.url;
    const pageTitle =
      normalizeWhitespace(extracted.title || source.label || new URL(finalUrl).hostname) ||
      source.url;
    const context = describeSourceContexts(source);
    const bodyText = normalizeWhitespace((extracted.text || "").slice(0, MAX_WEB_TEXT_CHARS));

    if (!bodyText) {
      const fallback = fallbackRemoteChunk(
        source,
        startPosition,
        extracted.error || "No readable text extracted",
      );
      return fallback ? [fallback] : [];
    }

    const lines = splitIntoParagraphs(bodyText);
    const textChunks = buildTextChunks(lines, 820).slice(0, MAX_WEB_CHUNKS_PER_SOURCE);
    const chunks = textChunks
      .map((chunkText, index) =>
        buildChunk({
          chunkId: `${source.dedupeKey}:${index + 1}`,
          page: `remote:${new URL(finalUrl).hostname}`,
          pageTitle,
          sectionTitle: "External source",
          sourceLabel: pageTitle,
          url: finalUrl,
          text: [context, chunkText].filter(Boolean).join(" "),
          excerpt: chunkText,
          position: startPosition + index,
          sourceType: extracted.kind || "html",
        }),
      )
      .filter(Boolean);

    return chunks.length
      ? chunks
      : [fallbackRemoteChunk(source, startPosition, "No chunk survived length filters")].filter(
          Boolean,
        );
  } catch (error) {
    const fallback = fallbackRemoteChunk(
      source,
      startPosition,
      error instanceof Error ? error.message : "Failed to fetch source",
    );
    return fallback ? [fallback] : [];
  }
}

async function buildYouTubeSourceChunks(source, startPosition) {
  try {
    const metadata = await fetchYouTubeMetadata(source.url);
    const title =
      normalizeWhitespace(metadata.title || source.label || `YouTube video ${source.videoId}`) ||
      source.url;
    const description = normalizeWhitespace(
      String(metadata.description || "").slice(0, MAX_VIDEO_METADATA_CHARS),
    );
    const channel = normalizeWhitespace(
      metadata.channel || metadata.uploader || metadata.uploader_id || "YouTube",
    );
    const context = describeSourceContexts(source);
    const transcriptSegments = await downloadYouTubeTranscript(source.url);

    if (transcriptSegments.length) {
      return buildTranscriptChunks(transcriptSegments)
        .slice(0, MAX_TRANSCRIPT_CHUNKS_PER_VIDEO)
        .map((chunk, index) =>
          buildChunk({
            chunkId: `${source.dedupeKey}:transcript:${index + 1}`,
            page: "youtube",
            pageTitle: title,
            sectionTitle: "Video transcript",
            sourceLabel: title,
            url: buildYouTubeWatchUrl(source.videoId, chunk.start),
            text: [context, `Video transcript from ${channel}.`, chunk.text]
              .filter(Boolean)
              .join(" "),
            excerpt: chunk.text,
            position: startPosition + index,
            sourceType: "youtube-transcript",
          }),
        )
        .filter(Boolean);
    }

    const metadataText = [
      context,
      `YouTube video from ${channel}.`,
      description,
    ]
      .filter(Boolean)
      .join(" ");

    const fallback = buildChunk({
      chunkId: `${source.dedupeKey}:metadata`,
      page: "youtube",
      pageTitle: title,
      sectionTitle: "Video metadata",
      sourceLabel: title,
      url: buildYouTubeWatchUrl(source.videoId, source.startSeconds || 0),
      text: metadataText,
      excerpt: description || title,
      position: startPosition,
      sourceType: "youtube-metadata",
    });

    return fallback ? [fallback] : [];
  } catch (error) {
    const fallback = fallbackRemoteChunk(
      source,
      startPosition,
      error instanceof Error ? error.message : "Failed to inspect YouTube source",
    );
    return fallback ? [fallback] : [];
  }
}

async function ingestRemoteSources(discoveredSources, startingPosition) {
  const orderedSources = discoveredSources.slice(0, MAX_REMOTE_SOURCES);
  const chunks = await mapWithConcurrency(
    orderedSources,
    Math.min(REMOTE_CONCURRENCY, YOUTUBE_CONCURRENCY + 2),
    async (source) =>
      source.kind === "youtube"
        ? buildYouTubeSourceChunks(source, 0)
        : buildWebSourceChunks(source, 0),
  );

  return chunks.map((chunk, index) => ({
    ...chunk,
    position: startingPosition + index,
  }));
}

async function buildCorpus() {
  const corpus = {
    generatedAt: new Date().toISOString(),
    baseUrl: siteBaseUrl,
    chunks: [],
    stats: {
      localChunks: 0,
      curatedChunks: CURATED_CHUNKS.length,
      remoteChunks: 0,
      remoteSourcesDiscovered: 0,
      remoteSourcesIngested: 0,
    },
  };

  const discoveredRemoteSources = new Map();

  for (const pageConfig of pageConfigs) {
    const filePath = path.join(siteRoot, pageConfig.file);
    const html = await readFile(filePath, "utf8");
    const pageTitle = extractTitle(html, pageConfig.file);
    let pagePosition = corpus.chunks.length;

    for (const selector of pageConfig.selectors) {
      const blocks = extractBlocks(html, selector);

      for (const block of blocks) {
        const sectionTitle =
          selector.sectionTitle || extractHeading(block.html, pageTitle);
        const normalizedSectionTitle = sectionTitle.toLowerCase();

        if (!sectionTitle || SKIP_SECTION_TITLES.has(normalizedSectionTitle)) {
          continue;
        }

        const anchor =
          block.attrs.id || (selector.tag === "footer" ? "contact" : "");
        const sourceUrl = anchor ? `${pageConfig.url}#${anchor}` : pageConfig.url;
        const rawText = stripHtml(block.html);
        const lines = splitIntoParagraphs(rawText).filter(
          (line) => line.toLowerCase() !== normalizedSectionTitle,
        );
        const textChunks = buildTextChunks(lines);

        textChunks.forEach((chunkText, index) => {
          const chunk = buildChunk({
            chunkId: `${pageConfig.file}:${anchor || slugify(sectionTitle)}:${index + 1}`,
            page: pageConfig.file,
            pageTitle,
            sectionTitle,
            url: sourceUrl,
            text: chunkText,
            excerpt: chunkText,
            position: pagePosition++,
            sourceType: "local",
          });
          if (chunk) {
            corpus.chunks.push(chunk);
          }
        });

        for (const remoteSource of discoverRemoteSourcesInBlock({
          blockHtml: block.html,
          pageUrl: pageConfig.url,
          pageFile: pageConfig.file,
          pageTitle,
          sectionTitle,
          sourceUrl,
        })) {
          addRemoteSource(discoveredRemoteSources, remoteSource);
        }
      }
    }
  }

  corpus.stats.localChunks = corpus.chunks.length;
  corpus.stats.remoteSourcesDiscovered = discoveredRemoteSources.size;

  const remoteChunks = await ingestRemoteSources(
    [...discoveredRemoteSources.values()],
    corpus.chunks.length,
  );

  corpus.chunks.push(...remoteChunks);
  corpus.stats.remoteChunks = remoteChunks.length;
  corpus.stats.remoteSourcesIngested = Math.min(
    discoveredRemoteSources.size,
    MAX_REMOTE_SOURCES,
  );

  corpus.chunks.push(...CURATED_CHUNKS);

  return corpus;
}

const corpus = await buildCorpus();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${corpus.chunks.length} chunks to ${path.relative(siteRoot, outputPath)}`,
);
console.log(
  `Local: ${corpus.stats.localChunks}, remote: ${corpus.stats.remoteChunks}, discovered sources: ${corpus.stats.remoteSourcesDiscovered}`,
);
