import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// ── Logging helper ───────────────────────────────────────────────────────

function warn(tag: string, key: string, err: unknown): void {
  console.warn(
    `[storage] ${tag} failed for "${key}", falling back to AsyncStorage:`,
    err instanceof Error ? err.message : String(err),
  );
}

// ── Secure storage (encrypted) ───────────────────────────────────────────

/** Try to load EncryptedStorage; returns null on Web or when unavailable. */
let _EncryptedStorage: any = null;
try {
  if (Platform.OS !== "web") {
    _EncryptedStorage = require("react-native-encrypted-storage").default;
  }
} catch {
  // Native module not available (e.g. Expo Go, Web)
}

/** Store a sensitive value using encrypted storage.
 *  Falls back to plain AsyncStorage when encryption is unavailable. */
export async function setSecure(key: string, value: string): Promise<void> {
  if (_EncryptedStorage) {
    try {
      await _EncryptedStorage.setItem(key, value);
      return;
    } catch (err) {
      warn("EncryptedStorage.setItem", key, err);
    }
  }
  await AsyncStorage.setItem(key, value);
}

/** Read a sensitive value from encrypted storage.
 *  Falls back to AsyncStorage for backward compatibility with
 *  values written before encryption was introduced. */
export async function getSecure(key: string): Promise<string | null> {
  if (_EncryptedStorage) {
    try {
      const val = await _EncryptedStorage.getItem(key);
      if (val !== null) return val;
      // Migration: check AsyncStorage for values written before encryption
      const legacy = await AsyncStorage.getItem(key);
      if (legacy !== null) {
        await _EncryptedStorage.setItem(key, legacy);
        await AsyncStorage.removeItem(key);
      }
      return legacy;
    } catch (err) {
      warn("EncryptedStorage.getItem", key, err);
    }
  }
  return AsyncStorage.getItem(key);
}

/** Remove a sensitive value. Tries both stores for safety. */
export async function removeSecure(key: string): Promise<void> {
  if (_EncryptedStorage) {
    try {
      await _EncryptedStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ── Plain storage (non-sensitive, direct AsyncStorage pass-through) ───────

export { AsyncStorage as plainStorage };
export const getPlain = AsyncStorage.getItem.bind(AsyncStorage);
export const setPlain = AsyncStorage.setItem.bind(AsyncStorage);
export const removePlain = AsyncStorage.removeItem.bind(AsyncStorage);
