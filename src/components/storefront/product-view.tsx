"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";

import { addToCart } from "@/lib/cart/actions";
import {
  availableValueIdsForDim,
  hasDistinctPrices,
  minPriceMinor,
  orderableVariants,
  resolveVariant,
} from "@/lib/catalog/variants";
import type { ProductViewRecord } from "@/lib/catalog/view";
import { imagesForVariant } from "@/lib/catalog/view";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Props {
  product: ProductViewRecord;
}

export function ProductView({ product }: Props) {
  const [selection, setSelection] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const dim of product.dims) {
      if (dim.values.length === 1) initial[dim.name] = dim.values[0].valueId;
    }
    return initial;
  });
  const [galleryState, setGalleryState] = useState<{
    key: unknown;
    index: number;
  }>({ key: null, index: 0 });
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const orderable = useMemo(
    () => orderableVariants(product.variants),
    [product.variants],
  );
  const dimNames = useMemo(() => product.dims.map((dim) => dim.name), [product.dims]);
  const resolved = useMemo(
    () => resolveVariant(product.variants, selection, dimNames),
    [product.variants, selection, dimNames],
  );
  const incompleteDims = useMemo(
    () => product.dims.filter((dim) => selection[dim.name] == null).map((dim) => dim.name),
    [product.dims, selection],
  );

  const images = useMemo(
    () => imagesForVariant(product.images, resolved?.printifyVariantId ?? null),
    [product.images, resolved],
  );

  // Reset the gallery to the first image when the image set changes (e.g. a
  // different variant is selected) — adjusting state during render, no effect.
  if (galleryState.key !== images) {
    setGalleryState({ key: images, index: 0 });
  }
  const galleryIndex =
    galleryState.key === images ? galleryState.index : 0;
  const setGalleryIndex = (index: number) =>
    setGalleryState({ key: images, index });

  const productUnavailable = orderable.length === 0;
  const selectedUnavailable =
    resolved !== null && !(resolved.isEnabled && resolved.isAvailable);

  const price = useMemo(() => {
    if (resolved) {
      return formatMoney(resolved.priceMinor, product.currency);
    }
    // Nothing sellable: never advertise £0.00 as a product price.
    if (productUnavailable) return null;
    const base = minPriceMinor(product.variants);
    const formatted = formatMoney(base, product.currency);
    return hasDistinctPrices(product.variants) ? `From ${formatted}` : formatted;
  }, [product.variants, product.currency, resolved, productUnavailable]);

  const askFor = incompleteDims.length > 0 ? incompleteDims.join(" and ") : null;

  const toggleValue = useCallback(
    (dimName: string, valueId: number) => {
      setSelection((current) => {
        if (current[dimName] === valueId) {
          const next = { ...current };
          delete next[dimName];
          return next;
        }
        return { ...current, [dimName]: valueId };
      });
      setNote(null);
    },
    [],
  );

  const canAdd = resolved !== null && !productUnavailable && !selectedUnavailable;

  const handleAdd = () => {
    if (!canAdd || !resolved) return;
    const variantId = resolved.id;
    startTransition(async () => {
      const result = await addToCart({
        productId: product.id,
        variantId,
        quantity,
      });
      setNote(result.ok ? "Added to cart." : result.error);
    });
  };

  const currentImage = images[Math.min(galleryIndex, images.length - 1)];
  const imageAlt = (index: number) =>
    resolved
      ? `${product.title} in ${resolved.title} — image ${index + 1} of ${images.length}`
      : `${product.title} — image ${index + 1} of ${images.length}`;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Gallery */}
      <div className="space-y-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-line bg-surface">
          {currentImage ? (
            <>
              <Image
                src={currentImage.src}
                alt={imageAlt(Math.min(galleryIndex, images.length - 1))}
                fill
                priority={galleryIndex === 0}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-contain"
              />
              <button
                type="button"
                onClick={() => dialogRef.current?.showModal()}
                aria-label="View image larger"
                className="absolute bottom-3 right-3 rounded-md border border-line bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition-colors hover:bg-canvas"
              >
                Expand
              </button>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              No image
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="grid grid-cols-5 gap-2" role="list" aria-label="Product images">
            {images.map((image, index) => (
              <button
                key={image.src}
                type="button"
                role="listitem"
                onClick={() => setGalleryIndex(index)}
                aria-label={`Show ${imageAlt(index)}`}
                aria-current={index === galleryIndex}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md border bg-surface",
                  index === galleryIndex
                    ? "border-brand-600 ring-2 ring-brand-600/30"
                    : "border-line hover:border-brand-400",
                )}
              >
                <Image
                  src={image.src}
                  alt=""
                  fill
                  sizes="20vw"
                  className="object-contain"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Buy box */}
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {product.title}
        </h1>

        <p className="text-xl font-semibold text-brand-700" aria-live="polite">
          {price}
        </p>

        {productUnavailable ? (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            This product is currently unavailable.
          </p>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleAdd();
          }}
          className="flex flex-col gap-5"
        >
          {product.dims.map((dim) => {
            const available = availableValueIdsForDim(
              dim.name,
              dim.values.map((value) => value.valueId),
              selection,
              product.variants,
            );
            return (
              <fieldset key={dim.name}>
                <legend className="mb-2 text-sm font-semibold text-ink">
                  {dim.name}
                </legend>
                <div className="flex flex-wrap gap-2" role="group">
                  {dim.values.map((value) => {
                    const selected = selection[dim.name] === value.valueId;
                    const disabled = !available.has(value.valueId);
                    return (
                      <button
                        key={value.valueId}
                        type="button"
                        aria-pressed={selected}
                        disabled={disabled}
                        onClick={() => toggleValue(dim.name, value.valueId)}
                        title={disabled ? "Not available in this combination" : undefined}
                        className={cn(
                          "rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                          selected
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-line bg-surface text-ink hover:border-brand-400",
                          disabled && "cursor-not-allowed opacity-40 hover:border-line",
                        )}
                      >
                        {value.title}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          {selectedUnavailable && !productUnavailable ? (
            <p className="text-sm font-medium text-zinc-600">
              This combination is currently unavailable.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-line pt-5">
            <label htmlFor="quantity" className="text-sm font-semibold text-ink">
              Quantity
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="h-10 w-10 rounded-md border border-line text-lg text-ink transition-colors hover:border-brand-400 disabled:opacity-40"
                disabled={quantity <= 1}
              >
                −
              </button>
              <input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setQuantity(Number.isNaN(next) || next < 1 ? 1 : next);
                }}
                className="h-10 w-20 rounded-md border border-line text-center text-sm font-medium text-ink focus:outline-brand-600"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Increase quantity"
                className="h-10 w-10 rounded-md border border-line text-lg text-ink transition-colors hover:border-brand-400"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canAdd || pending}
            className={cn(
              "w-full rounded-md px-5 py-3 text-sm font-semibold text-white transition-colors",
              canAdd && !pending
                ? "bg-brand-600 hover:bg-brand-700"
                : "cursor-not-allowed bg-zinc-300 text-zinc-500",
            )}
          >
            {pending ? "Adding…" : "Add to cart"}
          </button>

          {!canAdd && askFor ? (
            <p className="text-sm text-muted">
              Select {askFor} to see the exact price and add to cart.
            </p>
          ) : null}
          {note ? (
            <p className="text-sm text-muted" aria-live="polite">
              {note}
            </p>
          ) : null}
        </form>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Expanded product image"
        className="m-auto rounded-xl border border-line bg-surface p-2 shadow-2xl"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        {currentImage ? (
          <div className="relative max-h-[80vh] w-[min(80vw,900px)]">
            <Image
              src={currentImage.src}
              alt={resolved ? `${product.title} in ${resolved.title}` : product.title}
              width={1000}
              height={1000}
              className="h-auto w-full rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close expanded image"
              autoFocus
              className="absolute right-2 top-2 rounded-md bg-ink/80 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-ink"
            >
              Close
            </button>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}