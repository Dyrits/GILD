import { existsSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";

/** The app's name before it became Canopy (CHG-0059), which named its user-data folder and database. */
const formerName = "OpenMission";

/** Claude Code's folder name for a working folder's sessions: every character but letters and digits becomes `-`. */
const claudeProjectNameOf = (folder: string) => folder.replace(/[^a-zA-Z0-9]/g, "-");

/** Renames the database and its write-ahead files, which SQLite finds only beside a database of the same name. */
const renameDatabase = (folder: string) => {
  for (const suffix of ["", "-wal", "-shm"]) {
    const former = join(folder, `openmission.sqlite${suffix}`);
    if (existsSync(former)) renameSync(former, join(folder, `canopy.sqlite${suffix}`));
  }
};

/**
 * Claude Code resumes a session only from the folder named after its working folder, so a thread with no
 * workspace would lose its session once its scratch folder moves; the computer's sign-in and each added
 * account keep their own sessions.
 */
const renameClaudeSessions = (formerFolder: string, folder: string, claudeFolder: string) => {
  const formerPrefix = claudeProjectNameOf(join(formerFolder, "missions"));
  const prefix = claudeProjectNameOf(join(folder, "missions"));
  const accountsFolder = join(folder, "accounts");
  const accounts = existsSync(accountsFolder) ? readdirSync(accountsFolder).map((id) => join(accountsFolder, id)) : [];
  for (const projects of [claudeFolder, ...accounts].map((each) => join(each, "projects"))) {
    if (!existsSync(projects)) continue;
    for (const name of readdirSync(projects)) {
      const target = join(projects, prefix + name.slice(formerPrefix.length));
      if (name.startsWith(formerPrefix) && !existsSync(target)) renameSync(join(projects, name), target);
    }
  }
};

/**
 * Moves an install's data from the former user-data folder into `folder` once, when only the former exists,
 * so missions, threads, accounts, and their harness sessions carry over to Canopy.
 */
export const moveFormerData = (applicationData: string, folder: string, claudeFolder: string) => {
  const formerFolder = join(applicationData, formerName);
  if (!existsSync(formerFolder) || existsSync(folder)) return;
  renameSync(formerFolder, folder);
  renameDatabase(folder);
  renameClaudeSessions(formerFolder, folder, claudeFolder);
};
