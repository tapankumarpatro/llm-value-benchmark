<div align="center">

  <img src="https://img.shields.io/badge/status-live-brightgreen" alt="Status">
  <img src="https://img.shields.io/github/deployments/tapankumarpatro/llm-value-benchmark/github-pages" alt="Deploy">
  <img src="https://img.shields.io/github/license/tapankumarpatro/llm-value-benchmark" alt="License">
  <img src="https://img.shields.io/badge/build-zero%20dependencies-important" alt="Zero Deps">

  <br><br>

  <p>
    <a href="https://tapankumarpatro.github.io/llm-value-benchmark">
      <img src="https://raw.githubusercontent.com/tapankumarpatro/llm-value-benchmark/master/assets/screenshot-hero.png" alt="LLM Value Benchmark — comparison dashboard" width="800">
    </a>
  </p>

  <h1>LLM Value Benchmark</h1>
  <p><strong>Find the best AI model for your actual usage — not just the most hyped one.</strong></p>

  <p>
    <a href="https://tapankumarpatro.github.io/llm-value-benchmark"><strong>Launch the Benchmark →</strong></a>
  </p>

  <p>
    <a href="#-why-this-exists">Why</a> ·
    <a href="#-key-features">Features</a> ·
    <a href="#-who-its-for">Who It's For</a> ·
    <a href="#-live-demo">Live Demo</a> ·
    <a href="#-faq">FAQ</a> ·
    <a href="#-contributing">Contributing</a>
  </p>

</div>

## Why This Exists

Every week a new LLM launches. Every launch comes with impressive benchmark scores, but the real question is:

> *"Does this model actually give me better results for what **I** build — and is it worth the price?"*

LLM Value Benchmark answers exactly that. It takes raw benchmark scores from major leaderboards and adjusts them for **real-world pricing** based on **how you actually use AI**. The result is the **Value-Adjusted Performance Score (VAPS)** — a single number that tells you which model delivers the most intelligence per dollar for your specific workflow.

## Who It's For

| You are a... | You'll use this to... |
|---|---|
| **Solo developer** | Pick the most cost-effective model for your coding assistant or AI features |
| **Indie hacker** | Compare models before committing API budget to your SaaS product |
| **Bootstrapped founder** | Find the cheapest model that still delivers quality results |
| **AI tinkerer** | See which open-source models beat closed-source ones on value |
| **Freelance engineer** | Choose the right model for client projects without overspending |
| **Agency owner** | Optimize API costs across multiple client workflows |

## Key Features

- **Profile-based comparison** — 9 usage profiles (Coding Assistant, RAG, Chat, Agentic Orchestrator, etc.) each set the right input/output token weights and benchmark priorities for your use case.
- **30+ models compared** — Claude Opus 4.8, GPT-4o, Gemini, DeepSeek, Qwen, Llama, Mistral, Mixtral, Perplexity, and more with OpenRouter-verified API pricing.
- **Profile-weighted scoring** — Benchmarks are weighted per profile (e.g. SWE-bench for coding, AIME for agents) so rankings change when you switch workflows.
- **Quality floors** — Models that fail minimum capability gates for a profile are filtered out automatically.
- **Three chart views** — VAPS (price-adjusted), raw weighted score, and a scatter **value map** (score vs. effective $/1M).
- **Comparison-first layout** — Pick a profile, see the chart and table immediately; landing content sits below the tool.
- **Manual model picker** — Compare any subset of models side-by-side regardless of profile recommendations.
- **Sortable data table** — Prices, effective cost, VAPS, and last-updated dates in one view.
- **Shareable URLs** — All settings encoded in the URL hash. Share your exact comparison with teammates.
- **Zero setup** — Open the page. No login. No API key. No build step.

## Live Demo

The benchmark is live at:

➡️ **[https://tapankumarpatro.github.io/llm-value-benchmark](https://tapankumarpatro.github.io/llm-value-benchmark)**

### Comparison dashboard

Profile tabs, weighted scoring controls, VAPS bar chart, insight cards, and sortable model table:

<p align="center">
  <img src="https://raw.githubusercontent.com/tapankumarpatro/llm-value-benchmark/master/assets/screenshot-comparison.png" alt="Benchmark comparison — profiles, chart, and model table" width="800">
</p>

### Landing page

SEO-friendly guide for solo developers and indie hackers — scroll below the tool on the live site:

<p align="center">
  <img src="https://raw.githubusercontent.com/tapankumarpatro/llm-value-benchmark/master/assets/screenshot-landing.png" alt="Landing page for solo developers and indie hackers" width="800">
</p>

## FAQ

### How is VAPS different from raw benchmark scores?

Raw scores tell you which model is smartest. VAPS tells you which model gives you the **most intelligence per dollar** for your specific usage pattern. A model that scores 5% higher but costs 10× more is usually a worse deal.

### What profiles are available?

9 built-in profiles: Agentic Orchestrator, Workflow Automation, Coding Assistant, Long-form Generation, Chat Assistant, RAG / Doc Q&A, Code Review / Analysis, Voice / Realtime, and Custom (set your own weights with sliders).

### Are the prices up to date?

Pricing reflects publicly available API rates from each provider's official pricing page as of the `last_updated` date in the model entry. Prices change frequently — check provider pages for current rates.

### Can I add my own model or profile?

Yes. Submit a PR to `data/models.json` or `data/profiles.json`. See [CONTRIBUTING.md](CONTRIBUTING.md) for rules.

### Is this free?

Yes. Open source, no ads, no tracking, no account needed.

## How This Stays Live

This is a **community-maintained benchmark**. Here's how new models and price changes get in:

### Automated (GitHub Actions)

Every push to `master` triggers an automatic deploy to GitHub Pages. The `.github/workflows/deploy.yml` workflow deploys the repo root with zero build steps.

### Community PRs

When a new model launches or prices change, anyone can submit a PR:

1. Edit `data/models.json` with the new model/pricing
2. Include a source URL for the pricing
3. Include a source URL for benchmark scores
4. Update `last_updated` field

The `CONTRIBUTING.md` file has all the rules. PRs are reviewed and merged — the site updates within ~20 seconds of merge.

### What about automated scraping?

Long-term, a scheduled GitHub Action (e.g. weekly cron) can fetch pricing from provider APIs and benchmark scores from leaderboard endpoints. Contributions welcome — see the [open issues](https://github.com/tapankumarpatro/llm-value-benchmark/issues) for this feature.

## Tech Stack

| Layer | Choice |
|---|---|
| **Framework** | None — pure HTML + CSS + JS |
| **Charts** | Chart.js (jsDelivr CDN) |
| **Icons** | Tabler Icons + Simple Icons (CDN) |
| **Fonts** | Inter + JetBrains Mono (Google Fonts) |
| **Theme** | Light mode with OnSet brand accent |
| **Hosting** | GitHub Pages (auto-deploy via Actions) |
| **Build** | None — deploy the repo root as-is |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines. Quick summary:

- **Adding a model** — PR to `data/models.json` with at least 2 benchmark scores
- **Updating pricing** — PR with a source URL and date
- **Adding a profile** — PR to `data/profiles.json` with weights that sum to 1.0
- **Bug fixes & features** — Open an issue first, then PR

## License

MIT — free to use, modify, and distribute.
