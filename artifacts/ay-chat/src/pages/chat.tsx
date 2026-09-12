import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Hash, Megaphone, Pin, Users, Bell, BellRing, BellOff, Search, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer } from "@/components/chat/Composer";
import { ImageViewer } from "@/components/ImageViewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api";
import { useChatRealtime } from "@/hooks/useChatRealtime";
import { useI18n } from "@/lib/i18n";
import {
  notificationsEnabled,
  notificationsSupported,
  requestNotifications,
} from "@/lib/notifications";
import {
  attachPushSwListener,
  pushSupported,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import type { ChatMessage, ChatState, CurrentUser } from "@/lib/types";

export default function ChatPage() {
  useChatRealtime();
  const { t } = useI18n();
  const qc = useQueryClient();

  const { data: me } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: () => apiFetch<CurrentUser>("/me"),
  });

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["messages"],
    queryFn: () => apiFetch<ChatMessage[]>("/messages?limit=100"),
  });

  const { data: state } = useQuery<ChatState>({
    queryKey: ["chat-state"],
    queryFn: () => apiFetch<ChatState>("/chat/state"),
  });

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);
  const [notifOn, setNotifOn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Smooth-scroll to a specific message and briefly highlight it. Used by
  // the pinned-messages drawer so a tap jumps the user straight to the
  // original message in the chat list.
  const scrollToMessage = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary/60", "rounded-md");
    window.setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary/60", "rounded-md");
    }, 1500);
  }, []);

  useEffect(() => {
    setNotifOn(notificationsEnabled());
    // If the user already granted permission, make sure the SW is registered
    // and our push subscription is current — without prompting again.
    if (pushSupported() && Notification.permission === "granted") {
      void registerServiceWorker().then(() => subscribeToPush());
    }
    attachPushSwListener();
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (searchQuery) return;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages?.length, searchQuery]);

  // Mark messages from other users as seen when the chat tab is open and
  // visible. Re-runs whenever a new message arrives or the tab regains focus.
  const markSeen = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const msgs = qc.getQueryData<ChatMessage[]>(["messages"]) ?? [];
    const meId = me?.id;
    if (!meId) return;
    const ids = msgs
      .filter((m) => m.userId !== meId && !(m.seenBy ?? []).includes(meId))
      .map((m) => m.id);
    if (ids.length === 0) return;
    apiFetch("/messages/receipts/seen", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }).catch(() => {
      /* ignore transient errors */
    });
  }, [me?.id, qc]);

  useEffect(() => {
    markSeen();
  }, [markSeen, messages?.length]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") markSeen();
    }
    window.addEventListener("focus", markSeen);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", markSeen);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [markSeen]);

  const pinned = (messages ?? []).filter((m) => m.isPinned);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const visibleMessages = useMemo(() => {
    if (!messages) return [];
    if (!trimmedQuery) return messages;
    return messages.filter((m) => {
      if (m.content && m.content.toLowerCase().includes(trimmedQuery)) return true;
      if (m.anonymousName.toLowerCase().includes(trimmedQuery)) return true;
      if (m.attachment && m.attachment.name.toLowerCase().includes(trimmedQuery)) return true;
      return false;
    });
  }, [messages, trimmedQuery]);

  async function enableNotif() {
    if (!notificationsSupported()) return;
    const ok = await requestNotifications();
    setNotifOn(ok);
    if (ok && pushSupported()) {
      void subscribeToPush();
    }
  }

  async function disableNotif() {
    if (!notificationsSupported()) return;
    await unsubscribeFromPush();
    setNotifOn(false);
    try {
      window.localStorage.setItem("ay-chat:notif-enabled", "false");
    } catch {
      /* ignore */
    }
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
  }

  return (
    <AppShell>
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border px-3 py-2.5 flex items-center gap-3 bg-card">
          <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{t("chat.title")}</div>
            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {state?.onlineCount ?? 0}
                </span>
                <span>{t("chat.online")}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {state?.memberCount ?? "—"} {t("chat.members")}
              </span>
              {state && !state.chatEnabled && (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  · {t("chat.disabledAdminOnly")}
                </span>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen((v) => !v)}
            title={t("chat.search")}
            data-testid="button-search-toggle"
            className="h-9 w-9"
          >
            <Search className={`h-4 w-4 ${searchOpen ? "text-primary" : ""}`} />
          </Button>

          {pinned.length > 0 && (
            <Sheet open={pinnedOpen} onOpenChange={setPinnedOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 px-2.5 h-9 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  data-testid="button-pinned"
                >
                  <Pin className="h-3.5 w-3.5 fill-current" />
                  <span className="text-xs font-semibold">{pinned.length}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[360px] sm:w-[420px] p-0 flex flex-col">
                <SheetHeader className="px-5 pt-5 pb-3 border-b border-border bg-gradient-to-b from-amber-500/10 to-transparent">
                  <SheetTitle className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Pin className="h-4 w-4 fill-current" />
                    </span>
                    {t("chat.viewPinned")}
                    <span className="ms-auto text-xs font-normal opacity-60">
                      {pinned.length}
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
                  {pinned.map((p) => {
                    const initials = p.anonymousName.slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPinnedOpen(false);
                          window.setTimeout(() => scrollToMessage(p.id), 120);
                        }}
                        className="group w-full text-start rounded-xl border border-border bg-card p-3.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm transition-all"
                        data-testid={`pinned-item-${p.id}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold truncate">
                                {p.anonymousName}
                              </span>
                              <Pin className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                            </div>
                            <div className="text-sm mt-1 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                              {p.content}
                            </div>
                            {p.attachment && (
                              <div className="text-[11px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
                                <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground" />
                                {p.attachment.name}
                              </div>
                            )}
                            <div className="mt-2 text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              {t("chat.tapToJump")} →
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          )}

          {notificationsSupported() && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title={notifOn ? t("notif.enabled") : t("notif.enable")}
                  data-testid="button-notifications"
                  className={`relative h-9 w-9 rounded-full transition-all ${
                    notifOn
                      ? "bg-primary/10 hover:bg-primary/20 ring-1 ring-primary/30"
                      : "hover:bg-muted"
                  }`}
                >
                  {notifOn ? (
                    <BellRing className="h-4 w-4 text-primary" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  {notifOn && (
                    <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-80 p-0 overflow-hidden rounded-2xl border-border/60 shadow-xl"
              >
                <div
                  className={`px-4 pt-4 pb-3 border-b border-border ${
                    notifOn
                      ? "bg-gradient-to-br from-primary/15 via-primary/5 to-transparent"
                      : "bg-gradient-to-br from-muted/60 to-transparent"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${
                        notifOn
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {notifOn ? (
                        <BellRing className="h-5 w-5" />
                      ) : (
                        <BellOff className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-tight">
                        {t("notif.menuTitle")}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground leading-snug">
                        {t("notif.menuDesc")}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <label
                    htmlFor="notif-toggle"
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {t("notif.toggleLabel")}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            notifOn
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-muted-foreground/40"
                          }`}
                        />
                        {notifOn ? t("notif.statusOn") : t("notif.statusOff")}
                      </div>
                    </div>
                    <Switch
                      id="notif-toggle"
                      checked={notifOn}
                      onCheckedChange={(v) => {
                        if (v) void enableNotif();
                        else void disableNotif();
                      }}
                      data-testid="switch-notifications"
                    />
                  </label>
                  <p className="mt-3 px-1 text-[11px] text-muted-foreground leading-relaxed">
                    {t("notif.helper")}
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {me?.isMuted && (
            <span className="text-[11px] px-2 py-1 rounded bg-destructive/15 text-destructive font-medium">
              {t("chat.youMuted")}
            </span>
          )}
          {me?.isBanned && (
            <span className="text-[11px] px-2 py-1 rounded bg-destructive/15 text-destructive font-medium">
              {t("chat.youBanned")}
            </span>
          )}
        </div>

        {searchOpen && (
          <div className="border-b border-border bg-card/80 px-3 py-2 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("chat.searchPlaceholder")}
              className="h-8 flex-1"
              data-testid="input-search"
            />
            {trimmedQuery && (
              <span className="text-xs text-muted-foreground shrink-0" data-testid="text-search-count">
                {visibleMessages.length} {t("chat.searchResults")}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeSearch}
              title={t("chat.searchClear")}
              className="h-8 w-8"
              data-testid="button-search-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {state?.announcement && !searchOpen && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center gap-2 text-sm">
            <Megaphone className="h-4 w-4 text-primary shrink-0" />
            <span className="text-foreground">{state.announcement}</span>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 chat-pattern">
          {isLoading ? (
            <div className="space-y-3 px-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleMessages.length > 0 ? (
            <div className="pb-2">
              {visibleMessages.map((m, i) => {
                const prev = visibleMessages[i - 1];
                const sameAuthor =
                  !trimmedQuery &&
                  !!prev &&
                  prev.userId === m.userId &&
                  new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
                    5 * 60 * 1000;
                return (
                  <div
                    key={m.id}
                    id={`msg-${m.id}`}
                    className="scroll-mt-24 transition-shadow"
                  >
                    <MessageBubble
                      msg={m}
                      me={me}
                      prevSameAuthor={sameAuthor}
                      onReply={(target) => setReplyTo(target)}
                      onImageClick={(url, name) => setViewer({ url, name })}
                      highlight={trimmedQuery || undefined}
                    />
                  </div>
                );
              })}
            </div>
          ) : trimmedQuery ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Search className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm">{t("chat.searchNoResults")}</p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Hash className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">{t("chat.empty")}</p>
              <p className="text-sm">{t("chat.emptySub")}</p>
            </div>
          )}
        </div>

        <Composer
          state={state}
          disabled={me?.isBanned || me?.isMuted}
          isAdmin={me?.isAdmin}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      </div>

      <ImageViewer
        open={!!viewer}
        url={viewer?.url ?? null}
        name={viewer?.name ?? null}
        onClose={() => setViewer(null)}
      />
    </AppShell>
  );
}
