import type { AttachmentCard } from "@iskios/contracts";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { imageCache } from "./imageCache";
import type { AttachedFile } from "./useAttachments";

// How attached images show (message-attachments): thumbnails above the message box with a × to remove them, and on the messages sent.

const thumbnail = 56;

/** The images of the message being written, each with a × to take it out before sending; one still being checked or uploaded shows a plain tile. */
export function AttachmentStrip({
  files,
  onRemove,
}: {
  files: ReadonlyArray<AttachedFile>;
  onRemove: (key: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <View style={local.strip}>
      {files.map((file) => (
        <View key={file.key} style={local.tile}>
          {file.previewUrl === null ? (
            <Text numberOfLines={2} style={local.tileName}>
              {file.name}
            </Text>
          ) : (
            <Image
              accessibilityLabel={file.name}
              resizeMode="cover"
              source={{ uri: file.previewUrl }}
              style={local.image}
            />
          )}
          {file.card === null && file.previewUrl !== null && <View style={local.uploading} />}
          <Pressable
            accessibilityLabel={`Remove ${file.name}`}
            accessibilityRole="button"
            onPress={() => onRemove(file.key)}
            style={local.remove}
          >
            <Text style={local.removeMark}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/** The images already fetched, so a refresh or a scroll does not fetch a sent image again; bounded, as each one is held as base64. */
const fetched = imageCache(64 * 1024 * 1024);

const addressOf = (client: ServiceClient, card: AttachmentCard) =>
  fetched.load(card.id, () =>
    client
      .request({ _tag: "ReadAttachment", attachmentId: card.id })
      .then((content) => `data:${content.mediaType};base64,${content.data}`),
  );

function SentImage({ card, client }: { card: AttachmentCard; client: ServiceClient }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    addressOf(client, card).then(
      (address) => isCurrent && setUri(address),
      () => undefined,
    );
    return () => {
      isCurrent = false;
    };
  }, [client, card]);
  return (
    <View style={local.sent}>
      {uri === null ? (
        <Text numberOfLines={2} style={local.tileName}>
          {card.name}
        </Text>
      ) : (
        <Image accessibilityLabel={card.name} resizeMode="cover" source={{ uri }} style={local.sentImage} />
      )}
    </View>
  );
}

/** The images a sent message carries, as thumbnails under its text. */
export function MessageImages({ cards, client }: { cards: ReadonlyArray<AttachmentCard>; client: ServiceClient }) {
  if (cards.length === 0) return null;
  return (
    <View style={local.strip}>
      {cards.map((card) => (
        <SentImage card={card} client={client} key={card.id} />
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  image: { borderRadius: radii.md, height: thumbnail, width: thumbnail },
  remove: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderRadius: radii.pill,
    height: 18,
    justifyContent: "center",
    position: "absolute",
    right: -5,
    top: -5,
    width: 18,
  },
  removeMark: { color: colors.onGround, fontFamily: fonts.sans, fontSize: 13, lineHeight: 16 },
  sent: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    height: 96,
    justifyContent: "center",
    overflow: "hidden",
    width: 96,
  },
  sentImage: { height: 96, width: 96 },
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 6 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    height: thumbnail,
    justifyContent: "center",
    width: thumbnail,
  },
  tileName: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm, padding: 4 },
  uploading: { backgroundColor: colors.canvas, borderRadius: radii.md, inset: 0, opacity: 0.5, position: "absolute" },
});
