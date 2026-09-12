import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ar as arLocale } from "date-fns/locale";
import {
  Users,
  MessageSquare,
  ShieldOff,
  VolumeX,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Eye,
  Megaphone,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ImageViewer } from "@/components/ImageViewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type {
  AdminStats,
  AdminUser,
  Challenge,
  ChatMessage,
  ChatState,
  CurrentUser,
  FlaggedMessage,
  StudyPlan,
} from "@/lib/types";

function PresenceIndicator({ u }: { u: AdminUser }) {
  const { t, lang } = useI18n();
  const locale = lang === "ar" ? { locale: arLocale } : undefined;
  if (u.isOnline) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium"
        data-testid={`presence-online-${u.id}`}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 animate-pulse" />
        {t("admin.online")}
      </span>
    );
  }
  const label = u.lastSeenAt
    ? `${t("admin.lastSeen")}: ${formatDistanceToNowStrict(new Date(u.lastSeenAt), { addSuffix: true, ...locale })}`
    : `${t("admin.lastSeen")}: ${t("admin.never")}`;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-muted-foreground text-xs"
      data-testid={`presence-offline-${u.id}`}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
      {label}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-muted-foreground truncate">{label}</div>
            <div className="text-2xl sm:text-3xl font-bold mt-1">{value}</div>
          </div>
          <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChatControlsCard() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: state } = useQuery<ChatState>({
    queryKey: ["chat-state"],
    queryFn: () => apiFetch<ChatState>("/chat/state"),
  });
  const [announcement, setAnnouncement] = useState(state?.announcement ?? "");

  const update = useMutation({
    mutationFn: (body: Partial<ChatState>) =>
      apiFetch<ChatState>("/chat/state", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-state"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success(t("admin.savedToast"));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> {t("admin.chatControls")}
        </CardTitle>
        <CardDescription>{t("admin.chatControlsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-border p-4 gap-4">
          <div className="min-w-0">
            <div className="font-medium">{t("admin.chatEnabled")}</div>
            <div className="text-xs text-muted-foreground">
              {t("admin.chatEnabledDesc")}
            </div>
          </div>
          <Switch
            checked={state?.chatEnabled ?? true}
            onCheckedChange={(v) => update.mutate({ chatEnabled: v })}
            data-testid="switch-chat-enabled"
          />
        </div>
        <div>
          <Label htmlFor="announcement">{t("admin.announcement")}</Label>
          <div className="flex flex-col sm:flex-row gap-2 mt-1">
            <Input
              id="announcement"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder={t("admin.announcementPlaceholder")}
              data-testid="input-announcement"
            />
            <Button
              onClick={() => update.mutate({ announcement: announcement || null })}
              disabled={update.isPending}
              data-testid="button-save-announcement"
            >
              <Megaphone className="h-4 w-4" /> {t("common.save")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FlaggedMessagesCard() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const locale = lang === "ar" ? { locale: arLocale } : undefined;

  const { data: flagged, isLoading } = useQuery<FlaggedMessage[]>({
    queryKey: ["admin", "messages", "flagged"],
    queryFn: () => apiFetch<FlaggedMessage[]>("/admin/messages/flagged?limit=50"),
    refetchInterval: 30_000,
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/admin/messages/${id}`, { method: "DELETE" }),
    onSuccess: (_d, id) => {
      qc.setQueryData<FlaggedMessage[]>(["admin", "messages", "flagged"], (prev = []) =>
        prev.filter((m) => m.id !== id),
      );
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.success(t("admin.flaggedDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = flagged ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("admin.flaggedTitle")}
              {items.length > 0 && (
                <Badge variant="destructive" className="ms-1">
                  {items.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t("admin.flaggedDesc")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("admin.flaggedEmpty")}
          </p>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {items.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3"
                data-testid={`flagged-message-${m.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold">{m.anonymousName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {m.authorRealName}
                      </Badge>
                      <span className="opacity-60 ms-auto">
                        {formatDistanceToNowStrict(new Date(m.createdAt), {
                          addSuffix: true,
                          ...locale,
                        })}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">
                      {m.content || (
                        <em className="opacity-60">
                          {m.attachment
                            ? `[${m.attachment.kind}] ${m.attachment.name}`
                            : t("admin.flaggedNoText")}
                        </em>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => remove.mutate(m.id)}
                    disabled={remove.isPending}
                    data-testid={`button-delete-flagged-${m.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessageModerationCard() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: messages } = useQuery<ChatMessage[]>({
    queryKey: ["messages"],
    queryFn: () => apiFetch<ChatMessage[]>("/messages?limit=100"),
  });
  const { data: me } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: () => apiFetch<CurrentUser>("/me"),
  });
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ deleted: string[] }>("/messages/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (data) => {
      toast.success(`${t("admin.deletedToast")} ${data.deleted.length}`);
      setSelected(new Set());
      setSelectMode(false);
      qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> {t("admin.messagesTitle")}
            </CardTitle>
            <CardDescription>
              {selectMode
                ? `${selected.size} ${t("admin.selectedSuffix")}`
                : t("admin.messagesDesc")}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectMode && selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => bulkDelete.mutate(Array.from(selected))}
                disabled={bulkDelete.isPending}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="h-4 w-4" /> {t("admin.deleteSelected")} ({selected.size})
              </Button>
            )}
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectMode((v) => !v);
                setSelected(new Set());
              }}
              data-testid="button-select-mode"
            >
              {selectMode ? (
                <>
                  <CheckSquare className="h-4 w-4" /> {t("admin.exitSelect")}
                </>
              ) : (
                <>
                  <Square className="h-4 w-4" /> {t("admin.selectMode")}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-border rounded-lg max-h-[420px] overflow-y-auto py-2 chat-pattern">
          {messages?.length ? (
            messages.map((m, i) => {
              const prev = messages[i - 1];
              const sameAuthor =
                !!prev &&
                prev.userId === m.userId &&
                new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() <
                  5 * 60 * 1000;
              return (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  me={me}
                  prevSameAuthor={sameAuthor}
                  onReply={() => {}}
                  onImageClick={(url, name) => setViewer({ url, name })}
                  selectMode={selectMode}
                  selected={selected.has(m.id)}
                  onToggleSelect={toggle}
                />
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t("admin.noMessages")}</p>
          )}
        </div>
      </CardContent>
      <ImageViewer
        open={!!viewer}
        url={viewer?.url ?? null}
        name={viewer?.name ?? null}
        onClose={() => setViewer(null)}
      />
    </Card>
  );
}

function UserDetailsDialog({ user }: { user: AdminUser }) {
  const { t } = useI18n();
  const { data: plans } = useQuery<StudyPlan[]>({
    queryKey: ["admin", "user", user.id, "plans"],
    queryFn: () => apiFetch<StudyPlan[]>(`/admin/users/${user.id}/study-plans`),
  });
  const { data: challenges } = useQuery<Challenge[]>({
    queryKey: ["admin", "user", user.id, "challenges"],
    queryFn: () => apiFetch<Challenge[]>(`/admin/users/${user.id}/challenges`),
  });

  return (
    <Tabs defaultValue="plans" className="w-full">
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="plans">{t("admin.studyPlans")} ({plans?.length ?? 0})</TabsTrigger>
        <TabsTrigger value="challenges">{t("admin.challenges")} ({challenges?.length ?? 0})</TabsTrigger>
      </TabsList>
      <TabsContent value="plans" className="space-y-2 max-h-96 overflow-auto">
        {plans?.length ? (
          plans.map((p) => (
            <div key={p.id} className="rounded-lg border border-border p-3">
              <div className="font-semibold text-sm">{p.title}</div>
              {p.subject && <Badge variant="secondary" className="mt-1">{p.subject}</Badge>}
              <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{p.details}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">{t("admin.noStudyPlans")}</p>
        )}
      </TabsContent>
      <TabsContent value="challenges" className="space-y-2 max-h-96 overflow-auto">
        {challenges?.length ? (
          challenges.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-3">
              <div className="font-semibold text-sm">{c.title}</div>
              <Badge variant="secondary" className="mt-1">{c.difficulty}</Badge>
              <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{c.details}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">{t("admin.noChallenges")}</p>
        )}
      </TabsContent>
    </Tabs>
  );
}

function UsersTable() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: users } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<AdminUser[]>("/admin/users"),
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AdminUser> }) =>
      apiFetch<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> {t("admin.users")}
        </CardTitle>
        <CardDescription>{t("admin.usersDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        <div className="space-y-2 sm:hidden">
          {users?.map((u) => (
            <UserMobileRow key={u.id} u={u} onUpdate={(body) => update.mutate({ id: u.id, body })} />
          ))}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-2">{t("admin.user")}</th>
                <th className="text-left py-2 px-2">{t("admin.grade")}</th>
                <th className="text-right py-2 px-2">{t("admin.messages")}</th>
                <th className="text-left py-2 px-2">{t("admin.lastSeen")}</th>
                <th className="text-left py-2 px-2">{t("admin.joined")}</th>
                <th className="text-right py-2 px-2">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-b border-border" data-testid={`row-user-${u.id}`}>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      {u.isOnline ? (
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 shrink-0" title={t("admin.onlineDot")} />
                      ) : (
                        <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" title={t("admin.offlineDot")} />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{u.anonymousName}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.isAdmin && <Badge>{t("admin.adminBadge")}</Badge>}
                      {u.isBanned && <Badge variant="destructive">{t("admin.bannedBadge")}</Badge>}
                      {u.isMuted && <Badge variant="secondary">{t("admin.mutedBadge")}</Badge>}
                    </div>
                  </td>
                  <td className="py-2 px-2">{u.grade ?? "—"}</td>
                  <td className="py-2 px-2 text-right">{u.messagesSent}</td>
                  <td className="py-2 px-2"><PresenceIndicator u={u} /></td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">
                    {format(new Date(u.joinedAt), "MMM d")}
                  </td>
                  <td className="py-2 px-2">
                    <UserActions u={u} onUpdate={(body) => update.mutate({ id: u.id, body })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function UserActions({
  u,
  onUpdate,
}: {
  u: AdminUser;
  onUpdate: (body: Partial<AdminUser>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex justify-end gap-1">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title={t("admin.viewPrivate")}>
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{u.name}</DialogTitle>
          </DialogHeader>
          <UserDetailsDialog user={u} />
        </DialogContent>
      </Dialog>
      <Button
        variant="ghost"
        size="icon"
        title={u.isMuted ? t("admin.unmuteAction") : t("admin.muteAction")}
        onClick={() => onUpdate({ isMuted: !u.isMuted })}
        data-testid={`button-mute-${u.id}`}
      >
        <VolumeX className={u.isMuted ? "h-4 w-4 text-destructive" : "h-4 w-4"} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title={u.isBanned ? t("admin.unbanAction") : t("admin.banAction")}
        onClick={() => onUpdate({ isBanned: !u.isBanned })}
        data-testid={`button-ban-${u.id}`}
      >
        <ShieldOff className={u.isBanned ? "h-4 w-4 text-destructive" : "h-4 w-4"} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title={u.isAdmin ? t("admin.removeAdmin") : t("admin.makeAdmin")}
        onClick={() => onUpdate({ isAdmin: !u.isAdmin })}
      >
        {u.isAdmin ? (
          <ToggleRight className="h-4 w-4 text-primary" />
        ) : (
          <ToggleLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function UserMobileRow({
  u,
  onUpdate,
}: {
  u: AdminUser;
  onUpdate: (body: Partial<AdminUser>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="border border-border rounded-lg p-3 mx-3 sm:mx-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {u.isOnline ? (
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 shrink-0" />
            ) : (
              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
            )}
            <div className="font-medium truncate">{u.name}</div>
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">{u.anonymousName}</div>
          <div className="mt-1"><PresenceIndicator u={u} /></div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {u.isAdmin && <Badge>{t("admin.adminBadge")}</Badge>}
            {u.isBanned && <Badge variant="destructive">{t("admin.bannedBadge")}</Badge>}
            {u.isMuted && <Badge variant="secondary">{t("admin.mutedBadge")}</Badge>}
            {u.grade && <Badge variant="outline">{u.grade}</Badge>}
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-right shrink-0">
          {u.messagesSent} {t("admin.msgsAbbrev")}
          <br />
          {format(new Date(u.joinedAt), "MMM d")}
        </div>
      </div>
      <div className="mt-2 -mr-2">
        <UserActions u={u} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useI18n();
  const { data: me } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: () => apiFetch<CurrentUser>("/me"),
  });
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch<AdminStats>("/admin/stats"),
  });

  if (me && !me.isAdmin) {
    return (
      <AppShell>
        <div className="p-8 text-center">
          <ShieldOff className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg font-semibold">{t("admin.accessRequired")}</p>
          <p className="text-sm text-muted-foreground">
            {t("admin.accessDenied")}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-6xl p-3 sm:p-6 space-y-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{t("admin.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("admin.subtitle")}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={Users} label={t("admin.totalUsers")} value={stats?.totalUsers ?? "—"} />
            <StatCard
              icon={MessageSquare}
              label={t("admin.totalMessages")}
              value={stats?.totalMessages ?? "—"}
            />
            <StatCard icon={MessageSquare} label={t("admin.today")} value={stats?.messagesToday ?? "—"} />
            <StatCard icon={ShieldOff} label={t("admin.banned")} value={stats?.bannedUsers ?? "—"} />
          </div>

          <ChatControlsCard />
          <FlaggedMessagesCard />
          <MessageModerationCard />
          <UsersTable />
        </div>
      </ScrollArea>
    </AppShell>
  );
}
