import "@tanstack/react-start/server-only";

import { getBookingSecretEnvironment, RuntimeEnvironmentError } from "@/server/env.server";

const textEncoder = new TextEncoder();
const bookingCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

type ImportedKeyRing = Readonly<{
  activeVersion: number;
  keys: ReadonlyMap<number, CryptoKey>;
}>;

let keyRingCache:
  | Readonly<{
      activeVersion: number;
      serializedKeys: string;
      value: Promise<ImportedKeyRing>;
    }>
  | undefined;

export type AppointmentCredentials = Readonly<{
  keyVersion: number;
  managementToken: string;
  managementTokenHash: string;
  managementTokenVersion: number;
  receiptToken: string;
  receiptTokenHash: string;
}>;

export async function deriveAppointmentCredentials(input: {
  appointmentId: string;
  keyVersion?: number;
  managementTokenVersion?: number;
}): Promise<AppointmentCredentials> {
  const managementTokenVersion = input.managementTokenVersion ?? 1;
  const keyRing = await getImportedKeyRing();
  const keyVersion = input.keyVersion ?? keyRing.activeVersion;
  const key = keyRing.keys.get(keyVersion);

  if (!key || managementTokenVersion < 1) {
    throw new RuntimeEnvironmentError(["BOOKING_TOKEN_HMAC_KEYS"]);
  }

  const receiptToken = await signBase64Url(key, `receipt:v1|${input.appointmentId}`);
  const managementToken = await signBase64Url(
    key,
    `manage:v1|${input.appointmentId}|${managementTokenVersion}`,
  );

  return {
    keyVersion,
    managementToken,
    managementTokenHash: await sha256Hex(managementToken),
    managementTokenVersion,
    receiptToken,
    receiptTokenHash: await sha256Hex(receiptToken),
  };
}

export async function derivePrivateHmacHex(namespace: string, value: string): Promise<string> {
  const environment = getBookingSecretEnvironment();
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(environment.RATE_LIMIT_HMAC_SECRET),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );

  return signHex(key, `${namespace}|${value}`);
}

export function generateBookingCode(length = 10): string {
  if (!Number.isInteger(length) || length < 8 || length > 16) {
    throw new RangeError("Booking code length must be between 8 and 16");
  }

  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => bookingCodeAlphabet[byte & 31]).join("");
}

export function generateOpaqueRandomValue(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 128) {
    throw new RangeError("Random value byte length must be between 16 and 128");
  }

  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function getImportedKeyRing(): Promise<ImportedKeyRing> {
  const environment = getBookingSecretEnvironment();
  if (
    keyRingCache?.serializedKeys === environment.BOOKING_TOKEN_HMAC_KEYS &&
    keyRingCache.activeVersion === environment.BOOKING_TOKEN_ACTIVE_KEY_VERSION
  ) {
    return keyRingCache.value;
  }

  const value = importKeyRing(
    environment.BOOKING_TOKEN_HMAC_KEYS,
    environment.BOOKING_TOKEN_ACTIVE_KEY_VERSION,
  );
  keyRingCache = {
    activeVersion: environment.BOOKING_TOKEN_ACTIVE_KEY_VERSION,
    serializedKeys: environment.BOOKING_TOKEN_HMAC_KEYS,
    value,
  };
  return value;
}

async function importKeyRing(
  serializedKeys: string,
  activeVersion: number,
): Promise<ImportedKeyRing> {
  const parsed = parseKeyRing(serializedKeys);
  const entries = await Promise.all(
    Object.entries(parsed).map(async ([rawVersion, encodedKey]) => {
      const version = Number(rawVersion);
      const bytes = decodeBase64(encodedKey);
      if (!Number.isInteger(version) || version < 1 || bytes.byteLength < 32) {
        throw new RuntimeEnvironmentError(["BOOKING_TOKEN_HMAC_KEYS"]);
      }

      const key = await crypto.subtle.importKey(
        "raw",
        toArrayBuffer(bytes),
        { hash: "SHA-256", name: "HMAC" },
        false,
        ["sign"],
      );
      return [version, key] as const;
    }),
  );

  const keys = new Map(entries);
  if (!keys.has(activeVersion)) {
    throw new RuntimeEnvironmentError([
      "BOOKING_TOKEN_ACTIVE_KEY_VERSION",
      "BOOKING_TOKEN_HMAC_KEYS",
    ]);
  }

  return { activeVersion, keys };
}

function parseKeyRing(serializedKeys: string): Record<string, string> {
  try {
    const value: unknown = JSON.parse(serializedKeys);
    if (!value || Array.isArray(value) || typeof value !== "object") {
      throw new TypeError("Expected an object");
    }

    const entries = Object.entries(value);
    if (
      entries.length === 0 ||
      entries.some(
        ([version, key]) =>
          !/^[1-9][0-9]*$/.test(version) || typeof key !== "string" || !key.trim(),
      )
    ) {
      throw new TypeError("Invalid key ring entry");
    }

    return Object.fromEntries(entries) as Record<string, string>;
  } catch {
    throw new RuntimeEnvironmentError(["BOOKING_TOKEN_HMAC_KEYS"]);
  }
}

function decodeBase64(value: string): Uint8Array {
  try {
    const normalized = value.trim().replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
      throw new TypeError("Invalid base64");
    }

    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new RuntimeEnvironmentError(["BOOKING_TOKEN_HMAC_KEYS"]);
  }
}

async function signBase64Url(key: CryptoKey, value: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function signHex(key: CryptoKey, value: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
