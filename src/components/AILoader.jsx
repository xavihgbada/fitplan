export const AILoader = ({ size = 180, text = "Generating" }) => {
  const letters = text.split("");

  return (
    <div className="ai-loader-overlay">
      <div className="ai-loader" style={{ width: size, height: size }}>
        {letters.map((letter, index) => (
          <span
            key={index}
            className="ai-loader-letter"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {letter}
          </span>
        ))}
        <div className="ai-loader-ring" />
      </div>
    </div>
  );
};
