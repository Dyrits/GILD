import type { JournalView, MissionId } from "@canopy/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { newRequestId, type ServiceClient } from "./client";
import { timeOf } from "./formatting";
import { briefingSizeOf, journalAuthorOf } from "./labels";
import { styles } from "./styles";
import { useServiceQuery } from "./useServiceQuery";

/** The briefing, read or being rewritten by the owner, with its size against the limit. */
function Briefing({ client, journal }: { client: ServiceClient; journal: JournalView }) {
  // The draft keeps the version it started from, so a rewrite in the meantime is refused, not overwritten.
  const [draft, setDraft] = useState<{ basedOn: number; briefing: string; entry: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    if (draft === null) return;
    client
      .request({
        _tag: "RewriteBriefing",
        basedOn: draft.basedOn,
        briefing: draft.briefing,
        entry: draft.entry.trim() === "" ? null : draft.entry,
        missionId: journal.missionId,
        requestId: newRequestId(),
      })
      .then(
        () => {
          setDraft(null);
          setError(null);
        },
        (reason: Error) => setError(reason.message),
      );
  };
  if (draft === null) {
    return (
      <View style={styles.section}>
        <View style={styles.inlineRow}>
          <Text style={[styles.label, styles.flex]}>Briefing · version {journal.version}</Text>
          <Pressable onPress={() => setDraft({ basedOn: journal.version, briefing: journal.briefing, entry: "" })}>
            <Text style={styles.link}>Edit</Text>
          </Pressable>
        </View>
        <Text style={styles.body}>{journal.briefing === "" ? "No briefing yet." : journal.briefing}</Text>
        <Text style={styles.muted}>{briefingSizeOf(journal.briefingTokens, journal.limit)}</Text>
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <Text style={styles.label}>Briefing · editing version {draft.basedOn}</Text>
      <TextInput
        accessibilityLabel="Briefing"
        multiline
        onChangeText={(briefing) => setDraft({ ...draft, briefing })}
        style={[styles.input, { minHeight: 160 }]}
        value={draft.briefing}
      />
      <Text style={styles.muted}>{briefingSizeOf(Math.ceil(draft.briefing.length / 4), journal.limit)}</Text>
      <TextInput
        accessibilityLabel="Entry for this rewrite"
        onChangeText={(entry) => setDraft({ ...draft, entry })}
        placeholder="What changed (optional; Rewrote the briefing otherwise)"
        style={styles.input}
        value={draft.entry}
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <View style={styles.inlineRow}>
        <Pressable onPress={save}>
          <Text style={styles.link}>Save</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setDraft(null);
            setError(null);
          }}
        >
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The box where the owner adds a change log entry. */
function NewEntry({ client, missionId }: { client: ServiceClient; missionId: MissionId }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    if (text.trim() === "") return;
    client.request({ _tag: "AddJournalEntry", missionId, requestId: newRequestId(), text }).then(
      () => {
        setText("");
        setError(null);
      },
      (reason: Error) => setError(reason.message),
    );
  };
  return (
    <View style={styles.section}>
      <View style={styles.inlineRow}>
        <TextInput
          accessibilityLabel="New entry"
          onChangeText={setText}
          onSubmitEditing={add}
          placeholder="Add an entry…"
          style={[styles.input, styles.flex]}
          value={text}
        />
        <Pressable onPress={add}>
          <Text style={styles.link}>Add</Text>
        </Pressable>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** A mission's journal: the briefing, a box for a new entry, and the change log, newest first (CHG-0043). */
export function JournalScreen({
  client,
  missionId,
  onBack,
  title,
}: {
  client: ServiceClient;
  missionId: MissionId;
  onBack: () => void;
  title: string;
}) {
  const { data: journal, error } = useServiceQuery(client, { _tag: "ReadJournal", missionId }, `journal:${missionId}`);
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Threads</Text>
        </Pressable>
        <Text numberOfLines={1} style={[styles.heading, styles.flex]}>
          Journal · {title}
        </Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {journal && (
        <ScrollView style={styles.flex}>
          <Briefing client={client} journal={journal} />
          <NewEntry client={client} missionId={missionId} />
          {journal.entries.length === 0 && <Text style={styles.muted}>No entries yet.</Text>}
          {journal.entries.map((entry) => (
            <View key={entry.number} style={styles.section}>
              <Text style={styles.muted}>
                #{entry.number} · {journalAuthorOf(entry)} · {timeOf(entry.writtenAt)}
              </Text>
              <Text style={styles.body}>{entry.text}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
