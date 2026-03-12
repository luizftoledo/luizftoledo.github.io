# Portfolio Chatbot Setup

This portfolio chatbot is designed to answer questions using only the content from this site and to attach source links from the portfolio itself.

## Architecture

- Frontend widget: [index.html](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/index.html) + [scripts/portfolio-chat.js](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/scripts/portfolio-chat.js)
- Frontend endpoint config: [scripts/portfolio-chat.config.js](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/scripts/portfolio-chat.config.js)
- Corpus: [data/portfolio-chat-corpus.json](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/data/portfolio-chat-corpus.json)
- Corpus builder: [scripts/build_portfolio_chat_corpus.mjs](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/scripts/build_portfolio_chat_corpus.mjs)
- Backend source: [api/portfolio-chat.js](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/api/portfolio-chat.js)
- Standalone API packager: [scripts/prepare_portfolio_chat_api.mjs](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/scripts/prepare_portfolio_chat_api.mjs)
- Standalone API deploy folder: [portfolio-chat-api](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/portfolio-chat-api)

GitHub Pages by itself cannot keep a Gemini key secret, because any browser-side call exposes it. To keep the key protected, you need one of these setups:

1. Deploy the whole site to Vercel and keep `GEMINI_API_KEY` in Vercel env vars.
2. Keep the site on GitHub Pages and deploy only the API somewhere else, then point the frontend to that API URL.

## If you keep GitHub Pages

This repo is already set up for that model.

1. Rebuild the corpus:

```bash
node scripts/build_portfolio_chat_corpus.mjs
```

2. Prepare the standalone API folder:

```bash
node scripts/prepare_portfolio_chat_api.mjs
```

3. Deploy [portfolio-chat-api](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/portfolio-chat-api) on Vercel.

4. Add `GEMINI_API_KEY` in that Vercel project.

5. Set `PORTFOLIO_CHAT_ALLOWED_ORIGINS=https://luizftoledo.github.io`.

6. Paste the deployed endpoint into [scripts/portfolio-chat.config.js](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/scripts/portfolio-chat.config.js):

```js
window.PORTFOLIO_CHAT_CONFIG = {
  endpoint: "https://your-portfolio-chat-api.vercel.app/api/portfolio-chat",
};
```

Optional Vercel environment variables:

- `PORTFOLIO_CHAT_MODEL`
  Default: `gemini-2.5-flash`
- `PORTFOLIO_CHAT_EMBEDDING_MODEL`
  Default: `gemini-embedding-2-preview`

## Updating the knowledge base

Whenever the site content changes, rebuild the corpus:

```bash
node scripts/build_portfolio_chat_corpus.mjs
node scripts/prepare_portfolio_chat_api.mjs
```

That regenerates [data/portfolio-chat-corpus.json](/Users/luizfernandotoledo/Desktop/Code_folder/cursor_testes/luizftoledo.github.io/data/portfolio-chat-corpus.json) and refreshes the standalone deploy folder.

## Notes on Google models

- The retrieval layer is prepared for Gemini embeddings and currently defaults to `gemini-embedding-2-preview`.
- For this portfolio, most content is text, so the multimodal embedding model is useful but not strictly required.
- If preview access becomes an issue, switch to `PORTFOLIO_CHAT_EMBEDDING_MODEL=gemini-embedding-001`.
