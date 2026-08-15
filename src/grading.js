// Derives a 0-100 score from each fix's own severity (as assigned by the model) plus a small
// bonus for genuine strengths — not from fix count or position, so two routines with the same
// number of fixes but different severities score differently.
const GRADE_SEVERITY_DEDUCTIONS = { critical: 20, moderate: 10, minor: 4 };
const computeGradeScore = (fixes, strengths) => {
  const deduction = (fixes || []).reduce((sum, f) => sum + (GRADE_SEVERITY_DEDUCTIONS[f.severity] ?? 10), 0);
  const bonus = Math.min((strengths || []).length * 3, 9);
  return Math.max(5, Math.min(98, 100 - deduction + bonus));
};
const getGradeScoreTone = (score) => (score >= 70 ? "accent" : score >= 45 ? "warm" : "danger");

// Presentation-only: classifies each fix by keyword-matching its own issue/fix text against
// the rule categories already defined in GRADE_SYSTEM_PROMPT above, purely for card styling —
// no new fields are requested from or added to the model's response.
const GRADE_FIX_CATEGORIES = [
  { id: "injury", label: "Injury Safety", tone: "danger", pattern: /\binjur|\bpain\b|contraindicat|\bspine\b|spinal|\bdisc\b|joint stress|aggravat/i },
  { id: "equipment", label: "Equipment", tone: "cool", pattern: /\bequipment\b|\bdoesn'?t have\b|\bdo(?:es)? not have\b|\bnot available\b|\bisn'?t available\b|\bno .{0,15}(machine|cable|bench|rack)\b/i },
  { id: "goal", label: "Goal Alignment", tone: "warm", pattern: /\b(your|their|the client'?s|the stated)\s+goal\b|\bgoal\s+(?:of|is|was|requires|means)\b/i },
  { id: "volume", label: "Volume & Progression", tone: "warm", pattern: /sets per week|\bvolume\b|progression|rep range|deload|overload|no plan to (add|increase)/i },
];
const GRADE_TONE_STYLES = {
  danger: { bg: "var(--danger-bg)", border: "var(--danger-border)", text: "var(--danger)" },
  cool: { bg: "var(--cool-bg)", border: "var(--cool-border)", text: "var(--cool-text)" },
  warm: { bg: "var(--warm-bg)", border: "var(--warm-border)", text: "var(--warm-text)" },
  accent: { bg: "var(--accent-bg)", border: "var(--accent-border)", text: "var(--accent-deep)" },
};
const classifyGradeFix = (fix) => {
  const text = `${fix.issue || ""} ${fix.fix || ""}`;
  const match = GRADE_FIX_CATEGORIES.find(c => c.pattern.test(text));
  return match || { id: "general", label: "Balance & Technique", tone: "accent" };
};

export { GRADE_SEVERITY_DEDUCTIONS, computeGradeScore, getGradeScoreTone, GRADE_FIX_CATEGORIES, GRADE_TONE_STYLES, classifyGradeFix };
