# llm-value-bench

> Which LLM gives you the best performance for your actual usage?

A single-page, open-source benchmark site that compares LLMs by **value** — not just raw benchmark scores, but scores adjusted for real-world pricing based on your usage profile.

[Launch the site →](https://your-username.github.io/llm-value-bench)

## Why this exists

Most LLM leaderboards rank models by raw benchmark scores. But raw scores tell you nothing about cost. A model that costs 100× more but scores 5% higher might be a terrible deal for your use case.

LLM Value Benchmark introduces **VAPS** — the **Value-Adjusted Performance Score** — which blends benchmark performance with effective per-token cost based on how you actually use LLMs.

## The Formula (VAPS explained)

```
effective_cost = (input_price × w_in) + (output_price × w_out)

VAPS = benchmark_score / log10(1 + effective_cost)
```

Where:

- **benchmark_score** — raw % score on a benchmark (e.g. 88.0)
- **effective_cost** — blended cost per 1M tokens based on the selected profile's input/output weights
- **log10(1 + cost)** — dampens extreme price differences so a $100 model isn't infinitely penalized vs a $1 model, but still meaningfully suppressed
- **w_in, w_out** — your profile's input and output token weight

**Higher VAPS = better value.**

## How to use

1. **Pick a profile** — Select a usage pattern (Agentic Orchestrator, Coding Assistant, RAG, etc.) or create a Custom profile.
2. **Choose your models** — Filter by availability: All, Closed only, Open only, Top 5 vs 5, or Top 3 vs 3.
3. **Select benchmarks** — Pick which benchmarks matter to you.
4. **Read the chart** — Grouped bars show VAPS (or raw score) per model per benchmark. Red = closed source, Blue = open source.
5. **Check the table** — Sortable table with all metrics. Click any column header to sort.

All settings are encoded in the URL — share links with your team.

## How to contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

**Quick links:**
- [Add a model](data/models.json) — submit a PR
- [Add a profile](data/profiles.json) — define a new usage pattern
- [Report an issue](https://github.com/your-username/llm-value-bench/issues)

## Data sources

Benchmark scores are sourced from official leaderboards and papers:

- **LiveCodeBench v6** — [livecodebench.github.io](https://livecodebench.github.io)
- **SWE-bench Verified** — [swebench.com](https://swebench.com)
- **AIME 2025** — [openai.com/index/math-2025](https://openai.com/index/math-2025)
- **GPQA Diamond** — [github.com/idavidrein/gpqa](https://github.com/idavidrein/gpqa)
- **HumanEval** — [github.com/openai/human-eval](https://github.com/openai/human-eval)
- **MBPP+** — [github.com/google-research/mbpp](https://github.com/google-research/mbpp)

Pricing sourced from official provider API pages. Prices reflect per-1M-token rates unless otherwise noted.

## Tech stack

- **Zero build tools** — Pure HTML + CSS + JavaScript
- **Chart.js** via CDN for charts
- **Tabler Icons** via CDN
- **Google Fonts** — Hanken Grotesk + JetBrains Mono
- Deployable to **GitHub Pages** in one click

## License

MIT — see [LICENSE](LICENSE) for details.