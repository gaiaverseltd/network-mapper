import React from "react";
import { usePostDataByUid } from "../../hooks/queries";
import { Post } from "../../component/post";
import NotFoundPost from "./not-found";

export default function Postidtopost({ postid, postedby }) {
  const { data: post } = usePostDataByUid(postedby, postid);

  return (
    <section className=" w-full ">
      {post && <Post postdata={post} popup={true} />}
      {post === undefined && <NotFoundPost />}
    </section>
  );
}
