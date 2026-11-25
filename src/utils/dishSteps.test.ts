import { describe, expect, it } from 'vitest';
import { groupExtrasByCategory, nextAction, planDish, unmetRequired, type StepAddonGroup } from './dishSteps';

const group = (over: Partial<StepAddonGroup> & { id: string }): StepAddonGroup => ({
  label: over.id,
  minSelectable: 0,
  maxSelectable: 1,
  options: [],
  ...over,
});

const pasta = group({ id: 'pasta', label: 'Pasta', minSelectable: 1, options: [{ id: 'spag', label: 'Spaghetti' }] });
const extras = group({
  id: 'extras',
  label: 'Extras',
  maxSelectable: 3,
  options: [
    { id: 'g', label: 'Grana', category: 'Cheese' },
    { id: 't', label: 'Tuna', category: 'Protein' },
    { id: 'm', label: 'Mozzarella', category: ' cheese ' },
    { id: 'p', label: 'Pine nuts' },
  ],
});

describe('planDish', () => {
  it('is guided only when a required add-on group exists', () => {
    expect(planDish([pasta, extras]).guided).toBe(true);
    expect(planDish([extras]).guided).toBe(false);
    expect(planDish([]).guided).toBe(false);
  });

  it('splits required groups from extras', () => {
    const plan = planDish([pasta, extras]);
    expect(plan.required.map((g) => g.id)).toEqual(['pasta']);
    expect(plan.extras.map((g) => g.id)).toEqual(['extras']);
  });
});

describe('unmetRequired', () => {
  it('has no default: the pasta is unmet until one is picked', () => {
    const plan = planDish([pasta, extras]);
    expect(unmetRequired(plan, new Set())).toHaveLength(1);
    expect(unmetRequired(plan, new Set(['spag']))).toHaveLength(0);
  });
});

describe('groupExtrasByCategory', () => {
  it('groups by category in first-seen order, ignoring case, and falls back to the group name', () => {
    const sections = groupExtrasByCategory([extras]);
    expect(sections.map((s) => s.label)).toEqual(['Cheese', 'Protein', 'Extras']);
    expect(sections[0].options.map((o) => o.id)).toEqual(['g', 'm']);
    expect(sections[2].options.map((o) => o.id)).toEqual(['p']);
  });
});

describe('nextAction', () => {
  it('says what to do next', () => {
    expect(nextAction(1, 1, 0)).toBe('choose');
    expect(nextAction(1, 0, 0)).toBe('next');
    expect(nextAction(2, 0, 0)).toBe('skip');
    expect(nextAction(2, 0, 2)).toBe('next');
  });
});
