import { twMerge } from "tailwind-merge";

/**
 * AccelNet logo – hexagon with mountain/peak and "AccelNet" text
 * @param {string | number} size - 'sm' | 'md' | 'lg' | 'xl' or pixel number (default 'md')
 * @param {string} className - Additional CSS classes for the wrapper
 * @param {boolean} showText - Whether to show "AccelNet" label below the icon (default true)
 */
function Logo({ size = "md", className, showText = true, ...props }) {
  const sizeMap = {
    sm: 80,
    md: 120,
    lg: 180,
    xl: 240,
    xxl: 300,
    xxxl: 360,
    xxxxl: 540,
    xxxxxl: 720,
  };
  const s = typeof size === "number" ? size : (sizeMap[size] ?? sizeMap.md);

  return (
    <div
      className={twMerge(
        "flex items-center justify-center rounded-xl bg-black",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-center">
        <svg
          width={s}
          height={s}
          viewBox="0 0 180 180"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M 90 35 L 135 60 L 135 110 L 90 135 L 45 110 L 45 60 Z"
            fill="#1e3a8a"
            stroke="#60a5fa"
            strokeWidth="3"
          />
          <path
            d="M 65 105 L 90 65 L 115 105"
            fill="none"
            stroke="#93c5fd"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="75"
            y1="95"
            x2="105"
            y2="95"
            stroke="#60a5fa"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="90" cy="65" r="5" fill="#93c5fd" />
          {showText && (
            <text
              x="90"
              y="155"
              fontFamily="Arial, sans-serif"
              fontSize="18"
              fontWeight="bold"
              fill="#dbeafe"
              textAnchor="middle"
            >
              AccelNet
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

export default Logo;
