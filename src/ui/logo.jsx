import { twMerge } from "tailwind-merge";

/**
 * NetMap logo using public SVG asset
 * @param {string | number} size - 'sm' | 'md' | 'lg' | 'xl' or pixel number (default 'md')
 * @param {string} className - Additional CSS classes for the wrapper
 * @param {boolean} showText - Whether to show "NetMap" label below the icon (default true)
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
        "flex flex-col items-center justify-center gap-2 rounded-xl",
        className
      )}
      {...props}
    >
      <img src="/netmap_square_logo.svg" alt="NetMap" width={s} height={s} className="block" />
    </div>
  );
}

export default Logo;
