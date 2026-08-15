import { useState, useRef, useEffect } from "react";
import { TAG_COLORS, HOME_EQUIPMENT_OPTIONS } from "../constants";

const TypeTag = ({ type }) => {
  const style = TAG_COLORS[type] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <span className="type-tag" style={{ background: style.bg, color: style.color }}>
      {type}
    </span>
  );
};

const inputStyle = { width: "100%", padding: "0.6rem 0.8rem", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "0.9rem", color: "#111827", background: "#FAFAFA", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" };

const Field = ({ label, name, value, onChange, placeholder, as = "input", type = "text", options, hint, error, suggestions }) => {
  const isDropdown = as === "select" || !!suggestions;
  const [open, setOpen] = useState(false);
  const comboRef = useRef(null);

  useEffect(() => {
    if (!isDropdown) return;
    const handleClick = (e) => {
      if (comboRef.current && !comboRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isDropdown]);

  const pick = (val) => {
    onChange({ target: { name, value: val } });
    setOpen(false);
  };

  const selectedLabel = as === "select" ? options.find(o => o.value === value)?.label : null;

  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {hint && <p className="field-hint">{hint}</p>}
      {as === "select" ? (
        <div className="combo-wrap" ref={comboRef}>
          <button type="button" className={`field-input combo-trigger${error ? " has-error" : ""}`} onClick={() => setOpen(o => !o)}>
            <span>{selectedLabel}</span>
            <span className="combo-chevron">▾</span>
          </button>
          {open && (
            <div className="combo-menu">
              {options.map(o => (
                <div key={o.value} className={`combo-option${o.value === value ? " is-selected" : ""}`} onMouseDown={() => pick(o.value)}>{o.label}</div>
              ))}
            </div>
          )}
        </div>
      ) : as === "textarea" ? (
        <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={2} className={`field-input${error ? " has-error" : ""}`} style={{ resize: "vertical", fontFamily: "inherit" }} onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = error ? "var(--danger)" : "var(--line)"} />
      ) : suggestions ? (
        <div className="combo-wrap" ref={comboRef}>
          <input name={name} value={value} onChange={onChange} placeholder={placeholder} autoComplete="off" className={`field-input${error ? " has-error" : ""}`} onFocus={e => { e.target.style.borderColor = "var(--accent)"; setOpen(true); }} onBlur={e => e.target.style.borderColor = error ? "var(--danger)" : "var(--line)"} />
          {open && (
            <div className="combo-menu">
              {suggestions.map(opt => (
                <div key={opt} className="combo-option" onMouseDown={() => pick(opt)}>{opt}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} className={`field-input${error ? " has-error" : ""}`} onFocus={e => e.target.style.borderColor = "var(--accent)"} onBlur={e => e.target.style.borderColor = error ? "var(--danger)" : "var(--line)"} />
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
};

const Divider = ({ label }) => (
  <div className="form-divider">
    <div className="form-divider-line" />
    <span className="form-divider-label">{label}</span>
    <div className="form-divider-line" />
  </div>
);

const EquipmentSelector = ({ location, onLocationChange, selected, onEquipmentChange, error }) => {
  const toggle = (id) => {
    onEquipmentChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };
  return (
    <div className="field">
      <label className="equip-label">Where do you train?</label>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
        {[
          { id: "full_gym", label: "🏋️ Commercial gym" },
          { id: "home_gym", label: "🏠 Home gym" },
          { id: "bodyweight", label: "🤸 Bodyweight only" },
        ].map(opt => (
          <button key={opt.id} onClick={() => onLocationChange(opt.id)} type="button" className={`equip-btn${location === opt.id ? " is-selected" : ""}${error ? " has-error" : ""}`}>{opt.label}</button>
        ))}
      </div>
      {error && <p className="equip-error">{error}</p>}
      {location === "home_gym" && (
        <>
          <p className="equip-hint">Select what you have at home. Your plan will only use these.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {HOME_EQUIPMENT_OPTIONS.map(eq => {
              const isSelected = selected.includes(eq.id);
              return (
                <button key={eq.id} onClick={() => toggle(eq.id)} type="button" className={`equip-chip${isSelected ? " is-selected" : ""}`}>
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

export { TypeTag, inputStyle, Field, Divider, EquipmentSelector };
