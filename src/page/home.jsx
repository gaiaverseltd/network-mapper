import { Fragment, useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Createpost } from "../component/createpost";
import { useAllPosts } from "../hooks/queries";
import { Post } from "../component/post";
import { auth } from "../service/Auth";
import { Helmet } from "react-helmet-async";
import { useUserdatacontext } from "../service/context/usercontext";
import Loading from "../layout/loading";

export const Home = () => {
  const [active, setactive] = useState("");
  const { userdata } = useUserdatacontext();
  const { data: allpostdata, isLoading: loading, refetch } = useAllPosts();

  const post = useMemo(() => {
    if (!allpostdata) return [];
    if (active === "follow" && userdata?.following?.length > 0) {
      return allpostdata.filter((p) => userdata.following.includes(p.postedby));
    }
    return allpostdata;
  }, [allpostdata, active, userdata?.following]);

  useEffect(() => {
    const handlePostCreated = () => {
      setTimeout(() => refetch(), 500);
    };
    const handlePostDeleted = () => {
      setTimeout(() => refetch(), 500);
    };
    window.addEventListener("postCreated", handlePostCreated);
    window.addEventListener("postDeleted", handlePostDeleted);
    return () => {
      window.removeEventListener("postCreated", handlePostCreated);
      window.removeEventListener("postDeleted", handlePostDeleted);
    };
  }, [refetch]);

  const handleTabChange = (tab) => {
   
    setactive(tab);
  };

  return (
    <Fragment>
      <Helmet>
        <title>Home | NetMap</title>
      </Helmet>
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-bg-default/80 backdrop-blur-xl border-b border-border-default">
       
        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-border-default">
          <button
                onClick={() => handleTabChange("")}
            className={` h-[53px] relative font-semibold text-[15px] transition-colors duration-200 ${
                  active === ""
                    ? "text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
            For you
                {active === "" && (
                  <motion.div
                    layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-accent-500 rounded-full"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
          </button>
              {auth?.currentUser && (
            <button
                  onClick={() => handleTabChange("follow")}
              className={` h-[53px] relative font-semibold text-[15px] transition-colors duration-200 ${
                    active === "follow"
                      ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                  }`}
                >
                  Following
                  {active === "follow" && (
                    <motion.div
                      layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-1 bg-accent-500 rounded-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
            </button>
              )}
          </div>
        </div>

      {/* Create Post */}
        <div className=" t">
            <Createpost />
        </div>

        {/* Posts Feed */}
          {loading && (
            <div className="flex w-full items-center justify-center py-12">
              <Loading />
            </div>
          )}
      
          {post?.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <p className="text-text-secondary text-[15px]">No posts yet</p>
        </div>
          )}

      <div className="flex flex-col space-y-1 divide-y divide-border-default px-[25%]">
            {post?.map((postarray, index) => (
              <Post key={postarray?.postid || index} postdata={postarray} popup={true} />
            ))}
      </div>
    </Fragment>
  );
};
