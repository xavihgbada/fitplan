// Matches the effort-label vocabulary the AI itself is instructed to use (see EFFORT
// TARGETS in SYSTEM_PROMPT) — numeric RIR values plus the qualitative labels used for
// beginner technique-priority work.
const EFFORT_OPTIONS = [
  { value: "", label: "Select..." },
  { value: "Form focus", label: "Form focus" },
  { value: "Light effort", label: "Light effort" },
  { value: "3-4 RIR", label: "3-4 RIR" },
  { value: "2-3 RIR", label: "2-3 RIR" },
  { value: "1-2 RIR", label: "1-2 RIR" },
  { value: "0-1 RIR", label: "0-1 RIR" },
  { value: "Train to failure", label: "Train to failure" },
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Suggestion lists for the excuse/enjoy/dislike fields — shown in the same typable
// combo dropdown already used for "goal" (Field's `suggestions` prop), so these stay
// quick-pick options without boxing the person into only what's listed.
const EXCUSE_SUGGESTIONS = [
  "I don't have enough time",
  "I lose motivation after a few weeks",
  "I get bored doing the same routine",
  "I don't know what I'm doing at the gym",
  "I get sore or injured and stop",
  "Work and family take priority",
];
const ENJOY_SUGGESTIONS = [
  "Weightlifting", "Running", "Cycling", "Swimming", "Group classes", "Yoga", "Bodyweight movements", "Sports",
];
const DISLIKE_SUGGESTIONS = [
  "Running", "Burpees", "Heavy barbell squats", "Early morning workouts", "Long cardio sessions", "Crowded gyms",
];

const HOME_EQUIPMENT_OPTIONS = [
  { id: "barbell", label: "Barbell & plates" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "kettlebells", label: "Kettlebells" },
  { id: "bench", label: "Flat bench" },
  { id: "incline_bench", label: "Incline bench" },
  { id: "pullup_bar", label: "Pull-up bar" },
  { id: "resistance_bands", label: "Resistance bands" },
  { id: "step_platform", label: "Step platform" },
  { id: "smart_bar", label: "Les Mills smart bar" },
  { id: "trx", label: "TRX / suspension trainer" },
  { id: "cardio_machines", label: "Cardio machine (bike, treadmill, etc.)" },
];

// Milestone thresholds for the streak badge row. Each renders as a lucide Medal
// icon (see App.jsx) tinted by `color` — bronze/silver/gold — since a plain-data
// .js file can't hold a JSX icon element itself (that's why this stays a hex
// string here instead of the icon component); the color is what used to be
// carried by the medal emoji's own color, now carried explicitly instead.
const STREAK_BADGES = [
  { weeks: 3, label: "3-Week Streak", color: "#CD7F32" },
  { weeks: 6, label: "6-Week Streak", color: "#C0C0C0" },
  { weeks: 10, label: "10-Week Streak", color: "#FFD700" },
];
const getEarnedBadges = (streak) => STREAK_BADGES.filter(b => streak >= b.weeks);
const LANDING_PREVIEW_EXERCISES = [
  { name: "Incline Dumbbell Press", sets: "3", reps: "10-12", rest: "90s", effort: "2 RIR", note: "No bench at home? Swapped for elevated push-ups on a step instead.", reco: { level: "progress", weightSuggestion: 25 } },
  { name: "Chest-Supported Dumbbell Row", sets: "3", reps: "10-12", rest: "75s", effort: "2 RIR", note: "Chest support protects your lower back, matching the mild scoliosis note you gave.", reco: { level: "maintain" } },
  { name: "Cable Lateral Raise", sets: "3", reps: "12-15", rest: "60s", effort: "1-2 RIR", note: "Light weight, full control. This is what actually builds shoulder width.", reco: { level: "deload", weightSuggestion: 9 } },
  { name: "Overhead Cable Extension", sets: "2", reps: "15", rest: "60s", effort: "Train to failure", note: "Replaces the skull crusher you said caused elbow pain.", reco: { level: "progress", weightSuggestion: 17.5 } },
  { name: "Cable Face Pull", sets: "2", reps: "15", rest: "45s", effort: "2 RIR", note: "Rear delts and upper back, keeping shoulders balanced against all the pressing.", reco: { level: "maintain" } },
];
const TAG_COLORS = {
  "Strength": { bg: "#EFF6FF", color: "#1D4ED8" },
  "Cardio": { bg: "#FFF7ED", color: "#C2410C" },
  "HIIT": { bg: "#FEF2F2", color: "#DC2626" },
  "Yoga": { bg: "#F0FDF4", color: "#15803D" },
  "Recovery": { bg: "#FAF5FF", color: "#7E22CE" },
  "Les Mills": { bg: "#FFF1F2", color: "#BE123C" },
  "Full Body": { bg: "#ECFDF5", color: "#065F46" },
  "Upper Body": { bg: "#EFF6FF", color: "#1E40AF" },
  "Lower Body": { bg: "#FFF7ED", color: "#9A3412" },
};

export { EFFORT_OPTIONS, DAYS_OF_WEEK, EXCUSE_SUGGESTIONS, ENJOY_SUGGESTIONS, DISLIKE_SUGGESTIONS, HOME_EQUIPMENT_OPTIONS, STREAK_BADGES, getEarnedBadges, LANDING_PREVIEW_EXERCISES, TAG_COLORS };
