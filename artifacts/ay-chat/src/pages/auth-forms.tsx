import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Plain email/password forms replacing Clerk's prebuilt <SignIn>/<SignUp>.
 * Supabase Auth has no equivalent hosted UI component, so this is a small
 * hand-rolled form on top of `useAuth()` (see src/lib/auth.tsx).
 */

export function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const { signInWithPassword, resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const { error } = await signInWithPassword(email, password);
    setBusy(false);
    if (error) setError(error);
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first");
      return;
    }
    setBusy(true);
    const { error } = await resetPasswordForEmail(email);
    setBusy(false);
    if (error) setError(error);
    else setInfo("Password reset email sent — check your inbox.");
  }

  return (
    <Card className="w-[440px] max-w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
        <CardDescription>Sign in to Abdallah Yahia Chat</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {info && (
            <Alert>
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signin-password">Password</Label>
            <Input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-primary hover:text-primary/80 font-medium"
              onClick={handleForgotPassword}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="text-primary hover:text-primary/80 font-medium"
              onClick={onSwitchToSignUp}
            >
              Create account
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const { signUpWithPassword } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error, needsEmailConfirmation } = await signUpWithPassword(
      email,
      password,
      displayName,
    );
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (needsEmailConfirmation) {
      setConfirmationSent(true);
    }
    // else: onAuthStateChange fires automatically and the router redirects to /chat
  }

  if (confirmationSent) {
    return (
      <Card className="w-[440px] max-w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to {email}. Confirm it, then sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={onSwitchToSignIn}>
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-[440px] max-w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Join the community</CardTitle>
        <CardDescription>Create your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="signup-name">Display name</Label>
            <Input
              id="signup-name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
          <div className="text-center text-sm">
            <button
              type="button"
              className="text-primary hover:text-primary/80 font-medium"
              onClick={onSwitchToSignIn}
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
