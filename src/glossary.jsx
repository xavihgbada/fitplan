import { useState, useRef, useEffect } from "react";

// Add new terms here — { pattern: RegExp (global, case-insensitive), definition: one sentence }.
const GLOSSARY_TERMS = [
  { id: "rir", pattern: /\bRIR\b/gi, definition: "Reps in reserve: how many more reps you could still do before hitting failure." },
  { id: "progressive-overload", pattern: /\bprogressive overload\b/gi, definition: "Gradually increasing weight, reps, or sets over time so your muscles keep adapting." },
  { id: "failure", pattern: /\btrain(?:ing)? to failure\b/gi, definition: "Doing reps until you physically can't complete another one with good form." },
  { id: "mechanical-drop-set", pattern: /\bmechanical drop sets?\b/gi, definition: "Switching to an easier variation of the same exercise right after failure, instead of just lowering the weight." },
  { id: "drop-set", pattern: /\bdrop sets?\b/gi, definition: "Cutting the weight and continuing reps immediately after reaching failure, with no rest." },
  { id: "rest-pause-set", pattern: /\brest-pause sets?\b/gi, definition: "Pausing briefly after near-failure, then squeezing out a few more reps with the same weight." },
  { id: "myo-reps", pattern: /\bmyo-?reps\b/gi, definition: "One hard set followed by short rest-pause mini-sets to extend muscle work with less total volume." },
  { id: "superset", pattern: /\bsupersets?\b/gi, definition: "Two exercises performed back-to-back with no rest in between." },
  { id: "deload", pattern: /\bdeloads?\b/gi, definition: "A planned lighter week (less weight or volume) that lets your body recover before pushing hard again." },
  { id: "intensification", pattern: /\bintensification\b/gi, definition: "Techniques like drop sets or rest-pause that make a set harder without adding more sets." },
  { id: "connective-tissue-tolerance", pattern: /\bconnective tissue tolerance\b/gi, definition: "How much stress your tendons and ligaments can handle before they need extra recovery time." },
  { id: "form-focus", pattern: /\bform focus\b/gi, definition: "Prioritize clean technique over intensity. These sets aren't meant to feel hard yet." },
  { id: "light-effort", pattern: /\blight effort\b/gi, definition: "Keep these sets comfortably easy. Building the movement pattern matters more than intensity here." },
];
const GLOSSARY_REGEX = new RegExp(GLOSSARY_TERMS.map(t => t.pattern.source).join("|"), "gi");
const findGlossaryTerm = (matchText) =>
  GLOSSARY_TERMS.find(t => new RegExp(`^(?:${t.pattern.source})$`, "i").test(matchText));

const GlossaryTerm = ({ term, definition }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); };
  }, [open]);
  return (
    <span className={`glossary-term${open ? " is-open" : ""}`} ref={ref}>
      <span
        className="glossary-term-label"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
      >
        {term}
      </span>
      <span className="glossary-tooltip" role="tooltip">{definition}</span>
    </span>
  );
};

// Wraps recognized glossary terms in a string with GlossaryTerm spans; returns plain text untouched otherwise.
const renderWithGlossary = (text) => {
  if (!text) return text;
  const parts = [];
  let lastIndex = 0;
  const regex = new RegExp(GLOSSARY_REGEX);
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const entry = findGlossaryTerm(match[0]);
    parts.push(<GlossaryTerm key={match.index} term={match[0]} definition={entry.definition} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};

// Groups effort labels into a "kind" so e.g. "2 RIR" and "3-4 RIR" count as the same term for
// first-occurrence tracking, independent of exercise position.
const getEffortKind = (effort) => {
  if (!effort) return null;
  if (/RIR/i.test(effort)) return "rir";
  if (/train(?:ing)? to failure/i.test(effort)) return "failure";
  return effort.trim().toLowerCase();
};

// Given a day's exercise list, returns the set of indices whose effort label is the first
// occurrence of its kind that day — those get the tooltip, repeats render as plain text.
const getFirstEffortIndices = (exercises) => {
  const seenKinds = new Set();
  const indices = new Set();
  exercises?.forEach((ex, i) => {
    const kind = getEffortKind(ex.effort);
    if (kind && !seenKinds.has(kind)) {
      seenKinds.add(kind);
      indices.add(i);
    }
  });
  return indices;
};

export { GLOSSARY_TERMS, GLOSSARY_REGEX, findGlossaryTerm, GlossaryTerm, renderWithGlossary, getEffortKind, getFirstEffortIndices };
