interface GroupLimits {
  options: ReadonlyArray<{ id: string }>;
  minSelectable: number;
  maxSelectable: number;
}

/**
 * Returns the selection after the diner toggles one extra. Removes it when
 * already chosen. When adding to a group that is full: a single-choice group
 * (max 1) swaps its choice; any other full group ignores the click.
 */
export function toggleAddonSelection<G extends GroupLimits>(
  groups: ReadonlyArray<G>,
  selected: ReadonlySet<string>,
  optionId: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(optionId)) {
    next.delete(optionId);
    return next;
  }
  const group = groups.find((g) => g.options.some((o) => o.id === optionId));
  if (group) {
    const chosen = group.options.filter((o) => next.has(o.id));
    if (chosen.length >= group.maxSelectable) {
      if (group.maxSelectable !== 1) return next;
      chosen.forEach((o) => next.delete(o.id));
    }
  }
  next.add(optionId);
  return next;
}

/** Groups where the diner has chosen fewer extras than the group's minimum. */
export function unmetAddonGroups<G extends GroupLimits>(
  groups: ReadonlyArray<G>,
  selected: ReadonlySet<string>,
): G[] {
  return groups.filter(
    (g) => g.options.filter((o) => selected.has(o.id)).length < g.minSelectable,
  );
}
