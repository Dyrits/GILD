/** A newer release that has been downloaded and checked, ready to install. */
export type ReadyUpdate = { readonly notes: string; readonly pageUrl: string; readonly version: string };

/** What a check found: an update ready to install, or nothing, with the reason when a newer release was unusable. */
export type CheckResult =
  | { readonly _tag: "Ready"; readonly update: ReadyUpdate }
  | { readonly _tag: "Nothing"; readonly note: string | null };

/** A failure the Updates section shows in words, with the page to download by hand when there is one. */
export class UpdateFailure extends Error {
  readonly pageUrl: string | null;

  constructor(message: string, pageUrl: string | null = null) {
    super(message);
    this.pageUrl = pageUrl;
  }
}

/** How one platform finds, downloads, and installs a newer release. */
export interface Updater {
  /** Finds a newer release, downloads and verifies it, and reports the percent downloaded as it goes. */
  check(report: (percent: number, version: string) => void): Promise<CheckResult>;
  /** Quits the app and starts the downloaded version; only called after a check returned Ready. */
  install(): Promise<void>;
}
