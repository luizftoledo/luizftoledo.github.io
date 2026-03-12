#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteRoot = path.resolve(__dirname, "..");
const outputPath = path.join(siteRoot, "data", "portfolio-chat-corpus.json");
const siteBaseUrl = "https://luizftoledo.github.io";

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
  },
];

const SKIP_SECTION_TITLES = new Set([
  "ask me about my work",
  "phantom thieves",
]);

const BLOCK_TAG_PATTERN =
  /<\/(p|li|h1|h2|h3|h4|div|article|section|ul|ol|footer|header)>/gi;

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
  url,
  text,
  position,
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
    sourceLabel: sectionTitle ? `${pageTitle} - ${sectionTitle}` : pageTitle,
    url,
    text: cleanText,
    excerpt: cleanText.slice(0, 240),
    position,
  };
}

async function buildCorpus() {
  const corpus = {
    generatedAt: new Date().toISOString(),
    baseUrl: siteBaseUrl,
    chunks: [],
  };

  for (const pageConfig of pageConfigs) {
    const filePath = path.join(siteRoot, pageConfig.file);
    const html = await readFile(filePath, "utf8");
    const pageTitle = extractTitle(html, pageConfig.file);
    let pagePosition = 0;

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
            position: pagePosition++,
          });
          if (chunk) {
            corpus.chunks.push(chunk);
          }
        });
      }
    }
  }

  corpus.chunks.push(...CURATED_CHUNKS);

  return corpus;
}

const corpus = await buildCorpus();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${corpus.chunks.length} chunks to ${path.relative(siteRoot, outputPath)}`,
);
