/**
 * Type augmentation for firebase/auth React Native persistence.
 *
 * getReactNativePersistence exists in the RN bundle (@firebase/auth/dist/rn/index.js)
 * and is resolved correctly by Metro at runtime, but the TypeScript type definitions
 * shipped with the package only cover browser exports.
 *
 * See: https://github.com/firebase/firebase-js-sdk/issues/7615
 */
import type { Persistence } from 'firebase/auth';

interface ReactNativeAsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

declare module 'firebase/auth' {
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
