export function SiteBanner() {
  const text = process.env.SITE_BANNER_TEXT;
  if (!text) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-500 text-black text-sm text-center py-2 px-4 font-medium"
    >
      {text}
    </div>
  );
}
