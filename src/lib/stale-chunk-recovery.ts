// Recovering from a deploy that removed the code this tab still needs.
//
// Every build gives each code chunk a new hashed name and the old files are
// gone from the server. A tab (or the service worker's cached copy of the
// app) that was loaded before the deploy still asks for the OLD names the
// first time it lazy-loads something — a database view, an icon. The server
// has no such file and the import fails ("Failed to fetch dynamically
// imported module", or a MIME error when HTML came back instead).
//
// The fix is to get onto the new version: if a new service worker is waiting
// (registerType "prompt" keeps it waiting), activate it and reload; otherwise
// just reload. Reloading while an old service worker is in control would
// serve the old app again, which is why the waiting one goes first. A guard
// keeps a persistent failure from reloading in a loop.

const RELOAD_KEY = "folio:stale-chunk-reload-at";
const RELOAD_GUARD_MS = 20_000;

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Expected a JavaScript.*module script/i;

function isChunkError(reason: unknown): boolean {
  const message =
    reason instanceof Error ? reason.message : String(reason ?? "");
  return CHUNK_ERROR.test(message);
}

function recentlyReloaded(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return true;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // No session storage: still recover, just without the loop guard.
  }
  return false;
}

function waitForWaiting(
  reg: ServiceWorkerRegistration,
  timeoutMs: number,
): Promise<ServiceWorker | null> {
  if (reg.waiting) return Promise.resolve(reg.waiting);
  return new Promise((resolve) => {
    const done = () => resolve(reg.waiting ?? null);
    const timer = window.setTimeout(done, timeoutMs);
    const watch = (worker: ServiceWorker | null) => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          window.clearTimeout(timer);
          done();
        }
      });
    };
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing), {
      once: true,
    });
  });
}

let recovering = false;

async function recover() {
  if (recovering || recentlyReloaded()) return;
  recovering = true;

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.update().catch(() => {});
      const waiting = await waitForWaiting(reg, 5000);
      if (waiting) {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => window.location.reload(),
          { once: true },
        );
        waiting.postMessage({ type: "SKIP_WAITING" });
        // In case the new worker never takes control.
        window.setTimeout(() => window.location.reload(), 4000);
        return;
      }
    }
  } catch {
    // Fall through to a plain reload.
  }
  window.location.reload();
}

export function installStaleChunkRecovery() {
  // Vite's own signal for a failed lazy import (its preload helper).
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    void recover();
  });
  // Lazy imports Vite doesn't wrap (e.g. inside dependencies).
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkError(event.reason)) void recover();
  });
  // React.lazy rethrows the failure while rendering.
  window.addEventListener("error", (event) => {
    if (isChunkError(event.error ?? event.message)) void recover();
  });
}
