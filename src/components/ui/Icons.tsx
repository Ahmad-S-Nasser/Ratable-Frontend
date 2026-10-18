import type { SVGProps } from "react";

/** Line icons, 1.75 px stroke, inheriting the text colour. Decorative: always aria-hidden. */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const SunIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);
export const MoonIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
  </Icon>
);
export const DeviceIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icon>
);
export const ShieldCheckIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
export const EyeOffIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a14 14 0 0 1-3 3.8M6.5 7.6A14 14 0 0 0 2.5 12c1 2 4.5 6 9.5 6a9.6 9.6 0 0 0 3.5-.7M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
);
export const ScaleIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 3v18M6 21h12M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7ZM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7Z" />
  </Icon>
);

export const PlayIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 5v14l11-7L8 5Z" />
  </Icon>
);
export const PauseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 5v14M16 5v14" />
  </Icon>
);
export const VolumeIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 10v4h4l5 4V6l-5 4H4ZM16.5 8.5a5 5 0 0 1 0 7" />
  </Icon>
);
export const VolumeOffIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 10v4h4l5 4V6l-5 4H4ZM17 9l4 6M21 9l-4 6" />
  </Icon>
);
export const PhotoIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m21 16-5-5-8 8" />
  </Icon>
);
