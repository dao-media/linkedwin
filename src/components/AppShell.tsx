import { Sidebar } from "./Sidebar";

export function AppShell({
  active,
  title,
  actions,
  children,
}: {
  active: string;
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <Sidebar active={active} />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="type-h1">
            {title}
          </h1>
          {actions}
        </header>
        {children}
      </main>
    </div>
  );
}
