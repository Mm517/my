import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ChatMessage, CurrentUser, Poll } from "@/lib/types";

type Props = {
  message: ChatMessage;
  poll: Poll;
  me: CurrentUser | undefined;
};

export function PollCard({ message, poll, me }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const isAuthor = me?.id === message.userId;
  const isAdmin = me?.isAdmin ?? false;
  const canClose = !poll.isClosed && (isAuthor || isAdmin);
  const [pending, setPending] = useState<Set<string>>(new Set(poll.myVotes));

  const voteMutation = useMutation({
    mutationFn: (optionIds: string[]) =>
      apiFetch<ChatMessage>(`/messages/${message.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ optionIds }),
      }),
    onSuccess: (updated) => {
      qc.setQueryData<ChatMessage[]>(["messages"], (prev = []) =>
        prev.map((m) => (m.id === updated.id ? updated : m)),
      );
      setPending(new Set(updated.poll?.myVotes ?? []));
    },
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      apiFetch<ChatMessage>(`/messages/${message.id}/poll/close`, {
        method: "POST",
      }),
    onSuccess: (updated) => {
      qc.setQueryData<ChatMessage[]>(["messages"], (prev = []) =>
        prev.map((m) => (m.id === updated.id ? updated : m)),
      );
    },
  });

  function toggle(optionId: string) {
    if (poll.isClosed || !me) return;
    let next: string[];
    if (poll.allowMultiple) {
      const set = new Set(pending);
      if (set.has(optionId)) set.delete(optionId);
      else set.add(optionId);
      next = Array.from(set);
    } else {
      next = pending.has(optionId) ? [] : [optionId];
    }
    setPending(new Set(next));
    voteMutation.mutate(next);
  }

  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const youVoted = pending.size > 0;

  return (
    <div className="mt-2 w-full max-w-md rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="mb-2 flex items-start gap-2">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug break-words">{poll.question}</p>
          <p className="mt-0.5 text-[11px] opacity-60">
            {poll.allowMultiple ? t("poll.multipleHint") : t("poll.singleHint")}
            {poll.isClosed && (
              <span className="ms-1 inline-flex items-center gap-0.5 rounded bg-muted/60 px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                <Lock className="h-2.5 w-2.5" /> {t("poll.closed")}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
          const selected = pending.has(opt.id);
          const winning = poll.isClosed && opt.votes > 0 && opt.votes === Math.max(...poll.options.map((o) => o.votes));
          return (
            <Tooltip key={opt.id} delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={poll.isClosed || !me || voteMutation.isPending}
                  onClick={() => toggle(opt.id)}
                  className={cn(
                    "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-start transition-colors",
                    "disabled:cursor-not-allowed",
                    selected
                      ? "border-primary/70 bg-primary/10"
                      : "border-border/50 hover:bg-muted/40",
                    winning && "ring-1 ring-primary/40",
                  )}
                  data-testid={`poll-option-${opt.id}`}
                >
                  <div
                    className={cn(
                      "absolute inset-y-0 start-0 transition-all",
                      selected ? "bg-primary/20" : "bg-muted/50",
                    )}
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                  <div className="relative flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        poll.allowMultiple ? "rounded-sm" : "rounded-full",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                      )}
                    >
                      {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                    </div>
                    <span className="flex-1 text-sm break-words">{opt.text}</span>
                    <span className="shrink-0 text-xs font-medium opacity-80 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                </button>
              </TooltipTrigger>
              {opt.voters.length > 0 && (
                <TooltipContent side="top" className="max-w-xs">
                  <div className="text-xs">
                    <div className="mb-0.5 font-semibold">
                      {opt.votes} {opt.votes === 1 ? t("poll.vote") : t("poll.votes")}
                    </div>
                    <div className="opacity-80">
                      {opt.voters
                        .slice(0, 8)
                        .map((v) => v.anonymousName)
                        .join(", ")}
                      {opt.voters.length > 8 && ` +${opt.voters.length - 8}`}
                    </div>
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] opacity-70">
        <span>
          {poll.totalVoters} {poll.totalVoters === 1 ? t("poll.voter") : t("poll.voters")}
          {youVoted && ` · ${t("poll.youVoted")}`}
        </span>
        {canClose && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => closeMutation.mutate()}
            disabled={closeMutation.isPending}
          >
            <Lock className="me-1 h-3 w-3" /> {t("poll.close")}
          </Button>
        )}
      </div>
    </div>
  );
}
