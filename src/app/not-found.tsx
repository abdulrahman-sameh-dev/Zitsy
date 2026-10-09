import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="container-page flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="text-sm font-medium text-brand-700">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-muted">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-800"
      >
        Back to home
      </Link>
    </main>
  );
}
