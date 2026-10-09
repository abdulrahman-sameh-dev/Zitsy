"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { lookupOrderAction } from "@/lib/orders/tracking-actions";

const inputClass =
  "rounded-md border border-line bg-surface px-3 py-2 text-ink outline-none transition-colors focus:border-brand-500";

export function TrackLookupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError(null);
    try {
      const result = await lookupOrderAction({
        orderNumber: data.get("orderNumber"),
        email: data.get("email"),
      });
      if (result.ok) {
        router.push(`/track-order/${result.token}`);
        return;
      }
      setError(result.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">
          Order number<span className="text-red-600"> *</span>
        </span>
        <input
          name="orderNumber"
          type="text"
          required
          autoComplete="off"
          placeholder="ZS-XXXXXXXX"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">
          Email<span className="text-red-600"> *</span>
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={inputClass}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
      >
        {pending ? "Looking up…" : "Find my order"}
      </button>
    </form>
  );
}
