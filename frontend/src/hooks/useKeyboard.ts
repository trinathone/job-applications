/**
 * Global keyboard shortcut handler.
 * A/S/N — only active when no input or modal is focused.
 */
import { useEffect } from "react";
import { useJobStore } from "../store/jobStore";
import { useUIStore } from "../store/uiStore";

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function useKeyboard(onApply: () => void, onSkip: () => void) {
  const nextJob = useJobStore((s) => s.nextJob);
  const shortcutsDisabled = useUIStore((s) => s.shortcutsDisabled);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (INPUT_TAGS.has(target.tagName) || target.isContentEditable) return;
      if (shortcutsDisabled) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "a": e.preventDefault(); onApply(); break;
        case "s": e.preventDefault(); onSkip(); break;
        case "n": e.preventDefault(); nextJob(); break;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onApply, onSkip, nextJob, shortcutsDisabled]);
}
