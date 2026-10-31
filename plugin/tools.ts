import type { PluginContext, SafeFunction } from "@orgsdk/plugins";
import { z } from "zod";
import { type Config, configSchema } from "./config";
import { parse } from "./http";
export type Store = PluginContext["stores"]["config"];
export function tools(store: Store) {
	return function tool<T>(
		name: string,
		description: string,
		schema: z.ZodType<T>,
		parameters: NonNullable<SafeFunction["parameters"]>,
		run: (config: Config, credentials: unknown, input: T) => Promise<unknown>,
	): SafeFunction & { calling: "named" } {
		return {
			name,
			description,
			calling: "named",
			parameters,
			returnType: "Promise<Record<string, unknown>>",
			requiredCredentials: ["zendesk"],
			metadata: {
				readonly: true,
				category: "zendesk",
				tags: ["readonly", "ecommerce"],
			},
			handler: async (credentials: unknown, input: unknown = {}) => {
				const parsed = parse(schema, input);
				const row = await store.get("plugin:zendesk");
				const config = parse(
					configSchema,
					row?.value ?? {},
					"INVALID_CONFIGURATION",
				);
				return run(config, credentials, parsed);
			},
		};
	};
}
export const empty = z.strictObject({});
export const idParameter = {
	name: "id",
	type: "string",
	description: "Exact resource ID from this account.",
};
export const pageParameters = [
	{ name: "pageSize", type: "number", optional: true },
	{ name: "after", type: "string", optional: true },
];
