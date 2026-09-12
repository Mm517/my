import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Trophy, Trash2, BookOpen, Save, GraduationCap } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch } from "@/lib/api";
import type { Challenge, CurrentUser, StudyPlan } from "@/lib/types";

const DIFF_COLORS: Record<Challenge["difficulty"], string> = {
  easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  hard: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

function ProfileSettings({ me }: { me: CurrentUser }) {
  const qc = useQueryClient();
  const [grade, setGrade] = useState(me.grade ?? "");

  const save = useMutation({
    mutationFn: (body: { grade?: string }) =>
      apiFetch<CurrentUser>("/me/profile", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile updated");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" /> Your details
        </CardTitle>
        <CardDescription>
          Public name in chat: <span className="font-mono text-foreground">{me.anonymousName}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="grade">Grade / class</Label>
          <Input
            id="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="e.g. Grade 11 - Science"
            data-testid="input-grade"
          />
        </div>
        <Button onClick={() => save.mutate({ grade })} disabled={save.isPending} data-testid="button-save-profile">
          <Save className="h-4 w-4" /> Save
        </Button>
      </CardContent>
    </Card>
  );
}

function StudyPlansSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "", details: "", targetDate: "" });

  const { data: plans } = useQuery<StudyPlan[]>({
    queryKey: ["study-plans"],
    queryFn: () => apiFetch<StudyPlan[]>("/study-plans"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<StudyPlan>("/study-plans", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          subject: form.subject || null,
          details: form.details,
          targetDate: form.targetDate || null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-plans"] });
      setOpen(false);
      setForm({ title: "", subject: "", details: "", targetDate: "" });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/study-plans/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-plans"] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Study plans
          </CardTitle>
          <CardDescription>Private — only you and admins can see these.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-plan">
              <Plus className="h-4 w-4" /> New plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New study plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="plan-title">Title</Label>
                <Input
                  id="plan-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  data-testid="input-plan-title"
                />
              </div>
              <div>
                <Label htmlFor="plan-subject">Subject</Label>
                <Input
                  id="plan-subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Physics"
                />
              </div>
              <div>
                <Label htmlFor="plan-details">Details</Label>
                <Textarea
                  id="plan-details"
                  rows={4}
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="plan-date">Target date</Label>
                <Input
                  id="plan-date"
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={!form.title || !form.details || create.isPending}
                data-testid="button-save-plan"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {plans && plans.length > 0 ? (
          <div className="space-y-3">
            {plans.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-border p-4 hover-elevate"
                data-testid={`plan-${p.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{p.title}</div>
                    {p.subject && (
                      <Badge variant="secondary" className="mt-1">
                        {p.subject}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => del.mutate(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{p.details}</p>
                {p.targetDate && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Target: {format(new Date(p.targetDate), "PP")}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No study plans yet. Create one to get started.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ChallengesSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; details: string; difficulty: Challenge["difficulty"] }>({
    title: "",
    details: "",
    difficulty: "medium",
  });

  const { data: challenges } = useQuery<Challenge[]>({
    queryKey: ["challenges"],
    queryFn: () => apiFetch<Challenge[]>("/challenges"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Challenge>("/challenges", {
        method: "POST",
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenges"] });
      setOpen(false);
      setForm({ title: "", details: "", difficulty: "medium" });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/challenges/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenges"] }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Challenges
          </CardTitle>
          <CardDescription>Personal study challenges to push yourself.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-challenge">
              <Plus className="h-4 w-4" /> New challenge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New challenge</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="ch-title">Title</Label>
                <Input
                  id="ch-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  data-testid="input-challenge-title"
                />
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select
                  value={form.difficulty}
                  onValueChange={(v) => setForm({ ...form, difficulty: v as Challenge["difficulty"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ch-details">Details</Label>
                <Textarea
                  id="ch-details"
                  rows={4}
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={!form.title || !form.details || create.isPending}
                data-testid="button-save-challenge"
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {challenges && challenges.length > 0 ? (
          <div className="space-y-3">
            {challenges.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-4 hover-elevate">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold">{c.title}</div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${DIFF_COLORS[c.difficulty]}`}
                    >
                      {c.difficulty}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => del.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{c.details}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No challenges yet. Set yourself a goal.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { data: me } = useQuery<CurrentUser>({
    queryKey: ["me"],
    queryFn: () => apiFetch<CurrentUser>("/me"),
  });

  if (!me) {
    return (
      <AppShell>
        <div className="p-8">Loading...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScrollArea className="h-full">
        <div className="mx-auto max-w-3xl p-4 md:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">My profile</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your details and your private study work.
            </p>
          </div>
          <ProfileSettings me={me} />
          <StudyPlansSection />
          <ChallengesSection />
        </div>
      </ScrollArea>
    </AppShell>
  );
}
