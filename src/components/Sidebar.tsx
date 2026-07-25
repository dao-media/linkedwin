import Link from "next/link";
import {
  CalendarDays,
  ChartNoAxesCombined,
  LayoutDashboard,
  Library,
  MessageCircle,
  PenLine,
  Radar,
  Settings,
  type LucideIcon,
} from "lucide-react";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/composer", label: "Composer", icon: PenLine },
  { href: "/repository", label: "Content Library", icon: Library },
  { href: "/trends", label: "Trends", icon: ChartNoAxesCombined },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/engage", label: "Engage", icon: MessageCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ active }: { active: string }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r border-[var(--line)] bg-[var(--surface)] px-5 py-7">
      <div className="mb-6">
        <div className="text-[22px] font-bold tracking-tight text-[var(--ink)]">
          LinkedWin
        </div>
        <div className="text-xs font-medium text-[var(--muted)]">Content HQ</div>
      </div>
      <nav className="flex flex-col gap-2">
        {NAV.map((item) => {
          const isActive = active === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                isActive
                  ? "flex h-10 items-center gap-2 rounded-lg bg-[var(--accent-soft)] pl-3 text-sm font-semibold text-[var(--accent)] transition"
                  : "flex h-10 items-center gap-2.5 rounded-lg pl-3 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--bg)]"
              }
            >
              <Icon
                className={isActive ? "size-[18px] shrink-0" : "size-4 shrink-0"}
                strokeWidth={isActive ? 1.6 : 1.2}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
