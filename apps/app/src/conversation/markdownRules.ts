/** The schemes a link in an agent's reply may open: a reply is untrusted text, so `javascript:` and the like never become links. */
const safeSchemes = ["http:", "https:", "mailto:"];

/** Where a Markdown link may lead, or null when its scheme is not one of the safe ones. */
export const linkTargetOf = (href: string) => {
  const target = URL.parse(href.trim());
  return target !== null && safeSchemes.includes(target.protocol) ? target.href : null;
};

/** The marker before a list item: a bullet, or its number counted from where the list starts. */
export const listMarkerOf = (list: { ordered: boolean; start: number | "" }, index: number) =>
  list.ordered ? `${(list.start === "" ? 1 : list.start) + index}.` : "•";
