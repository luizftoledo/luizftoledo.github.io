document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("portfolioChatForm");
  const input = document.getElementById("portfolioChatInput");
  const submitButton = document.getElementById("portfolioChatSubmit");
  const messages = document.getElementById("portfolioChatMessages");
  const status = document.getElementById("portfolioChatStatus");
  const promptButtons = document.querySelectorAll("[data-chat-question]");

  if (!form || !input || !submitButton || !messages || !status) {
    return;
  }

  const configuredEndpoint = window.PORTFOLIO_CHAT_CONFIG?.endpoint?.trim() || "";
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const endpoint = configuredEndpoint || (isLocalHost ? "/api/portfolio-chat" : "");
  const history = [];
  let isLoading = false;

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderInline(text) {
    let html = escapeHtml(text);
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return html;
  }

  function renderMarkdown(text) {
    const blocks = text.trim().split(/\n\s*\n/).filter(Boolean);
    if (!blocks.length) {
      return "<p>I could not generate an answer.</p>";
    }

    return blocks
      .map((block) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isList = lines.every((line) => /^[-*]\s+/.test(line));

        if (isList) {
          const items = lines
            .map((line) => `<li>${renderInline(line.replace(/^[-*]\s+/, ""))}</li>`)
            .join("");
          return `<ul>${items}</ul>`;
        }

        const headingMatch = block.match(/^(#{1,3})\s+(.+)$/m);
        if (headingMatch && lines.length === 1) {
          return `<p class="portfolio-chat-heading">${renderInline(headingMatch[2])}</p>`;
        }

        return `<p>${lines.map(renderInline).join("<br>")}</p>`;
      })
      .join("");
  }

  function scrollMessages() {
    messages.scrollTop = messages.scrollHeight;
  }

  function buildSourcesList(sources) {
    if (!Array.isArray(sources) || !sources.length) {
      return null;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "portfolio-chat-sources";

    const title = document.createElement("p");
    title.className = "portfolio-chat-sources-title";
    title.textContent = "Sources";
    wrapper.appendChild(title);

    const list = document.createElement("ul");
    list.className = "portfolio-chat-source-list";

    sources.forEach((source) => {
      const item = document.createElement("li");

      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.label;

      item.appendChild(link);

      if (source.excerpt) {
        const excerpt = document.createElement("p");
        excerpt.textContent = source.excerpt;
        item.appendChild(excerpt);
      }

      list.appendChild(item);
    });

    wrapper.appendChild(list);
    return wrapper;
  }

  function appendMessage(role, text, sources = []) {
    const article = document.createElement("article");
    article.className = `portfolio-chat-message ${
      role === "assistant"
        ? "portfolio-chat-message-assistant"
        : "portfolio-chat-message-user"
    }`;

    const content = document.createElement("div");
    content.className = "portfolio-chat-message-body";
    content.innerHTML = renderMarkdown(text);
    article.appendChild(content);

    const sourceList = buildSourcesList(sources);
    if (sourceList) {
      article.appendChild(sourceList);
    }

    messages.appendChild(article);
    scrollMessages();
  }

  function setStatus(message, hidden = false) {
    status.hidden = hidden;
    if (!hidden) {
      status.textContent = message;
    }
  }

  function disableChat(message) {
    input.disabled = true;
    submitButton.disabled = true;
    form.classList.add("is-disabled");
    promptButtons.forEach((button) => {
      button.disabled = true;
    });
    setStatus(message, false);
  }

  if (!endpoint) {
    disableChat(
      "Chat backend not connected yet. Deploy the standalone API and set its URL in scripts/portfolio-chat.config.js.",
    );
    return;
  }

  function setLoading(nextValue) {
    isLoading = nextValue;
    submitButton.disabled = nextValue;
    input.disabled = nextValue;
    form.classList.toggle("is-loading", nextValue);
    setStatus(nextValue ? "Searching the portfolio..." : "", !nextValue);
  }

  async function askQuestion(question) {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || isLoading) {
      return;
    }

    appendMessage("user", cleanQuestion);
    input.value = "";
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanQuestion,
          history,
        }),
      });
      const raw = await response.text();
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (parseError) {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "The portfolio assistant backend is not available yet. Deploy the API and add the Gemini key on the server.",
        );
      }

      const answer =
        (typeof data.answer === "string" && data.answer.trim()) ||
        "I could not confirm that from the portfolio content.";

      history.push({ role: "user", content: cleanQuestion });
      history.push({ role: "assistant", content: answer });

      appendMessage("assistant", answer, data.sources || []);
    } catch (error) {
      appendMessage(
        "assistant",
        error instanceof Error
          ? error.message
          : "I could not answer right now.",
      );
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    askQuestion(input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askQuestion(input.value);
    }
  });

  promptButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.getAttribute("data-chat-question") || "";
      input.value = question;
      askQuestion(question);
    });
  });
});
