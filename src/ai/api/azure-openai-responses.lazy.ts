import type { ProviderStreams } from "../types.ts";
import { unavailableApi } from "./lazy.ts";

export const azureOpenAIResponsesApi = (): ProviderStreams => unavailableApi("azure-openai-responses");
