import type { GoogleConnectionStatus } from '@daybrief/core';
import { useTranslation } from '@daybrief/i18n';
import { Avatar, Button, Chip, Icon, Text, cx } from '@daybrief/ui';
import { AlertTriangle, Check, Clock, Mail, Plug, X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { signInWithGoogle } from '../auth/google';
import { api, bearer } from '../lib/api';
import { devMock } from '../lib/dev-mock';
import { SettingsCard } from './SettingsCard';

/** Status of the Calendar + Tasks connection; null while loading or if the request failed. */
function useGoogleConnection(): GoogleConnectionStatus | null {
  const { session } = useAuth();
  const token = session?.access_token;
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(
    devMock?.googleConnection ?? null,
  );

  useEffect(() => {
    if (devMock || !token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.connections.google.$get({}, bearer(token));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (!cancelled) setStatus(body.status);
      } catch (e) {
        // Without a status the row shows no chip; the rest of settings still works.
        console.warn('Loading the Google connection failed:', e instanceof Error ? e.message : e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return status;
}

/** Connected accounts: Google Calendar + Tasks with its status, Gmail as "soon" until M3. */
export function Accounts() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const status = useGoogleConnection();
  const email = session?.user.email;
  const googleHint = email ? `${email} · ${t('settings.readOnly')}` : t('settings.readOnly');

  return (
    <SettingsCard icon={Plug} title={t('settings.accounts')}>
      <View className="gap-0.5">
        <AccountRow
          leading={<Avatar name="Google" label="G" tone={1} />}
          title={t('settings.googleName')}
          hint={googleHint}
        >
          {status === 'active' && (
            <Chip className="self-center" icon={Check} label={t('settings.connected')} />
          )}
          {(status === 'revoked' || status === 'error') && (
            <Chip
              className="self-center"
              variant="accent"
              icon={AlertTriangle}
              label={t('settings.reconnect')}
            />
          )}
          {status === 'none' && (
            <Chip className="self-center" icon={X} label={t('settings.notConnected')} />
          )}
          {status !== null && status !== 'active' && (
            // Signing in again asks Google for consent and stores a fresh connection (T6).
            <Button
              size="small"
              label={t('settings.connect')}
              onPress={() => void signInWithGoogle()}
            />
          )}
        </AccountRow>
        <AccountRow
          separated
          wrapHint
          leading={
            <View
              aria-hidden
              className="h-10 w-10 items-center justify-center rounded-pill bg-av-4"
            >
              <Icon icon={Mail} size={16} tone="ink" />
            </View>
          }
          title={t('settings.gmailName')}
          hint={t('settings.gmailHint')}
        >
          <Chip className="self-center" icon={Clock} label={t('settings.soon')} />
          <Button size="small" label={t('settings.connect')} disabled />
        </AccountRow>
      </View>
    </SettingsCard>
  );
}

/**
 * Account row (`.li`): avatar, name and hint, then status and action. When the card is narrow
 * the status and action wrap under the text, aligned with it.
 */
function AccountRow({
  leading,
  title,
  hint,
  wrapHint = false,
  separated = false,
  children,
}: {
  leading: ReactNode;
  title: string;
  hint: string;
  /** The hint may take two lines instead of ellipsizing (an explanation, not an address). */
  wrapHint?: boolean;
  separated?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      className={cx(
        'min-h-11 flex-row items-center gap-3 px-3 py-2.5',
        separated ? 'border-t border-line' : 'rounded-row',
      )}
    >
      {leading}
      <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-2">
        <View className="min-w-[240px] flex-1">
          <Text variant="body" weight="bold" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="secondary" tone="ink-2" numberOfLines={wrapHint ? 2 : 1}>
            {hint}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">{children}</View>
      </View>
    </View>
  );
}
