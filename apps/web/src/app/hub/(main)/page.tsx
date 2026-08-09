import Link from 'next/link';
import { getServerTranslator } from '@/lib/i18n/server';
import { Card } from '@/components/ui/Card';
import { FinanceIcon, SalesIcon, SkladIcon } from '../nav-icons';

/** The front door: one tile per part of the business, and nothing else. */
export default async function HubPage() {
  const { t } = await getServerTranslator();

  const modules = [
    {
      href: '/dashboard',
      title: t('hub.finance'),
      description: t('hub.financeDescription'),
      Icon: FinanceIcon,
    },
    {
      href: '/hub/sklad',
      title: t('hub.sklad'),
      description: t('hub.skladDescription'),
      Icon: SkladIcon,
    },
    {
      href: '/hub/sotuv',
      title: t('hub.sotuv'),
      description: t('hub.sotuvDescription'),
      Icon: SalesIcon,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map(({ href, title, description, Icon }) => (
        <Link key={href} href={href}>
          <Card className="flex h-full flex-col gap-2 p-6 transition-shadow hover:shadow-md">
            <Icon className="h-8 w-8 text-brand-600" />
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{description}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
