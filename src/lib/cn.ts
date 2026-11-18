import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Junta classes e resolve conflitos do Tailwind. Os utilitários tipográficos do doc 08 §2.4
 * (`text-h1`…`text-caption`) são tamanho de fonte, não cor: sem isto o merge apagaria `text-text`.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-h1",
        "text-h2",
        "text-h3",
        "text-h4",
        "text-h5",
        "text-h6",
        "text-body",
        "text-body-strong",
        "text-small",
        "text-caption",
      ],
      shadow: ["shadow-1", "shadow-2", "shadow-3"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
