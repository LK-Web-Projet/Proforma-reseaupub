'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Receipt,
  Landmark,
  TrendingUp,
  Package,
  Wallet,
  Users,
  BarChart3,
  PieChart,
  Megaphone,
  Building2,
  type LucideIcon,
} from 'lucide-react';

interface RapportCardDef {
  title: string;
  description: string;
  icon: LucideIcon;
  color: 'green' | 'blue' | 'orange' | 'slate';
  href?: string; // absent = pas encore disponible
}

const COLOR_CLASSES: Record<RapportCardDef['color'], string> = {
  green: 'bg-green-600 hover:bg-green-700',
  blue: 'bg-blue-600 hover:bg-blue-700',
  orange: 'bg-amber-500 hover:bg-amber-600',
  slate: 'bg-slate-500',
};

const CARDS: RapportCardDef[] = [
  {
    title: 'Transactions journalières',
    description: 'Journal de caisse filtrable, avec export et flux recettes/dépenses.',
    icon: Receipt,
    color: 'green',
    href: '/journal-caisse/export',
  },
  {
    title: 'Trésorerie hebdomadaire',
    description: 'Recettes, dépenses et proformas validées, semaine par semaine.',
    icon: Landmark,
    color: 'blue',
    href: '/dashboard/rapports/tresorerie-hebdomadaire',
  },
  {
    title: 'Statistique proforma',
    description: "Vue d'ensemble de l'activité : CA, encours, conversion, répartition des factures.",
    icon: PieChart,
    color: 'green',
    href: '/statistiques',
  },
  {
    title: 'Ventes à percevoir',
    description: 'Proformas avec un reste à payer, par client.',
    icon: TrendingUp,
    color: 'orange',
  },
  {
    title: 'Achats fournisseurs',
    description: 'Bons de commande et factures fournisseurs à payer.',
    icon: Package,
    color: 'orange',
  },
  {
    title: 'Suivi budgétaire',
    description: 'Prévu vs réalisé par service, par mois et par catégorie de dépense, avec dépassements.',
    icon: Wallet,
    color: 'blue',
    href: '/dashboard/rapports/suivi-budgetaire',
  },
  {
    title: 'Dépenses par département',
    description: "Qui dépense le plus chaque mois : classement, évolution, catégories, comparaison au prévu et à l'enveloppe.",
    icon: Building2,
    color: 'blue',
    href: '/dashboard/rapports/depenses-departement',
  },
  {
    title: 'Rapport employés',
    description: "Chiffre d'affaires généré par gestionnaire.",
    icon: Users,
    color: 'slate',
  },
  {
    title: 'Top produits & clients',
    description: 'Classement par chiffre d\'affaires sur la période.',
    icon: BarChart3,
    color: 'slate',
  },
  {
    title: 'Campagnes en cours',
    description: 'Campagnes Camptrack liées à vos proformas, et renouvellements à venir.',
    icon: Megaphone,
    color: 'slate',
  },
];

function RapportTile({ card }: { card: RapportCardDef }) {
  const Icon = card.icon;
  const content = (
    <Card
      className={cn(
        'h-full transition-shadow',
        card.href ? 'hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
      )}
    >
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className={cn('p-3 rounded-xl text-white', COLOR_CLASSES[card.color])}>
            <Icon className="h-5 w-5" />
          </div>
          {!card.href && <Badge variant="secondary">Bientôt</Badge>}
        </div>
        <div>
          <h3 className="font-semibold leading-tight">{card.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (!card.href) {
    return <div>{content}</div>;
  }
  return (
    <Link href={card.href} className="block h-full">
      {content}
    </Link>
  );
}

export default function RapportsPage() {
  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="pb-6 border-b">
        <h1 className="text-2xl font-extrabold tracking-tight">Rapports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chaque carte ouvre un rapport filtrable et exportable. D&apos;autres rapports seront ajoutés progressivement.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => (
          <RapportTile key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}
