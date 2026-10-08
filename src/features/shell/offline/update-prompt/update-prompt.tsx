import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useToast } from "src/features/shell/toast";

// Registers the service worker (vite.config.ts → VitePWA) and offers the new
// version when a deploy is out. Renders nothing.
//
// The new version never takes over on its own (registerType: "prompt"):
// reloading while someone types would lose their place. The toast asks, and
// asks again every 30 minutes until they reload.
const CHECK_FOR_UPDATE_MS = 60 * 60 * 1000; // a long-open tab still hears about deploys
const REMIND_MS = 30 * 60 * 1000;

export function UpdatePrompt() {
  const { t } = useTranslation();
  const { show } = useToast();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update();
      }, CHECK_FOR_UPDATE_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const offer = () =>
      show(
        t("app.updateAvailable", "A new version of Folio is available."),
        "info",
        {
          label: t("app.updateReload", "Reload"),
          onClick: () => void updateServiceWorker(true),
        },
      );
    offer();
    const id = window.setInterval(offer, REMIND_MS);
    return () => window.clearInterval(id);
  }, [needRefresh, show, t, updateServiceWorker]);

  return null;
}
