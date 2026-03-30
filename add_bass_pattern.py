from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
MARKERS_PATH = ROOT / "data" / "sandman_markers.json"
SNAP_TOLERANCE = 4000
PRE_FIRST_FRACTION = 4 / 8
THREE_BASS_FRACTIONS = [3 / 8, 5 / 8, 6 / 8]
ONE_BASS_FRACTIONS = [4 / 8]


def load_markers(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_markers(path: Path, markers: list[dict]) -> None:
    path.write_text(json.dumps(markers, indent=2) + "\n", encoding="utf-8")


def nearest_sample(target: int, choices: list[int]) -> int | None:
    if not choices:
        return None
    nearest = min(choices, key=lambda s: abs(s - target))
    if abs(nearest - target) > SNAP_TOLERANCE:
        return None
    return nearest


def clear_bass(markers: list[dict]) -> tuple[list[dict], int]:
    cleaned: list[dict] = []
    removed = 0
    for marker in markers:
        sounds = [s for s in marker.get("sounds", []) if s != "bass"]
        if len(sounds) != len(marker.get("sounds", [])):
            removed += 1
        if sounds:
            marker["sounds"] = sounds
            cleaned.append(marker)
    return cleaned, removed


def target_bass_samples(markers: list[dict]) -> set[int]:
    markers.sort(key=lambda m: int(m["sample"]))
    snares = sorted(int(m["sample"]) for m in markers if "snare" in m.get("sounds", []))
    if len(snares) < 2:
        return set()

    non_snare_samples = sorted(
        int(m["sample"]) for m in markers if "snare" not in m.get("sounds", [])
    )
    bass_targets: set[int] = set()

    first_gap = snares[1] - snares[0]
    pre_first_target = snares[0] - int(round(first_gap * PRE_FIRST_FRACTION))
    pre_first_snapped = nearest_sample(pre_first_target, [s for s in non_snare_samples if s < snares[0]])
    if pre_first_snapped is not None:
        bass_targets.add(pre_first_snapped)
    else:
        bass_targets.add(pre_first_target)

    for i in range(len(snares) - 1):
        left = snares[i]
        right = snares[i + 1]
        gap = right - left
        fractions = THREE_BASS_FRACTIONS if i % 2 == 0 else ONE_BASS_FRACTIONS

        interval_choices = [s for s in non_snare_samples if left < s < right]
        for fraction in fractions:
            target = left + int(round(gap * fraction))
            snapped = nearest_sample(target, interval_choices)
            if snapped is not None:
                bass_targets.add(snapped)
            else:
                bass_targets.add(target)

    return bass_targets


def apply_bass_pattern(markers: list[dict], bass_targets: set[int]) -> int:
    sample_to_marker = {int(m["sample"]): m for m in markers}
    added = 0
    for sample in sorted(bass_targets):
        existing = sample_to_marker.get(sample)
        if existing is None:
            markers.append({"sample": sample, "sounds": ["bass"]})
            sample_to_marker[sample] = markers[-1]
            added += 1
            continue
        sounds = existing.setdefault("sounds", [])
        if "bass" not in sounds:
            sounds.append("bass")
            added += 1
    markers.sort(key=lambda m: int(m["sample"]))
    return added


def main() -> None:
    markers = load_markers(MARKERS_PATH)
    markers, removed = clear_bass(markers)
    targets = target_bass_samples(markers)
    added = apply_bass_pattern(markers, targets)
    save_markers(MARKERS_PATH, markers)
    print(f"Removed bass from {removed} markers")
    print(f"Applied bass to {added} markers")
    print(f"Total bass targets: {len(targets)}")


if __name__ == "__main__":
    main()
