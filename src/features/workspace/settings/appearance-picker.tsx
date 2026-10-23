import { useTranslation } from "react-i18next";
import {
  APPEARANCES,
  useAppearance,
} from "src/features/shell/appearance/appearance";
import { WallpaperSettings } from "./wallpaper-settings";
import "./appearance-picker.scss";

// My settings › Appearance: a card per theme with a tiny preview; picking
// one restyles the whole app straight away (useApplyTheme follows it).
// Wallpaper adds its own options (picture, blur, dim, glass) under the cards.
export function AppearancePicker() {
  const { t } = useTranslation();
  const [appearance, setAppearance] = useAppearance();

  return (
    <div className="appearance-setting">
      <div className="ws-setting-row__text">
        <span className="ws-setting-row__label">
          {t("settings.mySettings.appearance", "Appearance")}
        </span>
        <span className="ws-setting-row__desc">
          {t(
            "settings.mySettings.appearanceDesc",
            "Restyle the whole app. Only you see it, on this device.",
          )}
        </span>
      </div>

      <div
        className="appearance-grid"
        role="group"
        aria-label={t("settings.mySettings.appearance", "Appearance")}
      >
        {APPEARANCES.map((id) => (
          <button
            key={id}
            type="button"
            className="appearance-option"
            aria-pressed={appearance === id}
            onClick={() => setAppearance(id)}
          >
            <span
              className={`appearance-swatch appearance-swatch--${id}`}
              aria-hidden="true"
            >
              <span />
              <span className="is-on" />
              <span />
            </span>
            <span className="appearance-option__name">
              {t(`settings.appearanceNames.${id}`)}
            </span>
          </button>
        ))}
      </div>

      {appearance === "wallpaper" && <WallpaperSettings />}
    </div>
  );
}
