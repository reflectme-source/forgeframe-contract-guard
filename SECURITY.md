# Security policy

## Supported versions

The latest tagged release is supported. Older versions should be updated, particularly if their pinned upstream engine version has received a security advisory.

## Report a vulnerability

Email **forgeframe.lab@gmail.com** with subject `Contract Guard security`. Please include a minimal non-sensitive reproduction and affected release. Avoid publishing exploit details before coordinated triage. No guaranteed response SLA is offered.

## Threat model

Contract specs and pull request content can be attacker-controlled. The Action runs with read-only contents permissions and no secrets. It disables external reference fetching, pins and checksums its comparison binary, parses findings from the local CLI, restricts policy exceptions and limits input/output sizes.

The engine binary is third-party software, not audited by ForgeFrame Labs. Build infrastructure still downloads an executable from GitHub Releases; if GitHub assets or checksum provenance are compromised, this is a supply chain dependency.

Do not run in a privileged `pull_request_target` workflow; do not add long-lived repository credentials. Keep the GitHub workflow and engine version reviewed and current.

Reports can expose API paths and schema field names. Artifacts and step summaries are visible according to your repository's Actions access controls; treat them accordingly.

This tool does not cryptographically sign results, audit cloud deployments, guarantee finding completeness or certify compliance.
