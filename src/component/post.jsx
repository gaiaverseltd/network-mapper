import { useCallback, useEffect, useState, useRef } from "react";
import { auth } from "../service/Auth";
import { MdComment as CommentIcon } from "react-icons/md";
import { MdFavoriteBorder as LikeIcon } from "react-icons/md";
import { MdFavorite as LikedIcon } from "react-icons/md";
import { MdBookmarkBorder as BookmarkIcon } from "react-icons/md";
import { MdBookmark as BookmarkedIcon } from "react-icons/md";
import { MdBarChart as ViewsIcon } from "react-icons/md";
import { MdMoreVert as MoreIcon } from "react-icons/md";
import { MdShare as ShareIcon } from "react-icons/md";
import { MdInsertDriveFile as FileIcon } from "react-icons/md";
import { Skeleton } from "../ui/skeleton";
import { Popupitem } from "../ui/popup";
import Avatar from "../ui/avatar";
import ActionButton from "../ui/action-button";
import Linkify from "linkify-react";
import { useUserdatacontext } from "../service/context/usercontext";
import {
  Create_notification,
  updatepost,
  getFileNameFromStorageUrl,
} from "../service/Auth/database";
import { useUserData } from "../hooks/queries";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Time, { formatNumber } from "../service/utiles/time";
import Addcomment from "./addcomment";
import PostMenu from "../layout/post/PostMenu";
import HidePost from "../layout/post/HidePost";
import LikePost from "../layout/post/likePost";
import DeletePost from "../layout/post/DeletePost";
import Report from "../layout/post/Report";

