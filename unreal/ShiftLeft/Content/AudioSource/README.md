# Native score source

`SignalInTheDark.wav` is a stereo, 16-bit PCM, 44.1 kHz conversion of the existing original `public/audio/signal-in-the-dark.mp3`. It contains the same score candidate, with no new composition. See the parent repository's `public/audio/README.md` for generation provenance.

The editor bootstrap imports it as `/Game/Audio/SignalInTheDark` and enables looping. Native playback uses the whole track and an M-key toggle. The browser's crossfade and adaptive mixer have not been ported. Native audio playback remains unverified until the Unreal build runs.
