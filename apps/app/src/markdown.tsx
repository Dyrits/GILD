import { lexer, type Tokens } from "marked";

/** A token of any kind: the lexer's own kinds all fit it. */
type Token = Tokens.Generic;

/** Whether a token is a list; the lexer's loose token type then narrows to the list's own fields. */
const isList = (token: Token): token is Tokens.List => token.type === "list";

/** Whether a token is a table. */
const isTable = (token: Token): token is Tokens.Table => token.type === "table";

import { Fragment, type ReactNode, useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { linkTargetOf, listMarkerOf } from "./markdownRules";
import { colors, fontSizes, fonts, radii } from "./theme";

const styles = StyleSheet.create({
  blockquote: { borderLeftColor: colors.gold, borderLeftWidth: 3, gap: 6, paddingLeft: 10 },
  bold: { fontWeight: "700" },
  codeBlock: { backgroundColor: colors.surface, borderRadius: radii.md, padding: 10 },
  codeBlockText: { color: colors.text, fontFamily: fonts.mono, fontSize: fontSizes.md, lineHeight: 18 },
  codeSpan: { backgroundColor: colors.surface, fontFamily: fonts.mono, fontSize: fontSizes.md },
  deleted: { textDecorationLine: "line-through" },
  heading: { color: colors.text, fontFamily: fonts.hand, fontWeight: "700" },
  italic: { fontStyle: "italic" },
  itemBody: { flex: 1, gap: 4 },
  itemRow: { flexDirection: "row", gap: 6 },
  link: { color: colors.accentText, textDecorationLine: "underline" },
  list: { gap: 4 },
  marker: { color: colors.textMuted, minWidth: 14, textAlign: "right" },
  root: { gap: 8 },
  rule: { backgroundColor: colors.border, height: 1 },
  table: { borderColor: colors.border, borderWidth: 1 },
  tableCell: { borderColor: colors.border, borderWidth: 0.5, flex: 1, padding: 6 },
  tableRow: { flexDirection: "row" },
  text: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, lineHeight: 21 },
});

const headingSizes = [fontSizes.title, fontSizes.xl, fontSizes.lg, fontSizes.base, fontSizes.base, fontSizes.base];

type Rendered = (token: never, key: string, children: ReactNode) => ReactNode;

/** The inline tokens that wrap other inline tokens, each drawn as a styled run of its children. */
const inlineWrappers = {
  del: (_token: Tokens.Del, key, children) => (
    <Text key={key} style={styles.deleted}>
      {children}
    </Text>
  ),
  em: (_token: Tokens.Em, key, children) => (
    <Text key={key} style={styles.italic}>
      {children}
    </Text>
  ),
  link: (token: Tokens.Link, key, children) => {
    const target = linkTargetOf(token.href);
    if (target === null) return <Fragment key={key}>{children}</Fragment>;
    return (
      <Text accessibilityRole="link" key={key} onPress={() => void Linking.openURL(target)} style={styles.link}>
        {children}
      </Text>
    );
  },
  strong: (_token: Tokens.Strong, key, children) => (
    <Text key={key} style={styles.bold}>
      {children}
    </Text>
  ),
} satisfies Record<string, Rendered>;

/** Inline tokens drawn as nested runs of text, so bold, code, and links sit in the same line. */
function Inline({ tokens }: { tokens: ReadonlyArray<Token> }) {
  return <>{tokens.map((token, index) => inlineOf(token, `${index}`))}</>;
}

const inlineOf = (token: Token, key: string): ReactNode => {
  if (Object.hasOwn(inlineWrappers, token.type)) {
    const wrap = inlineWrappers[token.type as keyof typeof inlineWrappers] as Rendered;
    const children = <Inline tokens={token.tokens ?? []} />;
    return wrap(token as never, key, children);
  }
  if (token.type === "codespan") {
    return (
      <Text key={key} style={styles.codeSpan}>
        {` ${token.text} `}
      </Text>
    );
  }
  if (token.type === "br") return "\n";
  if (token.type === "image") return token.text === "" ? null : token.text;
  // A text token may hold inline tokens of its own, as in a tight list item.
  if (token.tokens !== void 0) return <Inline key={key} tokens={token.tokens} />;
  return token.type === "text" || token.type === "escape" || token.type === "html" ? token.text : token.raw;
};

const Paragraph = ({ tokens }: { tokens: ReadonlyArray<Token> }) => (
  <Text style={styles.text}>
    <Inline tokens={tokens} />
  </Text>
);

function ListView({ list }: { list: Tokens.List }) {
  return (
    <View style={styles.list}>
      {list.items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a reply's list never reorders.
        <View key={index} style={styles.itemRow}>
          <Text style={[styles.text, styles.marker]}>{listMarkerOf(list, index)}</Text>
          <View style={styles.itemBody}>
            <Blocks tokens={item.tokens} />
          </View>
        </View>
      ))}
    </View>
  );
}

function TableView({ table }: { table: Tokens.Table }) {
  const rows = [table.header, ...table.rows];
  return (
    <View style={styles.table}>
      {rows.map((row, rowIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a reply's table never reorders.
        <View key={rowIndex} style={styles.tableRow}>
          {row.map((cell, cellIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a reply's table never reorders.
            <View key={cellIndex} style={styles.tableCell}>
              <Text style={[styles.text, rowIndex === 0 && styles.bold]}>
                <Inline tokens={cell.tokens} />
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** The block tokens, each as the view of its kind; kinds with nothing to show, such as a blank line, draw nothing. */
const blockOf = (token: Token, key: string): ReactNode => {
  if (token.type === "paragraph" || token.type === "text")
    return <Paragraph key={key} tokens={token.tokens ?? [token]} />;
  if (token.type === "heading") {
    const size = headingSizes[Math.min(token.depth, 6) - 1] ?? fontSizes.base;
    return (
      <Text key={key} style={[styles.text, styles.heading, { fontSize: size, lineHeight: size + 6 }]}>
        <Inline tokens={token.tokens ?? []} />
      </Text>
    );
  }
  if (isList(token)) return <ListView key={key} list={token} />;
  if (token.type === "code") {
    return (
      <View key={key} style={styles.codeBlock}>
        <Text selectable style={styles.codeBlockText}>
          {token.text}
        </Text>
      </View>
    );
  }
  if (token.type === "blockquote") {
    return (
      <View key={key} style={styles.blockquote}>
        <Blocks tokens={token.tokens ?? []} />
      </View>
    );
  }
  if (isTable(token)) return <TableView key={key} table={token} />;
  if (token.type === "hr") return <View key={key} style={styles.rule} />;
  if (token.type === "html") return <Paragraph key={key} tokens={[{ ...token, type: "text" }]} />;
  return null;
};

function Blocks({ tokens }: { tokens: ReadonlyArray<Token> }) {
  return <>{tokens.map((token, index) => blockOf(token, `${index}`))}</>;
}

/** An agent's reply drawn as Markdown: paragraphs, lists, code, quotes, tables, and links in the guild's type. */
export function Markdown({ text }: { text: string }) {
  const tokens = useMemo(() => lexer(text), [text]);
  return (
    <View style={styles.root}>
      <Blocks tokens={tokens} />
    </View>
  );
}
