"use client";

import { useState, type FormEvent } from "react";

import { submitContactAction } from "@/lib/contact/actions";
import {
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_LABELS,
} from "@/lib/contact/schemas";

const inputClass =
  "rounded-md border border-line bg-surface px-3 py-2 text-ink outline-none transition-colors focus:border-brand-500";

export function ContactForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setPending(true);
    setError(null);
    try {
      const result = await submitContactAction({
        name: data.get("name"),
        email: data.get("email"),
        orderNumber: data.get("orderNumber") ?? "",
        category: data.get("category"),
        message: data.get("message"),
        website: data.get("website") ?? "",
      });
      if (result.ok) {
        form.reset();
        setSent(true);
        return;
      }
      setError(result.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-lg border border-line bg-surface p-6 text-sm leading-relaxed text-ink"
      >
        <p className="font-semibold">Your message has been sent.</p>
        <p className="mt-2 text-muted">
          Thanks for getting in touch — we&apos;ll reply to the email address
          you gave us.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-sm font-medium text-brand-700 underline"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">
          Name<span className="text-red-600"> *</span>
        </span>
        <input name="name" type="text" required maxLength={100} className={inputClass} />
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
          maxLength={200}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Order number (optional)</span>
        <input
          name="orderNumber"
          type="text"
          maxLength={32}
          placeholder="ZS-XXXXXXXX"
          autoComplete="off"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">
          Reason<span className="text-red-600"> *</span>
        </span>
        <select name="category" required defaultValue="order" className={inputClass}>
          {CONTACT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {CONTACT_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">
          Message<span className="text-red-600"> *</span>
        </span>
        <textarea
          name="message"
          required
          rows={6}
          maxLength={3000}
          placeholder="How can we help?"
          className={`${inputClass} resize-y`}
        />
      </label>

      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

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
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
