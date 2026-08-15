import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

function ScrollRevealCard({ children }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.9", "start 0.35"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.4, 1]);

  return (
    <motion.div ref={ref} style={{ rotateX, scale, opacity, transformPerspective: "1000px" }}>
      {children}
    </motion.div>
  );
}
const LANDING_FEATURES = [
  {
    title: "Truly personalized",
    body: "Built around your real equipment, injuries, past failed attempts, and schedule, not a one-size-fits-all template.",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></svg>,
  },
  {
    title: "Adjusts every week",
    body: "Weekly check-ins tell it what you actually did, and it adapts next week's plan, something a static chat conversation can't do on its own.",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14.6-4.6M4 13a8 8 0 0 0 14.6 4.6" /><path d="M4 4v4h4M20 20v-4h-4" /></svg>,
  },
  {
    title: "Yours to keep",
    body: "Download a clean PDF of your plan, or come back anytime to view it and check in.",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8.5L14 3Z" /><path d="M13.5 3v5.5H19" /></svg>,
  },
  {
    title: "Real feedback, not praise",
    body: "Paste or describe your current routine and get specific fixes: goal alignment, injury safety, and more, not generic encouragement.",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="12" height="17" rx="1.5" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" /><path d="M9 12.5l2 2 4-4.5" /></svg>,
  },
  {
    title: "Knows when to add weight",
    body: "Log your weight and reps each week and get an automatic progress, maintain, or deload call, not a static plan that never adapts.",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 19V5" /><path d="M3 19h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>,
  },
];
// Auto-advancing, endlessly looping feature carousel: one card centered at a time,
// peeking cards faded on both sides always, including at the real first/last card.
// Native CSS scroll-snap has no concept of wraparound on its own, so the loop is the
// classic clone-buffer trick: one extra clone card sits before the first and after
// the last real one (loopSlides = [last, ...features, first]), so there's always
// something to peek at even at the ends. A timer, clicking a peeking card, and native
// trackpad/touch scroll can all change the centered slide — an IntersectionObserver
// watching the track is the single source of truth for which DOM child is centered,
// and once scrolling settles on one of the two clones, it's silently swapped for the
// real card it's a copy of (no animation, so the wrap is invisible).
const LandingCarousel = ({ features }) => {
  const trackRef = useRef(null);
  const n = features.length;
  const loopSlides = [features[n - 1], ...features, features[0]];
  const activeDomIndexRef = useRef(1);
  const [activeDomIndex, setActiveDomIndex] = useState(1); // 0 and n+1 are the clones; 1..n are real cards
  const [pausedByInteraction, setPausedByInteraction] = useState(false);
  const [prefersReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const settleTimerRef = useRef(null);

  useEffect(() => { activeDomIndexRef.current = activeDomIndex; }, [activeDomIndex]);

  const centerOn = (domIndex, behavior) => {
    const track = trackRef.current;
    const slide = track?.children[domIndex];
    if (!track || !slide) return;
    // getBoundingClientRect rather than offsetLeft: offsetLeft resolves against the
    // nearest positioned ancestor, which is .landing-carousel here, not the track
    // itself, so it isn't reliably "this slide's position within the scroll content."
    const trackRect = track.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    const slideLeftInTrack = slideRect.left - trackRect.left + track.scrollLeft;
    const centered = slideLeftInTrack - (track.clientWidth - slide.clientWidth) / 2;
    track.scrollTo({ left: centered, behavior });
  };

  // Start centered on the real first card (DOM index 1), not the leading clone, so
  // both peeks are already visible on first paint instead of only one.
  useEffect(() => {
    centerOn(1, "auto");
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries.reduce((best, e) => (!best || e.intersectionRatio > best.intersectionRatio ? e : best), null);
        if (mostVisible && mostVisible.intersectionRatio > 0.6) {
          const domIndex = Array.from(track.children).indexOf(mostVisible.target);
          if (domIndex !== -1) setActiveDomIndex(domIndex);
        }
      },
      { root: track, threshold: [0.6] }
    );
    Array.from(track.children).forEach(child => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  // Debounced on the track's native scroll event (not tied to the observer) so the
  // clone->real swap only happens once a scroll gesture actually finishes settling.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const handleScroll = () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        const domIndex = activeDomIndexRef.current;
        if (domIndex === 0) { centerOn(n, "auto"); setActiveDomIndex(n); }
        else if (domIndex === n + 1) { centerOn(1, "auto"); setActiveDomIndex(1); }
      }, 150);
    };
    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", handleScroll);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, [n]);

  // No pause button by design here, so hover/keyboard-focus is the only stop
  // mechanism left (still required per WAI: auto-rotating content must stop on
  // hover/focus) — a real accessibility gap for a non-hover user who hasn't tabbed
  // into the carousel yet, versus the button-based version this replaced. Also
  // skipped entirely under prefers-reduced-motion, not just switched to instant jumps.
  useEffect(() => {
    if (pausedByInteraction || prefersReducedMotion) return;
    const interval = setInterval(() => {
      centerOn(activeDomIndexRef.current + 1, prefersReducedMotion ? "auto" : "smooth");
    }, 3000);
    return () => clearInterval(interval);
  }, [pausedByInteraction, prefersReducedMotion]);

  return (
    <div
      className="landing-carousel"
      onMouseEnter={() => setPausedByInteraction(true)}
      onMouseLeave={() => setPausedByInteraction(false)}
      onFocus={() => setPausedByInteraction(true)}
      onBlur={() => setPausedByInteraction(false)}
    >
      <div className="landing-carousel-track" ref={trackRef}>
        {loopSlides.map((f, i) => {
          const isActive = i === activeDomIndex;
          return (
            <div
              className={`landing-feature landing-carousel-slide${isActive ? " is-active" : ""}`}
              key={`slide-${i}`}
              role={isActive ? undefined : "button"}
              tabIndex={isActive ? undefined : 0}
              aria-label={isActive ? undefined : `Show slide: ${f.title}`}
              onClick={() => !isActive && centerOn(i, prefersReducedMotion ? "auto" : "smooth")}
              onKeyDown={e => { if (!isActive && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); centerOn(i, prefersReducedMotion ? "auto" : "smooth"); } }}
            >
              <div className="landing-feature-mark">{f.icon}</div>
              <div>
                <div className="landing-feature-title">{f.title}</div>
                <div className="landing-feature-body">{f.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { ScrollRevealCard, LANDING_FEATURES, LandingCarousel };
