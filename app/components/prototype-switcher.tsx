// PROTOTYPE, throw away. Floating variant switcher for UI prototypes.
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_KEY = "prototype-variant";

// ?variant= wins; otherwise the last variant picked survives normal navigation
// (sidebar links drop the search param).
export function usePrototypeVariant(keys: string[]) {
  const [params] = useSearchParams();
  const fromUrl = params.get("variant");
  const [remembered, setRemembered] = useState<string | null>(null);
  useEffect(() => {
    try {
      if (fromUrl) localStorage.setItem(STORAGE_KEY, fromUrl);
      else setRemembered(localStorage.getItem(STORAGE_KEY));
    } catch {}
  }, [fromUrl]);
  const v = fromUrl ?? remembered ?? keys[0];
  return keys.includes(v) ? v : keys[0];
}

export function PrototypeSwitcher({
  variants,
  current,
  children,
}: {
  variants: { key: string; name: string }[];
  current: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const index = variants.findIndex((v) => v.key === current);

  function go(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length];
    const params = new URLSearchParams(location.search);
    params.set("variant", next.key);
    params.delete("inbox");
    navigate(`${location.pathname}?${params}`, { replace: true, preventScrollReset: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-900 px-2 py-1.5 text-sm text-white shadow-2xl ring-2 ring-fuchsia-500">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/15" title="Previous (←)">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-52 text-center font-medium">
        {current} ({variants[index]?.name})
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/15" title="Next (→)">
        <ChevronRight className="size-4" />
      </button>
      {children}
    </div>
  );
}
