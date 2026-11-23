// Иконки проекта: одна толщина линии (1.75), 20×20, цвет — currentColor.
import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const ArrowLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12.5 4.5 7 10l5.5 5.5" />
  </svg>
);

export const Close = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m5.5 5.5 9 9m0-9-9 9" />
  </svg>
);

export const Eye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Z" />
    <circle cx="10" cy="10" r="2.25" />
  </svg>
);

export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </svg>
);
