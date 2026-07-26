import Link from 'next/link';
import { getServerTranslator } from '@/lib/i18n/server';
import { Card } from '@/components/ui/Card';
import { FinanceIcon, SkladIcon } from './hub-sidebar';

export default async function HubPage() {
  const { t } = await getServerTranslator();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Link href="/dashboard">
        <Card className="flex h-full flex-col gap-2 p-6 transition-shadow hover:shadow-md">
          <FinanceIcon className="h-8 w-8 text-brand-600" />
          <h2 className="text-lg font-semibold text-slate-900">{t('hub.finance')}</h2>
          <p className="text-sm text-slate-500">{t('hub.financeDescription')}</p>
        </Card>
      </Link>
      <Link href="/hub/sklad">
        <Card className="flex h-full flex-col gap-2 p-6 transition-shadow hover:shadow-md">
          <SkladIcon className="h-8 w-8 text-brand-600" />
          <h2 className="text-lg font-semibold text-slate-900">{t('hub.sklad')}</h2>
          <p className="text-sm text-slate-500">{t('hub.skladDescription')}</p>
        </Card>
      </Link>
    </div>
  );
}
