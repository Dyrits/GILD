# Effect in the service and relay

The local service and the relay Worker are written with Effect 4, stable since October 2026, because supervising harness processes, interruptions, timeouts, budgets, retries, and event streams is what it is built for, and typed errors catch failures at compile time. Code cherry-picked from MausBot is rewritten into Effect services rather than ported as is. The app stays plain React, where Effect adds little and React Native libraries do not expect it.
