const COLORS = [
  "#0d0d0d",
  "#e63946",
  "#2176ff",
  "#06d6a0",
  "#f4a261",
  "#a855f7",
  "#f9f6f0",
];

export default function Palette({
  color,
  size,
  setColor,
  setSize,
}: {
  color: string;
  size: number;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#f9f6f0]/95 border border-black/10 rounded-full px-4 py-2 shadow-[0_8px_30px_rgba(13,13,13,0.09)] backdrop-blur-xl z-40">
      {COLORS.map((hex) => (
        <div
          key={hex}
          title={hex}
          onClick={() => {
            setColor(hex);
          }}
          className={`w-5 h-5 rounded-full cursor-pointer transition-transform duration-150
            ${color === hex ? "ring-2 ring-black scale-110" : "hover:scale-125"}
          `}
          style={{
            background: hex,
            ...(hex === "#f9f6f0"
              ? { boxShadow: "inset 0 0 0 1px rgba(13,13,13,0.2)" }
              : {}),
          }}
        />
      ))}

      <div className="w-px h-5 bg-black/10" />

      <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-wider text-gray-400">
        <span>Size</span>
        <input
          type="range"
          min={1}
          max={60}
          value={size}
          onChange={(e) => {
            const v = +e.target.value;
            setSize(v);
          }}
          className="w-16 h-1 accent-black"
        />
        <span className="text-gray-500 min-w-[22px] text-center">{size}</span>
      </div>
    </div>
  );
}
