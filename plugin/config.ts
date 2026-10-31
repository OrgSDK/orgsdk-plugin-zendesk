import { z } from "zod";
import { timeout } from "./http";
export const configSchema = z.strictObject({
	subdomain: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
	timeoutMs: timeout,
});
export type Config = z.infer<typeof configSchema>;
