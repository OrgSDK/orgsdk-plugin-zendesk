# OrgSDK Zendesk evidence plugin

Apache-2.0 read-only plugin for ticket and comment evidence using Ticketing API v2.
No ticket creation, updates, messages, attachment downloads or refunds.

## Install in OrgSDK

Enable the pinned Zendesk release from your project's Plugins page. The default
catalogue is https://orgsdk.ai/plugins/releases.json. The executor verifies the
bundle SHA256. Installing npm files alone does not register a project plugin.
See LICENSE, NOTICE and TRADEMARKS.md for licensing and attribution.

## Credentials and configuration

1. Obtain an OAuth access token through your own Zendesk OAuth application. Use
   an approved global OAuth client when serving multiple Zendesk customers;
   internal clients are for internal use. Publishing this package does not grant
   provider approval or implement a multi-customer consent service.
2. Store provider `zendesk` with `secret_accessToken` in OrgSDK and attach that
   credential to the plugin. Requests use `Authorization: Bearer`, never
   email/API-token authentication. On OrgSDK 0.1.0, obtain and renew tokens
   externally; native Zendesk onboarding and refresh are not implemented.
3. Configure `{ "subdomain": "your-account" }`. This must be one lowercase DNS
   label, without scheme, suffix, path or port. Optional `timeoutMs` bounds
   requests. Secrets belong in credentials, not configuration.
4. Call `zendesk.testConnection({})` to inspect the authenticated user. Role and
   endpoint permissions still determine which tickets and comments are visible.

The fixed account host and attached credential determine access. No arbitrary
URL, account override, token exchange, credential mutation or automatic retry
is exposed. Provider error bodies and credentials are omitted from errors.

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

Tests use synthetic provider fixtures. Live account permissions and app approval must be verified with the operator’s selected account.
