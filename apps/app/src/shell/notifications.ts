import { useEffect, useRef } from "react";
import type { ServiceClient } from "../foundation/client";

/**
 * Shows a desktop notification when a new question opens. It carries no content,
 * so nothing about the mission or the action leaves the app (action-approval, Waiting).
 */
export function useAttentionNotice(client: ServiceClient | null) {
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (client === null || typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission().catch(() => void 0);
    let isCurrent = true;
    const check = () =>
      client.request({ _tag: "ListOpenQuestions" }).then(
        (questions) => {
          if (!isCurrent) return;
          const ids = new Set(questions.map((question) => question.id));
          // The first load only learns what is already open.
          const isNew = known.current !== null && [...ids].some((id) => !known.current?.has(id));
          known.current = ids;
          if (isNew && Notification.permission === "granted") {
            new Notification("Gild", { body: "A quest needs you." });
          }
        },
        // A failed check is retried on the next change; the dashboard shows the service's errors.
        () => void 0,
      );
    check();
    const unsubscribe = client.subscribe(check);
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [client]);
}
