import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/** Petit indicateur de chargement (à côté d'un interrupteur, d'une liste, d'un libellé…). */
export function Indicateur({ className, label = "Chargement…" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
