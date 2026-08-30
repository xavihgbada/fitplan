import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { Dumbbell, Flame, ClipboardList, PartyPopper, Bed, RefreshCw, Calendar, Medal } from "lucide-react";
import { TermsOfService, PrivacyPolicy } from "./legal";
import { exportToPDF } from "./pdfExport";
import { SYSTEM_PROMPT, ADJUST_SYSTEM_PROMPT, SWAP_SYSTEM_PROMPT, GRADE_SYSTEM_PROMPT, buildPrompt, buildAdjustPrompt, buildSwapPrompt, buildGradePrompt } from "./prompts";
import {
  EFFORT_OPTIONS, DAYS_OF_WEEK, EXCUSE_SUGGESTIONS, ENJOY_SUGGESTIONS, DISLIKE_SUGGESTIONS,
  STREAK_BADGES, getEarnedBadges, LANDING_PREVIEW_EXERCISES, SWAPS_PER_WEEK,
} from "./constants";
import { GRADE_TONE_STYLES, computeGradeScore, getGradeScoreTone, classifyGradeFix } from "./grading";
import { renderWithGlossary, getFirstEffortIndices } from "./glossary";
import { RECOMMENDATION_TONE, RECOMMENDATION_LABEL, computeStreak, computeLifetimeCompleted, getExerciseRecommendation, shouldTriggerDeload, dedupeExerciseNames, getNextCheckInDate, isCheckInDue } from "./recommendations";
import { ScrollRevealCard, LANDING_FEATURES, LandingCarousel } from "./components/LandingCarousel";
import { Testimonials } from "./components/Testimonials";
import { CircularScore } from "./components/CircularScore";
import { TypeTag, inputStyle, Field, Divider, EquipmentSelector } from "./components/UI";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const LANDING_PREVIEW_FIRST_EFFORT_INDICES = getFirstEffortIndices(LANDING_PREVIEW_EXERCISES);

