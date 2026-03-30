from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
MARKERS_PATH = ROOT / "data" / "sandman_markers.json"


def is_snare_only(marker: dict) -> bool:
    sounds = marker.get("sounds", [])
    return isinstance(sounds, list) and len(sounds) == 1 and sounds[0] == "snare"


def load_markers(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_markers(path: Path, markers: list[dict]) -> None:
    path.write_text(json.dumps(markers, indent=2) + "\n", encoding="utf-8")


def add_evenly_spaced_hits(markers: list[dict]) -> int:
    markers.sort(key=lambda m: int(m["sample"]))

    sample_to_marker: dict[int, dict] = {}
    for marker in markers:
        sample_to_marker[int(marker["sample"])] = marker

    hit_samples: set[int] = set()

    for i in range(len(markers) - 1):
        left = markers[i]
        right = markers[i + 1]
        if not (is_snare_only(left) and is_snare_only(right)):
            continue

        left_sample = int(left["sample"])
        right_sample = int(right["sample"])
        gap = right_sample - left_sample
        hit_samples.add(left_sample + gap // 4)
        hit_samples.add(left_sample + gap // 2)
        hit_samples.add(left_sample + (3 * gap) // 4)

    added = 0
    for sample in sorted(hit_samples):
        existing = sample_to_marker.get(sample)
        if existing is None:
            markers.append({"sample": sample, "sounds": ["hit"]})
            added += 1
            continue

        sounds = existing.setdefault("sounds", [])
        if "hit" not in sounds:
            sounds.append("hit")
            added += 1

    markers.sort(key=lambda m: int(m["sample"]))
    return added


def main() -> None:
    markers = load_markers(MARKERS_PATH)
    added_count = add_evenly_spaced_hits(markers)
    save_markers(MARKERS_PATH, markers)
    print(f"Added or updated {added_count} hit markers in {MARKERS_PATH}")


if __name__ == "__main__":
    main()
