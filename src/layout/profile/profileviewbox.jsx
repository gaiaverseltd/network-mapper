import React, { useEffect, useState } from "react";
import { useUserdatacontext } from "../../service/context/usercontext";
import { useNavigate } from "react-router-dom";
import { updateprofileuserdata } from "../../service/Auth/database";
import { useUserData } from "../../hooks/queries";
import { Skeleton } from "../../ui/skeleton";
import Avatar from "../../ui/avatar";
import { auth } from "../../service/Auth";
import { getImportedListSubtitle } from "../../component/imported-profile-summary";

export default function Profileviewbox({
  profile = null,
  bio = false,
  profileusername,
}) {
  const navigate = useNavigate();
  const { data: fetchedProfile } = useUserData(profileusername, { enabled: !!(profileusername && !profile) });
  const [profileuserdata, setprofileuserdata] = useState(profile || fetchedProfile || null);
  const { defaultprofileimage, userdata, setuserdata, isAdmin } = useUserdatacontext();

  useEffect(() => {
    if (profile) setprofileuserdata(profile);
    else if (fetchedProfile) setprofileuserdata(fetchedProfile);
  }, [profile, fetchedProfile]);

  useEffect(() => {
    const data = async () => {
      if (profileuserdata) {
        await updateprofileuserdata(profileuserdata, profileuserdata?.username);
      }
    };
    data();
  }, [profileuserdata]);

  const handelfollow = () => {
    if (auth.currentUser && profileuserdata) {
      {
        profileuserdata?.follower?.includes(userdata?.uid)
          ? setprofileuserdata((prev) => ({
              ...prev,
              follower: profileuserdata?.follower.filter(
                (e) => e !== userdata?.uid,
              ),
            }))
          : setprofileuserdata((prev) => ({
              ...prev,
              follower: [...prev?.follower, userdata?.uid],
            }));

        !userdata?.following.includes(profileuserdata?.uid)
          ? setuserdata((prev) => ({
              ...prev,
              following: [...prev.following, profileuserdata?.uid],
            }))
          : setuserdata((prev) => ({
              ...prev,
              following: userdata?.following.filter(
                (e) => e !== profileuserdata?.uid,
              ),
            }));
      }
    } else navigate("/login");
  };

  if ((profileuserdata?.block?.includes(userdata?.uid) && !isAdmin) || !profileuserdata) {
    return <></>;
  }

  const isFollowing = userdata?.following?.includes(profileuserdata?.uid);
  const { primary: subPrimary, secondary: subSecondary } = getImportedListSubtitle(profileuserdata);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors">
      <Avatar
        src={profileuserdata?.profileImageURL}
        alt={profileuserdata?.name || "Profile"}
        size="md"
        fallback={defaultprofileimage}
        onClick={() => navigate(`/profile/${profileuserdata?.username}`)}
      />
      
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => navigate(`/profile/${profileuserdata?.username}`)}
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-[15px] text-text-primary hover:underline truncate">
            {profileuserdata?.name || (
              <Skeleton
                animation="wave"
                sx={{ bgcolor: "grey.900" }}
                variant="text"
                width={100}
              />
            )}
          </span>
          <span className="text-[15px] text-text-secondary truncate">
            @
            {profileuserdata?.username || (
              <Skeleton
                animation="wave"
                sx={{ bgcolor: "grey.900" }}
                variant="text"
                width={100}
              />
            )}
          </span>
          {subPrimary && (
            <p className="text-[12px] text-text-secondary mt-0.5 line-clamp-1">{subPrimary}</p>
          )}
          {subSecondary && (
            <p className="text-[11px] text-text-tertiary line-clamp-1">{subSecondary}</p>
          )}
          {bio && profileuserdata?.bio && (
            <p className="text-[15px] text-text-primary mt-1 line-clamp-2">
              {profileuserdata.bio}
            </p>
          )}
        </div>
      </div>
      
      {profileuserdata?.username !== userdata?.username && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/messages/${profileuserdata?.username}`);
            }}
            className="px-4 h-8 rounded-full font-bold text-[15px] transition-colors border border-border-default text-text-primary hover:bg-bg-hover"
          >
            Message
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handelfollow();
            }}
            className={`px-4 h-8 rounded-full font-bold text-[15px] transition-colors ${
              isFollowing
                ? "bg-transparent border border-border-default text-text-primary hover:bg-status-error/10 hover:border-status-error hover:text-status-error"
                : "bg-text-primary text-bg-default hover:bg-text-secondary active:bg-text-tertiary"
            }`}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
        </div>
      )}
    </div>
  );
}