export default function FitnessPlanGenerator() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("landing"); // "landing" | "app" | "terms" | "privacy"
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [savedPlans, setSavedPlans] = useState([]);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [profile, setProfile] = useState(null);
  const [checkingOut, setCheckingOut] = useState(null); // "unlock" | "extra_generation" | null
  const [justUnlocked, setJustUnlocked] = useState(null); // null | "unlock" | "extra_generation" — shows a one-time post-purchase confirmation banner matching which product was bought

  const [form, setForm] = useState({
    goal: "", target: "", days: "4", specificDays: [], time: "45", trainTime: "morning",
    level: "beginner", age: "", excuse: "", pastAttempts: "",
    enjoy: "", dislike: "", injuries: "", equipment: [], equipmentLocation: "",
    otherActivity: ""
  });
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("generate"); // "generate" | "grade"
  const [routineText, setRoutineText] = useState("");
  const [gradeInputMode, setGradeInputMode] = useState("template"); // "template" | "text"
  const [templateDays, setTemplateDays] = useState([{ day: "Day 1", exercises: [{ name: "", sets: "", reps: "", effort: "" }] }]);
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState(null);
  const [gradeError, setGradeError] = useState("");
  const [activeWorkout, setActiveWorkout] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [expandedSections, setExpandedSections] = useState({ nutrition: false, motivation: false, checkin: false });
  const toggleSection = (key) => setExpandedSections(p => ({ ...p, [key]: !p[key] }));

  // --- Check-in feature state ---
  const [planId, setPlanId] = useState(null);
  const [planCreatedAt, setPlanCreatedAt] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [swapCounts, setSwapCounts] = useState({}); // "<week_number>" -> count, mirrors plans.swap_counts
  const [lifetimeCheckins, setLifetimeCheckins] = useState([]); // every check-in for this user across ALL plans, for the lifetime completed-exercises total — not plan_id-scoped like `checkins` above
  const [newlyEarnedBadges, setNewlyEarnedBadges] = useState([]); // badges crossed by the just-submitted check-in, shown once then dismissed
  const [currentWeek, setCurrentWeek] = useState(1);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInState, setCheckInState] = useState({}); // "day::exerciseName" -> true/false
  const [skipReasons, setSkipReasons] = useState({}); // "day::exerciseName" -> reason string, only used when skipped
  const [checkInLogs, setCheckInLogs] = useState({}); // "day::exerciseName" -> { avgWeight, avgReps }, only used when done
  const [prefillLogs, setPrefillLogs] = useState({}); // snapshot of checkInLogs as pre-filled at modal-open time — never mutated after, used only to tell whether a field still matches its pre-fill (for the muted-until-edited styling)
  const [dayCheckInState, setDayCheckInState] = useState({}); // day -> true/false, default true (missing key treated as true); false means the whole day was missed
  const [dayReasons, setDayReasons] = useState({}); // day -> reason string, only used when a whole day is unchecked
  const [checkInNotes, setCheckInNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // --- Single-exercise swap state ---
  const [swapOpenKey, setSwapOpenKey] = useState(null); // "day::index" of the exercise with its reason box open
  const [swapReason, setSwapReason] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Clear the previous account's profile immediately on sign-out, rather than leaving it
      // to be silently overwritten once the next account's loadProfile() resolves — effects
      // keyed off profile?.has_paid (like the pending-plan migration below) would otherwise
      // briefly see the PREVIOUS account's has_paid value for the NEW session.
      if (!session) setProfile(null);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setLifetimeCheckins([]); return; }
    loadLifetimeCheckins();
  }, [session]);

  useEffect(() => {
    if (session) { loadSavedPlans(); loadProfile(); }
  }, [session]);

  // Neither /api/generate-plan, /api/grade-workout, nor /api/adjust-plan streams a
  // real progress signal (a single Anthropic call that resolves all at once), so
  // this is a simulated bar: it eases toward 92% and holds there for however long
  // the request actually takes, then the success path snaps it to 100% itself.
  useEffect(() => {
    if (!loading && !grading && !adjusting) { setLoadingProgress(0); return; }
    setLoadingProgress(6);
    const interval = setInterval(() => {
      setLoadingProgress(p => (p >= 92 ? p : p + (92 - p) * 0.08));
    }, 250);
    return () => clearInterval(interval);
  }, [loading, grading, adjusting]);

  useEffect(() => {
    // After returning from Stripe checkout, poll for a little while so the
    // has_paid flip (written by the webhook, asynchronously) shows up without
    // requiring a manual refresh. Migration itself is handled by the
    // has_paid-driven effect below — this just keeps `profile` fresh.
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success" && session) {
      const purchaseType = params.get("type") === "extra_generation" ? "extra_generation" : "unlock";
      window.history.replaceState({}, "", window.location.pathname);
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        const data = await loadProfile();
        if (data?.has_paid) { setJustUnlocked(purchaseType); clearInterval(interval); }
        else if (attempts >= 5) clearInterval(interval);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [session]);

  useEffect(() => {
    if (session && profile && !profile.has_paid && !plan) {
      const raw = localStorage.getItem(`fitplan_pending_plan_${session.user.id}`);
      if (raw) {
        try {
          const { plan: savedPlan, createdAt } = JSON.parse(raw);
          if (Date.now() - createdAt < 24 * 60 * 60 * 1000) {
            setPlan(savedPlan);
          } else {
            localStorage.removeItem(`fitplan_pending_plan_${session.user.id}`);
          }
        } catch (e) {
          localStorage.removeItem(`fitplan_pending_plan_${session.user.id}`);
        }
      }
    }
  }, [session, profile]);

  // Restores an in-progress (not-yet-submitted) plan/grade form after a checkout
  // redirect (or refresh) wipes in-memory state — the form is otherwise only kept
  // in useState, so hitting the paywall and clicking "Unlock" (a full-page redirect
  // to Stripe) used to silently discard everything the user had typed in.
  useEffect(() => {
    if (!session || draftHydrated) return;
    const key = `fitplan_draft_form_${session.user.id}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const draft = JSON.parse(raw);
        if (Date.now() - draft.savedAt < 24 * 60 * 60 * 1000) {
          setForm(draft.form);
          setRoutineText(draft.routineText || "");
          setTemplateDays(draft.templateDays || [{ day: "Day 1", exercises: [{ name: "", sets: "", reps: "", effort: "" }] }]);
          setMode(draft.mode || "generate");
          setGradeInputMode(draft.gradeInputMode || "template");
        } else {
          localStorage.removeItem(key);
        }
      } catch (e) {
        localStorage.removeItem(key);
      }
    }
    setDraftHydrated(true);
  }, [session, draftHydrated]);

  useEffect(() => {
    if (!session || !draftHydrated || plan || gradeResult) return;
    localStorage.setItem(
      `fitplan_draft_form_${session.user.id}`,
      JSON.stringify({ form, routineText, templateDays, mode, gradeInputMode, savedAt: Date.now() })
    );
  }, [session, draftHydrated, form, routineText, templateDays, mode, gradeInputMode, plan, gradeResult]);

  const migratingPendingPlanRef = useRef(false);
  useEffect(() => {
    // Runs any time has_paid is (or becomes) true for this session — on the
    // checkout-success redirect, on a plain refresh after has_paid flipped
    // while the tab was open, or after an out-of-band change (e.g. a manual
    // profile edit). Not gated on a URL param or a time-boxed poll, so a
    // pending plan can never be permanently stranded in localStorage.
    if (!session || !profile?.has_paid || migratingPendingPlanRef.current) return;
    const key = `fitplan_pending_plan_${session.user.id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    migratingPendingPlanRef.current = true;
    (async () => {
      try {
        const { plan: pendingPlan, createdAt } = JSON.parse(raw);
        if (Date.now() - createdAt < 24 * 60 * 60 * 1000) {
          setPlan(pendingPlan);
          setActiveWorkout(0);
          await savePlan(pendingPlan);
          await fetch("/api/track-generation", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId: session.user.id }),
          });
          loadProfile();
        } else {
          setError("Your plan draft expired after 24 hours and couldn't be recovered. Please generate a new one.");
        }
        // Only clear the draft once it's been migrated or confirmed expired — never on
        // failure below, so a transient error (or this effect firing against stale profile
        // data) can't silently destroy the user's only copy of an unpaid plan.
        localStorage.removeItem(key);
      } catch (e) {
        // Migration failed (bad JSON, network error, etc.) — leave the draft in place so
        // it can be retried on the next load instead of being lost.
      }
    })();
  }, [session, profile?.has_paid]);

  const loadProfile = async () => {
    if (!session) return null;
    let { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (!data) {
      const { data: created } = await supabase.from("profiles").insert({ id: session.user.id }).select().single();
      data = created;
    }
    setProfile(data);
    return data;
  };

  const startCheckout = async (type) => {
    if (!session) return;
    setCheckingOut(type);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: session.user.id, type }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setError("Could not start checkout. Please try again."); setCheckingOut(null); }
    } catch (e) {
      setError("Could not start checkout. Please try again.");
      setCheckingOut(null);
    }
  };

  const loadSavedPlans = async () => {
    const { data } = await supabase.from("plans").select("id, title, created_at").order("created_at", { ascending: false });
    if (data) setSavedPlans(data);
  };

  const savePlan = async (planData) => {
    if (!session) return;
    const { data } = await supabase
      .from("plans")
      .insert({ user_id: session.user.id, title: planData.title, plan_data: planData })
      .select()
      .single();
    if (data) { setPlanId(data.id); setPlanCreatedAt(data.created_at); setSwapCounts({}); }
    loadSavedPlans();
  };

  const loadCheckins = async (id) => {
    const { data } = await supabase
      .from("checkins")
      .select("*")
      .eq("plan_id", id)
      .order("week_number", { ascending: true });
    setCheckins(data || []);
    setCurrentWeek((data?.length || 0) + 1);
  };

  // Lifetime completed-exercises total isn't scoped to one plan, so it's loaded
  // once per session rather than alongside a specific plan's checkins.
  const loadLifetimeCheckins = async () => {
    const { data } = await supabase.from("checkins").select("completed_exercises").eq("user_id", session.user.id);
    setLifetimeCheckins(data || []);
  };

  const loadPlan = async (id) => {
    const { data } = await supabase.from("plans").select("plan_data, created_at, swap_counts").eq("id", id).single();
    if (data) {
      setPlan(data.plan_data);
      setPlanId(id);
      setPlanCreatedAt(data.created_at);
      setSwapCounts(data.swap_counts || {}); // {} for plans saved before this column existed
      setShowSavedPlans(false);
      setActiveWorkout(0);
      loadCheckins(id);
    }
  };

  const deletePlan = async (id) => {
    await supabase.from("plans").delete().eq("id", id);
    loadSavedPlans();
  };

  const handleAuth = async () => {
    setAuthLoading(true); setAuthError("");
    const { error } = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
      : await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!authEmail.trim()) { setAuthError("Enter your email above first, then click 'Forgot password?'"); return; }
    setAuthLoading(true); setAuthError("");
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: window.location.origin });
    if (error) setAuthError(error.message); else setForgotSent(true);
    setAuthLoading(false);
  };

  const handleSetNewPassword = async () => {
    setResetError("");
    if (newPassword.length < 6) { setResetError("Password must be at least 6 characters."); return; }
    if (newPassword !== newPasswordConfirm) { setResetError("Passwords don't match."); return; }
    setResetLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setResetError(error.message); else setResetSuccess(true);
    setResetLoading(false);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); setPlan(null); };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(p => (
      name === "days"
        ? { ...p, days: value, specificDays: p.specificDays.slice(0, Number(value)) }
        : { ...p, [name]: value }
    ));
    if (fieldErrors[name]) setFieldErrors(p => ({ ...p, [name]: undefined }));
  };
  const handleEquipment = (equipment) => setForm(p => ({ ...p, equipment }));
  const toggleSpecificDay = (day) => setForm(p => {
    if (p.specificDays.includes(day)) return { ...p, specificDays: p.specificDays.filter(d => d !== day) };
    if (p.specificDays.length >= Number(p.days)) return p;
    return { ...p, specificDays: [...p.specificDays, day] };
  });
  const handleEquipmentLocation = (loc) => {
    setForm(p => ({ ...p, equipmentLocation: loc, equipment: [] }));
    if (fieldErrors.equipmentLocation) setFieldErrors(p => ({ ...p, equipmentLocation: undefined }));
  };

  const openYoutube = (exerciseName) => {
    const query = encodeURIComponent(`how to do ${exerciseName} exercise`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank");
  };

  const totalAllowedGenerations = 3 + (profile?.generation_credits || 0);
  const atGenerationLimit = profile?.has_paid && (profile?.plans_generated || 0) >= totalAllowedGenerations;
  const freeActionBlocked = !profile?.has_paid && !!profile?.free_action_used;
  const currentStreak = computeStreak(checkins, planId);
  const earnedBadges = getEarnedBadges(currentStreak);
  const lifetimeCompleted = computeLifetimeCompleted(lifetimeCheckins);
  const remainingSwaps = Math.max(0, SWAPS_PER_WEEK - (swapCounts[currentWeek] || 0));

  const [fieldErrors, setFieldErrors] = useState({});

  const generate = async () => {
    const errs = {};
    if (!form.goal.trim()) errs.goal = "Tell us your main fitness goal.";
    if (!form.age.trim()) errs.age = "Tell us your age.";
    else if (!Number.isFinite(Number(form.age)) || Number(form.age) < 13 || Number(form.age) > 90) errs.age = "Enter an age between 13 and 90.";
    if (!form.excuse.trim()) errs.excuse = "This helps the plan work around your real challenge.";
    if (!form.equipmentLocation) errs.equipmentLocation = "Select where you train.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) { setError(""); return; }
    if (atGenerationLimit) { setError("You've used your included generations."); return; }
    if (freeActionBlocked) { setError(`You've used your free ${profile.free_action_used === "grade" ? "routine grade" : "plan"}. Unlock to keep going.`); return; }
    setError(""); setLoading(true); setPlan(null);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 8000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: buildPrompt(form) }] }),
      });
      if (res.status === 402) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error || "You've used your free action. Unlock to keep going.");
        loadProfile();
        return;
      }
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setLoadingProgress(100);
      setPlan(parsed);
      setActiveWorkout(0);
      setPlanId(null);
      setPlanCreatedAt(new Date().toISOString());
      setCheckins([]);
      setCurrentWeek(1);
      localStorage.removeItem(`fitplan_draft_form_${session.user.id}`);
      if (session && profile?.has_paid) {
        await savePlan(parsed);
        await fetch("/api/track-generation", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ userId: session.user.id }),
        });
        loadProfile();
        localStorage.removeItem(`fitplan_pending_plan_${session.user.id}`);
      } else {
        localStorage.setItem(`fitplan_pending_plan_${session.user.id}`, JSON.stringify({ plan: parsed, createdAt: Date.now() }));
        loadProfile();
      }
    } catch (e) {
      setError("Something went wrong generating the plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Template-mode rows serialize into the same plain-text shape the free-text path
  // already produces, so grade-workout.js (and buildGradePrompt) never need to know
  // which input mode was used.
  // Template-mode days serialize into the same plain-text shape the free-text path
  // already produces (day header, then one line per exercise), so grade-workout.js
  // (and buildGradePrompt) never need to know which input mode was used.
  const serializeTemplateDays = (days) =>
    days
      .map(d => {
        const exerciseLines = d.exercises
          .filter(r => r.name.trim())
          .map(r => {
            const details = [r.sets && `${r.sets} sets`, r.reps && `${r.reps} reps`, r.effort].filter(Boolean).join(", ");
            return details ? `${r.name.trim()}: ${details}` : r.name.trim();
          });
        return exerciseLines.length > 0 ? `${d.day.trim() || "Day"}:\n${exerciseLines.join("\n")}` : null;
      })
      .filter(Boolean)
      .join("\n\n");

  const updateTemplateDayName = (dayIndex, value) => {
    setTemplateDays(days => days.map((d, i) => (i === dayIndex ? { ...d, day: value } : d)));
  };
  const updateTemplateExercise = (dayIndex, exIndex, field, value) => {
    setTemplateDays(days => days.map((d, i) => (
      i !== dayIndex ? d : { ...d, exercises: d.exercises.map((r, j) => (j === exIndex ? { ...r, [field]: value } : r)) }
    )));
  };
  const addTemplateExercise = (dayIndex) => {
    setTemplateDays(days => days.map((d, i) => (
      i !== dayIndex ? d : { ...d, exercises: [...d.exercises, { name: "", sets: "", reps: "", effort: "" }] }
    )));
  };
  const removeTemplateExercise = (dayIndex, exIndex) => {
    setTemplateDays(days => days.map((d, i) => (
      i !== dayIndex || d.exercises.length <= 1 ? d : { ...d, exercises: d.exercises.filter((_, j) => j !== exIndex) }
    )));
  };
  const addTemplateDay = () => setTemplateDays(days => [...days, { day: `Day ${days.length + 1}`, exercises: [{ name: "", sets: "", reps: "", effort: "" }] }]);
  const removeTemplateDay = (dayIndex) => setTemplateDays(days => (days.length > 1 ? days.filter((_, i) => i !== dayIndex) : days));

  const gradeWorkout = async () => {
    const routineTextToGrade = gradeInputMode === "template" ? serializeTemplateDays(templateDays) : routineText;
    if (!routineTextToGrade.trim()) {
      setGradeError(gradeInputMode === "template" ? "Add at least one exercise with a name." : "Paste or describe your current routine first.");
      return;
    }
    if (!form.equipmentLocation) { setFieldErrors({ equipmentLocation: "Select where you train." }); return; }
    if (atGenerationLimit) { setGradeError("You've used your included generations."); return; }
    if (freeActionBlocked) { setGradeError(`You've used your free ${profile.free_action_used === "plan" ? "plan generation" : "routine grade"}. Unlock to keep going.`); return; }
    setGradeError(""); setGrading(true); setGradeResult(null);
    try {
      const res = await fetch("/api/grade-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, system: GRADE_SYSTEM_PROMPT, messages: [{ role: "user", content: buildGradePrompt(form, routineTextToGrade) }] }),
      });
      if (res.status === 402) {
        const errBody = await res.json().catch(() => ({}));
        setGradeError(errBody.error || "You've used your free action. Unlock to keep going.");
        loadProfile();
        return;
      }
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setLoadingProgress(100);
      setGradeResult(parsed);
      loadProfile();
      localStorage.removeItem(`fitplan_draft_form_${session.user.id}`);
    } catch (e) {
      setGradeError("Something went wrong grading your routine. Please try again.");
    } finally {
      setGrading(false);
    }
  };

  // --- Check-in handlers ---
  const lastActivityDate = checkins.length > 0
    ? new Date(checkins[checkins.length - 1].created_at)
    : planCreatedAt ? new Date(planCreatedAt) : null;
  const nextCheckInDate = lastActivityDate ? getNextCheckInDate(lastActivityDate) : null;
  const canCheckIn = isCheckInDue(lastActivityDate);
  const daysUntilCheckIn = nextCheckInDate
    ? Math.max(1, Math.ceil((nextCheckInDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  const toggleExerciseDone = (day, exerciseName) => {
    const key = `${day}::${exerciseName}`;
    setCheckInState(p => ({ ...p, [key]: !p[key] }));
  };

  const toggleDayDone = (day) => {
    setDayCheckInState(p => ({ ...p, [day]: p[day] === false }));
  };

  const openCheckIn = () => {
    const initial = {};
    const initialLogs = {};
    // Same "latest checkin" lookup getExerciseRecommendation uses (checkins[length-1],
    // day + dedupeExerciseNames storage-name key into completed_exercises) — reused
    // here rather than a second matching method, and deliberately only the
    // immediately preceding check-in, never scanning further back into history.
    const latestCheckin = checkins[checkins.length - 1];
    plan.workouts.forEach(w => {
      const storageNames = dedupeExerciseNames(w.exercises);
      w.exercises.forEach((ex, i) => {
        const key = `${w.day}::${storageNames[i]}`;
        initial[key] = true; // default: assume completed, uncheck to report a skip
        const prior = latestCheckin?.completed_exercises?.[w.day]?.[storageNames[i]];
        if (!prior?.done) return; // no prior check-in for this exercise (skipped, or never logged) — nothing to pre-fill
        const log = {};
        if (typeof prior.avgWeight === "number") log.avgWeight = prior.avgWeight;
        if (typeof prior.avgReps === "number") log.avgReps = prior.avgReps;
        if (Object.keys(log).length > 0) initialLogs[key] = log;
      });
    });
    setCheckInState(initial);
    setSkipReasons({});
    setCheckInLogs(initialLogs);
    setPrefillLogs(initialLogs);
    setDayCheckInState({});
    setDayReasons({});
    setShowCheckIn(true);
  };

  const updateSkipReason = (day, exerciseName, value) => {
    const key = `${day}::${exerciseName}`;
    setSkipReasons(p => ({ ...p, [key]: value }));
  };

  const updateDayReason = (day, value) => {
    setDayReasons(p => ({ ...p, [day]: value }));
  };

  const updateCheckInLog = (day, exerciseName, field, rawValue) => {
    const key = `${day}::${exerciseName}`;
    const num = rawValue === "" ? null : Number(rawValue);
    setCheckInLogs(p => ({ ...p, [key]: { ...p[key], [field]: (num == null || Number.isNaN(num)) ? null : num } }));
  };

  const submitCheckInRef = useRef(false);
  const submitCheckIn = async () => {
    if (!planId || !canCheckIn) return;
    // A ref, not state — disabled={adjusting} only takes effect once React
    // re-renders and the DOM updates, which isn't fast enough to stop a real
    // double-click/double-tap from firing this twice before that commits.
    // Refs update synchronously, so this closes the gap.
    if (submitCheckInRef.current) return;
    submitCheckInRef.current = true;
    setAdjusting(true);
    setError("");
    try {
      const completed_exercises = {};
      plan.workouts.forEach(w => {
        completed_exercises[w.day] = {};
        const dayDone = dayCheckInState[w.day] !== false;
        const storageNames = dedupeExerciseNames(w.exercises);
        w.exercises.forEach((ex, i) => {
          const key = `${w.day}::${storageNames[i]}`;
          const done = dayDone && !!checkInState[key];
          completed_exercises[w.day][storageNames[i]] = done
            ? { done: true, avgWeight: checkInLogs[key]?.avgWeight ?? null, avgReps: checkInLogs[key]?.avgReps ?? null }
            : { done: false, reason: dayDone ? (skipReasons[key]?.trim() || "No reason given") : (dayReasons[w.day]?.trim() || "No reason given") };
        });
      });

      const { data: checkinRow } = await supabase
        .from("checkins")
        .insert({
          plan_id: planId,
          user_id: session.user.id,
          week_number: currentWeek,
          completed_exercises,
          notes: checkInNotes,
          is_deload: !!plan.is_deload_week,
        })
        .select()
        .single();

      const history = [...checkins, checkinRow];
      const previousStreak = computeStreak(checkins, planId);
      const newStreak = computeStreak(history, planId);
      const isDeloadWeek = shouldTriggerDeload(plan, history, currentWeek + 1);
      setLifetimeCheckins(prev => [...prev, checkinRow]);

      const res = await fetch("/api/adjust-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          system: ADJUST_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildAdjustPrompt(plan, history, newStreak, isDeloadWeek) }],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const adjustedPlan = JSON.parse(clean);
      setLoadingProgress(100);
      // Deload status is decided deterministically in JS (see shouldTriggerDeload),
      // not left to the model to echo back correctly — this is what the spacing rule
      // and the UI label above key off for the next check-in.
      adjustedPlan.is_deload_week = isDeloadWeek;

      await supabase.from("plans").update({ plan_data: adjustedPlan }).eq("id", planId);

      const newlyEarned = STREAK_BADGES.filter(b => newStreak >= b.weeks && previousStreak < b.weeks);
      if (newlyEarned.length > 0) setNewlyEarnedBadges(newlyEarned);

      setPlan(adjustedPlan);
      setCheckins(history);
      setCurrentWeek(currentWeek + 1);
      setCheckInState({});
      setSkipReasons({});
      setCheckInLogs({});
      setPrefillLogs({});
      setDayCheckInState({});
      setDayReasons({});
      setCheckInNotes("");
      setShowCheckIn(false);
      setActiveWorkout(0);
    } catch (e) {
      setError("Something went wrong adjusting your plan. Please try again.");
    } finally {
      submitCheckInRef.current = false;
      setAdjusting(false);
    }
  };

  // --- Single-exercise swap handlers ---
  const openSwap = (day, index) => {
    const key = `${day}::${index}`;
    setSwapOpenKey(k => (k === key ? null : key));
    setSwapReason("");
    setSwapError("");
  };

  const submitSwap = async (workout, index) => {
    setSwapping(true);
    setSwapError("");
    try {
      const res = await fetch("/api/adjust-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 300,
          system: SWAP_SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildSwapPrompt(workout, workout.exercises[index], swapReason.trim() || "No reason given") }],
          planId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSwapError(data.error || "Couldn't find a replacement. Please try again."); return; }
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const newExercise = JSON.parse(clean);

      const updatedPlan = {
        ...plan,
        workouts: plan.workouts.map(w => (
          w.day !== workout.day ? w : { ...w, exercises: w.exercises.map((ex, i) => (i === index ? newExercise : ex)) }
        )),
      };
      setPlan(updatedPlan);
      if (planId) await supabase.from("plans").update({ plan_data: updatedPlan }).eq("id", planId);
      setSwapCounts(prev => ({ ...prev, [currentWeek]: (prev[currentWeek] || 0) + 1 }));
      setSwapOpenKey(null);
    } catch (e) {
      setSwapError("Couldn't find a replacement. Please try again.");
    } finally {
      setSwapping(false);
    }
  };

  if (page === "terms") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)", padding: "0.9rem 1.5rem", display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <div style={{ width: 34, height: 34, borderRadius: "9px", background: "linear-gradient(135deg, var(--accent), var(--accent-deep))", display: "flex", alignItems: "center", justifyContent: "center" }}><Dumbbell size={18} color="#fff" /></div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: "0.95rem", color: "var(--ink)" }}>FitPlan AI</div>
          <button onClick={() => setPage("app")} style={{ marginLeft: "auto", padding: "0.4rem 0.9rem", border: "1.5px solid var(--line)", borderRadius: "7px", background: "transparent", fontSize: "0.82rem", color: "var(--muted)", cursor: "pointer", fontWeight: 600 }}>← Back</button>
        </div>
        <TermsOfService />
      </div>
    );
  }

  if (page === "privacy") {
    return (
      <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)", padding: "0.9rem 1.5rem", display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <div style={{ width: 34, height: 34, borderRadius: "9px", background: "linear-gradient(135deg, var(--accent), var(--accent-deep))", display: "flex", alignItems: "center", justifyContent: "center" }}><Dumbbell size={18} color="#fff" /></div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: "0.95rem", color: "var(--ink)" }}>FitPlan AI</div>
          <button onClick={() => setPage("app")} style={{ marginLeft: "auto", padding: "0.4rem 0.9rem", border: "1.5px solid var(--line)", borderRadius: "7px", background: "transparent", fontSize: "0.82rem", color: "var(--muted)", cursor: "pointer", fontWeight: 600 }}>← Back</button>
        </div>
        <PrivacyPolicy />
      </div>
    );
  }

  if (passwordRecovery) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="app-mark"><Dumbbell size={18} color="#fff" /></div>
            <div className="app-wordmark">FitPlan AI</div>
          </div>
          {resetSuccess ? (
            <>
              <h2 className="auth-title">Password updated</h2>
              <p className="auth-sub">You can continue to your account now.</p>
              <button onClick={() => { setPasswordRecovery(false); setResetSuccess(false); }} className="btn btn-solid btn-block">
                Continue to FitPlan AI
              </button>
            </>
          ) : (
            <>
              <h2 className="auth-title">Set a new password</h2>
              <p className="auth-sub">Choose a new password for your account.</p>
              <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ ...inputStyle, marginBottom: "0.75rem", display: "block" }} />
              <input type="password" placeholder="Confirm new password" value={newPasswordConfirm} onChange={e => setNewPasswordConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSetNewPassword()} style={{ ...inputStyle, marginBottom: "1rem", display: "block" }} />
              {resetError && <p className="auth-error">{resetError}</p>}
              <button onClick={handleSetNewPassword} disabled={resetLoading} className="btn btn-solid btn-block">
                {resetLoading ? "..." : "Set new password"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (page === "landing" && !session) {
    return (
      <div className="landing">
        <div className="landing-brand">
          <div className="app-mark"><Dumbbell size={18} color="#fff" /></div>
          <div className="app-wordmark">FitPlan AI</div>
        </div>

        <div className="landing-main">
          <h1 className="landing-title">
            A fitness plan <span className="landing-title-accent">built around your life</span>, not a generic template
          </h1>
          <p className="landing-sub">
            Tell it your goals, equipment, injuries, and schedule. FitPlan AI's engine, purpose-built for fitness, generates a real ongoing plan around them, then adjusts it every week based on what you actually did.
          </p>
          <div className="landing-cta">
            <button className="btn btn-solid" onClick={() => { setAuthMode("signup"); setPage("app"); }}>
              Get Started Free
            </button>
            <button className="btn btn-ghost" onClick={() => { setAuthMode("login"); setPage("app"); }}>
              Log In
            </button>
          </div>

          <LandingCarousel features={LANDING_FEATURES} />

          <div style={{ marginTop: "3rem", textAlign: "left" }}>
            <p className="landing-eyebrow">
              Example from a real generated plan
            </p>
            <ScrollRevealCard>
            <div className="landing-preview">
              <div className="landing-preview-tabs">
                {["Monday", "Tuesday", "Thursday", "Saturday"].map((d, i) => (
                  <span key={d} className={`landing-preview-tab${i === 0 ? " is-active" : ""}`}>{d}</span>
                ))}
              </div>
              <div className="landing-preview-head">
                <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>MONDAY · Push Day: Chest, Shoulders &amp; Triceps</span>
                <span style={{ fontSize: "0.75rem" }}>50 min</span>
              </div>
              <div className="landing-preview-body">
                <div className="info-box info-box-warm" style={{ marginBottom: "0.75rem" }}>
                  <span className="info-box-label">Warm-up</span>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem" }}>5 min band pull-aparts, arm circles, and light incline push-ups</p>
                </div>
                {LANDING_PREVIEW_EXERCISES.map((ex, i) => {
                  const recoTone = GRADE_TONE_STYLES[RECOMMENDATION_TONE[ex.reco.level]];
                  return (
                  <div key={i} className="exercise-card" style={{ marginBottom: "0.5rem" }}>
                    <div className="exercise-row" style={{ gridTemplateColumns: "1fr auto", padding: "0.7rem 0.85rem" }}>
                      <div className="exercise-body">
                        <div className="exercise-name" style={{ fontSize: "0.85rem" }}>
                          {ex.name}
                          <span onClick={() => openYoutube(ex.name)} className="exercise-action-btn">▶ how to</span>
                          <span className="exercise-action-btn">Can't do this?</span>
                        </div>
                        <div className="exercise-note">{ex.note}</div>
                      </div>
                      <div className="exercise-stats">
                        <div className="exercise-sets" style={{ fontSize: "0.8rem" }}>{ex.sets}×{ex.reps}</div>
                        <div className="exercise-rest">{ex.rest} rest</div>
                        {ex.effort && <div className="exercise-effort">{LANDING_PREVIEW_FIRST_EFFORT_INDICES.has(i) ? renderWithGlossary(ex.effort) : ex.effort}</div>}
                      </div>
                    </div>
                    <div className="exercise-reco" style={{ background: recoTone.bg, color: recoTone.text }}>
                      {RECOMMENDATION_LABEL[ex.reco.level](ex.reco)}
                    </div>
                  </div>
                  );
                })}
                <div className="info-box info-box-cool" style={{ marginTop: "0.25rem" }}>
                  <span className="info-box-label">Cool-down</span>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem" }}>5 min static stretching: chest doorway stretch, cross-body shoulder stretch</p>
                </div>
              </div>
            </div>
            </ScrollRevealCard>
          </div>

          <div style={{ marginTop: "3rem", textAlign: "left" }}>
            <p className="landing-eyebrow">What makes it different</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div className="section-card" style={{ padding: "1.25rem" }}>
                <div className="landing-feature-mark" style={{ marginBottom: "0.75rem" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>
                </div>
                <div className="landing-feature-title" style={{ marginBottom: "0.4rem" }}>Checks in, then adjusts</div>
                <div className="landing-feature-body" style={{ marginBottom: "0.9rem" }}>Log what you actually did each week and the plan rewrites itself around it, not a static PDF you forget by week three.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ background: "var(--accent-bg)", borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                    <label className="checkin-exercise-label" style={{ pointerEvents: "none" }}>
                      <input type="checkbox" checked readOnly />
                      Bench Press
                    </label>
                  </div>
                  <div style={{ background: "var(--accent-bg)", borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                    <label className="checkin-exercise-label" style={{ pointerEvents: "none" }}>
                      <input type="checkbox" checked readOnly />
                      Romanian Deadlift
                    </label>
                  </div>
                  <div style={{ background: "var(--warm-bg)", borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                    <label className="checkin-exercise-label" style={{ pointerEvents: "none", color: "var(--warm-text)" }}>
                      <input type="checkbox" readOnly />
                      Pull-ups
                    </label>
                    <div style={{ fontSize: "0.78rem", color: "var(--warm-text)", marginTop: "0.3rem" }}>Too hard today</div>
                  </div>
                </div>
              </div>

              <div className="section-card" style={{ padding: "1.25rem" }}>
                <div className="landing-feature-mark" style={{ marginBottom: "0.75rem" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10" /><path d="M12 20V4" /><path d="M20 20v-7" /></svg>
                </div>
                <div className="landing-feature-title" style={{ marginBottom: "0.4rem" }}>Grades your current routine</div>
                <div className="landing-feature-body" style={{ marginBottom: "0.9rem" }}>Paste or build any routine, gym-built or homemade, and get a score with specific fixes, not generic encouragement.</div>
                <div className="grade-score-card" style={{ margin: 0, padding: "0.75rem 0.9rem", textAlign: "center" }}>
                  <div className="grade-score-label">Routine Score</div>
                  <CircularScore score={82} color={GRADE_TONE_STYLES[getGradeScoreTone(82)].text} size={100} />
                </div>
              </div>

              <div className="section-card" style={{ padding: "1.25rem" }}>
                <div className="landing-feature-mark" style={{ marginBottom: "0.75rem" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 19V5" /><path d="M3 19h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>
                </div>
                <div className="landing-feature-title" style={{ marginBottom: "0.4rem" }}>Knows when to push or pull back</div>
                <div className="landing-feature-body" style={{ marginBottom: "0.9rem" }}>Compares this week's reps and weight against target ranges and calls a clear progress, maintain, or deload, no guesswork.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[["progress", { weightSuggestion: 25 }], ["maintain", {}], ["deload", {}]].map(([level, rec]) => (
                    <div key={level} className="exercise-reco" style={{ margin: 0, display: "inline-block", background: GRADE_TONE_STYLES[RECOMMENDATION_TONE[level]].bg, color: GRADE_TONE_STYLES[RECOMMENDATION_TONE[level]].text }}>
                      {RECOMMENDATION_LABEL[level](rec)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "3rem" }}>
            <p className="landing-eyebrow">Pricing</p>
            <div className="landing-pricing">
              <div className="landing-pricing-amount">€19 <span className="landing-pricing-amount-unit">one-time</span></div>
              <p className="landing-pricing-detail">= <strong>3 credits</strong>, each one good for a full plan generation or a workout grade. Spend them however you like.</p>
              <p className="landing-pricing-extra">Need more later? Extra credits are €7 each.</p>
            </div>
          </div>

          <div style={{ marginTop: "3rem" }}>
            <p className="landing-eyebrow">What people are saying</p>
            <Testimonials />
          </div>
        </div>

        <p className="landing-footer-links">
          <span onClick={() => setPage("terms")}>Terms of Service</span>
          {" · "}
          <span onClick={() => setPage("privacy")}>Privacy Policy</span>
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="app-mark"><Dumbbell size={18} color="#fff" /></div>
            <div className="app-wordmark">FitPlan AI</div>
          </div>
          <h2 className="auth-title">{authMode === "login" ? "Welcome back" : "Create account"}</h2>
          <p className="auth-sub">{authMode === "login" ? "Sign in to access your plans" : "Start your fitness journey"}</p>
          <input type="email" placeholder="Email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ ...inputStyle, marginBottom: "0.75rem", display: "block" }} />
          <input type="password" placeholder="Password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} style={{ ...inputStyle, marginBottom: "1rem", display: "block" }} />
          {authError && <p className="auth-error">{authError}</p>}
          <button onClick={handleAuth} disabled={authLoading} className="btn btn-solid btn-block">
            {authLoading ? "..." : authMode === "login" ? "Sign In" : "Sign Up"}
          </button>
          {authMode === "login" && (
            forgotSent ? (
              <p className="auth-success">Check your email for a reset link.</p>
            ) : (
              <p className="auth-links">
                <span onClick={handleForgotPassword}>Forgot password?</span>
              </p>
            )
          )}
          <p className="auth-footnote">
            {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}>
              {authMode === "login" ? "Sign up" : "Sign in"}
            </span>
          </p>
          <p className="auth-legal">
            By signing up you agree to our{" "}
            <span onClick={() => setPage("terms")}>Terms of Service</span>
            {" "}and{" "}
            <span onClick={() => setPage("privacy")}>Privacy Policy</span>
          </p>
          <p className="auth-back">
            <span onClick={() => setPage("landing")}>← Back to home</span>
          </p>
        </div>
      </div>
    );
  }

  if (session && profile === null) {
    return (
      <div className="auth-shell">
        <div className="auth-spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell">

      <div className="app-header">
        <div className="app-mark"><Dumbbell size={18} color="#fff" /></div>
        <div>
          <div className="app-wordmark">FitPlan AI</div>
          <div className="app-tagline">Your Personalized Fitness AI</div>
        </div>
        <div className="header-actions">
          {profile?.has_paid && (
            <button onClick={() => setShowSavedPlans(!showSavedPlans)} className="btn btn-ghost">
              <ClipboardList size={14} style={{ verticalAlign: -2, marginRight: "0.3rem" }} />My Plans ({savedPlans.length})
            </button>
          )}
          {profile?.has_paid && (
            <span className="pill" style={{ background: "var(--accent-bg)", color: "var(--accent-deep)" }} title="Each plan generation or routine grade uses one credit">
              {Math.max(totalAllowedGenerations - (profile?.plans_generated || 0), 0)} of {totalAllowedGenerations} credits left
            </span>
          )}
          {profile?.has_paid && plan && planId && currentStreak >= 1 && (
            <span className="pill" style={{ background: "var(--accent-bg)", color: "var(--accent-deep)", display: "inline-flex", alignItems: "center", gap: "0.4rem" }} title={`${currentStreak} consecutive weekly check-in${currentStreak === 1 ? "" : "s"}`}>
              <Flame size={14} /> {currentStreak}-week streak
              {earnedBadges.length > 0 && (
                <span style={{ display: "inline-flex", gap: "0.15rem" }}>
                  {earnedBadges.map(b => <span key={b.weeks} title={b.label}><Medal size={15} color={b.color} /></span>)}
                </span>
              )}
            </span>
          )}
          {profile?.has_paid && plan && planId && (
            canCheckIn ? (
              <button onClick={openCheckIn} className="btn btn-cool">
                ✓ Week {currentWeek} check-in
              </button>
            ) : (
              <span title="Give the plan a full week before checking in" style={{ padding: "0.4rem 0.9rem", border: "1.5px solid var(--line)", borderRadius: "7px", background: "var(--paper)", fontSize: "0.82rem", color: "var(--faint)", fontWeight: 600, whiteSpace: "nowrap" }}>
                Check-in in {daysUntilCheckIn} day{daysUntilCheckIn === 1 ? "" : "s"}
              </span>
            )
          )}
          {plan && !profile?.has_paid && (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--faint)", textAlign: "right", maxWidth: 270, lineHeight: 1.3 }}>
                Your plan is saved in your browser for 24 hours. €19 unlocks 3 plan generations or routine grades, and saves it permanently so you can access it anytime.
              </span>
              <button onClick={() => startCheckout("unlock")} disabled={checkingOut === "unlock"} className="btn btn-solid">
                {checkingOut === "unlock" ? "Redirecting..." : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, verticalAlign: -1, marginRight: "0.35rem" }}>
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    Unlock this plan for €19
                  </>
                )}
              </button>
            </div>
          )}
          {plan && profile?.has_paid && (
            <>
              <button onClick={() => exportToPDF(plan)} className="btn btn-tint">
                ↓ Download
              </button>
              <button onClick={() => {
                if (window.confirm("Starting a new plan will replace this one. Routines work best when you stick with them and let check-ins adjust them over time, rather than switching often. Continue anyway?")) {
                  setPlan(null);
                  setSwapOpenKey(null);
                }
              }} className="btn btn-ghost">
                ← New Plan
              </button>
            </>
          )}
          {plan && !profile?.has_paid && (
            <button onClick={() => {
              localStorage.removeItem(`fitplan_pending_plan_${session.user.id}`);
              setPlan(null);
              setSwapOpenKey(null);
            }} className="btn btn-ghost">
              ← New Plan
            </button>
          )}
          <button onClick={handleSignOut} className="btn btn-ghost">
            Sign out
          </button>
        </div>
      </div>

      {justUnlocked && (
        <div style={{ maxWidth: 720, margin: "0.85rem auto 0", padding: "0 1.25rem" }}>
          <div className="info-box info-box-cool" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <p style={{ margin: 0 }}>
              {justUnlocked === "extra_generation"
                ? <><PartyPopper size={16} style={{ verticalAlign: -3, marginRight: "0.3rem" }} />Credit added! Your extra €7 covers <strong>one more plan generation or routine grade</strong>. Use it whenever you're ready.</>
                : <><PartyPopper size={16} style={{ verticalAlign: -3, marginRight: "0.3rem" }} />You're unlocked! Your €19 covers <strong>3 plan generations or routine grades</strong> total. Use them whenever you're ready.</>}
            </p>
            <span onClick={() => setJustUnlocked(null)} style={{ cursor: "pointer", fontWeight: 700, color: "var(--accent-deep)", flexShrink: 0 }}>×</span>
          </div>
        </div>
      )}

      {newlyEarnedBadges.length > 0 && (
        <div style={{ maxWidth: 720, margin: "0.85rem auto 0", padding: "0 1.25rem" }}>
          <div className="info-box info-box-cool" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <p style={{ margin: 0 }}>
              {newlyEarnedBadges.map(b => <Medal key={b.weeks} size={16} color={b.color} style={{ verticalAlign: -3, marginRight: "0.15rem" }} />)}New badge{newlyEarnedBadges.length > 1 ? "s" : ""}: <strong>{newlyEarnedBadges.map(b => b.label).join(", ")}</strong>. {currentStreak} weeks checked in, in a row.
            </p>
            <span onClick={() => setNewlyEarnedBadges([])} style={{ cursor: "pointer", fontWeight: 700, color: "var(--accent-deep)", flexShrink: 0 }}>×</span>
          </div>
        </div>
      )}

      {showSavedPlans && (
        <div style={{ maxWidth: 720, margin: "1rem auto", padding: "0 1.25rem" }}>
          <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--line)", padding: "1.25rem" }}>
            <h3 style={{ fontFamily: "var(--display)", fontSize: "0.9rem", fontWeight: 700, margin: "0 0 1rem", letterSpacing: "-0.01em", color: "var(--ink)" }}>My Saved Plans</h3>
            {savedPlans.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}><ClipboardList size={26} color="var(--faint)" /></div>
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>No saved plans yet. Generate a plan and unlock it to see it here.</p>
              </div>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {savedPlans.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.85rem", background: "var(--paper)", borderRadius: "8px", border: "1px solid var(--line-soft)" }}>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)" }}>{p.title}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--faint)" }}>{new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={() => loadPlan(p.id)} style={{ padding: "0.3rem 0.7rem", background: "var(--accent-bg)", border: "1px solid var(--accent-border)", borderRadius: "6px", fontSize: "0.78rem", color: "var(--accent-deep)", cursor: "pointer", fontWeight: 600 }}>Load</button>
                    <button onClick={() => deletePlan(p.id)} style={{ padding: "0.3rem 0.7rem", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "6px", fontSize: "0.78rem", color: "var(--danger)", cursor: "pointer", fontWeight: 600 }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.75rem 1.25rem 3rem" }}>
        {!plan && !gradeResult && !loading && !grading && (
          <>
            <div style={{ marginBottom: "1.75rem" }}>
              <h1 className="form-title">Your plan. Your life.</h1>
              <p className="form-sub">The more specific you are, the more personal your plan will be.</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
              <button type="button" onClick={() => setMode("generate")} className={`btn ${mode === "generate" ? "btn-solid" : "btn-ghost"}`}>
                Generate a plan
              </button>
              <button type="button" onClick={() => setMode("grade")} className={`btn ${mode === "grade" ? "btn-solid" : "btn-ghost"}`}>
                Grade my routine
              </button>
            </div>
            {mode === "generate" ? (
            <div className="form-card">
              <Divider label="Your Goal" />
              <Field label="What's your main fitness goal?" name="goal" value={form.goal} onChange={handleChange} placeholder="Build muscle while losing body fat" error={fieldErrors.goal} suggestions={["Build muscle", "Lose fat", "Build muscle while losing fat", "Get stronger", "Improve general fitness and health", "Improve endurance / cardio", "Train for a sport or event"]} />
              <Field label="Specific target (optional)" name="target" value={form.target} onChange={handleChange} placeholder="Lose 5kg, gain visible arm muscle, run 5km" hint="The more concrete the better. Give us a number if you can." />

              <Divider label="Your Schedule" />
              <Field label="Other physical activity or sports" name="otherActivity" value={form.otherActivity} onChange={handleChange} placeholder="Football on Tuesdays and Thursdays, badminton twice a week" hint="Include anything physical. This prevents the plan from clashing with your existing activity." />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.85rem" }}>
                <Field label="Gym days per week" name="days" value={form.days} onChange={handleChange} as="select" options={[2,3,4,5,6].map(n => ({ value: String(n), label: `${n} days` }))} />
                <Field label="Minutes per session" name="time" value={form.time} onChange={handleChange} type="number" placeholder="45" />
                <Field label="Preferred time" name="trainTime" value={form.trainTime} onChange={handleChange} as="select" options={[{ value: "morning", label: "Morning" }, { value: "afternoon", label: "Afternoon" }, { value: "evening", label: "Evening" }, { value: "flexible", label: "Flexible" }]} />
              </div>
              <div className="field">
                <label className="field-label">Specific days? (optional)</label>
                <p className="field-hint">Only pick days if you have fixed ones, up to your {form.days}-day count above. Leave blank to let the plan decide.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {DAYS_OF_WEEK.map(day => {
                    const isSelected = form.specificDays.includes(day);
                    const isDisabled = !isSelected && form.specificDays.length >= Number(form.days);
                    return (
                      <button key={day} type="button" disabled={isDisabled} onClick={() => toggleSpecificDay(day)} className={`equip-chip${isSelected ? " is-selected" : ""}`} style={isDisabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
                        {isSelected ? "✓ " : ""}{day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                <Field label="Age" name="age" value={form.age} onChange={handleChange} type="number" placeholder="28" error={fieldErrors.age} />
                <Field label="Fitness level" name="level" value={form.level} onChange={handleChange} as="select" options={[{ value: "beginner", label: "Beginner (just starting out)" }, { value: "intermediate", label: "Intermediate (some experience)" }, { value: "advanced", label: "Advanced (trained consistently)" }]} />
              </div>

              <Divider label="Your Challenges" />
              <Field label="What's your biggest excuse or challenge?" name="excuse" value={form.excuse} onChange={handleChange} placeholder="I get home tired at 6pm and plain lifting bores me" error={fieldErrors.excuse} suggestions={EXCUSE_SUGGESTIONS} />
              <Field label="Have you tried a fitness plan before? What went wrong?" name="pastAttempts" value={form.pastAttempts} onChange={handleChange} placeholder="I quit after 2 weeks because it felt too repetitive" as="textarea" hint="This helps build a plan that avoids your past pitfalls." />

              <Divider label="Your Preferences" />
              <Field label="Exercises or activities you enjoy" name="enjoy" value={form.enjoy} onChange={handleChange} placeholder="Group classes, cycling, bodyweight movements" suggestions={ENJOY_SUGGESTIONS} />
              <Field label="Exercises you dislike or want to avoid" name="dislike" value={form.dislike} onChange={handleChange} placeholder="Running, heavy barbell squats" suggestions={DISLIKE_SUGGESTIONS} />
              <Field label="Injuries or physical limitations" name="injuries" value={form.injuries} onChange={handleChange} placeholder="Left knee pain, lower back issues, or 'none'" />

              <Divider label="Your Equipment" />
              <EquipmentSelector location={form.equipmentLocation} onLocationChange={handleEquipmentLocation} selected={form.equipment} onEquipmentChange={handleEquipment} error={fieldErrors.equipmentLocation} />

              {error && <p className="form-error">{error}</p>}
              {atGenerationLimit ? (
                <button onClick={() => startCheckout("extra_generation")} disabled={checkingOut === "extra_generation"} className="btn btn-cool-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  {checkingOut === "extra_generation" ? "Redirecting..." : `You've used your ${totalAllowedGenerations} included plans. Buy another for €7`}
                </button>
              ) : freeActionBlocked ? (
                <button onClick={() => startCheckout("unlock")} disabled={checkingOut === "unlock"} className="btn btn-cool-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  {checkingOut === "unlock" ? "Redirecting..." : `You've used your free ${profile.free_action_used === "grade" ? "routine grade" : "plan"}. Unlock for €19 (3 plan generations or grades)`}
                </button>
              ) : (
                <button onClick={generate} className="btn btn-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  Generate My Plan →
                </button>
              )}
            </div>
            ) : (
            <div className="form-card">
              <Divider label="Your Current Routine" />
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.9rem" }}>
                <button type="button" onClick={() => setGradeInputMode("template")} className={`btn ${gradeInputMode === "template" ? "btn-solid" : "btn-ghost"}`} style={{ padding: "0.4rem 0.9rem", fontSize: "0.82rem" }}>
                  Build it
                </button>
                <button type="button" onClick={() => setGradeInputMode("text")} className={`btn ${gradeInputMode === "text" ? "btn-solid" : "btn-ghost"}`} style={{ padding: "0.4rem 0.9rem", fontSize: "0.82rem" }}>
                  Paste it
                </button>
              </div>
              {gradeInputMode === "text" ? (
                <Field label="Describe or paste your current routine" name="routineText" value={routineText} onChange={e => setRoutineText(e.target.value)} placeholder={"Monday: Bench press 3x10, Lat pulldown 3x12...\nWednesday: Squat 3x8, Leg curl 3x12..."} as="textarea" hint="List your days, exercises, sets and reps as best you can. Rough is fine." />
              ) : (
                <div>
                  {templateDays.map((d, di) => (
                    <div key={di} style={{ marginBottom: "1.1rem", paddingBottom: "1.1rem", borderBottom: di < templateDays.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.7rem" }}>
                        <input type="text" value={d.day} onChange={e => updateTemplateDayName(di, e.target.value)} className="field-input" style={{ maxWidth: 160, fontWeight: 700 }} />
                        {templateDays.length > 1 && (
                          <button type="button" onClick={() => removeTemplateDay(di)} className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}>Remove day</button>
                        )}
                      </div>
                      {d.exercises.map((row, ei) => (
                        <div key={ei} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", marginBottom: "0.6rem", flexWrap: "wrap" }}>
                          <div style={{ flex: 2, minWidth: 140 }}>
                            <Field label={ei === 0 ? "Exercise" : ""} name={`ex-name-${di}-${ei}`} value={row.name} onChange={e => updateTemplateExercise(di, ei, "name", e.target.value)} placeholder="Bench press" />
                          </div>
                          <div style={{ flex: 1, minWidth: 70 }}>
                            <Field label={ei === 0 ? "Sets" : ""} name={`ex-sets-${di}-${ei}`} value={row.sets} onChange={e => updateTemplateExercise(di, ei, "sets", e.target.value)} type="number" placeholder="3" />
                          </div>
                          <div style={{ flex: 1, minWidth: 90 }}>
                            <Field label={ei === 0 ? "Reps" : ""} name={`ex-reps-${di}-${ei}`} value={row.reps} onChange={e => updateTemplateExercise(di, ei, "reps", e.target.value)} placeholder="8-12" />
                          </div>
                          <div style={{ flex: 1.4, minWidth: 130 }}>
                            <Field label={ei === 0 ? "Effort" : ""} name={`ex-effort-${di}-${ei}`} value={row.effort} onChange={e => updateTemplateExercise(di, ei, "effort", e.target.value)} as="select" options={EFFORT_OPTIONS} />
                          </div>
                          {d.exercises.length > 1 && (
                            <button type="button" onClick={() => removeTemplateExercise(di, ei)} className="btn btn-ghost" style={{ padding: "0.5rem 0.6rem", fontSize: "0.8rem", flexShrink: 0 }} aria-label="Remove exercise">✕</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => addTemplateExercise(di)} className="btn btn-ghost" style={{ fontSize: "0.82rem" }}>+ Add exercise</button>
                    </div>
                  ))}
                  <button type="button" onClick={addTemplateDay} className="btn btn-tint" style={{ fontSize: "0.82rem" }}>+ Add day</button>
                </div>
              )}

              <Divider label="Your Profile" />
              <Field label="What's your main fitness goal?" name="goal" value={form.goal} onChange={handleChange} placeholder="Build muscle while losing body fat" suggestions={["Build muscle", "Lose fat", "Build muscle while losing fat", "Get stronger", "Improve general fitness and health", "Improve endurance / cardio", "Train for a sport or event"]} />
              <Field label="Fitness level" name="level" value={form.level} onChange={handleChange} as="select" options={[{ value: "beginner", label: "Beginner (just starting out)" }, { value: "intermediate", label: "Intermediate (some experience)" }, { value: "advanced", label: "Advanced (trained consistently)" }]} />
              <Field label="Injuries or physical limitations" name="injuries" value={form.injuries} onChange={handleChange} placeholder="Left knee pain, lower back issues, or 'none'" />

              <Divider label="Your Equipment" />
              <EquipmentSelector location={form.equipmentLocation} onLocationChange={handleEquipmentLocation} selected={form.equipment} onEquipmentChange={handleEquipment} error={fieldErrors.equipmentLocation} />

              {gradeError && <p className="form-error">{gradeError}</p>}
              {atGenerationLimit ? (
                <button onClick={() => startCheckout("extra_generation")} disabled={checkingOut === "extra_generation"} className="btn btn-cool-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  {checkingOut === "extra_generation" ? "Redirecting..." : `You've used your ${totalAllowedGenerations} included plans. Buy another for €7`}
                </button>
              ) : freeActionBlocked ? (
                <button onClick={() => startCheckout("unlock")} disabled={checkingOut === "unlock"} className="btn btn-cool-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  {checkingOut === "unlock" ? "Redirecting..." : `You've used your free ${profile.free_action_used === "plan" ? "plan generation" : "routine grade"}. Unlock for €19 (3 plan generations or grades)`}
                </button>
              ) : (
                <button onClick={gradeWorkout} className="btn btn-solid btn-block" style={{ marginTop: "0.5rem" }}>
                  Grade My Routine →
                </button>
              )}
            </div>
            )}
            <p className="form-legal" style={{ marginTop: "1rem" }}>
              <span onClick={() => setPage("terms")}>Terms of Service</span>
              {" · "}
              <span onClick={() => setPage("privacy")}>Privacy Policy</span>
            </p>
          </>
        )}

        {(loading || grading) && (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${Math.round(loadingProgress)}%` }} />
            </div>
            <p className="progress-bar-percent">{Math.round(loadingProgress)}%</p>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{loading ? "Building your personalized plan..." : "Grading your routine..."}</p>
          </div>
        )}

        {plan && (
          <div>
            <div style={{ marginBottom: "1.5rem" }} className={!profile?.has_paid ? "preview-badge-host" : undefined}>
              {!profile?.has_paid && (
                <div className="preview-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                  Preview
                </div>
              )}
              <h2 className="results-title">{plan.title}</h2>
              <p className="results-summary">{plan.summary}</p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <span className="pill" style={{ background: "var(--accent-bg)", color: "var(--accent-deep)" }}><Calendar size={13} style={{ verticalAlign: -2, marginRight: "0.3rem" }} />{plan.schedule?.join(", ")}</span>
                {plan.is_deload_week ? (
                  <span className="pill" style={{ background: "var(--warm-bg)", color: "var(--warm-text)" }}><Bed size={13} style={{ verticalAlign: -2, marginRight: "0.3rem" }} />Deload Week</span>
                ) : (
                  <span className="pill" style={{ background: "var(--cool-bg)", color: "var(--cool-text)" }}><RefreshCw size={13} style={{ verticalAlign: -2, marginRight: "0.3rem" }} />Ongoing plan</span>
                )}
              </div>
            </div>

            {plan && planId && (
              <div className="section-card streak-card" style={{ padding: "1.25rem" }}>
                <div className="streak-card-row">
                  <div>
                    <div className="section-title">Check-in Streak</div>
                    <div className="streak-card-count"><Flame size={22} color="#EA580C" style={{ verticalAlign: -3, marginRight: "0.2rem" }} />{currentStreak}<span className="streak-card-unit">{currentStreak === 1 ? " week" : " weeks"}</span></div>
                  </div>
                  {earnedBadges.length > 0 && (
                    <div className="streak-card-badges">
                      {earnedBadges.map(b => <span key={b.weeks} title={b.label}><Medal size={15} color={b.color} /></span>)}
                    </div>
                  )}
                </div>
                <div className="streak-card-lifetime">{lifetimeCompleted} exercise{lifetimeCompleted === 1 ? "" : "s"} completed lifetime</div>
              </div>
            )}

            {plan.weeks_breakdown && (
              <div className="section-card" style={{ padding: "1.25rem" }}>
                <h3 className="section-title">Program Phases</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {plan.weeks_breakdown.map((p, i) => (
                    <div key={i} className="phase-row">
                      <div className="phase-index">{i + 1}</div>
                      <div>
                        <div className="phase-title">{p.phase}</div>
                        <div className="phase-focus">{renderWithGlossary(p.focus)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.workouts && (
              <div className="section-card">
                <div className="tab-row">
                  {plan.workouts.map((w, i) => (
                    <button key={i} onClick={() => setActiveWorkout(i)} className={`tab-btn${activeWorkout === i ? " is-active" : ""}`}>{w.day}</button>
                  ))}
                </div>
                {plan.workouts[activeWorkout] && (() => {
                  const w = plan.workouts[activeWorkout];
                  const firstEffortIndices = getFirstEffortIndices(w.exercises);
                  const storageNames = dedupeExerciseNames(w.exercises);
                  return (
                    <div className="workout-panel" key={activeWorkout}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div>
                          <h3 className="workout-name">{w.name}</h3>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <TypeTag type={w.type} />
                            <span style={{ fontSize: "0.78rem", color: "var(--faint)" }}>⏱ {w.duration}</span>
                          </div>
                        </div>
                      </div>
                      {w.warmup && (
                        <div className="info-box info-box-warm">
                          <span className="info-box-label">Warm-up</span>
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", lineHeight: 1.5 }}>{w.warmup}</p>
                        </div>
                      )}
                      <div className="exercise-list">
                        {w.exercises?.map((ex, i) => {
                          const swapKey = `${w.day}::${i}`;
                          const recommendation = getExerciseRecommendation(checkins, w.day, storageNames[i], ex.reps);
                          const recommendationTone = recommendation && GRADE_TONE_STYLES[RECOMMENDATION_TONE[recommendation.level]];
                          return (
                          <div key={i} className={`exercise-card${selectedExercise === ex.name ? " is-selected" : ""}`}>
                            <div className="exercise-row">
                              <div className="exercise-index">{i + 1}</div>
                              <div className="exercise-body">
                                <div className="exercise-name">
                                  {ex.name}
                                  <span onClick={() => openYoutube(ex.name)} className="exercise-action-btn">▶ how to</span>
                                  {planId && (
                                    remainingSwaps > 0 ? (
                                      <span onClick={() => openSwap(w.day, i)} className="exercise-action-btn">Can't do this?</span>
                                    ) : (
                                      <span className="exercise-action-btn" style={{ color: "var(--faint)", background: "var(--paper)", borderColor: "var(--line)", cursor: "default" }} title="Swap limit reached for this week — resets next week">Swap limit reached</span>
                                    )
                                  )}
                                </div>
                                {ex.note && <div className="exercise-note">{renderWithGlossary(ex.note)}</div>}
                              </div>
                              <div className="exercise-stats">
                                <div className="exercise-sets">{ex.sets}×{ex.reps}</div>
                                <div className="exercise-rest">{ex.rest} rest</div>
                                {ex.effort && <div className="exercise-effort">{firstEffortIndices.has(i) ? renderWithGlossary(ex.effort) : ex.effort}</div>}
                              </div>
                            </div>
                            {recommendation && (
                              <div className="exercise-reco" style={{ background: recommendationTone.bg, color: recommendationTone.text }}>
                                {RECOMMENDATION_LABEL[recommendation.level](recommendation)}
                              </div>
                            )}
                            {swapOpenKey === swapKey && (
                              <div style={{ padding: "0 0.9rem 0.75rem" }}>
                                <p style={{ fontSize: "0.72rem", color: "var(--faint)", margin: "0 0 0.35rem" }}>{remainingSwaps} swap{remainingSwaps === 1 ? "" : "s"} left this week</p>
                                <input
                                  type="text"
                                  value={swapReason}
                                  onChange={e => setSwapReason(e.target.value)}
                                  placeholder="Why? (no equipment, pain, dislike, or something else)"
                                  className="reason-input"
                                />
                                {swapError && <p style={{ fontSize: "0.72rem", color: "var(--danger)", margin: "0.35rem 0 0" }}>{swapError}</p>}
                                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
                                  <button onClick={() => setSwapOpenKey(null)} className="btn btn-ghost" style={{ padding: "0.3rem 0.7rem", fontSize: "0.75rem" }}>Cancel</button>
                                  <button onClick={() => submitSwap(w, i)} disabled={swapping} className="btn btn-solid" style={{ padding: "0.3rem 0.7rem", fontSize: "0.75rem" }}>
                                    {swapping ? "Swapping..." : "Get a replacement"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                      {w.cooldown && (
                        <div className="info-box info-box-cool">
                          <span className="info-box-label">Cool-down</span>
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", lineHeight: 1.5 }}>{w.cooldown}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
              {plan.nutrition_tips && (
                <div className="expand-block">
                  <h3 className="section-title">Nutrition Tips</h3>
                  <div className={`expand-body${expandedSections.nutrition ? " is-expanded" : ""}`}>
                    <ul style={{ padding: "0 0 0 1rem" }}>
                      {plan.nutrition_tips.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                  <span onClick={() => toggleSection("nutrition")} className="expand-toggle">
                    {expandedSections.nutrition ? "Show less" : "Show more"}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {plan.motivation_strategy && (
                  <div className="expand-block tint-mint">
                    <h3 className="section-title" style={{ color: "var(--accent-deep)" }}>Motivation Strategy</h3>
                    <div className={`expand-body${expandedSections.motivation ? " is-expanded" : ""}`} style={{ color: "var(--accent-deep)" }}>
                      <p>{plan.motivation_strategy}</p>
                    </div>
                    <span onClick={() => toggleSection("motivation")} className="expand-toggle">
                      {expandedSections.motivation ? "Show less" : "Show more"}
                    </span>
                  </div>
                )}
                {plan.weekly_checkin && (
                  <div className="expand-block tint-sky">
                    <h3 className="section-title" style={{ color: "var(--cool-text)" }}>Weekly Check-in</h3>
                    <div className={`expand-body${expandedSections.checkin ? " is-expanded" : ""}`} style={{ color: "var(--cool-text)" }}>
                      <p>{plan.weekly_checkin}</p>
                    </div>
                    <span onClick={() => toggleSection("checkin")} className="expand-toggle">
                      {expandedSections.checkin ? "Show less" : "Show more"}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <p className="results-footnote">
              Generated by FitPlan AI · Adjust intensity to your level · Consult a doctor before starting a new fitness program
            </p>
            <p className="results-footnote" style={{ marginTop: "0.5rem" }}>
              <span onClick={() => setPage("terms")} style={{ color: "var(--accent-deep)", cursor: "pointer", textDecoration: "underline" }}>Terms of Service</span>
              {" · "}
              <span onClick={() => setPage("privacy")} style={{ color: "var(--accent-deep)", cursor: "pointer", textDecoration: "underline" }}>Privacy Policy</span>
            </p>
          </div>
        )}

        {gradeResult && (() => {
          const gradeScore = computeGradeScore(gradeResult.fixes, gradeResult.strengths);
          const scoreTone = GRADE_TONE_STYLES[getGradeScoreTone(gradeScore)];
          const goodTone = GRADE_TONE_STYLES.accent;
          return (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 className="results-title">Routine Review</h2>
              <p className="results-summary">{renderWithGlossary(gradeResult.summary)}</p>
            </div>
            <div className="grade-score-card" style={{ textAlign: "center" }}>
              <div className="grade-score-label">Routine Score</div>
              <CircularScore score={gradeScore} color={scoreTone.text} />
            </div>
            {gradeResult.strengths?.length > 0 && (
              <div className="section-card" style={{ padding: "1.25rem" }}>
                <h3 className="section-title">What's Working</h3>
                <div className="exercise-list">
                  {gradeResult.strengths.map((s, i) => (
                    <div key={i} className="exercise-card" style={{ borderColor: goodTone.border }}>
                      <div className="exercise-row" style={{ gridTemplateColumns: "1.6rem 1fr" }}>
                        <div className="exercise-index" style={{ background: goodTone.bg, color: goodTone.text }}>✓</div>
                        <div>
                          <div className="exercise-name">{s.exercise || "General"}</div>
                          <div className="exercise-note">{renderWithGlossary(s.strength)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {gradeResult.fixes?.length > 0 && (
              <div className="section-card" style={{ padding: "1.25rem" }}>
                <h3 className="section-title">What to Fix</h3>
                <div className="exercise-list">
                  {gradeResult.fixes.map((f, i) => {
                    const category = classifyGradeFix(f);
                    const tone = GRADE_TONE_STYLES[category.tone];
                    return (
                      <div key={i} className="exercise-card" style={{ borderColor: tone.border }}>
                        <div className="exercise-row" style={{ gridTemplateColumns: "1.6rem 1fr" }}>
                          <div className="exercise-index" style={{ background: tone.bg, color: tone.text }}>{i + 1}</div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                              <div className="exercise-name">{f.exercise || "General"}</div>
                              <span className="type-tag" style={{ background: tone.bg, color: tone.text }}>{category.label}</span>
                            </div>
                            <div className="exercise-note">{renderWithGlossary(f.issue)}</div>
                            <div className="exercise-note" style={{ color: "var(--accent-deep)", fontWeight: 600, marginTop: "0.3rem" }}>→ {renderWithGlossary(f.fix)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <button onClick={() => { setGradeResult(null); setRoutineText(""); }} className="btn btn-ghost" style={{ marginTop: "1rem" }}>
              ← Grade another routine
            </button>
          </div>
          );
        })()}
      </div>

      {showCheckIn && plan && (
        <div className="checkin-overlay">
          <div className="checkin-card">
            <h3 className="checkin-title">Week {currentWeek} check-in{plan.is_deload_week ? " (Deload Week)" : ""}</h3>
            <p className="checkin-sub">Everything's checked as done by default. Uncheck anything you skipped and tell us why, or uncheck a whole day if you missed it entirely. For anything you did, log the weight and reps you averaged across working sets, since it drives next time's progress suggestion.</p>

            {plan.workouts.map((w, wi) => {
              const dayDone = dayCheckInState[w.day] !== false;
              const storageNames = dedupeExerciseNames(w.exercises);
              return (
              <div key={wi} className="checkin-day">
                <label className="checkin-day-toggle">
                  <input type="checkbox" checked={dayDone} onChange={() => toggleDayDone(w.day)} />
                  <span className="checkin-day-title">{w.day} · {w.name}</span>
                </label>
                {dayDone ? w.exercises.map((ex, ei) => {
                  const storageName = storageNames[ei];
                  const key = `${w.day}::${storageName}`;
                  const done = !!checkInState[key];
                  const log = checkInLogs[key] || {};
                  const prefill = prefillLogs[key] || {};
                  const weightIsPrefilled = prefill.avgWeight != null && log.avgWeight === prefill.avgWeight;
                  const repsIsPrefilled = prefill.avgReps != null && log.avgReps === prefill.avgReps;
                  return (
                    <div key={ei} className="checkin-exercise">
                      <label className="checkin-exercise-label">
                        <input type="checkbox" checked={done} onChange={() => toggleExerciseDone(w.day, storageName)} />
                        {ex.name}
                      </label>
                      {done ? (
                        <div className="checkin-log-row">
                          <Field label="Weight (kg)" name="avgWeight" type="number" value={log.avgWeight ?? ""} onChange={e => updateCheckInLog(w.day, storageName, "avgWeight", e.target.value)} placeholder="optional" muted={weightIsPrefilled} />
                          <Field label="Reps" name="avgReps" type="number" value={log.avgReps ?? ""} onChange={e => updateCheckInLog(w.day, storageName, "avgReps", e.target.value)} placeholder="optional" muted={repsIsPrefilled} />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={skipReasons[key] || ""}
                          onChange={e => updateSkipReason(w.day, storageName, e.target.value)}
                          placeholder="Why? (pain, too hard, ran out of time, boring...)"
                          className="reason-input"
                        />
                      )}
                    </div>
                  );
                }) : (
                  <input
                    type="text"
                    value={dayReasons[w.day] || ""}
                    onChange={e => updateDayReason(w.day, e.target.value)}
                    placeholder="Why did you miss this day? (sick, travel, ran out of time...)"
                    className="reason-input"
                  />
                )}
              </div>
              );
            })}

            <Field label="Anything else overall? (optional)" name="checkInNotes" value={checkInNotes} onChange={e => setCheckInNotes(e.target.value)} as="textarea" hint="General comments about the week. Specific skip reasons are captured above, next to each exercise." />

            {error && <p className="form-error">{error}</p>}
            {adjusting && (
              <div style={{ textAlign: "center", padding: "1.25rem 0 0.25rem" }}>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${Math.round(loadingProgress)}%` }} />
                </div>
                <p className="progress-bar-percent">{Math.round(loadingProgress)}%</p>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem" }}>
              <button onClick={() => setShowCheckIn(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={submitCheckIn} disabled={adjusting} className="btn btn-solid" style={{ flex: 2 }}>
                {adjusting ? "Adjusting your plan..." : "Submit & adjust next week"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}