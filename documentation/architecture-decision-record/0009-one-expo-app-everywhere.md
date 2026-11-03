# One Expo app everywhere

The interface is one Expo app (React Native with `react-native-web`): its web build runs in the Electron window and as the phone web app served by the relay Worker, and the same code builds native iOS and Android apps later. Paseo ships this shape (an Expo app whose web build Electron loads), and it gives one UI codebase plus a path to a real native phone app. Version 1 ships no store builds, because store accounts carry fees the nearly-free requirement rules out for now; the native Android build reaches testers through Firebase App Distribution, which is free.

## Considered Options

- **React web app with Vite**: rejected, because it gives no native phone app without a second codebase.
- **Astro or Void**: rejected, because both target server-rendered sites on Cloudflare, while the interface is a live client of a local service.
- **Foldkit**: rejected for now; its Elm architecture is attractive, but it is young and has few libraries.
