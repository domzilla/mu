import type { ProviderStreams } from "../types.ts";
import { unavailableApi } from "./lazy.ts";

export const bedrockConverseStreamApi = (): ProviderStreams => unavailableApi("bedrock-converse-stream");
