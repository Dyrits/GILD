/** A briefing's size in tokens, estimated the same way for every harness (mission-journal, Size). */
export const tokensOf = (text: string) => Math.ceil(text.length / 4);
