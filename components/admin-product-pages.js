"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  EyeOff,
  Image,
  ImagePlus,
  Info,
  Italic,
  Layers,
  Link2,
  List,
  PackageOpen,
  PackageSearch,
  Plus,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { useAppStore } from "@/components/app-store-provider";
import { BarcodeScannerModal, useCameraBarcodeScanner } from "@/components/shared/barcode-scanner";
import { AppSelect } from "@/components/ui/app-select";
import { cn, formatCurrency } from "@/lib/utils";

const PRODUCT_CATEGORY_OPTIONS = [
  "Fresh Picks",
  "Beverages",
  "Bundles",
  "Pantry",
  "Vegetables",
  "Fruits",
  "Organic Grains",
  "Fresh Herbs",
];

const PRODUCT_UNIT_OPTIONS = [
  "kg (Kilograms)",
  "lbs (Pounds)",
  "unit (Individual)",
  "bunch",
  "box",
  "gallon",
  "liter",
];

function ProductSectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--action)]/30 text-[var(--action)]">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">{title}</h2>
        {subtitle ? <p className="text-xs text-[var(--muted-foreground)]">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-8 w-14 items-center rounded-full p-1 transition-colors",
        checked ? "bg-[var(--action)]" : "bg-[var(--surface-quiet)]"
      )}
    >
      <span
        className={cn(
          "h-6 w-6 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-6" : "translate-x-0"
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product price / stock helpers
// ─────────────────────────────────────────────────────────────────────────────

function isVariantProduct(product) {
  return Boolean(
    product &&
    (product.hasVariants || (product.isVariant && product.variants && product.variants.length > 0)),
  );
}

function getProductDisplayPrice(product) {
  if (isVariantProduct(product) && Array.isArray(product.variants) && product.variants.length > 0) {
    const prices = product.variants.map((v) => Number(v.discountedPrice ?? v.price ?? 0));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min !== max) {
      return { isRange: true, min, max };
    }
    return { isRange: false, price: min };
  }
  const price = Number(product.discountPercent > 0 ? product.price * (1 - product.discountPercent / 100) : product.price);
  return { isRange: false, price };
}

function getProductMinPrice(product) {
  const display = getProductDisplayPrice(product);
  return display.isRange ? display.min : display.price;
}

function getProductTotalStock(product) {
  if (isVariantProduct(product) && Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
  }
  return Number(product.stock || 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable product image editor (preview + Cloudinary upload + URL field)
// ─────────────────────────────────────────────────────────────────────────────

function ProductImageEditor({ image, onImageChange, store }) {
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    setUploadMessage("Uploading media...");

    const url = await store.uploadAsset(file);

    if (url) {
      onImageChange(url);
      setUploadMessage("Upload complete.");
    } else {
      setUploadMessage("Upload failed. You can still paste an image URL manually.");
    }

    setUploading(false);
  }

  return (
    <div>
      <div className="group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-6 transition-all hover:border-[var(--action)]/50 hover:bg-[var(--action)]/5">
        {image ? (
          <div className="relative w-full overflow-hidden rounded-lg bg-[var(--surface-quiet)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Product preview" className="h-44 w-full object-cover" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-quiet)] text-[var(--muted-foreground)]">
              <Upload className="size-7" />
            </div>
            <p className="text-sm font-bold text-[var(--foreground)]">
              {uploading ? "Uploading..." : "Click to upload an image"}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">JPG, PNG, WEBP up to 10MB</p>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={uploading}
        />
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="ml-1 text-xs font-bold text-[var(--muted-foreground)]">Image URL</label>
          {image ? (
            <button
              type="button"
              onClick={() => onImageChange("")}
              className="inline-flex items-center gap-1 rounded-full bg-[#fa746f]/20 px-3 py-1 text-xs font-bold text-[#a83836] transition hover:brightness-95"
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          ) : null}
        </div>
        <input
          value={image}
          onChange={(event) => onImageChange(event.target.value)}
          placeholder="https://..."
          className="w-full rounded-full border-none bg-[var(--surface-soft)] px-5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
        />
      </div>

      {uploadMessage ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{uploadMessage}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add New Product  (matches Add_Product_with_variant.html)
// ─────────────────────────────────────────────────────────────────────────────

export function AdminAddProductPageView() {
  const store = useAppStore();
  const router = useRouter();

  const language = String(store.language || "en").toLowerCase();
  const isKhmer =
    language === "km" ||
    language.startsWith("km-") ||
    language.startsWith("kh");

  function t(english, khmer) {
    return isKhmer ? khmer : english;
  }

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [form, setForm] = useState({
    name: "",
    category: PRODUCT_CATEGORY_OPTIONS[0],
    sku: "",
    barcode: "",
    description: "",
    image: "",
    price: "0",
    discountPrice: "0",
    stock: "0",
    unit: PRODUCT_UNIT_OPTIONS[0],
    minStockAlert: "5",
  });

  const [variantsEnabled, setVariantsEnabled] = useState(false);

  const [variantOptions, setVariantOptions] = useState([
    {
      name: "Size",
      values: "Small, Medium, Large",
    },
  ]);

  const [variantRows, setVariantRows] = useState([
    {
      name: "Small",
      sku: "",
      priceAdjustment: "0",
      stock: "0",
    },
    {
      name: "Medium",
      sku: "",
      priceAdjustment: "0",
      stock: "0",
    },
    {
      name: "Large",
      sku: "",
      priceAdjustment: "0",
      stock: "0",
    },
  ]);

  const [tags, setTags] = useState([
    "Organic",
    "Vegan",
  ]);

  const [publishActive, setPublishActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const scanner = useCameraBarcodeScanner({
    onDetected: (code) => update("barcode", code),
  });

  function update(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploading(true);

    setUploadMessage(
      t(
        "Uploading media...",
        "កំពុងបញ្ចូលមេឌៀ...",
      ),
    );

    try {
      const url = await store.uploadAsset(file);

      if (url) {
        update("image", url);

        setUploadMessage(
          t(
            "Upload complete.",
            "ការបញ្ចូលបានបញ្ចប់។",
          ),
        );
      } else {
        setUploadMessage(
          t(
            "Upload failed. You can still paste an image URL manually.",
            "ការបញ្ចូលបានបរាជ័យ។ អ្នកនៅតែអាចបិទភ្ជាប់ URL រូបភាពដោយដៃ។",
          ),
        );
      }
    } catch (error) {
      setUploadMessage(
        t(
          "Upload failed. You can still paste an image URL manually.",
          "ការបញ្ចូលបានបរាជ័យ។ អ្នកនៅតែអាចបិទភ្ជាប់ URL រូបភាពដោយដៃ។",
        ),
      );
    } finally {
      setUploading(false);

      if (event.target) {
        event.target.value = "";
      }
    }
  }

  function rebuildVariantRowsFromOptions() {
    const firstOption = variantOptions[0];

    if (!firstOption) {
      setVariantRows([]);
      return;
    }

    const values = String(firstOption.values || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    setVariantRows(
      values.map((value, index) => {
        const existing = variantRows[index];

        return {
          name: value,
          sku: existing?.sku || "",
          priceAdjustment:
            existing?.priceAdjustment || "0",
          stock: existing?.stock || "0",
        };
      }),
    );
  }

  async function handleSaveProduct(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setSaveMessage("");

    try {
      const name = String(form.name || "").trim();

      if (!name) {
        setSaveMessage(
          t(
            "Product name is required.",
            "ត្រូវការឈ្មោះផលិតផល។",
          ),
        );
        setSaving(false);
        return;
      }

      const description =
        String(form.description || "").trim() ||
        "Fresh product from the catalog.";

      const imageUrl =
        String(form.image || "").trim() ||
        store.products[0]?.image ||
        "";

      const basePrice = Math.max(
        Number(form.price) || 0,
        0,
      );

      const discountPrice = Math.max(
        Number(form.discountPrice) || 0,
        0,
      );

      const discountPercent =
        basePrice > 0 &&
          discountPrice > 0 &&
          discountPrice < basePrice
          ? Math.round(
            ((basePrice - discountPrice) /
              basePrice) *
            100,
          )
          : 0;

      const stock = Math.max(
        Number(form.stock) || 0,
        0,
      );

      const minStockAlert = Math.max(
        Number(form.minStockAlert) || 0,
        0,
      );

      const productResult = await store.addProduct({
        name,
        category: form.category,
        description,
        image: imageUrl,
        price: basePrice,
        discountPercent,
        stock,
        sku: String(form.sku || "").trim(),
        barcode: String(form.barcode || "").trim(),
        minStockAlert,
        isActive: publishActive,
      });

      if (
        !productResult?.success ||
        !productResult?.product
      ) {
        setSaveMessage(
          productResult?.message ||
          t(
            "Unable to create product.",
            "មិនអាចបង្កើតផលិតផលបានទេ។",
          ),
        );

        setSaving(false);
        return;
      }

      const product = productResult.product;

      if (variantsEnabled && variantRows.length) {
        for (const row of variantRows) {
          if (!row.name) {
            continue;
          }

          const priceAdj =
            Number(row.priceAdjustment) || 0;

          const generatedSku =
            `${String(form.name || "PRODUCT")
              .replace(/\s+/g, "-")
              .toUpperCase()}-${String(row.name)
                .replace(/\s+/g, "-")
                .toUpperCase()}`;

          const payload = {
            name: row.name,
            sku: row.sku || generatedSku,
            price: Math.max(
              0,
              basePrice + priceAdj,
            ),
            costPrice: basePrice,
            discountPercent,
            stock: Math.max(
              Number(row.stock) || 0,
              0,
            ),
            isActive: publishActive,
          };

          const response = await fetch(
            `/api/admin/products/${product.id}/variants`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            },
          );

          const body = await response
            .json()
            .catch(() => ({}));

          if (!response.ok) {
            setSaveMessage(
              body?.error?.message ||
              body?.error ||
              t(
                "Product created but some variants failed.",
                "ផលិតផលត្រូវបានបង្កើត ប៉ុន្តែវ៉ារ្យ៉ង់ខ្លះបរាជ័យ។",
              ),
            );

            setSaving(false);
            return;
          }
        }
      }

      setSaveMessage(
        t(
          "Product created successfully.",
          "បានបង្កើតផលិតផលដោយជោគជ័យ។",
        ),
      );

      window.setTimeout(() => {
        router.push("/admin?tab=products");
      }, 600);
    } catch (error) {
      setSaveMessage(
        error?.message ||
        t(
          "Unable to create product.",
          "មិនអាចបង្កើតផលិតផលបានទេ។",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const panelClass =
    "border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-[var(--shadow-card)] sm:p-6";

  const inputClass =
    "w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--action)] focus:ring-1 focus:ring-[var(--action)]";

  const labelClass =
    "mb-1.5 block break-words text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]";

  return (
    <form
      onSubmit={handleSaveProduct}
      className="mx-auto w-full min-w-0 max-w-[1440px] overflow-x-hidden px-3 pb-28 pt-4 sm:px-5 sm:pb-28 sm:pt-6 lg:px-8"
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      <div className="min-w-0 space-y-5 sm:space-y-6 [&_*]:rounded-none">
        <BarcodeScannerModal
          open={scanner.open}
          status={scanner.status}
          errorMessage={scanner.errorMessage}
          videoRef={scanner.videoRef}
          onClose={scanner.close}
          onRetry={scanner.retry}
          torchSupported={scanner.torchSupported}
          torchOn={scanner.torchOn}
          onToggleTorch={scanner.toggleTorch}
          onToggleCameraFacing={
            scanner.toggleCameraFacing
          }
        />

        {/* Breadcrumbs + Page Header */}
        <section className="min-w-0 border-b border-[var(--border-soft)] pb-5">
          <nav className="mb-2.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--muted-foreground)]">
            <span>{t("Admin", "អ្នកគ្រប់គ្រង")}</span>

            <ChevronRight className="size-3.5 shrink-0" />

            <span>
              {t(
                "Product Management",
                "ការគ្រប់គ្រងផលិតផល",
              )}
            </span>

            <ChevronRight className="size-3.5 shrink-0" />

            <span className="font-semibold text-[var(--action)]">
              {t(
                "Add New Product",
                "បន្ថែមផលិតផលថ្មី",
              )}
            </span>
          </nav>

          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {t(
                "Add New Product",
                "បន្ថែមផលិតផលថ្មី",
              )}
            </h1>

            <p className="mt-1 break-words text-xs text-[var(--muted-foreground)] sm:text-sm">
              {t(
                "Create a new premium entry for your inventory catalog.",
                "បង្កើតផលិតផលថ្មីសម្រាប់កាតាឡុកស្តុករបស់អ្នក។",
              )}
            </p>
          </div>
        </section>

        {/* Save Message */}
        {saveMessage ? (
          <div
            className={cn(
              "min-w-0 break-words px-4 py-3 text-xs font-semibold sm:px-5 sm:py-4 sm:text-sm",
              saveMessage.includes("successfully") ||
                saveMessage.includes("ជោគជ័យ")
                ? "bg-[var(--action-surface)] text-[var(--action-on-muted)]"
                : "bg-[#fa746f]/20 text-[#6e0a12]",
            )}
          >
            {saveMessage}
          </div>
        ) : null}

        {/* Main Form */}
        <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
          {/* Left Column */}
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-8 lg:gap-6">
            {/* Basic Information */}
            <section className={panelClass}>
              <ProductSectionHeader
                icon={Info}
                title={t(
                  "Basic Information",
                  "ព័ត៌មានមូលដ្ឋាន",
                )}
              />

              <div className="mt-5 min-w-0 space-y-4">
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-12">
                  <div className="min-w-0 sm:col-span-8">
                    <label className={labelClass}>
                      {t(
                        "Product Name",
                        "ឈ្មោះផលិតផល",
                      )}
                    </label>

                    <input
                      required
                      value={form.name}
                      onChange={(event) =>
                        update(
                          "name",
                          event.target.value,
                        )
                      }
                      placeholder={t(
                        "e.g. Organic Heirloom Tomatoes",
                        "ឧ. ប៉េងប៉ោះសរីរាង្គ",
                      )}
                      className={inputClass}
                    />
                  </div>

                  <div className="min-w-0 sm:col-span-4">
                    <label className={labelClass}>
                      {t("Category", "ប្រភេទ")}
                    </label>

                    <select
                      value={form.category}
                      onChange={(event) =>
                        update(
                          "category",
                          event.target.value,
                        )
                      }
                      className={cn(
                        inputClass,
                        "cursor-pointer appearance-none",
                      )}
                    >
                      {PRODUCT_CATEGORY_OPTIONS.map(
                        (option) => (
                          <option
                            key={option}
                            value={option}
                          >
                            {option}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>
                    SKU
                  </label>

                  <input
                    value={form.sku}
                    onChange={(event) =>
                      update(
                        "sku",
                        event.target.value,
                      )
                    }
                    placeholder="ATR-VEG-001"
                    className={cn(
                      inputClass,
                      "font-mono uppercase tracking-wider",
                    )}
                  />
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>
                    {t("Barcode", "បាកូដ")}
                  </label>

                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <input
                      value={form.barcode}
                      onChange={(event) =>
                        update(
                          "barcode",
                          event.target.value,
                        )
                      }
                      placeholder={t(
                        "Scan or enter barcode (e.g. 8850001234567)",
                        "ស្កេន ឬបញ្ចូលបាកូដ",
                      )}
                      inputMode="text"
                      autoComplete="off"
                      className={cn(
                        inputClass,
                        "font-mono tracking-wider",
                      )}
                    />

                    <button
                      type="button"
                      onClick={scanner.openScanner}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 bg-[var(--action)] px-5 py-2.5 text-xs font-semibold text-[var(--action-foreground)] transition-colors hover:opacity-90"
                    >
                      <ScanLine className="size-4 shrink-0" />

                      {t("Scan", "ស្កេន")}
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>
                    {t(
                      "Description",
                      "ពិពណ៌នា",
                    )}
                  </label>

                  <div className="min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)]">
                    <div className="flex min-w-0 flex-wrap items-center gap-1 border-b border-[var(--border-soft)] px-2 py-1.5">
                      <button
                        type="button"
                        className="flex size-7 shrink-0 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
                        title={t(
                          "Bold",
                          "អក្សរដិត",
                        )}
                        aria-label={t(
                          "Bold",
                          "អក្សរដិត",
                        )}
                      >
                        <Bold className="size-4" />
                      </button>

                      <button
                        type="button"
                        className="flex size-7 shrink-0 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
                        title={t(
                          "Italic",
                          "អក្សរទ្រេត",
                        )}
                        aria-label={t(
                          "Italic",
                          "អក្សរទ្រេត",
                        )}
                      >
                        <Italic className="size-4" />
                      </button>

                      <button
                        type="button"
                        className="flex size-7 shrink-0 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
                        title={t(
                          "Bullet List",
                          "បញ្ជីចំណុច",
                        )}
                        aria-label={t(
                          "Bullet List",
                          "បញ្ជីចំណុច",
                        )}
                      >
                        <List className="size-4" />
                      </button>

                      <div className="mx-1 h-4 w-px bg-[var(--surface-quiet)]/30" />

                      <button
                        type="button"
                        className="flex size-7 shrink-0 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] hover:text-[var(--foreground)]"
                        title={t(
                          "Link",
                          "តំណ",
                        )}
                        aria-label={t(
                          "Link",
                          "តំណ",
                        )}
                      >
                        <Link2 className="size-4" />
                      </button>
                    </div>

                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        update(
                          "description",
                          event.target.value,
                        )
                      }
                      placeholder={t(
                        "Describe the origin, flavor profile, and health benefits...",
                        "ពិពណ៌នាអំពីប្រភព រសជាតិ និងអត្ថប្រយោជន៍សុខភាព...",
                      )}
                      rows={5}
                      className="min-h-[150px] w-full resize-y bg-transparent px-3.5 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Pricing & Inventory */}
            <section className={panelClass}>
              <ProductSectionHeader
                icon={CircleDollarSign}
                title={t(
                  "Pricing & Inventory",
                  "តម្លៃ និងស្តុក",
                )}
              />

              <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className={labelClass}>
                    {t(
                      "Base Price (USD)",
                      "តម្លៃមូលដ្ឋាន (USD)",
                    )}
                  </label>

                  <div className="relative min-w-0">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--muted-foreground)]">
                      $
                    </span>

                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(event) =>
                        update(
                          "price",
                          event.target.value,
                        )
                      }
                      placeholder="0.00"
                      className={cn(
                        inputClass,
                        "pl-8 font-mono",
                      )}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>
                    {t(
                      "Discount Price (Optional)",
                      "តម្លៃបញ្ចុះ (ជាជម្រើស)",
                    )}
                  </label>

                  <div className="relative min-w-0">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--muted-foreground)]">
                      $
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.discountPrice}
                      onChange={(event) =>
                        update(
                          "discountPrice",
                          event.target.value,
                        )
                      }
                      placeholder="0.00"
                      className={cn(
                        inputClass,
                        "pl-8 font-mono",
                      )}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>
                    {t(
                      "Stock Quantity",
                      "បរិមាណស្តុក",
                    )}
                  </label>

                  <input
                    required
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(event) =>
                      update(
                        "stock",
                        event.target.value,
                      )
                    }
                    placeholder="0"
                    className={cn(
                      inputClass,
                      "font-mono",
                    )}
                  />
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>
                    {t(
                      "Measurement Unit",
                      "ឯកតារង្វាស់",
                    )}
                  </label>

                  <select
                    value={form.unit}
                    onChange={(event) =>
                      update(
                        "unit",
                        event.target.value,
                      )
                    }
                    className={cn(
                      inputClass,
                      "cursor-pointer appearance-none",
                    )}
                  >
                    {PRODUCT_UNIT_OPTIONS.map(
                      (option) => (
                        <option
                          key={option}
                          value={option}
                        >
                          {option}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="min-w-0 sm:col-span-2">
                  <label className={labelClass}>
                    {t(
                      "Low Stock Alert",
                      "ការជូនដំណឹងស្តុកទាប",
                    )}
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={form.minStockAlert}
                    onChange={(event) =>
                      update(
                        "minStockAlert",
                        event.target.value,
                      )
                    }
                    placeholder="5"
                    className={cn(
                      inputClass,
                      "font-mono",
                    )}
                  />
                </div>
              </div>
            </section>

            {/* Product Variants */}
            <section className={panelClass}>
              <div className="flex min-w-0 flex-col gap-4 border-b border-[var(--border-soft)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center border border-[#b7e3ff]/40 bg-[#b7e3ff]/30 text-[#38647c]">
                    <Layers className="size-4.5" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold tracking-wide text-[var(--foreground)] sm:text-base">
                      {t(
                        "Product Variants",
                        "វ៉ារ្យ៉ង់ផលិតផល",
                      )}
                    </h2>

                    <p className="mt-0.5 break-words text-xs text-[var(--muted-foreground)]">
                      {t(
                        "Manage different versions of this product (e.g., size, color).",
                        "គ្រប់គ្រងកំណែផ្សេងៗរបស់ផលិតផល ដូចជា ទំហំ ឬពណ៌។",
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                    {t(
                      "Enable Variants",
                      "បើកវ៉ារ្យ៉ង់",
                    )}
                  </span>

                  <ToggleSwitch
                    checked={variantsEnabled}
                    onChange={setVariantsEnabled}
                    label={t(
                      "Toggle variants",
                      "បើក ឬបិទវ៉ារ្យ៉ង់",
                    )}
                  />
                </div>
              </div>

              {variantsEnabled ? (
                <div className="mt-5 min-w-0 space-y-6">
                  {/* Variant Options */}
                  <div className="min-w-0">
                    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[var(--foreground)]">
                        {t(
                          "Variant Options",
                          "ជម្រើសវ៉ារ្យ៉ង់",
                        )}
                      </h3>

                      <button
                        type="button"
                        onClick={() =>
                          setVariantOptions(
                            (current) => [
                              ...current,
                              {
                                name: "",
                                values: "",
                              },
                            ],
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold text-[var(--action)] transition-colors hover:bg-[var(--action)]/5"
                      >
                        <Plus className="size-3.5" />

                        {t(
                          "Add Option",
                          "បន្ថែមជម្រើស",
                        )}
                      </button>
                    </div>

                    <div className="min-w-0 space-y-3">
                      {variantOptions.map(
                        (option, index) => (
                          <div
                            key={`option-${index}`}
                            className="grid min-w-0 grid-cols-1 gap-4 border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4 md:grid-cols-2"
                          >
                            <div className="min-w-0">
                              <label className={labelClass}>
                                {t(
                                  "Option Name",
                                  "ឈ្មោះជម្រើស",
                                )}
                              </label>

                              <input
                                value={
                                  option.name
                                }
                                onChange={(event) => {
                                  setVariantOptions(
                                    (current) => {
                                      const next = [
                                        ...current,
                                      ];

                                      next[index] = {
                                        ...next[index],
                                        name: event
                                          .target
                                          .value,
                                      };

                                      return next;
                                    },
                                  );
                                }}
                                placeholder={t(
                                  "e.g. Size",
                                  "ឧ. ទំហំ",
                                )}
                                className={cn(
                                  inputClass,
                                  "bg-[var(--input-fill)]",
                                )}
                              />
                            </div>

                            <div className="min-w-0">
                              <label className={labelClass}>
                                {t(
                                  "Values",
                                  "តម្លៃជម្រើស",
                                )}
                              </label>

                              <div className="flex min-w-0 gap-2">
                                <input
                                  value={
                                    option.values
                                  }
                                  onChange={(event) => {
                                    setVariantOptions(
                                      (current) => {
                                        const next = [
                                          ...current,
                                        ];

                                        next[index] = {
                                          ...next[
                                          index
                                          ],
                                          values:
                                            event.target
                                              .value,
                                        };

                                        return next;
                                      },
                                    );
                                  }}
                                  placeholder={t(
                                    "e.g. Small, Medium, Large",
                                    "ឧ. តូច, មធ្យម, ធំ",
                                  )}
                                  className={cn(
                                    inputClass,
                                    "bg-[var(--input-fill)]",
                                  )}
                                />

                                {variantOptions.length >
                                  1 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVariantOptions(
                                        (current) =>
                                          current.filter(
                                            (_, i) =>
                                              i !==
                                              index,
                                          ),
                                      )
                                    }
                                    className="flex size-10 shrink-0 items-center justify-center border border-[var(--border-strong)] text-[var(--muted-foreground)] transition hover:text-[#a83836]"
                                    aria-label={t(
                                      "Remove option",
                                      "លុបជម្រើស",
                                    )}
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {index === 0 ? (
                              <button
                                type="button"
                                onClick={
                                  rebuildVariantRowsFromOptions
                                }
                                className="inline-flex w-fit items-center gap-2 bg-[var(--action)]/30 px-4 py-2 text-xs font-bold text-[var(--action)] transition hover:brightness-95 md:col-span-2"
                              >
                                <RefreshCw className="size-3.5" />

                                {t(
                                  "Rebuild combinations",
                                  "បង្កើតបន្សំឡើងវិញ",
                                )}
                              </button>
                            ) : null}
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  {/* Variant Combinations */}
                  <div className="min-w-0">
                    <h3 className="mb-3 text-sm font-bold text-[var(--foreground)]">
                      {t(
                        "Variant Combinations",
                        "បន្សំវ៉ារ្យ៉ង់",
                      )}
                    </h3>

                    {/* Mobile Variant Cards */}
                    <div className="space-y-3 lg:hidden">
                      {variantRows.length ? (
                        variantRows.map((row, index) => (
                          <div
                            key={`mobile-row-${index}`}
                            className="min-w-0 border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4"
                          >
                            <div className="mb-4 border-b border-[var(--border-soft)] pb-3">
                              <p className="break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                                {t(
                                  "Variant",
                                  "វ៉ារ្យ៉ង់",
                                )}
                              </p>

                              <p className="mt-1 break-words text-sm font-semibold text-[var(--foreground)]">
                                {row.name}
                              </p>
                            </div>

                            <div className="space-y-3">
                              <div className="min-w-0">
                                <label className={labelClass}>
                                  SKU
                                </label>

                                <input
                                  value={row.sku}
                                  onChange={(event) => {
                                    setVariantRows(
                                      (current) => {
                                        const next = [
                                          ...current,
                                        ];

                                        next[index] = {
                                          ...next[
                                          index
                                          ],
                                          sku: event
                                            .target
                                            .value,
                                        };

                                        return next;
                                      },
                                    );
                                  }}
                                  placeholder="SKU"
                                  className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--input-fill)] px-3 py-2.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-1 focus:ring-[var(--action)]"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="min-w-0">
                                  <label className={labelClass}>
                                    {t(
                                      "Price Adj.",
                                      "កែតម្លៃ",
                                    )}
                                  </label>

                                  <input
                                    type="number"
                                    value={
                                      row.priceAdjustment
                                    }
                                    onChange={(event) => {
                                      setVariantRows(
                                        (current) => {
                                          const next = [
                                            ...current,
                                          ];

                                          next[index] = {
                                            ...next[
                                            index
                                            ],
                                            priceAdjustment:
                                              event
                                                .target
                                                .value,
                                          };

                                          return next;
                                        },
                                      );
                                    }}
                                    placeholder="+0.00"
                                    className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--input-fill)] px-3 py-2.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-1 focus:ring-[var(--action)]"
                                  />
                                </div>

                                <div className="min-w-0">
                                  <label className={labelClass}>
                                    {t(
                                      "Stock",
                                      "ស្តុក",
                                    )}
                                  </label>

                                  <input
                                    type="number"
                                    min="0"
                                    value={row.stock}
                                    onChange={(event) => {
                                      setVariantRows(
                                        (current) => {
                                          const next = [
                                            ...current,
                                          ];

                                          next[index] = {
                                            ...next[
                                            index
                                            ],
                                            stock: event
                                              .target
                                              .value,
                                          };

                                          return next;
                                        },
                                      );
                                    }}
                                    placeholder="0"
                                    className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--input-fill)] px-3 py-2.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-1 focus:ring-[var(--action)]"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="border border-dashed border-[var(--border-strong)] px-4 py-8 text-center text-xs text-[var(--muted-foreground)]">
                          {t(
                            "Add values to your first option to generate combinations.",
                            "បន្ថែមតម្លៃទៅជម្រើសដំបូង ដើម្បីបង្កើតបន្សំ។",
                          )}
                        </div>
                      )}
                    </div>

                    {/* Desktop Variant Table */}
                    <div className="hidden min-w-0 overflow-hidden border border-[var(--border-soft)] lg:block">
                      <table className="w-full table-fixed text-left text-sm">
                        <thead className="bg-[var(--surface-soft)] font-bold text-[var(--muted-foreground)]">
                          <tr>
                            <th className="w-[30%] px-4 py-3 text-xs">
                              {t(
                                "Variant",
                                "វ៉ារ្យ៉ង់",
                              )}
                            </th>

                            <th className="w-[30%] px-4 py-3 text-xs">
                              SKU
                            </th>

                            <th className="w-[20%] px-4 py-3 text-xs">
                              {t(
                                "Price Adj.",
                                "កែតម្លៃ",
                              )}
                            </th>

                            <th className="w-[20%] px-4 py-3 text-xs">
                              {t(
                                "Stock",
                                "ស្តុក",
                              )}
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-[var(--border-soft)]">
                          {variantRows.map(
                            (row, index) => (
                              <tr
                                key={`row-${index}`}
                                className="transition-colors hover:bg-[var(--surface-soft)]/50"
                              >
                                <td className="min-w-0 px-4 py-3 font-medium text-[var(--foreground)]">
                                  <span className="block break-words">
                                    {row.name}
                                  </span>
                                </td>

                                <td className="min-w-0 px-4 py-3">
                                  <input
                                    value={row.sku}
                                    onChange={(
                                      event,
                                    ) => {
                                      setVariantRows(
                                        (current) => {
                                          const next =
                                            [
                                              ...current,
                                            ];

                                          next[index] =
                                          {
                                            ...next[
                                            index
                                            ],
                                            sku: event
                                              .target
                                              .value,
                                          };

                                          return next;
                                        },
                                      );
                                    }}
                                    placeholder="SKU"
                                    className="w-full min-w-0 bg-transparent p-0 text-xs text-[var(--foreground)] outline-none"
                                  />
                                </td>

                                <td className="min-w-0 px-4 py-3">
                                  <input
                                    type="number"
                                    value={
                                      row.priceAdjustment
                                    }
                                    onChange={(
                                      event,
                                    ) => {
                                      setVariantRows(
                                        (current) => {
                                          const next =
                                            [
                                              ...current,
                                            ];

                                          next[index] =
                                          {
                                            ...next[
                                            index
                                            ],
                                            priceAdjustment:
                                              event
                                                .target
                                                .value,
                                          };

                                          return next;
                                        },
                                      );
                                    }}
                                    placeholder="+0.00"
                                    className="w-full min-w-0 bg-transparent p-0 text-xs text-[var(--foreground)] outline-none"
                                  />
                                </td>

                                <td className="min-w-0 px-4 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    value={row.stock}
                                    onChange={(
                                      event,
                                    ) => {
                                      setVariantRows(
                                        (current) => {
                                          const next =
                                            [
                                              ...current,
                                            ];

                                          next[index] =
                                          {
                                            ...next[
                                            index
                                            ],
                                            stock: event
                                              .target
                                              .value,
                                          };

                                          return next;
                                        },
                                      );
                                    }}
                                    placeholder="0"
                                    className="w-full min-w-0 bg-transparent p-0 text-xs text-[var(--foreground)] outline-none"
                                  />
                                </td>
                              </tr>
                            ),
                          )}

                          {variantRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-4 py-8 text-center text-xs text-[var(--muted-foreground)]"
                              >
                                {t(
                                  "Add values to your first option to generate combinations.",
                                  "បន្ថែមតម្លៃទៅជម្រើសដំបូង ដើម្បីបង្កើតបន្សំ។",
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-8 text-center">
                  <p className="break-words text-xs text-[var(--muted-foreground)] sm:text-sm">
                    {t(
                      "Variants are disabled. Toggle the switch above to add size, color, or format options.",
                      "វ៉ារ្យ៉ង់ត្រូវបានបិទ។ បើកស្វ៊ីចខាងលើ ដើម្បីបន្ថែមទំហំ ពណ៌ ឬទម្រង់។",
                    )}
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Right Column */}
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-4 lg:gap-6">
            {/* Product Images */}
            <section className={panelClass}>
              <ProductSectionHeader
                icon={Image}
                title={t(
                  "Product Images",
                  "រូបភាពផលិតផល",
                )}
              />

              <div className="mt-5 min-w-0">
                <div className="group relative flex min-w-0 cursor-pointer flex-col items-center justify-center border border-dashed border-[var(--border-strong)] bg-[var(--surface-soft)] p-7 text-center transition-colors hover:border-[var(--action)]/50 hover:bg-[var(--action)]/5">
                  <div className="mb-3 flex size-12 items-center justify-center border border-[var(--border-strong)] bg-[var(--surface-quiet)] text-[var(--muted-foreground)] transition-transform group-hover:scale-105">
                    <Upload className="size-6" />
                  </div>

                  <p className="break-words text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                    {uploading
                      ? t(
                        "Uploading...",
                        "កំពុងបញ្ចូល...",
                      )
                      : t(
                        "Drop files here or click to upload",
                        "ដាក់ឯកសារនៅទីនេះ ឬចុចដើម្បីបញ្ចូល",
                      )}
                  </p>

                  <p className="mt-1 break-words text-[11px] text-[var(--muted-foreground)]">
                    {t(
                      "Supports JPG, PNG, WEBP up to 10MB",
                      "គាំទ្រ JPG, PNG, WEBP ទំហំអតិបរមា 10MB",
                    )}
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    disabled={uploading}
                  />
                </div>

                {uploadMessage ? (
                  <p className="mt-3 break-words text-xs text-[var(--muted-foreground)]">
                    {uploadMessage}
                  </p>
                ) : null}

                <div className="mt-5 grid min-w-0 grid-cols-3 gap-3">
                  <div className="relative aspect-square min-w-0 overflow-hidden bg-[var(--surface-quiet)]">
                    {form.image ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.image}
                          alt={t(
                            "Product preview",
                            "មើលជាមុនផលិតផល",
                          )}
                          className="h-full w-full object-cover"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            update("image", "")
                          }
                          className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center bg-black/50 text-white transition hover:bg-[#a83836]"
                          aria-label={t(
                            "Remove image",
                            "លុបរូបភាព",
                          )}
                        >
                          <X className="size-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--muted-foreground)]">
                        <ImagePlus className="size-6" />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="flex aspect-square min-w-0 items-center justify-center bg-[var(--surface-quiet)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-soft)]"
                    aria-label={t(
                      "Add another image",
                      "បន្ថែមរូបភាពផ្សេងទៀត",
                    )}
                  >
                    <Plus className="size-6" />
                  </button>

                  <button
                    type="button"
                    className="flex aspect-square min-w-0 items-center justify-center bg-[var(--surface-quiet)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-soft)]"
                    aria-label={t(
                      "Add another image",
                      "បន្ថែមរូបភាពផ្សេងទៀត",
                    )}
                  >
                    <Plus className="size-6" />
                  </button>
                </div>

                <div className="mt-5 min-w-0">
                  <label className={labelClass}>
                    {t(
                      "Image URL",
                      "URL រូបភាព",
                    )}
                  </label>

                  <input
                    value={form.image}
                    onChange={(event) =>
                      update(
                        "image",
                        event.target.value,
                      )
                    }
                    placeholder="https://..."
                    type="url"
                    className={cn(
                      inputClass,
                      "font-mono text-xs",
                    )}
                  />
                </div>
              </div>
            </section>

            {/* Attributes & Tags */}
            <section className={panelClass}>
              <ProductSectionHeader
                icon={Tag}
                title={t(
                  "Attributes & Tags",
                  "លក្ខណៈ និងស្លាក",
                )}
              />

              <div className="mt-5 min-w-0 space-y-5">
                {/* Publish Status */}
                <div className="flex min-w-0 items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-4">
                  <div className="min-w-0">
                    <h3 className="break-words text-xs font-semibold text-[var(--foreground)] sm:text-sm">
                      {t(
                        "Publish Status",
                        "ស្ថានភាពផ្សព្វផ្សាយ",
                      )}
                    </h3>

                    <p className="mt-0.5 break-words text-[11px] text-[var(--muted-foreground)]">
                      {t(
                        "Visible to customers immediately",
                        "អាចមើលឃើញដោយអតិថិជនភ្លាមៗ",
                      )}
                    </p>
                  </div>

                  <ToggleSwitch
                    checked={publishActive}
                    onChange={setPublishActive}
                    label={t(
                      "Publish",
                      "ផ្សព្វផ្សាយ",
                    )}
                  />
                </div>

                {/* Tags */}
                <div className="min-w-0">
                  <label className={labelClass}>
                    {t(
                      "Product Tags",
                      "ស្លាកផលិតផល",
                    )}
                  </label>

                  <div className="flex min-w-0 flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex max-w-full items-center gap-2 bg-[var(--action-surface)] px-3 py-1.5 text-xs font-bold text-[var(--action-on-muted)]"
                      >
                        <span className="min-w-0 break-words">
                          {tag}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setTags((current) =>
                              current.filter(
                                (entry) =>
                                  entry !== tag,
                              ),
                            )
                          }
                          className="shrink-0 text-[var(--action-on-muted)] transition-colors hover:text-[#a83836]"
                          aria-label={`${t(
                            "Remove",
                            "លុប",
                          )} ${tag}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <input
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }

                      event.preventDefault();

                      const value =
                        event.currentTarget.value.trim();

                      if (
                        value &&
                        !tags.includes(value)
                      ) {
                        setTags((current) => [
                          ...current,
                          value,
                        ]);
                      }

                      event.currentTarget.value = "";
                    }}
                    placeholder={t(
                      "Type and press enter to add...",
                      "វាយ ហើយចុច Enter ដើម្បីបន្ថែម...",
                    )}
                    className="mt-3 w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--action)] focus:ring-1 focus:ring-[var(--action)]"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="sticky bottom-0 z-20 -mx-3 border-t border-[var(--border-soft)] bg-[var(--surface-soft)]/95 px-3 py-3 backdrop-blur-xl sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="hidden min-w-0 items-center gap-2 text-xs text-[var(--muted-foreground)] sm:flex">
              <span className="size-2 shrink-0 bg-[var(--action)]" />

              <span className="break-words">
                {saving
                  ? t(
                    "Saving product...",
                    "កំពុងរក្សាទុកផលិតផល...",
                  )
                  : t(
                    "Ready to save product",
                    "រួចរាល់សម្រាប់រក្សាទុកផលិតផល",
                  )}
              </span>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
              <Link
                href="/admin?tab=products"
                className="inline-flex min-w-0 items-center justify-center px-5 py-2.5 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] sm:w-auto"
              >
                {t(
                  "Cancel",
                  "បោះបង់",
                )}
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-0 items-center justify-center gap-2 bg-[var(--action)] px-6 py-2.5 text-xs font-bold text-[var(--action-foreground)] shadow-md transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {saving ? (
                  <RefreshCw className="size-4 shrink-0 animate-spin" />
                ) : (
                  <Save className="size-4 shrink-0" />
                )}

                <span className="truncate">
                  {saving
                    ? t(
                      "Saving...",
                      "កំពុងរក្សាទុក...",
                    )
                    : t(
                      "Save Product",
                      "រក្សាទុកផលិតផល",
                    )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Management  (matches Product_Page_Design.html)
// ─────────────────────────────────────────────────────────────────────────────

function AdminProductCard({ product, store, onQuickEdit, onFullEdit, onDelete, onRestock }) {
  const priceDisplay = getProductDisplayPrice(product);
  const isRange = priceDisplay.isRange;
  const totalStock = getProductTotalStock(product);
  const variantProduct = isVariantProduct(product);
  const lowStock = totalStock <= (product.minStockAlert || 8);
  const badge = !product.isActive
    ? { label: "Draft", className: "bg-[var(--surface-container-highest)] text-white" }
    : lowStock
      ? { label: "Low Stock", className: "bg-[#a83836] text-[#fff7f6]" }
      : { label: "Active", className: "bg-[var(--action)]/90 text-[var(--action-foreground)]" };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] transition-all hover:border-[var(--action)]/20 hover:shadow-xl hover:shadow-[var(--action)]/5">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--surface-quiet)] text-[var(--muted-foreground)]">
            <PackageSearch className="size-10" />
          </div>
        )}

        <div className="absolute left-4 top-4 flex gap-2">
          <span className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest backdrop-blur-md", badge.className)}>
            {badge.label}
          </span>
          {variantProduct ? (
            <span className="rounded-full bg-[#b7e3ff] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#26536a] backdrop-blur-md">
              Variants
            </span>
          ) : null}
        </div>

        <div className="absolute inset-0 flex items-end gap-3 bg-gradient-to-t from-black/60 to-transparent p-6 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onQuickEdit(product)}
            className="flex-1 rounded-full bg-[var(--surface-strong)] py-2 text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--action)] hover:text-[var(--action-foreground)]"
          >
            Quick Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(product)}
            className="rounded-full bg-white/20 p-2 text-white backdrop-blur-md transition-colors hover:bg-[#a83836]"
            aria-label="Delete product"
          >
            <Trash2 className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="text-xl font-bold text-[var(--foreground)]">{product.name}</h3>
          {isRange ? (
            <span className="text-right text-sm font-bold leading-5 text-[var(--action)]">
              {formatCurrency(priceDisplay.min)}
              <br />- {formatCurrency(priceDisplay.max)}
            </span>
          ) : (
            <span className="text-lg font-bold text-[var(--action)]">{formatCurrency(priceDisplay.price)}</span>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--action-surface)] px-3 py-1 text-[11px] font-bold text-[var(--action-on-muted)]">{product.category}</span>
          <span className="rounded-full bg-[var(--surface-quiet)] px-3 py-1 text-[11px] font-bold text-[var(--muted-foreground)]">{totalStock} in stock</span>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onFullEdit(product)}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-quiet)] py-3 text-sm font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--surface-quiet)]"
          >
            <Edit3 className="size-4" />
            Full Edit
          </button>
          {!product.isActive ? (
            <button
              type="button"
              onClick={() => store.toggleProductStatus(product.id)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--action)] py-3 text-sm font-semibold text-[var(--action-foreground)] transition-all hover:opacity-90"
            >
              <Upload className="size-4" />
              Publish
            </button>
          ) : lowStock ? (
            <button
              type="button"
              onClick={() => onRestock(product)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-quiet)] py-3 text-sm font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--surface-quiet)]"
            >
              <PackageOpen className="size-4" />
              Restock
            </button>
          ) : (
            <button
              type="button"
              onClick={() => store.toggleProductStatus(product.id)}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--surface-quiet)] py-3 text-sm font-semibold text-[var(--foreground)] transition-all hover:bg-[var(--surface-quiet)]"
            >
              <EyeOff className="size-4" />
              Deactivate
            </button>
          )}
        </div>

        {variantProduct ? (
          <Link
            href={`/admin/product-management/${product.id}/variants`}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--action)]/20 py-2 text-xs font-semibold text-[var(--action)] transition hover:bg-[var(--action)]/5"
          >
            <Layers className="size-3.5" />
            Manage Variants
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function AdminProductManagementPageView() {
  const store = useAppStore();

  const language = String(store.language || "en").toLowerCase();
  const isKhmer =
    language === "km" ||
    language.startsWith("km-") ||
    language.startsWith("kh");

  const t = (english, khmer) => (isKhmer ? khmer : english);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [csvText, setCsvText] = useState("");
  const [csvMessage, setCsvMessage] = useState("");
  const [showCsvPanel, setShowCsvPanel] = useState(false);

  const [quickEdit, setQuickEdit] = useState(null);
  const [quickPrice, setQuickPrice] = useState("0");
  const [quickStock, setQuickStock] = useState("0");
  const [quickStatus, setQuickStatus] = useState("Active");
  const [quickImage, setQuickImage] = useState("");

  const [fullEdit, setFullEdit] = useState(null);
  const [fullSaving, setFullSaving] = useState(false);
  const [fullEditError, setFullEditError] = useState("");

  const editScanner = useCameraBarcodeScanner({
    onDetected: (code) =>
      setFullEdit((current) =>
        current ? { ...current, barcode: code } : current,
      ),
  });

  const [restock, setRestock] = useState(null);
  const [restockAmount, setRestockAmount] = useState("10");

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const [page, setPage] = useState(1);

  const PAGE_SIZE = 9;

  const products = useMemo(() => {
    const lower = query.trim().toLowerCase();

    const matchesSearch = (value) =>
      String(value ?? "").toLowerCase().includes(lower);

    let list = store.products.filter((product) => {
      if (lower) {
        const productMatches =
          [
            product.name,
            product.category,
            product.sku,
            product.barcode,
            product.description,
          ].some(matchesSearch);

        const variantMatches = (product.variants || []).some(
          (variant) =>
            matchesSearch(variant.sku) ||
            matchesSearch(variant.barcode),
        );

        if (!productMatches && !variantMatches) {
          return false;
        }
      }

      if (statusFilter === "active" && !product.isActive) {
        return false;
      }

      if (statusFilter === "drafts" && product.isActive) {
        return false;
      }

      if (
        statusFilter === "lowStock" &&
        getProductTotalStock(product) > 8
      ) {
        return false;
      }

      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "az":
          return String(a.name || "").localeCompare(
            String(b.name || ""),
          );

        case "priceLow":
          return getProductMinPrice(a) - getProductMinPrice(b);

        case "priceHigh":
          return getProductMinPrice(b) - getProductMinPrice(a);

        case "newest":
        default:
          return (
            new Date(b.createdAt || 0) -
            new Date(a.createdAt || 0)
          );
      }
    });

    return list;
  }, [store.products, query, statusFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortBy]);

  const totalPages = Math.max(
    Math.ceil(products.length / PAGE_SIZE),
    1,
  );

  const safePage = Math.min(page, totalPages);

  const pageProducts = products.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const startIndex =
    products.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;

  const endIndex = Math.min(
    safePage * PAGE_SIZE,
    products.length,
  );

  const pageNumbers = [];

  for (let i = 1; i <= totalPages; i += 1) {
    if (
      i === 1 ||
      i === totalPages ||
      Math.abs(i - safePage) <= 1
    ) {
      pageNumbers.push(i);
    } else if (
      pageNumbers[pageNumbers.length - 1] !== "..."
    ) {
      pageNumbers.push("...");
    }
  }

  const filterChips = [
    {
      key: "all",
      label: t(
        `All Products (${store.products.length})`,
        `ផលិតផលទាំងអស់ (${store.products.length})`,
      ),
    },
    {
      key: "active",
      label: t("Active", "សកម្ម"),
    },
    {
      key: "drafts",
      label: t("Drafts", "ព្រាង"),
    },
    {
      key: "lowStock",
      label: t("Low Stock", "ស្តុកទាប"),
    },
  ];

  function openQuickEdit(product) {
    setQuickEdit(product);
    setQuickPrice(String(product.price ?? 0));
    setQuickStock(String(product.stock ?? 0));
    setQuickStatus(product.isActive ? "Active" : "Draft");
    setQuickImage(product.image || "");
  }

  function saveQuickEdit() {
    if (!quickEdit) {
      return;
    }

    store.updateProduct(quickEdit.id, {
      price: Math.max(Number(quickPrice) || 0, 0),
      stock: Math.max(Number(quickStock) || 0, 0),
      isActive: quickStatus === "Active",
      image: quickImage,
    });

    setQuickEdit(null);
  }

  function openFullEdit(product) {
    setFullEdit({
      id: product.id,
      name: product.name || "",
      category: product.category || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      description: product.description || "",
      image: product.image || "",
      price: String(product.price ?? 0),
      discountPercent: String(
        product.discountPercent ?? 0,
      ),
      stock: String(product.stock ?? 0),
      minStockAlert: String(product.minStockAlert ?? 5),
      isActive: product.isActive ?? true,
    });

    setFullEditError("");
  }

  async function saveFullEdit() {
    if (!fullEdit) {
      return;
    }

    setFullSaving(true);
    setFullEditError("");

    try {
      const price = Math.max(
        Number(fullEdit.price) || 0,
        0,
      );

      const discountPercent = Math.min(
        Math.max(Number(fullEdit.discountPercent) || 0, 0),
        100,
      );

      const stock = Math.max(
        Number(fullEdit.stock) || 0,
        0,
      );

      const minStockAlert = Math.max(
        Number(fullEdit.minStockAlert) || 0,
        0,
      );

      const result = await store.updateProduct(
        fullEdit.id,
        {
          name: fullEdit.name,
          category: fullEdit.category,
          sku: fullEdit.sku,
          barcode: fullEdit.barcode,
          description: fullEdit.description,
          image: fullEdit.image,
          price,
          discountPercent,
          stock,
          minStockAlert,
          isActive: fullEdit.isActive,
        },
      );

      if (result && result.ok === false) {
        setFullEditError(
          result.error ||
          t(
            "Unable to update product.",
            "មិនអាចធ្វើបច្ចុប្បន្នភាពផលិតផលបានទេ។",
          ),
        );
        return;
      }

      setFullEdit(null);
    } catch (error) {
      setFullEditError(
        t(
          "Unable to update product.",
          "មិនអាចធ្វើបច្ចុប្បន្នភាពផលិតផលបានទេ។",
        ),
      );
    } finally {
      setFullSaving(false);
    }
  }

  async function handleImport() {
    try {
      const result = await store.importProductsCsv(csvText);

      setCsvMessage(
        result.message ||
        t(
          "Import completed.",
          "ការនាំចូលបានបញ្ចប់។",
        ),
      );

      if (result.success) {
        setCsvText("");
      }
    } catch (error) {
      setCsvMessage(
        t(
          "Unable to import products.",
          "មិនអាចនាំចូលផលិតផលបានទេ។",
        ),
      );
    }
  }

  function handleCsvFile(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    file
      .text()
      .then((text) => {
        setCsvText(text);
        setCsvMessage("");
      })
      .catch(() => {
        setCsvMessage(
          t(
            "Unable to read the CSV file.",
            "មិនអាចអានឯកសារ CSV បានទេ។",
          ),
        );
      });
  }

  function escapeCsvValue(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function handleExport() {
    const header =
      "name,category,description,price,stock,imageUrl,discountPercent,isActive";

    const rows = store.products.map((product) =>
      [
        product.name,
        product.category,
        product.description,
        product.price,
        product.stock,
        product.image,
        product.discountPercent,
        product.isActive,
      ]
        .map(escapeCsvValue)
        .join(","),
    );

    const blob = new Blob(
      [[header, ...rows].join("\n")],
      {
        type: "text/csv;charset=utf-8;",
      },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "products-export.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function confirmRestock() {
    if (!restock) {
      return;
    }

    const amount = Math.max(
      Number(restockAmount) || 0,
      0,
    );

    if (!amount) {
      return;
    }

    store.restockProduct(restock.id, amount);

    setRestock(null);
    setRestockAmount("10");
  }

  function confirmDelete() {
    if (!deleteConfirm) {
      return;
    }

    store.deleteProduct(deleteConfirm.id);
    setDeleteConfirm(null);
  }

  return (
    <div
      className="mx-auto w-full min-w-0 max-w-[1440px] overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8 [&_*]:rounded-none"
    >
      <div className="min-w-0 space-y-6">
        {/* Page Header */}
        <section className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {t(
                "Product Management",
                "ការគ្រប់គ្រងផលិតផល",
              )}
            </h1>

            <p className="mt-1 break-words text-sm text-[var(--muted-foreground)] sm:text-base">
              {t(
                "Manage your premium organic inventory and catalog.",
                "គ្រប់គ្រងស្តុក និងកាតាឡុកផលិតផលរបស់អ្នក។",
              )}
            </p>
          </div>

          <Link
            href="/admin/add-product"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 bg-[var(--action)] px-5 py-2.5 text-sm font-bold text-[var(--action-foreground)] shadow-lg shadow-[var(--action)]/20 transition-all hover:-translate-y-0.5 hover:opacity-90 active:scale-[0.98] sm:w-auto"
          >
            <Plus className="size-4" />

            {t(
              "Add New Product",
              "បន្ថែមផលិតផលថ្មី",
            )}
          </Link>
        </section>

        {/* Filter + Sort Toolbar */}
        <section className="min-w-0 border-b border-[var(--border-soft)] pb-5">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Filter Chips */}
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
              {filterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() =>
                    setStatusFilter(chip.key)
                  }
                  className={cn(
                    "max-w-full px-3.5 py-2 text-xs font-semibold transition-colors sm:px-4",
                    statusFilter === chip.key
                      ? "bg-[var(--action)] text-[var(--action-foreground)]"
                      : "bg-[var(--surface-quiet)] text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)]",
                  )}
                >
                  <span className="break-words">
                    {chip.label}
                  </span>
                </button>
              ))}

              <div className="mx-1 hidden h-6 w-px bg-[var(--surface-quiet)]/30 sm:block" />

              <button
                type="button"
                onClick={() =>
                  setShowCsvPanel((value) => !value)
                }
                className="inline-flex min-w-0 items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-[var(--action)] transition-colors hover:opacity-80"
              >
                <SlidersHorizontal className="size-3.5 shrink-0" />

                <span className="break-words">
                  {t(
                    "Import / Export",
                    "នាំចូល / នាំចេញ",
                  )}
                </span>
              </button>
            </div>

            {/* Search + Sort */}
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-auto lg:min-w-[28rem]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />

                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder={t(
                    "Search products...",
                    "ស្វែងរកផលិតផល...",
                  )}
                  className="h-9 w-full min-w-0 border-none bg-[var(--surface-soft)] py-2 pl-10 pr-4 text-xs font-medium text-[var(--foreground)] outline-none transition-all focus:ring-2 focus:ring-[var(--action)]"
                />
              </div>

              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs font-medium text-[var(--muted-foreground)]">
                  {t("Sort by:", "តម្រៀបតាម៖")}
                </span>

                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value)
                  }
                  className="h-9 min-w-0 flex-1 cursor-pointer border-none bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] outline-none transition-all focus:ring-2 focus:ring-[var(--action)] sm:w-auto sm:flex-none"
                >
                  <option value="newest">
                    {t(
                      "Newest first",
                      "ថ្មីបំផុតមុន",
                    )}
                  </option>

                  <option value="az">
                    {t(
                      "Alphabetical (A-Z)",
                      "តាមអក្ខរក្រម (A-Z)",
                    )}
                  </option>

                  <option value="priceLow">
                    {t(
                      "Price (Low to High)",
                      "តម្លៃ (ទាបទៅខ្ពស់)",
                    )}
                  </option>

                  <option value="priceHigh">
                    {t(
                      "Price (High to Low)",
                      "តម្លៃ (ខ្ពស់ទៅទាប)",
                    )}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* CSV Import / Export */}
        {showCsvPanel ? (
          <section className="min-w-0 border border-[var(--border-strong)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-card)] sm:p-5 lg:p-6">
            <div className="min-w-0 space-y-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold text-[var(--foreground)] sm:text-lg">
                    {t(
                      "CSV import / export",
                      "នាំចូល / នាំចេញ CSV",
                    )}
                  </h2>

                  <p className="mt-1 break-words text-xs text-[var(--muted-foreground)] sm:text-sm">
                    {t(
                      "Import products in bulk or export the current catalog.",
                      "នាំចូលផលិតផលជាច្រើនក្នុងពេលតែមួយ ឬនាំចេញកាតាឡុកបច្ចុប្បន្ន។",
                    )}
                  </p>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="inline-flex min-w-0 cursor-pointer items-center justify-center bg-[var(--surface-strong)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-soft)] sm:text-sm">
                    {t(
                      "Load CSV",
                      "បញ្ចូល CSV",
                    )}

                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFile}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleExport}
                    className="inline-flex min-w-0 items-center justify-center bg-[var(--surface-strong)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-soft)] sm:text-sm"
                  >
                    {t(
                      "Export CSV",
                      "នាំចេញ CSV",
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={csvText}
                onChange={(event) =>
                  setCsvText(event.target.value)
                }
                placeholder={t(
                  "Paste product CSV here",
                  "បិទភ្ជាប់ CSV ផលិតផលនៅទីនេះ",
                )}
                className="min-h-28 w-full min-w-0 resize-y border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-xs text-[var(--foreground)] outline-none transition focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)] sm:text-sm"
              />

              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleImport}
                  className="inline-flex items-center justify-center bg-[var(--action)] px-5 py-2.5 text-xs font-bold text-[var(--action-foreground)] transition hover:opacity-90 sm:w-auto sm:text-sm"
                >
                  {t(
                    "Import Products",
                    "នាំចូលផលិតផល",
                  )}
                </button>

                {csvMessage ? (
                  <p className="min-w-0 break-words text-xs text-[var(--muted-foreground)] sm:text-sm">
                    {csvMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {/* Product Grid */}
        <section className="min-w-0">
          <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {pageProducts.map((product) => (
              <AdminProductCard
                key={product.id}
                product={product}
                store={store}
                onQuickEdit={openQuickEdit}
                onFullEdit={openFullEdit}
                onDelete={setDeleteConfirm}
                onRestock={setRestock}
              />
            ))}

            {/* Add New Product */}
            <Link
              href="/admin/add-product"
              className="group flex min-h-[360px] min-w-0 flex-col items-center justify-center border-2 border-dashed border-[var(--border-strong)] p-6 text-center transition-all hover:border-[var(--action)]/40 hover:bg-[var(--surface-soft)] sm:min-h-[400px] sm:p-8"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center bg-[var(--action-surface)] text-[var(--action-on-muted)] transition-transform group-hover:scale-110">
                <Plus className="size-8" />
              </div>

              <span className="break-words text-lg font-bold text-[var(--foreground)] sm:text-xl">
                {t(
                  "Add New Product",
                  "បន្ថែមផលិតផលថ្មី",
                )}
              </span>

              <p className="mt-2 max-w-[240px] break-words text-xs text-[var(--muted-foreground)] sm:text-sm">
                {t(
                  "Click to create a new entry in your organic catalog.",
                  "ចុចដើម្បីបង្កើតផលិតផលថ្មីនៅក្នុងកាតាឡុករបស់អ្នក។",
                )}
              </p>
            </Link>
          </div>
        </section>

        {/* Pagination */}
        <section className="min-w-0 border-t border-[var(--border-soft)] pt-5">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 break-words text-xs text-[var(--muted-foreground)] sm:text-sm">
              {t(
                `Showing ${startIndex} to ${endIndex} of ${products.length} products`,
                `បង្ហាញពី ${startIndex} ដល់ ${endIndex} នៃផលិតផល ${products.length}`,
              )}
            </span>

            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setPage(Math.max(safePage - 1, 1))
                }
                disabled={safePage <= 1}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] disabled:opacity-30"
                aria-label={t(
                  "Previous page",
                  "ទំព័រមុន",
                )}
              >
                <ChevronLeft className="size-4" />
              </button>

              {pageNumbers.map((number, index) =>
                number === "..." ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-1.5 text-xs text-[var(--muted-foreground)]"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={number}
                    type="button"
                    onClick={() => setPage(number)}
                    className={cn(
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center text-xs font-bold transition-colors",
                      safePage === number
                        ? "bg-[var(--action)] text-[var(--action-foreground)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--surface-quiet)]",
                    )}
                  >
                    {number}
                  </button>
                ),
              )}

              <button
                type="button"
                onClick={() =>
                  setPage(
                    Math.min(
                      safePage + 1,
                      totalPages,
                    ),
                  )
                }
                disabled={safePage >= totalPages}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-quiet)] disabled:opacity-30"
                aria-label={t(
                  "Next page",
                  "ទំព័របន្ទាប់",
                )}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Quick Edit Modal */}
        {quickEdit ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-x-hidden overflow-y-auto p-3 sm:p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setQuickEdit(null)}
            />

            <div className="relative my-auto max-h-[92vh] w-full min-w-0 max-w-md overflow-x-hidden overflow-y-auto border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-strong)] sm:p-6">
              <h2 className="mb-5 break-words text-xl font-bold text-[var(--foreground)] sm:text-2xl">
                {t("Quick Edit", "កែសម្រួលរហ័ស")}
              </h2>

              <div className="space-y-4">
                <ProductImageEditor
                  image={quickImage}
                  onImageChange={setQuickImage}
                  store={store}
                />

                <div>
                  <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t(
                      "Price (USD)",
                      "តម្លៃ (USD)",
                    )}
                  </label>

                  <input
                    value={quickPrice}
                    onChange={(event) =>
                      setQuickPrice(event.target.value)
                    }
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>

                <div>
                  <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t(
                      "Stock Level",
                      "កម្រិតស្តុក",
                    )}
                  </label>

                  <input
                    value={quickStock}
                    onChange={(event) =>
                      setQuickStock(event.target.value)
                    }
                    type="number"
                    min="0"
                    className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>

                <div>
                  <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t("Status", "ស្ថានភាព")}
                  </label>

                  <AppSelect
                    value={quickStatus}
                    onChange={setQuickStatus}
                    options={["Active", "Draft", "Archived"]}
                    aria-label={t(
                      "Product status",
                      "ស្ថានភាពផលិតផល",
                    )}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setQuickEdit(null)}
                  className="min-w-0 bg-[var(--surface-quiet)] px-4 py-3 text-sm font-bold text-[var(--foreground)] transition-colors hover:opacity-90"
                >
                  {t("Cancel", "បោះបង់")}
                </button>

                <button
                  type="button"
                  onClick={saveQuickEdit}
                  className="min-w-0 bg-[var(--action)] px-4 py-3 text-sm font-bold text-[var(--action-foreground)] shadow-lg shadow-[var(--action)]/20 transition-colors hover:opacity-90"
                >
                  {t(
                    "Save Changes",
                    "រក្សាទុកការកែប្រែ",
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Full Edit Modal */}
        {fullEdit ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-x-hidden overflow-y-auto p-3 sm:p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setFullEdit(null)}
            />

            <div className="relative my-auto max-h-[92vh] w-full min-w-0 max-w-2xl overflow-x-hidden overflow-y-auto border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-strong)] sm:p-6">
              <h2 className="mb-5 break-words text-xl font-bold text-[var(--foreground)] sm:text-2xl">
                {t("Full Edit", "កែសម្រួលពេញលេញ")}
              </h2>

              {fullEditError ? (
                <div className="mb-4 break-words bg-[#fa746f]/20 px-4 py-3 text-sm font-semibold text-[#6e0a12]">
                  {fullEditError}
                </div>
              ) : null}

              <BarcodeScannerModal
                open={editScanner.open}
                status={editScanner.status}
                errorMessage={editScanner.errorMessage}
                videoRef={editScanner.videoRef}
                onClose={editScanner.close}
                onRetry={editScanner.retry}
                torchSupported={editScanner.torchSupported}
                torchOn={editScanner.torchOn}
                onToggleTorch={editScanner.toggleTorch}
                onToggleCameraFacing={
                  editScanner.toggleCameraFacing
                }
              />

              <div className="space-y-4">
                <ProductImageEditor
                  image={fullEdit.image}
                  onImageChange={(value) =>
                    setFullEdit((current) => ({
                      ...current,
                      image: value,
                    }))
                  }
                  store={store}
                />

                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {t(
                        "Product Name",
                        "ឈ្មោះផលិតផល",
                      )}
                    </label>

                    <input
                      value={fullEdit.name}
                      onChange={(event) =>
                        setFullEdit((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {t(
                        "Category",
                        "ប្រភេទ",
                      )}
                    </label>

                    <AppSelect
                      value={fullEdit.category}
                      onChange={(value) =>
                        setFullEdit((current) => ({
                          ...current,
                          category: value,
                        }))
                      }
                      options={PRODUCT_CATEGORY_OPTIONS}
                      aria-label={t(
                        "Product category",
                        "ប្រភេទផលិតផល",
                      )}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    SKU
                  </label>

                  <input
                    value={fullEdit.sku}
                    onChange={(event) =>
                      setFullEdit((current) => ({
                        ...current,
                        sku: event.target.value,
                      }))
                    }
                    placeholder="ATR-VEG-001"
                    className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t(
                      "Barcode",
                      "បាកូដ",
                    )}
                  </label>

                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <input
                      value={fullEdit.barcode}
                      onChange={(event) =>
                        setFullEdit((current) => ({
                          ...current,
                          barcode: event.target.value,
                        }))
                      }
                      placeholder={t(
                        "Scan or enter barcode (e.g. 8850001234567)",
                        "ស្កេន ឬបញ្ចូលបាកូដ",
                      )}
                      inputMode="text"
                      autoComplete="off"
                      className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm tracking-wider text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                    />

                    <button
                      type="button"
                      onClick={editScanner.openScanner}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 bg-[var(--action)] px-4 py-3 text-xs font-extrabold text-[var(--action-foreground)] transition-all hover:opacity-90 active:scale-[0.98]"
                    >
                      <ScanLine className="size-4" />

                      {t(
                        "Scan",
                        "ស្កេន",
                      )}
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t(
                      "Description",
                      "ពិពណ៌នា",
                    )}
                  </label>

                  <textarea
                    value={fullEdit.description}
                    onChange={(event) =>
                      setFullEdit((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full min-w-0 resize-y border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="min-w-0">
                    <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {t(
                        "Price (USD)",
                        "តម្លៃ (USD)",
                      )}
                    </label>

                    <input
                      value={fullEdit.price}
                      onChange={(event) =>
                        setFullEdit((current) => ({
                          ...current,
                          price: event.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {t(
                        "Discount %",
                        "បញ្ចុះតម្លៃ %",
                      )}
                    </label>

                    <input
                      value={fullEdit.discountPercent}
                      onChange={(event) =>
                        setFullEdit((current) => ({
                          ...current,
                          discountPercent:
                            event.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {t(
                        "Stock",
                        "ស្តុក",
                      )}
                    </label>

                    <input
                      value={fullEdit.stock}
                      onChange={(event) =>
                        setFullEdit((current) => ({
                          ...current,
                          stock: event.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                    />
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {t(
                        "Low Stock Alert",
                        "ការជូនដំណឹងស្តុកទាប",
                      )}
                    </label>

                    <input
                      value={fullEdit.minStockAlert}
                      onChange={(event) =>
                        setFullEdit((current) => ({
                          ...current,
                          minStockAlert:
                            event.target.value,
                        }))
                      }
                      type="number"
                      min="0"
                      className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                    />
                  </div>

                  <div className="min-w-0">
                    <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                      {t(
                        "Status",
                        "ស្ថានភាព",
                      )}
                    </label>

                    <AppSelect
                      value={
                        fullEdit.isActive
                          ? "Active"
                          : "Draft"
                      }
                      onChange={(value) =>
                        setFullEdit((current) => ({
                          ...current,
                          isActive:
                            value === "Active",
                        }))
                      }
                      options={["Active", "Draft"]}
                      aria-label={t(
                        "Product status",
                        "ស្ថានភាពផលិតផល",
                      )}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFullEdit(null)}
                  className="min-w-0 bg-[var(--surface-quiet)] px-4 py-3 text-sm font-bold text-[var(--foreground)] transition-colors hover:opacity-90"
                >
                  {t("Cancel", "បោះបង់")}
                </button>

                <button
                  type="button"
                  onClick={saveFullEdit}
                  disabled={fullSaving}
                  className="min-w-0 bg-[var(--action)] px-4 py-3 text-sm font-bold text-[var(--action-foreground)] shadow-lg shadow-[var(--action)]/20 transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {fullSaving
                    ? t(
                      "Saving...",
                      "កំពុងរក្សាទុក...",
                    )
                    : t(
                      "Save Changes",
                      "រក្សាទុកការកែប្រែ",
                    )}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Restock Modal */}
        {restock ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-x-hidden overflow-y-auto p-3 sm:p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setRestock(null)}
            />

            <div className="relative my-auto w-full min-w-0 max-w-md border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-strong)] sm:p-6">
              <h2 className="break-words text-xl font-bold text-[var(--foreground)] sm:text-2xl">
                {t("Restock", "បន្ថែមស្តុក")}
              </h2>

              <p className="mt-1 break-words text-sm text-[var(--muted-foreground)]">
                {t(
                  `Add stock to ${restock.name}`,
                  `បន្ថែមស្តុកទៅ ${restock.name}`,
                )}
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block break-words text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    {t(
                      "Quantity to add",
                      "ចំនួនដែលត្រូវបន្ថែម",
                    )}
                  </label>

                  <input
                    value={restockAmount}
                    onChange={(event) =>
                      setRestockAmount(
                        event.target.value,
                      )
                    }
                    type="number"
                    min="1"
                    className="w-full min-w-0 border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--action)] focus:ring-2 focus:ring-[var(--action)]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {[5, 10, 20].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() =>
                        setRestockAmount(
                          String(amount),
                        )
                      }
                      className="bg-[var(--surface-quiet)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:opacity-90"
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRestock(null)}
                  className="min-w-0 bg-[var(--surface-quiet)] px-4 py-3 text-sm font-bold text-[var(--foreground)] transition-colors hover:opacity-90"
                >
                  {t("Cancel", "បោះបង់")}
                </button>

                <button
                  type="button"
                  onClick={confirmRestock}
                  className="min-w-0 bg-[var(--action)] px-4 py-3 text-sm font-bold text-[var(--action-foreground)] shadow-lg shadow-[var(--action)]/20 transition-colors hover:opacity-90"
                >
                  {t("Restock", "បន្ថែមស្តុក")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Delete Confirm Modal */}
        {deleteConfirm ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-x-hidden overflow-y-auto p-3 sm:p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() =>
                setDeleteConfirm(null)
              }
            />

            <div className="relative my-auto w-full min-w-0 max-w-md border border-[var(--border-soft)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow-strong)] sm:p-6">
              <h2 className="break-words text-xl font-bold text-[var(--foreground)] sm:text-2xl">
                {t(
                  "Delete product?",
                  "លុបផលិតផល?",
                )}
              </h2>

              <p className="mt-2 break-words text-sm text-[var(--muted-foreground)]">
                {t(
                  `This will remove "${deleteConfirm.name}" from the catalog.`,
                  `វានឹងលុប "${deleteConfirm.name}" ចេញពីកាតាឡុក។`,
                )}
              </p>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirm(null)
                  }
                  className="min-w-0 bg-[var(--surface-quiet)] px-4 py-3 text-sm font-bold text-[var(--foreground)] transition-colors hover:opacity-90"
                >
                  {t("Cancel", "បោះបង់")}
                </button>

                <button
                  type="button"
                  onClick={confirmDelete}
                  className="min-w-0 bg-[#a83836] px-4 py-3 text-sm font-bold text-[#fff7f6] shadow-lg shadow-[#a83836]/20 transition-colors hover:opacity-90"
                >
                  {t("Delete", "លុប")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

