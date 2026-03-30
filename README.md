# Mr. Sandman Beat Editor

A browser-based waveform editor for viewing and editing beat markers on a WAV file.

## Features

- **Waveform display** — renders a stereo WAV file as a scrollable, zoomable waveform
- **Auto-load** — `data/sandman.wav` loads automatically on startup
- **Playback** — play from the cursor position; beat sounds (bass, hit, snare, hat) trigger at their markers during playback
- **Space bar** — toggle play / stop
- **Cursor** — click the waveform to set the cursor position
- **Markers** — add, select, and delete position markers on the waveform
  - Each marker can have any combination of sounds: bass, hit, snare, hat
  - Selected marker sample number is editable in the bottom bar; press Enter or click away to apply
- **Marker list** — scrollable list on the right shows all markers; click one to jump to it
- **Zoom** — mouse wheel to zoom in/out around the cursor
- **Pan** — click-drag the waveform or drag the scrollbar to pan
- **Save / Load** — export and import markers as JSON

## Marker JSON format

```json
[
  { "sample": 461230, "sounds": ["hit", "bass"] },
  { "sample": 503100, "sounds": ["hit"] }
]
```

`sample` is a zero-based frame index into the audio (frames at 44100 Hz).
