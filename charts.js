const chartRegistry = new Map();

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: { legend: { display: false } },
  scales: {
    x: {
      ticks: { color: "#94a3b8", maxRotation: 0, font: { size: 10 } },
      grid: { color: "rgba(148,163,184,0.12)" },
    },
    y: {
      ticks: { color: "#94a3b8", font: { size: 10 } },
      grid: { color: "rgba(148,163,184,0.12)" },
    },
  },
};

function destroyChart(key) {
  const existing = chartRegistry.get(key);
  if (existing) {
    existing.destroy();
    chartRegistry.delete(key);
  }
}

export function renderDailyPrecipChart(canvas, days, key = "precip-daily") {
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart(key);

  const labels = days.map((d) => {
    const dt = new Date(d.date + "T12:00:00");
    return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  });
  const data = days.map((d) => d.precip_total_mm);

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: data.map((v) =>
            v >= 64.5 ? "#f87171" : v >= 15.6 ? "#38bdf8" : "#64748b"
          ),
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.raw} mm` },
        },
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          title: { display: true, text: "mm", color: "#94a3b8" },
        },
      },
    },
  });
  chartRegistry.set(key, chart);
}

export function renderPrecipChart(canvas, blocks, key = "precip") {
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart(key);

  const labels = blocks.map(
    (b) => `${String(b.block_start_hour).padStart(2, "0")}:00`
  );
  const data = blocks.map((b) => b.precip_mm);

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: data.map((v) =>
            v >= 45 ? "#f87171" : v >= 15 ? "#38bdf8" : "#64748b"
          ),
          borderRadius: 4,
        },
      ],
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.raw} mm / 3h` },
        },
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          title: { display: true, text: "mm", color: "#94a3b8" },
        },
      },
    },
  });
  chartRegistry.set(key, chart);
}

export function renderTempChart(canvas, hourly, key = "temp") {
  if (!canvas || typeof Chart === "undefined") return;
  destroyChart(key);

  const labels = hourly.map((h) => `${h.hour}h`);
  const data = hourly.map((h) => h.temp_c);

  const chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor: "#fbbf24",
          backgroundColor: "rgba(251,191,36,0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          title: { display: true, text: "°C", color: "#94a3b8" },
        },
      },
    },
  });
  chartRegistry.set(key, chart);
}