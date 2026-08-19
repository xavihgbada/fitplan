import { useEffect, useState } from "react";
import { Quote, Star } from "lucide-react";

// No avatar photos: stock images would misattribute a stranger's face to a
// named reviewer, and the CSP's img-src ('self' data:) blocks hotlinked
// images anyway — an initials badge sidesteps both.
const TESTIMONIALS = [
  {
    id: 1,
    name: "Fernando Barbosa",
    content: "Honestly, this app changed how I approach fitness. The personalization is insane, like it actually gets what you're trying to do instead of giving you generic workouts. If you wanna actually change your fitness lifestyle, this is it.",
    rating: 5,
  },
  {
    id: 2,
    name: "Ivan Korolkov",
    content: "A great app that provided me with everything needed to transform my life.",
    rating: 5,
  },
];

const AUTO_ROTATE_MS = 6000;

// Plain CSS crossfade (opacity/transform transition + an is-active class), same
// technique LandingCarousel already uses — not framer-motion's `animate` prop,
// which sat inert here for reasons not worth chasing for a two-state crossfade.
const Testimonials = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = TESTIMONIALS.length;

  useEffect(() => {
    if (paused || n <= 1) return;
    const interval = setInterval(() => setActiveIndex(i => (i + 1) % n), AUTO_ROTATE_MS);
    return () => clearInterval(interval);
  }, [paused, n]);

  return (
    <div
      className="testimonials"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="testimonials-stage">
        {TESTIMONIALS.map((t, i) => {
          const isActive = activeIndex === i;
          return (
            <div
              key={t.id}
              className={`testimonial-card${isActive ? " is-active" : ""}`}
              aria-hidden={!isActive}
            >
              <div className="testimonial-stars">
                {Array.from({ length: t.rating }).map((_, s) => <Star key={s} size={15} />)}
              </div>
              <Quote className="testimonial-quote-mark" size={26} />
              <p className="testimonial-content">"{t.content}"</p>
              <div className="testimonial-divider" />
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.name.charAt(0)}</div>
                <div className="testimonial-name">{t.name}</div>
              </div>
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <div className="testimonials-dots">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`testimonials-dot${activeIndex === i ? " is-active" : ""}`}
              aria-label={`Show testimonial ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export { Testimonials };
