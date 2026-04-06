export function SkipNavLink({ targetId = "main-content" }) {
  return (
    <a
      href={`#${targetId}`}
      className="absolute left-0 top-0 -translate-y-full px-4 py-3 bg-blue-600 text-white font-medium z-[100] transition-transform focus:translate-y-0"
    >
      Skip to content
    </a>
  );
}
