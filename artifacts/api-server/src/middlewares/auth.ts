import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { anonymizeName } from "../lib/anonymize";
import type { Profile as DbProfile } from "@workspace/db";

/**
 * Row shape of public.profiles as defined in
 * supabase/migrations/001_initial_schema.sql
 */
export interface Profile {
  id: string; // uuid, references auth.users(id)
  display_name: string;
  username: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  grade: string | null;
  role: "user" | "admin";
  is_banned: boolean;
  is_muted: boolean;
  messages_sent: number;
  joined_at: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Profile;
    }
  }
}

/**
 * Verifies the Supabase access token sent as `Authorization: Bearer <jwt>`
 * and loads the matching public.profiles row.
 *
 * The profiles row is created automatically by the `on_auth_user_created`
 * trigger the moment a user signs up in Supabase Auth — there is no manual
 * "create user locally" step anymore (that used to live in this file for Clerk).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      req.log.error({ err: profileError }, "failed to load profile");
      res.status(500).json({ error: "Auth failed" });
      return;
    }

    if (!profile) {
      // Trigger hasn't run yet (rare race right after signUp) — retry once.
      const { data: retried, error: retryError } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();
      if (retryError || !retried) {
        res.status(404).json({ error: "Profile not found yet, retry shortly" });
        return;
      }
      req.user = retried as Profile;
      next();
      return;
    }

    if (profile.is_banned) {
      res.status(403).json({ error: "Account banned" });
      return;
    }

    req.user = profile as Profile;
    next();
  } catch (err) {
    req.log.error({ err }, "auth middleware error");
    res.status(500).json({ error: "Auth failed" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

export function publicUser(user: Profile | DbProfile) {
  const isDbProfile = "displayName" in user;
  const displayName = isDbProfile ? user.displayName : user.display_name;
  const avatarUrl = isDbProfile ? user.avatarUrl : user.avatar_url;
  const isBanned = isDbProfile ? user.isBanned : user.is_banned;
  const isMuted = isDbProfile ? user.isMuted : user.is_muted;
  const messagesSent = isDbProfile ? user.messagesSent : user.messages_sent;
  const joinedAt = isDbProfile ? user.joinedAt : user.joined_at;
  return {
    id: user.id,
    name: displayName,
    anonymousName: anonymizeName(displayName),
    username: user.username,
    grade: user.grade,
    avatarUrl,
    isAdmin: user.role === "admin",
    isBanned,
    isMuted,
    messagesSent,
    joinedAt: joinedAt instanceof Date ? joinedAt.toISOString() : joinedAt,
  };
}
