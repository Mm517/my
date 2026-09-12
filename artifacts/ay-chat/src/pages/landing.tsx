import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { Moon, Sun, MessageSquare, Users, BookOpen, Trophy, Shield } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function Feature({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 hover-elevate">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

export default function LandingPage() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              AY
            </div>
            <span className="font-semibold">Abdallah Yahia Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} data-testid="button-theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/sign-in">
              <Button variant="ghost" data-testid="button-signin">Sign in</Button>
            </Link>
            <Link href="/sign-up">
              <Button data-testid="button-signup">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          A safe community for serious students
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-tight">
          Study, share, and grow with your{" "}
          <span className="text-primary">classmates</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Join Abdallah Yahia's private student community. Chat anonymously,
          share notes, plan your study schedule, and take on weekly challenges —
          all in one focused space.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/sign-up">
            <Button size="lg" data-testid="button-cta-signup">Create your account</Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" data-testid="button-cta-signin">I already have an account</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Feature
            icon={MessageSquare}
            title="Anonymous group chat"
            body="Talk freely with the community using anonymous handles like Mo***. Real names stay private."
          />
          <Feature
            icon={Users}
            title="Real-time presence"
            body="Messages stream live with Socket.io — no refresh needed. Edit and delete your own posts."
          />
          <Feature
            icon={BookOpen}
            title="Private study plans"
            body="Track your goals, subjects, and target dates. Only you and your teacher can see them."
          />
          <Feature
            icon={Trophy}
            title="Personal challenges"
            body="Set easy, medium, or hard challenges and check them off as you complete them."
          />
          <Feature
            icon={Shield}
            title="Moderated space"
            body="A built-in profanity filter, mute and ban tools keep the community kind and on-topic."
          />
          <Feature
            icon={Shield}
            title="File sharing"
            body="Drop images, PDFs and Word docs straight into chat — securely stored in the cloud."
          />
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Abdallah Yahia Chat · Built for students
        <span className="hidden">{basePath}</span>
      </footer>
    </div>
  );
}
