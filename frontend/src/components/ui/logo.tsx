import { cn } from "../../lib/utils";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  variant?: "default" | "loading" | "error";
  interactive?: boolean;
}

export function Logo({ className, variant = "default", interactive = false, ...props }: LogoProps) {
  // We use CSS data attributes to drive the animations for different states
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 180.93 248.46"
      className={cn(
        "transition-transform duration-300",
        // The logo container itself can have states
        variant === "error" ? "grayscale opacity-80 rotate-2" : "",
        interactive ? "logo-interactive" : "",
        className
      )}
      data-variant={variant}
      {...props}
    >
      <defs>
        <style>
          {`
            .cls-1 { fill: #f0f2e7; }
            .cls-2 { fill: #8bab89; }
            
            /* Layer Base Settings */
            .logo-layer {
              transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
              transform-origin: center;
            }

            /* Loading Animation: Gentle floating wave */
            @keyframes floatLayer {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-8px); }
            }
            
            svg[data-variant="loading"] #H {
              animation: floatLayer 2s ease-in-out infinite;
              animation-delay: 0s;
            }
            svg[data-variant="loading"] #Layer1 {
              animation: floatLayer 2s ease-in-out infinite;
              animation-delay: 0.15s;
            }
            svg[data-variant="loading"] #Layer2 {
              animation: floatLayer 2s ease-in-out infinite;
              animation-delay: 0.3s;
            }

            /* Error State: Server rack collapsing / separating */
            svg[data-variant="error"] #H {
              transform: translateY(12px) rotate(-4deg);
            }
            svg[data-variant="error"] #Layer1 {
              transform: translateY(6px) rotate(2deg) translateX(4px);
            }
            svg[data-variant="error"] #Layer2 {
              /* Base layer stays somewhat grounded */
            }

            /* Interactive Hover State (stretches layers upwards) */
            .group:hover svg.logo-interactive #H, svg.logo-interactive:hover #H {
              transform: translateY(-8px) scaleY(1.05);
            }
            .group:hover svg.logo-interactive #Layer1, svg.logo-interactive:hover #Layer1 {
              transform: translateY(-4px) scaleY(1.02);
            }

            /* Interactive Click State (compresses layers downwards) */
            .group:active svg.logo-interactive #H, svg.logo-interactive:active #H {
              transform: translateY(6px) scaleY(0.95);
              transition-duration: 0.05s;
            }
            .group:active svg.logo-interactive #Layer1, svg.logo-interactive:active #Layer1 {
              transform: translateY(3px) scaleY(0.98);
              transition-duration: 0.05s;
            }
            .group:active svg.logo-interactive #Layer2, svg.logo-interactive:active #Layer2 {
              transform: scaleY(0.98);
              transition-duration: 0.05s;
            }
          `}
        </style>
      </defs>

      {/* Layer 2 (Bottom layer) */}
      <g id="Layer2" className="logo-layer">
        <path d="M180.68,193.32l.12-33.68a4.48,4.48,0,0,0-2.43-4L92.88,112.2a4.42,4.42,0,0,0-4,0L2.57,155.67a4.44,4.44,0,0,0-2.45,4L0,193.28a4.45,4.45,0,0,0,2.2,3.86l86.26,50.7a4.45,4.45,0,0,0,4.53,0l85.51-50.7A4.46,4.46,0,0,0,180.68,193.32Z" />
        <polygon className="cls-1" points="93.07 242.59 92.98 214.37 176.96 163.7 176.96 193.93 93.07 242.59" />
        <polygon className="cls-1" points="88.39 242.59 88.47 214.37 4.5 163.7 4.5 193.93 88.39 242.59" />
        <polygon className="cls-1" points="90.81 117.29 176.96 159.2 90.63 210.91 4.5 159.2 90.81 117.29" />
        <ellipse className="cls-2" cx="17.9" cy="186.47" rx="5.33" ry="6.77" transform="translate(-60.36 16.28) rotate(-19.21)" />
      </g>

      {/* Layer 1 (Middle layer) */}
      <g id="Layer1" className="logo-layer">
        <path d="M180.81,137.29l.12-33.68a4.46,4.46,0,0,0-2.43-4L93,56.17a4.42,4.42,0,0,0-4,0L2.7,99.64a4.46,4.46,0,0,0-2.45,4L.13,137.25a4.47,4.47,0,0,0,2.2,3.86l86.27,50.7a4.44,4.44,0,0,0,4.52,0l85.51-50.7A4.44,4.44,0,0,0,180.81,137.29Z" />
        <polygon className="cls-1" points="93.2 186.56 93.12 158.34 177.09 107.67 177.09 137.9 93.2 186.56" />
        <polygon className="cls-1" points="88.52 186.56 88.61 158.34 4.63 107.67 4.63 137.9 88.52 186.56" />
        <polygon className="cls-1" points="90.94 58.62 177.09 103.17 90.76 154.88 4.63 103.17 90.94 58.62" />
        <ellipse className="cls-2" cx="18.04" cy="130.44" rx="5.33" ry="6.77" transform="translate(-41.92 13.2) rotate(-19.21)" />
      </g>

      {/* H Layer (Top layer) */}
      <g id="H" className="logo-layer">
        <path d="M180.81,82.09l.12-33.68a4.43,4.43,0,0,0-2.43-4L145.83,27.82,121,41.81l.29-26.49L93,.48a4.45,4.45,0,0,0-4,0L3,45.06A4.49,4.49,0,0,0,.59,49L.65,81.43a4.47,4.47,0,0,0,2.2,3.86L35,104.65,55.46,93.11,55.63,117l33,19.66a4.44,4.44,0,0,0,4.52,0L178.63,85.9A4.44,4.44,0,0,0,180.81,82.09Z" />
        <polygon className="cls-1" points="93.2 131.36 93.12 103.14 177.09 52.47 177.09 82.7 93.2 131.36" />
        <polygon className="cls-1" points="88.52 131.98 88.61 102.28 59.29 84.58 59.29 114.78 88.52 131.98" />
        <polygon className="cls-1" points="36.9 99.68 55.52 89.15 55.63 78.73 61.9 75.16 62.09 54.79 36.9 69.18 36.9 99.68" />
        <polygon className="cls-1" points="64.98 74.23 82.26 64.07 64.98 54.06 64.98 74.23" />
        <polygon className="cls-1" points="117.07 43.95 97.85 33.84 117.07 22.51 117.07 43.95" />
        <polygon className="cls-1" points="33.24 98.97 33.33 69.28 4.63 51.36 4.63 81.56 33.24 98.97" />
        <polygon className="cls-1" points="145.96 31.51 117.33 48.01 90.73 33.59 117.07 17.24 90.67 2.96 6.3 48.06 34.9 65.59 63.68 49.05 90.37 63.56 60.28 80.91 90.76 99.68 177.09 47.97 145.96 31.51" />
        <ellipse className="cls-2" cx="18.04" cy="75.24" rx="5.33" ry="6.77" transform="translate(-23.75 10.13) rotate(-19.21)" />
      </g>
    </svg>
  );
}
