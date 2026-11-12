import { maxUsageDays, type UsageFilter, type UsagePeriod } from "@iskios/contracts";

// The page's choices and the graph's scale (budget-control, Reserves usage page): the periods the owner can pick, a typed
// custom range, the rows chosen to narrow the page, and where the graph's value axis runs.

/**
 * The scale of the graph: its top, rounded up to a tidy step (1, 2, or 5 times a power of ten) that leaves at most four
 * intervals, and the ticks from zero to the top.
 */
export const chartScaleOf = (maximum: number) => {
  if (!(maximum > 0)) return { ticks: [0, 1], top: 1 };
  const base = 10 ** (Math.floor(Math.log10(maximum)) - 1);
  const step =
    [1, 2, 5, 10, 20, 50, 100]
      .map((multiple) => multiple * base)
      .find((candidate) => Math.ceil(maximum / candidate) <= 4) ?? maximum;
  const intervals = Math.ceil(maximum / step);
  const tidy = (value: number) => Math.round(value * 1e9) / 1e9;
  return {
    ticks: Array.from({ length: intervals + 1 }, (_, index) => tidy(index * step)),
    top: tidy(intervals * step),
  };
};

/** The periods the owner picks from. */
export type RangeChoice = "7 days" | "30 days" | "Custom";
export const rangeChoices: ReadonlyArray<RangeChoice> = ["7 days", "30 days", "Custom"];

/** The days of the two preset choices. */
const presetDays = { "7 days": 7, "30 days": 30 } as const;

/** The period a preset choice names; the last 30 days for Custom, which is typed instead. */
export const periodOfChoice = (choice: RangeChoice): UsagePeriod => ({
  _tag: "Days",
  days: choice === "Custom" ? 30 : presetDays[choice],
});

/** The choice to show as picked: Custom while a range is typed or on show, else the preset of the period. */
export const rangeChoiceOf = (period: UsagePeriod, isCustom: boolean): RangeChoice => {
  if (isCustom || period._tag === "Range") return "Custom";
  return period.days === 7 ? "7 days" : "30 days";
};

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

/** The local midnight a typed day names, or null when it is no real date: `2026-02-30` is not. */
const dateOf = (text: string) => {
  if (!dayPattern.test(text)) return null;
  const [year = 0, month = 0, day = 0] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};

const dayMillis = 24 * 60 * 60 * 1000;

/**
 * A period from two typed days, or null while they are not both real days, the first not after the second, and within
 * the days the service reads: it would refuse a longer one.
 */
export const periodOfRange = (from: string, to: string): UsagePeriod | null => {
  const [first, last] = [from.trim(), to.trim()];
  const [start, end] = [dateOf(first), dateOf(last)];
  if (start === null || end === null || start > end) return null;
  // Rounded, not floored: a change of clock between the two days makes one of them 23 or 25 hours long.
  const days = Math.round((end.getTime() - start.getTime()) / dayMillis) + 1;
  return days <= maxUsageDays ? { _tag: "Range", from: first, to: last } : null;
};

/** The filters after choosing a row: the row's filter replaces its dimension's earlier one, and choosing it again lets go. */
export const toggledFiltersOf = <Filter extends UsageFilter>(filters: ReadonlyArray<Filter>, chosen: Filter) => {
  const isChosen = filters.some((filter) => filter.dimension === chosen.dimension && filter.key === chosen.key);
  const others = filters.filter((filter) => filter.dimension !== chosen.dimension);
  return isChosen ? others : [...others, chosen];
};
