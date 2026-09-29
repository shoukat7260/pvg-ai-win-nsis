/** PKCE helpers for desktop browser auth (S256). */

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (let i = 0; i < view.length; i += 1) {
    str += String.fromCharCode(view[i]!);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createPkcePair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const codeVerifier = base64Url(random);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  const codeChallenge = base64Url(digest);
  return { codeVerifier, codeChallenge };
}
