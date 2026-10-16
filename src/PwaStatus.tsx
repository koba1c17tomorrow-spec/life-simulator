import { useEffect, useRef, useState } from "react";

export function PwaStatus({ beforeUpdate }: { beforeUpdate: () => boolean }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [registrationFailed, setRegistrationFailed] = useState(false);
  const approvedReload = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    const watched = new Map<ServiceWorker, () => void>();
    let hadController = !!navigator.serviceWorker.controller;
    const controllerChanged = () => {
      if (approvedReload.current) window.location.reload();
      else if (hadController) setUpdateAvailable(true);
      else setOfflineReady(true);
      hadController = true;
    };
    const watchInstalling = () => {
      const worker = registration?.installing;
      if (!worker || watched.has(worker)) return;
      const changed = () => {
        if (!active || worker.state !== "installed") return;
        if (navigator.serviceWorker.controller) setUpdateAvailable(true);
        else setOfflineReady(true);
      };
      watched.set(worker, changed);
      worker.addEventListener("statechange", changed);
      changed();
    };
    const checkUpdate = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void registration?.update().catch(() => { /* Offline play remains usable. */ });
    };
    navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    document.addEventListener("visibilitychange", checkUpdate);
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    }).then(value => {
      if (!active) return;
      registration = value;
      if (value.waiting) setUpdateAvailable(true);
      else if (value.active) setOfflineReady(true);
      value.addEventListener("updatefound", watchInstalling);
      watchInstalling();
    }).catch(() => { if (active) setRegistrationFailed(true); });
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", controllerChanged);
      document.removeEventListener("visibilitychange", checkUpdate);
      registration?.removeEventListener("updatefound", watchInstalling);
      for (const [worker, callback] of watched) worker.removeEventListener("statechange", callback);
    };
  }, []);

  if (updateAvailable)
    return (
      <div className="notice pwa-status" role="status">
        新しいバージョンがあります。更新は好きなタイミングで行えます。
        <button onClick={async () => {
          if (!beforeUpdate()) return;
          try {
            const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
            approvedReload.current = true;
            // Only this explicit action may activate the waiting worker.
            // Other tabs stay open until their own user saves and updates.
            if (registration?.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
            else window.location.reload();
          } catch {
            approvedReload.current = false;
            setRegistrationFailed(true);
          }
        }}>保存して更新</button>
        {registrationFailed && <span>更新できませんでした。接続を確認してください。</span>}
      </div>
    );
  if (registrationFailed)
    return <p className="hint" role="status">オフライン準備ができませんでした。オンラインでは引き続き遊べます。</p>;
  if (offlineReady)
    return <p className="hint" role="status">オフラインでも遊べる準備ができました。</p>;
  return null;
}
