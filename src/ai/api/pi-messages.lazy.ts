import type { ProviderStreams } from "../types.ts";
import { unavailableApi } from "./lazy.ts";

export const piMessagesApi = (): ProviderStreams => unavailableApi("pi-messages");
