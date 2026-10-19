import type { ProviderStreams } from "../types.ts";
import { unavailableApi } from "./lazy.ts";

export const openAICompletionsApi = (): ProviderStreams => unavailableApi("openai-completions");
