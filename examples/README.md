# Contract Guard — verifiable sample evidence

These are **real outputs** from ForgeFrame Contract Guard v0.1.3 running on public, synthetic OpenAPI specifications in `fixtures/`. The reports demonstrate the behavior; they are not customer data or independent security certification.

| Example | Baseline | Proposed revision | Verdict | Findings |
| --- | --- | --- | --- | --- |
| [Safe change](./safe/report.json) | `fixtures/base.yaml` | `fixtures/safe.yaml` | passed | 0 |
| [Breaking change](./breaking/report.json) | `fixtures/base.yaml` | `fixtures/breaking.yaml` | blocked | 2 |

The breaking revision makes a query parameter required and expands a response enum. The generated `summary.md` files are human-readable; `report.json` includes SHA-256 digests for the compared specification bytes and explicit rule fingerprints.

To reproduce locally, install [oasdiff 1.33.0](https://github.com/oasdiff/oasdiff/releases/tag/v1.33.0) and run from the repository root:

```sh
node cli.mjs --base fixtures/base.yaml --head fixtures/safe.yaml --out examples/safe
node cli.mjs --base fixtures/base.yaml --head fixtures/breaking.yaml --out examples/breaking
```

Expected CLI exit codes are `0` for safe and `1` for breaking. Repeating the run will update `generatedAt` and may update engine version presentation; the **input SHA-256 digests and detected breaking changes remain reproducible** for the pinned engine and policies.

Hash links are not digital signatures, runtime validation or compliance evidence.
