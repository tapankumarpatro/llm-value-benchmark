/* =============================================
   llm-value-bench — Application Logic
   ============================================= */

/* ---- State ---- */
const state = {
  models: [],
  profiles: [],
  selectedProfile: null,
  selectedSet: 'all',
  pickedModelIds: [],
  selectedBenchmarks: ['livecode_bench','swe_bench','aime_2025','gpqa_diamond','humaneval','mbpp'],
  viewMode: 'vaps',    // 'vaps' | 'raw' | 'scatter'
  chart: null,
  sortKey: null,
  sortAsc: true,
  benchMenuOpen: false,
  modelMenuOpen: false,
  customInputWeight: 50,
  customOutputWeight: 50,
  benchmarksUserSet: false,
};

const SIMPLE_ICONS_CDN = 'https://cdn.simpleicons.org';

const BENCH_LABELS = {
  livecode_bench: 'LiveCodeBench v6',
  swe_bench: 'SWE-bench Verified',
  aime_2025: 'AIME 2025',
  gpqa_diamond: 'GPQA Diamond',
  humaneval: 'HumanEval',
  mbpp: 'MBPP+',
};

const SET_OPTIONS = {
  all: 'Recommended for profile',
  closed: 'Closed source only',
  open: 'Open source only',
  top5v5: 'Top 5 Closed vs Top 5 Open',
  top3v3: 'Top 3 vs Top 3',
  pick: 'Pick models…',
};

/* ---- Helpers ---- */

function effectiveCost(model, profile) {
  const wIn = profile.input_weight;
  const wOut = profile.output_weight;
  return (model.input_price * wIn) + (model.output_price * wOut);
}

function vaps(score, cost) {
  if (cost <= 0) return score;
  return score / Math.log10(1 + cost);
}

/** Profile-weighted composite raw score (Option 1) */
function weightedRaw(model, profile, benchmarks) {
  const weights = profile.benchmark_weights;
  if (!weights) {
    let sum = 0, count = 0;
    for (const b of benchmarks) {
      if (model.benchmarks[b] !== undefined) {
        sum += model.benchmarks[b];
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  }

  let sum = 0, wSum = 0;
  for (const [bench, w] of Object.entries(weights)) {
    if (!benchmarks.includes(bench)) continue;
    const score = model.benchmarks[bench];
    if (score !== undefined && w > 0) {
      sum += score * w;
      wSum += w;
    }
  }
  return wSum > 0 ? sum / wSum : 0;
}

/** VAPS on profile-weighted composite score */
function weightedVaps(model, profile, benchmarks) {
  const raw = weightedRaw(model, profile, benchmarks);
  const cost = effectiveCost(model, profile);
  return vaps(raw, cost);
}

/** Option 2: minimum raw score floors per profile */
function passesProfileGates(model, profile) {
  if (profile.score_floors?.length) {
    for (const floor of profile.score_floors) {
      const score = model.benchmarks[floor.benchmark];
      if (score === undefined || score < floor.min) return false;
    }
  }
  if (profile.context_window_max && model.context_window > profile.context_window_max) {
    return false;
  }
  return true;
}

function applyProfileGates(models, profile, skipGates) {
  if (skipGates || profile.id === 'custom') return models;
  return models.filter(m => passesProfileGates(m, profile));
}

/* ---- Model Filtering ---- */

function getProfileModelPool() {
  const profile = state.selectedProfile;
  if (!profile || profile.id === 'custom' || !profile.recommended_models) {
    return [...state.models];
  }
  const ids = new Set(profile.recommended_models);
  return state.models.filter(m => ids.has(m.id));
}

function sortModelsForProfile(models, profile, benchmarks) {
  const view = state.viewMode;
  return [...models].sort((a, b) => {
    if (view === 'raw' || view === 'scatter') {
      return weightedRaw(b, profile, benchmarks) - weightedRaw(a, profile, benchmarks);
    }
    return weightedVaps(b, profile, benchmarks) - weightedVaps(a, profile, benchmarks);
  });
}

function getFilteredModels() {
  const set = state.selectedSet;
  let filtered = getProfileModelPool();

  if (set === 'pick') {
    if (state.pickedModelIds.length === 0) return [];
    const idSet = new Set(state.pickedModelIds);
    filtered = state.models.filter(m => idSet.has(m.id));
    return sortModelsForProfile(filtered, state.selectedProfile, state.selectedBenchmarks);
  }

  if (set === 'closed') {
    filtered = filtered.filter(m => m.type === 'closed');
  } else if (set === 'open') {
    filtered = filtered.filter(m => m.type === 'open');
  } else if (set === 'top5v5') {
    const profile = state.selectedProfile;
    const benches = state.selectedBenchmarks;
    const rank = (a, b) => weightedVaps(b, profile, benches) - weightedVaps(a, profile, benches);
    const closed = filtered.filter(m => m.type === 'closed').sort(rank).slice(0, 5);
    const open = filtered.filter(m => m.type === 'open').sort(rank).slice(0, 5);
    filtered = [...closed, ...open];
  } else if (set === 'top3v3') {
    const profile = state.selectedProfile;
    const benches = state.selectedBenchmarks;
    const rank = (a, b) => weightedVaps(b, profile, benches) - weightedVaps(a, profile, benches);
    const closed = filtered.filter(m => m.type === 'closed').sort(rank).slice(0, 3);
    const open = filtered.filter(m => m.type === 'open').sort(rank).slice(0, 3);
    filtered = [...closed, ...open];
  } else {
    filtered = sortModelsForProfile(filtered, state.selectedProfile, state.selectedBenchmarks);
  }

  const skipGates = set === 'pick';
  return applyProfileGates(filtered, state.selectedProfile, skipGates);
}

function applyProfileDefaults(profile) {
  if (profile.default_benchmarks?.length) {
    state.selectedBenchmarks = profile.default_benchmarks.filter(b => BENCH_LABELS[b]);
  }
  syncBenchmarkCheckboxes();
}

function syncBenchmarkCheckboxes() {
  document.querySelectorAll('#benchMenu input[type="checkbox"]').forEach(cb => {
    cb.checked = state.selectedBenchmarks.includes(cb.value);
  });
}

function formatBenchWeights(profile) {
  if (!profile.benchmark_weights) return 'equal weights';
  return Object.entries(profile.benchmark_weights)
    .map(([b, w]) => `${BENCH_LABELS[b] || b} ${(w * 100).toFixed(0)}%`)
    .join(' · ');
}

function updateChartSubtitle() {
  const el = document.getElementById('chartSubtitle');
  if (!el || !state.selectedProfile) return;
  const p = state.selectedProfile;
  const count = getFilteredModels().length;
  const pool = getProfileModelPool();
  const gated = applyProfileGates(pool, p, state.selectedSet === 'pick').length;
  const excluded = pool.length - gated;
  const modeLabel = { vaps: 'VAPS', raw: 'weighted raw', scatter: 'value map' }[state.viewMode] || state.viewMode;
  let text = `${p.label} · ${count} models · ${modeLabel} · ${(p.input_weight * 100).toFixed(0)}% in / ${(p.output_weight * 100).toFixed(0)}% out`;
  text += ` · Bench: ${formatBenchWeights(p)}`;
  if (excluded > 0 && state.selectedSet !== 'pick') {
    text += ` · ${excluded} below profile floor`;
  }
  el.textContent = text;

  const scatterGuide = document.getElementById('scatterGuide');
  if (scatterGuide) {
    scatterGuide.hidden = state.viewMode !== 'scatter';
  }
  const chartTitle = document.getElementById('chartTitle');
  if (chartTitle) {
    chartTitle.textContent = state.viewMode === 'scatter'
      ? 'Value Map — Quality vs Cost'
      : 'Benchmark Comparison';
  }
}

/* ---- Color Schemes ---- */

const CLOSED_COLORS = [
  '#d0312d', '#e05a3a', '#c42828', '#d84f33', '#b82020',
  '#e86a44', '#d43d2f', '#c03030', '#ec744a', '#dc5437',
];

const OPEN_COLORS = [
  '#1a6fb5', '#2d8fc9', '#155d9e', '#3a9ed4', '#0f4e88',
  '#4daedf', '#247bbd', '#1868a8', '#5ebce9', '#0d4475',
];

function getModelColor(model, index) {
  if (model.type === 'closed') {
    return CLOSED_COLORS[index % CLOSED_COLORS.length];
  }
  return OPEN_COLORS[index % OPEN_COLORS.length];
}

function getModelColorRgba(model, alpha = 1) {
  const closed = [208, 49, 45];
  const open = [26, 111, 181];
  const c = model.type === 'closed' ? closed : open;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

/* ---- Chart DataLabels Plugin ---- */
const ChartDataLabels = {
  id: 'customDataLabels',
  afterDraw(chart) {
    if (chart.config.type !== 'bar') return;
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (!meta.hidden) {
        meta.data.forEach((bar, index) => {
          const val = dataset.data[index];
          if (val === null || val === undefined) return;
          const text = val.toFixed(1);
          ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-secondary').trim() || '#9c9c9d';
          ctx.font = '500 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, bar.x, bar.y - 3);
        });
      }
    });
  },
};

const ScatterPointLabels = {
  id: 'scatterPointLabels',
  afterDatasetsDraw(chart) {
    if (chart.config.type !== 'scatter') return;
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden) return;
      meta.data.forEach((point, idx) => {
        const label = dataset.label;
        if (!label || !point) return;
        const short = label.length > 14 ? label.slice(0, 12) + '…' : label;
        ctx.fillStyle = '#cdcdcd';
        ctx.font = '500 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(short, point.x, point.y - 10);
      });
    });
  },
};

