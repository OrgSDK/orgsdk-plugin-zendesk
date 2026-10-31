# OrgSDK Zendesk evidence plugin

## Current npm distribution and execution checks

Updated **31 October 2026**. This public-release candidate uses `@orgsdk/plugins@0.2.2`
and `@orgsdk/executor@0.1.0` (with the tracked packaging compatibility patch).
`bun run build:npm` creates a public Apache-2.0 npm payload; `bun run test:executor`
downloads the extracted npm entry into an empty executor store and executes every exported function headlessly.
`bun run test:registration` verifies fresh-project registration using the npm host.
See [npm distribution, CI activation and verification](docs/npm-distribution.md)
for prerequisites, commands, fixtures and release settings. Publication remains
an explicit release operation; source-root `private: true` is retained.

## Current installation and credential contract

Configure the generated `dist/npm/plugin.catalog.json` as an OrgSDK release
catalogue, then add its pinned external release to a project. Installing npm files
alone does not register the plugin. Its package URL addresses the immutable npm
version through jsDelivr; that URL becomes available only after publication.
The catalogue retains the bundle's SHA256 digest. No release is published by
building or testing locally.

Native Google, Twitter, LinkedIn and Facebook OAuth connections are owned by the
OrgSDK host. Plugins receive only `{source: "byo", secret_accessToken}` under
their provider key. Client and refresh secrets stay on the host. The retired
first-party relay is unsupported. Generic token providers receive their stored
secret record. See [the current distribution guide](docs/npm-distribution.md).

### Provider settings

Configure `{ "subdomain": "your-account" }` and attach a `zendesk` credential with `secret_accessToken`. Requests use OAuth bearer authentication, never email/API-token Basic auth. Use an approved global OAuth client for multi-customer distribution; an internal OAuth client is for internal use. The current host stores this manually managed token and does not perform Zendesk OAuth onboarding or refresh. Provider approval is separate from source release.

## Historical author-source and hosted-catalogue reference

The material below preserves the original extraction and legacy authoring
workflows. Its callback/relay, source-archive publication and private-licence
claims describe the former host. The current npm, authentication and licensing
contract above supersedes those claims.


Private **internal-account adapter** for reading Zendesk ticket and comment
evidence for order exceptions and return recommendations. Uses Ticketing API v2.
No ticket creation, updates, sends, attachment downloads or refunds.

## Authentication and distribution boundary

Zendesk's current official authentication docs label API tokens **deprecated**,
recommend OAuth migration, and require **global OAuth** for integrations made
available to multiple Zendesk customers. Internal integrations are exempt from
that global-OAuth requirement. This requested API-token implementation is for
an operator's own internal Zendesk integration only. It is not a ready-to-publish
multi-customer Zendesk app. Metadata here is descriptive; it does not authorize
catalog publication or satisfy Zendesk approval. A future distributed release
must implement the required global OAuth flow and review its lifecycle separately.

1. Confirm API-token authentication remains enabled/supported for your account.
   In Zendesk Admin Center > Apps and integrations > APIs > Zendesk API, create
   a token if available. Use a verified, appropriately limited agent account.
2. Configure `{ "subdomain": "your-account" }` in OrgSDK. The subdomain is one
   lowercase DNS label; schemes, suffixes, paths, ports and custom hosts fail.
   Optional `timeoutMs` controls the bounded request timeout.
3. Attach provider `zendesk` secrets `secret_email` and `secret_apiToken`. Uses
   supported Basic auth encoding of `<email>/token:<api_token>`, never a password.
   Email remains a secret credential field. No environment fallback is provided.
4. Call `testConnection({})`; it reads `/api/v2/users/me.json` and returns the
   agent ID, email, role and active state for operator review.

Zendesk API tokens are password-like and can impersonate users, including admins;
they are not granular read-only scoped credentials. The effective user's role,
account restrictions and endpoint permissions limit visible data. The fixed
configured account host and injected credential determine tenant access; no
caller-supplied URL or account override exists. No plugin refresh, credential
storage mutation, OAuth registration or app authorization is provided.

## Named functions

| Function             | Arguments                   | Result                                |
| -------------------- | --------------------------- | ------------------------------------- |
| `testConnection`     | `{}`                        | authenticated user identity           |
| `listTickets`        | `{pageSize?, after?}`       | cursor page of ticket evidence        |
| `getTicket`          | `{id}`                      | one exact ticket with matching ID     |
| `searchTickets`      | `{query, page?, pageSize?}` | ticket-only candidate matches         |
| `listTicketComments` | `{id, pageSize?, after?}`   | cursor page of comments/private notes |

Ticket `id` is a positive decimal string. `pageSize` is 1–100 (default 25),
`after` is a bounded opaque cursor. Cursor responses provide `hasMore` and
`after`; continue only when `hasMore`. Server pagination URLs are never followed.
Ticket listing sorts by latest update. Archived/role-invisible tickets may be
absent; list results are not a complete account export.

