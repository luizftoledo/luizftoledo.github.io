#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const siteRoot = path.resolve(__dirname, "..");
const apiRoot = path.join(siteRoot, "portfolio-chat-api");

const filesToCopy = [
  {
    from: path.join(siteRoot, "api", "portfolio-chat.js"),
    to: path.join(apiRoot, "api", "portfolio-chat.js"),
  },
  {
    from: path.join(siteRoot, "data", "portfolio-chat-corpus.json"),
    to: path.join(apiRoot, "data", "portfolio-chat-corpus.json"),
  },
];

const vercelConfig = {
  functions: {
    "api/*.js": {
      runtime: "nodejs22.x",
    },
  },
};

const packageJson = {
  name: "portfolio-chat-api",
  private: true,
  version: "1.0.0",
};

const gitignore = `.vercel
`;

const readme = `# Portfolio Chat API

Standalone deployment package for the portfolio chatbot API.

## Deploy on Vercel

1. Create a new Vercel project and choose this folder as the project root.
2. Add the environment variable \`GEMINI_API_KEY\`.
3. Deploy.
4. Copy the deployed endpoint URL and paste it into \`scripts/portfolio-chat.config.js\` in the GitHub Pages site:

\`\`\`js
window.PORTFOLIO_CHAT_CONFIG = {
  endpoint: "https://your-portfolio-chat-api.vercel.app/api/portfolio-chat",
};
\`\`\`

Optional environment variables:

- \`PORTFOLIO_CHAT_MODEL\`
- \`PORTFOLIO_CHAT_EMBEDDING_MODEL\`
- \`PORTFOLIO_CHAT_ALLOWED_ORIGINS\`

For GitHub Pages, use:

\`\`\`
PORTFOLIO_CHAT_ALLOWED_ORIGINS=https://luizftoledo.github.io
\`\`\`
`;

async function ensureSourceFilesExist() {
  for (const file of filesToCopy) {
    await readFile(file.from, "utf8");
  }
}

async function prepare() {
  await ensureSourceFilesExist();
  await rm(apiRoot, { recursive: true, force: true });

  for (const file of filesToCopy) {
    await mkdir(path.dirname(file.to), { recursive: true });
    await cp(file.from, file.to);
  }

  await writeFile(
    path.join(apiRoot, "vercel.json"),
    `${JSON.stringify(vercelConfig, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(apiRoot, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(apiRoot, ".gitignore"), gitignore, "utf8");
  await writeFile(path.join(apiRoot, "README.md"), readme, "utf8");
}

await prepare();
console.log(`Prepared standalone API deployment in ${path.relative(siteRoot, apiRoot)}`);
