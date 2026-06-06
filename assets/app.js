/* =============================================
   llm-value-bench — Application Logic
   ============================================= */

/* ---- State ---- */
const state = {
  models: [],
  profiles: [],
  selectedProfile: null,
  selectedSet: 'all',
  selectedBenchmarks: ['livecode_bench','swe_bench','aime_2025','gpqa_diamond','humaneval','mbpp'],
  viewMode: 'vaps',    // 'vaps' or 'raw'
  chart: null,
  sortKey: null,
  sortAsc: true,
  benchMenuOpen: false,
  customInputWeight: 50,
  customOutputWeight: 50,
};

const BENCH_LABELS = {
  livecode_bench: 'LiveCodeBench v6',
  swe_bench: 'SWE-bench Verified',
  aime_2025: 'AIME 2025',
  gpqa_diamond: 'GPQA Diamond',
  humaneval: 'HumanEval',
  mbpp: 'MBPP+',
};

const SET_OPTIONS = {
  all: 'All models',
  closed: 'Closed source only',
  open: 'Open source only',
  top5v5: 'Top 5 Closed vs Top 5 Open',
  top3v3: 'Top 3 vs Top 3',
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

function avgRaw(model, benchmarks) {
  let sum = 0, count = 0;
  for (const b of benchmarks) {
    if (model.benchmarks[b] !== undefined) {
      sum += model.benchmarks[b];
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function avgVaps(model, profile, benchmarks) {
  const cost = effectiveCost(model, profile);
  let sum = 0, count = 0;
  for (const b of benchmarks) {
    if (model.benchmarks[b] !== undefined) {
      sum += vaps(model.benchmarks[b], cost);
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/* ---- Model Filtering ---- */

function getFilteredModels() {
  const set = state.selectedSet;
  let filtered = [...state.models];

  if (set === 'closed') {
    filtered = filtered.filter(m => m.type === 'closed');
  } else if (set === 'open') {
    filtered = filtered.filter(m => m.type === 'open');
  } else if (set === 'top5v5') {
    const closed = filtered.filter(m => m.type === 'closed')
      .sort((a, b) => avgRaw(b, state.selectedBenchmarks) - avgRaw(a, state.selectedBenchmarks))
      .slice(0, 5);
    const open = filtered.filter(m => m.type === 'open')
      .sort((a, b) => avgRaw(b, state.selectedBenchmarks) - avgRaw(a, state.selectedBenchmarks))
      .slice(0, 5);
    filtered = [...closed, ...open];
  } else if (set === 'top3v3') {
    const closed = filtered.filter(m => m.type === 'closed')
      .sort((a, b) => avgRaw(b, state.selectedBenchmarks) - avgRaw(a, state.selectedBenchmarks))
      .slice(0, 3);
    const open = filtered.filter(m => m.type === 'open')
      .sort((a, b) => avgRaw(b, state.selectedBenchmarks) - avgRaw(a, state.selectedBenchmarks))
      .slice(0, 3);
    filtered = [...closed, ...open];
  }

  return filtered;
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

/* ---- Chart Rendering ---- */
/* global Chart */

function renderChart() {
  const models = getFilteredModels();
  const benchmarks = state.selectedBenchmarks;
  const view = state.viewMode;
  const profile = state.selectedProfile;
  const ctx = document.getElementById('mainChart').getContext('2d');

  if (state.chart) {
    state.chart.destroy();
  }

  if (models.length === 0 || benchmarks.length === 0) {
    state.chart = null;
    document.querySelector('.chart-container').innerHTML =
      '<div class="loading"><div class="loading-spinner"></div>No data to display</div>';
    return;
  }

  // Build datasets: one per model
  const datasets = models.map((model, i) => {
    const color = getModelColor(model, i);
    const data = benchmarks.map(b => {
      const score = model.benchmarks[b];
      if (score === undefined) return null;
      if (view === 'raw') return score;
      const cost = effectiveCost(model, profile);
      return vaps(score, cost);
    });

    return {
      label: model.name,
      data,
      backgroundColor: getModelColorRgba(model, 0.85),
      borderColor: color,
      borderWidth: 1,
      borderRadius: 3,
      barPercentage: 0.85,
      categoryPercentage: 0.7,
    };
  });

  const config = {
    type: 'bar',
    data: {
      labels: benchmarks.map(b => BENCH_LABELS[b] || b),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 400,
      },
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
              const bench = benchmarks[ctx.dataIndex];
              const raw = model.benchmarks[bench];
              const cost = effectiveCost(model, profile);
              const v = ctx.parsed.y;
              const lines = [
                `  Raw: ${raw !== undefined ? raw.toFixed(1) + '%' : 'N/A'}`,
                `  Eff. $: $${cost.toFixed(2)}/1M`,
                `  ${view === 'vaps' ? 'VAPS' : 'Score'}: ${v !== null ? v.toFixed(1) : 'N/A'}`,
              ];
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Inter', size: 11 },
            maxRotation: 35,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(128,128,128,0.08)',
          },
          ticks: {
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

  state.chart = new Chart(ctx, config);

  // Render legend
  renderLegend(models);
}

/* ---- Chart DataLabels Plugin ---- */
const ChartDataLabels = {
  id: 'customDataLabels',
  afterDraw(chart) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      if (!meta.hidden) {
        meta.data.forEach((bar, index) => {
          const val = dataset.data[index];
          if (val === null || val === undefined) return;
          const text = val.toFixed(1);
          ctx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-secondary').trim() || '#6b6d74';
          ctx.font = '500 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(text, bar.x, bar.y - 3);
        });
      }
    });
  },
};

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
    const avg = avgVaps(m, profile, benches);
    const raw = avgRaw(m, benches);
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
      <div class="insight-label">Highest Raw Score</div>
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
    const raw = avgRaw(m, benches);
    const avgV = avgVaps(m, profile, benches);
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

/* ---- Profile Card ---- */

function updateProfileCard() {
  const p = state.selectedProfile;
  document.getElementById('profileIcon').className = `ti ${p.icon}`;
  document.getElementById('profileName').textContent = p.label;
  document.getElementById('profileExamples').textContent =
    p.examples.length > 0 ? `Used by: ${p.examples.join(', ')}` : '';
  document.getElementById('profileTokens').textContent =
    p.typical_input_tokens
      ? `Typical: ~${formatNumber(p.typical_input_tokens)} input / ~${formatNumber(p.typical_output_tokens)} output tokens per call`
      : 'Custom ratio — set your own weights below';
  document.getElementById('profileRationale').textContent = p.rationale || '';

  const wIn = (p.input_weight * 100).toFixed(0);
  const wOut = (p.output_weight * 100).toFixed(0);
  document.getElementById('weightInput').textContent = `${wIn}%`;
  document.getElementById('weightOutput').textContent = `${wOut}%`;
  document.getElementById('inputFill').style.width = `${wIn}%`;
  document.getElementById('outputFill').style.width = `${wOut}%`;

  // Formula box
  const profile = state.selectedProfile;
  const firstModel = state.models[0];
  if (firstModel) {
    const cost = effectiveCost(firstModel, profile);
    const costStr = `$${cost.toFixed(2)}/1M`;
    document.getElementById('formulaEffectiveCost').textContent = costStr;
    document.getElementById('formulaEffectiveCostLarge').textContent = costStr;
  }
  document.getElementById('formulaWeights').innerHTML =
    `Input <strong>${wIn}%</strong> · Output <strong>${wOut}%</strong>`;
  document.getElementById('formulaInputWeight').textContent = `$${firstModel ? firstModel.input_price.toFixed(2) : '–'} × ${(profile.input_weight * 100).toFixed(0)}%`;
  document.getElementById('formulaOutputWeight').textContent = `$${firstModel ? firstModel.output_price.toFixed(2) : '–'} × ${(profile.output_weight * 100).toFixed(0)}%`;
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

  // Show/hide custom sliders
  const panel = document.getElementById('sliderPanel');
  if (id === 'custom') {
    panel.classList.add('visible');
    // Restore any custom weights
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

function initControls() {
  // Model set dropdown
  const setSelect = document.getElementById('modelSet');
  setSelect.addEventListener('change', () => {
    state.selectedSet = setSelect.value;
    fullRender();
    updateURL();
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
  });

  const benchCheckboxes = benchMenu.querySelectorAll('input[type="checkbox"]');
  benchCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
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
        if (val === 'vaps' || val === 'raw') state.viewMode = val;
        break;
      case 'bench':
        state.selectedBenchmarks = val.split(',').filter(b => BENCH_LABELS[b]);
        if (state.selectedBenchmarks.length === 0) {
          state.selectedBenchmarks = Object.keys(BENCH_LABELS);
        }
        break;
    }
  }
}

function updateURL() {
  const benchStr = state.selectedBenchmarks.join(',');
  const hash = `profile=${state.selectedProfile.id}&set=${state.selectedSet}&view=${state.viewMode}&bench=${benchStr}`;
  history.replaceState(null, '', '#' + hash);
}

/* ---- Full Re-render ---- */

function fullRender() {
  renderChart();
  renderInsights();
  renderTable();
}

/* ---- Data Loading ---- */

async function loadData() {
  try {
    const [modelsRes, profilesRes] = await Promise.all([
      fetch('data/models.json'),
      fetch('data/profiles.json'),
    ]);
    state.models = await modelsRes.json();
    state.profiles = await profilesRes.json();

    // Set defaults
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

  // Parse URL after data is loaded
  parseURL();

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
  // Inject the main content into the container
  const container = document.querySelector('.container');
  container.innerHTML = `
    <!-- Profile Picker -->
    <div class="profile-picker" id="profilePicker"></div>

    <!-- Main Grid -->
    <div class="main-grid">

      <!-- Profile Card -->
      <div class="card" id="profileCard">
        <div class="profile-header">
          <div class="profile-icon"><span class="ti" id="profileIcon"></span></div>
          <span class="profile-name" id="profileName"></span>
        </div>
        <div class="profile-examples" id="profileExamples"></div>
        <div class="profile-tokens" id="profileTokens"></div>
        <div class="profile-rationale" id="profileRationale"></div>
        <div class="weights-display">
          <div class="weight-item">
            <span>Input</span>
            <div class="weight-bar"><div class="weight-fill input-fill" id="inputFill"></div></div>
            <span style="font-family:var(--font-mono);font-size:0.8rem" id="weightInput">50%</span>
          </div>
          <div class="weight-item">
            <span>Output</span>
            <div class="weight-bar"><div class="weight-fill output-fill" id="outputFill"></div></div>
            <span style="font-family:var(--font-mono);font-size:0.8rem" id="weightOutput">50%</span>
          </div>
        </div>
      </div>

      <!-- Formula Display -->
      <div class="card">
        <div class="card-title">VAPS Formula</div>
        <div class="formula-box">
          <div class="formula-main">
            VAPS = Benchmark Score &divide; log<sub>10</sub>(1 + Effective Cost)
          </div>
          <div class="formula-vars">
            <div>Effective Cost = (<span id="formulaInputWeight">$2.50 × 82%</span>) + (<span id="formulaOutputWeight">$10.00 × 18%</span>)</div>
            <div style="margin-top:6px">
              Blended cost: <strong id="formulaEffectiveCost">$3.85/1M</strong>
            </div>
            <div style="margin-top:4px">
              Current weights: <span id="formulaWeights">Input 82% · Output 18%</span>
            </div>
          </div>
        </div>
        <div style="text-align:right">
          <div class="live-cost-label">Profile Effective Cost/1M</div>
          <div class="live-cost" id="formulaEffectiveCostLarge"></div>
        </div>
      </div>

    </div>

    <!-- Controls -->
    <div class="controls-row">
      <select id="modelSet">
        <option value="all">All models</option>
        <option value="closed">Closed source only</option>
        <option value="open">Open source only</option>
        <option value="top5v5">Top 5 Closed vs Top 5 Open</option>
        <option value="top3v3">Top 3 vs Top 3</option>
      </select>

      <div class="benchmark-dropdown">
        <button class="filter-btn" id="benchBtn">
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
        <option value="raw">Raw score</option>
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

    <!-- Chart -->
    <div class="card full-width">
      <div class="chart-container">
        <canvas id="mainChart"></canvas>
      </div>
      <div class="chart-legend" id="chartLegend"></div>
    </div>

    <!-- Insights Strip -->
    <div class="insights-strip full-width" id="insightsStrip"></div>

    <!-- Model Table -->
    <div class="full-width">
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
              <th data-sort="raw" onclick="handleTableSort('raw')">Avg Raw <span class="sort-icon">▽</span></th>
              <th data-sort="vaps" onclick="handleTableSort('vaps')">Avg VAPS <span class="sort-icon">▽</span></th>
              <th data-sort="updated" onclick="handleTableSort('updated')">Updated <span class="sort-icon">▽</span></th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="9" style="text-align:center;padding:30px;color:var(--text-tertiary)">Loading...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Re-init controls after DOM build
  initControls();
}

/* ---- Start ---- */
init();
