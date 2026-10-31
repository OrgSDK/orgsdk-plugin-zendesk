# Current execution contract

Configure `{ "subdomain": "your-account" }` and attach a `zendesk` credential with `secret_accessToken`. Requests use OAuth bearer authentication, never email/API-token Basic auth. Use an approved global OAuth client for multi-customer distribution; an internal OAuth client is for internal use. The current host stores this manually managed token and does not perform Zendesk OAuth onboarding or refresh. Provider approval is separate from source release.

Native OAuth providers receive only `{source: "byo", secret_accessToken}`. The host owns refresh. The first-party relay is retired.

## Historical source reference

The following describes the former author-source host; current npm and native credential behaviour above takes precedence.

# OrgSDK Zendesk evidence plugin

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

Private read-only integration. See the repository README for verification and artifact instructions.
