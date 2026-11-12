/** The models whose label or identifier contains what was typed, ignoring case; all of them when nothing was typed. */
export const modelsMatching = <T extends { readonly id: string; readonly label: string }>(
  models: ReadonlyArray<T>,
  query: string,
) => {
  const wanted = query.trim().toLowerCase();
  return wanted === "" ? models : models.filter((model) => `${model.label} ${model.id}`.toLowerCase().includes(wanted));
};
