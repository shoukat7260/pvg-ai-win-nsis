import { nativeApi } from "./tauri";

export const diagnosticsService = {
  get: () => nativeApi.getDiagnostics(),
  emitProgressStub: (operationId: string) =>
    nativeApi.emitProgressStub(operationId),
};
