"use client";

import { useEffect } from "react";

import { log } from "@/lib/log";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error("route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main
      id="main-content"
      className="container-page flex flex-1 flex-col items-center justify-center py-24 text-center"
    >
      <h1 className="text-3xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-muted">
        An unexpected error occurred. Please try again — your data is safe.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        Try again
      </button>
    </main>
  );
}
