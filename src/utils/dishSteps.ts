import { toggleAddonSelection } from './addonSelection';

/** The slice of a dish the customise popup needs to plan its steps. */
export interface StepAddonOption {
  id: string;
  label: string;
  priceDelta?: number;
  /** Heading the extra is grouped under; absent = the add-on group's own name. */
  category?: string | null;
}
export interface StepAddonGroup {
  id: string;
  label: string;
  minSelectable: number;
  maxSelectable: number;
  options: StepAddonOption[];
}
export interface StepVariantGroup {
  id: string;
  label: string;
  variants: { id: string; label: string; priceDelta?: number }[];
}

export interface DishPlan {
  /** Add-on groups the diner must answer (min > 0): step 1, no default. */
  required: StepAddonGroup[];
  /** Variant groups (default preselected): step 1, after the required choices. */
  variants: StepVariantGroup[];
  /** Optional add-on groups (min 0): step 2. */
  extras: StepAddonGroup[];
  /** The guided steps only run when the dish has a required choice. */
  guided: boolean;
}

export function planDish(
  addons: ReadonlyArray<StepAddonGroup> = [],
  variantTypes: ReadonlyArray<StepVariantGroup> = [],
): DishPlan {
  const required = addons.filter((g) => g.minSelectable > 0);
  return {
    required,
    variants: [...variantTypes],
    extras: addons.filter((g) => g.minSelectable <= 0),
    guided: required.length > 0,
  };
}

export interface ExtraSection {
  label: string;
  /** The add-on group the options belong to (needed for max-pick rules). */
  options: (StepAddonOption & { groupId: string })[];
}

/**
 * Extras grouped by their category field, in order of first appearance. Extras with no category
 * go under their add-on group's name.
 */
export function groupExtrasByCategory(groups: ReadonlyArray<StepAddonGroup>): ExtraSection[] {
  const sections = new Map<string, ExtraSection>();
  for (const g of groups) {
    for (const o of g.options) {
      const label = o.category?.trim() || g.label;
      const key = label.toLocaleLowerCase();
      let section = sections.get(key);
      if (!section) {
        section = { label, options: [] };
        sections.set(key, section);
      }
      section.options.push({ ...o, groupId: g.id });
    }
  }
  return [...sections.values()];
}

/** Required add-on groups the diner has not answered yet. */
export function unmetRequired(plan: DishPlan, selected: ReadonlySet<string>): StepAddonGroup[] {
  return plan.required.filter((g) => g.options.filter((o) => selected.has(o.id)).length < g.minSelectable);
}

export type StepNumber = 1 | 2 | 3 | 4;

/** What the main button says: the next thing to do. */
export type NextAction = 'choose' | 'next' | 'skip' | 'review';

export function nextAction(step: StepNumber, unmet: number, extrasChosen: number): NextAction {
  if (step === 1) return unmet > 0 ? 'choose' : 'next';
  if (step === 2) return extrasChosen > 0 ? 'next' : 'skip';
  return 'next';
}

/** Selection after toggling an extra, honouring each group's max picks. */
export function toggleExtra(
  groups: ReadonlyArray<StepAddonGroup>,
  selected: ReadonlySet<string>,
  optionId: string,
): Set<string> {
  return toggleAddonSelection(groups, selected, optionId);
}
