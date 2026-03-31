import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";

/**
 * Avatar Component - Reusable profile image component
 * @param {string} src - Image source URL
 * @param {string} alt - Alt text for image
 * @param {string} size - Size variant: 'sm' | 'md' | 'lg' | 'xl'
 * @param {string} className - Additional CSS classes
 * @param {string} fallback - Fallback image URL
 * @param {function} onClick - Click handler
 */
function Avatar({
  src,
  alt = "Profile",
  size = "md",
  className,
  fallback,
  onClick,
  ...props
}) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
    "2xl": "w-20 h-20",
  };

  const handleError = (e) => {
    if (fallback) {
      e.target.src = fallback;
    }
  };

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const wrapperClass = `flex-shrink-0 overflow-hidden rounded-full ${sizeClass}`;
  const avatarContent = (
    <img
      src={src || fallback}
      alt={alt}
      className={twMerge(
        "w-full h-full rounded-full object-contain object-center transition-all duration-200",
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      onError={handleError}
      onClick={handleClick}
      {...props}
    />
  );

  if (onClick) {
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        className={wrapperClass}
      >
        {avatarContent}
      </motion.div>
    );
  }

  return <div className={wrapperClass}>{avatarContent}</div>;
}

export default Avatar;

