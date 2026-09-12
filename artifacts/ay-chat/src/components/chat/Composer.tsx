import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Paperclip, X, AtSign, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { ObjectUploader, useUpload } from "@workspace/object-storage-web";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiUrl, authHeader } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import type { Attachment, ChatMessage, ChatState, DirectoryUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PollCreator, type PollDraft } from "./PollCreator";

function classifyAttachment(mime: string): Attachment["kind"] {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "doc";
  return "file";
}

type MentionState = {
  active: boolean;
  query: string;
  start: number;
  end: number;
  highlight: number;
};

const EMPTY_MENTION: MentionState = {
  active: false,
  query: "",
  start: 0,
  end: 0,
  highlight: 0,
};

export function Composer({
  state,
  disabled,
  isAdmin,
  replyTo,
  onClearReply,
}: {
  state?: ChatState;
  disabled?: boolean;
  isAdmin?: boolean;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Attachment | null>(null);
  const [mention, setMention] = useState<MentionState>(EMPTY_MENTION);
  const [pollOpen, setPollOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();
  const { uploadFile, isUploading } = useUpload({
    supabase,
    basePath: apiUrl("/storage"),
    authHeaders: authHeader,
    onSuccess: ({ objectPath, metadata }) => {
      setPending({
        url: objectPath,
        name: metadata.name,
        size: metadata.size,
        mimeType: metadata.contentType,
        kind: classifyAttachment(metadata.contentType),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const { data: directory } = useQuery<DirectoryUser[]>({
    queryKey: ["users-directory"],
    queryFn: () => apiFetch<DirectoryUser[]>("/users/directory"),
    staleTime: 30_000,
  });

  const send = useMutation({
    mutationFn: (body: {
      content: string;
      attachment?: Attachment | null;
      parentId?: string | null;
      poll?: PollDraft | null;
    }) =>
      apiFetch<ChatMessage>("/messages", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setText("");
      setPending(null);
      onClearReply();
      qc.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [text]);

  useEffect(() => {
    if (replyTo) taRef.current?.focus();
  }, [replyTo]);

  const filteredMentions = useMemo(() => {
    if (!mention.active || !directory) return [];
    const q = mention.query.toLowerCase();
    const items = q
      ? directory.filter((u) => u.anonymousName.toLowerCase().startsWith(q))
      : directory;
    return items.slice(0, 6);
  }, [mention, directory]);

  function detectMention(value: string, caret: number) {
    // Look back from caret for an "@" that starts a mention token (preceded by start or whitespace).
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === "@") {
        const prev = i === 0 ? " " : value[i - 1];
        if (/\s/.test(prev) || i === 0) {
          const token = value.slice(i + 1, caret);
          // Allow letters, digits, and asterisks (the anonymous name format).
          if (/^[\p{L}\p{N}*]*$/u.test(token)) {
            setMention({
              active: true,
              query: token,
              start: i,
              end: caret,
              highlight: 0,
            });
            return;
          }
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    if (mention.active) setMention(EMPTY_MENTION);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    const caret = e.target.selectionStart ?? value.length;
    detectMention(value, caret);
  }

  function applyMention(user: DirectoryUser) {
    const before = text.slice(0, mention.start);
    const after = text.slice(mention.end);
    const insertion = `@${user.anonymousName} `;
    const next = `${before}${insertion}${after}`;
    setText(next);
    setMention(EMPTY_MENTION);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      const pos = before.length + insertion.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function submit() {
    const content = text.trim();
    if (!content && !pending) return;
    send.mutate({ content, attachment: pending, parentId: replyTo?.id ?? null });
    setMention(EMPTY_MENTION);
  }

  function submitPoll(draft: PollDraft) {
    send.mutate({
      content: "",
      attachment: null,
      parentId: replyTo?.id ?? null,
      poll: draft,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention.active && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((m) => ({
          ...m,
          highlight: (m.highlight + 1) % filteredMentions.length,
        }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention((m) => ({
          ...m,
          highlight: (m.highlight - 1 + filteredMentions.length) % filteredMentions.length,
        }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyMention(filteredMentions[mention.highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(EMPTY_MENTION);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const chatLockedForUser = !!state && !state.chatEnabled && !isAdmin;
  const chatDisabled = disabled || chatLockedForUser;
  const showMentionPopup = mention.active && filteredMentions.length > 0;

  return (
    <div className="border-t border-border bg-card px-3 py-3 relative">
      {state && !state.chatEnabled && !chatLockedForUser && (
        <div className="mb-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {t("chat.disabledAdminOnly")}
        </div>
      )}
      {chatLockedForUser && (
        <div className="mb-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          {t("chat.disabled")}
        </div>
      )}

      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-md border-s-4 border-primary bg-primary/5 px-3 py-2 text-xs">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-primary">
              {t("chat.replying")} {replyTo.anonymousName}
            </div>
            <div className="text-muted-foreground truncate">
              {replyTo.content || (replyTo.attachment ? `[${replyTo.attachment.kind}] ${replyTo.attachment.name}` : "")}
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClearReply}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {pending && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs">
          <Paperclip className="h-3.5 w-3.5 text-primary" />
          <span className="truncate flex-1">{pending.name}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            onClick={() => setPending(null)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      )}

      {showMentionPopup && (
        <div
          className="absolute bottom-full mb-1 left-3 right-3 max-w-sm bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-20"
          data-testid="mention-popup"
        >
          <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border flex items-center gap-1.5">
            <AtSign className="h-3 w-3" />
            <span>{t("composer.mentionHint")}</span>
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {filteredMentions.map((u, i) => (
              <li key={u.anonymousName}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyMention(u);
                  }}
                  onMouseEnter={() => setMention((m) => ({ ...m, highlight: i }))}
                  className={cn(
                    "w-full text-start flex items-center gap-2 px-3 py-2 text-sm",
                    i === mention.highlight ? "bg-accent" : "hover:bg-accent/60",
                  )}
                  data-testid={`mention-option-${u.anonymousName}`}
                >
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full shrink-0",
                      u.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
                    )}
                  />
                  <span className="font-mono font-medium">@{u.anonymousName}</span>
                  {u.grade && (
                    <span className="text-[10px] text-muted-foreground ms-auto">
                      {u.grade}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-end gap-2">
        <ObjectUploader
          maxFileSize={10 * 1024 * 1024}
          disabled={chatDisabled || isUploading}
          onFileSelected={async (file) => {
            await uploadFile(file);
          }}
          buttonClassName={cn(
            "inline-flex items-center justify-center rounded-md h-10 w-10 hover-elevate active-elevate-2 text-muted-foreground",
            chatDisabled && "opacity-50 pointer-events-none",
          )}
        >
          <Paperclip className="h-5 w-5" />
        </ObjectUploader>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-muted-foreground"
          disabled={!!chatDisabled}
          onClick={() => setPollOpen(true)}
          aria-label={t("poll.create")}
          data-testid="button-create-poll"
        >
          <BarChart3 className="h-5 w-5" />
        </Button>

        <Textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setMention(EMPTY_MENTION), 150)}
          placeholder={chatDisabled ? t("chat.disabled") : t("chat.placeholder")}
          disabled={!!chatDisabled}
          className="resize-none min-h-10 max-h-40"
          data-testid="input-composer"
        />
        <Button
          onClick={submit}
          disabled={send.isPending || !!chatDisabled || (!text.trim() && !pending)}
          size="icon"
          className="h-10 w-10 shrink-0"
          data-testid="button-send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <PollCreator open={pollOpen} onOpenChange={setPollOpen} onSubmit={submitPoll} />
    </div>
  );
}
