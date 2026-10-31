import { expect, test } from "bun:test";
import { configSchema } from "../plugin/config";
import { createFunctions } from "../plugin/functions";
import type { Fetcher } from "../plugin/http";
import type { Store } from "../plugin/tools";

const credentials = {
	zendesk: {
		secret_accessToken: "test-token",
	},
};
const store = {
	get: async () => ({ value: { subdomain: "sample" } }),
} as unknown as Store;
function handler(name: string, fetcher: Fetcher) {
	const fn = createFunctions(store, fetcher).find(
		(entry) => entry.name === name,
	);
	if (!fn) throw new Error("missing tool");
	return fn.handler;
}
test("strict account boundary", () => {
	for (const subdomain of [
		"https://evil.test",
		"sample.zendesk.com",
		"sample:443",
		"sample/../",
		"sample@evil.test",
	])
		expect(configSchema.safeParse({ subdomain }).success).toBe(false);
	expect(
		configSchema.safeParse({ subdomain: "sample", token: "PRIVATE" }).success,
	).toBe(false);
});
test("all tools require named credentials and are readonly", () => {
	for (const fn of createFunctions(store)) {
		expect(fn.calling).toBe("named");
		expect(fn.requiredCredentials).toEqual(["zendesk"]);
		expect(fn.metadata?.readonly).toBe(true);
	}
});
test("cursor paging uses fixed account and OAuth bearer authentication", async () => {
	const result = await handler("listTickets", async (url, init) => {
		const endpoint = new URL(url);
		expect(endpoint.origin).toBe("https://sample.zendesk.com");
		expect(endpoint.pathname).toBe("/api/v2/tickets.json");
		expect(endpoint.searchParams.get("page[after]")).toBe("cursor");
		expect(endpoint.searchParams.get("page[size]")).toBe("7");
		expect(init.method).toBe("GET");
		expect(new Headers(init.headers).get("Authorization")).toBe(
			"Bearer test-token",
		);
		return Response.json({
			tickets: [{ id: 123, external_id: "order-12", unknown: "PRIVATE" }],
			meta: { has_more: true, after_cursor: "next" },
			links: { next: "https://evil.test" },
		});
	})(credentials, { pageSize: 7, after: "cursor" });
	expect(result.after).toBe("next");
	expect(result.tickets[0].external_id).toBe("order-12");
	expect(result.tickets[0].unknown).toBeUndefined();
});
test("search adds ticket constraint and filters unrelated object types", async () => {
	const result = await handler("searchTickets", async (url) => {
		expect(new URL(url).searchParams.get("query")).toBe("type:ticket order-12");
		return Response.json({
			results: [
				{ result_type: "user", id: 3 },
				{ result_type: "ticket", id: 4 },
			],
			count: 2,
			next_page: "https://evil.test",
		});
	})(credentials, { query: "order-12" });
	expect(result.tickets).toHaveLength(1);
	expect(result.tickets[0].id).toBe(4);
	expect(result.nextPage).toBe(2);
});
test("comments cap text and attachments and never fetch attachment URLs", async () => {
	let calls = 0;
	const result = await handler("listTicketComments", async () => {
		calls++;
		return Response.json({
			comments: [
				{
					id: 1,
					public: false,
					plain_body: "x".repeat(20001),
					html_body: "PRIVATE",
					attachments: [
						{
							id: 2,
							content_url: "https://evil.test",
							file_name: "receipt.png",
						},
					],
				},
			],
			meta: { has_more: false },
		});
	})(credentials, { id: "123" });
	expect(calls).toBe(1);
	expect(result.comments[0].bodyTruncated).toBe(true);
	expect(result.comments[0].body).toHaveLength(20000);
	expect(result.comments[0].html_body).toBeUndefined();
	expect(result.comments[0].attachments[0].content_url).toBeUndefined();
});
test("rejects input, missing secrets and mismatched ticket IDs", async () => {
	const noFetch: Fetcher = async () => {
		throw new Error("unexpected network");
	};
	await expect(
		handler("getTicket", noFetch)(credentials, { id: "../users" }),
	).rejects.toThrow("INVALID_INPUT");
	await expect(
		handler("searchTickets", noFetch)(credentials, { query: "x", page: 41 }),
	).rejects.toThrow("INVALID_INPUT");
	await expect(handler("testConnection", noFetch)({}, {})).rejects.toThrow(
		"MISSING_CREDENTIALS",
	);
	await expect(
		handler("getTicket", async () => Response.json({ ticket: { id: 2 } }))(
			credentials,
			{ id: "1" },
		),
	).rejects.toThrow("REFERENCE_MISMATCH");
});

test("search reaches default-size pages beyond ten and exposes the actual 1000-result cap", async () => {
	const fetcher: Fetcher = async () =>
		Response.json({
			results: [{ id: 1, result_type: "ticket" }],
			count: 1200,
			next_page: "https://sample.zendesk.com/api/v2/search.json?page=11",
		});
	const middle = await handler("searchTickets", fetcher)(credentials, {
		query: "order",
		page: 10,
	});
	expect(middle.nextPage).toBe(11);
	expect(middle.hasMore).toBe(true);
	expect(middle.truncated).toBe(false);
	const last = await handler("searchTickets", fetcher)(credentials, {
		query: "order",
		page: 40,
	});
	expect(last.nextPage).toBeNull();
	expect(last.hasMore).toBe(true);
	expect(last.truncated).toBe(true);
	expect(last.totalExceedsSearchLimit).toBe(true);
	await expect(
		handler("searchTickets", fetcher)(credentials, {
			query: "order",
			page: 11,
			pageSize: 100,
		}),
	).rejects.toThrow("INVALID_INPUT");
});
