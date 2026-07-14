import { useState } from "react";

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

const SYSTEM_PROMPT = `You are an expert fitness coach creating personalized workout plans. Return ONLY a valid JSON object, no markdown, no explanation, no preamble. The JSON must exactly match this structure:

{
  "title": "Plan title",
  "summary": "2-3 sentence overview of the approach and why it fits this person",
  "schedule": ["Monday", "Tuesday", "Thursday", "Saturday"],
  "weeks": "8",
  "weeks_breakdown": [
    { "phase": "Phase 1 (Weeks 1-2)", "focus": "Brief focus description" },
    { "phase": "Phase 2 (Weeks 3-5)", "focus": "Brief focus description" },
    { "phase": "Phase 3 (Weeks 6-8)", "focus": "Brief focus description" }
  ],
  "workouts": [
    {
      "day": "Monday",
      "name": "Workout name",
      "duration": "45 min",
      "type": "Strength",
      "warmup": "5 min dynamic stretching — arm circles, leg swings, torso rotations",
      "exercises": [
        { "name": "Exercise name", "sets": "3", "reps": "10-12", "rest": "60s", "note": "Optional form tip" }
      ],
      "cooldown": "5 min static stretching, focus on worked muscles"
    }
  ],
  "nutrition_tips": ["Tip 1", "Tip 2", "Tip 3"],
  "motivation_strategy": "1-2 sentences specifically addressing their past failures and main challenge",
  "weekly_checkin": "What to track or assess each week to measure progress"
}

Be specific. Every exercise must have sets, reps, and rest. Include 4-6 exercises per workout. Never include exercises the person dislikes. Directly address their past failures in the motivation strategy. Adapt everything to their injuries and limitations.

EQUIPMENT RULE — CRITICAL: Only assign exercises that can be performed with the exact equipment listed. If an exercise requires a piece of equipment not on the list, do not include it. For example: if no bench is listed, do not assign bench press or incline dumbbell press. If no leg press machine is listed, do not assign leg press. If only a step platform is listed, use it for step-ups, not as a bench substitute.

VOLUME GUIDELINES — calibrate total weekly sets per muscle group to fitness level:
- Beginner: 10-15 sets per muscle group per week
- Intermediate: 12-18 sets per muscle group per week
- Advanced: 16-22 sets per muscle group per week
If the user requests emphasis on a specific muscle group, add 2-4 sets above their baseline spread across the week — never spike volume disproportionately in a single session. Only exceed these ranges if the user explicitly requests a specialization or high-volume program.

MUSCLE GROUP ACCURACY — never mislabel muscle targets:
- Medial (lateral) delt exercises: lateral raises, cable lateral raises, machine lateral raises
- Rear delt exercises: face pulls, reverse flies, bent-over lateral raises, barbell upright rows
- Barbell upright rows target the rear delts and upper traps — never label them as a medial delt exercise
- Front delt exercises: overhead press, front raises, incline dumbbell press
- Always verify that the exercise listed actually trains the muscle group stated`;

const buildPrompt = (data) => `Create a personalized 8-week fitness plan for:

Goal: ${data.goal}
Specific target: ${data.target || "Not specified"}
Days per week: ${data.days}
Preferred training days: ${data.specificDays || "Flexible — assign optimal days"}
Minutes per session: ${data.time}
Preferred training time: ${data.trainTime}
Fitness level: ${data.level}
Other physical activity / sports / extracurriculars: ${data.otherActivity || "None"}
Main challenge / biggest excuse: ${data.excuse}
Previous attempts & what went wrong: ${data.pastAttempts || "None specified"}
Exercises they enjoy: ${data.enjoy || "None specified"}
Exercises they dislike or want to avoid: ${data.dislike || "None specified"}
Injuries or physical limitations: ${data.injuries || "None"}
Available equipment (ONLY use these): ${
  data.equipmentLocation === "full_gym" ? "Full commercial gym — all standard equipment available" :
  data.equipmentLocation === "bodyweight" ? "Bodyweight only — no equipment" :
  data.equipment.length > 0 ? data.equipment.join(", ") : "Bodyweight only"
}

CRITICAL: Do not assign any exercise that requires equipment not listed above. Return only the JSON object.`;

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

