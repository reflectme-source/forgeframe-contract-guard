# ForgeFrame Contract Guard

**Stop unexpected OpenAPI breaking changes before release. Export evidence your team can review.**

ForgeFrame Contract Guard is a self-hosted GitHub Action and command-line wrapper for API teams. It detects contract-breaking changes, enforces explicit exception expiry, and generates JSON/Markdown release evidence with SHA-256 hashes of the compared API specifications and policy.

> Scope: specification-level detection, not live runtime testing. Built on the Apache-2.0 licensed [oasdiff](https://github.com/oasdiff/oasdiff) engine, version 1.33.0. The compatibility detection rules are provided by oasdiff; ForgeFrame adds gated exception management, policy validation and evidence packaging.

## One-minute demonstration

Compare the sample contract to a change introducing a required request parameter and new response enum value:

```sh
node cli.mjs --base fixtures/base.yaml --head fixtures/breaking.yaml --out evidence/breaking
```

Expected outcome: exit code **1**, two blocking findings, `evidence/breaking/report.json` and `summary.md`.

For a safe additive change:

```sh
node cli.mjs --base fixtures/base.yaml --head fixtures/safe.yaml --out evidence/safe
```

Expected outcome: exit code **0**, zero blocking findings.

Local installation requires Node.js 20.11+ and the oasdiff 1.33.0 binary on PATH, or `OASDIFF_BIN` set to its location. The GitHub Action automatically downloads and checksums its pinned CLI binary.

## Verifiable sample reports

- [Two real breaking findings](examples/breaking/report.json) and [human-readable report](examples/breaking/summary.md).
- [Safe additive change with zero blockers](examples/safe/report.json).
- [Evidence reproduction and hash verification](examples/README.md).

## GitHub Actions

```yaml
name: API contract compatibility
on: [pull_request]
permissions:
  contents: read
jobs:
  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          fetch-depth: 0
      - name: Materialize baseline from PR base commit
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
        run: git show "$BASE_SHA:openapi.yaml" > "$RUNNER_TEMP/openapi-base.yaml"
      - uses: reflectme-source/forgeframe-contract-guard@47857973aeba8bf5bb6b034544bddaa2be6c8ad5 # v0.1.3
        with:
          base: ${{ runner.temp }}/openapi-base.yaml
          head: openapi.yaml
          evidence-dir: contract-guard-evidence
          upload-evidence: 'false' # opt in only after reviewing artifact sensitivity
```

Replace `openapi.yaml` with your OpenAPI spec path. For production, pin every action to an audited full commit SHA instead of mutable tags, including this action. Do not use `pull_request_target` with untrusted code.

The wrapper defaults to no exceptions and blocks at severity `ERR`. This example needs no policy file and no repository write permissions. Add a reviewed policy only after committing it. Artifact upload is opt-in.

## Time-limited exceptions

Copy `guard.policy.example.json` to `guard.policy.json`. To approve a specific finding, add an entry using the `id` and `fingerprint` from the JSON report:

```json
{
  "failOn": "ERR",
  "exceptions": [
    {
      "id": "request-parameter-became-required",
      "fingerprint": "9fd4d4723aa2",
      "reason": "Coordinated migration approved by all client owners",
      "expires": "2027-01-01"
    }
  ]
}
```

Each exception must match both rule ID and exact fingerprint, include a meaningful reason, and have a valid non-expired date. An expired exception fails closed. **Never use broad rule-level allowlists to hide unknown breaks.**

## Evidence

`report.json` includes severity, rule IDs, endpoint, exact fingerprint, exception state, content hashes, workflow run metadata when available, and timestamp. `summary.md` contains the human-readable decision. Hashes let recipients recalculate and compare artifacts against committed inputs. **A hash is not a digital signature or independent compliance attestation.** To support stronger provenance, retain the original specs, policy, GitHub commit and CI run, with controlled artifact retention.

## Security and data processing

- Processing occurs on your own GitHub Actions runner or workstation. No OpenAPI spec upload is performed by this Action.
- Installation downloads the verified, pinned oasdiff archive from GitHub Releases; the downloaded archive is checked against a fixed SHA-256 value.
- External references are explicitly disabled (`--allow-external-refs=false`) to avoid remote SSRF and arbitrary file reads when parsing untrusted specs.
- Input size is limited to 5 MiB per file; engine execution has a timeout. Repositories should avoid running untrusted executable scripts with elevated GitHub tokens.
- `upload-evidence` defaults to `false`. Enabling it stores extracted API change information in the repository's GitHub Actions artifacts.
- Minimal permissions: `contents: read`. No provider account, credentials or outbound API are needed beyond fetching the pinned engine.
- Linux x86_64 hosted runners are supported by the composite Action. The CLI itself can run on other operating systems with a suitable oasdiff binary.

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities and trust boundaries.

## Optional professional setup — $149 one-time

For teams that prefer not to configure CI themselves, ForgeFrame Labs offers an asynchronous setup for **one GitHub repository with an existing OpenAPI 3.x specification**. The service includes the CI gate, baseline, time-limited exception policy, verification of safe and breaking changes, and a short evidence handover. There is no paid hosted dashboard or recurring software subscription.

**Request confirmation of scope and delivery schedule before paying.** Start at the [Contract Guard intake page](https://reflectme-source.github.io/forgeframe-labs-site/products/contract-guard-intake.html) to prepare an email request. Do not send secrets or private specifications. After written scope acceptance, we issue a unique Stripe-hosted payment link for that order; the previously shared public checkout has been retired. See [service terms and cancellation policy](https://reflectme-source.github.io/forgeframe-labs-site/terms.html).

The Action is open-source and free to self-host. Payment is solely for the optional fixed-scope implementation service.

## Limitations

Only OpenAPI specification changes are analyzed. The engine does not detect drift between spec and deployed service. OpenAPI 3.x is supported to the extent described in [oasdiff documentation](https://github.com/oasdiff/oasdiff). Split/multi-file specifications with external references require a separately reviewed trusted build procedure; remote $ref loading is intentionally off. Changes with incorrect or outdated specifications can be missed. The tool does not replace integration, contract consumer or security tests.

## Development

```sh
npm test
node cli.mjs --help
```

Tests cover breaking/non-breaking cases, exceptions, expiry, missing inputs, invalid spec, policy threshold and engine failure. Product updates should pass CI before a tagged release.

## Attribution and license

This wrapper is MIT licensed (see LICENSE). The oasdiff engine is a separate project copyright its authors, licensed Apache-2.0. It is downloaded at runtime rather than committed to this repository. See [oasdiff LICENSE](https://github.com/oasdiff/oasdiff/blob/main/LICENSE).

ForgeFrame Labs â€˘ forgeframe.lab@gmail.com
