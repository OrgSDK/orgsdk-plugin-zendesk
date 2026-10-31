import { z } from "zod";
import type { Config } from "./config";
import { defaultFetch, type Fetcher, parse, requestJson, token } from "./http";
export async function get(
	config: Config,
	credentials: unknown,
	path: string,
	parameters: Record<string, string | number | undefined> = {},
	fetcher: Fetcher = defaultFetch,
) {
	const bundle = parse(
		z.object({
			zendesk: z.object({
				secret_accessToken: token,
			}),
		}),
		credentials,
		"MISSING_CREDENTIALS",
	);
	const url = new URL(`https://${config.subdomain}.zendesk.com/api/v2${path}`);
	for (const [key, value] of Object.entries(parameters))
		if (value !== undefined) url.searchParams.set(key, String(value));

	return requestJson(
		url.toString(),
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${bundle.zendesk.secret_accessToken}`,
				Accept: "application/json",
			},
		},
		config.timeoutMs,
		fetcher,
	);
}
