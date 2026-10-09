export function InfoPage({
  eyebrow = "Zitsy",
  title,
  lead,
  updatedAt,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  updatedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-page py-12 sm:py-14">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {title}
        </h1>
        {lead ? (
          <p className="mt-4 text-lg leading-relaxed text-muted">{lead}</p>
        ) : null}
        {updatedAt ? (
          <p className="mt-2 text-xs text-muted">Last updated: {updatedAt}</p>
        ) : null}
        <div className="prose-doc mt-8">{children}</div>
      </div>
    </div>
  );
}