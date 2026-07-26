import { getServerTranslator } from '@/lib/i18n/server';
import { Card } from '@/components/ui/Card';

export default async function SkladPage() {
  const { t } = await getServerTranslator();

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-sm p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900">{t('hub.comingSoonTitle')}</h1>
        <p className="mt-2 text-sm text-slate-500">{t('hub.comingSoonMessage')}</p>
      </Card>
    </div>
  );
}