const TypeTag = ({ type }) => {
  const style = TAG_COLORS[type] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.2rem 0.55rem", borderRadius: "20px", background: style.bg, color: style.color, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {type}
    </span>
  );
};

const inputStyle = { width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "0.9rem", color: "#111827", background: "#FAFAFA", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" };

const Field = ({ label, name, value, onChange, placeholder, as = "input", options, hint }) => (
  <div style={{ marginBottom: "1.1rem" }}>
    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: "0.25rem" }}>{label}</label>
    {hint && <p style={{ fontSize: "0.78rem", color: "#9CA3AF", margin: "0 0 0.35rem", lineHeight: 1.4 }}>{hint}</p>}
    {as === "select" ? (
      <select name={name} value={value} onChange={onChange} style={inputStyle} onFocus={e => e.target.style.borderColor = "#16A34A"} onBlur={e => e.target.style.borderColor = "#E5E7EB"}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ) : as === "textarea" ? (
      <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} onFocus={e => e.target.style.borderColor = "#16A34A"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
    ) : (
      <input name={name} value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} onFocus={e => e.target.style.borderColor = "#16A34A"} onBlur={e => e.target.style.borderColor = "#E5E7EB"} />
    )}
  </div>
);

const Divider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.4rem 0 1.1rem" }}>
    <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
  </div>
);

