import * as jose from "jose";

let jwksCache: jose.JSONWebKeySet | null = null;
let jwksAt = 0;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function verifyJwt(authHeader?: string) {
  const issuer = requireEnv("COGNITO_ISSUER");
  const audience = requireEnv("COGNITO_AUDIENCE");

  if (!authHeader?.startsWith("Bearer ")) throw new Error("missing_token");
  const token = authHeader.slice("Bearer ".length);

  if (!jwksCache || Date.now() - jwksAt > 10 * 60 * 1000) {
    const response = await fetch(`${issuer}/.well-known/jwks.json`);
    jwksCache = await response.json() as jose.JSONWebKeySet;
    jwksAt = Date.now();
  }
  const JWKS = jose.createLocalJWKSet(jwksCache);
  const { payload } = await jose.jwtVerify(token, JWKS, { issuer, audience });

  return payload; // sub, email, custom claims...
}
