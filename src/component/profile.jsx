import { useState, useEffect, Fragment } from "react";
import { MdArrowBack as ArrowBackIcon } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { Post } from "./post";
import { MdEdit as EditIcon } from "react-icons/md";
import { MdInsertDriveFile as FileIcon } from "react-icons/md";
import { Popupitem } from "../ui/popup";
import { useUserdatacontext } from "../service/context/usercontext";
import {
  Create_notification,
  updateprofileuserdata,
  updateuserdata,
  getTagsByCategoryId,
  getFileNameFromStorageUrl,
} from "../service/Auth/database";
import { useUserByUsername, useClassificationTagOptions, useCustomFieldsForProfile } from "../hooks/queries";
import { useQueries } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Skeleton } from "../ui/skeleton";
import { MdMoreVert as MoreVertIcon } from "react-icons/md";
import { Createpost } from "./createpost";
import { auth } from "../service/Auth";
import Profileviewbox from "../layout/profile/profileviewbox";
import ProgressBar from "@badrap/bar-of-progress";
import Aboutprofile from "../layout/profile/aboutprofile";
import NoPost from "../layout/profile/no-post";
import Private from "../layout/profile/private";
import Loading from "../layout/loading";
import Report from "../layout/profile/report";
import FirstPost from "../layout/profile/firstPost";
import Menu from "../layout/profile/menu";
import MemberImportDetails from "./member-import-details";
import ImportedProfileSummary, { getImportedSummaryRows } from "./imported-profile-summary";
export const Profile = ({ username }) => {
  const progress = new ProgressBar();
  const navigate = useNavigate();
  const { userdata, defaultprofileimage, setuserdata, isAdmin } = useUserdatacontext();
  const [active, setactive] = useState("");
  const [mutual, setmutual] = useState([]);
  const { data: profileFromQuery, isLoading } = useUserByUsername(username, { enabled: !!username && username !== userdata?.username });
  const loading = username === userdata?.username ? !userdata : isLoading;
  const [profileuserdata, setprofileuserdata] = useState(null);

  useEffect(() => {
    if (username === userdata?.username) {
      setprofileuserdata(userdata);
    } else if (profileFromQuery) {
      setprofileuserdata(profileFromQuery);
    }
  }, [username, userdata, profileFromQuery]);
  const { data: classificationTagOptions = [] } = useClassificationTagOptions();
  const { data: profileCustomFieldDefs = [] } = useCustomFieldsForProfile();
  const classificationLabel = profileuserdata?.classificationTagId
    ? classificationTagOptions.find((t) => t.id === profileuserdata.classificationTagId)?.label ?? null
    : null;
  const lookups = profileCustomFieldDefs.filter((f) => f.type === "lookup" && f.tagCategoryId);
  const tagQueries = useQueries({
    queries: lookups.map((f) => ({
      queryKey: ["tags", f.tagCategoryId],
      queryFn: () => getTagsByCategoryId(f.tagCategoryId),
      enabled: !!f.tagCategoryId,
    })),
  });
  const lookupTagLabels = lookups.reduce((acc, f, i) => {
    if (tagQueries[i]?.data) {
      tagQueries[i].data.forEach((t) => { acc[t.id] = t.label; });
    }
    return acc;
  }, {});

  useEffect(() => {
    setactive("");
  }, [username]);

  useEffect(() => {
    if (userdata?.username === profileuserdata?.username) {
      userdata && setprofileuserdata(userdata);
    }
  }, [userdata, profileuserdata?.username]);

  // Listen for post deletions to update profile
  useEffect(() => {
    const handlePostDeleted = (event) => {
      const { postid } = event.detail;
      if (profileuserdata?.post) {
        setprofileuserdata((prev) => ({
          ...prev,
          post: prev.post.filter((p) => p.postid !== postid),
        }));
      }
    };

    window.addEventListener('postDeleted', handlePostDeleted);
    return () => {
      window.removeEventListener('postDeleted', handlePostDeleted);
    };
  }, [profileuserdata]);

  useEffect(() => {
    const data = async () => {
      if (auth.currentUser && profileuserdata && userdata?.username === profileuserdata?.username) {
        await updateprofileuserdata(profileuserdata, username);
      }
    };
    data();
  }, [profileuserdata]);

  useEffect(() => {
    const data = () => {
      setmutual(
        profileuserdata?.follower?.filter((pre) =>
          userdata?.follower?.includes(pre),
        ),
      );
    };
    data();
  }, [userdata, profileuserdata]);

  useEffect(() => {
    if (profileuserdata?.block?.includes(userdata?.uid) && !isAdmin) {
      setprofileuserdata(null);
    }
  }, [profileuserdata, userdata?.uid, isAdmin]);

  const handelfollow = async () => {
    if (!auth.currentUser || !profileuserdata) {
      navigate("/login");
      return;
    }
    if (!userdata?.uid || !profileuserdata?.uid) {
      toast.error("Unable to update follow");
      return;
    }
    const isCurrentlyFollowing = profileuserdata?.follower?.includes(userdata.uid);
    const newProfileFollower = isCurrentlyFollowing
      ? (profileuserdata.follower || []).filter((e) => e !== userdata.uid)
      : [...(profileuserdata.follower || []), userdata.uid];
    const newUserFollowing = isCurrentlyFollowing
      ? (userdata.following || []).filter((e) => e !== profileuserdata.uid)
      : [...(userdata.following || []), profileuserdata.uid];

    setprofileuserdata((prev) => ({ ...prev, follower: newProfileFollower }));
    setuserdata((prev) => ({ ...prev, following: newUserFollowing }));

    try {
      const usernameToUpdate = (profileuserdata.username || "").trim().toLowerCase();
      await updateprofileuserdata({ follower: newProfileFollower }, usernameToUpdate);
      await updateuserdata({ uid: userdata.uid, following: newUserFollowing });
      if (!isCurrentlyFollowing) {
        await Create_notification(profileuserdata?.uid, {
          type: "follow",
          likeby: userdata?.uid,
        });
      }
    } catch (err) {
      console.error("handelfollow:", err);
      setprofileuserdata((prev) => ({ ...prev, follower: profileuserdata?.follower }));
      setuserdata((prev) => ({ ...prev, following: userdata?.following }));
      toast.error("Failed to update follow");
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="post w-full p-2 sm:text-2xl text-lg capitalize">
      <div className="flex relative m-1 sm:m-2 ">
        <i
          onClick={() => {
            navigate("/home");
          }}
        >
          <ArrowBackIcon />
        </i>
        <div className="flex flex-col sm:text-xl text-lg mx-4 capitalize">
          <label>
            {profileuserdata?.name || (
              <Skeleton
                animation="wave"
                sx={{ bgcolor: "grey.900" }}
                variant="text"
                width={150}
              />
            )}
          </label>
          <label className="text-gray-500 text-sm sm:text-base">
            {profileuserdata?.post?.length} Posts
          </label>
        </div>
        <i
          className="ml-auto"
          onClick={() => {
            active === "setting" ? setactive("") : setactive("setting");
          }}
        >
          <MoreVertIcon />
        </i>
        {active === "setting" && profileuserdata && (
          <Menu
            profileuserdata={profileuserdata}
            setprofileuserdata={setprofileuserdata}
            setactive={setactive}
          />
        )}
      </div>
      <div className="flex items-center justify-center grid grid-cols-2 lg:grid-cols-2 gap-6 lg:gap-8 lg:items-start px-8">
        {/* Left column: profile card – 2 equal columns: main data | custom fields */}
        <aside className="grid grid-cols-2 gap-4 lg:sticky lg:top-4">
        {/* Left: main profile data */}
        <div className="sm:my-10 sm:space-y-3 space-y-1 flex flex-col text-left sm:m-5 m-3">
          <img
            src={profileuserdata?.profileImageURL || defaultprofileimage}
            onError={(e) => {
              e.target.src = defaultprofileimage;
            }}
            className="sm:w-28 sm:h-28 h-20 w-20 rounded-full object-cover"
          />
          <div className="flex flex-col ">
            <div className="flex items-center gap-2">
              <label className=" text-xl font-semibold">
                {profileuserdata?.name || (
                  <Skeleton
                    animation="wave"
                    sx={{ bgcolor: "grey.900" }}
                    variant="text"
                    width={150}
                  />
                )}
              </label>
              {profileuserdata?.username === userdata?.username && userdata?.username && (
                <button
                  title="Edit profile"
                  onClick={(e) => {
                    e.stopPropagation?.();
                    navigate("/setting/edit-profile");
                  }}
                  className="p-1 rounded-full hover:bg-bg-hover text-text-secondary hover:text-accent-500 transition-colors"
                  aria-label="Edit profile"
                >
                  <EditIcon className="text-lg" />
                </button>
              )}
            </div>
            <label className="flex text-lg items-center gap-2 text-gray-400">
              @{profileuserdata?.username || username}
              {profileuserdata?.isAdmin && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  Admin
                </span>
              )}
            </label>
          </div>
          {profileuserdata?.bio && (
            <pre className=" text-sm sm:text-base">{profileuserdata?.bio}</pre>
          )}
          {classificationLabel && (
            <p className="text-sm text-gray-400 text-xl font-semibold">
            {classificationLabel}
            </p>
          )}
          {getImportedSummaryRows(profileuserdata).length > 0 && (
            <ImportedProfileSummary
              profile={profileuserdata}
              className="mt-3 pt-3 border-t border-border-default"
            />
          )}
          <div className="flex space-x-3 sm:text-lg text-base text-gray-400">
            <label
              onClick={() => {
                ((profileuserdata?.privacy &&
                  profileuserdata?.follower.includes(userdata?.uid)) ||
                  !profileuserdata?.privacy) &&
                  profileuserdata?.follower.length > 0 &&
                  setactive("followers");

                profileuserdata?.username === userdata?.username &&
                  profileuserdata?.follower.length > 0 &&
                  setactive("followers");
              }}
            >
              {profileuserdata?.follower?.length} follower
            </label>
            <label
              onClick={() => {
                ((profileuserdata?.privacy &&
                  profileuserdata?.follower.includes(userdata?.uid)) ||
                  !profileuserdata?.privacy) &&
                  profileuserdata?.following.length > 0 &&
                  setactive("following");

                profileuserdata?.username === userdata?.username &&
                  profileuserdata?.following.length > 0 &&
                  setactive("following");
              }}
            >
              {profileuserdata?.following?.length} following
            </label>
          </div>

          {profileuserdata?.profileResources?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border-default">
              <h3 className="text-sm font-semibold text-text-primary mb-2">Resources</h3>
              <ul className="space-y-3">
                {profileuserdata.profileResources.map((res) => (
                  <li
                    key={res.id}
                    className="p-3 rounded-lg bg-bg-tertiary border border-border-default"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary">
                          {res.name?.trim() || "Unnamed resource"}
                        </p>
                        {res.description?.trim() && (
                          <p className="text-sm text-text-secondary mt-0.5 whitespace-pre-wrap">
                            {res.description}
                          </p>
                        )}
                      </div>
                      <a
                        href={res.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-default text-sm text-accent-500 hover:bg-bg-hover hover:underline flex-shrink-0"
                      >
                        <FileIcon className="flex-shrink-0 text-lg" />
                        {res.name?.trim() || getFileNameFromStorageUrl(res.fileUrl) || "Download"}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          
          {userdata?.block?.includes(profileuserdata?.uid) && (
            <label className="text-sm my-4  font-serif text-red-400">
              you blocked this account
            </label>
          )}
          {mutual?.length > 0 &&
            userdata?.username !== profileuserdata?.username && (
              <div
                onClick={() => {
                  setactive("mutual");
                }}
                className="text-neutral-400 cursor-pointer text-xs sm:text-sm text-left "
              >
                {mutual?.length} mutual friends also follow{" "}
                <b>{profileuserdata?.name}</b>
              </div>
            )}
        </div>

        {/* Right: custom fields */}
        <div className="sm:my-10 sm:space-y-3 space-y-1 flex flex-col text-left sm:m-5 m-3">
          {profileCustomFieldDefs
            .filter((f) => profileuserdata?.customFields?.[f.key] != null && profileuserdata.customFields[f.key] !== "")
            .map((f) => (
              <div key={f.id} className="text-sm text-gray-400 mt-1">
                <span className="text-gray-500">{f.label}:</span>{" "}
                {f.type === "url" ? (
                  <a
                    href={profileuserdata.customFields[f.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-500 hover:underline"
                  >
                    {profileuserdata.customFields[f.key]}
                  </a>
                ) : f.type === "phone" ? (
                  <a
                    href={`tel:${profileuserdata.customFields[f.key].replace(/\s/g, "")}`}
                    className="text-accent-500 hover:underline"
                  >
                    {profileuserdata.customFields[f.key]}
                  </a>
                ) : f.type === "lookup" ? (
                  lookupTagLabels[profileuserdata.customFields[f.key]] ?? profileuserdata.customFields[f.key]
                ) : f.type === "image" ? (
                  <span className="inline-block mt-1">
                    <a
                      href={profileuserdata.customFields[f.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-500 hover:underline inline-block"
                    >
                      <img
                        src={profileuserdata.customFields[f.key]}
                        alt={f.label}
                        className="max-h-24 rounded border border-border-default object-cover"
                      />
                    </a>
                    <span className="block text-sm text-text-tertiary mt-0.5 truncate max-w-[220px]">
                      {getFileNameFromStorageUrl(profileuserdata.customFields[f.key])}
                    </span>
                  </span>
                ) : f.type === "file" ? (
                  <a
                    href={profileuserdata.customFields[f.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-accent-500 hover:underline"
                  >
                    <FileIcon className="flex-shrink-0 text-lg text-text-secondary" />
                    <span className="truncate max-w-[220px]">
                      {getFileNameFromStorageUrl(profileuserdata.customFields[f.key])}
                    </span>
                  </a>
                ) : f.type === "note" ? (
                  <pre className="mt-0.5 whitespace-pre-wrap font-sans text-inherit">
                    {profileuserdata.customFields[f.key]}
                  </pre>
                ) : (
                  profileuserdata.customFields[f.key]
                )}
              </div>
            ))}
        </div>

        {profileuserdata?.memberData && (
          <div className="col-span-2 sm:mx-5 mx-3 -mt-4">
            <MemberImportDetails memberData={profileuserdata.memberData} />
          </div>
        )}

        {profileuserdata?.username !== userdata?.username && (
          <div
            className={`col-span-2 ${userdata?.username ? "flex flex-wrap gap-2" : "hidden"} cursor-pointer mr-5 ml-auto`}
          >
            <button
              title="message"
              onClick={() => navigate(`/messages/${profileuserdata?.username}`)}
              className="border-2 relative top-1/3 sm:mr-2 text-xs sm:text-lg border-border-default sm:px-3 p-2 font-semibold capitalize rounded-3xl hover:bg-bg-hover transition-colors"
            >
              Message
            </button>
            <button
              title="follow"
              onClick={handelfollow}
              className="bg-black border-2 relative top-1/3 sm:mr-10 text-xs sm:text-lg mr-2 border-sky-200 sm:px-3 p-2 font-semibold capitalize rounded-3xl ml-auto"
            >
              <label className="mx-2">
                {profileuserdata?.follower?.includes(userdata?.uid) ? (
                  <>following</>
                ) : (
                  <>follow</>
                )}
              </label>
            </button>
          </div>
        )}
        </aside>

        {/* Right column: posts (tall) */}
        <div className="flex flex-col">
      {profileuserdata?.uid === userdata?.uid ? (
        <>
          {profileuserdata?.post?.length === 0 ? (
            <FirstPost setactive={setactive} />
          ) : (
            <Fragment>
              {profileuserdata?.post?.map((item, index) => {
                return <Post key={index} postdata={item} popup={true} />;
              })}
            </Fragment>
          )}{" "}
        </>
      ) : (
        <Fragment>
          {profileuserdata?.privacy ? (
            <Fragment>
              {profileuserdata?.follower?.includes(userdata?.uid) ? (
                <>
                  {profileuserdata?.post?.length === 0 ? (
                    <NoPost />
                  ) : (
                    <Fragment>
                      {profileuserdata?.post?.map((item, index) => {
                        return (
                          <Post key={index} postdata={item} popup={true} />
                        );
                      })}
                    </Fragment>
                  )}
                </>
              ) : (
                <Private />
              )}
            </Fragment>
          ) : (
            <Fragment>
              {profileuserdata?.post?.length === 0 ? (
                <NoPost />
              ) : (
                <Fragment>
                  {profileuserdata?.post?.map((item, index) => {
                    return <Post key={index} postdata={item} popup={true} />;
                  })}
                </Fragment>
              )}
            </Fragment>
          )}
        </Fragment>
      )}

      {!profileuserdata && !loading && (
        <div className="text-center my-10 font-serif text-2xl border-b border-gray-500 p-5 mx-5  ">
          profile doesnot exist
        </div>
      )}
        </div>
      </div>

      {active === "report" && (
        <Popupitem
          closefunction={() => {
            setactive("");
          }}
        >
          {profileuserdata?.report?.includes(userdata.uid) ? (
            <div className="text-xl text-center my-7 capitalize text-red-400 ">
              already reported
            </div>
          ) : (
            <Report
              setactive={setactive}
              setprofileuserdata={setprofileuserdata}
            />
          )}
        </Popupitem>
      )}
      {active === "block" && (
        <Popupitem
          closefunction={() => {
            setactive("");
          }}
        >
          {!profileuserdata?.block?.includes(userdata.uid) && (
            <div className="max-w-sm m-auto mb-10">
              <p className="text-xl text-center my-7 capitalize ">
                block {profileuserdata?.username}
              </p>
              <div className="flex justify-between">
                <button
                  onClick={() => {
                    setactive("");
                  }}
                  className="px-8 outline outline-neutral-800 capitalize m-auto p-2 text-base rounded-full hover:bg-gray-950 bg-gray-900 text-white"
                >
                  cancel
                </button>
                <button
                  onClick={() => {
                    setactive("");
                    toast.success(`blocked ${profileuserdata?.username}`);
                    setuserdata((prev) => ({
                      ...prev,
                      block: [profileuserdata?.uid],
                    }));
                  }}
                  className="px-8 capitalize m-auto p-2 rounded-full hover:bg-red-700 bg-red-600 text-base font-semibold text-white"
                >
                  block
                </button>
              </div>
            </div>
          )}
        </Popupitem>
      )}

      {active === "followers" && (
        <Popupitem
          closefunction={() => {
            setactive("");
          }}
        >
          <div className="flex w-full flex-col justify-center align-middle space-y-3">
            <h2 className="text-center text-xl sm:text-2xl my-5 ">followers</h2>
            <div className="m-auto min-w-max">
              {profileuserdata?.follower.map((profile, index) => {
                return <Profileviewbox key={index} profileusername={profile} />;
              })}
            </div>
          </div>
        </Popupitem>
      )}
      {active === "mutual" && (
        <Popupitem
          closefunction={() => {
            setactive("");
          }}
        >
          <div className="flex w-full flex-col justify-center align-middle space-y-3">
            <h2 className="text-center text-xl sm:text-2xl my-5 ">
              mutual friends
            </h2>
            <div className="m-auto">
              {mutual.map((profile, index) => {
                return <Profileviewbox key={index} profileusername={profile} />;
              })}
            </div>
          </div>
        </Popupitem>
      )}
      {active === "about" && (
        <Aboutprofile
          profiledata={profileuserdata}
          close={() => {
            setactive("");
          }}
        />
      )}

      {active === "following" && (
        <div>
          {
            <Popupitem
              closefunction={() => {
                setactive("");
              }}
            >
              <div className="flex flex-col justify-center align-middle space-y-3">
                <h2 className="text-center text-xl sm:text-2xl my-5 ">
                  following
                </h2>
                <div className="m-auto">
                  {profileuserdata.following.map((profile, index) => {
                    return (
                      <Profileviewbox key={index} profileusername={profile} />
                    );
                  })}
                </div>
              </div>
            </Popupitem>
          }
        </div>
      )}

      {active === "post" && (
        <Popupitem
          closefunction={() => {
            setactive("");
          }}
        >
          <div className="my-5">
            <Createpost
              toggle={() => {
                setactive("");
              }}
            />
          </div>
        </Popupitem>
      )}
    </div>
  );
};
