import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type ExportSpec = {
  table: string;
  columns: string[];
  orderBy: string;
};

const EXPORT_SPECS: ExportSpec[] = [
  {
    table: "users",
    columns: [
      "id",
      "clerk_id",
      "name",
      "email",
      "grade",
      "avatar_url",
      "is_admin",
      "is_banned",
      "is_muted",
      "messages_sent",
      "joined_at",
      "last_seen_at",
    ],
    orderBy: "id",
  },
  {
    table: "messages",
    columns: [
      "id",
      "user_id",
      "content",
      "attachment",
      "poll",
      "parent_id",
      "is_pinned",
      "edited",
      "filtered",
      "deleted",
      "delivered_to",
      "seen_by",
      "created_at",
    ],
    orderBy: "id",
  },
  {
    table: "message_reactions",
    columns: ["id", "message_id", "user_id", "emoji", "created_at"],
    orderBy: "id",
  },
  {
    table: "poll_votes",
    columns: ["id", "message_id", "user_id", "option_id", "created_at"],
    orderBy: "id",
  },
  {
    table: "study_plans",
    columns: [
      "id",
      "user_id",
      "title",
      "subject",
      "details",
      "target_date",
      "created_at",
    ],
    orderBy: "id",
  },
  {
    table: "challenges",
    columns: [
      "id",
      "user_id",
      "title",
      "details",
      "difficulty",
      "completed",
      "created_at",
    ],
    orderBy: "id",
  },
  {
    table: "chat_settings",
    columns: [
      "id",
      "chat_enabled",
      "announcement",
      "vapid_public_key",
      "vapid_subject",
      "updated_at",
    ],
    orderBy: "id",
  },
  {
    table: "activity_logs",
    columns: [
      "id",
      "user_id",
      "action",
      "target",
      "metadata",
      "created_at",
    ],
    orderBy: "id",
  },
  {
    table: "push_subscriptions",
    columns: [
      "id",
      "user_id",
      "endpoint",
      "p256dh",
      "auth",
      "user_agent",
      "created_at",
      "last_seen_at",
    ],
    orderBy: "id",
  },
];

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. This command only reads the legacy PostgreSQL database.",
    );
  }

  const outputDirectory = path.resolve(
    process.argv[2] ?? path.join(process.cwd(), "migration-export"),
  );
  await mkdir(outputDirectory, { recursive: true });

  const { pool } = await import("@workspace/db");
  const generatedAt = new Date().toISOString();
  const manifest: {
    source: string;
    generatedAt: string;
    readOnly: true;
    excludedColumns: string[];
    tables: Array<{ table: string; file: string; rowCount: number }>;
  } = {
    source: "legacy PostgreSQL database",
    generatedAt,
    readOnly: true,
    excludedColumns: ["chat_settings.vapid_private_key"],
    tables: [],
  };

  try {
    for (const spec of EXPORT_SPECS) {
      const columns = spec.columns.map(quoteIdentifier).join(", ");
      const table = quoteIdentifier(spec.table);
      const orderBy = quoteIdentifier(spec.orderBy);
      const result = await pool.query(
        `SELECT ${columns} FROM ${table} ORDER BY ${orderBy}`,
      );
      const file = `${spec.table}.json`;

      await writeFile(
        path.join(outputDirectory, file),
        `${JSON.stringify(result.rows, null, 2)}\n`,
        "utf8",
      );
      manifest.tables.push({
        table: spec.table,
        file,
        rowCount: result.rowCount ?? result.rows.length,
      });
    }

    await writeFile(
      path.join(outputDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
  } finally {
    await pool.end();
  }

  const totalRows = manifest.tables.reduce(
    (total, table) => total + table.rowCount,
    0,
  );
  console.log(
    `Exported ${totalRows} rows from ${manifest.tables.length} tables to ${outputDirectory}`,
  );
  console.log(
    "The export is read-only. The VAPID private key was intentionally excluded.",
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Legacy data export failed: ${message}`);
  process.exitCode = 1;
});