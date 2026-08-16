// --- Progress tracking / recommendation logic ---
// Pulls every number out of a reps string ("10-12", "8 each leg", "15") and
// treats the min/max as the target range. Strings with no number (e.g. "AMRAP")
// yield no range, so no recommendation is possible for that exercise.
const parseRepRange = (repsStr) => {
  const nums = (repsStr || "").match(/\d+/g)?.map(Number);
  if (!nums || nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
};

const WEIGHT_STEP_KG = 2.5;
const roundToHalfKg = (w) => Math.round(w * 2) / 2;

// avgWeight is optional (bodyweight/cardio exercises won't have one) — the
// recommendation level is always based on reps alone; a specific weight
// suggestion is only included when a weight was actually logged.
const computeRecommendation = (avgReps, range, prevAvgReps, avgWeight) => {
  if (avgReps >= range.max) {
    return { level: "progress", weightSuggestion: avgWeight ? roundToHalfKg(avgWeight + WEIGHT_STEP_KG) : null };
  }
  if (avgReps >= range.min) {
    return { level: "maintain" };
  }
  // Below range: only flag a deload if the immediately preceding check-in was
  // ALSO below range for this exact exercise — a single off session just logs.
  if (prevAvgReps != null && prevAvgReps < range.min) {
    return { level: "deload", weightSuggestion: avgWeight ? roundToHalfKg(avgWeight * 0.9) : null };
  }
  return null;
};

// Reads the most recent check-in's logged reps/weight for one exercise and,
// if the check-in immediately before that also logged it, feeds both into
// computeRecommendation. Only ever looks one check-in back, per spec.
const getExerciseRecommendation = (checkins, day, exerciseName, repsStr) => {
  const range = parseRepRange(repsStr);
  if (!range || checkins.length === 0) return null;
  const lastIdx = checkins.length - 1;
  const latest = checkins[lastIdx].completed_exercises?.[day]?.[exerciseName];
  if (!latest?.done || typeof latest.avgReps !== "number") return null;
  const prev = lastIdx > 0 ? checkins[lastIdx - 1].completed_exercises?.[day]?.[exerciseName] : null;
  const prevAvgReps = (prev?.done && typeof prev.avgReps === "number") ? prev.avgReps : null;
  return computeRecommendation(latest.avgReps, range, prevAvgReps, latest.avgWeight ?? null);
};

const RECOMMENDATION_TONE = { progress: "accent", maintain: "cool", deload: "warm" };
const RECOMMENDATION_LABEL = {
  progress: (r) => `↑ Progress${r.weightSuggestion ? `: try ${r.weightSuggestion}kg` : ": add a rep next time"}`,
  maintain: () => "→ Maintain",
  deload: (r) => `↓ Deload${r.weightSuggestion ? `: try ${r.weightSuggestion}kg` : ": ease up next session"}`,
};

// Consecutive-week check-in streak, computed client-side from existing checkin rows
// (no new table/column). A gap of more than 10 days between one check-in and the
// next breaks the streak, but the check-in right after a gap still counts as week 1
// of a new streak, not 0. Returns the CURRENT run length (since the last break), not
// the longest run in the plan's history.
const computeStreak = (checkins, planId) => {
  const sorted = checkins
    .filter(c => c.plan_id === planId)
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (sorted.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gapDays = (new Date(sorted[i].created_at) - new Date(sorted[i - 1].created_at)) / 86400000;
    streak = gapDays <= 10 ? streak + 1 : 1;
  }
  return streak;
};

// --- Plan-wide deload week trigger ---
// A layer on top of the per-exercise deload flag above, not a replacement for it —
// getExerciseRecommendation's 2-consecutive-below-range rule is still what flags each
// individual exercise; this only decides whether enough of them (or enough time) add
// up to a scheduled deload week for the whole plan.
const DELOAD_EXERCISE_THRESHOLD = 0.4; // >= 40% of tracked exercises flagged deload-eligible
const DELOAD_TIME_FLOOR_WEEKS = 6; // force a deload if this many weeks pass with no exercise-level trigger
const DELOAD_MIN_SPACING_WEEKS = 4; // never trigger a second deload within this many weeks of the last one

// history is expected in chronological order, already scoped to one plan (matches
// how `checkins` state is loaded — see loadCheckins's .eq("plan_id", id)).
const getLastDeloadWeek = (history) =>
  history.reduce((last, c) => (c.is_deload && (last == null || c.week_number > last) ? c.week_number : last), null);

// upcomingWeek is the week_number of the plan about to be generated (the week after
// the check-in that was just submitted), since that's the week the deload would apply to.
const shouldTriggerDeload = (plan, history, upcomingWeek) => {
  const lastDeloadWeek = getLastDeloadWeek(history);
  if (lastDeloadWeek != null && upcomingWeek - lastDeloadWeek < DELOAD_MIN_SPACING_WEEKS) return false;

  let tracked = 0;
  let flagged = 0;
  plan.workouts?.forEach(w => {
    w.exercises?.forEach(ex => {
      if (!parseRepRange(ex.reps)) return;
      tracked++;
      if (getExerciseRecommendation(history, w.day, ex.name, ex.reps)?.level === "deload") flagged++;
    });
  });
  if (tracked > 0 && flagged / tracked >= DELOAD_EXERCISE_THRESHOLD) return true;

  return upcomingWeek - (lastDeloadWeek ?? 0) >= DELOAD_TIME_FLOOR_WEEKS;
};

export { parseRepRange, WEIGHT_STEP_KG, roundToHalfKg, computeRecommendation, getExerciseRecommendation, RECOMMENDATION_TONE, RECOMMENDATION_LABEL, computeStreak, shouldTriggerDeload };
