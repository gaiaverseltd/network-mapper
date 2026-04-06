import React from "react";
import { Link } from "react-router-dom";
import Avatar from "../ui/avatar";
import { getImportedListSubtitle } from "./imported-profile-summary";
import { MdEmail as EmailIcon } from "react-icons/md";
import { MdCalendarToday as CalendarIcon } from "react-icons/md";

/**
 * User card matching admin users grid. Use as link to profile (no onClick) or
 * as button that calls onClick(profile) e.g. for admin edit modal.
 */
export default function UserCard({
  profile,
  defaultprofileimage,
  onClick,
  showEmail = false,
  showDirectoryBadge = false,
  /** Stretch to grid row height and align tall cards (e.g. admin user list). */
  fillGridCell = false,
}) {
  const joinDate =
    profile?.createdAt?.toDate
      ? profile.createdAt.toDate()
      : profile?.createdAt
        ? new Date(profile.createdAt)
        : null;
  const joinDateStr = joinDate
    ? joinDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "—";
  const username = profile?.username ?? profile?.id ?? "";
  const { primary: importedPrimary, secondary: importedLocation } = getImportedListSubtitle(profile);
  const fallbackTitle =
    profile?.customFields?.title ||
    (Array.isArray(profile?.memberData?.title) ? profile.memberData.title.filter(Boolean).join("; ") : profile?.memberData?.title) ||
    "";
  const fallbackOrg = profile?.customFields?.organization || profile?.memberData?.organization || "";
  const subtitle =
    importedPrimary || [fallbackTitle, fallbackOrg].filter(Boolean).join(" · ");

  const cardContent = (
    <>
      <div className="h-24 shrink-0 bg-gradient-to-br from-accent-500/20 via-primary-500/20 to-accent-700/20 relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-50" />
        {showDirectoryBadge &&
          profile?.memberData &&
          typeof profile.memberData === "object" &&
          Object.keys(profile.memberData).length > 0 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-[10px] font-medium uppercase tracking-wide text-white/90 border border-white/10">
            Directory
          </span>
        )}
      </div>
      <div className="flex justify-center -mt-10 mb-3 px-4 shrink-0">
        <div className="relative">
          <Avatar
            src={profile?.profileImageURL}
            alt={profile?.name || "User"}
            size="2xl"
            fallback={defaultprofileimage}
            className="border-4 border-bg-tertiary ring-2 ring-border-default group-hover:ring-accent-500/50 transition-all duration-300"
          />
          {profile?.privacy && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-bg-tertiary border-2 border-bg-tertiary rounded-full flex items-center justify-center">
              <span className="text-xs">🔒</span>
            </div>
          )}
        </div>
      </div>
      <div
        className={`px-4 pb-4 text-center ${fillGridCell ? "flex flex-col flex-1 min-h-0" : ""}`}
      >
        <h3 className="font-bold text-[15px] text-white truncate group-hover:text-accent-400 transition-colors duration-200 shrink-0">
          {profile?.name || "—"}
        </h3>
        <p className="text-[13px] text-gray-200 truncate mb-1 shrink-0">@{username || "—"}</p>
        {subtitle ? (
          <p
            className={`text-[11px] text-text-secondary line-clamp-2 mb-1 shrink-0 ${fillGridCell ? "min-h-[2.5rem]" : ""}`}
          >
            {subtitle}
          </p>
        ) : fillGridCell ? (
          <div className="min-h-[2.5rem] mb-1 shrink-0" aria-hidden="true" />
        ) : null}
        {importedLocation ? (
          <p
            className={`text-[10px] text-text-tertiary line-clamp-1 mb-2 shrink-0 ${fillGridCell ? "min-h-[1.25rem]" : ""}`}
          >
            {importedLocation}
          </p>
        ) : fillGridCell ? (
          <div className="min-h-[1.25rem] mb-2 shrink-0" aria-hidden="true" />
        ) : null}
        {profile?.bio ? (
          <p
            className={`text-[12px] text-gray-300 line-clamp-2 mb-3 shrink-0 ${fillGridCell ? "min-h-[3rem]" : "min-h-[2.5rem]"}`}
          >
            {profile.bio}
          </p>
        ) : fillGridCell ? (
          <div className="min-h-[3rem] mb-3 shrink-0" aria-hidden="true" />
        ) : null}
        <div
          className={`grid grid-cols-3 gap-2 mb-3 pt-3 border-t border-white/20 shrink-0 ${fillGridCell ? "mt-auto" : ""}`}
        >
          <div className="text-center">
            <div className="text-[15px] font-bold text-white">{profile?.post?.length ?? 0}</div>
            <div className="text-[11px] text-gray-300 uppercase tracking-wide">Posts</div>
          </div>
          <div className="text-center">
            <div className="text-[15px] font-bold text-white">{profile?.follower?.length ?? 0}</div>
            <div className="text-[11px] text-gray-300 uppercase tracking-wide">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-[15px] font-bold text-white">{profile?.following?.length ?? 0}</div>
            <div className="text-[11px] text-gray-300 uppercase tracking-wide">Following</div>
          </div>
        </div>
        <div className="space-y-1.5 text-left shrink-0">
          {showEmail &&
            (profile?.email ? (
              <div className="flex items-center gap-2 text-[11px] text-gray-300">
                <EmailIcon className="text-sm flex-shrink-0" />
                <span className="truncate">{profile.email}</span>
              </div>
            ) : fillGridCell ? (
              <div className="h-[1.375rem]" aria-hidden="true" />
            ) : null)}
          <div className="flex items-center gap-2 text-[11px] text-gray-300">
            <CalendarIcon className="text-sm flex-shrink-0" />
            <span>Joined {joinDateStr}</span>
          </div>
        </div>
      </div>
    </>
  );

  const baseClass =
    `group w-full text-left bg-bg-tertiary rounded-xl overflow-hidden hover:bg-bg-elevated transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:scale-[1.02] border border-border-default hover:border-accent-500/30 text-white${
      fillGridCell ? " h-full flex flex-col" : ""
    }`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(profile)}
        className={baseClass}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <Link to={`/profile/${username}`} className={baseClass}>
      {cardContent}
    </Link>
  );
}
