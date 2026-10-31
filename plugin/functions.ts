import { z } from "zod";
import { get } from "./client";
import {
	cursor,
	defaultFetch,
	type Fetcher,
	PluginError,
	pageSize,
	parse,
	pick,
	record,
} from "./http";
import { empty, idParameter, pageParameters, type Store, tools } from "./tools";

const id = z.string().regex(/^[1-9][0-9]{0,17}$/);
const page = z.strictObject({ pageSize, after: cursor });
const fields = [
	"id",
	"external_id",
	"subject",
	"description",
	"status",
	"priority",
	"type",
	"created_at",
	"updated_at",
	"requester_id",
	"assignee_id",
	"organization_id",
	"tags",
	"custom_fields",
];
function ticket(value: unknown) {
	const result = pick(value, fields);
	if (typeof result.description === "string") {
		result.descriptionTruncated = result.description.length > 20_000;
		result.description = result.description.slice(0, 20_000);
	}
	return result;
}
function cursorPage(
	data: Record<string, unknown>,
	key: string,
	limit: number,
	project: (value: unknown) => unknown,
) {
	const rows = parse(
		z.array(z.unknown()).max(limit),
		data[key],
		"INVALID_RESPONSE",
	);
	const meta = record(data.meta);
	return {
		[key]: rows.map(project),
		hasMore: meta.has_more === true,
		after: typeof meta.after_cursor === "string" ? meta.after_cursor : null,
	};
}
export function createFunctions(store: Store, fetcher: Fetcher = defaultFetch) {
	const tool = tools(store);
	const read = (
		config: Parameters<typeof get>[0],
		credentials: unknown,
		path: string,
		params: Record<string, string | number | undefined> = {},
	) => get(config, credentials, path, params, fetcher);
	return [
		tool(
			"testConnection",
			"Read the authenticated user's ID, role and account-local email.",
			empty,
			[],
			async (config, credentials) =>
				pick((await read(config, credentials, "/users/me.json")).user, [
					"id",
					"email",
					"role",
					"active",
				]),
		),
		tool(
			"listTickets",
			"Read one cursor page of visible account tickets, most recently updated first.",
			page,
			pageParameters,
			async (config, credentials, input) =>
				cursorPage(
					await read(config, credentials, "/tickets.json", {
						"page[size]": input.pageSize,
						"page[after]": input.after,
						sort: "-updated_at",
					}),
					"tickets",
					input.pageSize,
					ticket,
				),
		),
		tool(
			"getTicket",
			"Read one exact ticket with correlation fields and a bounded description.",
			z.strictObject({ id }),
			[idParameter],
			async (config, credentials, input) => {
				const data = record(
					(await read(config, credentials, `/tickets/${input.id}.json`)).ticket,
				);
				if (String(data.id) !== input.id)
					throw new PluginError("REFERENCE_MISMATCH");
				return ticket(data);
			},
		),
		tool(
			"searchTickets",
			"Read up to 1,000 ticket search matches across explicit pages. Search is eventually consistent; verify order references before correlating.",
			z
				.strictObject({
					query: z.string().min(1).max(512),
					page: z.number().int().min(1).max(1000).default(1),
					pageSize,
				})
				.refine((input) => (input.page - 1) * input.pageSize < 1000),
			[
				{ name: "query", type: "string" },
				{ name: "page", type: "number", optional: true },
				{ name: "pageSize", type: "number", optional: true },
			],
			async (config, credentials, input) => {
				const data = await read(config, credentials, "/search.json", {
					query: `type:ticket ${input.query}`,
					page: input.page,
					per_page: input.pageSize,
				});
				const results = parse(
					z.array(z.unknown()).max(input.pageSize),
					data.results,
					"INVALID_RESPONSE",
				);
				const offset = (input.page - 1) * input.pageSize;
				const visible = results.slice(0, 1000 - offset);
				const tickets = visible
					.filter((row) => record(row).result_type === "ticket")
					.map(ticket);
				const count = parse(
					z.number().int().nonnegative().nullable(),
					data.count ?? null,
					"INVALID_RESPONSE",
				);
				const hasMore =
					!!data.next_page ||
					(count !== null && count > offset + visible.length);
				const nextPage =
					data.next_page && input.page * input.pageSize < 1000
						? input.page + 1
						: null;
				return {
					tickets,
					count,
					nextPage,
					hasMore,
					truncated: hasMore && nextPage === null,
					totalExceedsSearchLimit: count !== null && count > 1000,
					searchLimit: 1000,
				};
			},
		),
		tool(
			"listTicketComments",
			"Read one cursor page of public comments and private notes for a ticket. Plain text bodies are capped; attachments are references only and never fetched.",
			page.extend({ id }),
			[idParameter, ...pageParameters],
			async (config, credentials, input) =>
				cursorPage(
					await read(
						config,
						credentials,
						`/tickets/${input.id}/comments.json`,
						{ "page[size]": input.pageSize, "page[after]": input.after },
					),
					"comments",
					input.pageSize,
					(value) => {
						const row = record(value);
						const body =
							typeof row.plain_body === "string" ? row.plain_body : "";
						const attachments = parse(
							z.array(z.unknown()),
							row.attachments ?? [],
							"INVALID_RESPONSE",
						);
						return {
							...pick(row, ["id", "author_id", "created_at", "public"]),
							body: body.slice(0, 20_000),
							bodyTruncated: body.length > 20_000,
							attachments: attachments
								.slice(0, 20)
								.map((item) =>
									pick(item, ["id", "file_name", "content_type", "size"]),
								),
							attachmentsTruncated: attachments.length > 20,
						};
					},
				),
		),
	];
}