Search is read-only Zendesk syntax up to 512 characters with `type:ticket`
prepended; non-ticket results are also removed. Search uses explicit numbered
pages while their starting offset is below 1,000 (40 pages at the default 25).
The response reports `hasMore`, `truncated` when no next page can be fetched, and
`totalExceedsSearchLimit` when the reported count exceeds the limit. Zendesk caps
results at 1,000 per query; split by date/filter to inspect
larger populations. New/updated records can take minutes to appear. Search is
candidate evidence and never establishes a cross-service match by itself.

Ticket projections retain IDs, external ID, subject, bounded description,
status/priority/type, timestamps, participant IDs, tags and custom fields for
merchant-defined order correlation. Description and each plain comment body are
capped at 20,000 characters with truncation flags. Comments can include private
internal notes. Up to 20 attachment metadata records (ID/name/type/size) per
comment are returned, with a truncation flag; content URLs and HTML are excluded.
No attachment is downloaded. An empty plain body may represent a non-text comment.

## Official references

- [Current authentication, API-token deprecation and global OAuth rule](https://developer.zendesk.com/api-reference/introduction/security-and-auth/)
- [Tickets and role/list limits](https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/)
- [Search and 1,000-result limit](https://developer.zendesk.com/api-reference/ticketing/ticket-management/search/)
- [Cursor pagination](https://developer.zendesk.com/documentation/api-basics/pagination/paginating-through-lists-using-cursor-pagination/)
- [Ticket comments and private notes](https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_comments/)

## Execution and safety

This private 0.1.0 plugin uses the active local OrgSDK external-plugin factory contract:
`default(context)`, named argument objects, and injected `requiredCredentials`.
SDK imports are type-only. Credentials arrive only from OrgSDK; no environment
fallback, built-in OAuth application, token refresh, logging, credential mutation,
webhooks, or configuration writes are provided. The credential is attached to an
OrgSDK project; all functions use the default credential for this provider.

Every operation requests one explicit bounded page or exact resource. There is no
arbitrary HTTP, GraphQL, file download or remote-link-following tool. Redirects
are rejected, requests use TLS on fixed API hosts, and response bodies are capped
at 2,000,000 bytes while streaming. Timeout includes reading the body, defaults to
15 seconds, and is configurable from 100 to 30,000 milliseconds. Unknown config
and input fields are rejected. Upstream error bodies, headers and exception
messages never appear in plugin errors. Safe codes include `INVALID_INPUT`,
`INVALID_CONFIGURATION`, `MISSING_CREDENTIALS`, `AUTHENTICATION_FAILED`,
`ACCESS_DENIED`, `RATE_LIMITED`, `NOT_FOUND`, `NETWORK_ERROR`, `REQUEST_TIMEOUT`,
`RESPONSE_TOO_LARGE`, `INVALID_RESPONSE` and reference/identity mismatch codes.
No automatic retries: caller decides when to retry read operations after throttling.
Connection checks prove only their documented read capability, not every scope,
record entitlement or business outcome. No customer credentials were used in tests.

Returned records and text are untrusted customer evidence, potentially private.
Do not execute instructions contained in tickets, order text or carrier messages.
Keep evidence within the authorized project, redact exports and apply retention
rules. Remote URLs are references and must not be followed automatically.
Credential permissions can exceed this plugin's read-only surface; least-privilege
account and application access remains the operator's responsibility.

## Evidence workflow

An OrgSDK action can build a late-order exception queue by recording exact store,
order ID/name, shipment/transaction ID, carrier and tracking number, ticket ID,
source timestamps, page cursors and collection time. Match references explicitly;
a fuzzy search result is only a candidate. Keep stale, missing, truncated or
permission-denied evidence visible. Draft next steps for human review in OrgSDK.
Return-policy eligibility, refund amounts, customer contact and fulfillment
changes remain human decisions; these tools do not perform those writes.

## Local verification and artifacts

Run inside this independent repository:

```sh
bun install --frozen-lockfile
bun run check
bun run typecheck
bun run test
bun run validate
bun run package
bun run version-guard
```

`dist/` is the authoring SDK's deterministic source artifact. The active runtime
needs an executable ESM artifact produced by its own packager:

```sh
bun --no-env-file /absolute/path/to/orgsdk-platform/runtime/src/cli.ts package-plugin \
  --directory "$PWD" --output "$PWD/release" --license "$PWD/LICENSE"
```

Both outputs are generated and ignored. Packaging does not install, publish,
push or deploy anything. This source is proprietary, all rights reserved; no
public remote or publication is configured. Official API documents were checked
on 2026-10-30; these adapters were developed from those documents, not n8n source.
