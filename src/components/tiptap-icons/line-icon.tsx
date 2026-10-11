import type { SVGProps } from "react";

// The factory behind Folio's own line icons (sidebar-icons, page-starter-icons):
// plain inline SVG on a 24×24 grid, round caps and joins, 16px / 1.8 stroke
// by default.

export interface LineIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

export function makeLineIcon(name: string, children: React.ReactNode) {
  function LineIcon({ size = 16, strokeWidth = 1.8, ...rest }: LineIconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        {...rest}
      >
        {children}
      </svg>
    );
  }
  LineIcon.displayName = name;
  return LineIcon;
}
