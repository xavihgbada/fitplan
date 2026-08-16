import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

export const CircularScore = ({ score, color, size = 140 }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, latest => Math.round(latest));
  const progress = useMotionValue(0);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = useTransform(progress, v => circumference - (v / 100) * circumference);

  useEffect(() => {
    const countAnim = animate(count, score, { duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] });
    const progressAnim = animate(progress, score, { duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] });
    return () => {
      countAnim.stop();
      progressAnim.stop();
    };
  }, [score, count, progress]);

  return (
    <div className="circular-score" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120" className="circular-score-svg">
        <circle cx="60" cy="60" r={radius} strokeWidth="10" fill="none" className="circular-score-track" />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          strokeWidth="10"
          fill="none"
          stroke={color}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeLinecap="round"
          style={{ strokeDashoffset }}
        />
      </svg>
      <div className="circular-score-center">
        <motion.span className="circular-score-number">{rounded}</motion.span>
        <span className="circular-score-max">/100</span>
      </div>
    </div>
  );
};
