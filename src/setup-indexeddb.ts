import setGlobalVars from "indexeddbshim";

/**
 * Initializes IndexedDB globals in Node.js using IndexedDBShim.
 * Must be called once before any library tries to use indexedDB.
 */
export function setupIndexedDatabase(): void {
  // Cast needed because shim typings are browser-centric
  setGlobalVars(globalThis as unknown as any, {
    checkOrigin: false,     // Node has no origin concept
    // memoryDatabase: "",   // Use memory DB (change if you want persistence)
    
    databaseBasePath: "./db_name_cc1", // enable if using sqlite persistence
  });
}
