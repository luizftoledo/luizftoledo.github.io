# Portfolio Chat API

Standalone deployment package for the portfolio chatbot API.

## Deploy on Vercel

1. Create a new Vercel project and choose this folder as the project root.
2. Add the environment variable `GEMINI_API_KEY`.
3. Deploy.
4. Copy the deployed endpoint URL and paste it into `scripts/portfolio-chat.config.js` in the GitHub Pages site:

```js
window.PORTFOLIO_CHAT_CONFIG = {
  endpoint: "https://your-portfolio-chat-api.vercel.app/api/portfolio-chat",
};
```

Optional environment variables:

- `PORTFOLIO_CHAT_MODEL`
- `PORTFOLIO_CHAT_EMBEDDING_MODEL`
- `PORTFOLIO_CHAT_ALLOWED_ORIGINS`

For GitHub Pages, use:

```
PORTFOLIO_CHAT_ALLOWED_ORIGINS=https://luizftoledo.github.io
```
