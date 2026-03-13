document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("portfolioChatForm");
  const input = document.getElementById("portfolioChatInput");
  const submitButton = document.getElementById("portfolioChatSubmit");
  const messages = document.getElementById("portfolioChatMessages");
  const status = document.getElementById("portfolioChatStatus");
  const promptButtons = document.querySelectorAll("[data-chat-question]");
  const fileInput = document.getElementById("portfolioChatFile");
  const fileMeta = document.getElementById("portfolioChatFileMeta");
  const fileClearButton = document.getElementById("portfolioChatFileClear");

  if (!form || !input || !submitButton || !messages || !status) {
    return;
  }

  const configuredEndpoint = window.PORTFOLIO_CHAT_CONFIG?.endpoint?.trim() || "";
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  const endpoint = configuredEndpoint || (isLocalHost ? "/api/portfolio-chat" : "");
  const history = [];
  const MAX_TEXT_ATTACHMENT_BYTES = 180 * 1024;
  const MAX_TEXT_ATTACHMENT_CHARS = 12_000;
  const MAX_BINARY_ATTACHMENT_BYTES = 2 * 1024 * 1024;
  let isLoading = false;
  let selectedAttachment = null;
  let highlightedElement = null;
  let highlightTimeout = null;

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function formatBytes(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileExtension(name = "") {
    const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function isTextFile(file) {
    const extension = getFileExtension(file.name);
    return (
      file.type.startsWith("text/") ||
      ["txt", "md", "csv", "json"].includes(extension)
    );
  }

  function isImageFile(file) {
    return file.type.startsWith("image/");
  }

  function isAudioFile(file) {
    return file.type.startsWith("audio/");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read the selected text file."));
      reader.readAsText(file);
    });
  }

  async function prepareAttachment(file) {
    if (isTextFile(file)) {
      if (file.size > MAX_TEXT_ATTACHMENT_BYTES) {
        throw new Error("Text files must stay under 180 KB.");
      }

      const text = (await readFileAsText(file)).trim();
      if (!text) {
        throw new Error("The selected text file is empty.");
      }

      return {
        kind: "text",
        name: file.name,
        mimeType: file.type || "text/plain",
        text: text.slice(0, MAX_TEXT_ATTACHMENT_CHARS),
      };
    }

    if (!isImageFile(file) && !isAudioFile(file)) {
      throw new Error("Use one image, audio clip, or plain text file.");
    }

    if (file.size > MAX_BINARY_ATTACHMENT_BYTES) {
      throw new Error("Images and audio clips must stay under 2 MB.");
    }

    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.split(",")[1] || "";

    return {
      kind: isImageFile(file) ? "image" : "audio",
      name: file.name,
      mimeType: file.type,
      dataBase64: base64,
    };
  }

  function buildAttachmentDescription(attachment) {
    if (!attachment) {
      return "";
    }
    return `${attachment.kind}: ${attachment.name}`;
  }

  function stripCitationMarkers(text) {
    return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, "").trim();
  }

  function updateAttachmentUi() {
    if (!fileMeta || !fileClearButton) {
      return;
    }

    if (!selectedAttachment) {
      fileMeta.textContent = "Optional: attach one image, audio clip, or text file.";
      fileMeta.removeAttribute("data-tone");
      fileClearButton.hidden = true;
      return;
    }

    const detail =
      selectedAttachment.kind === "text"
        ? `${selectedAttachment.name} ready`
        : `${selectedAttachment.name} ready`;
    fileMeta.textContent = `Attached ${detail}.`;
    fileMeta.removeAttribute("data-tone");
    fileClearButton.hidden = false;
  }

  function clearAttachment() {
    selectedAttachment = null;
    if (fileInput) {
      fileInput.value = "";
    }
    updateAttachmentUi();
  }

  function renderCitationMarker(ref, sourcesByIndex) {
    const source = sourcesByIndex.get(Number(ref));
    if (!source) {
      return `<span class="portfolio-chat-citation-missing">[${ref}]</span>`;
    }

    return `<button type="button" class="portfolio-chat-citation" data-source-url="${escapeAttribute(
      source.url,
    )}" data-source-label="${escapeAttribute(
      source.label,
    )}" aria-label="Open source ${ref}" title="${escapeAttribute(
      source.label,
    )}">${ref}</button>`;
  }

  function renderInline(text, sourcesByIndex) {
    let html = escapeHtml(text);
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (_, refs) =>
      refs
        .split(/\s*,\s*/)
        .map((ref) => renderCitationMarker(ref, sourcesByIndex))
        .join(""),
    );
    return html;
  }

  function renderMarkdown(text, sources = []) {
    const blocks = text.trim().split(/\n\s*\n/).filter(Boolean);
    const sourcesByIndex = new Map(
      sources.map((source, index) => [index + 1, source]),
    );

    if (!blocks.length) {
      return "<p>I could not generate an answer.</p>";
    }

    return blocks
      .map((block) => {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const isList = lines.every((line) => /^[-*]\s+/.test(line));

        if (isList) {
          const items = lines
            .map(
              (line) =>
                `<li>${renderInline(
                  line.replace(/^[-*]\s+/, ""),
                  sourcesByIndex,
                )}</li>`,
            )
            .join("");
          return `<ul>${items}</ul>`;
        }

        const headingMatch = block.match(/^(#{1,3})\s+(.+)$/m);
        if (headingMatch && lines.length === 1) {
          return `<p class="portfolio-chat-heading">${renderInline(
            headingMatch[2],
            sourcesByIndex,
          )}</p>`;
        }

        return `<p>${lines
          .map((line) => renderInline(line, sourcesByIndex))
          .join("<br>")}</p>`;
      })
      .join("");
  }

  function scrollMessages() {
    messages.scrollTop = messages.scrollHeight;
  }

  function setStatus(message, hidden = false, tone = "neutral") {
    status.hidden = hidden;
    if (hidden) {
      status.textContent = "";
      status.removeAttribute("data-tone");
      return;
    }

    status.textContent = message;
    status.dataset.tone = tone;
  }

  function disableChat(message) {
    input.disabled = true;
    submitButton.disabled = true;
    if (fileInput) {
      fileInput.disabled = true;
    }
    if (fileClearButton) {
      fileClearButton.disabled = true;
    }
    form.classList.add("is-disabled");
    promptButtons.forEach((button) => {
      button.disabled = true;
    });
    setStatus(message, false, "error");
  }

  function setLoading(nextValue) {
    isLoading = nextValue;
    submitButton.disabled = nextValue;
    input.disabled = nextValue;
    if (fileInput) {
      fileInput.disabled = nextValue;
    }
    if (fileClearButton) {
      fileClearButton.disabled = nextValue;
    }
    form.classList.toggle("is-loading", nextValue);
    setStatus(nextValue ? "Searching the portfolio..." : "", !nextValue);
  }

  function highlightSourceElement(target) {
    if (!target) {
      return;
    }

    if (highlightedElement) {
      highlightedElement.classList.remove("source-highlight");
    }

    highlightedElement = target;
    target.classList.add("source-highlight");

    if (highlightTimeout) {
      window.clearTimeout(highlightTimeout);
    }

    highlightTimeout = window.setTimeout(() => {
      if (highlightedElement) {
        highlightedElement.classList.remove("source-highlight");
      }
      highlightedElement = null;
    }, 2400);
  }

  function navigateToSource(url) {
    if (!url) {
      return;
    }

    const targetUrl = new URL(url, window.location.href);
    const currentUrl = new URL(window.location.href);
    const isSamePage =
      targetUrl.origin === currentUrl.origin &&
      targetUrl.pathname === currentUrl.pathname;

    if (!isSamePage) {
      window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
      return;
    }

    if (!targetUrl.hash) {
      window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
      return;
    }

    const target = document.querySelector(targetUrl.hash);
    if (!target) {
      window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
      return;
    }

    window.history.replaceState({}, "", targetUrl.hash);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    highlightSourceElement(target);
  }

  function appendMessage(role, text, sources = [], options = {}) {
    const article = document.createElement("article");
    article.className = `portfolio-chat-message ${
      role === "assistant"
        ? "portfolio-chat-message-assistant"
        : "portfolio-chat-message-user"
    }`;

    if (options.attachmentLabel) {
      const meta = document.createElement("p");
      meta.className = "portfolio-chat-message-meta";
      meta.textContent = options.attachmentLabel;
      article.appendChild(meta);
    }

    const content = document.createElement("div");
    content.className = "portfolio-chat-message-body";
    content.innerHTML = renderMarkdown(text, sources);
    article.appendChild(content);

    messages.appendChild(article);
    scrollMessages();
  }

  if (!endpoint) {
    disableChat(
      "Chat backend not connected yet. Deploy the standalone API and set its URL in scripts/portfolio-chat.config.js.",
    );
    return;
  }

  async function askQuestion(question) {
    const cleanQuestion = question.trim();
    const attachment = selectedAttachment
      ? JSON.parse(JSON.stringify(selectedAttachment))
      : null;

    if ((!cleanQuestion && !attachment) || isLoading) {
      return;
    }

    appendMessage(
      "user",
      cleanQuestion || `Uploaded ${buildAttachmentDescription(attachment)}.`,
      [],
      {
        attachmentLabel: attachment
          ? `Attachment: ${buildAttachmentDescription(attachment)}`
          : "",
      },
    );

    input.value = "";
    clearAttachment();
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
          attachment,
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
        "I could not confirm that from the portfolio sources.";

      history.push({
        role: "user",
        content:
          cleanQuestion ||
          (attachment
            ? `Uploaded ${attachment.kind} file ${attachment.name}`
            : "User asked a question."),
      });
      history.push({
        role: "assistant",
        content: stripCitationMarkers(answer),
      });

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

  messages.addEventListener("click", (event) => {
    const sourceControl = event.target.closest("[data-source-url]");
    if (sourceControl) {
      navigateToSource(sourceControl.dataset.sourceUrl || "");
    }
  });

  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        clearAttachment();
        return;
      }

      setStatus("Preparing attachment...", false);

      try {
        selectedAttachment = await prepareAttachment(file);
        updateAttachmentUi();
        setStatus("", true);
        input.focus();
      } catch (error) {
        clearAttachment();
        setStatus(
          error instanceof Error ? error.message : "Could not prepare attachment.",
          false,
          "error",
        );
      }
    });
  }

  if (fileClearButton) {
    fileClearButton.addEventListener("click", () => {
      clearAttachment();
      input.focus();
    });
  }

  updateAttachmentUi();
});
