// Dashboard widgets still in their loading state (docs/design/source/*Widget.dc.html,
// status "loading"): they get data in later milestones and request nothing yet. The events
// widget has data since M1 and lives in EventsWidget.tsx.
import { useTranslation } from '@daybrief/i18n';
import { Skeleton } from '@daybrief/ui';
import { Lightbulb, ListChecks, Mail, Sparkles } from 'lucide-react-native';
import { View, type DimensionValue } from 'react-native';
import { Loading, Widget } from './Widget';

export function SummaryWidget() {
  const { t } = useTranslation();
  return (
    <Widget icon={Sparkles} title={t('summary.title')} refreshLabel={t('summary.refresh')} loading>
      <Loading label={t('summary.loading')} className="gap-3 pb-1 pt-1.5">
        <Skeleton height={24} width="96%" />
        <Skeleton height={24} width="88%" />
        <Skeleton height={24} width="54%" />
      </Loading>
    </Widget>
  );
}

const taskRows: DimensionValue[] = ['72%', '58%', '80%', '64%', '50%'];

export function TasksWidget({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Widget
      icon={ListChecks}
      title={t('tasks.title')}
      refreshLabel={t('tasks.refresh')}
      loading
      className={className}
    >
      <Loading label={t('tasks.loading')} className="gap-5 px-3 py-1.5">
        {taskRows.map((width, i) => (
          <View key={i} className="flex-row items-center gap-3.5">
            <Skeleton circle width={10} height={10} />
            <Skeleton height={16} width={width} />
          </View>
        ))}
      </Loading>
    </Widget>
  );
}

const mailRows: DimensionValue[] = ['78%', '64%', '72%'];

export function MailWidget({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Widget
      icon={Mail}
      title={t('mail.title')}
      refreshLabel={t('mail.refresh')}
      loading
      className={className}
    >
      <Loading label={t('mail.loading')} className="gap-[22px] px-3 py-1.5">
        {mailRows.map((width, i) => (
          <View key={i} className="flex-row items-start gap-3">
            <Skeleton circle width={40} height={40} />
            <View className="flex-1 gap-2">
              <Skeleton height={14} width="42%" />
              <Skeleton height={14} width={width} />
              <Skeleton height={12} width="84%" />
            </View>
          </View>
        ))}
      </Loading>
    </Widget>
  );
}

export function IdeaWidget() {
  const { t } = useTranslation();
  return (
    <Widget icon={Lightbulb} title={t('idea.title')} refreshLabel={t('idea.refresh')} loading>
      <Loading label={t('idea.loading')} className="gap-3 py-1">
        <Skeleton height={26} width="70%" />
        <Skeleton height={44} width="100%" radius={16} />
      </Loading>
    </Widget>
  );
}
