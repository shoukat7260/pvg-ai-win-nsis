export {
  ApiClientError,
  createRequestId,
  parseApiError,
} from "./errors.js";

export {
  PvgApiClient,
  createApiClient,
  type PvgApiClientOptions,
  type HealthResponse,
  type ReadyResponse,
  type RequestOptions,
} from "./client.js";

export {
  adaptAuthUser,
  adaptTokenPair,
  adaptLoginResult,
  adaptDesktopStart,
  adaptDesktopPoll,
  adaptBilling,
} from "./adapters.js";
