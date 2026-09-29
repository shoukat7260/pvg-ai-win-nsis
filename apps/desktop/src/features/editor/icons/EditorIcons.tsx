/** Coherent PVG editor icon set — single stroke style, 16×16 viewBox */

type IconProps = { className?: string; title?: string };

function Svg({
  children,
  className,
  title,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconMedia(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2" y="3" width="12" height="10" rx="1.5" {...stroke} />
      <path d="M6 6.5 10 8 6 9.5Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconProject(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2.5 5.5h11v7.5H2.5z" {...stroke} />
      <path d="M2.5 5.5 4.5 3h4l2 2.5" {...stroke} />
    </Svg>
  );
}

export function IconText(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 4h10M8 4v9M5.5 13h5" {...stroke} />
    </Svg>
  );
}

export function IconTransition(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M2 4h5v8H2z" {...stroke} />
      <path d="M9 4h5v8H9z" {...stroke} />
      <path d="M6.5 8h3" {...stroke} />
    </Svg>
  );
}

export function IconEffects(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 2.5 9.2 6h3.5L10 8.3l1.1 3.7L8 10.2 4.9 12l1.1-3.7L3.3 6H6.8Z" {...stroke} />
    </Svg>
  );
}

export function IconHistory(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 8a4.5 4.5 0 1 0 1.2-3" {...stroke} />
      <path d="M3.5 3.5v3h3" {...stroke} />
      <path d="M8 5.5V8l1.8 1.2" {...stroke} />
    </Svg>
  );
}

export function IconAi(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2" {...stroke} />
      <circle cx="8" cy="8" r="3" {...stroke} />
    </Svg>
  );
}

export function IconSelect(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 2.5 4.5 12l2.2-2.2L9.5 14l1.2-.6-2.8-4.2L12 8.5Z" {...stroke} />
    </Svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="7" width="8" height="6" rx="1" {...stroke} />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" {...stroke} />
    </Svg>
  );
}

export function IconEye(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4Z" {...stroke} />
      <circle cx="8" cy="8" r="1.6" {...stroke} />
    </Svg>
  );
}

export function IconMute(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 6.5h2.5L9 4v8L5.5 9.5H3z" {...stroke} />
      <path d="m11 6 3 4M14 6l-3 4" {...stroke} />
    </Svg>
  );
}

export function IconSolo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="4.5" {...stroke} />
      <path d="M8 5.5v5M6.5 8h3" {...stroke} />
    </Svg>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 3.5v9l8-4.5Z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPause(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 3.5h2.2v9H5zM8.8 3.5H11v9H8.8z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconUndo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 6.5h6a3 3 0 1 1 0 6H7" {...stroke} />
      <path d="M4 6.5 6.5 4M4 6.5 6.5 9" {...stroke} />
    </Svg>
  );
}

export function IconRedo(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 6.5H6a3 3 0 1 0 0 6h3" {...stroke} />
      <path d="M12 6.5 9.5 4M12 6.5 9.5 9" {...stroke} />
    </Svg>
  );
}

export function IconCommand(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 3.5H3.5v3H5a1.5 1.5 0 0 0 0-3ZM11 3.5h1.5v3H11a1.5 1.5 0 0 1 0-3ZM5 9.5H3.5v3H5a1.5 1.5 0 0 0 0-3ZM11 9.5h1.5v3H11a1.5 1.5 0 0 1 0-3Z" {...stroke} />
      <path d="M5 5h6v6H5z" {...stroke} />
    </Svg>
  );
}

export function IconSave(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 3h8l2 2v8H3z" {...stroke} />
      <path d="M5 3v3h5V3M5 13v-4h6v4" {...stroke} />
    </Svg>
  );
}

export function IconPanelLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2.5" y="3" width="11" height="10" rx="1" {...stroke} />
      <path d="M6 3v10" {...stroke} />
    </Svg>
  );
}
