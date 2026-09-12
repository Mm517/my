import { useState } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/lib/theme";
import { LanguageProvider } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { IntroSplash } from "@/components/IntroSplash";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SignInForm, SignUpForm } from "@/pages/auth-forms";

import LandingPage from "@/pages/landing";
import ChatPage from "@/pages/chat";
import ProfilePage from "@/pages/profile";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      {mode === "sign-in" ? (
        <SignInForm onSwitchToSignUp={() => setMode("sign-up")} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setMode("sign-in")} />
      )}
    </div>
  );
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <Redirect to="/chat" /> : <LandingPage />;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/" component={HomeRoute} />
          <Route path="/sign-in">
            {isLoaded && isSignedIn ? <Redirect to="/chat" /> : <AuthPage />}
          </Route>
          <Route path="/sign-up">
            {isLoaded && isSignedIn ? <Redirect to="/chat" /> : <AuthPage />}
          </Route>
          <Route path="/chat">
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          </Route>
          <Route path="/profile">
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          </Route>
          <Route path="/admin">
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          </Route>
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <IntroSplash>
          <WouterRouter base={basePath}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </WouterRouter>
        </IntroSplash>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
