import { registerOAuthFlows } from "./oauth-flows.ts";

/**
 * Register OAuth flows statically embedded in the standalone Bun binary.
 *
 * @deprecated Use `registerOAuthFlows()` from `mu/ai/oauth-flows`, which works for any bundler.
 */
export function registerBunOAuthFlows(): void {
	registerOAuthFlows();
}