function ensureChartCanvas() {
  const container = document.querySelector('.chart-container');
  if (!container) return null;

  let canvas = document.getElementById('mainChart');
  if (!canvas) {
    container.innerHTML = '<canvas id="mainChart"></canvas>';
    canvas = document.getElementById('mainChart');
  }
  return canvas;
}

function showChartMessage(message) {
  const container = document.querySelector('.chart-container');
  if (!container) return;
  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }
  container.innerHTML = `<div class="loading">${message}</div>`;
}

/* ---- Chart Rendering ---- */
/* global Chart */

function renderChart() {
  const models = getFilteredModels();
  const benchmarks = state.selectedBenchmarks;
  const view = state.viewMode;
  const profile = state.selectedProfile;

  if (typeof Chart === 'undefined') {
    showChartMessage('Chart library failed to load. Refresh the page.');
    return;
  }

  if (benchmarks.length === 0) {
    showChartMessage('Select at least one benchmark.');
    return;
  }

  if (models.length === 0) {
    const msg = state.selectedSet === 'pick'
      ? 'Pick one or more models from the dropdown above.'
      : 'No models pass this profile\'s quality floors. Try Pick models or Custom profile.';
    showChartMessage(msg);
    return;
  }

  const canvas = ensureChartCanvas();
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (state.chart) {
    state.chart.destroy();
    state.chart = null;
  }

  let config;

  if (view === 'scatter') {
    config = {
      type: 'scatter',
      data: {
        datasets: models.map((model, i) => {
          const color = getModelColor(model, i);
          const raw = weightedRaw(model, profile, benchmarks);
          const cost = effectiveCost(model, profile);
          return {
            label: model.name,
            data: [{ x: raw, y: cost }],
            backgroundColor: getModelColorRgba(model, 0.9),
            borderColor: color,
            borderWidth: 2,
            pointRadius: 9,
            pointHoverRadius: 11,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              title(items) {
                return items[0]?.dataset?.label || '';
              },
              label(ctx) {
                const model = models[ctx.datasetIndex];
                if (!model) return '';
                const raw = weightedRaw(model, profile, benchmarks);
                const cost = effectiveCost(model, profile);
                const v = weightedVaps(model, profile, benchmarks);
                return [
                  `  Wt. raw: ${raw.toFixed(1)}%`,
                  `  Eff. $: $${cost.toFixed(2)}/1M`,
                  `  VAPS: ${v.toFixed(1)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            title: {
              display: true,
              text: 'Profile-weighted raw score →',
              color: '#9c9c9d',
              font: { family: 'Inter', size: 11 },
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#9c9c9d',
              font: { family: 'JetBrains Mono', size: 11 },
              callback: val => val + '%',
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: '↑ Effective $/1M (lower is better)',
              color: '#9c9c9d',
              font: { family: 'Inter', size: 11 },
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#9c9c9d',
              font: { family: 'JetBrains Mono', size: 11 },
              callback: val => '$' + val.toFixed(2),
            },
          },
        },
      },
      plugins: [ScatterPointLabels],
    };
  } else {
    const labels = models.map(m => m.name);
    const data = models.map(m => {
      if (view === 'raw') return weightedRaw(m, profile, benchmarks);
      return weightedVaps(m, profile, benchmarks);
    });
    const bgColors = models.map((m, i) => getModelColorRgba(m, 0.85));
    const borderColors = models.map((m, i) => getModelColor(m, i));

    config = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: view === 'raw' ? 'Weighted raw %' : 'VAPS',
          data,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 3,
          barPercentage: 0.75,
          categoryPercentage: 0.8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.85)',
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              title(items) {
                return items[0]?.label || '';
              },
              label(ctx) {
                const model = models[ctx.dataIndex];
                if (!model) return '';
                const raw = weightedRaw(model, profile, benchmarks);
                const cost = effectiveCost(model, profile);
                const v = weightedVaps(model, profile, benchmarks);
                return [
                  `  Wt. raw: ${raw.toFixed(1)}%`,
                  `  Eff. $: $${cost.toFixed(2)}/1M`,
                  `  VAPS: ${v.toFixed(1)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#9c9c9d',
              font: { family: 'Inter', size: 10 },
              maxRotation: 45,
              minRotation: 25,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: '#9c9c9d',
              font: { family: 'JetBrains Mono', size: 11 },
              callback(val) {
                return view === 'raw' ? val.toFixed(0) + '%' : val.toFixed(1);
              },
            },
          },
        },
      },
      plugins: [ChartDataLabels],
    };
  }

  try {
    state.chart = new Chart(ctx, config);
    renderLegend(models);
    updateChartSubtitle();
  } catch (err) {
    console.error('Chart render failed:', err);
    showChartMessage('Could not render chart. Try a smaller model set.');
  }
}

/* ---- Legend ---- */

function renderLegend(models) {
  const container = document.getElementById('chartLegend');
  container.innerHTML = models.map((m, i) => {
    const cost = effectiveCost(m, state.selectedProfile);
    const color = getModelColor(m, i);
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background:${color}"></span>
        ${m.name}
        <span class="legend-cost">$${cost.toFixed(2)}/1M</span>
      </div>
    `;
  }).join('');
}

/* ---- Insights Strip ---- */

function renderInsights() {
  const models = getFilteredModels();
  const profile = state.selectedProfile;
  const benches = state.selectedBenchmarks;

  if (models.length === 0) {
    document.getElementById('insightsStrip').innerHTML = '';
    return;
  }

  // Best VAPS
  let bestVaps = -Infinity, bestModel = null;
  // Cheapest effective cost
  let cheapest = Infinity, cheapestModel = null;
  // Highest raw avg
  let highest = -Infinity, highestModel = null;

  for (const m of models) {
    const cost = effectiveCost(m, profile);
    const avg = weightedVaps(m, profile, benches);
    const raw = weightedRaw(m, profile, benches);
    if (avg > bestVaps) { bestVaps = avg; bestModel = m; }
    if (cost < cheapest) { cheapest = cost; cheapestModel = m; }
    if (raw > highest) { highest = raw; highestModel = m; }
  }

  document.getElementById('insightsStrip').innerHTML = `
    <div class="insight-card">
      <div class="insight-label">Best Value (VAPS)</div>
      <div class="insight-value">${bestVaps.toFixed(1)}</div>
      <div class="insight-model">${bestModel ? bestModel.name : '-'}</div>
    </div>
    <div class="insight-card">
      <div class="insight-label">Cheapest Per Token</div>
      <div class="insight-value">$${cheapest.toFixed(2)}/1M</div>
      <div class="insight-model">${cheapestModel ? cheapestModel.name : '-'}</div>
    </div>
    <div class="insight-card">
      <div class="insight-label">Highest Wt. Raw</div>
      <div class="insight-value">${highest.toFixed(1)}%</div>
      <div class="insight-model">${highestModel ? highestModel.name : '-'}</div>
    </div>
  `;
}

/* ---- Model Table ---- */

function renderTable() {
  const models = getFilteredModels();
  const profile = state.selectedProfile;
  const benches = state.selectedBenchmarks;
  const tbody = document.querySelector('#modelTable tbody');

  if (models.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-tertiary)">No models match the current filter.</td></tr>';
    return;
  }

  const rows = models.map(m => {
    const cost = effectiveCost(m, profile);
    const raw = weightedRaw(m, profile, benches);
    const avgV = weightedVaps(m, profile, benches);
    return { model: m, cost, raw, avgV };
  });

  // Sort if needed
  if (state.sortKey) {
    rows.sort((a, b) => {
      let av, bv;
      switch (state.sortKey) {
        case 'name': av = a.model.name; bv = b.model.name; break;
        case 'provider': av = a.model.provider; bv = b.model.provider; break;
        case 'type': av = a.model.type; bv = b.model.type; break;
        case 'input': av = a.model.input_price; bv = b.model.input_price; break;
        case 'output': av = a.model.output_price; bv = b.model.output_price; break;
        case 'eff': av = a.cost; bv = b.cost; break;
        case 'raw': av = a.raw; bv = b.raw; break;
        case 'vaps': av = a.avgV; bv = b.avgV; break;
        case 'updated': av = a.model.last_updated; bv = b.model.last_updated; break;
        default: return 0;
      }
      if (typeof av === 'string') {
        return state.sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return state.sortAsc ? av - bv : bv - av;
    });
  }

  tbody.innerHTML = rows.map(r => {
    const m = r.model;
    const typePill = m.type === 'closed'
      ? '<span class="type-pill closed">Closed</span>'
      : '<span class="type-pill open">Open</span>';
    return `
      <tr>
        <td class="model-name">${m.name}</td>
        <td>${m.provider}</td>
        <td>${typePill}</td>
        <td class="mono">$${m.input_price.toFixed(2)}</td>
        <td class="mono">$${m.output_price.toFixed(2)}</td>
        <td class="mono">$${r.cost.toFixed(2)}</td>
        <td class="mono">${r.raw.toFixed(1)}%</td>
        <td class="mono">${r.avgV.toFixed(1)}</td>
        <td class="mono">${m.last_updated}</td>
      </tr>
    `;
  }).join('');

  // Update sort indicators
  document.querySelectorAll('#modelTable th').forEach(th => {
    const key = th.dataset.sort;
    th.classList.toggle('sorted', key === state.sortKey);
    const icon = th.querySelector('.sort-icon');
    if (icon) {
      icon.textContent = key === state.sortKey ? (state.sortAsc ? '▲' : '▼') : '▽';
    }
  });
}

function handleTableSort(key) {
  if (state.sortKey === key) {
    state.sortAsc = !state.sortAsc;
  } else {
    state.sortKey = key;
    state.sortAsc = true;
  }
  renderTable();
}

// Expose for inline onclick handlers in buildUI()
window.handleTableSort = handleTableSort;

/* ---- Profile Card ---- */

function renderToolIcon(example) {
  if (example.icon) {
    return `<img src="${SIMPLE_ICONS_CDN}/${example.icon}/9c9c9d" alt="" width="16" height="16" loading="lazy">`;
  }
  if (example.tabler) {
    return `<span class="ti ${example.tabler}"></span>`;
  }
  return '';
}

function renderToolChips(examples) {
  if (!examples || examples.length === 0) return '';
  return examples.map(ex => `
    <span class="tool-chip" title="${ex.name}">
      ${renderToolIcon(ex)}
      <span class="tool-chip-label">${ex.name}</span>
    </span>
  `).join('');
}

function updateProfileCard() {
  const p = state.selectedProfile;
  document.getElementById('profileIcon').className = `ti ${p.icon}`;
  document.getElementById('profileName').textContent = p.label;

  const examplesEl = document.getElementById('profileExamples');
  if (p.examples && p.examples.length > 0) {
    examplesEl.innerHTML = `
      <span class="used-by-label">Used by</span>
      <div class="tool-chips">${renderToolChips(p.examples)}</div>
    `;
    examplesEl.style.display = '';
  } else {
    examplesEl.innerHTML = '';
    examplesEl.style.display = 'none';
  }

  document.getElementById('profileTokens').textContent =
    p.typical_input_tokens
      ? `~${formatNumber(p.typical_input_tokens)} input / ~${formatNumber(p.typical_output_tokens)} output tokens per call`
      : 'Custom ratio — set your own weights below';
  document.getElementById('profileRationale').textContent = p.rationale || p.description || '';

  const wIn = (p.input_weight * 100).toFixed(0);
  const wOut = (p.output_weight * 100).toFixed(0);
  document.getElementById('weightInput').textContent = `${wIn}%`;
  document.getElementById('weightOutput').textContent = `${wOut}%`;
  document.getElementById('inputFill').style.width = `${wIn}%`;
  document.getElementById('outputFill').style.width = `${wOut}%`;
}

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
  return n.toString();
}

/* ---- Profile Picker ---- */

function renderProfilePills() {
  const container = document.getElementById('profilePicker');
  container.innerHTML = state.profiles.map(p => `
    <button class="profile-pill${state.selectedProfile.id === p.id ? ' selected' : ''}"
            data-profile="${p.id}">
      <span class="ti ${p.icon} pill-icon"></span>
      ${p.label}
    </button>
  `).join('');

  // Click handlers
  container.querySelectorAll('.profile-pill').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.profile;
      selectProfile(id);
    });
  });
}

function selectProfile(id) {
  const profile = state.profiles.find(p => p.id === id);
  if (!profile) return;
  state.selectedProfile = profile;

  if (!state.benchmarksUserSet) {
    applyProfileDefaults(profile);
  }

  const panel = document.getElementById('sliderPanel');
  if (id === 'custom') {
    panel.classList.add('visible');
    profile.input_weight = state.customInputWeight / 100;
    profile.output_weight = state.customOutputWeight / 100;
  } else {
    panel.classList.remove('visible');
  }

  renderProfilePills();
  updateProfileCard();
  fullRender();
  updateURL();
}

/* ---- Custom Sliders ---- */

function initCustomSliders() {
  const inputSlider = document.getElementById('customInputSlider');
  const outputSlider = document.getElementById('customOutputSlider');
  const inputVal = document.getElementById('customInputVal');
  const outputVal = document.getElementById('customOutputVal');

  function update() {
    const inVal = parseInt(inputSlider.value);
    const outVal = 100 - inVal;
    outputSlider.value = outVal;
    inputVal.textContent = inVal + '%';
    outputVal.textContent = outVal + '%';

    state.customInputWeight = inVal;
    state.customOutputWeight = outVal;

    if (state.selectedProfile.id === 'custom') {
      state.selectedProfile.input_weight = inVal / 100;
      state.selectedProfile.output_weight = outVal / 100;
      updateProfileCard();
      fullRender();
      updateURL();
    }
  }

  inputSlider.addEventListener('input', update);
  outputSlider.addEventListener('input', () => {
    const outVal = parseInt(outputSlider.value);
    const inVal = 100 - outVal;
    inputSlider.value = inVal;
    inputVal.textContent = inVal + '%';
    outputVal.textContent = outVal + '%';

    state.customInputWeight = inVal;
    state.customOutputWeight = outVal;

    if (state.selectedProfile.id === 'custom') {
      state.selectedProfile.input_weight = inVal / 100;
      state.selectedProfile.output_weight = outVal / 100;
      updateProfileCard();
      fullRender();
      updateURL();
    }
  });
}

/* ---- Controls ---- */

function syncModelPickerUI() {
  const btn = document.getElementById('modelPickerBtn');
  const menu = document.getElementById('modelPickerMenu');
  if (!btn || !menu) return;

  const isPick = state.selectedSet === 'pick';
  btn.classList.toggle('active', isPick && state.pickedModelIds.length > 0);

  const count = state.pickedModelIds.length;
  btn.innerHTML = count > 0
    ? `<span class="ti ti-list-check"></span> Models (${count}) ▾`
    : '<span class="ti ti-list-check"></span> Pick models ▾';

  menu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = state.pickedModelIds.includes(cb.value);
  });
}

function initControls() {
  // Model set dropdown
  const setSelect = document.getElementById('modelSet');
  setSelect.addEventListener('change', () => {
    state.selectedSet = setSelect.value;
    syncModelPickerUI();
    fullRender();
    updateURL();
  });

  // Manual model picker
  const modelBtn = document.getElementById('modelPickerBtn');
  const modelMenu = document.getElementById('modelPickerMenu');

  modelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.modelMenuOpen = !state.modelMenuOpen;
    modelMenu.classList.toggle('open', state.modelMenuOpen);
    if (state.selectedSet !== 'pick') {
      state.selectedSet = 'pick';
      setSelect.value = 'pick';
      syncModelPickerUI();
    }
  });

  modelMenu.addEventListener('click', (e) => e.stopPropagation());

  modelMenu.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!state.pickedModelIds.includes(cb.value)) {
          state.pickedModelIds.push(cb.value);
        }
      } else {
        state.pickedModelIds = state.pickedModelIds.filter(id => id !== cb.value);
      }
      state.selectedSet = 'pick';
      setSelect.value = 'pick';
      syncModelPickerUI();
      fullRender();
      updateURL();
    });
  });

  // Benchmark dropdown
  const benchBtn = document.getElementById('benchBtn');
  const benchMenu = document.getElementById('benchMenu');

  benchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state.benchMenuOpen = !state.benchMenuOpen;
    benchMenu.classList.toggle('open', state.benchMenuOpen);
  });

  document.addEventListener('click', () => {
    benchMenu.classList.remove('open');
    state.benchMenuOpen = false;
    modelMenu.classList.remove('open');
    state.modelMenuOpen = false;
  });

  const benchCheckboxes = benchMenu.querySelectorAll('input[type="checkbox"]');
  benchCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      state.benchmarksUserSet = true;
      state.selectedBenchmarks = [];
      benchCheckboxes.forEach(c => {
        if (c.checked) state.selectedBenchmarks.push(c.value);
      });
      fullRender();
      updateURL();
    });
  });

  // View toggle
  const viewSelect = document.getElementById('viewToggle');
  viewSelect.addEventListener('change', () => {
    state.viewMode = viewSelect.value;
    fullRender();
    updateURL();
  });
}

/* ---- URL State ---- */

function parseURL() {
  const hash = window.location.hash.replace('#', '');
  if (!hash) return;
  const parts = hash.split('&');
  for (const part of parts) {
    const [key, val] = part.split('=');
    if (!key || !val) continue;
    switch (key) {
      case 'profile':
        const p = state.profiles.find(pr => pr.id === val);
        if (p) state.selectedProfile = p;
        break;
      case 'set':
        if (SET_OPTIONS[val]) state.selectedSet = val;
        break;
      case 'view':
        if (val === 'vaps' || val === 'raw' || val === 'scatter') state.viewMode = val;
        break;
      case 'bench':
        state.benchmarksUserSet = true;
        state.selectedBenchmarks = val.split(',').filter(b => BENCH_LABELS[b]);
        if (state.selectedBenchmarks.length === 0) {
          state.selectedBenchmarks = Object.keys(BENCH_LABELS);
        }
        break;
      case 'models':
        state.pickedModelIds = val.split(',').filter(id => state.models.some(m => m.id === id));
        if (state.pickedModelIds.length > 0) state.selectedSet = 'pick';
        break;
    }
  }
}

function updateURL() {
  const benchStr = state.selectedBenchmarks.join(',');
  let hash = `profile=${state.selectedProfile.id}&set=${state.selectedSet}&view=${state.viewMode}&bench=${benchStr}`;
  if (state.selectedSet === 'pick' && state.pickedModelIds.length > 0) {
    hash += `&models=${state.pickedModelIds.join(',')}`;
  }
  history.replaceState(null, '', '#' + hash);
}

/* ---- Full Re-render ---- */

function fullRender() {
  try { renderChart(); } catch (err) { console.error('renderChart:', err); }
  try { renderInsights(); } catch (err) { console.error('renderInsights:', err); }
  try { renderTable(); } catch (err) { console.error('renderTable:', err); }
}

/* ---- Data Loading ---- */

async function loadData() {
  try {
    const [modelsRes, profilesRes] = await Promise.all([
      fetch('data/models.json'),
      fetch('data/profiles.json'),
    ]);
    if (!modelsRes.ok || !profilesRes.ok) {
      throw new Error(`HTTP ${modelsRes.status} / ${profilesRes.status}`);
    }
    state.models = await modelsRes.json();
    state.profiles = await profilesRes.json();

    if (state.selectedProfile === null) {
      state.selectedProfile = state.profiles[0];
    }

    // Ensure benchmarks exist
    const allBenchKeys = new Set();
    state.models.forEach(m => {
      if (m.benchmarks) Object.keys(m.benchmarks).forEach(k => allBenchKeys.add(k));
    });
    // Restore from URL or use all available
    if (state.selectedBenchmarks.length === 0) {
      state.selectedBenchmarks = Array.from(allBenchKeys);
    }

    return true;
  } catch (err) {
    console.error('Failed to load data:', err);
    document.querySelector('.container').innerHTML = `
      <div class="loading" style="flex-direction:column;gap:12px;padding:80px 20px">
        <div style="font-size:2rem">⚠</div>
        <div>Failed to load benchmark data.</div>
        <div style="font-size:0.85rem;color:var(--text-tertiary)">Make sure data/models.json and data/profiles.json exist.</div>
      </div>
    `;
    return false;
  }
}

/* ---- Init ---- */

async function init() {
  // Show loading state
  document.querySelector('.container').innerHTML = `
    <div class="loading"><div class="loading-spinner"></div>Loading benchmark data...</div>
  `;

  const loaded = await loadData();
  if (!loaded) return;

  const hash = window.location.hash;
  parseURL();

  if (!state.benchmarksUserSet && !hash.includes('bench=') && state.selectedProfile?.default_benchmarks) {
    applyProfileDefaults(state.selectedProfile);
  }

  // Init UI
  if (state.selectedProfile.id === 'custom') {
    state.selectedProfile.input_weight = state.customInputWeight / 100;
    state.selectedProfile.output_weight = state.customOutputWeight / 100;
  }

  // Wait for DOM
  await new Promise(r => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', r);
    } else {
      r();
    }
  });

  // Build the UI
  buildUI();

  // Set control values from state
  document.getElementById('modelSet').value = state.selectedSet;
  document.getElementById('viewToggle').value = state.viewMode;
  syncModelPickerUI();

  // Sync benchmark checkboxes
  document.querySelectorAll('#benchMenu input[type="checkbox"]').forEach(cb => {
    cb.checked = state.selectedBenchmarks.includes(cb.value);
  });

  // Custom slider init
  initCustomSliders();
  if (state.selectedProfile.id === 'custom') {
    document.getElementById('customInputSlider').value = state.customInputWeight;
    document.getElementById('customOutputSlider').value = 100 - state.customInputWeight;
  }

  // Render
  renderProfilePills();
  updateProfileCard();
  fullRender();
}

function buildUI() {
  const container = document.querySelector('.container');
  const modelOptions = state.models.map(m => `
    <label class="benchmark-option model-option">
      <input type="checkbox" value="${m.id}">
      <span class="model-option-name">${m.name}</span>
      <span class="model-option-provider">${m.provider}</span>
    </label>
  `).join('');

  container.innerHTML = `
    <!-- Profile Picker -->
    <div class="profile-picker" id="profilePicker"></div>

    <!-- Active profile context -->
    <div class="card profile-compact" id="profileCard">
      <div class="profile-compact-main">
        <div class="profile-header">
          <div class="profile-icon"><span class="ti" id="profileIcon"></span></div>
          <div class="profile-title-block">
            <span class="profile-name" id="profileName"></span>
            <div class="profile-tokens" id="profileTokens"></div>
          </div>
        </div>
        <div class="profile-examples" id="profileExamples"></div>
        <div class="profile-rationale" id="profileRationale"></div>
      </div>
      <div class="weights-display profile-weights">
        <div class="weight-item">
          <span>Input</span>
          <div class="weight-bar"><div class="weight-fill input-fill" id="inputFill"></div></div>
          <span class="weight-pct" id="weightInput">50%</span>
        </div>
        <div class="weight-item">
          <span>Output</span>
          <div class="weight-bar"><div class="weight-fill output-fill" id="outputFill"></div></div>
          <span class="weight-pct" id="weightOutput">50%</span>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls-row">
      <select id="modelSet">
        <option value="all">Recommended for profile</option>
        <option value="closed">Closed source only</option>
        <option value="open">Open source only</option>
        <option value="top5v5">Top 5 Closed vs Top 5 Open</option>
        <option value="top3v3">Top 3 vs Top 3</option>
        <option value="pick">Pick models…</option>
      </select>

      <div class="benchmark-dropdown">
        <button class="filter-btn" id="modelPickerBtn" type="button">
          <span class="ti ti-list-check"></span> Pick models ▾
        </button>
        <div class="benchmark-menu model-picker-menu" id="modelPickerMenu">
          <div class="picker-hint">Select models to compare side-by-side</div>
          ${modelOptions}
        </div>
      </div>

      <div class="benchmark-dropdown">
        <button class="filter-btn" id="benchBtn" type="button">
          <span class="ti ti-list-check"></span> Benchmarks ▾
        </button>
        <div class="benchmark-menu" id="benchMenu">
          ${Object.entries(BENCH_LABELS).map(([key, label]) => `
            <label class="benchmark-option">
              <input type="checkbox" value="${key}" checked>
              ${label}
            </label>
          `).join('')}
        </div>
      </div>

      <select id="viewToggle">
        <option value="vaps">VAPS (price-adjusted)</option>
        <option value="raw">Weighted raw score</option>
        <option value="scatter">Value map (scatter)</option>
      </select>
    </div>

    <!-- Custom Sliders -->
    <div class="slider-panel" id="sliderPanel">
      <div class="slider-group">
        <div class="slider-row">
          <label>Input %</label>
          <input type="range" id="customInputSlider" min="0" max="100" value="50">
          <span class="slider-value" id="customInputVal">50%</span>
        </div>
        <div class="slider-row">
          <label>Output %</label>
          <input type="range" id="customOutputSlider" min="0" max="100" value="50">
          <span class="slider-value" id="customOutputVal">50%</span>
        </div>
        <div style="font-size:0.82rem;color:var(--text-tertiary);text-align:center">
          Weights must sum to 100%. Drag one slider — the other adjusts automatically.
        </div>
      </div>
    </div>

    <!-- Comparison: chart + insights + table -->
    <div class="dashboard">
      <div class="card dashboard-chart">
        <div class="card-title" id="chartTitle">Benchmark Comparison</div>
        <div class="chart-subtitle" id="chartSubtitle"></div>
        <div class="scatter-guide" id="scatterGuide" hidden>
          <div class="scatter-quadrant scatter-q-best"><span>↖</span> Best value — high score, low cost</div>
          <div class="scatter-quadrant scatter-q-capable"><span>↗</span> Capable — high score, premium $</div>
          <div class="scatter-quadrant scatter-q-budget"><span>↙</span> Budget — cheap, weaker raw</div>
          <div class="scatter-quadrant scatter-q-avoid"><span>↘</span> Avoid — weak and expensive</div>
        </div>
        <div class="chart-container">
          <canvas id="mainChart"></canvas>
        </div>
        <div class="chart-legend" id="chartLegend"></div>
      </div>

      <div class="insights-strip" id="insightsStrip"></div>

      <div class="dashboard-table">
        <div class="table-wrapper">
          <table class="model-table" id="modelTable">
            <thead>
              <tr>
                <th data-sort="name" onclick="handleTableSort('name')">Model <span class="sort-icon">▽</span></th>
                <th data-sort="provider" onclick="handleTableSort('provider')">Provider <span class="sort-icon">▽</span></th>
                <th data-sort="type" onclick="handleTableSort('type')">Type <span class="sort-icon">▽</span></th>
                <th data-sort="input" onclick="handleTableSort('input')">Input $/1M <span class="sort-icon">▽</span></th>
                <th data-sort="output" onclick="handleTableSort('output')">Output $/1M <span class="sort-icon">▽</span></th>
                <th data-sort="eff" onclick="handleTableSort('eff')">Eff. $/1M <span class="sort-icon">▽</span></th>
                <th data-sort="raw" onclick="handleTableSort('raw')">Wt. Raw <span class="sort-icon">▽</span></th>
                <th data-sort="vaps" onclick="handleTableSort('vaps')">VAPS <span class="sort-icon">▽</span></th>
                <th data-sort="updated" onclick="handleTableSort('updated')">Updated <span class="sort-icon">▽</span></th>
              </tr>
            </thead>
            <tbody>
              <tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-tertiary)">Loading...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <article class="landing" id="landing">
      <div class="landing-hero">
        <p class="landing-eyebrow">Built for builders who pay the API bill themselves</p>
        <h2 class="landing-headline">Stop picking the model that wins Twitter.<br>Pick the one that wins for <span class="landing-accent">your</span> workload.</h2>
        <p class="landing-lead">
          Raw leaderboards rank models on skill alone. Your app bills on <strong>input tokens, output tokens, and how often you call the API</strong>.
          llm-value-bench scores 30+ models by real benchmark performance adjusted for your usage profile and live pricing — so solo developers and indie founders ship faster without bleeding budget.
        </p>
        <div class="landing-hero-actions">
          <a href="#" class="landing-cta" id="scrollToTool">Compare models now ↑</a>
          <a href="https://github.com/tapankumarpatro/llm-value-benchmark" class="landing-cta-secondary" target="_blank" rel="noopener">
            <span class="ti ti-brand-github"></span> View on GitHub
          </a>
        </div>
        <div class="landing-trust">
          <div class="landing-stat"><span class="landing-stat-num">30+</span><span class="landing-stat-label">models tracked</span></div>
          <div class="landing-stat"><span class="landing-stat-num">9</span><span class="landing-stat-label">usage profiles</span></div>
          <div class="landing-stat"><span class="landing-stat-num">$0</span><span class="landing-stat-label">free, no signup</span></div>
          <div class="landing-stat"><span class="landing-stat-num">Open</span><span class="landing-stat-label">source MIT</span></div>
        </div>
      </div>

      <section class="landing-section">
        <h3 class="landing-section-title">Who this is for</h3>
        <p class="landing-section-intro">If you're building alone and every API dollar comes from your own pocket, this tool is for you.</p>
        <div class="landing-persona-grid">
          <div class="landing-persona-card">
            <span class="landing-icon ti ti-user-code"></span>
            <h4>Solo developers</h4>
            <p>Shipping AI features without an ML team. Compare Claude, GPT, Gemini, and open models before you hard-code a default in production.</p>
          </div>
          <div class="landing-persona-card">
            <span class="landing-icon ti ti-rocket"></span>
            <h4>Indie hackers</h4>
            <p>Launching side projects, SaaS MVPs, and AI wrappers. Find the cheapest model that still hits your quality bar — not the flagship you can't afford at scale.</p>
          </div>
          <div class="landing-persona-card">
            <span class="landing-icon ti ti-building-store"></span>
            <h4>Solo entrepreneurs</h4>
            <p>Running n8n workflows, customer chatbots, and content pipelines. See effective $/1M for <em>your</em> token mix, not a generic chat ratio.</p>
          </div>
          <div class="landing-persona-card">
            <span class="landing-icon ti ti-wallet"></span>
            <h4>Bootstrapped founders</h4>
            <p>Choosing between closed APIs and self-hosted open models. Compare real value — benchmark score divided by what you actually pay per call.</p>
          </div>
        </div>
      </section>

      <section class="landing-section landing-problem">
        <div class="landing-split">
          <div class="landing-split-text">
            <h3 class="landing-section-title">Why raw benchmarks mislead you</h3>
            <p>SWE-bench and LiveCodeBench tell you which model is smartest. They don't tell you which model is smartest <strong>for your budget</strong>.</p>
            <ul class="landing-checklist">
              <li><span class="ti ti-x landing-x"></span> Agent apps re-send 200k+ tokens of context every turn — input pricing dominates</li>
              <li><span class="ti ti-x landing-x"></span> Voice and chat apps generate long outputs — output pricing dominates</li>
              <li><span class="ti ti-x landing-x"></span> Provider pages list $/1M rates, not blended cost for your workload</li>
              <li><span class="ti ti-x landing-x"></span> "Best model" listicles assume one-size-fits-all usage</li>
            </ul>
          </div>
          <div class="landing-callout-card">
            <p class="landing-callout-label">Example · Agentic Orchestrator</p>
            <p class="landing-callout-big">82% input · 18% output</p>
            <p class="landing-callout-body">Claude Opus 4.8 costs ~$5/1M effective on agents — not $25/1M from naive headline pricing. The wrong assumption costs hundreds per month at scale.</p>
          </div>
        </div>
      </section>

      <section class="landing-section">
        <h3 class="landing-section-title">One tool, nine real-world usage profiles</h3>
        <p class="landing-section-intro">Each profile models how tokens actually flow in production — not generic chat.</p>
        <div class="landing-table-wrap">
          <table class="landing-table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Typical use</th>
                <th>Token bias</th>
                <th>Best for</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Agentic Orchestrator</strong></td>
                <td>LangGraph, CrewAI, AutoGen</td>
                <td class="mono">82% in / 18% out</td>
                <td>Long-context agents, tool calling</td>
              </tr>
              <tr>
                <td><strong>Voice / Realtime</strong></td>
                <td>ElevenLabs, OpenAI Realtime, Vapi</td>
                <td class="mono">28% in / 72% out</td>
                <td>Speech pipelines, low-latency chat</td>
              </tr>
              <tr>
                <td><strong>RAG / Doc Q&A</strong></td>
                <td>Notion AI, Perplexity, custom RAG</td>
                <td class="mono">88% in / 12% out</td>
                <td>Retrieval-heavy, short answers</td>
              </tr>
              <tr>
                <td><strong>Coding Assistant</strong></td>
                <td>Cursor, Claude Code, Copilot</td>
                <td class="mono">50% in / 50% out</td>
                <td>File context + code generation</td>
              </tr>
              <tr>
                <td><strong>Workflow Automation</strong></td>
                <td>n8n, Zapier, Make</td>
                <td class="mono">72% in / 28% out</td>
                <td>Structured JSON in/out</td>
              </tr>
              <tr>
                <td><strong>Long-form Generation</strong></td>
                <td>Scripts, ads, content pipelines</td>
                <td class="mono">22% in / 78% out</td>
                <td>Brief in, long copy out</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="landing-section">
        <h3 class="landing-section-title">Why builders choose llm-value-bench</h3>
        <div class="landing-feature-grid">
          <div class="landing-feature-card">
            <span class="landing-icon ti ti-calculator"></span>
            <h4>Price-adjusted scores (VAPS)</h4>
            <p>Benchmark score divided by log of effective cost. Rewards models that perform well <em>and</em> fit your token economics — not just the smartest model on the leaderboard.</p>
          </div>
          <div class="landing-feature-card">
            <span class="landing-icon ti ti-adjustments-horizontal"></span>
            <h4>Profile-aware comparisons</h4>
            <p>Switch from agents to voice to RAG and the model pool, benchmarks, and rankings all update. No more comparing a coding model to a search model with the same yardstick.</p>
          </div>
          <div class="landing-feature-card">
            <span class="landing-icon ti ti-currency-dollar"></span>
            <h4>Live API pricing</h4>
            <p>Input and output rates from official provider docs and OpenRouter. See effective $/1M for your profile before you commit to a default model in prod.</p>
          </div>
          <div class="landing-feature-card">
            <span class="landing-icon ti ti-list-check"></span>
            <h4>Hand-pick any matchup</h4>
            <p>Compare Claude Opus vs DeepSeek V4 vs Gemini Flash head-to-head. Filter closed vs open source. Toggle raw scores vs value-adjusted VAPS.</p>
          </div>
          <div class="landing-feature-card">
            <span class="landing-icon ti ti-code"></span>
            <h4>Built in the open</h4>
            <p>MIT licensed, no signup, no tracking. Data in plain JSON — fork it, fix a price, add a model, deploy your own instance on GitHub Pages.</p>
          </div>
          <div class="landing-feature-card">
            <span class="landing-icon ti ti-share"></span>
            <h4>Shareable comparisons</h4>
            <p>Every filter state lives in the URL. Send a teammate the exact profile, model set, and benchmarks you're evaluating — one link, zero setup.</p>
          </div>
        </div>
      </section>

      <section class="landing-section landing-steps">
        <h3 class="landing-section-title">How to find your best model in 60 seconds</h3>
        <ol class="landing-steps-list">
          <li>
            <span class="landing-step-num">1</span>
            <div>
              <strong>Pick your usage profile</strong>
              <p>Agent, coding, RAG, voice, workflow — or set a custom input/output ratio.</p>
            </div>
          </li>
          <li>
            <span class="landing-step-num">2</span>
            <div>
              <strong>Review recommended models for that profile</strong>
              <p>Or hand-pick models, filter closed vs open, toggle benchmarks.</p>
            </div>
          </li>
          <li>
            <span class="landing-step-num">3</span>
            <div>
              <strong>Sort by VAPS or effective $/1M</strong>
              <p>The table and chart reorder for your economics. Ship with the model that fits.</p>
            </div>
          </li>
        </ol>
      </section>

      <footer class="landing-footer">
        <p class="landing-footer-text">
          Free forever. Benchmark data from official leaderboards. Pricing from provider docs and OpenRouter.
          Built by a solo developer, for solo developers.
        </p>
        <a href="#" class="landing-cta" id="scrollToToolBottom">Back to comparison ↑</a>
      </footer>
    </article>
  `;

  initControls();
  initLandingCTA();
}

function initLandingCTA() {
  function scrollToTool(e) {
    e.preventDefault();
    document.getElementById('profilePicker')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.getElementById('scrollToTool')?.addEventListener('click', scrollToTool);
  document.getElementById('scrollToToolBottom')?.addEventListener('click', scrollToTool);
}

/* ---- Start ---- */
init();
