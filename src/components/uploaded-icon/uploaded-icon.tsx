import type { CSSProperties } from "react";
import "./uploaded-icon.scss";

/**
 * An uploaded image used as an icon (a page's, a teamspace's, the
 * workspace's): always a circle, like a profile picture, with a faint ring
 * so a dark photo still has an edge on a dark background. The image is
 * cropped to cover the circle.
 */
export function UploadedIcon({
  src,
  size,
  className,
  style,
}: {
  src: string;
  /** Diameter in px. */
  size: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`uploaded-icon${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, ...style }}
    />
  );
}
