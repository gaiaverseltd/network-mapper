import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useUserdatacontext } from "../service/context/usercontext";
import {
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from "../service/Auth/database";
import { useCustomFields, useTagCategories } from "../hooks/queries";
import { toast } from "react-toastify";
import Button from "../ui/button";
import { Popupitem } from "../ui/popup";
import { MdEditAttributes as CustomFieldsIcon } from "react-icons/md";
import { MdAdd as AddIcon } from "react-icons/md";
import { MdDelete as DeleteIcon } from "react-icons/md";
import { MdEdit as EditIcon } from "react-icons/md";

const APPLIES_OPTIONS = [
  { value: "profile", label: "Profile only" },
  { value: "post", label: "Post only" },
  { value: "both", label: "Profile & Post" },
];
const TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "note", label: "Note (textarea)" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "phone", label: "Phone number" },
  { value: "lookup", label: "Lookup (tag category)" },
  { value: "file", label: "File" },
  { value: "image", label: "Image" },
];

const emptyField = {
  label: "",
  key: "",
  type: "text",
  appliesTo: "both",
  required: false,
  order: "",
  minLength: "",
  maxLength: "",
  tagCategoryId: "",
  showAsFilter: true,
  aiDescription: "",
};

export const AdminCustomFields = () => {
  const navigate = useNavigate();
  const { userdata, isAdmin } = useUserdatacontext();
  const { data: fields = [], isLoading: loading, refetch: loadAll } = useCustomFields({ enabled: !!isAdmin });
  const { data: tagCategories = [] } = useTagCategories({ enabled: !!isAdmin });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyField);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyField);
  useEffect(() => {
    if (!userdata) return;
    if (!isAdmin) navigate("/home", { replace: true });
  }, [userdata, isAdmin, navigate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const label = (form.label ?? "").trim();
    const key = (form.key ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!label || !key) {
      toast.error("Label and key are required.");
      return;
    }
    if (form.type === "lookup" && !(form.tagCategoryId ?? "").trim()) {
      toast.error("Tag category is required for Lookup fields.");
      return;
    }
    const created = await createCustomField({
      label,
      key,
      type: form.type || "text",
      appliesTo: form.appliesTo || "both",
      required: !!form.required,
      order: form.order !== "" ? Number(form.order) : 0,
      minLength: form.minLength !== "" ? Number(form.minLength) : undefined,
      maxLength: form.maxLength !== "" ? Number(form.maxLength) : undefined,
      tagCategoryId: form.type === "lookup" ? (form.tagCategoryId ?? "").trim() : undefined,
      showAsFilter: form.showAsFilter !== false,
      aiDescription: (form.aiDescription ?? "").trim() || undefined,
    });
    if (created) {
      toast.success("Custom field created.");
      setForm(emptyField);
      setAdding(false);
      loadAll();
    }
  };

  const startEdit = (field) => {
    setEditingId(field.id);
    setEditForm({
      label: field.label ?? "",
      key: field.key ?? "",
      type: field.type ?? "text",
      appliesTo: field.appliesTo ?? "both",
      required: !!field.required,
      order: field.order ?? "",
      minLength: field.minLength ?? "",
      maxLength: field.maxLength ?? "",
      tagCategoryId: field.tagCategoryId ?? "",
      showAsFilter: field.showAsFilter !== false,
      aiDescription: field.aiDescription ?? "",
    });
  };

  const handleUpdate = async (e, id) => {
    e.preventDefault();
    const label = (editForm.label ?? "").trim();
    const key = (editForm.key ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    if (!label || !key) {
      toast.error("Label and key are required.");
      return;
    }
    if (editForm.type === "lookup" && !(editForm.tagCategoryId ?? "").trim()) {
      toast.error("Tag category is required for Lookup fields.");
      return;
    }
    try {
      await updateCustomField(id, {
        label,
        key,
        type: editForm.type || "text",
        appliesTo: editForm.appliesTo || "both",
        required: !!editForm.required,
        order: editForm.order !== "" ? Number(editForm.order) : 0,
        minLength: editForm.minLength !== "" ? Number(editForm.minLength) : null,
        maxLength: editForm.maxLength !== "" ? Number(editForm.maxLength) : null,
        tagCategoryId: editForm.type === "lookup" ? (editForm.tagCategoryId ?? "").trim() : null,
        showAsFilter: editForm.showAsFilter !== false,
        aiDescription: (editForm.aiDescription ?? "").trim() || null,
      });
      toast.success("Custom field updated.");
      setEditingId(null);
      loadAll();
    } catch (_) {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this custom field? Existing values on profiles/posts will remain but no longer be editable via this field."))
      return;
    try {
      await deleteCustomField(id);
      toast.success("Custom field deleted.");
      if (editingId === id) setEditingId(null);
      loadAll();
    } catch (_) {}
  };

  return (
    <Fragment>
      <Helmet>
        <title>Custom fields | Admin | NetMap</title>
      </Helmet>

      <div className="sticky top-0 z-20 bg-bg-default/80 backdrop-blur-xl border-b border-border-default">
        <div className="flex items-center justify-between h-[53px] px-1">
          <div className="flex items-center gap-3">
            <CustomFieldsIcon className="text-2xl text-text-secondary" />
            <h1 className="text-xl font-bold text-text-primary">Custom fields</h1>
          </div>
          {!adding && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setAdding(true);
                setForm(emptyField);
              }}
            >
              <AddIcon className="inline-block mr-1" /> Add field
            </Button>
          )}
        </div>
      </div>

      <div className="w-full py-4 space-y-4">
        <p className="text-sm text-text-secondary">
          Custom fields can be used on profiles and/or posts. Define them here; they appear in edit profile and when creating a post.
        </p>

        {loading ? (
          <div className="text-text-secondary">Loading…</div>
        ) : (
          <>
            {adding && (
              <form
                onSubmit={handleCreate}
                className="p-4 rounded-xl border border-border-default bg-bg-secondary space-y-3"
              >
                <h3 className="font-semibold text-text-primary">New custom field</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Label *"
                    value={form.label}
                    onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary"
                  />
                  <input
                    type="text"
                    placeholder="Key * (e.g. department)"
                    value={form.key}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        key: e.target.value.trim().toLowerCase().replace(/\s+/g, "_"),
                      }))
                    }
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary"
                  />
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={form.appliesTo}
                    onChange={(e) => setForm((p) => ({ ...p, appliesTo: e.target.value }))}
                    className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary"
                  >
                    {APPLIES_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {form.type === "lookup" && (
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">Tag category *</label>
                    <select
                      value={form.tagCategoryId}
                      onChange={(e) => setForm((p) => ({ ...p, tagCategoryId: e.target.value }))}
                      className="px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary w-full max-w-xs"
                    >
                      <option value="">Select category</option>
                      {tagCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.required}
                      onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))}
                      className="rounded border-border-default"
                    />
                    <span className="text-sm text-text-primary">Required</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.showAsFilter !== false}
                      onChange={(e) => setForm((p) => ({ ...p, showAsFilter: e.target.checked }))}
                      className="rounded border-border-default"
                    />
                    <span className="text-sm text-text-primary">Show as search filter</span>
                  </label>
                </div>
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-text-secondary mb-1">AI description (optional)</label>
                  <textarea
                    placeholder="e.g. Job title or role within the organization. Used as context for AI to understand data in this field."
                    value={form.aiDescription ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, aiDescription: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary placeholder:text-text-tertiary text-sm resize-y"
                  />
                </div>
                <div className="col-span-full flex gap-2">
                  <input
                    type="number"
                    placeholder="Order"
                    value={form.order}
                    onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                    className="w-24 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Min length"
                    value={form.minLength}
                    onChange={(e) => setForm((p) => ({ ...p, minLength: e.target.value }))}
                    className="w-28 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Max length"
                    value={form.maxLength}
                    onChange={(e) => setForm((p) => ({ ...p, maxLength: e.target.value }))}
                    className="w-28 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Create
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAdding(false);
                      setForm(emptyField);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {fields.length === 0 && !adding ? (
              <div className="py-12 text-center text-text-secondary">
                No custom fields yet. Add one to use on profiles and posts.
              </div>
            ) : (
              <ul className="space-y-2">
                {fields.map((field) => (
                  <li
                    key={field.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-tertiary border border-border-default"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-text-primary">
                      <span className="font-medium">{field.label}</span>
                      <span className="text-sm text-text-tertiary">({field.key})</span>
                      <span className="text-sm text-text-tertiary">{field.type}</span>
                      <span className="text-sm text-text-tertiary">
                        {field.appliesTo === "both"
                          ? "Profile & Post"
                          : field.appliesTo === "profile"
                            ? "Profile"
                            : "Post"}
                      </span>
                      {field.type === "lookup" && field.tagCategoryId && (
                        <span className="text-sm text-text-tertiary">
                          → {tagCategories.find((c) => c.id === field.tagCategoryId)?.name ?? field.tagCategoryId}
                        </span>
                      )}
                      {field.required && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          Required
                        </span>
                      )}
                      {(field.minLength != null || field.maxLength != null) && (
                        <span className="text-sm text-text-tertiary">
                          length: {field.minLength ?? "0"}–{field.maxLength ?? "∞"}
                        </span>
                      )}
                      <span className="text-sm text-text-tertiary">order: {field.order ?? 0}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(field)}
                        className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary"
                        title="Edit"
                      >
                        <EditIcon className="text-lg" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(field.id)}
                        className="p-1.5 rounded hover:bg-status-error/20 text-text-secondary hover:text-status-error"
                        title="Delete"
                      >
                        <DeleteIcon className="text-lg" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {editingId && (
        <Popupitem closefunction={() => setEditingId(null)} contentClassName="max-w-2xl w-full">
          <div className="bg-bg-secondary rounded-xl border border-border-default shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border-default">
              <h2 className="text-lg font-bold text-text-primary">Edit custom field</h2>
              <p className="text-sm text-text-secondary mt-0.5">
                Update the field definition. Changes apply to profile and post forms.
              </p>
            </div>
            <form
              onSubmit={(e) => handleUpdate(e, editingId)}
              className="p-6 space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Label *</label>
                  <input
                    type="text"
                    placeholder="e.g. Department"
                    value={editForm.label}
                    onChange={(e) => setEditForm((p) => ({ ...p, label: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Key *</label>
                  <input
                    type="text"
                    placeholder="e.g. department"
                    value={editForm.key}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        key: e.target.value.trim().toLowerCase().replace(/\s+/g, "_"),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                  />
                  <p className="text-xs text-text-tertiary mt-1">Lowercase, no spaces (used in data)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Type</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Applies to</label>
                  <select
                    value={editForm.appliesTo}
                    onChange={(e) => setEditForm((p) => ({ ...p, appliesTo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                  >
                    {APPLIES_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editForm.type === "lookup" && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Tag category</label>
                  <select
                    value={editForm.tagCategoryId}
                    onChange={(e) => setEditForm((p) => ({ ...p, tagCategoryId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                  >
                    <option value="">Select category</option>
                    {tagCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">AI description (optional)</label>
                <textarea
                  placeholder="e.g. Job title or role within the organization. Used as context for AI to understand data in this field."
                  value={editForm.aiDescription ?? ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, aiDescription: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary placeholder:text-text-tertiary text-sm resize-y focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Order</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={editForm.order}
                    onChange={(e) => setEditForm((p) => ({ ...p, order: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Min length</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="—"
                    value={editForm.minLength}
                    onChange={(e) => setEditForm((p) => ({ ...p, minLength: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Max length</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="—"
                    value={editForm.maxLength}
                    onChange={(e) => setEditForm((p) => ({ ...p, maxLength: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editForm.required}
                    onChange={(e) => setEditForm((p) => ({ ...p, required: e.target.checked }))}
                    className="rounded border-border-default"
                  />
                  <span className="text-sm text-text-primary">Required</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.showAsFilter !== false}
                    onChange={(e) => setEditForm((p) => ({ ...p, showAsFilter: e.target.checked }))}
                    className="rounded border-border-default"
                  />
                  <span className="text-sm text-text-primary">Show as search filter</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4 border-t border-border-default">
                <Button type="submit" size="sm">
                  Save changes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </Popupitem>
      )}
    </Fragment>
  );
};
