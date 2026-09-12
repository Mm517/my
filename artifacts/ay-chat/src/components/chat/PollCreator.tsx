import { useState } from "react";
import { Plus, X, BarChart3 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

export type PollDraft = {
  question: string;
  options: string[];
  allowMultiple: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: PollDraft) => void;
};

export function PollCreator({ open, onOpenChange, onSubmit }: Props) {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);

  function reset() {
    setQuestion("");
    setOptions(["", ""]);
    setAllowMultiple(false);
  }

  function setOpt(i: number, v: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  }

  function addOption() {
    if (options.length >= 10) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
  const canSubmit = question.trim().length > 0 && cleanOptions.length >= 2;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      question: question.trim(),
      options: cleanOptions,
      allowMultiple,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> {t("poll.create")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="poll-question">{t("poll.question")}</Label>
            <Textarea
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("poll.questionPlaceholder")}
              maxLength={200}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("poll.options")}</Label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => setOpt(i, e.target.value)}
                    placeholder={`${t("poll.option")} ${i + 1}`}
                    maxLength={100}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={options.length <= 2}
                    onClick={() => removeOption(i)}
                    aria-label={t("poll.removeOption")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {options.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={addOption}
                >
                  <Plus className="me-1 h-4 w-4" /> {t("poll.addOption")}
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
            <div className="flex flex-col">
              <Label htmlFor="poll-multi" className="text-sm">
                {t("poll.allowMultiple")}
              </Label>
              <span className="text-[11px] opacity-60">{t("poll.allowMultipleHint")}</span>
            </div>
            <Switch
              id="poll-multi"
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {t("poll.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
