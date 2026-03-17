#!/usr/bin/env python3
"""Check fitness dimension weights"""
import re
from pathlib import Path
import yaml

fitness_dir = Path("docs/fitness")
dimensions = {}

for md_file in sorted(fitness_dir.glob("*.md")):
    if md_file.name == "README.md":
        continue
    
    content = md_file.read_text()
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        continue
    
    fm = yaml.safe_load(match.group(1))
    
    if not fm or 'dimension' not in fm:
        continue
    
    dim = fm.get('dimension', 'unknown')
    weight = fm.get('weight', 0)
    
    if dim not in dimensions:
        dimensions[dim] = []
    dimensions[dim].append((md_file.name, weight))

print("=" * 60)
print("Fitness Dimension Weight Analysis")
print("=" * 60)

total_weight = 0
for dim, files in sorted(dimensions.items()):
    dim_total = sum(w for _, w in files)
    total_weight += dim_total
    print(f"\n{dim.upper()}: {dim_total}%")
    for fname, weight in files:
        print(f"  - {fname}: {weight}%")

print("\n" + "=" * 60)
print(f"TOTAL WEIGHT: {total_weight}%")
if total_weight != 100:
    print(f"⚠️  WARNING: Total weight should be 100%, got {total_weight}%")
else:
    print("✅ Total weight is correct")
print("=" * 60)

