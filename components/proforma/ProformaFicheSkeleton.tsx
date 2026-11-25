import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Écran d'attente de la fiche proforma : même disposition que la fiche (barre du haut, contenu à
 * gauche, encadrés à droite) avec un message « Ouverture de la proforma… ». Affiché dès le clic
 * (`facture/[id]/loading.tsx`) puis pendant le chargement des données de la fiche.
 */
export function ProformaFicheSkeleton() {
  return (
    <div className="container mx-auto py-8 space-y-8 max-w-7xl" aria-busy="true" aria-live="polite">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4 min-w-0">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ouverture de la proforma…
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b p-6">
              <Skeleton className="h-5 w-44" />
            </div>
            <div className="p-6 space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="space-y-3 pt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-white shadow-sm p-6 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white shadow-sm p-6 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