const EquipmentSelector = ({ location, onLocationChange, selected, onEquipmentChange }) => {
  const toggle = (id) => {
    onEquipmentChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: "0.25rem" }}>Where do you train?</label>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
        {[
          { id: "full_gym", label: "🏋️ Commercial gym" },
          { id: "home_gym", label: "🏠 Home gym" },
          { id: "bodyweight", label: "🤸 Bodyweight only" },
        ].map(opt => (
          <button key={opt.id} onClick={() => onLocationChange(opt.id)} type="button" style={{
            padding: "0.5rem 1rem", borderRadius: "9px", border: `1.5px solid ${location === opt.id ? "#16A34A" : "#E5E7EB"}`,
            background: location === opt.id ? "#F0FDF4" : "#FAFAFA", color: location === opt.id ? "#15803D" : "#6B7280",
            fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", transition: "all 0.12s"
          }}>{opt.label}</button>
        ))}
      </div>
      {location === "home_gym" && (
        <>
          <p style={{ fontSize: "0.78rem", color: "#9CA3AF", margin: "0 0 0.6rem", lineHeight: 1.4 }}>Select what you have at home — your plan will only use these.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {HOME_EQUIPMENT_OPTIONS.map(eq => {
              const isSelected = selected.includes(eq.id);
              return (
                <button key={eq.id} onClick={() => toggle(eq.id)} type="button" style={{
                  padding: "0.4rem 0.75rem", borderRadius: "20px", border: `1.5px solid ${isSelected ? "#16A34A" : "#E5E7EB"}`,
                  background: isSelected ? "#F0FDF4" : "#FAFAFA", color: isSelected ? "#15803D" : "#6B7280",
                  fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", transition: "all 0.12s"
                }}>
                  {isSelected ? "✓ " : ""}{eq.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default function FitnessPlanGenerator() {
  const [form, setForm] = useState({
    goal: "", target: "", days: "4", specificDays: "", time: "45", trainTime: "morning",
    level: "beginner", excuse: "", pastAttempts: "",
    enjoy: "", dislike: "", injuries: "", equipment: [], equipmentLocation: "",
    otherActivity: ""
  });
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeWorkout, setActiveWorkout] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [gifData, setGifData] = useState({});
  const [gifLoading, setGifLoading] = useState(null);

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleEquipment = (equipment) => setForm(p => ({ ...p, equipment }));
  const handleEquipmentLocation = (loc) => setForm(p => ({ ...p, equipmentLocation: loc, equipment: [] }));

  const fetchGif = async (exerciseName) => {
    if (selectedExercise === exerciseName) { setSelectedExercise(null); return; }
    setSelectedExercise(exerciseName);
    if (gifData[exerciseName]) return;
    setGifLoading(exerciseName);
    try {
      const res = await fetch(`/api/exercise-gif?name=${encodeURIComponent(exerciseName)}`);
      const data = await res.json();
      setGifData(prev => ({ ...prev, [exerciseName]: data.gifUrl || null }));
    } catch (e) {
      setGifData(prev => ({ ...prev, [exerciseName]: null }));
    } finally {
      setGifLoading(null);
    }
  };

  const generate = async () => {
    if (!form.goal.trim() || !form.excuse.trim()) { setError("Please fill in your goal and main challenge."); return; }
    if (!form.equipmentLocation) { setError("Please select where you train."); return; }
    setError(""); setLoading(true); setPlan(null);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 8000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: buildPrompt(form) }] }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setPlan(parsed);
      setActiveWorkout(0);
    } catch (e) {
      setError("Something went wrong generating the plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "'Inter', system-ui, sans-serif", color: "#111827" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0.9rem 1.5rem", display: "flex", alignItems: "center", gap: "0.7rem", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "9px", background: "linear-gradient(135deg, #16A34A, #15803D)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>💪</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.02em" }}>FitPlan AI</div>
          <div style={{ fontSize: "0.68rem", color: "#9CA3AF", fontWeight: 500 }}>Powered by Claude</div>
        </div>
        {plan && (
          <button onClick={() => setPlan(null)} style={{ marginLeft: "auto", padding: "0.4rem 0.9rem", border: "1.5px solid #E5E7EB", borderRadius: "7px", background: "transparent", fontSize: "0.82rem", color: "#6B7280", cursor: "pointer", fontWeight: 600 }}>
            ← New Plan
          </button>
        )}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.75rem 1.25rem 3rem" }}>
        {!plan && !loading && (
          <>
            <div style={{ marginBottom: "1.75rem" }}>
              <h1 style={{ fontSize: "1.65rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.4rem" }}>Your plan. Your life.</h1>
              <p style={{ color: "#6B7280", fontSize: "0.92rem", margin: 0, lineHeight: 1.65 }}>The more specific you are, the more personal your plan will be.</p>
            </div>
            <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #E5E7EB", padding: "1.6rem" }}>
              <Divider label="Your Goal" />
              <Field label="What's your main fitness goal?" name="goal" value={form.goal} onChange={handleChange} placeholder="e.g. Build muscle while losing body fat" />
              <Field label="Specific target" name="target" value={form.target} onChange={handleChange} placeholder="e.g. Lose 5kg, gain visible arm muscle, run 5km" hint="The more concrete the better — give us a number if you can." />

              <Divider label="Your Schedule" />
              <Field label="Other physical activity or sports" name="otherActivity" value={form.otherActivity} onChange={handleChange} placeholder="e.g. Football on Tuesdays and Thursdays, badminton twice a week" hint="Include anything physical — this prevents the plan from clashing with your existing activity." />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.85rem" }}>
                <Field label="Gym days per week" name="days" value={form.days} onChange={handleChange} as="select" options={[2,3,4,5,6].map(n => ({ value: String(n), label: `${n} days` }))} />
                <Field label="Minutes per session" name="time" value={form.time} onChange={handleChange} as="select" options={[30,45,60,75,90].map(n => ({ value: String(n), label: `${n} min` }))} />
                <Field label="Preferred time" name="trainTime" value={form.trainTime} onChange={handleChange} as="select" options={[{ value: "morning", label: "Morning" }, { value: "afternoon", label: "Afternoon" }, { value: "evening", label: "Evening" }, { value: "flexible", label: "Flexible" }]} />
              </div>
              <Field label="Specific days? (optional)" name="specificDays" value={form.specificDays} onChange={handleChange} placeholder="e.g. Monday, Wednesday, Friday — leave blank to let the plan decide" hint="Only fill this in if you have fixed days." />
              <Field label="Fitness level" name="level" value={form.level} onChange={handleChange} as="select" options={[{ value: "beginner", label: "Beginner — just starting out" }, { value: "intermediate", label: "Intermediate — some experience" }, { value: "advanced", label: "Advanced — trained consistently" }]} />

              <Divider label="Your Challenges" />
              <Field label="What's your biggest excuse or challenge?" name="excuse" value={form.excuse} onChange={handleChange} placeholder="e.g. I get home tired at 6pm and plain lifting bores me" as="textarea" />
              <Field label="Have you tried a fitness plan before? What went wrong?" name="pastAttempts" value={form.pastAttempts} onChange={handleChange} placeholder="e.g. I quit after 2 weeks because it felt too repetitive" as="textarea" hint="This helps build a plan that avoids your past pitfalls." />

              <Divider label="Your Preferences" />
              <Field label="Exercises or activities you enjoy" name="enjoy" value={form.enjoy} onChange={handleChange} placeholder="e.g. Group classes, cycling, bodyweight movements" />
              <Field label="Exercises you dislike or want to avoid" name="dislike" value={form.dislike} onChange={handleChange} placeholder="e.g. Running, heavy barbell squats" />
              <Field label="Injuries or physical limitations" name="injuries" value={form.injuries} onChange={handleChange} placeholder="e.g. Left knee pain, lower back issues — or 'none'" />

              <Divider label="Your Equipment" />
              <EquipmentSelector location={form.equipmentLocation} onLocationChange={handleEquipmentLocation} selected={form.equipment} onEquipmentChange={handleEquipment} />

              {error && <p style={{ color: "#DC2626", fontSize: "0.85rem", margin: "0 0 1rem" }}>{error}</p>}
              <button onClick={generate} style={{ width: "100%", padding: "0.8rem", background: "#16A34A", color: "#fff", border: "none", borderRadius: "9px", fontSize: "0.92rem", fontWeight: 700, cursor: "pointer", letterSpacing: "-0.01em", marginTop: "0.5rem" }}
                onMouseEnter={e => e.target.style.background = "#15803D"} onMouseLeave={e => e.target.style.background = "#16A34A"}>
                Generate My 8-Week Plan →
              </button>
            </div>
          </>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <div style={{ width: 44, height: 44, border: "3px solid #E5E7EB", borderTopColor: "#16A34A", borderRadius: "50%", animation: "spin 0.75s linear infinite", margin: "0 auto 1rem" }} />
            <p style={{ color: "#6B7280", fontSize: "0.9rem" }}>Building your personalized plan...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {plan && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 0.4rem" }}>{plan.title}</h2>
              <p style={{ color: "#6B7280", fontSize: "0.9rem", lineHeight: 1.65, margin: "0 0 1rem" }}>{plan.summary}</p>
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <span style={{ ...pillStyle, background: "#F0FDF4", color: "#15803D" }}>📅 {plan.schedule?.join(", ")}</span>
                <span style={{ ...pillStyle, background: "#EFF6FF", color: "#1D4ED8" }}>⏱ {plan.weeks} weeks</span>
              </div>
            </div>

            {plan.weeks_breakdown && (
              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", padding: "1.25rem", marginBottom: "1.25rem" }}>
                <h3 style={sectionTitle}>Program Phases</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {plan.weeks_breakdown.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#F0FDF4", color: "#16A34A", fontSize: "0.72rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#111827" }}>{p.phase}</div>
                        <div style={{ fontSize: "0.82rem", color: "#6B7280", lineHeight: 1.5 }}>{p.focus}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {plan.workouts && (
              <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", marginBottom: "1.25rem", overflow: "hidden" }}>
                <div style={{ borderBottom: "1px solid #E5E7EB", padding: "1rem 1.25rem 0", display: "flex", gap: "0.25rem", overflowX: "auto" }}>
                  {plan.workouts.map((w, i) => (
                    <button key={i} onClick={() => setActiveWorkout(i)} style={{
                      padding: "0.45rem 0.85rem", borderRadius: "7px 7px 0 0", border: "none", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.12s",
                      background: activeWorkout === i ? "#16A34A" : "transparent",
                      color: activeWorkout === i ? "#fff" : "#6B7280",
                    }}>{w.day}</button>
                  ))}
                </div>
                {plan.workouts[activeWorkout] && (() => {
                  const w = plan.workouts[activeWorkout];
                  return (
                    <div style={{ padding: "1.25rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                        <div>
                          <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>{w.name}</h3>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <TypeTag type={w.type} />
                            <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>⏱ {w.duration}</span>
                          </div>
                        </div>
                      </div>
                      {w.warmup && (
                        <div style={{ ...infoBox, background: "#FFFBEB", borderColor: "#FDE68A" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#92400E", letterSpacing: "0.06em", textTransform: "uppercase" }}>Warm-up</span>
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "#78350F", lineHeight: 1.5 }}>{w.warmup}</p>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", margin: "0.75rem 0" }}>
                        {w.exercises?.map((ex, i) => (
                          <div key={i} style={{ background: "#F9FAFB", borderRadius: "9px", border: `1px solid ${selectedExercise === ex.name ? "#16A34A" : "#F3F4F6"}`, overflow: "hidden", transition: "border-color 0.15s" }}>
                            <div onClick={() => fetchGif(ex.name)} style={{ display: "grid", gridTemplateColumns: "1.5rem 1fr auto", gap: "0.6rem", alignItems: "start", padding: "0.7rem 0.85rem", cursor: "pointer" }}>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#E5E7EB", color: "#374151", fontSize: "0.68rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
                              <div>
                                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                  {ex.name}
                                  <span style={{ fontSize: "0.68rem", color: "#16A34A", fontWeight: 600 }}>{selectedExercise === ex.name ? "▲ hide" : "▼ how to"}</span>
                                </div>
                                {ex.note && <div style={{ fontSize: "0.77rem", color: "#9CA3AF", marginTop: "0.15rem", lineHeight: 1.4 }}>{ex.note}</div>}
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#16A34A" }}>{ex.sets}×{ex.reps}</div>
                                <div style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>{ex.rest} rest</div>
                              </div>
                            </div>
                            {selectedExercise === ex.name && (
                              <div style={{ padding: "0 0.85rem 0.85rem", borderTop: "1px solid #F3F4F6" }}>
                                {gifLoading === ex.name ? (
                                  <div style={{ textAlign: "center", padding: "1rem", color: "#9CA3AF", fontSize: "0.82rem" }}>Loading animation...</div>
                                ) : gifData[ex.name] ? (
                                  <div style={{ display: "flex", justifyContent: "center", paddingTop: "0.75rem" }}>
                                    <img src={gifData[ex.name]} alt={ex.name} style={{ maxWidth: 280, borderRadius: "8px" }} />
                                  </div>
                                ) : (
                                  <div style={{ textAlign: "center", padding: "1rem", color: "#9CA3AF", fontSize: "0.82rem" }}>No animation found for this exercise.</div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {w.cooldown && (
                        <div style={{ ...infoBox, background: "#F0FDF4", borderColor: "#BBF7D0" }}>
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#166534", letterSpacing: "0.06em", textTransform: "uppercase" }}>Cool-down</span>
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.85rem", color: "#15803D", lineHeight: 1.5 }}>{w.cooldown}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
              {plan.nutrition_tips && (
                <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", padding: "1.1rem" }}>
                  <h3 style={sectionTitle}>Nutrition Tips</h3>
                  <ul style={{ margin: 0, padding: "0 0 0 1rem" }}>
                    {plan.nutrition_tips.map((t, i) => <li key={i} style={{ fontSize: "0.83rem", color: "#374151", lineHeight: 1.6, marginBottom: "0.3rem" }}>{t}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {plan.motivation_strategy && (
                  <div style={{ background: "#F0FDF4", borderRadius: "12px", border: "1px solid #BBF7D0", padding: "1.1rem" }}>
                    <h3 style={{ ...sectionTitle, color: "#166534" }}>Motivation Strategy</h3>
                    <p style={{ margin: 0, fontSize: "0.83rem", color: "#15803D", lineHeight: 1.6 }}>{plan.motivation_strategy}</p>
                  </div>
                )}
                {plan.weekly_checkin && (
                  <div style={{ background: "#EFF6FF", borderRadius: "12px", border: "1px solid #BFDBFE", padding: "1.1rem" }}>
                    <h3 style={{ ...sectionTitle, color: "#1E40AF" }}>Weekly Check-in</h3>
                    <p style={{ margin: 0, fontSize: "0.83rem", color: "#1D4ED8", lineHeight: 1.6 }}>{plan.weekly_checkin}</p>
                  </div>
                )}
              </div>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#9CA3AF", textAlign: "center", lineHeight: 1.6 }}>
              Generated by Claude AI · Adjust intensity to your level · Consult a doctor before starting a new fitness program
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const pillStyle = { fontSize: "0.78rem", fontWeight: 600, padding: "0.25rem 0.65rem", borderRadius: "20px" };
const sectionTitle = { fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9CA3AF", margin: "0 0 0.65rem" };
const infoBox = { padding: "0.7rem 0.85rem", borderRadius: "8px", border: "1px solid" };