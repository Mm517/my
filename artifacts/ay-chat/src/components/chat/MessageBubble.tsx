import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import {
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Check,
  CheckCheck,
  Download,
  FileText,
  File as FileIcon,
  Reply,
  Pin,
  PinOff,
  SmilePlus,
  CornerUpLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { apiFetch, storageUrl } from "@/lib/api";
import { PollCard } from "./PollCard";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { ChatMessage, CurrentUser } from "@/lib/types";

const NAME_PALETTE = [
  "text-emerald-600 dark:text-emerald-400",
  "text-sky-600 dark:text-sky-400",
  "text-violet-600 dark:text-violet-400",
  "text-amber-600 dark:text-amber-400",
  "text-rose-600 dark:text-rose-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-indigo-600 dark:text-indigo-400",
];

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "💯"];

function colorFor(userId: string) {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return NAME_PALETTE[Math.abs(hash) % NAME_PALETTE.length];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "MMM d, HH:mm");
}

function attachmentResolvedUrl(url: string) {
  if (url.startsWith("/objects/")) return storageUrl(url);
  return url;
}

type Props = {
  msg: ChatMessage;
  me?: CurrentUser;
  prevSameAuthor: boolean;
  onReply: (msg: ChatMessage) => void;
  onImageClick: (url: string, name: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  highlight?: string;
};

const MENTION_PATTERN = /(@[\p{L}\p{N}]{1,8}\*+)/gu;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderMessageContent(
  content: string,
  meId: string | undefined,
  mentions: string[],
  highlight?: string,
) {
  const parts = content.split(MENTION_PATTERN);
  const highlightRe =
    highlight && highlight.length > 0
      ? new RegExp(`(${escapeRegex(highlight)})`, "ig")
      : null;

  function renderHighlighted(text: string, keyBase: string) {
    if (!highlightRe) return text;
    const segments = text.split(highlightRe);
    return segments.map((seg, i) =>
      highlightRe.test(seg) ? (
        <mark
          key={`${keyBase}-${i}`}
          className="bg-yellow-300/70 dark:bg-yellow-400/40 text-inherit rounded px-0.5"
        >
          {seg}
        </mark>
      ) : (
        <span key={`${keyBase}-${i}`}>{seg}</span>
      ),
    );
  }

  // String.split with a capturing group yields: [text, match, text, match, ...]
  return parts.map((part, idx) => {
    const isMention = idx % 2 === 1;
    if (isMention) {
      const isMyMention = meId != null && mentions.length > 0;
      return (
        <span
          key={idx}
          className={cn(
            "rounded px-1 font-semibold",
            isMyMention
              ? "bg-primary/25 text-primary"
              : "bg-primary/10 text-primary",
          )}
          data-testid="mention-token"
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{renderHighlighted(part, String(idx))}</span>;
  });
}

export function MessageBubble({
  msg,
  me,
  prevSameAuthor,
  onReply,
  onImageClick,
  selectMode,
  selected,
  onToggleSelect,
  highlight,
}: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const isOwn = me?.id === msg.userId;
  const canModify = isOwn || me?.isAdmin;
  const showHeader = !prevSameAuthor || msg.parent;
  const mentionsMe = !!me && Array.isArray(msg.mentions) && msg.mentions.includes(me.id);
  const seenCount = msg.seenBy?.length ?? 0;
  const deliveredCount = msg.deliveredTo?.length ?? 0;
  const receiptStatus: "sent" | "delivered" | "seen" = isOwn
    ? seenCount > 0
      ? "seen"
      : deliveredCount > 0
        ? "delivered"
        : "sent"
    : "sent";

  const editMutation = useMutation({
    mutationFn: (content: string) =>
      apiFetch<ChatMessage>(`/messages/${msg.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch<void>(`/messages/${msg.id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });

  const reactMutation = useMutation({
    mutationFn: (emoji: string) =>
      apiFetch<ChatMessage>(`/messages/${msg.id}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      }),
  });

  const pinMutation = useMutation({
    mutationFn: () =>
      apiFetch<ChatMessage>(`/messages/${msg.id}/${msg.isPinned ? "unpin" : "pin"}`, {
        method: "POST",
      }),
  });

  function handleClickContainer() {
    if (selectMode && onToggleSelect) onToggleSelect(msg.id);
  }

  return (
    <div
      className={cn(
        "group w-full px-2 sm:px-3 flex items-start gap-2",
        isOwn ? "justify-end" : "justify-start",
        prevSameAuthor ? "mt-0.5" : "mt-2",
        selectMode && "cursor-pointer",
      )}
      onClick={handleClickContainer}
      data-testid={`message-${msg.id}`}
    >
      {selectMode && (
        <div className="pt-2">
          <Checkbox
            checked={!!selected}
            onCheckedChange={() => onToggleSelect?.(msg.id)}
            data-testid={`checkbox-message-${msg.id}`}
          />
        </div>
      )}

      <div
        className={cn(
          "relative max-w-[85%] sm:max-w-[70%] rounded-xl px-3 pt-1.5 pb-1 shadow-sm",
          isOwn
            ? "bg-[hsl(var(--bubble-own))] text-[hsl(var(--bubble-own-fg))]"
            : "bg-[hsl(var(--bubble-other))] text-[hsl(var(--bubble-other-fg))]",
          showHeader && (isOwn ? "rounded-tr-sm" : "rounded-tl-sm"),
          msg.isPinned && "ring-2 ring-amber-400/60",
          mentionsMe && !isOwn && "ring-2 ring-primary/70 bg-primary/5",
        )}
      >
        {msg.isPinned && (
          <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 rounded-full p-1 shadow">
            <Pin className="h-3 w-3" />
          </div>
        )}

        {!prevSameAuthor && !isOwn && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn("font-semibold text-xs", colorFor(msg.userId))}>
              {msg.anonymousName}
            </span>
            {msg.grade && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-foreground/70">
                {msg.grade}
              </span>
            )}
          </div>
        )}

        {msg.parent && (
          <div
            className={cn(
              "mb-1.5 rounded-md border-s-4 px-2 py-1 text-[11px]",
              isOwn
                ? "bg-black/10 border-white/40"
                : "bg-black/5 dark:bg-white/5 border-primary",
            )}
          >
            <div className="font-semibold opacity-80">{msg.parent.anonymousName}</div>
            <div className="opacity-70 truncate">{msg.parent.preview}</div>
          </div>
        )}

        {editing ? (
          <div className="space-y-2 min-w-[220px]">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              rows={2}
              className="resize-none"
              data-testid={`input-edit-${msg.id}`}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => editMutation.mutate(draft)}
                disabled={editMutation.isPending || !draft.trim()}
                data-testid={`button-save-edit-${msg.id}`}
              >
                <Check className="h-3 w-3" /> {t("msg.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(msg.content);
                }}
              >
                <X className="h-3 w-3" /> {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {msg.attachment && (
              <AttachmentPreview attachment={msg.attachment} onImageClick={onImageClick} />
            )}
            {msg.content && (
              <div className="text-[14px] whitespace-pre-wrap break-words leading-snug pr-14">
                {renderMessageContent(msg.content, me?.id, msg.mentions ?? [], highlight)}
              </div>
            )}
            {msg.poll && <PollCard message={msg} poll={msg.poll} me={me} />}
            <div
              className={cn(
                "flex items-center justify-end gap-1 -mt-0.5 -mb-0.5 text-[10px]",
                isOwn
                  ? "text-[hsl(var(--bubble-own-fg))]/70"
                  : "text-foreground/55",
              )}
            >
              {msg.edited && <span className="italic">{t("msg.edited")}</span>}
              <span>{formatTime(msg.createdAt)}</span>
              {isOwn && (
                <span
                  className={cn(
                    "inline-flex items-center -me-0.5 ms-0.5",
                    receiptStatus === "seen"
                      ? "text-sky-500 dark:text-sky-400"
                      : "text-current opacity-75",
                  )}
                  title={
                    receiptStatus === "seen"
                      ? `${t("msg.seen")} · ${seenCount}`
                      : receiptStatus === "delivered"
                        ? `${t("msg.delivered")} · ${deliveredCount}`
                        : t("msg.sent")
                  }
                  data-testid={`receipt-${msg.id}-${receiptStatus}`}
                >
                  {receiptStatus === "sent" ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                  )}
                </span>
              )}
            </div>

            {msg.reactions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {msg.reactions.map((r) => {
                  const mine = me ? r.userIds.includes(me.id) : false;
                  const names = (r.users ?? []).map((u) => u.anonymousName);
                  const tooltipText =
                    names.length > 0
                      ? `${r.emoji}  ${names.join(", ")}`
                      : `${r.emoji}  ${r.count}`;
                  return (
                    <Tooltip key={r.emoji}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            reactMutation.mutate(r.emoji);
                          }}
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[11px] flex items-center gap-1 transition-colors",
                            mine
                              ? "bg-primary/25 text-foreground ring-1 ring-primary/50"
                              : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15",
                          )}
                          data-testid={`reaction-${msg.id}-${r.emoji}`}
                        >
                          <span>{r.emoji}</span>
                          <span className="font-medium">{r.count}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px]">
                        <div className="text-xs">{tooltipText}</div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!editing && !selectMode && (
          <div
            className={cn(
              "absolute -top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1",
              isOwn ? "left-1" : "right-1",
            )}
          >
            <Popover>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 w-7 rounded-full bg-background border border-border shadow flex items-center justify-center hover:bg-accent"
                  title={t("msg.react")}
                  data-testid={`button-react-${msg.id}`}
                >
                  <SmilePlus className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1.5" align={isOwn ? "start" : "end"}>
                <div className="flex gap-1">
                  {REACTION_EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        reactMutation.mutate(e);
                      }}
                      className="text-xl leading-none p-1 rounded hover:bg-accent"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onReply(msg);
              }}
              className="h-7 w-7 rounded-full bg-background border border-border shadow flex items-center justify-center hover:bg-accent"
              title={t("msg.reply")}
              data-testid={`button-reply-${msg.id}`}
            >
              <Reply className="h-3.5 w-3.5" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="h-7 w-7 rounded-full bg-background border border-border shadow flex items-center justify-center hover:bg-accent"
                  data-testid={`button-message-menu-${msg.id}`}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? "start" : "end"}>
                <DropdownMenuItem onClick={() => onReply(msg)}>
                  <CornerUpLeft className="h-3.5 w-3.5" /> {t("msg.reply")}
                </DropdownMenuItem>
                {me?.isAdmin && (
                  <DropdownMenuItem onClick={() => pinMutation.mutate()}>
                    {msg.isPinned ? (
                      <>
                        <PinOff className="h-3.5 w-3.5" /> {t("msg.unpin")}
                      </>
                    ) : (
                      <>
                        <Pin className="h-3.5 w-3.5" /> {t("msg.pin")}
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {isOwn && (
                  <DropdownMenuItem
                    onClick={() => setEditing(true)}
                    data-testid={`button-edit-${msg.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" /> {t("msg.edit")}
                  </DropdownMenuItem>
                )}
                {canModify && (
                  <DropdownMenuItem
                    onClick={() => deleteMutation.mutate()}
                    className="text-destructive focus:text-destructive"
                    data-testid={`button-delete-${msg.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t("msg.delete")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentPreview({
  attachment,
  onImageClick,
}: {
  attachment: NonNullable<ChatMessage["attachment"]>;
  onImageClick: (url: string, name: string) => void;
}) {
  const url = attachmentResolvedUrl(attachment.url);
  if (attachment.kind === "image") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onImageClick(url, attachment.name);
        }}
        className="block mb-1 cursor-zoom-in"
      >
        <img
          src={url}
          alt={attachment.name}
          className="max-h-72 rounded-lg border border-black/10 dark:border-white/10"
        />
      </button>
    );
  }
  const Icon = attachment.kind === "pdf" ? FileText : FileIcon;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mb-1 flex items-center gap-3 rounded-lg bg-black/5 dark:bg-white/10 px-3 py-2 hover:bg-black/10 dark:hover:bg-white/15 max-w-xs"
    >
      <Icon className="h-5 w-5 text-current shrink-0 opacity-80" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{attachment.name}</div>
        <div className="text-[11px] opacity-70">
          {(attachment.size / 1024).toFixed(0)} KB
        </div>
      </div>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}
