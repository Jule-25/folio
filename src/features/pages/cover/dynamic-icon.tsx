import { memo } from "react";
import { DynamicIcon as LucideDynamicIcon } from "lucide-react/dynamic";
import { resolveIconName } from "./icon-name";
import "./dynamic-icon.scss";

// `lucide-react/dynamic` lazily imports a single icon by its kebab-case name,
// so the page-header icon stays a one-icon fetch. Names are validated and
// mapped in ./icon-name.
function DynamicIconImpl({
  name,
  size = 16,
  className,
  style,
}: {
  name?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  weight?: number;
  filled?: boolean;
}) {
  return (
    <LucideDynamicIcon
      name={resolveIconName(name) as never}
      size={size}
      className={["dynamic-icon", className].filter(Boolean).join(" ")}
      style={style}
    />
  );
}

export const DynamicIcon = memo(DynamicIconImpl);
