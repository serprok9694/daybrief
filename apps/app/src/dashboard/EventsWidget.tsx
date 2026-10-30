// "Today's events", docs/design/source/EventsWidget.dc.html and "Таймлайн события" in the
// design README.
import type { AllDayCalendarEvent, TimedCalendarEvent } from '@daybrief/core';
import { getLanguage, useTranslation } from '@daybrief/i18n';
import { Button, Chip, Icon, Skeleton, Text, cx } from '@daybrief/ui';
import { Link } from 'expo-router';
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  Clock,
  Plug,
  RefreshCw,
  Video,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, View, type DimensionValue } from 'react-native';
import { useProfile } from '../lib/profile';
import {
  buildTimeline,
  duration,
  formatTime,
  startsIn,
  updatedAgo,
  videoService,
  type TimelineRow,
} from './events';
import { useMinuteClock, useTodayEvents } from './useTodayEvents';
import { EmptyState, Loading, Widget } from './Widget';

const skeletonRows: DimensionValue[] = ['70%', '55%', '80%', '62%'];
const tabular = { fontVariant: ['tabular-nums' as const] };

const open = (url: string | null) => {
  if (url) void Linking.openURL(url);
};

export function EventsWidget({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { state, busy, refresh } = useTodayEvents();
  const now = useMinuteClock();
  const [expanded, setExpanded] = useState(false);
  const timeZone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  let meta: string | undefined;
  if (state.status === 'ready') {
    const ago = updatedAgo(state.data.syncedAt, now);
    if (ago?.unit === 'minutes') meta = t('common.updatedAgo', { minutes: ago.minutes });
    if (ago?.unit === 'hours') meta = t('common.updatedHoursAgo', { hours: ago.hours });
    if (ago?.unit === 'days') meta = t('common.updatedDaysAgo', { days: ago.days });
  }

  let body: ReactNode;
  if (state.status === 'loading') {
    body = (
      <Loading label={t('events.loading')} className="gap-[18px] px-3 py-1.5">
        {skeletonRows.map((width, i) => (
          <View key={i} className="flex-row items-start gap-3.5">
            <Skeleton width={44} height={36} />
            <View className="flex-1 gap-2">
              <Skeleton height={16} width={width} />
              <Skeleton height={12} width="38%" />
            </View>
          </View>
        ))}
      </Loading>
    );
  } else if (state.status === 'error') {
    body = (
      <EmptyState icon={AlertTriangle} title={t('common.errorTitle')} hint={t('common.errorHint')}>
        <Button
          variant="secondary"
          size="small"
          icon={RefreshCw}
          label={t('common.retry')}
          disabled={busy}
          onPress={refresh}
        />
      </EmptyState>
    );
  } else if (state.status === 'reconnect') {
    body = <Reconnect />;
  } else if (state.data.events.length === 0) {
    body = <EmptyState icon={Calendar} title={t('events.empty')} />;
  } else {
    const { rows, hidden } = buildTimeline(state.data.events, now, timeZone, expanded);
    body = (
      <>
        <View role="list" className="gap-0.5">
          {rows.map((row) => (
            <View role="listitem" key={rowKey(row)}>
              <Row row={row} now={now} timeZone={timeZone} />
            </View>
          ))}
        </View>
        {hidden > 0 && (
          <Button
            variant="ghost"
            size="small"
            iconEnd={ChevronDown}
            label={t('common.showMore', { count: hidden })}
            className="mt-0.5 self-start"
            onPress={() => setExpanded(true)}
          />
        )}
      </>
    );
  }

  return (
    <Widget
      icon={Calendar}
      title={t('events.title')}
      refreshLabel={t('events.refresh')}
      loading={busy}
      onRefresh={refresh}
      meta={meta}
      className={className}
    >
      {body}
    </Widget>
  );
}

function rowKey(row: TimelineRow): string {
  if (row.kind === 'free') return `free-${row.start}`;
  return `${row.event.calendarId}/${row.event.id}`;
}

function Row({ row, now, timeZone }: { row: TimelineRow; now: Date; timeZone: string }) {
  const { t } = useTranslation();
  const language = getLanguage();
  const time = (iso: string) => formatTime(iso, language, timeZone);

  if (row.kind === 'free') {
    return (
      <View className="mb-1 ml-[74px] mt-1 flex-row items-center gap-2 rounded-row border-[1.5px] border-dashed border-line px-3 py-2">
        <Icon icon={Clock} />
        <Text variant="secondary" weight="bold" tone="ink-2" className="min-w-0 flex-1">
          {t('events.free', { from: time(row.start), to: time(row.end) })}
        </Text>
      </View>
    );
  }
  if (row.kind === 'allDay') return <AllDayRow event={row.event} />;

  const { event, next, last } = row;
  const until = next ? startsIn(event.start, now) : null;
  return (
    <EventLink event={event} highlighted={next}>
      <View className="w-[52px]">
        <Text variant="body" weight="bold" tone={next ? 'accent-ink' : 'ink'} style={tabular}>
          {time(event.start)}
        </Text>
        <Text variant="caption" weight="medium" tone="ink-3">
          {t('events.duration', duration(event))}
        </Text>
      </View>
      <Rail next={next} last={last} />
      <View className="min-w-0 flex-1">
        <Text variant="body" weight="bold" numberOfLines={2}>
          {event.title || t('events.untitled')}
        </Text>
        {(event.videoUrl || until) && (
          <View className="flex-row flex-wrap items-center gap-2">
            {event.videoUrl && <VideoLink url={event.videoUrl} />}
            {until && (
              <Chip
                variant="solid"
                label={
                  until.hours === 0
                    ? t('events.startsIn', { minutes: until.minutes })
                    : t('events.startsInHours', until)
                }
              />
            )}
          </View>
        )}
      </View>
    </EventLink>
  );
}

function AllDayRow({ event }: { event: AllDayCalendarEvent }) {
  const { t } = useTranslation();
  return (
    <EventLink event={event}>
      <View className="w-[52px] justify-center">
        <Text variant="caption" tone="ink-3">
          {t('events.allDay')}
        </Text>
      </View>
      <View className="w-3" />
      <View className="min-w-0 flex-1 justify-center">
        <Text variant="body" weight="bold" numberOfLines={2}>
          {event.title || t('events.untitled')}
        </Text>
      </View>
    </EventLink>
  );
}

/** The row: opens the event in Google Calendar (`htmlLink`). */
function EventLink({
  event,
  highlighted = false,
  children,
}: {
  event: TimedCalendarEvent | AllDayCalendarEvent;
  highlighted?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const link = event.htmlLink;
  return (
    <Pressable
      accessibilityRole={link ? 'link' : undefined}
      disabled={!link}
      onPress={() => open(link)}
      className={cx(
        'min-h-14 flex-row gap-2.5 rounded-row px-3 py-2',
        highlighted ? 'bg-accent-soft' : link && 'hover:bg-fill',
        link && 'web:cursor-pointer',
      )}
    >
      {children}
      {link && (
        <View className="mt-[3px]" accessibilityLabel={t('events.open')} accessible>
          <Icon icon={ArrowUpRight} tone="ink-3" />
        </View>
      )}
    </Pressable>
  );
}

/**
 * The timeline between the time and the title: a line through the row down to the next
 * one, with a dot at the start time; the next event's dot is accent with a ring.
 */
function Rail({ next, last }: { next: boolean; last: boolean }) {
  return (
    <View className="w-3" aria-hidden>
      <View
        className={cx(
          'absolute left-[5px] w-0.5 bg-line',
          last ? 'top-0 h-3' : '-bottom-2.5 top-0',
        )}
      />
      {next ? (
        <View className="absolute -left-1 top-[3px] h-5 w-5 items-center justify-center rounded-pill bg-accent-soft">
          <View className="h-3 w-3 rounded-pill bg-accent" />
        </View>
      ) : (
        <View className="absolute left-px top-[7px] h-2.5 w-2.5 rounded-pill bg-ink-3" />
      )}
    </View>
  );
}

/** "Meet" / "Zoom" with the video icon: joins the call (`videoUrl`), not the event page. */
function VideoLink({ url }: { url: string }) {
  const { t } = useTranslation();
  const service = videoService(url);
  const label = service ?? t('events.videoCall');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('events.joinCall', { service: label })}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      onPress={() => open(url)}
      className="flex-row items-center gap-1 rounded-pill web:cursor-pointer"
    >
      <Icon icon={Video} />
      <Text variant="secondary" tone="ink-2" className="web:hover:underline">
        {label}
      </Text>
    </Pressable>
  );
}

/** Revoked, failing or missing Calendar connection: the error state pointing to settings. */
function Reconnect() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={AlertTriangle}
      title={t('common.errorTitle')}
      hint={t('events.reconnectHint')}
    >
      <Link href="/settings" asChild>
        <Button variant="secondary" size="small" icon={Plug} label={t('events.reconnect')} />
      </Link>
    </EmptyState>
  );
}
