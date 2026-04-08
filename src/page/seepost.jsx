import React, { Fragment, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updatepost } from "../service/Auth/database";
import { usePostData, queryKeys } from "../hooks/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Post } from "../component/post";
import ProgressBar from "@badrap/bar-of-progress";
import { MdArrowBack as ArrowBack } from "react-icons/md";
import Addcomment from "../component/addcomment";
import NotFoundPost from "../layout/post/not-found";
import { Helmet } from "react-helmet-async";
import Loading from "../layout/loading";

export default function Seepost() {
  const { username, postid } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: post, isLoading: loader } = usePostData(username, postid);
  const cuusetpost = useCallback(
    async (updatedPost) => {
      if (updatedPost?.postedby) {
        await updatepost(updatedPost, updatedPost.postedby);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.postData(username, postid) });
    },
    [queryClient, username, postid]
  );

  return (
    <Fragment>
      <Helmet>
        <title>Post | {username} | NetMap</title>
        <meta name="description" content={`Post by ${username}`} />
        <link rel="canonical" href={`/profile/${username}/${postid}`} />
      </Helmet>
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-bg-default/80 backdrop-blur-xl border-b border-border-default">
        <div className="flex items-center gap-4 h-[53px] px-4">
          <button
            onClick={() => navigate("/home")}
            className="p-2 rounded-full hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowBack className="text-xl" />
          </button>
          <h1 className="text-xl font-bold text-text-primary">Post</h1>
        </div>
      </div>

      {post === undefined && <NotFoundPost />}

      {loader && (
        <div className="flex items-center justify-center py-20">
          <Loading />
        </div>
      )}

      {!loader && post && (
        <div className="border-b border-border-default px-[25%]">
          <Post postdata={post} popup={false} />
          <Addcomment cuupost={post} cuusetpost={cuusetpost} />
        </div>
      )}
    </Fragment>
  );
}
