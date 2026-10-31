import assert from "node:assert/strict";

const ticket = {
	id: 81,
	subject: "Synthetic ticket",
	description: "Example",
	external_id: "ORDER-81",
};
export default async function createFixture() {
	return {
		configuration: { subdomain: "sample" },
		provider: "zendesk",
		secret: {
			secret_accessToken: "synthetic-zendesk",
		},
		async fetch(request) {
			const url = new URL(request.url);
			assert.equal(url.origin, "https://sample.zendesk.com");
			assert.equal(request.method, "GET");
			assert.equal(
				request.headers.get("authorization"),
				"Bearer synthetic-zendesk",
			);
			const responses = {
				"/api/v2/users/me.json": {
					user: {
						id: 1,
						email: "operator@example.invalid",
						role: "agent",
						active: true,
					},
				},
				"/api/v2/tickets.json": {
					tickets: [ticket],
					meta: { has_more: false },
				},
				"/api/v2/tickets/81.json": { ticket },
				"/api/v2/search.json": {
					results: [{ ...ticket, result_type: "ticket" }],
					count: 1,
					next_page: null,
				},
				"/api/v2/tickets/81/comments.json": {
					comments: [{ id: 2, body: "Example" }],
					meta: { has_more: false },
				},
			};
			assert(Object.hasOwn(responses, url.pathname), url.pathname);
			return Response.json(responses[url.pathname]);
		},
		async run(call) {
			assert.equal((await call("testConnection")).id, 1);
			assert.equal((await call("listTickets")).tickets[0].id, 81);
			assert.equal(
				(await call("getTicket", { id: "81" })).external_id,
				"ORDER-81",
			);
			assert.equal(
				(await call("searchTickets", { query: "ORDER-81" })).tickets[0].id,
				81,
			);
			assert.equal(
				(await call("listTicketComments", { id: "81" })).comments[0].id,
				2,
			);
		},
	};
}
