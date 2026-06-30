"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit2, Plus, Trash2 } from "lucide-react";

import { VariantForm } from "@/components/admin/variant-form";

export default function ProductVariantsPage({ params }) {
  const router = useRouter();
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingVariant, setEditingVariant] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setProductId(p.id);
      loadVariants(p.id);
    });
  }, [params]);

  async function loadVariants(id) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/variants`);
      if (res.ok) {
        const { data } = await res.json();
        setVariants(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(variantId) {
    if (!confirm("Are you sure you want to delete this variant?")) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants/${variantId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadVariants(productId);
      } else {
        alert("Failed to delete variant");
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!productId || loading) {
    return <div className="p-8 text-center text-sm text-[var(--muted-foreground)]">Loading...</div>;
  }

  return (
    <main className="app-shell min-h-screen bg-[var(--background-start)]">
      <header className="app-bar flex items-center gap-4 px-5 py-4">
        <button onClick={() => router.push("/admin?tab=products")} className="app-icon-button p-2">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Product Variants</h1>
      </header>

      <section className="p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Manage Variants</h2>
          <button
            onClick={() => {
              setEditingVariant(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[var(--action)] px-4 py-2 text-sm font-semibold text-[var(--action-foreground)]"
          >
            <Plus className="size-4" />
            Add Variant
          </button>
        </div>

        {showForm && (
          <div className="mb-8 rounded-2xl bg-[var(--surface)] p-6 shadow-sm border border-white/20">
            <h3 className="mb-4 text-lg font-semibold">{editingVariant ? "Edit Variant" : "New Variant"}</h3>
            <VariantForm
              productId={productId}
              initialData={editingVariant}
              onSuccess={() => {
                setShowForm(false);
                setEditingVariant(null);
                loadVariants(productId);
              }}
              onCancel={() => {
                setShowForm(false);
                setEditingVariant(null);
              }}
            />
          </div>
        )}

        <div className="grid gap-4">
          {variants.length === 0 && !showForm ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-[var(--muted-foreground)]">
              No variants found. Add one to get started.
            </div>
          ) : (
            variants.map((variant) => (
              <div key={variant.id} className="flex flex-col gap-4 rounded-[1.2rem] bg-[var(--surface)] p-5 sm:flex-row sm:items-center justify-between shadow-sm border border-white/20">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)]">{variant.name}</h3>
                  <p className="text-sm text-[var(--muted-foreground)]">SKU: {variant.sku}</p>
                </div>
                <div className="flex gap-8 text-sm">
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Price</span>
                    <span className="font-medium">${Number(variant.price).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Cost</span>
                    <span className="font-medium">${Number(variant.costPrice || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingVariant(variant);
                      setShowForm(true);
                    }}
                    className="app-icon-button p-2"
                  >
                    <Edit2 className="size-4" />
                  </button>
                  <button onClick={() => handleDelete(variant.id)} className="app-icon-button p-2 text-rose-500">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
