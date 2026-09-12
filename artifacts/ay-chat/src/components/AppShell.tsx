import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  User as UserIcon,
  ShieldCheck,
  LogOut,
  Moon,
  Sun,
  Menu,
  Languages,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { usePresenceHeartbeat } from "@/lib/presence";
import type { CurrentUser } from "@/lib/types";
import { cn } from "@/lib/utils";

function NavLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const [location] = useLocation();
  const { t } = useI18n();
  const items = [
    { href: "/chat", label: t("nav.chat"), icon: MessageSquare },
    { href: "/profile", label: t("nav.profile"), icon: UserIcon },
    ...(isAdmin ? [{ href: "/admin", label: t("nav.admin"), icon: ShieldCheck }] : []),
  ];

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = location === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <a
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover-elevate",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80",
              )}
              data-testid={`nav-${item.href.replace("/", "")}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </a>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { t, toggle: toggleLang, lang } = useI18n();
  const { data: me } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: () => apiFetch<CurrentUser>("/me"),
  });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold">
          AY
        </div>
        <div>
          <div className="text-sm font-semibold leading-none">{t("app.title")}</div>
          <div className="text-xs text-sidebar-foreground/70 mt-1">
            {lang === "ar" ? "مجتمع طلاب" : "Chat Community"}
          </div>
        </div>
      </div>

      <div className="px-3 pt-2 flex-1 overflow-auto">
        <NavLinks isAdmin={!!me?.isAdmin} onNavigate={onNavigate} />
      </div>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground"
          onClick={toggleLang}
          data-testid="button-lang-toggle"
        >
          <Languages className="h-4 w-4" />
          {t("lang.toggle")}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground"
          onClick={toggle}
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? t("theme.light") : t("theme.dark")}
        </Button>

        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarImage src={me?.avatarUrl ?? undefined} />
            <AvatarFallback>
              {(me?.anonymousName ?? "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" data-testid="text-current-name">
              {me?.anonymousName ?? "..."}
            </div>
            <div className="text-xs text-sidebar-foreground/60 truncate">
              {me?.grade ?? (lang === "ar" ? "اضبط صفك" : "Set your grade")}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground/70"
            onClick={() => signOut()}
            data-testid="button-sign-out"
            title={t("auth.signOut")}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, toggle: toggleLang } = useI18n();
  const [open, setOpen] = useState(false);
  usePresenceHeartbeat();
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between border-b border-border px-3 py-2 bg-card">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              AY
            </div>
            <span className="font-semibold text-sm truncate max-w-[140px]">
              {t("app.title")}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLang}
            data-testid="button-lang-toggle-mobile"
          >
            <Languages className="h-5 w-5" />
          </Button>
        </header>

        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
