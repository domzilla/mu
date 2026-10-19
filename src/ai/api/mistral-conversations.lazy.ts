import type { ProviderStreams } from "../types.ts";
import { unavailableApi } from "./lazy.ts";

export const mistralConversationsApi = (): ProviderStreams => unavailableApi("mistral-conversations");