export const Post = ({ postdata, popup = true }) => {
  const { userdata, handlesave, delete_post, defaultprofileimage } =
    useUserdatacontext();
  const [active, setactive] = useState("");
  const [post, setpost] = useState(postdata || null);
  const [hide, sethide] = useState(false);
  const [loadingimg, setloadingimg] = useState(true);
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();

  const { data: postedby } = useUserData(post?.postedby, { enabled: !!post?.postedby });

  // Reset loading state when post changes
  useEffect(() => {
    if (post?.img) {
      setloadingimg(true);
      setImgError(false);
    }
  }, [post?.postid, post?.img]);

  // Debounce post updates to prevent excessive database calls
  const updatePostDebounced = useCallback(async () => {
    if (post && postedby?.uid) {
      try {
        await updatepost(post, postedby.uid);
      } catch (error) {
        console.error("Error updating post:", error);
      }
    }
  }, [post, postedby?.uid]);

  const postUpdateRef = useRef(false);

  useEffect(() => {
    // Only update if post actually changed (not on initial mount)
    if (post && postedby?.uid && postUpdateRef.current) {
      const timeoutId = setTimeout(() => {
        updatePostDebounced();
      }, 1000); // Debounce by 1 second

      return () => clearTimeout(timeoutId);
    } else {
      postUpdateRef.current = true;
    }
  }, [post, postedby?.uid, updatePostDebounced]);

  const handleLike = useCallback(async () => {
    if (!auth?.currentUser) {
      toast.error("Login required");
      return;
    }

    const wasLiked = post?.likes.includes(userdata?.uid);
    
    // Optimistically update UI
    setpost((prev) => ({
      ...prev,
      likes: wasLiked
        ? prev.likes.filter((e) => e !== userdata?.uid)
        : [...prev.likes, userdata?.uid],
    }));

    // Send notification if liking (not unliking)
    if (!wasLiked && postedby?.username !== userdata?.username) {
      try {
        await Create_notification(post?.postedby, {
          likeby: userdata?.uid,
          type: "postlike",
          postid: post?.postid,
        });
      } catch (error) {
        console.error("Error creating notification:", error);
      }
    }
  }, [auth, post, userdata, postedby]);

  function handelactive(act) {
    active === act ? setactive("") : setactive(act);
  }

  // Track views only once per session
  useEffect(() => {
    const viewKey = `viewed_${post?.postid}`;
    if (post?.postid && !sessionStorage.getItem(viewKey)) {
      sessionStorage.setItem(viewKey, 'true');
      setpost((prev) => ({ ...prev, views: (prev.views || 0) + 1 }));
    }
  }, [post?.postid]);

  if (postedby?.block?.includes(userdata?.uid)) {
    return <></>;
  }

  if (hide) {
    return <HidePost setactive={setactive} sethide={sethide} />;
  }

  const isLiked = post?.likes?.includes(userdata?.uid);
  const isBookmarked = userdata?.saved?.some(
    (savedpost) => post?.postid === savedpost?.postid,
  );

  return (
    <article
      className="relative border-b border-border-default/50 hover:bg-bg-hover/20 transition-all duration-200 ease-out overflow-hidden group"
      onClick={() => navigate(`/profile/${postedby?.username}/${post?.postid}`)}
    >
      {/* Post Container */}
      <div className="flex gap-3 px-4 py-4 w-full max-w-full overflow-hidden">
        {/* Avatar Section */}
        <div className="flex-shrink-0">
          <Avatar
            src={postedby?.profileImageURL}
            alt={postedby?.name || "Profile"}
            size="md"
            fallback={defaultprofileimage}
            onClick={(e) => {
              e?.stopPropagation?.();
              navigate(`/profile/${postedby?.username}`);
            }}
          />
        </div>

        {/* Content Section */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Header Section */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${postedby?.username}`);
              }}
              className="flex items-center gap-1.5 cursor-pointer group/header flex-wrap"
            >
              {postedby?.name ? (
                <>
                  <span className="font-semibold text-[15px] text-text-primary hover:underline transition-all duration-200 group-hover/header:text-accent-500">
                    {postedby.name}
                  </span>
                  <span className="text-[15px] text-text-secondary truncate max-w-[120px] md:max-w-none">
                    @{postedby.username}
                  </span>
                  <span className="text-[15px] text-text-secondary">·</span>
                  <span className="text-[15px] text-text-secondary hover:underline transition-colors duration-200">
                    {Time(post?.postedat?.toJSON().seconds)}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <Skeleton
                    animation="wave"
                    sx={{ bgcolor: "grey.900" }}
                    variant="text"
                    width={120}
                    height={16}
                  />
                  <Skeleton
                    animation="wave"
                    sx={{ bgcolor: "grey.900" }}
                    variant="text"
                    width={80}
                    height={16}
                  />
                </div>
              )}
            </div>

            {/* Menu Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                active === "menu" ? setactive("") : setactive("menu");
              }}
              className="flex-shrink-0 p-1.5 rounded-full hover:bg-accent-500/10 text-text-secondary hover:text-accent-500 transition-all duration-200 active:scale-95"
              aria-label="Post options"
            >
              <MoreIcon className="text-xl" />
            </button>
            
            {/* Post Menu */}
            {active === "menu" && (
              <PostMenu
                post={post}
                setactive={setactive}
                popup={popup}
                handlesave={handlesave}
                postedby={postedby}
                sethide={sethide}
              />
            )}
          </div>

          {/* Post Content */}
          {post?.content && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${postedby?.username}/${post?.postid}`);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
              className="mb-3 break-long-words max-w-full overflow-hidden"
            >
              <p className="text-[15px] text-text-primary leading-[1.6] whitespace-pre-wrap break-long-words">
                <Linkify
                  as="span"
                  options={{
                    attributes: {
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className: "text-accent-500 hover:text-accent-400 hover:underline transition-colors duration-200 break-words",
                    },
                  }}
                >
                  {post.content}
                </Linkify>
              </p>
            </div>
          )}

          {/* Post custom fields */}
          {post?.customFields && Object.keys(post.customFields).length > 0 && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${postedby?.username}/${post?.postid}`);
              }}
              className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm"
            >
              {Object.entries(post.customFields).map(([key, value]) => {
                if (value == null || String(value).trim() === "") return null;
                const label = key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
                const strVal = String(value);
                const isMultiline = strVal.includes("\n");
                const isUrl = strVal.startsWith("http");
                const isImageUrl =
                  isUrl &&
                  (String(key).toLowerCase().includes("image") ||
                    /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(strVal));
                return (
                  <span key={key} className={`text-text-secondary ${isMultiline ? "block w-full" : ""}`}>
                    <span className="text-text-tertiary">{label}:</span>{" "}
                    {isImageUrl ? (
                      <span className="inline-block">
                        <a
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-500 hover:underline inline-block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <img
                            src={value}
                            alt={label}
                            className="max-h-16 rounded border border-border-default object-cover"
                          />
                        </a>
                        <span className="block text-xs text-text-tertiary truncate max-w-[180px]">
                          {getFileNameFromStorageUrl(strVal)}
                        </span>
                      </span>
                    ) : isUrl ? (
                      <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-accent-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileIcon className="flex-shrink-0 text-base text-text-secondary" />
                        <span className="truncate max-w-[180px]">
                          {String(key).toLowerCase().includes("url") ? value : getFileNameFromStorageUrl(strVal)}
                        </span>
                      </a>
                    ) : isMultiline ? (
                      <pre className="mt-0.5 whitespace-pre-wrap font-sans text-inherit text-text-secondary">
                        {value}
                      </pre>
                    ) : String(key).toLowerCase().includes("phone") ? (
                      <a
                        href={`tel:${strVal.replace(/\s/g, "")}`}
                        className="text-accent-500 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {value}
                      </a>
                    ) : (
                      value
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Post Image */}
          {post?.img && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${postedby?.username}/${post?.postid}`);
              }}
              className="relative rounded-2xl overflow-hidden border border-border-default/50 mb-3 cursor-pointer group/image transition-all duration-300 hover:border-border-hover/50 hover:shadow-lg hover:shadow-black/20 aspect-video bg-bg-tertiary"
            >
              {loadingimg && !imgError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Skeleton
                    animation="wave"
                    sx={{ bgcolor: "grey.900", borderRadius: "1rem" }}
                    variant="rectangular"
                    width="100%"
                    height="100%"
                  />
                </div>
              )}
              {imgError ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center px-4">
                    <p className="text-text-tertiary text-sm">Failed to load image</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgError(false);
                        setloadingimg(true);
                      }}
                      className="mt-2 text-xs text-accent-500 hover:text-accent-400 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <img
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleLike();
                  }}
                  onLoad={() => setloadingimg(false)}
                  onError={() => {
                    setloadingimg(false);
                    setImgError(true);
                    console.error('Failed to load image:', post.img);
                  }}
                  src={post.img}
                  className={`absolute inset-0 w-full h-full max-w-[800px] object-contain transition-all duration-300 group-hover/image:scale-[1.02] ${
                    loadingimg ? "opacity-0" : "opacity-100"
                  }`}
                  alt="Post"
                  loading="lazy"
                />
              )}
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between mt-3 max-w-[500px]">
            {/* Comment Button */}
            <ActionButton
              icon={CommentIcon}
              label="Comment"
              variant="comment"
              count={post?.comments?.length || 0}
              onClick={(e) => {
                e.stopPropagation();
                popup && handelactive("comment");
              }}
            />

            {/* Like Button with Count */}
            <div className="flex items-center gap-1.5">
              <ActionButton
                icon={isLiked ? LikedIcon : LikeIcon}
                label="Like"
                variant="like"
                isActive={isLiked}
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike();
                }}
              />
              {post?.likes?.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handelactive("like");
                  }}
                  className="text-[13px] font-medium text-text-secondary hover:text-social-like transition-colors duration-200 cursor-pointer min-w-[20px]"
                >
                  {post.likes.length}
                </button>
              )}
            </div>

            {/* Share Button */}
            <ActionButton
              icon={ShareIcon}
              label="Share"
              variant="share"
              onClick={(e) => {
                e.stopPropagation();
                if (navigator.share) {
                  navigator.share({
                    title: `Check out this post by @${postedby?.username}`,
                    text: post?.content?.substring(0, 100),
                    url: `${window.location.origin}/profile/${postedby?.username}/${post?.postid}`,
                  }).catch(() => {});
                }
              }}
            />

            {/* Bookmark Button */}
            <ActionButton
              icon={isBookmarked ? BookmarkedIcon : BookmarkIcon}
              label="Bookmark"
              variant="bookmark"
              isActive={isBookmarked}
              onClick={(e) => {
                e.stopPropagation();
                handlesave(post);
              }}
            />

            {/* Views Counter */}
            {post?.views > 0 && (
              <div className="flex items-center gap-1.5 text-text-secondary">
                <ViewsIcon className="text-lg" />
                <span className="text-[13px] font-medium">
                  {formatNumber(post.views)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals and Popups */}
      {active === "like" && <LikePost post={post} setactive={setactive} />}
      {active === "delete" && (
        <DeletePost
          delete_post={delete_post}
          post={post}
          setactive={setactive}
        />
      )}
      {active === "report" && <Report setactive={setactive} />}

      {/* Comment Popup */}
      {popup && active === "comment" && (
        <Popupitem
          closefunction={() => {
            setactive("");
          }}
        >
          <Post postdata={post} popup={false} />
          <Addcomment cuupost={post} cuusetpost={setpost} />
        </Popupitem>
      )}
    </article>
  );
};
