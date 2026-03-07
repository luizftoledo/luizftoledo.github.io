(function () {
  const REPO_OWNER = "luizftoledo";
  const REPO_NAME = "luizftoledo.github.io";
  const ACTIONS_ROOT_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/actions`;
  const WORKFLOW_API_ROOT = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows`;
  const HEALTH_CACHE = new Map();

  const SCHEDULES = {
    ibama: {
      cadenceLabel: "Atualizacao diaria",
      type: "daily",
      utcHour: 13,
      utcMinute: 0,
      graceHours: 18,
      workflowId: 240805909,
      workflowPath: "update-ibama-dashboard.yml",
    },
    emendas: {
      cadenceLabel: "Atualizacao diaria",
      type: "daily",
      utcHour: 13,
      utcMinute: 10,
      graceHours: 18,
      workflowId: 240960264,
      workflowPath: "update-emendas-dashboard.yml",
    },
    lulometro: {
      cadenceLabel: "Atualizacao diaria",
      type: "daily",
      utcHour: 13,
      utcMinute: 20,
      graceHours: 18,
      workflowId: 241515122,
      workflowPath: "update-lulometro-dashboard.yml",
    },
    basometro: {
      cadenceLabel: "Atualizacao semanal",
      type: "weekly",
      utcHour: 13,
      utcMinute: 30,
      weekday: 1,
      graceHours: 48,
      workflowId: 241323142,
      workflowPath: "update-basometro-dashboard.yml",
    },
    lai: {
      cadenceLabel: "Atualizacao mensal",
      type: "monthly",
      utcHour: 13,
      utcMinute: 40,
      dayOfMonth: 1,
      graceHours: 96,
      workflowId: 240814394,
      workflowPath: "update-lai-dashboard.yml",
    },
    sigilo: {
      cadenceLabel: "Atualizacao mensal",
      type: "monthly",
      utcHour: 13,
      utcMinute: 40,
      dayOfMonth: 1,
      graceHours: 96,
      workflowId: 240814394,
      workflowPath: "update-lai-dashboard.yml",
    },
  };

  const DISPLAY_TIME_ZONE = "America/Cuiaba";
  const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function parseIsoDate(rawValue) {
    if (!rawValue) {
      return null;
    }

    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDateTime(rawValue) {
    const parsed = rawValue instanceof Date ? rawValue : parseIsoDate(rawValue);
    if (!parsed) {
      return "--";
    }

    return dateTimeFormatter.format(parsed);
  }

  function nextDailyRun(now, utcHour, utcMinute) {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, utcMinute || 0, 0));
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  function nextWeeklyRun(now, utcHour, utcMinute, weekday) {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, utcMinute || 0, 0));
    const deltaDays = (weekday - next.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + deltaDays);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 7);
    }
    return next;
  }

  function nextMonthlyRun(now, utcHour, utcMinute, dayOfMonth) {
    let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth, utcHour, utcMinute || 0, 0));
    if (next <= now) {
      next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, dayOfMonth, utcHour, utcMinute || 0, 0));
    }
    return next;
  }

  function getNextRun(scheduleKey, now) {
    const schedule = SCHEDULES[scheduleKey];
    if (!schedule) {
      return null;
    }

    const reference = now instanceof Date ? now : new Date();
    if (schedule.type === "daily") {
      return nextDailyRun(reference, schedule.utcHour, schedule.utcMinute);
    }

    if (schedule.type === "weekly") {
      return nextWeeklyRun(reference, schedule.utcHour, schedule.utcMinute, schedule.weekday);
    }

    if (schedule.type === "monthly") {
      return nextMonthlyRun(reference, schedule.utcHour, schedule.utcMinute, schedule.dayOfMonth);
    }

    return null;
  }

  function getWorkflowUrl(scheduleKey) {
    const schedule = SCHEDULES[scheduleKey];
    if (!schedule || !schedule.workflowPath) {
      return ACTIONS_ROOT_URL;
    }
    return `${ACTIONS_ROOT_URL}/workflows/${schedule.workflowPath}`;
  }

  function buildNotice(scheduleKey, updatedAtRaw) {
    const schedule = SCHEDULES[scheduleKey];
    if (!schedule) {
      return {
        cadenceLabel: "",
        updatedLabel: formatDateTime(updatedAtRaw),
        nextLabel: "--",
        text: updatedAtRaw ? `Ultima atualizacao: ${formatDateTime(updatedAtRaw)}.` : "",
      };
    }

    const updatedLabel = formatDateTime(updatedAtRaw);
    const nextRun = getNextRun(scheduleKey, new Date());
    const nextLabel = formatDateTime(nextRun);
    return {
      cadenceLabel: schedule.cadenceLabel,
      updatedLabel,
      nextLabel,
      text: `${schedule.cadenceLabel}. Ultima atualizacao: ${updatedLabel}. Proxima prevista: ${nextLabel} (horario de Cuiaba).`,
    };
  }

  function assessFreshness(scheduleKey, updatedAtRaw, now) {
    const schedule = SCHEDULES[scheduleKey];
    const updatedAt = parseIsoDate(updatedAtRaw);
    if (!schedule || !updatedAt) {
      return {
        isFresh: false,
        nextExpected: null,
        deadline: null,
      };
    }

    const referenceNow = now instanceof Date ? now : new Date();
    const nextExpected = getNextRun(scheduleKey, updatedAt);
    const graceHours = Number(schedule.graceHours || 24);
    const deadline = nextExpected
      ? new Date(nextExpected.getTime() + (graceHours * 60 * 60 * 1000))
      : null;

    return {
      isFresh: Boolean(deadline) && referenceNow <= deadline,
      nextExpected,
      deadline,
    };
  }

  async function fetchWorkflowRuns(scheduleKey) {
    const schedule = SCHEDULES[scheduleKey];
    if (!schedule || !schedule.workflowId) {
      return [];
    }

    if (!HEALTH_CACHE.has(schedule.workflowId)) {
      const url = `${WORKFLOW_API_ROOT}/${schedule.workflowId}/runs?per_page=3`;
      const request = fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
        },
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`GitHub API ${response.status}`);
        }
        const payload = await response.json();
        return Array.isArray(payload.workflow_runs) ? payload.workflow_runs : [];
      });
      HEALTH_CACHE.set(schedule.workflowId, request);
    }

    return HEALTH_CACHE.get(schedule.workflowId);
  }

  function pickLatestRelevantRun(runs) {
    if (!Array.isArray(runs) || runs.length === 0) {
      return null;
    }

    const preferred = runs.find((run) => run && (run.event === "schedule" || run.event === "workflow_dispatch"));
    return preferred || runs[0] || null;
  }

  async function buildHealth(scheduleKey, updatedAtRaw) {
    const schedule = SCHEDULES[scheduleKey];
    const fallbackUrl = getWorkflowUrl(scheduleKey);
    const freshness = assessFreshness(scheduleKey, updatedAtRaw, new Date());

    if (!schedule) {
      return {
        ok: false,
        label: "Raspador com falha",
        detail: "Nao foi possivel mapear este raspador.",
        url: fallbackUrl,
      };
    }

    let latestRun = null;
    let apiUnavailable = false;
    try {
      latestRun = pickLatestRelevantRun(await fetchWorkflowRuns(scheduleKey));
    } catch (error) {
      apiUnavailable = true;
    }

    if (!latestRun) {
      if (freshness.isFresh) {
        return {
          ok: true,
          label: "Raspador OK",
          detail: apiUnavailable
            ? "API do GitHub indisponivel; base ainda esta dentro da janela esperada."
            : "Sem run agendado registrado ainda; base dentro da janela esperada.",
          url: fallbackUrl,
        };
      }

      return {
        ok: false,
        label: "Raspador com falha",
        detail: apiUnavailable
          ? "API do GitHub indisponivel e a base ja passou da janela esperada."
          : "Sem run recente registrado e a base ja passou da janela esperada.",
        url: fallbackUrl,
      };
    }

    const latestRunAt = latestRun.updated_at || latestRun.created_at;
    const latestRunOk = latestRun.conclusion === "success";
    const ok = freshness.isFresh && latestRunOk;
    let detail = latestRunOk
      ? `Ultimo workflow OK em ${formatDateTime(latestRunAt)}.`
      : `Ultimo workflow falhou em ${formatDateTime(latestRunAt)}.`;

    if (!freshness.isFresh && freshness.deadline) {
      detail += ` Base fora da janela esperada desde ${formatDateTime(freshness.deadline)}.`;
    } else if (!freshness.isFresh) {
      detail += " Base fora da janela esperada.";
    }

    return {
      ok,
      label: ok ? "Raspador OK" : "Raspador com falha",
      detail,
      url: latestRun.html_url || fallbackUrl,
    };
  }

  function setHealthButtonState(element, stateName, label, detail, url) {
    if (!element) {
      return;
    }

    element.textContent = label;
    element.classList.remove("is-loading", "is-ok", "is-fail");
    element.classList.add(stateName);
    element.title = detail || label;
    element.setAttribute("aria-label", detail || label);
    if (url && typeof element.setAttribute === "function") {
      element.setAttribute("href", url);
    }
  }

  async function applyHealthState(scheduleKey, updatedAtRaw, element) {
    if (!element) {
      return null;
    }

    setHealthButtonState(
      element,
      "is-loading",
      "Testando raspador...",
      "Checando a janela de atualizacao e o ultimo workflow do GitHub Actions.",
      getWorkflowUrl(scheduleKey)
    );

    const health = await buildHealth(scheduleKey, updatedAtRaw);
    setHealthButtonState(
      element,
      health.ok ? "is-ok" : "is-fail",
      health.label,
      health.detail,
      health.url
    );
    return health;
  }

  window.DashboardUpdateSchedule = {
    applyHealthState,
    buildHealth,
    buildNotice,
    formatDateTime,
    getNextRun,
    schedules: SCHEDULES,
  };
})();
