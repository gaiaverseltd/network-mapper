import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useUserdatacontext } from "../service/context/usercontext";
import {
  createTagCategory,
  updateTagCategory,
  deleteTagCategory,
  createTag,
  updateTag,
  deleteTag,
  getTagsByCategoryId,
} from "../service/Auth/database";
import { useTagCategories } from "../hooks/queries";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import Button from "../ui/button";
import { MdLabel as LabelIcon } from "react-icons/md";
import { MdAdd as AddIcon } from "react-icons/md";
import { MdDelete as DeleteIcon } from "react-icons/md";
import { MdEdit as EditIcon } from "react-icons/md";
import { MdExpandMore as ExpandMoreIcon } from "react-icons/md";
import { MdExpandLess as ExpandLessIcon } from "react-icons/md";

const emptyCategory = { name: "", slug: "", order: "" };
const emptyTag = { label: "" };

export const AdminTags = () => {
  const navigate = useNavigate();
  const { userdata, isAdmin } = useUserdatacontext();
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading: loading } = useTagCategories({ enabled: !!isAdmin });
  const tagQueries = useQueries({
    queries: (categories || []).map((c) => ({
      queryKey: ["tags", c.id],
      queryFn: () => getTagsByCategoryId(c.id),
      enabled: !!c.id,
    })),
  });
  const tagsByCategory = (categories || []).reduce((acc, c, i) => {
    if (tagQueries[i]?.data) acc[c.id] = tagQueries[i].data;
    return acc;
  }, {});
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [tagFormByCategory, setTagFormByCategory] = useState({});
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingTagId, setEditingTagId] = useState(null);

  const loadAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tagCategories"] });
    queryClient.invalidateQueries({ queryKey: ["tags"] });
  }, [queryClient]);

  useEffect(() => {
    if (!userdata) return;
    if (!isAdmin) navigate("/home", { replace: true });
  }, [userdata, navigate, isAdmin]);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const name = (categoryForm.name ?? "").trim();
    if (!name) {
      toast.error("Category name is required.");
      return;
    }
    const nameLower = name.toLowerCase();
    if (categories.some((c) => (c.name ?? "").trim().toLowerCase() === nameLower)) {
      toast.warning("A category with this name already exists.");
      return;
    }
    const created = await createTagCategory({
      name,
      slug: (categoryForm.slug ?? "").trim() || undefined,
      order: categoryForm.order !== "" ? Number(categoryForm.order) : undefined,
    });
    if (created) {
      toast.success("Category created.");
      setCategoryForm(emptyCategory);
      setAddingCategory(false);
      loadAll();
    }
  };

  const handleUpdateCategory = async (e, id) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    const name = (categoryForm.name ?? "").trim();
    if (!name) {
      toast.error("Category name is required.");
      return;
    }
    const nameLower = name.toLowerCase();
    if (categories.some((c) => c.id !== id && (c.name ?? "").trim().toLowerCase() === nameLower)) {
      toast.warning("A category with this name already exists.");
      return;
    }
    try {
      await updateTagCategory(id, {
        name,
        slug: (categoryForm.slug ?? "").trim() || null,
        order: categoryForm.order !== "" ? Number(categoryForm.order) : undefined,
      });
      toast.success("Category updated.");
      setEditingCategoryId(null);
      setCategoryForm(emptyCategory);
      loadAll();
    } catch (_) {}
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Delete this category and all its tags?")) return;
    try {
      await deleteTagCategory(id);
      toast.success("Category deleted.");
      setExpandedCategoryId((prev) => (prev === id ? null : prev));
      loadAll();
    } catch (_) {}
  };

  const setTagForm = (categoryId, field, value) => {
    setTagFormByCategory((prev) => ({
      ...prev,
      [categoryId]: { ...(prev[categoryId] ?? emptyTag), [field]: value },
    }));
  };

  const handleCreateTag = async (e, categoryId) => {
    e.preventDefault();
    const form = tagFormByCategory[categoryId] ?? emptyTag;
    const label = (form.label ?? "").trim();
    if (!label) {
      toast.error("Tag label is required.");
      return;
    }
    const labelLower = label.toLowerCase();
    const existingInCategory = tagsByCategory[categoryId] ?? [];
    if (existingInCategory.some((t) => (t.label ?? "").trim().toLowerCase() === labelLower)) {
      toast.warning("A tag with this label already exists in this category.");
      return;
    }
    const created = await createTag({
      categoryId,
      label,
    });
    if (created) {
      toast.success("Tag created.");
      setTagFormByCategory((prev) => ({ ...prev, [categoryId]: emptyTag }));
      loadAll();
    }
  };

  const handleUpdateTag = async (e, tagId) => {
    e.preventDefault();
    const tag = Object.values(tagsByCategory).flat().find((t) => t.id === tagId);
    if (!tag) return;
    const form = tagFormByCategory[`tag:${tagId}`] ?? tag;
    const label = (form.label ?? "").trim();
    if (!label) {
      toast.error("Tag label is required.");
      return;
    }
    const labelLower = label.toLowerCase();
    const othersInCategory = (tagsByCategory[tag.categoryId] ?? []).filter((t) => t.id !== tagId);
    if (othersInCategory.some((t) => (t.label ?? "").trim().toLowerCase() === labelLower)) {
      toast.warning("A tag with this label already exists in this category.");
      return;
    }
    try {
      await updateTag(tagId, {
        label,
      });
      toast.success("Tag updated.");
      setEditingTagId(null);
      setTagFormByCategory((prev) => {
        const next = { ...prev };
        delete next[`tag:${tagId}`];
        return next;
      });
      loadAll();
    } catch (_) {}
  };

  const handleDeleteTag = async (tagId) => {
    if (!window.confirm("Delete this tag?")) return;
    try {
      await deleteTag(tagId);
      toast.success("Tag deleted.");
      setEditingTagId((prev) => (prev === tagId ? null : prev));
      loadAll();
    } catch (_) {}
  };

  const startEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setCategoryForm({
      name: cat.name ?? "",
      slug: cat.slug ?? "",
      order: cat.order ?? "",
    });
  };

  const startEditTag = (tag) => {
    setEditingTagId(tag.id);
    setTagFormByCategory((prev) => ({
      ...prev,
      [`tag:${tag.id}`]: {
        label: tag.label ?? "",
      },
    }));
  };

  if (!userdata) return null;
  if (!isAdmin) return null;

  return (
    <Fragment>
      <Helmet>
        <title>Tags | Admin | NetMap</title>
      </Helmet>

      <div className="sticky top-0 z-20 bg-bg-default/80 backdrop-blur-xl border-b border-border-default">
        <div className="flex items-center justify-between h-[53px] px-1">
          <div className="flex items-center gap-3">
            <LabelIcon className="text-2xl text-text-secondary" />
            <h1 className="text-xl font-bold text-text-primary">Tag categories & tags</h1>
          </div>
          {!addingCategory && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAddingCategory(true);
                setCategoryForm(emptyCategory);
              }}
            >
              <AddIcon className="inline-block mr-1" /> Add category
            </Button>
          )}
        </div>
      </div>

      <div className="w-full py-4 space-y-4">
        {loading ? (
          <div className="text-text-secondary">Loading…</div>
        ) : (
          <>
            {addingCategory && (
              <form
                onSubmit={handleCreateCategory}
                className="p-4 rounded-xl border border-border-default bg-bg-secondary space-y-3"
              >
                <h3 className="font-semibold text-text-primary">New category</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Name *"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary placeholder-text-tertiary focus:ring-2 focus:ring-accent-500"
                  />
                  <input
                    type="text"
                    placeholder="Slug (optional)"
                    value={categoryForm.slug}
                    onChange={(e) => setCategoryForm((p) => ({ ...p, slug: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary placeholder-text-tertiary focus:ring-2 focus:ring-accent-500"
                  />
                  <input
                    type="number"
                    placeholder="Order"
                    value={categoryForm.order}
                    onChange={(e) => setCategoryForm((p) => ({ ...p, order: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary placeholder-text-tertiary focus:ring-2 focus:ring-accent-500"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">Create</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddingCategory(false);
                      setCategoryForm(emptyCategory);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {categories.length === 0 && !addingCategory ? (
              <div className="py-12 text-center text-text-secondary">
                No tag categories yet. Add one to get started.
              </div>
            ) : (
              <ul className="space-y-3">
                {categories.map((cat) => (
                  <li
                    key={cat.id}
                    className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden"
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-bg-hover/50"
                      onClick={() =>
                        setExpandedCategoryId((prev) => (prev === cat.id ? null : cat.id))
                      }
                    >
                      <div className="flex items-center gap-3">
                        {expandedCategoryId === cat.id ? (
                          <ExpandLessIcon className="text-xl text-text-secondary" />
                        ) : (
                          <ExpandMoreIcon className="text-xl text-text-secondary" />
                        )}
                        <span className="font-semibold text-text-primary">{cat.name}</span>
                        {cat.slug && (
                          <span className="text-sm text-text-tertiary">({cat.slug})</span>
                        )}
                        <span className="text-sm text-text-tertiary">order: {cat.order ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {editingCategoryId === cat.id ? null : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditCategory(cat)}
                              className="p-2 rounded-full hover:bg-bg-tertiary text-text-secondary hover:text-text-primary"
                              title="Edit category"
                            >
                              <EditIcon className="text-lg" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-2 rounded-full hover:bg-status-error/20 text-text-secondary hover:text-status-error"
                              title="Delete category"
                            >
                              <DeleteIcon className="text-lg" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {editingCategoryId === cat.id && (
                      <form
                        onSubmit={(e) => handleUpdateCategory(e, cat.id)}
                        className="px-4 pb-4 flex flex-wrap items-end gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          placeholder="Name *"
                          value={categoryForm.name}
                          onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary w-40"
                        />
                        <input
                          type="text"
                          placeholder="Slug"
                          value={categoryForm.slug}
                          onChange={(e) => setCategoryForm((p) => ({ ...p, slug: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary w-32"
                        />
                        <input
                          type="number"
                          placeholder="Order"
                          value={categoryForm.order}
                          onChange={(e) => setCategoryForm((p) => ({ ...p, order: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary w-24"
                        />
                        <Button type="submit" size="sm">Save</Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingCategoryId(null);
                            setCategoryForm(emptyCategory);
                          }}
                        >
                          Cancel
                        </Button>
                      </form>
                    )}

                    {expandedCategoryId === cat.id && (
                      <div className="px-4 pb-4 border-t border-border-default pt-4" onClick={(e) => e.stopPropagation()}>
                        <form
                          onSubmit={(e) => handleCreateTag(e, cat.id)}
                          className="flex flex-wrap items-center gap-2 mb-4"
                        >
                          <input
                            type="text"
                            placeholder="New tag label *"
                            value={(tagFormByCategory[cat.id] ?? emptyTag).label}
                            onChange={(e) => setTagForm(cat.id, "label", e.target.value)}
                            className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary w-40"
                          />
                          <Button type="submit" size="sm">
                            <AddIcon className="inline mr-1" /> Add tag
                          </Button>
                        </form>

                        <ul className="space-y-2">
                          {(tagsByCategory[cat.id] ?? []).map((tag) => (
                            <li
                              key={tag.id}
                              className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-tertiary"
                            >
                              {editingTagId === tag.id ? (
                                <form
                                  onSubmit={(e) => handleUpdateTag(e, tag.id)}
                                  className="flex flex-wrap items-center gap-2 flex-1"
                                >
                                  <input
                                    type="text"
                                    placeholder="Label *"
                                    value={(tagFormByCategory[`tag:${tag.id}`] ?? tag).label}
                                    onChange={(e) =>
                                      setTagFormByCategory((p) => ({
                                        ...p,
                                        [`tag:${tag.id}`]: {
                                          ...(p[`tag:${tag.id}`] ?? tag),
                                          label: e.target.value,
                                        },
                                      }))
                                    }
                                    className="px-3 py-1.5 rounded bg-bg-secondary border border-border-default text-text-primary w-36"
                                  />
                                  <Button type="submit" size="sm">Save</Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingTagId(null);
                                      setTagFormByCategory((p) => {
                                        const next = { ...p };
                                        delete next[`tag:${tag.id}`];
                                        return next;
                                      });
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </form>
                              ) : (
                                <>
                                  <span className="text-text-primary">
                                    {tag.label}
                                    {tag.slug && (
                                      <span className="text-text-tertiary text-sm ml-2">({tag.slug})</span>
                                    )}
                                  </span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditTag(tag)}
                                      className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary"
                                      title="Edit tag"
                                    >
                                      <EditIcon className="text-lg" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTag(tag.id)}
                                      className="p-1.5 rounded hover:bg-status-error/20 text-text-secondary hover:text-status-error"
                                      title="Delete tag"
                                    >
                                      <DeleteIcon className="text-lg" />
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                        {(tagsByCategory[cat.id] ?? []).length === 0 && (
                          <p className="text-sm text-text-tertiary py-2">No tags in this category yet.</p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </Fragment>
  );
};
