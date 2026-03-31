import { useEffect, useState } from "react";
import { auth } from "../service/Auth";
import { MdImage as ImageIcon } from "react-icons/md";
import { MdClose as CloseIcon } from "react-icons/md";
import { MdInsertDriveFile as FileIcon } from "react-icons/md";
import { Getimagedownloadlink, uploadCustomFieldFile, getFileNameFromStorageUrl } from "../service/Auth/database";
import { useQueries } from "@tanstack/react-query";
import { useCustomFieldsForPost } from "../hooks/queries";
import { getTagsByCategoryId } from "../service/Auth/database";
import { toast } from "react-toastify";
import { useUserdatacontext } from "../service/context/usercontext";
import Createid from "../service/utiles/createid";
import ProgressBar from "@badrap/bar-of-progress";
import Avatar from "../ui/avatar";
import Button from "../ui/button";

export const Createpost = ({ toggle = () => {} }) => {
  const { userdata, setuserdata, defaultprofileimage } = useUserdatacontext();
  const [posttext, setposttext] = useState("");
  const [postmedia, setpostmedia] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const { data: postCustomFields = [] } = useCustomFieldsForPost();
  const [postCustomFieldValues, setPostCustomFieldValues] = useState({});
  const lookups = postCustomFields.filter((f) => f.type === "lookup" && f.tagCategoryId);
  const tagQueries = useQueries({
    queries: lookups.map((f) => ({
      queryKey: ["tags", f.tagCategoryId],
      queryFn: () => getTagsByCategoryId(f.tagCategoryId),
      enabled: !!f.tagCategoryId,
    })),
  });
  const lookupTagsByKey = lookups.reduce((acc, f, i) => {
    if (tagQueries[i]?.data) acc[f.key] = tagQueries[i].data;
    return acc;
  }, {});
  const [uploadingFieldKey, setUploadingFieldKey] = useState(null);

  const progress = new ProgressBar();

  useEffect(() => {
    return () => {
      progress.finish();
    };
  }, []);
  const handelpost = async () => {
    if (auth.currentUser) {
      setIsPosting(true);
      progress.start();
      
      try {
        var url = postmedia ? await Getimagedownloadlink(postmedia) : "";
        const id = Createid();
        const customFields = {};
        postCustomFields.forEach((f) => {
          const v = postCustomFieldValues[f.key];
          if (v != null && String(v).trim() !== "") customFields[f.key] = String(v).trim();
        });
        const newPost = {
          content: posttext,
          likes: [],
          comments: [],
          postedby: auth?.currentUser?.uid,
          postedat: new Date(),
          views: 0,
          postid: id,
          img: url,
          ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
        };
        
        // Update userdata with new post
        const updatedPosts = [newPost, ...(userdata.post || [])];
        setuserdata((pre) => ({ ...pre, post: updatedPosts }));
        
        setposttext("");
        setpostmedia(null);
        setPostCustomFieldValues({});
        toggle();
        toast.success("Successfully posted!");
        
        // Trigger a custom event to refresh home page posts
        window.dispatchEvent(new CustomEvent('postCreated', { detail: newPost }));
      } catch (error) {
        toast.error("Failed to post. Please try again.");
        console.error("Error posting:", error);
      } finally {
        setIsPosting(false);
        progress.finish();
      }
    } else {
      toast.error("Please login first");
    }
  };

  const characterCount = posttext.length;
  const maxCharacters = 280;
  const canPost = (posttext.trim() !== "" || postmedia) && !isPosting && characterCount <= maxCharacters;

  return (
    <div className="flex gap-3 px-4 py-3 border-b border-border-default">
      {/* Avatar */}
      <Avatar
        src={userdata?.profileImageURL}
        alt={userdata?.name || "Profile"}
        size="md"
        fallback={defaultprofileimage}
      />

      {/* Input Area */}
      <div className="flex-1 min-w-0">
        <textarea
          value={posttext}
          onChange={(e) => setposttext(e.target.value)}
          placeholder="What's happening?"
          className="w-full bg-transparent text-[20px] text-text-primary placeholder:text-text-secondary resize-none outline-none min-h-[100px] mb-3"
          maxLength={maxCharacters}
          rows={4}
        />

        {/* Image Preview */}
        {postmedia && (
          <div className="relative rounded-2xl overflow-hidden border border-border-default mb-3 group">
            <img
              src={URL.createObjectURL(postmedia)}
              alt="Preview"
              className="w-full max-h-[400px] object-cover"
            />
            <button
              type="button"
              onClick={() => setpostmedia(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <CloseIcon className="text-xl" />
            </button>
          </div>
        )}

        {/* Post custom fields */}
        {postCustomFields.length > 0 && (
          <div className="space-y-2 mb-3">
            {postCustomFields.map((field) => (
              <div key={field.id} className="flex flex-col gap-1">
                <label className="text-xs text-text-secondary">
                  {field.label}
                  {field.required && " *"}
                </label>
                {field.type === "number" ? (
                  <input
                    type="number"
                    value={postCustomFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setPostCustomFieldValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm w-full max-w-xs"
                    required={!!field.required}
                  />
                ) : field.type === "date" ? (
                  <input
                    type="date"
                    value={postCustomFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setPostCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm w-full max-w-xs"
                    required={!!field.required}
                  />
                ) : field.type === "url" ? (
                  <input
                    type="url"
                    placeholder="https://"
                    value={postCustomFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setPostCustomFieldValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value.trim(),
                      }))
                    }
                    className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm w-full max-w-xs"
                    required={!!field.required}
                  />
                ) : field.type === "phone" ? (
                  <input
                    type="tel"
                    placeholder="e.g. +1 234 567 8900"
                    value={postCustomFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setPostCustomFieldValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value.trim(),
                      }))
                    }
                    className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm w-full max-w-xs"
                    required={!!field.required}
                  />
                ) : field.type === "lookup" ? (
                  <select
                    value={postCustomFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setPostCustomFieldValues((prev) => ({
                        ...prev,
                        [field.key]: e.target.value || null,
                      }))
                    }
                    className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm w-full max-w-xs"
                    required={!!field.required}
                  >
                    <option value="">Select {field.label}</option>
                    {(lookupTagsByKey[field.key] ?? []).map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "note" ? (
                  <textarea
                    value={postCustomFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setPostCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm w-full min-h-[80px]"
                    required={!!field.required}
                    minLength={field.minLength ?? undefined}
                    maxLength={field.maxLength ?? undefined}
                    rows={3}
                  />
                ) : field.type === "file" || field.type === "image" ? (
                  <div className="space-y-1">
                    {!postCustomFieldValues[field.key] && (
                      <input
                        type="file"
                        accept={field.type === "image" ? "image/*" : "*"}
                        disabled={!!uploadingFieldKey}
                        className="text-sm text-text-primary file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-bg-tertiary file:text-text-primary"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingFieldKey(field.key);
                          progress.start();
                          try {
                            const url = await uploadCustomFieldFile(file, field.key);
                            if (url)
                              setPostCustomFieldValues((prev) => ({ ...prev, [field.key]: url }));
                          } catch (_) {}
                          setUploadingFieldKey(null);
                          progress.finish();
                          e.target.value = "";
                        }}
                      />
                    )}
                    {postCustomFieldValues[field.key] && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {field.type === "image" ? (
                          <>
                            <a
                              href={postCustomFieldValues[field.key]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0"
                            >
                              <img
                                src={postCustomFieldValues[field.key]}
                                alt={field.label}
                                className="h-12 w-12 object-cover rounded border border-border-default"
                              />
                            </a>
                            <span className="text-xs text-text-secondary truncate max-w-[160px]">
                              {getFileNameFromStorageUrl(postCustomFieldValues[field.key])}
                            </span>
                          </>
                        ) : (
                          <a
                            href={postCustomFieldValues[field.key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-accent-500 hover:underline min-w-0"
                          >
                            <FileIcon className="flex-shrink-0 text-lg text-text-secondary" />
                            <span className="truncate max-w-[160px]">
                              {getFileNameFromStorageUrl(postCustomFieldValues[field.key])}
                            </span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setPostCustomFieldValues((prev) => ({ ...prev, [field.key]: null }))
                          }
                          className="text-xs text-text-tertiary hover:text-status-error"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {uploadingFieldKey === field.key && (
                      <span className="text-xs text-text-tertiary">Uploading…</span>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={postCustomFieldValues[field.key] ?? ""}
                    onChange={(e) =>
                      setPostCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="px-3 py-1.5 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm w-full max-w-xs"
                    required={!!field.required}
                    minLength={field.minLength ?? undefined}
                    maxLength={field.maxLength ?? undefined}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bottom Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-border-default">
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="fileInput"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files[0]) {
                  setpostmedia(e.target.files[0]);
                }
              }}
            />
            <button
              type="button"
              onClick={() => document.getElementById("fileInput").click()}
              className="p-2 rounded-full hover:bg-accent-500/10 text-accent-500 transition-colors"
            >
              <ImageIcon className="text-xl" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {characterCount > 0 && (
              <div className="flex items-center gap-2">
                <span
                  className={`text-[13px] ${
                    characterCount > maxCharacters * 0.9
                      ? characterCount >= maxCharacters
                        ? "text-status-error"
                        : "text-status-warning"
                      : "text-text-secondary"
                  }`}
                >
                  {characterCount}
                </span>
                <div className="w-[2px] h-[2px] rounded-full bg-border-default" />
                <span className="text-[13px] text-text-secondary">{maxCharacters}</span>
              </div>
            )}
            <Button
              type="button"
              onClick={handelpost}
              disabled={!canPost}
              size="sm"
              variant="primary"
            >
              {isPosting ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
