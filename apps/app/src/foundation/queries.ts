/** Every mission not archived, unfiltered, with its cache key: the dashboard's questions and the permissions filter use it. */
export const allMissions = {
  key: "missions:all",
  request: { _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null },
} as const;
