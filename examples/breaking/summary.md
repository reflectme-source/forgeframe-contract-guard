## ForgeFrame Contract Guard â€” BLOCKED

| Metric | Value |
|---|---|
| Blocking findings | 2 |
| All findings | 2 |
| Exceptions | 0 |
| Policy threshold | ERR |
| Baseline SHA-256 | `a4fc8ab29241dde2â€¦` |
| Revision SHA-256 | `b5bf64548df63e29â€¦` |
| Policy SHA-256 | `44136fa355b3678aâ€¦` |

| Severity | Check | Endpoint | Detail | Exception |
|---|---|---|---|---|
| ERR | `request-parameter-became-required` | GET /payments | the `query` request parameter `page` became required | â€” |
| ERR | `response-property-enum-value-added` | GET /payments | added the new `chargeback` enum value to the `items/items/status` response property for the response status `200` | â€” |

_Evidence is scoped to specification-level checks. It does not prove runtime compatibility or regulatory compliance._
