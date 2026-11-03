# A handover replays the full history

A harness's own session cannot be resumed by another harness, so a handover starts a new session and gives it the thread's full history from the stored turns, as Delta does. Only when that history exceeds the new model's context window is the oldest part summarized. A short briefing was rejected because the user wants nothing lost across a handover.
