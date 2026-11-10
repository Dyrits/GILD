import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";

const migrations = {
  "0001_first_slice": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE missions (
      id TEXT PRIMARY KEY,
      top_thread_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL
    )`;
    yield* sql`CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      parent_id TEXT REFERENCES threads(id),
      state TEXT NOT NULL,
      generation INTEGER NOT NULL DEFAULT 0
    )`;
    yield* sql`CREATE TABLE turns (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id),
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    )`;
    yield* sql`CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      thread_id TEXT NOT NULL REFERENCES threads(id),
      sender_kind TEXT NOT NULL,
      text TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      sent_at INTEGER NOT NULL,
      delivered_turn_id TEXT REFERENCES turns(id),
      UNIQUE (thread_id, sequence)
    )`;
    yield* sql`CREATE TABLE command_outcomes (
      request_id TEXT PRIMARY KEY,
      request_tag TEXT NOT NULL,
      outcome TEXT NOT NULL
    )`;
  }),
  "0002_claude_code_chat": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN model TEXT NOT NULL DEFAULT 'default'`;
    yield* sql`ALTER TABLE threads ADD COLUMN effort TEXT NOT NULL DEFAULT 'default'`;
    yield* sql`ALTER TABLE threads ADD COLUMN session_id TEXT`;
    yield* sql`ALTER TABLE threads ADD COLUMN failure TEXT`;
    yield* sql`CREATE TABLE usage (
      turn_id TEXT PRIMARY KEY REFERENCES turns(id),
      mission_id TEXT NOT NULL REFERENCES missions(id),
      input INTEGER NOT NULL,
      output INTEGER NOT NULL,
      cache_read INTEGER NOT NULL,
      cache_creation INTEGER NOT NULL
    )`;
    yield* sql`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
  }),
  // Boolean names carry a prefix (documentation/conventions.md); keeps the saved choice.
  "0003_boolean_setting_names": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE settings SET value = json_set(json_remove(value, '$.streamReplies'), '$.shouldStreamReplies',
        json(CASE WHEN json_extract(value, '$.streamReplies') THEN 'true' ELSE 'false' END))
      WHERE key = 'settings' AND json_type(value, '$.streamReplies') IS NOT NULL`;
  }),
  // Batch 3 (CHG-0031): approval questions, standing permissions, and the approval level.
  "0004_action_approval": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE questions (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      thread_id TEXT NOT NULL REFERENCES threads(id),
      source TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT NOT NULL,
      pattern TEXT,
      permission TEXT,
      asked_at INTEGER NOT NULL,
      outcome TEXT,
      message TEXT,
      device TEXT,
      resolved_at INTEGER
    )`;
    yield* sql`CREATE INDEX questions_by_thread ON questions (thread_id, asked_at)`;
    yield* sql`CREATE TABLE standing_permissions (
      id TEXT PRIMARY KEY,
      mission_id TEXT REFERENCES missions(id),
      sentence TEXT NOT NULL,
      pattern TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`;
    yield* sql`UPDATE settings SET value = json_set(value, '$.approvalLevel', 'RiskyOnly')
      WHERE key = 'settings' AND json_type(value, '$.approvalLevel') IS NULL`;
  }),
  // Workspace batch: folders threads work in, the roots they are chosen from, and workspace-scoped permissions.
  "0005_workspaces": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE browsable_roots (path TEXT PRIMARY KEY, added_at INTEGER NOT NULL)`;
    yield* sql`CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )`;
    yield* sql`ALTER TABLE threads ADD COLUMN workspace_id TEXT REFERENCES workspaces(id)`;
    yield* sql`ALTER TABLE standing_permissions ADD COLUMN workspace_id TEXT REFERENCES workspaces(id)`;
  }),
  // Retry on a missing workspace folder (CHG-0034): what holds a thread in Attention besides a question.
  "0006_thread_blocker": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN blocker TEXT`;
  }),
  // Thread tree core (CHG-0037): thread titles and openers, results, and messages between threads.
  "0007_thread_tree": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN title TEXT NOT NULL DEFAULT ''`;
    yield* sql`ALTER TABLE threads ADD COLUMN is_opened_by_agent INTEGER NOT NULL DEFAULT 0`;
    // The turn in which the thread reported its result; that turn ends it Done.
    yield* sql`ALTER TABLE threads ADD COLUMN reported_turn_id TEXT`;
    yield* sql`UPDATE threads SET title = (SELECT m.title FROM missions m WHERE m.id = threads.mission_id)`;
    yield* sql`ALTER TABLE messages ADD COLUMN sender_thread_id TEXT REFERENCES threads(id)`;
    yield* sql`ALTER TABLE messages ADD COLUMN is_result INTEGER NOT NULL DEFAULT 0`;
    yield* sql`CREATE INDEX threads_by_parent ON threads (parent_id)`;
  }),
  // Interrupts and steering (CHG-0039): an owner message sent as Queue waits for the thread's next turn.
  "0008_message_delivery": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE messages ADD COLUMN is_queued INTEGER NOT NULL DEFAULT 0`;
  }),
  "0009_thread_cleanup": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN is_deleting INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE messages ADD COLUMN sender_title TEXT`;
    yield* sql`UPDATE messages SET sender_title = (SELECT title FROM threads WHERE id = sender_thread_id)`;
  }),
  "0010_chatter_guard": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE chatter (
      first_id TEXT NOT NULL REFERENCES threads(id),
      second_id TEXT NOT NULL REFERENCES threads(id),
      count INTEGER NOT NULL DEFAULT 0,
      pause_id TEXT UNIQUE,
      pause_count INTEGER,
      PRIMARY KEY (first_id, second_id)
    )`;
  }),
  // Mission journal (CHG-0043): a briefing per mission, and a change log no one edits or deletes.
  "0011_journal": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE journals (
      mission_id TEXT PRIMARY KEY REFERENCES missions(id),
      briefing TEXT NOT NULL,
      version INTEGER NOT NULL
    )`;
    // The author's thread is kept without a reference: an entry outlives a deleted thread, with its title.
    yield* sql`CREATE TABLE journal_entries (
      mission_id TEXT NOT NULL REFERENCES missions(id),
      number INTEGER NOT NULL,
      author_kind TEXT NOT NULL,
      author_thread_id TEXT,
      author_title TEXT,
      text TEXT NOT NULL,
      written_at INTEGER NOT NULL,
      PRIMARY KEY (mission_id, number)
    )`;
    yield* sql`CREATE TRIGGER journal_entries_are_permanent BEFORE UPDATE ON journal_entries
      BEGIN SELECT RAISE(ABORT, 'Journal entries cannot be edited.'); END`;
    // Only deleting the whole mission, whose top thread is marked first, erases its entries.
    yield* sql`CREATE TRIGGER journal_entries_stay BEFORE DELETE ON journal_entries
      WHEN NOT EXISTS (SELECT 1 FROM missions m JOIN threads t ON t.id = m.top_thread_id
        WHERE m.id = OLD.mission_id AND t.is_deleting = 1)
      BEGIN SELECT RAISE(ABORT, 'Journal entries cannot be deleted.'); END`;
    yield* sql`INSERT INTO journals (mission_id, briefing, version) SELECT id, '', 0 FROM missions`;
    yield* sql`ALTER TABLE threads ADD COLUMN opener_messages TEXT`;
  }),
  // Mission tracking (CHG-0045): how and when a mission ended, its title's owner, and the dashboard's questions.
  "0012_mission_tracking": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN ending TEXT`;
    // When the owner last marked it Done, for auto-archive.
    yield* sql`ALTER TABLE missions ADD COLUMN done_at INTEGER`;
    yield* sql`ALTER TABLE missions ADD COLUMN is_title_by_user INTEGER NOT NULL DEFAULT 0`;
    // Set when the top thread reports its result, until the owner ends the mission or answers Not now.
    yield* sql`ALTER TABLE missions ADD COLUMN is_asking_done INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE missions ADD COLUMN inactivity_dismissed_at INTEGER`;
  }),
  // Off-topic requests (thread-tree): each suggestion and where its request went, and asides.
  "0013_off_topic": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // Targets carry no reference: the link outlives a deleted target, with the title it had.
    yield* sql`CREATE TABLE suggestions (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      thread_id TEXT NOT NULL REFERENCES threads(id),
      text TEXT NOT NULL,
      title TEXT NOT NULL,
      matches TEXT NOT NULL,
      asked_at INTEGER NOT NULL,
      outcome TEXT,
      is_automatic INTEGER NOT NULL DEFAULT 0,
      target_mission_id TEXT,
      target_thread_id TEXT,
      target_title TEXT,
      resolved_at INTEGER
    )`;
    yield* sql`ALTER TABLE threads ADD COLUMN is_aside INTEGER NOT NULL DEFAULT 0`;
  }),
  // Budget control: each mission's limits, a turn's API-key cost, reached budgets, and budget lines.
  "0014_budgets": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN budget_cost REAL`;
    yield* sql`ALTER TABLE missions ADD COLUMN budget_tokens INTEGER`;
    // Null counts the turn's tokens as subscription spending.
    yield* sql`ALTER TABLE usage ADD COLUMN cost REAL`;
    // A null mission is the global budget; the holding thread carries no reference so a stop outlives it.
    yield* sql`CREATE TABLE budget_stops (
      id TEXT PRIMARY KEY,
      mission_id TEXT REFERENCES missions(id),
      thread_id TEXT NOT NULL,
      reached_at INTEGER NOT NULL,
      resolution TEXT,
      resolved_at INTEGER
    )`;
    yield* sql`CREATE TABLE budget_events (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      text TEXT NOT NULL,
      at INTEGER NOT NULL
    )`;
  }),
  // Spending outlives the threads and missions that spent it (budget-control: lowering or deleting never
  // undoes spending): usage rows carry their own thread and end time, without references that a deletion breaks.
  "0015_lasting_spending": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE spending (
      turn_id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      ended_at INTEGER NOT NULL,
      input INTEGER NOT NULL,
      output INTEGER NOT NULL,
      cache_read INTEGER NOT NULL,
      cache_creation INTEGER NOT NULL,
      cost REAL
    )`;
    yield* sql`INSERT INTO spending (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, cost)
      SELECT u.turn_id, u.mission_id, t.thread_id, COALESCE(t.ended_at, t.started_at), u.input, u.output, u.cache_read,
        u.cache_creation, u.cost
      FROM usage u JOIN turns t ON t.id = u.turn_id`;
    yield* sql`DROP TABLE usage`;
    yield* sql`ALTER TABLE spending RENAME TO usage`;
    yield* sql`CREATE INDEX usage_mission ON usage (mission_id)`;
    yield* sql`CREATE INDEX usage_ended ON usage (ended_at)`;
  }),
  // Scoped intel: each intel at its scope, and each thread's change to intel, done or awaiting the owner.
  // The thread and workspace columns carry no reference: deleting a thread erases its intel explicitly.
  "0016_scoped_intel": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE intels (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      thread_id TEXT,
      workspace_id TEXT,
      text TEXT NOT NULL,
      saved_by_thread_id TEXT,
      saved_by_title TEXT,
      saved_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`;
    yield* sql`CREATE INDEX intels_thread ON intels (thread_id)`;
    yield* sql`CREATE TABLE intel_changes (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      intel_id TEXT,
      scope TEXT NOT NULL,
      scope_thread_id TEXT,
      scope_workspace_id TEXT,
      text TEXT NOT NULL,
      previous_text TEXT,
      at INTEGER NOT NULL,
      resolved_at INTEGER
    )`;
    yield* sql`CREATE INDEX intel_changes_thread ON intel_changes (thread_id)`;
  }),
  "0017_intel_over_time": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // Intel saved before kinds existed counts as a fact, last used when it was saved.
    yield* sql`ALTER TABLE intels ADD COLUMN kind TEXT NOT NULL DEFAULT 'Fact'`;
    yield* sql`ALTER TABLE intels ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE intels ADD COLUMN uses INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE intels ADD COLUMN last_used_at INTEGER NOT NULL DEFAULT 0`;
    yield* sql`UPDATE intels SET last_used_at = saved_at`;
    yield* sql`ALTER TABLE intel_changes ADD COLUMN intel_kind TEXT NOT NULL DEFAULT 'Fact'`;
  }),
  // What an intel rests on (scoped-intel, Saving), copied when saved so it outlives the entry's or message's
  // thread; a global save awaiting approval carries it until approved. Intel saved before has none.
  "0018_intel_origins": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    for (const table of ["intels", "intel_changes"]) {
      yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN origin_kind TEXT`;
      yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN origin_entry INTEGER`;
      yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN origin_from TEXT`;
      yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN origin_excerpt TEXT`;
    }
  }),
  // An intel's history (scoped-intel, History and undo): each entry keeps the intel's state before and after,
  // as JSON, so the owner can undo it. Intel saved before starts its history with one save.
  "0019_intel_history": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE intel_history (
      id TEXT PRIMARY KEY,
      intel_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      actor TEXT NOT NULL,
      actor_thread_id TEXT,
      actor_title TEXT,
      at INTEGER NOT NULL,
      approved_at INTEGER,
      before_state TEXT,
      after_state TEXT,
      scope_thread_id TEXT,
      undid TEXT,
      undo_of TEXT,
      undone_at INTEGER
    )`;
    yield* sql`CREATE INDEX intel_history_intel ON intel_history (intel_id)`;
    const rows = yield* sql<{
      id: string;
      savedAt: number;
      savedByThreadId: string | null;
      savedByTitle: string | null;
      state: string;
      threadId: string | null;
    }>`
      SELECT id, saved_at AS savedAt, saved_by_thread_id AS savedByThreadId, saved_by_title AS savedByTitle,
        thread_id AS threadId,
        json_object('id', id, 'scope', scope, 'kind', kind, 'threadId', thread_id, 'workspaceId', workspace_id,
          'text', text, 'savedByThreadId', saved_by_thread_id, 'savedByTitle', saved_by_title,
          'savedAt', saved_at, 'updatedAt', updated_at, 'lastUsedAt', last_used_at, 'uses', uses,
          'isPinned', is_pinned, 'originKind', origin_kind, 'originEntry', origin_entry,
          'originFrom', origin_from, 'originExcerpt', origin_excerpt) AS state
      FROM intels`;
    for (const row of rows) {
      yield* sql`INSERT INTO intel_history (id, intel_id, kind, actor, actor_thread_id, actor_title, at, after_state,
          scope_thread_id)
        VALUES (${crypto.randomUUID()}, ${row.id}, 'Saved', ${row.savedByThreadId === null ? "Owner" : "Thread"},
          ${row.savedByThreadId}, ${row.savedByTitle}, ${row.savedAt}, ${row.state}, ${row.threadId})`;
    }
  }),
  // Widening and narrowing proposed from evidence (scoped-intel): each use with the using thread's workspace,
  // and the owner's decisions on proposals, which are otherwise worked out when read. Earlier uses have none.
  "0020_intel_proposals": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE intel_uses (
      intel_id TEXT NOT NULL,
      at INTEGER NOT NULL,
      workspace_id TEXT
    )`;
    yield* sql`CREATE INDEX intel_uses_intel ON intel_uses (intel_id, at)`;
    yield* sql`CREATE TABLE intel_proposal_decisions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      at INTEGER NOT NULL
    )`;
  }),
  // Each thread's harness and provider account (provider-accounts); earlier threads ran on Claude Code with
  // the computer's own sign-in. Accounts added in Gild keep their folders beside the database.
  "0021_harnesses_and_accounts": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN harness TEXT NOT NULL DEFAULT 'claude'`;
    yield* sql`ALTER TABLE threads ADD COLUMN account_id TEXT`;
    yield* sql`CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      harness TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`;
  }),
  // What a thread's context held after its latest model call in each turn, for the context gauge
  // (thread-panel); earlier turns did not record it.
  "0022_usage_context": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE usage ADD COLUMN context INTEGER`;
  }),
  // A realm's crest, designed by the owner: JSON, null until then (the quests of a realm wear it).
  "0023_realm_crest": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE workspaces ADD COLUMN crest TEXT`;
  }),
  // The model that wrote each agent reply, as the harness named it, for the Companion label; null when unreported.
  "0024_message_model": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE messages ADD COLUMN model TEXT`;
  }),
  // The lines recording a thread's handovers (thread-handover): a change of its harness, account, model, or effort.
  "0025_handovers": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE handovers (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id),
      text TEXT NOT NULL,
      at INTEGER NOT NULL
    )`;
  }),
  // The harness that wrote each agent reply, so a handover leaves earlier replies under their own provider. A thread
  // could not change harness or model before, so each earlier reply is the thread's own; a reply that named no model
  // (before 0024, or a harness that names none) takes the model the thread chose.
  "0026_message_harness": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE messages ADD COLUMN harness TEXT`;
    yield* sql`UPDATE messages SET harness = (SELECT harness FROM threads WHERE threads.id = messages.thread_id)
      WHERE sender_kind = 'agent'`;
    yield* sql`UPDATE messages SET model = (SELECT model FROM threads WHERE threads.id = messages.thread_id)
      WHERE sender_kind = 'agent' AND model IS NULL
        AND (SELECT model FROM threads WHERE threads.id = messages.thread_id) != 'default'`;
  }),
  // A Ritual: an instruction on a schedule in a quest of its own (rituals). Schedule, primary Companion, and fallbacks
  // are stored as JSON; `last_run_state` is Underway, Done, Interrupted, or Failed, null before the first run, and
  // `fallback_step` counts the fallbacks the current run has used.
  "0027_rituals": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE rituals (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL UNIQUE REFERENCES missions(id),
      instruction TEXT NOT NULL,
      schedule TEXT NOT NULL,
      primary_companion TEXT NOT NULL,
      fallbacks TEXT NOT NULL,
      is_on INTEGER NOT NULL DEFAULT 1,
      next_run_at INTEGER,
      last_run_at INTEGER,
      last_run_state TEXT,
      fallback_step INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`;
  }),
  // Images attached to the owner's messages (message-attachments): `message_id` is null for a draft not yet sent.
  "0028_attachments": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE attachments (
      id TEXT PRIMARY KEY,
      file TEXT NOT NULL,
      name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      message_id TEXT REFERENCES messages(id),
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`;
    yield* sql`CREATE INDEX attachments_message ON attachments(message_id)`;
  }),
  // The Guildmaster (quest coordination): one hidden quest whose top thread the owner talks to, left out of every list.
  // `realm_path` is the realm the owner attached to a message for the Guildmaster; a suggestion keeps it for the quest
  // it may open.
  "0029_guildmaster": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN is_guildmaster INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE messages ADD COLUMN realm_path TEXT`;
    yield* sql`ALTER TABLE suggestions ADD COLUMN realm_path TEXT`;
  }),
  // Hearing back (quest coordination): the quests the Guildmaster opened, and the latest report it was told of each
  // (Reported, Attention, or Failed; null when none stands), so it hears of each change once.
  "0030_guildmaster_reports": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN opened_by_guildmaster INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE missions ADD COLUMN guildmaster_told TEXT`;
    // A card in the Guildmaster's conversation for a Ritual it created, not a quest it opened.
    yield* sql`ALTER TABLE suggestions ADD COLUMN is_ritual INTEGER NOT NULL DEFAULT 0`;
    // The tier the Guildmaster chose for the quest a suggestion may open (quest coordination, Opening a quest).
    yield* sql`ALTER TABLE suggestions ADD COLUMN tier TEXT`;
  }),
  // The Companions a thread falls back to after a failed turn, and how many the current failure chain has used (thread-panel).
  "0031_thread_backups": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN backups TEXT NOT NULL DEFAULT '[]'`;
    yield* sql`ALTER TABLE threads ADD COLUMN backup_step INTEGER NOT NULL DEFAULT 0`;
  }),
  // How each turn was billed (budget-control, Billing kind); null for turns recorded before, which keep counting by
  // whether they have a cost.
  "0032_usage_billing": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE usage ADD COLUMN billing TEXT`;
  }),
  // What each turn ran on and what it was estimated to cost, stamped when it ended and never changed (budget-control,
  // Estimated cost); the model price table, kept from the public table or the snapshot (decision record 0014).
  "0033_estimates_and_prices": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE usage ADD COLUMN harness TEXT`;
    yield* sql`ALTER TABLE usage ADD COLUMN model TEXT`;
    yield* sql`ALTER TABLE usage ADD COLUMN account_id TEXT`;
    yield* sql`ALTER TABLE usage ADD COLUMN estimate REAL`;
    yield* sql`ALTER TABLE usage ADD COLUMN estimate_source TEXT`;
    yield* sql`ALTER TABLE usage ADD COLUMN priced_at INTEGER`;
    yield* sql`CREATE TABLE prices (
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input REAL NOT NULL,
      output REAL NOT NULL,
      cache_read REAL,
      cache_write REAL,
      source TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (provider, model)
    )`;
  }),
};

/** The service's one SQLite database, migrated before use. */
export const storeLayer = (filename: string) =>
  Layer.effectDiscard(SqliteMigrator.run({ loader: SqliteMigrator.fromRecord(migrations) })).pipe(
    Layer.provideMerge(SqliteClient.layer({ filename })),
  );
