import React from "react";
import { useUserData } from "../../hooks/queries";
import { useUserdatacontext } from "../../service/context/usercontext";
import { useNavigate } from "react-router-dom";
import Time from "../../service/utiles/time";
import { Skeleton } from "../../ui/skeleton";

export default function Notify({ notification }) {
  const { userdata, defaultprofileimage } = useUserdatacontext();
  const navigate = useNavigate();
  const actorUid = notification?.intent?.likeby ?? notification?.intent?.fromUid;
  const { data: likeby } = useUserData(actorUid, { enabled: !!actorUid });

  const getNotificationText = () => {
    switch (notification?.intent?.type) {
      case "postlike":
        return "liked your post";
      case "commentlike":
        return "liked your comment";
      case "addcomment":
        return "commented on your post";
      case "addreply":
        return "replied to your comment";
      case "replylike":
        return "liked your reply";
      case "follow":
        return "started following you";
      case "message":
        return "sent you a message";
      default:
        return "interacted with you";
    }
  };

  const handleClick = () => {
    const type = notification?.intent?.type;
    if (type === "message" && likeby?.username) {
      navigate(`/messages/${likeby.username}`);
    } else if (type === "follow") {
      navigate(`/profile/${likeby?.username}`);
    } else if (notification?.intent?.postid) {
      navigate(`/profile/${userdata?.username}/${notification.intent.postid}`);
    } else if (likeby?.username) {
      navigate(`/profile/${likeby.username}`);
    }
  };

  return (
    <div
      className="flex gap-3 px-4 py-4 hover:bg-bg-hover/30 transition-colors cursor-pointer border-b border-border-default"
      onClick={handleClick}
    >
      <img
        className="w-10 h-10 rounded-full object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
        src={likeby?.profileImageURL || defaultprofileimage}
        alt={likeby?.name || "Profile"}
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/profile/${likeby?.username}`);
        }}
        onError={(e) => {
          e.target.src = defaultprofileimage;
        }}
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {likeby?.username ? (
            <>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${likeby?.username}`);
                }}
                className="font-bold text-[15px] text-text-primary hover:underline"
              >
                {likeby.username}
              </span>
              <span className="text-[15px] text-text-secondary">
                {getNotificationText()}
              </span>
            </>
          ) : (
            <Skeleton
              animation="wave"
              sx={{ bgcolor: "grey.900" }}
              variant="text"
              width={200}
              height={20}
            />
          )}
        </div>
        <span className="text-[13px] text-text-secondary">
          {Time(notification?.time?.toJSON().seconds)}
        </span>
      </div>
    </div>
  );
}
