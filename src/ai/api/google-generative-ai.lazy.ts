import type { ProviderStreams } from "../types.ts";
import { unavailableApi } from "./lazy.ts";

export const googleGenerativeAIApi = (): ProviderStreams => unavailableApi("google-generative-ai");
