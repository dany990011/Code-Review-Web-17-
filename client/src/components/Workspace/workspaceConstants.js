/**
 * The 12 fixed review categories shown in the Socratic Scorecard checklist.
 * The ids (1-12) are persisted in the project's `checkedChecklistIds`, and the
 * category names must match the categories the AI returns from `/analyze`
 * (case-insensitively) so findings line up with their checklist row.
 */
export const INITIAL_CHECKLIST = [
  { id: 1, category: 'Security', checked: false },
  { id: 2, category: 'Performance', checked: false },
  { id: 3, category: 'Readability', checked: false },
  { id: 4, category: 'Architecture', checked: false },
  { id: 5, category: 'Testing', checked: false },
  { id: 6, category: 'Error Handling', checked: false },
  { id: 7, category: 'State Management', checked: false },
  { id: 8, category: 'Accessibility', checked: false },
  { id: 9, category: 'Documentation', checked: false },
  { id: 10, category: 'Scalability', checked: false },
  { id: 11, category: 'Best Practices', checked: false },
  { id: 12, category: 'Reusability', checked: false },
];
