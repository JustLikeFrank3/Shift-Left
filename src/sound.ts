type Cue = "click" | "apply" | "warning" | "success" | "patch";
export type MusicMood = "investigate" | "incident" | "contained" | "complete";
let context: AudioContext | undefined;
let effectsBus: GainNode | undefined;
let musicBus: GainNode | undefined;
let musicFilter: BiquadFilterNode | undefined;
let musicSource: AudioBufferSourceNode | undefined;
let musicLoading: Promise<void> | undefined;
let enabled = false;
let effectsVolume = 0.22;
let musicVolume = 0.16;
let mood: MusicMood = "investigate";
const settings: Record<MusicMood, { cutoff: number; level: number }> = {
  investigate: { cutoff: 6500, level: 0.8 },
  incident: { cutoff: 12000, level: 1 },
  contained: { cutoff: 4200, level: 0.7 },
  complete: { cutoff: 10000, level: 0.85 },
};
function musicLevel() {
  return musicVolume * settings[mood].level;
}
export function setMusicMood(next: MusicMood) {
  mood = next;
  if (!context || !musicBus || !musicFilter) return;
  musicFilter.frequency.setTargetAtTime(
    settings[mood].cutoff,
    context.currentTime,
    1.2,
  );
  musicBus.gain.setTargetAtTime(musicLevel(), context.currentTime, 0.6);
}
function tone(
  frequency: number,
  delay: number,
  duration: number,
  type: OscillatorType = "sine",
  level = 0.3,
) {
  if (!context || !effectsBus || !enabled) return;
  const now = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(level, now + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
  oscillator.connect(envelope).connect(effectsBus);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}
export function sound(cue: Cue) {
  if (!enabled || document.hidden) return;
  if (context && musicBus && cue !== "click") {
    const now = context.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setTargetAtTime(musicLevel() * 0.45, now, 0.025);
    musicBus.gain.setTargetAtTime(musicLevel(), now + 0.5, 0.3);
  }
  switch (cue) {
    case "click":
      tone(620, 0, 0.06);
      break;
    case "apply":
      tone(440, 0, 0.1);
      tone(660, 0.07, 0.15);
      break;
    case "warning":
      tone(180, 0, 0.18, "triangle");
      tone(140, 0.15, 0.2, "triangle");
      break;
    case "success":
      [440, 554, 660, 880].forEach((f, i) => tone(f, i * 0.1, 0.25));
      break;
    case "patch":
      tone(380, 0, 0.07, "triangle");
      tone(760, 0.07, 0.09, "triangle");
      tone(520, 0.16, 0.12, "triangle");
      break;
  }
}
function setStatus(message: string) {
  const status = document.querySelector<HTMLElement>("#music-status");
  if (status) status.textContent = message;
}
// Blend the ending into the beginning in the decoded buffer. The final seam
// continues into the crossfade rather than cutting or leaving MP3 padding audible.
function loopBuffer(input: AudioBuffer) {
  const overlap = Math.min(
    Math.floor(input.sampleRate * 1.5),
    Math.floor(input.length / 4),
  );
  const length = input.length - overlap;
  const output = context!.createBuffer(
    input.numberOfChannels,
    length,
    input.sampleRate,
  );
  for (let channel = 0; channel < input.numberOfChannels; channel++) {
    const source = input.getChannelData(channel),
      dest = output.getChannelData(channel);
    dest.set(source.subarray(0, length));
    for (let i = 0; i < overlap; i++) {
      const t = i / overlap;
      dest[i] = source[length + i] * (1 - t) + source[i] * t;
    }
  }
  return output;
}
async function loadScore() {
  if (musicSource) return;
  if (musicLoading) return musicLoading;
  setStatus("Loading Signal in the Dark…");
  musicLoading = (async () => {
    try {
      const response = await fetch(
        new URL("./audio/signal-in-the-dark.mp3", document.baseURI),
      );
      if (!response.ok) throw new Error("Score unavailable");
      const buffer = await context!.decodeAudioData(
        await response.arrayBuffer(),
      );
      musicSource = context!.createBufferSource();
      musicSource.buffer = loopBuffer(buffer);
      musicSource.loop = true;
      musicSource.connect(musicFilter!);
      musicSource.start();
      setStatus("Now playing: Signal in the Dark • original score");
    } catch {
      setStatus("Music unavailable • sound effects remain available");
    } finally {
      musicLoading = undefined;
    }
  })();
  return musicLoading;
}
export function mountAudio() {
  const controls = document.createElement("div");
  controls.className = "audio-controls";
  controls.innerHTML =
    '<button id="sound-toggle" class="secondary" aria-pressed="false">Sound off</button><label for="music-volume">Music</label><input id="music-volume" type="range" min="0" max="100" value="16" aria-label="Music volume"/><label for="sound-volume">FX</label><input id="sound-volume" type="range" min="0" max="100" value="22" aria-label="Sound effects volume"/><span id="sound-status" role="status"></span>';
  document.querySelector("header")!.append(controls);
  const status = document.createElement("div");
  status.className = "music-credit";
  status.innerHTML =
    '<span id="music-status" role="status">Original score • enable sound to listen</span>';
  document.querySelector("footer")!.before(status);
  const button = controls.querySelector<HTMLButtonElement>("button")!;
  button.onclick = async () => {
    button.disabled = true;
    try {
      if (!context) {
        context = new AudioContext();
        effectsBus = context.createGain();
        effectsBus.gain.value = effectsVolume;
        effectsBus.connect(context.destination);
        musicBus = context.createGain();
        musicBus.gain.value = musicLevel();
        musicBus.connect(context.destination);
        musicFilter = context.createBiquadFilter();
        musicFilter.type = "lowpass";
        musicFilter.frequency.value = settings[mood].cutoff;
        musicFilter.connect(musicBus);
      }
      enabled = !enabled;
      if (enabled) {
        await context.resume();
        sound("patch");
        void loadScore();
      } else await context.suspend();
      button.textContent = enabled ? "Sound on" : "Sound off";
      button.setAttribute("aria-pressed", String(enabled));
      controls.querySelector("#sound-status")!.textContent = enabled
        ? "Music and effects enabled"
        : "Muted";
    } catch {
      enabled = false;
      button.textContent = "Sound unavailable";
      button.setAttribute("aria-pressed", "false");
      setStatus("Audio unavailable in this browser");
    } finally {
      button.disabled = false;
    }
  };
  controls.querySelector<HTMLInputElement>("#sound-volume")!.oninput = (e) => {
    effectsVolume = Number((e.target as HTMLInputElement).value) / 100;
    if (context && effectsBus)
      effectsBus.gain.setTargetAtTime(effectsVolume, context.currentTime, 0.05);
  };
  controls.querySelector<HTMLInputElement>("#music-volume")!.oninput = (e) => {
    musicVolume = Number((e.target as HTMLInputElement).value) / 100;
    if (context && musicBus)
      musicBus.gain.setTargetAtTime(musicLevel(), context.currentTime, 0.05);
  };
  document.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (document.hidden) void context.suspend().catch(() => {});
    else if (enabled) void context.resume().catch(() => {});
  });
  document.addEventListener("click", (e) => {
    if (
      (e.target as HTMLElement).closest("button") &&
      !controls.contains(e.target as Node)
    )
      sound("click");
  });
}
