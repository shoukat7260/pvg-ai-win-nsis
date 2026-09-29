import { nativeApi } from "./tauri";

export const vaultService = {
  has: (keyId: string) => nativeApi.vaultHasCredential(keyId),
  listMetadata: () => nativeApi.vaultListMetadata(),
  saveProviderCredential: (provider: string, secret: string, label?: string) =>
    nativeApi.saveProviderCredential(provider, secret, label),
  deleteProviderCredential: (provider: string) =>
    nativeApi.deleteProviderCredential(provider),
  hasProviderCredential: (provider: string) =>
    nativeApi.hasProviderCredential(provider),
  listProviderMetadata: () => nativeApi.listProviderMetadata(),
  storeSessionRefresh: (refreshToken: string) =>
    nativeApi.storeSessionRefresh(refreshToken),
  clearSessionRefresh: () => nativeApi.clearSessionRefresh(),
  hasSessionRefresh: () => nativeApi.vaultHasCredential("session.refresh"),
  status: () => nativeApi.vaultStatus(),
};
