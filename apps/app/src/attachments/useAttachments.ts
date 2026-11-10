import type { AttachmentCard, AttachmentId } from "@gild/contracts";
import { useEffect, useRef, useState } from "react";
import { messageOf, type ServiceClient } from "../foundation/client";
import { limitRefusalOf, roomLeftOf } from "./attachmentRules";
import { attachmentNameOf, base64Of, prepareImage } from "./attachments";

/** One file in the message box: shown at once, with its card once the service has stored it. */
export interface AttachedFile {
  /** Null until the service answered, which is while the file is checked, reduced, and uploaded. */
  readonly card: AttachmentCard | null;
  readonly key: string;
  readonly name: string;
  /** A local address of the file the owner added, for its thumbnail; null until the file is checked. */
  readonly previewUrl: string | null;
}

/**
 * The files of the message being written, from paste, drop, or the file button: each is checked and uploaded as the
 * single step `attach`. Web only in practice, as the files come from browser events; a null client attaches nothing.
 */
export function useAttachments(client: ServiceClient | null) {
  const [files, setFiles] = useState<ReadonlyArray<AttachedFile>>([]);
  const [error, setError] = useState<string | null>(null);
  // Read by steps that run after an await, which would otherwise see the files of the render that started them.
  const current = useRef<ReadonlyArray<AttachedFile>>([]);

  const change = (edit: (files: ReadonlyArray<AttachedFile>) => ReadonlyArray<AttachedFile>) => {
    current.current = edit(current.current);
    setFiles(current.current);
  };
  const isKept = (key: string) => current.current.some((file) => file.key === key);
  const drop = (key: string) => {
    const dropped = current.current.find((file) => file.key === key);
    if (dropped?.previewUrl) URL.revokeObjectURL(dropped.previewUrl);
    change((all) => all.filter((file) => file.key !== key));
    return dropped ?? null;
  };
  const discard = (service: ServiceClient, attachmentId: AttachmentId) =>
    service.request({ _tag: "DiscardAttachment", attachmentId }).then(
      () => void 0,
      (reason) => setError(messageOf(reason)),
    );

  const attachOne = async (service: ServiceClient, file: File, key: string) => {
    const { blob } = await prepareImage(file);
    const previewUrl = URL.createObjectURL(blob);
    // The owner took it out again while it was being checked.
    if (!isKept(key)) return URL.revokeObjectURL(previewUrl);
    change((all) => all.map((item) => (item.key === key ? { ...item, previewUrl } : item)));
    const card = await service.request({
      _tag: "AddAttachment",
      data: await base64Of(blob),
      name: attachmentNameOf(file),
    });
    // Or while it was uploading: the draft the service made is erased.
    if (!isKept(key)) return discard(service, card.id);
    change((all) => all.map((item) => (item.key === key ? { ...item, card } : item)));
  };

  const attach = (chosen: ReadonlyArray<File>) => {
    if (client === null || chosen.length === 0) return;
    const accepted = chosen.slice(0, roomLeftOf(current.current.length));
    const reasons = accepted.length < chosen.length ? [limitRefusalOf(chosen.length - accepted.length)] : [];
    // Added before any await, so the files still being checked count against the limit of the next call.
    const jobs = accepted.map((file) => ({
      file,
      item: { card: null, key: crypto.randomUUID(), name: attachmentNameOf(file), previewUrl: null },
    }));
    change((all) => [...all, ...jobs.map((job) => job.item)]);
    setError(null);
    Promise.all(
      jobs.map(({ file, item }) =>
        attachOne(client, file, item.key).then(
          () => [],
          (reason: Error) => {
            drop(item.key);
            return [reason.message];
          },
        ),
      ),
    ).then(
      (failed) => {
        const messages = [...reasons, ...failed.flat()];
        setError(messages.length === 0 ? null : messages.join(" "));
      },
      (reason) => setError(messageOf(reason)),
    );
  };

  const remove = (key: string) => {
    const removed = drop(key);
    if (client !== null && removed?.card) discard(client, removed.card.id);
  };

  // What is sent is no longer the box's: the files are forgotten without erasing them.
  const clear = () => {
    for (const file of current.current) if (file.previewUrl !== null) URL.revokeObjectURL(file.previewUrl);
    change(() => []);
    setError(null);
  };

  useEffect(
    () => () => {
      for (const file of current.current) if (file.previewUrl !== null) URL.revokeObjectURL(file.previewUrl);
    },
    [],
  );

  const ids = files.flatMap((file) => (file.card === null ? [] : [file.card.id]));
  return { attach, clear, error, files, ids, isBusy: files.some((file) => file.card === null), remove };
}
