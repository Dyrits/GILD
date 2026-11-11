import { existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

/** The names the app had before Iskios (CHG-0061, CHG-0072, CHG-0143), newest first: each named its user-data folder and database. */
const formerNames = ["Gild", "Canopy", "OpenMission"] as const;

/** Claude Code's folder name for a working folder's sessions: every character but letters and digits becomes `-`. */
const claudeProjectNameOf = (folder: string) => folder.replace(/[^a-zA-Z0-9]/g, "-");

/** Renames the database and its write-ahead files, which SQLite finds only beside a database of the same name. */
const renameDatabase = (folder: string, formerName: string) => {
  const formerDatabase = `${formerName.toLowerCase()}.sqlite`;
  for (const suffix of ["", "-wal", "-shm"]) {
    const former = join(folder, `${formerDatabase}${suffix}`);
    if (existsSync(former)) renameSync(former, join(folder, `iskios.sqlite${suffix}`));
  }
};

/**
 * Moves what the former folder holds into the new one, leaving alone anything the app has already put there.
 * Electron may make its profile folder before this runs, so the data still has to join it.
 */
const mergeInto = (former: string, folder: string) => {
  if (!existsSync(folder)) {
    renameSync(former, folder);
    return;
  }
  if (!statSync(former).isDirectory() || !statSync(folder).isDirectory()) return;
  for (const entry of readdirSync(former)) {
    mergeInto(join(former, entry), join(folder, entry));
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
 * Moves an install's data from the newest former user-data folder into `folder` once, when it holds no
 * database yet, so missions, threads, accounts, and their harness sessions carry over to Iskios.
 */
export const moveFormerData = (applicationData: string, folder: string, claudeFolder: string) => {
  if (existsSync(join(folder, "iskios.sqlite"))) return;
  for (const formerName of formerNames) {
    const formerFolder = join(applicationData, formerName);
    if (!existsSync(formerFolder)) continue;
    mergeInto(formerFolder, folder);
    renameDatabase(folder, formerName);
    renameClaudeSessions(formerFolder, folder, claudeFolder);
    return;
  }
};
