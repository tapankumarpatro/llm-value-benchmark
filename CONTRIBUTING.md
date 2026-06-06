# Contributing to llm-value-bench

Thanks for helping make LLM Value Benchmark better! Here's how to contribute.

## Adding a model

Submit a PR to [`data/models.json`](data/models.json). Add an entry following this structure:

```json
{
  "id": "model-slug",
  "name": "Full Model Name",
  "provider": "Provider Name",
  "type": "closed",
  "input_price": 1.00,
  "output_price": 4.00,
  "context_window": 128000,
  "last_updated": "2026-06-01",
  "benchmarks": {
    "livecode_bench": 85.0,
    "swe_bench": 65.0,
    "aime_2025": 88.0,
    "gpqa_diamond": 87.0,
    "humaneval": 90.0,
    "mbpp": 86.0
  },
  "notes": "Optional context about this model's pricing or availability"
}
```

**Rules:**

- `type` must be `"closed"` or `"open"`
- `input_price` and `output_price` are in USD per 1M tokens
- `last_updated` is **mandatory** — ISO date format (YYYY-MM-DD)
- **At least 2 benchmark scores** are required (more is better)
- Benchmark IDs must match the keys in `data/models.json` (one of: `livecode_bench`, `swe_bench`, `aime_2025`, `gpqa_diamond`, `humaneval`, `mbpp`)

## Updating a price

If a provider changes their pricing:

1. Update the `input_price` and/or `output_price` fields
2. Update `last_updated` to the current date
3. **Include a source URL** in your PR description linking to the official pricing page or announcement
4. **Include the date** the new pricing was observed

Example PR description:

```
Updated GPT-4o pricing per https://openai.com/api/pricing/
New prices effective 2026-05-15
```

## Adding a profile

Submit a PR to [`data/profiles.json`](data/profiles.json). Profiles define a usage pattern with input/output token weights:

```json
{
  "id": "my-profile",
  "label": "My Profile Name",
  "icon": "ti-icon-name",
  "examples": ["Example tool 1", "Example tool 2"],
  "description": "Short description of this usage pattern.",
  "input_weight": 0.60,
  "output_weight": 0.40,
  "typical_input_tokens": 10000,
  "typical_output_tokens": 500,
  "rationale": "Why these weights make sense for this use case."
}
```

**Rules:**

- `input_weight` + `output_weight` must equal 1.0
- `icon` must be a valid [Tabler Icons](https://tabler.io/icons) name (without the `ti-` prefix)
- Provide a clear `rationale` explaining the weight choices
- For the `custom` profile, use `null` for `typical_*` fields and `rationale`

## Updating benchmark scores

Benchmark scores must link to the official leaderboard or paper in the PR description. Include the date the score was observed.

## Code style

- No build tools — pure HTML, CSS, and JavaScript
- CSS uses custom properties (variables) for theming
- JavaScript is vanilla ES6+ — no transpilation
- Keep it simple. This is intentionally a no-framework project.

## Local development

Just serve the repo root with any HTTP server:

```bash
# Python
python -m http.server 8000

# Node
npx serve .

# VS Code
# Install Live Server extension, right-click index.html
```

Open `http://localhost:8000` in your browser.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).