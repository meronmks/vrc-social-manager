import { useEffect, useRef, useState } from "react";

// 外側のクリックや Esc キーで閉じるポップオーバーの開閉状態。
// 同じ container の中で複数のメニューを切り替えるときは、名前（T）で開いているものを区別する。
export function usePopover<T extends string>() {
  const [open, setOpen] = useState<T>();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!container.current?.contains(e.target as Node)) setOpen(undefined);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(undefined);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const toggle = (name: T) => setOpen(open === name ? undefined : name);
  return { open, toggle, show: (name: T) => setOpen(name), close: () => setOpen(undefined), container };
}
