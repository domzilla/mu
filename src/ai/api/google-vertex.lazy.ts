import type { ProviderStreams } from "../types.ts";
import { unavailableApi } from "./lazy.ts";

export const googleVertexApi = (): ProviderStreams => unavailableApi("google-vertex");
