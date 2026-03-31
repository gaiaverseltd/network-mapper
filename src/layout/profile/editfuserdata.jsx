import React, { useEffect, useState } from "react";
import { useUserdatacontext } from "../../service/context/usercontext";
import ProgressBar from "@badrap/bar-of-progress";
import { MdLinkedCamera as LinkedCameraIcon } from "react-icons/md";
import { MdInsertDriveFile as FileIcon } from "react-icons/md";
import { toast } from "react-toastify";
import {
  Getimagedownloadlink,
  check_username_is_exist,
  getTagsByCategoryId,
  uploadCustomFieldFile,
  getFileNameFromStorageUrl,
  uploadProfileResourceFile,
  updateuserdata,
} from "../../service/Auth/database";
import { useClassificationTagOptions, useCustomFieldsForProfile } from "../../hooks/queries";
import { useQueries } from "@tanstack/react-query";
import { auth } from "../../service/Auth";
import ImportedProfileSummary, { getImportedSummaryRows } from "../../component/imported-profile-summary";

// US states + DC for state select when country is United States (matches seed-country-state-tags)
const US_STATE_OPTIONS = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming", "District of Columbia",
];

export default function Editfuserdata({ toggle = () => {} }) {
  const progress = new ProgressBar();
  const { userdata, setuserdata, defaultprofileimage, isAdmin } = useUserdatacontext();
  const [editformdata, seteditformdata] = useState({
    ...userdata,
    isAdmin: isAdmin ?? false,
    customFields: userdata?.customFields ?? {},
    profileResources: userdata?.profileResources ?? [],
  });
  const [isusernameexist, setisusernameexist] = useState(false);

  const [profileimage, setprofileimage] = useState(null);
  const [uploadingResourceId, setUploadingResourceId] = useState(null);
  const [profileimgurl, setprofileimgurl] = useState(
    userdata?.profileImageURL || defaultprofileimage,
  );
  const { data: classificationOptions = [] } = useClassificationTagOptions();
  const { data: profileCustomFields = [] } = useCustomFieldsForProfile();
  const lookups = profileCustomFields.filter((f) => f.type === "lookup" && f.tagCategoryId);
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

  useEffect(() => {
    return () => {
      progress.finish();
    };
  }, []);

  const handelchange = (e) => {
    const { name, value } = e.target;
    name === "bio"
      ? seteditformdata((prevData) => ({ ...prevData, [name]: value }))
      : seteditformdata((prevData) => ({ ...prevData, [name]: value.trim() }));
  };

  return (
    <section className="sm:p-8 p-4 w-full text-left text-base">
      {getImportedSummaryRows(userdata).length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-border-default bg-bg-tertiary max-w-2xl">
          <p className="text-sm text-text-secondary mb-3">
            Directory fields from your import are shown on your public profile below. Edit bio, photo, and editable fields in this form; full directory details stay in your profile view.
          </p>
          <ImportedProfileSummary profile={userdata} />
        </div>
      )}
      <form
        className="flex flex-col w-full"
        onSubmit={async (e) => {
          e.preventDefault();
          progress.start();
          if (profileimage) {
            try {
              const data = await Getimagedownloadlink(
                profileimage,
                auth.currentUser.uid,
              );
              if (data && !isusernameexist) {
                const updated = { ...editformdata, profileImageURL: data };
                setuserdata(() => updated);
                await updateuserdata(updated);
              }
              setprofileimgurl(data || profileimgurl);
              toast.success("Updated successfully");
            } catch (error) {
              console.error("Error fetching image download link:", error);
              toast.error("Failed to update profile");
            }
          } else {
            if (!isusernameexist && userdata !== editformdata) {
              setuserdata(editformdata);
              setprofileimgurl(editformdata.profileImageURL);
              toast.success("Updated successfully");
            }
          }
          progress.finish();
          toggle();
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 w-full">
        {/* Left column: photo + username, full name, date of birth */}
        <div className="flex flex-col space-y-4">
          <div className="relative flex flex-col items-center">
            <img
              title="click to change the profile photo"
              className="w-28 h-28 object-cover opacity-90 rounded-full"
              src={profileimgurl}
              onError={(e) => {
                e.target.src = defaultprofileimage;
              }}
            />
            <button
              type="button"
              onClick={() => document.getElementById("file").click()}
              className="absolute left-1/2 -translate-x-1/2 -bottom-2 p-2 rounded-full bg-bg-tertiary border border-border-default hover:bg-bg-hover text-text-primary"
              aria-label="Change profile photo"
            >
              <LinkedCameraIcon className="text-xl" />
            </button>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setprofileimage(file);
                  setprofileimgurl(URL.createObjectURL(file));
                }
              }}
              name="profileImageURL"
              id="file"
              className="hidden"
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-sm mx-3 text-text-primary">Username</label>
            <input
              type="text"
              name="username"
              placeholder="enter your unique username..."
              minLength={6}
              value={editformdata?.username}
              className="px-5 placeholder:capitalize bg-black border-2 border-gray-300 placeholder:text-neutral-500 sm:text-lg text-sm p-2 rounded-2xl"
              onChange={async (e) => {
                handelchange(e);
                const data = await check_username_is_exist(e.target.value.trim());
                const isValidInput = /^[a-z0-9]+$/.test(e.target.value.trim());
                if (data[1] || !isValidInput) {
                  setisusernameexist(true);
                  e.target.style.borderColor = "red";
                } else {
                  setisusernameexist(false);
                  e.target.style.borderColor = "white";
                }
              }}
              required
            />
          </div>
          {isusernameexist && (
            <label className="text-red-400 mx-3 capitalize">invalid username or already exist</label>
          )}

          <div className="flex flex-col space-y-1">
            <label className="text-sm mx-3 text-text-primary">Full Name</label>
            <input
              type="text"
              name="name"
              placeholder="full name..."
              value={editformdata?.name}
              className="px-5 placeholder:capitalize bg-black border-2 border-gray-300 placeholder:text-neutral-500 sm:text-lg text-sm p-2 rounded-2xl"
              onChange={handelchange}
              required
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-sm mx-3 text-text-primary">Date of Birth</label>
            <input
              type="date"
              name="age"
              value={editformdata?.dateofbirth}
              className="px-5 placeholder:capitalize bg-black border-2 border-gray-300 w-full placeholder:text-neutral-500 sm:text-lg text-sm p-2 rounded-2xl"
              onChange={handelchange}
              required
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="text-sm mx-3 text-text-primary">Bio</label>
            <textarea
              type="text"
              name="bio"
              placeholder="write about your experience, your favorite topics and more..."
              value={editformdata?.bio}
              className="px-5 placeholder:capitalize bg-black border-2 border-gray-300 placeholder:text-neutral-500 sm:text-lg text-sm p-2 rounded-2xl min-h-[100px]"
              onChange={handelchange}
            />
          </div>
        </div>

        {/* Right column: classification, custom fields, admin */}
        <div className="flex flex-col space-y-4">
          {classificationOptions.length > 0 && (
            <div className="flex flex-col space-y-1">
              <label className="text-sm mx-3 text-text-primary">Classification</label>
              <select
                name="classificationTagId"
                value={editformdata?.classificationTagId ?? ""}
                onChange={(e) =>
                  seteditformdata((prev) => ({
                    ...prev,
                    classificationTagId: e.target.value || null,
                  }))
                }
                className="px-5 bg-black border-2 border-gray-300 text-gray-200 sm:text-lg text-sm p-2 rounded-2xl w-full"
              >
                <option value="">Select classification</option>
                {classificationOptions.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {profileCustomFields.map((field) => {
            const isStateField = field.key === "state";
            const countryValue = (editformdata?.customFields?.country ?? "").trim();
            const isUnitedStates = countryValue.toLowerCase() === "united states";
            const stateShowSelect = isStateField && isUnitedStates;

            return (
            <div key={field.id} className="flex flex-col space-y-1">
              <label className="text-sm mx-3 text-text-primary">
                {field.label}
                {field.required && " *"}
              </label>
              {stateShowSelect ? (
                <select
                  value={editformdata?.customFields?.[field.key] ?? ""}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      customFields: {
                        ...(prev.customFields ?? {}),
                        [field.key]: e.target.value,
                      },
                    }))
                  }
                  className="px-5 bg-black border-2 border-gray-300 text-gray-200 sm:text-lg text-sm p-2 rounded-2xl w-full"
                  required={!!field.required}
                >
                  <option value="">Select {field.label}</option>
                  {US_STATE_OPTIONS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : field.type === "number" ? (
                <input
                  type="number"
                  value={editformdata?.customFields?.[field.key] ?? ""}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      customFields: {
                        ...(prev.customFields ?? {}),
                        [field.key]: e.target.value === "" ? "" : e.target.value,
                      },
                    }))
                  }
                  className="px-5 bg-black border-2 border-gray-300 text-gray-200 sm:text-lg text-sm p-2 rounded-2xl w-full"
                  required={!!field.required}
                />
              ) : field.type === "date" ? (
                <input
                  type="date"
                  value={editformdata?.customFields?.[field.key] ?? ""}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      customFields: {
                        ...(prev.customFields ?? {}),
                        [field.key]: e.target.value,
                      },
                    }))
                  }
                  className="px-5 bg-black border-2 border-gray-300 text-gray-200 sm:text-lg text-sm p-2 rounded-2xl w-full"
                  required={!!field.required}
                />
              ) : field.type === "url" ? (
                <input
                  type="url"
                  placeholder="https://"
                  value={editformdata?.customFields?.[field.key] ?? ""}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      customFields: {
                        ...(prev.customFields ?? {}),
                        [field.key]: e.target.value.trim(),
                      },
                    }))
                  }
                  className="px-5 bg-black border-2 border-gray-300 text-gray-200 sm:text-lg text-sm p-2 rounded-2xl w-full"
                  required={!!field.required}
                />
              ) : field.type === "phone" ? (
                <input
                  type="tel"
                  placeholder="e.g. +1 234 567 8900"
                  value={editformdata?.customFields?.[field.key] ?? ""}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      customFields: {
                        ...(prev.customFields ?? {}),
                        [field.key]: e.target.value.trim(),
                      },
                    }))
                  }
                  className="px-5 bg-black border-2 border-gray-300 text-gray-200 sm:text-lg text-sm p-2 rounded-2xl w-full"
                  required={!!field.required}
                />
              ) : field.type === "lookup" ? (
                <select
                  value={editformdata?.customFields?.[field.key] ?? ""}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      customFields: {
                        ...(prev.customFields ?? {}),
                        [field.key]: e.target.value || null,
                      },
                    }))
                  }
                  className="px-5 bg-black border-2 border-gray-300 text-gray-200 sm:text-lg text-sm p-2 rounded-2xl w-full"
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
                  value={editformdata?.customFields?.[field.key] ?? ""}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      customFields: {
                        ...(prev.customFields ?? {}),
                        [field.key]: e.target.value,
                      },
                    }))
                  }
                  className="px-5 bg-black border-2 border-gray-300 text-gray-200 sm:text-lg text-sm p-2 rounded-2xl w-full min-h-[100px]"
                  required={!!field.required}
                  minLength={field.minLength ?? undefined}
                  maxLength={field.maxLength ?? undefined}
                  rows={4}
                />
              ) : field.type === "file" || field.type === "image" ? (
                <div className="space-y-2">
                  {!editformdata?.customFields?.[field.key] && (
                    <input
                      type="file"
                      accept={field.type === "image" ? "image/*" : "*"}
                      disabled={!!uploadingFieldKey}
                      className="px-3 py-2 text-sm text-text-primary file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-bg-tertiary file:text-text-primary"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingFieldKey(field.key);
                        progress.start();
                        try {
                          const url = await uploadCustomFieldFile(file, field.key);
                          if (url)
                            seteditformdata((prev) => ({
                              ...prev,
                              customFields: {
                                ...(prev.customFields ?? {}),
                                [field.key]: url,
                              },
                            }));
                        } catch (_) {}
                        setUploadingFieldKey(null);
                        progress.finish();
                        e.target.value = "";
                      }}
                    />
                  )}
                  {editformdata?.customFields?.[field.key] && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {field.type === "image" ? (
                        <>
                          <a
                            href={editformdata.customFields[field.key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0"
                          >
                            <img
                              src={editformdata.customFields[field.key]}
                              alt={field.label}
                              className="h-16 w-16 object-cover rounded border border-border-default"
                            />
                          </a>
                          <span className="text-sm text-text-secondary truncate max-w-[200px]">
                            {getFileNameFromStorageUrl(editformdata.customFields[field.key])}
                          </span>
                        </>
                      ) : (
                        <a
                          href={editformdata.customFields[field.key]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-accent-500 hover:underline min-w-0"
                        >
                          <FileIcon className="flex-shrink-0 text-xl text-text-secondary" />
                          <span className="truncate max-w-[200px]">
                            {getFileNameFromStorageUrl(editformdata.customFields[field.key])}
                          </span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          seteditformdata((prev) => ({
                            ...prev,
                            customFields: {
                              ...(prev.customFields ?? {}),
                              [field.key]: null,
                            },
                          }))
                        }
                        className="text-xs text-text-tertiary hover:text-status-error"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {uploadingFieldKey === field.key && (
                    <span className="text-sm text-text-tertiary">Uploading…</span>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={editformdata?.customFields?.[field.key] ?? ""}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      customFields: {
                        ...(prev.customFields ?? {}),
                        [field.key]: e.target.value,
                      },
                    }))
                  }
                  className="px-5 bg-black border-2 border-gray-300 text-gray-200 sm:text-lg text-sm p-2 rounded-2xl w-full"
                  required={!!field.required}
                  minLength={field.minLength ?? undefined}
                  maxLength={field.maxLength ?? undefined}
                />
              )}
            </div>
            );
          })}

          {isAdmin && (
            <div className="flex flex-col space-y-1">
              <label className="text-sm mx-3 text-text-primary">Admin</label>
              <label className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isAdmin"
                  checked={!!editformdata?.isAdmin}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      isAdmin: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-gray-400">
                  Admin privileges (only visible to admins)
                </span>
              </label>
            </div>
          )}
        </div>
        </div>

        {/* Resources: files with name and description */}
        <div className="w-full mt-8 pt-6 border-t border-border-default">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Resources</h3>
          <p className="text-sm text-text-secondary mb-4">
            Add files (PDFs, documents, etc.) with a name and description. They will appear on your profile and be downloadable.
          </p>
          {(editformdata?.profileResources ?? []).map((resource) => (
            <div
              key={resource.id}
              className="p-4 rounded-xl border border-border-default bg-bg-secondary space-y-3 mb-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={resource.name ?? ""}
                  onChange={(e) =>
                    seteditformdata((prev) => ({
                      ...prev,
                      profileResources: prev.profileResources.map((r) =>
                        r.id === resource.id ? { ...r, name: e.target.value } : r
                      ),
                    }))
                  }
                  className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    className="hidden"
                    id={`resource-file-${resource.id}`}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingResourceId(resource.id);
                      progress.start();
                      try {
                        const url = await uploadProfileResourceFile(file, resource.id);
                        if (url)
                          seteditformdata((prev) => ({
                            ...prev,
                            profileResources: prev.profileResources.map((r) =>
                              r.id === resource.id ? { ...r, fileUrl: url } : r
                            ),
                          }));
                      } catch (_) {}
                      setUploadingResourceId(null);
                      progress.finish();
                      e.target.value = "";
                    }}
                  />
                  <label
                    htmlFor={`resource-file-${resource.id}`}
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-sm text-text-primary cursor-pointer hover:bg-bg-hover"
                  >
                    {resource.fileUrl ? "Replace file" : "Choose file"}
                  </label>
                  {resource.fileUrl && (
                    <a
                      href={resource.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-accent-500 hover:underline truncate max-w-[180px]"
                    >
                      <FileIcon className="flex-shrink-0" />
                      {resource.name || getFileNameFromStorageUrl(resource.fileUrl)}
                    </a>
                  )}
                  {uploadingResourceId === resource.id && (
                    <span className="text-sm text-text-tertiary">Uploading…</span>
                  )}
                </div>
              </div>
              <textarea
                placeholder="Description (optional)"
                value={resource.description ?? ""}
                onChange={(e) =>
                  seteditformdata((prev) => ({
                    ...prev,
                    profileResources: prev.profileResources.map((r) =>
                      r.id === resource.id ? { ...r, description: e.target.value } : r
                    ),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm min-h-[60px]"
                rows={2}
              />
              <button
                type="button"
                onClick={() =>
                  seteditformdata((prev) => ({
                    ...prev,
                    profileResources: prev.profileResources.filter((r) => r.id !== resource.id),
                  }))
                }
                className="text-sm text-status-error hover:underline"
              >
                Remove resource
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              seteditformdata((prev) => ({
                ...prev,
                profileResources: [
                  ...(prev.profileResources ?? []),
                  { id: `r-${Date.now()}`, name: "", description: "", fileUrl: "" },
                ],
              }))
            }
            className="px-4 py-2 rounded-lg border border-border-default text-sm text-text-primary hover:bg-bg-hover"
          >
            Add resource
          </button>
        </div>

        <div className="flex justify-center pt-8 w-full">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 rounded-full shadow-lg capitalize p-3 px-8 font-semibold"
          >
            Save profile
          </button>
        </div>
      </form>
    </section>
  );
}
