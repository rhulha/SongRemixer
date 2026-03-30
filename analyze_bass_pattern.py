import json

markers_file = r'data\sandman_markers.json'

with open(markers_file, 'r') as f:
    markers = json.load(f)

snares = [m['sample'] for m in markers if 'snare' in m['sounds']]
bass = [m['sample'] for m in markers if 'bass' in m['sounds']]
hits = [m['sample'] for m in markers if 'hit' in m['sounds']]

print(f"Total markers: {len(markers)}")
print(f"Total snares: {len(snares)}")
print(f"Total bass: {len(bass)}")
print(f"Total hits: {len(hits)}")
print()

print("Snare positions (first 20):")
for i, s in enumerate(snares[:20]):
    print(f"  {i}: {s}")

print()
print("Snare intervals:")
intervals = []
for i in range(1, len(snares)):
    interval = snares[i] - snares[i-1]
    intervals.append(interval)
    if i <= 20:
        print(f"  snare[{i}] - snare[{i-1}] = {interval}")

avg_interval = sum(intervals) / len(intervals)
print(f"\nAverage snare interval: {avg_interval:.0f} samples")

print()
print("Bass positions (first 20):")
for i, b in enumerate(bass[:20]):
    print(f"  {i}: {b}")

print()
print("Hit count per snare interval:")
print(f"  Average hit interval: {avg_interval / 4:.0f} samples (approximately)")
