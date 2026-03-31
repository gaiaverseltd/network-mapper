import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { auth, getGoogleRedirectResult } from "../Auth";
import { useNavigate } from "react-router-dom";
import { get_userdata, updateuserdata } from "../Auth/database";
import {
  useAllProfiles,
  useNotifications,
  useUnreadMessageCount,
  queryKeys,
} from "../../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import image from "/src/assets/defaultprofileimage.png";
import { toast } from "react-toastify";

const defaultContextValue = {
  postpopup: false,
  defaultprofileimage: null,
  userdata: null,
  profile: null,
  isAdmin: false,
  handlesave: () => {},
  GetAllusers: [],
  userNotifications: [],
  setuserNotifications: () => {},
  unreadMessageCount: 0,
  refreshUnreadMessageCount: () => {},
  delete_post: async () => {},
  setuserdata: () => {},
  togglepost: () => {},
};

export const UserDataContext = createContext(defaultContextValue);

export const UserDataProvider = ({ children, value, setvalue = () => {} }) => {
  const [postpopup, setpostpopup] = useState(false);
  const [userdata, setuserdata] = useState(value ?? null);
  const setuserNotifications = () => {}; // No-op; notifications come from useNotifications
  const queryClient = useQueryClient();
  const { data: GetAllusers = [] } = useAllProfiles({ enabled: !!userdata?.uid });
  const { data: userNotifications = [] } = useNotifications(userdata?.uid);
  const { data: unreadMessageCount = 0 } = useUnreadMessageCount(userdata?.uid);
  const [defaultprofileimage, setdefaultprofileimage] = useState(image);

  const delete_post = useCallback(async (postid) => {
    if (userdata) {
      try {
        // Update local state
        setuserdata((prev) => ({
          ...prev,
          post: prev.post.filter((p) => {
            return p.postid !== postid;
          }),
        }));
        
        // Trigger event to refresh home page
        window.dispatchEvent(new CustomEvent('postDeleted', { detail: { postid } }));
        
        toast.success("Post Deleted");
      } catch (error) {
        console.error("Error deleting post:", error);
        toast.error("Failed to delete post");
      }
    }
  }, [userdata]);

  const handlesave = useCallback(
    (post) => {
      if (!auth?.currentUser) {
        toast.error("Login required");
        return;
      }

      if (
        userdata?.saved.some((savedpost) => post?.postid === savedpost?.postid)
      ) {
        setuserdata((prev) => ({
          ...prev,
          saved: prev.saved.filter(
            (savedpost) => post?.postid !== savedpost?.postid,
          ),
        }));
        toast.success("Removed from your Bookmark");
      } else {
        setuserdata((prev) => ({
          ...prev,
          saved: [
            ...prev.saved,
            {
              postedby: post?.postedby,
              postid: post?.postid,
            },
          ],
        }));
        toast.success("Added to your Bookmark");
      }
    },
    [auth, userdata],
  );

  const navigate = useNavigate();
  const hadUserRef = useRef(false);
  const redirectResultAttemptedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      const uid = user?.uid ?? null;
      const wasSignedOut = hadUserRef.current && !user;
      if (user) hadUserRef.current = true;
      else hadUserRef.current = false;

      try {
        if (user) {
          const data = await get_userdata(user.uid);
          if (data?.username) {
            setuserdata(data);
            typeof setvalue === "function" && setvalue(data);
          } else {
            navigate("/create-account");
          }
        } else {
          setuserdata(null);
          typeof setvalue === "function" && setvalue(null);
        }
      } catch (err) {
        console.error("[Auth] onAuthStateChanged error", err);
        if (user) {
          toast.error("Could not load your profile. Please try again.");
        }
        setuserdata(null);
        typeof setvalue === "function" && setvalue(null);
        setuserNotifications([]);
      }
    });

    // Complete Google redirect sign-in exactly once per page load (avoids Strict Mode double-call consuming the result).
    if (!redirectResultAttemptedRef.current) {
      redirectResultAttemptedRef.current = true;
      getGoogleRedirectResult()
        .then((result) => {
          if (result?.user) {
            console.log("[Auth] Google redirect sign-in completed for", result.user.uid);
          }
        })
        .catch((err) => {
          console.error("[Auth] Google redirect error", err?.code, err?.message, err);
          const code = err?.code || "";
          if (code === "auth/operation-not-allowed") {
            toast.error("Google sign-in is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.");
          } else if (code === "auth/unauthorized-domain") {
            toast.error("This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.");
          } else if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
            // User cancelled – no toast
          } else if (code === "auth/credential-already-in-use") {
            toast.error("This Google account is already linked to another sign-in method.");
          } else if (err?.message) {
            toast.error("Google sign-in failed: " + err.message);
          }
        });
    }

    return () => unsubscribe();
  }, [navigate, setvalue]);

  useEffect(() => {
    if (!userdata?.uid) return;
    updateuserdata(userdata).catch((err) => console.error("Userdata sync error:", err));
  }, [userdata]);

  const togglepost = () => {
    setpostpopup(!postpopup);
  };

  const refreshUnreadMessageCount = useCallback(() => {
    if (!userdata?.uid) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.unreadMessageCount(userdata.uid) });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications(userdata.uid) });
  }, [userdata?.uid, queryClient]);

  const contextValue = {
    postpopup,
    defaultprofileimage,
    userdata,
    profile: userdata,
    isAdmin: !!userdata?.isAdmin,
    handlesave,
    GetAllusers,
    userNotifications,
    setuserNotifications,
    unreadMessageCount,
    refreshUnreadMessageCount,
    delete_post,
    setuserdata,
    togglepost,
  };

  return (
    <UserDataContext.Provider value={contextValue}>
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserdatacontext = () => {
  const value = useContext(UserDataContext);
  return value ?? defaultContextValue;
};
