function Spin({ size = Size.Medium }: { size?: Size }) {
  return (
    <div className="grid place-items-center py-2">
      <div
        className={`animate-spin rounded-full h-${size} w-${size} border-b-2 border-indigo-500`}
      ></div>
    </div>
  );
}

export enum Size {
  Tiny = 4,
  Small = 8,
  Medium = 16,
  Large = 24,
}

export default Spin;
