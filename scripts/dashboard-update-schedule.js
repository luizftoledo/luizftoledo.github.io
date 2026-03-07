(function () {
  const SCHEDULES = {
    ibama: {
      cadenceLabel: "Atualizacao diaria",
      type: "daily",
      utcHour: 13,
    },
    emendas: {
      cadenceLabel: "Atualizacao diaria",
      type: "daily",
      utcHour: 13,
    },
    lulometro: {
      cadenceLabel: "Atualizacao diaria",
      type: "daily",
      utcHour: 13,
    },
    basometro: {
      cadenceLabel: "Atualizacao semanal",
      type: "weekly",
      utcHour: 13,
      weekday: 1,
    },
    lai: {
      cadenceLabel: "Atualizacao mensal",
      type: "monthly",
      utcHour: 13,
      dayOfMonth: 1,
    },
    sigilo: {
      cadenceLabel: "Atualizacao mensal",
      type: "monthly",
      utcHour: 13,
      dayOfMonth: 1,
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

  function nextDailyRun(now, utcHour) {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0));
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  function nextWeeklyRun(now, utcHour, weekday) {
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0));
    const deltaDays = (weekday - next.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + deltaDays);
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 7);
    }
    return next;
  }

  function nextMonthlyRun(now, utcHour, dayOfMonth) {
    let next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth, utcHour, 0, 0));
    if (next <= now) {
      next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, dayOfMonth, utcHour, 0, 0));
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
      return nextDailyRun(reference, schedule.utcHour);
    }

    if (schedule.type === "weekly") {
      return nextWeeklyRun(reference, schedule.utcHour, schedule.weekday);
    }

    if (schedule.type === "monthly") {
      return nextMonthlyRun(reference, schedule.utcHour, schedule.dayOfMonth);
    }

    return null;
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

  window.DashboardUpdateSchedule = {
    buildNotice,
    formatDateTime,
    schedules: SCHEDULES,
  };
})();
