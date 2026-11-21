"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChartNoAxesCombined,
  LayoutDashboard,
  Library,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
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
  { href: "/data", label: "Data", icon: ChartNoAxesCombined },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/engage", label: "Engage", icon: MessageCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOTION_CLASS =
  "transition-[width,padding] duration-[250ms] ease-[cubic-bezier(0.215,0.61,0.355,1)]";

export function Sidebar({ active }: { active: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--line)] bg-[var(--surface)] py-7 ${MOTION_CLASS} ${
        expanded ? "w-60 px-5" : "w-16 px-2"
      } md:w-60 md:px-5`}
    >
      <div
        className={`mb-6 flex items-start ${
          expanded ? "justify-between gap-2" : "flex-col items-center gap-3"
        } md:block`}
      >
        <div className={expanded ? "min-w-0" : "hidden md:block"}>
          <div className="type-h2 text-[var(--ink)]">
            LinkedWin
          </div>
          <div className="type-p-s text-[var(--muted)]">
            Content HQ
          </div>
        </div>
        <button
          type="button"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)] md:hidden"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <PanelLeftClose className="size-4" strokeWidth={1.2} aria-hidden />
          ) : (
            <PanelLeftOpen className="size-4" strokeWidth={1.2} aria-hidden />
          )}
        </button>
      </div>
      <nav className="flex flex-col gap-2">
        {NAV.map((item) => {
          const isActive = active === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className={
                isActive
                  ? `type-menu-active flex h-10 items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] ${
                      expanded
                        ? "gap-2.5 px-3"
                        : "justify-center px-0 md:justify-start md:gap-2.5 md:px-3"
                    }`
                  : `type-menu flex h-10 items-center rounded-lg text-[var(--ink)] hover:bg-[var(--bg)] ${
                      expanded
                        ? "gap-2.5 px-3"
                        : "justify-center px-0 md:justify-start md:gap-2.5 md:px-3"
                    }`
              }
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.2} aria-hidden />
              <span
                className={`truncate ${
                  expanded ? "inline" : "hidden md:inline"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
