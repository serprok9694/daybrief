// Dev showcase of packages/ui, mirroring docs/design/source/Components.dc.html and Tokens.dc.html.
// UI strings stay literal here on purpose: this screen is for development only (see M0/T3).
import {
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  ListRow,
  Orb,
  Scene,
  Segment,
  Sheet,
  Skeleton,
  Text,
  ThemeProvider,
  Toast,
  cx,
  radius,
  sceneHours,
  sceneNames,
  space,
  themes,
  themePreferences,
  type SceneName,
  type ThemeName,
  type ThemePreference,
  type ThemeVar,
  useTheme,
  useToken,
} from '@daybrief/ui';
import {
  Check,
  ChevronDown,
  Clock,
  CornerUpLeft,
  ListChecks,
  RefreshCw,
  Video,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

const columns: { theme: ThemeName; scene: SceneName; title: string }[] = [
  { theme: 'light', scene: 'day', title: 'Light' },
  { theme: 'dark', scene: 'night', title: 'Dark' },
];

export default function UiShowcase() {
  const [preference, setPreference] = useState<ThemePreference>('auto');
  const [lite, setLite] = useState(false);
  const [spinning, setSpinning] = useState(false);

  return (
    <ThemeProvider preference={preference} lite={lite} className="flex-1">
      <Scene scene="day" className="flex-1">
        <ScrollView contentContainerClassName="w-full max-w-[1440px] self-center gap-6 p-3 wide:p-10">
          <Sheet className="gap-4 px-5 py-6 wide:px-10 wide:py-8">
            <Text variant="greeting">Design system</Text>
            <Text tone="ink-2" style={{ fontSize: 16, lineHeight: 24 }}>
              packages/ui: tokens, theme and primitives. Every color is a CSS variable set with
              vars() on the theme root, so one class drives light and dark. The two columns below
              are pinned to light and dark; the controls switch this page.
            </Text>
            <View className="flex-row flex-wrap items-center gap-3">
              <Segment
                options={themePreferences.map((p) => ({ value: p, label: preferenceLabels[p] }))}
                value={preference}
                onChange={setPreference}
              />
              <Segment
                options={[
                  { value: 'full', label: 'Full glass' },
                  { value: 'lite', label: 'Lite (Android)' },
                ]}
                value={lite ? 'lite' : 'full'}
                onChange={(v) => setLite(v === 'lite')}
              />
              <Button
                variant="secondary"
                size="small"
                label={spinning ? 'Stop spin' : 'Spin refresh'}
                onPress={() => setSpinning((s) => !s)}
              />
            </View>
          </Sheet>

          <Columns>
            {columns.map((c) => (
              <ThemeColumn key={c.theme} {...c} lite={lite}>
                <ComponentsPanel title={c.title} spinning={spinning} />
              </ThemeColumn>
            ))}
          </Columns>

          <Columns>
            {columns.map((c) => (
              <ThemeColumn key={c.theme} {...c} lite={lite}>
                <TokensPanel theme={c.theme} title={c.title} />
              </ThemeColumn>
            ))}
          </Columns>

          <Columns three>
            <TypeCard />
            <ShapeCard />
            <ScenesCard />
          </Columns>

          <Card className="gap-3.5 p-[18px] wide:p-[22px]">
            <Text variant="title">Tailwind preset</Text>
            <ScrollView horizontal>
              <Text mono variant="secondary" className="leading-5">
                {tailwindSnippet}
              </Text>
            </ScrollView>
          </Card>
        </ScrollView>
      </Scene>
    </ThemeProvider>
  );
}

const preferenceLabels: Record<ThemePreference, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

function Columns({ three = false, children }: { three?: boolean; children: ReactNode }) {
  return (
    <View
      className={cx('gap-6', three ? 'xl:flex-row xl:items-start' : 'lg:flex-row lg:items-start')}
    >
      {children}
    </View>
  );
}

function ThemeColumn({
  theme,
  scene,
  lite,
  children,
}: {
  theme: ThemeName;
  scene: SceneName;
  lite: boolean;
  children: ReactNode;
}) {
  return (
    <ThemeProvider preference={theme} lite={lite} className="min-w-0 lg:flex-1">
      <Scene scene={scene} className="rounded-sheet p-3 wide:p-6">
        <Sheet radius={radius.sheetMobile} className="gap-[22px] p-4 wide:p-7">
          {children}
        </Sheet>
      </Scene>
    </ThemeProvider>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2.5">
      <Text variant="caption" tone="ink-3" className="uppercase tracking-[0.48px]">
        {label}
      </Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap items-center gap-3">{children}</View>;
}

// ---------- Components (Components.dc.html) ----------

function ComponentsPanel({ title, spinning }: { title: string; spinning: boolean }) {
  return (
    <>
      <Text weight="bold" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.28 }}>
        {title}
      </Text>

      <Group label="Widget card">
        <Card className="gap-3.5 p-[18px] wide:p-[22px]">
          <View className="min-h-9 flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-pill bg-fill">
              <Icon icon={ListChecks} size={20} />
            </View>
            <Text variant="title" className="min-w-0 flex-1">
              Tasks
            </Text>
            <Text variant="caption" weight="medium" tone="ink-3" numberOfLines={1}>
              Updated 2 min ago
            </Text>
            <IconButton icon={RefreshCw} accessibilityLabel="Refresh tasks" spinning={spinning} />
          </View>
          <View className="gap-0.5">
            <ListRow
              title="Review pull request #128"
              leading={<Marker />}
              openLabel="Open in Google Tasks"
            />
          </View>
          <Button
            variant="ghost"
            size="small"
            label="Show 2 more"
            iconEnd={ChevronDown}
            className="mt-0.5 self-start"
          />
        </Card>
      </Group>

      <Group label="Command bar">
        <CommandBar placeholder="Capture an idea…" />
        <CommandBar value="Try a weekly review ritual" focused />
        <Toast message="Idea saved" />
      </Group>

      <Group label="Buttons">
        <Row>
          <Button icon={Check} label="Done" />
          <Button variant="secondary" label="Not now" />
          <Button variant="ghost" label="Cancel" />
          <Button label="Disabled" disabled />
        </Row>
        <Row>
          <Button size="small" label="Connect" />
          <Button variant="secondary" size="small" label="Try again" />
          <Button variant="ghost" size="small" label="Revoke" />
          <IconButton icon={RefreshCw} accessibilityLabel="Refresh" spinning={spinning} />
        </Row>
      </Group>

      <Group label="Status chips">
        <View className="flex-row flex-wrap items-center gap-2.5">
          <Chip variant="solid" label="in 18 min" />
          <Chip variant="accent" icon={CornerUpLeft} label="Needs reply" />
          <Chip variant="accent" icon={Clock} label="Overdue · 2 days" />
          <Chip icon={Check} label="Connected" />
          <Chip label="Meet" />
        </View>
      </Group>

      <Group label="List items">
        <Card className="gap-0.5 p-2.5">
          <EventRow />
          <ListRow
            title="Send the invoice to the client"
            leading={<Marker accent />}
            openLabel="Open in Google Tasks"
          >
            <Chip variant="accent" icon={Clock} label="Overdue · 2 days" className="mt-1" />
          </ListRow>
          <ListRow
            title="Anna Kowalska"
            meta="08:12"
            leading={<Avatar name="Anna Kowalska" tone={1} />}
            openLabel="Open in Gmail"
          >
            <Text variant="secondary" numberOfLines={1}>
              Design review: updated flows
            </Text>
            <Text variant="secondary" tone="ink-2" numberOfLines={2}>
              Asks you to confirm the revised onboarding flow before the review.
            </Text>
          </ListRow>
        </Card>
      </Group>

      <View className="gap-[22px] wide:flex-row">
        <View className="flex-1">
          <Group label="Avatars">
            <View className="flex-row items-center gap-2.5">
              <Avatar name="Anna Kowalska" tone={1} />
              <Avatar name="Anna Tikhonova" tone={2} />
              <Avatar name="Vera" tone={3} />
              <Avatar name="Max Novak" tone={4} />
              <Avatar name="Sergei" tone={1} size={44} />
            </View>
          </Group>
        </View>
        <View className="flex-1">
          <Group label="Skeleton">
            <Card className="flex-row items-start gap-3 p-4">
              <Skeleton circle width={40} height={40} />
              <View className="flex-1 gap-2">
                <Skeleton width="42%" />
                <Skeleton width="76%" />
                <Skeleton width="90%" height={12} />
              </View>
            </Card>
          </Group>
        </View>
      </View>
    </>
  );
}

/** Task marker: 8 px dot in a 20×22 box (accent for overdue). */
function Marker({ accent = false }: { accent?: boolean }) {
  return (
    <View className="h-[22px] w-5 items-center justify-center">
      <View className={cx('h-2 w-2 rounded-pill', accent ? 'bg-accent' : 'bg-ink-3')} />
    </View>
  );
}

/** Next-event timeline row, composed from primitives (the real one ships with the Events widget). */
function EventRow() {
  const ring = useToken('accent-soft');
  return (
    <ListRow
      highlighted
      title="Design review with Anna"
      openLabel="Open in Google Calendar"
      className="min-h-14 gap-2.5 py-2"
      leading={
        <View className="flex-row gap-2.5 self-stretch">
          <View className="w-[52px]">
            <Text weight="bold" tone="accent-ink" className="tabular-nums">
              10:00
            </Text>
            <Text variant="caption" weight="medium" tone="ink-3">
              1 h
            </Text>
          </View>
          <View className="w-3 items-center">
            <View className="absolute bottom-[-10px] top-0 w-0.5 bg-line" />
            <View
              className="mt-[5px] h-3 w-3 rounded-pill bg-accent"
              style={{ boxShadow: `0 0 0 4px ${ring}` }}
            />
          </View>
        </View>
      }
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="flex-row items-center gap-1">
          <Icon icon={Video} />
          <Text variant="secondary" tone="ink-2">
            Meet
          </Text>
        </View>
        <Chip variant="solid" label="in 18 min" />
      </View>
    </ListRow>
  );
}

function CommandBar({
  placeholder,
  value,
  focused = false,
}: {
  placeholder?: string;
  value?: string;
  focused?: boolean;
}) {
  const accent = useToken('accent');
  const placeholderColor = useToken('ink-3');
  return (
    <View
      className="h-12 flex-row items-center gap-3 rounded-pill border border-stroke-card bg-fill pl-2 pr-4"
      style={focused ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
    >
      <Orb />
      <TextInput
        accessibilityLabel="Command bar"
        placeholder={placeholder}
        defaultValue={value}
        placeholderTextColor={placeholderColor}
        className="h-full min-w-0 flex-1 font-medium text-body text-ink web:outline-none"
      />
      <View aria-hidden className="rounded-lg border border-line px-[7px] py-1">
        <Text variant="caption" tone="ink-3" className="leading-3">
          ↵
        </Text>
      </View>
    </View>
  );
}

// ---------- Tokens (Tokens.dc.html) ----------

const contrast: Record<ThemeName, Partial<Record<ThemeVar, string>>> = {
  light: {
    '--ink': '11.7 : 1',
    '--ink-2': '6.8 : 1',
    '--ink-3': '5.3 : 1',
    '--accent': 'non-text',
    '--accent-ink': '5.1 : 1',
    '--accent-solid': '5.7 : 1',
    '--btn-p-bg': '18.5 : 1',
  },
  dark: {
    '--ink': '9.1 : 1',
    '--ink-2': '7.0 : 1',
    '--ink-3': '5.4 : 1',
    '--accent': 'non-text',
    '--accent-ink': '4.8 : 1',
    '--accent-solid': '8.9 : 1',
    '--btn-p-bg': '16.3 : 1',
  },
};

const swatches: { name: string; v: ThemeVar; use: string }[] = [
  { name: 'Ink', v: '--ink', use: 'Primary text' },
  { name: 'Ink 2', v: '--ink-2', use: 'Secondary text' },
  { name: 'Ink 3', v: '--ink-3', use: 'Captions and timestamps' },
  { name: 'Accent', v: '--accent', use: 'Now / important: dots, rings (never text)' },
  { name: 'Accent ink', v: '--accent-ink', use: 'Accent text on the soft chip' },
  { name: 'Accent solid', v: '--accent-solid', use: 'Solid chip label background' },
  { name: 'Primary button', v: '--btn-p-bg', use: 'Pill, inverted in dark' },
  { name: 'Sheet plate', v: '--sheet-bg', use: 'Large glass panel' },
  { name: 'Card plate', v: '--card-bg', use: 'Widget card on the sheet' },
];

function TokensPanel({ theme, title }: { theme: ThemeName; title: string }) {
  const { vars, lite } = useTheme();
  const glass: [string, string][] = [
    ['blur sheet / card', `${vars['--blur']} / ${vars['--blur-card']}`],
    ['saturate', vars['--sat']],
    ['stroke', `${vars['--stroke']} · card ${vars['--stroke-card']}`],
    ['top highlight', `inset 0 1px 0 ${vars['--hi']}`],
    ['mode', lite ? 'lite (Android)' : 'full glass'],
  ];
  return (
    <>
      <Text weight="bold" style={{ fontSize: 24, lineHeight: 30 }}>
        {title}
      </Text>
      <View>
        {swatches.map((s) => (
          <View key={s.v} className="flex-row items-center gap-3.5 border-t border-line py-[9px]">
            <View
              className="h-11 w-11 rounded-[14px] border border-line"
              style={{ backgroundColor: vars[s.v] }}
            />
            <View className="min-w-0 flex-1">
              <Text weight="bold">
                {s.name}{' '}
                <Text mono variant="secondary" tone="ink-3">
                  {s.v}
                </Text>
              </Text>
              <Text variant="secondary" tone="ink-2">
                {s.use}
              </Text>
            </View>
            <View className="items-end">
              <Text mono variant="secondary" weight="bold">
                {themes[theme][s.v] === vars[s.v] ? vars[s.v] : `${vars[s.v]} (lite)`}
              </Text>
              <Text variant="secondary" tone="ink-3">
                {contrast[theme][s.v] ?? ''}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text variant="title" className="mt-1.5">
        Glass
      </Text>
      <View>
        {glass.map(([k, val]) => (
          <View key={k} className="flex-row gap-3.5 border-t border-line py-[7px]">
            <Text mono variant="secondary" weight="bold" tone="ink-3" className="w-[150px]">
              {k}
            </Text>
            <Text mono variant="secondary" className="min-w-0 flex-1">
              {val}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

const typeRows = [
  { name: 'Greeting', px: 30, lh: 36, w: 'bold', ls: -0.6, spec: '44/52 · 700 · mobile 30/36' },
  { name: 'Day brief', px: 24, lh: 32, w: 'medium', ls: -0.24, spec: '26/38 · 500 · mobile 20/29' },
  { name: 'Idea', px: 20, lh: 28, w: 'bold', ls: -0.2, spec: '22/30 · 700 · mobile 19/27' },
  { name: 'Widget title', px: 17, lh: 24, w: 'bold', ls: 0, spec: '17/24 · 700' },
  { name: 'Body', px: 15, lh: 22, w: 'medium', ls: 0, spec: '15/22 · 500' },
  { name: 'Secondary', px: 13, lh: 18, w: 'medium', ls: 0, spec: '13/18 · 500' },
  { name: 'Caption, chip', px: 12, lh: 16, w: 'bold', ls: 0, spec: '12/16 · 700' },
] as const;

function TypeCard() {
  return (
    <Card className="gap-3.5 p-[18px] wide:p-[22px] xl:flex-1">
      <Text variant="title">Type</Text>
      <Text variant="secondary" tone="ink-2">
        Manrope in three weights (400, 500, 700), Latin and Cyrillic.
      </Text>
      <View>
        {typeRows.map((y) => (
          <View
            key={y.name}
            className="flex-row items-baseline justify-between gap-3 border-t border-line py-[9px]"
          >
            <Text
              weight={y.w}
              style={{ fontSize: y.px, lineHeight: y.lh, letterSpacing: y.ls }}
              className="min-w-0 flex-shrink"
            >
              {y.name}
            </Text>
            <Text mono variant="secondary" tone="ink-3">
              {y.spec}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const radiusRows = [
  { name: 'Sheet', px: radius.sheet },
  { name: 'Card', px: radius.card },
  { name: 'Row, field', px: radius.row },
  { name: 'Pill: button, chip, input', px: radius.pill },
];

function ShapeCard() {
  const { vars } = useTheme();
  return (
    <Card className="gap-3.5 p-[18px] wide:p-[22px] xl:flex-1">
      <Text variant="title">Radii, spacing, shadow</Text>
      <View>
        {radiusRows.map((r) => (
          <View
            key={r.name}
            className="flex-row items-center gap-3.5 border-t border-line py-[9px]"
          >
            <View
              className="h-10 w-14 border border-line bg-fill-2"
              style={{ borderRadius: r.px }}
            />
            <Text weight="bold" className="flex-1">
              {r.name}
            </Text>
            <Text mono variant="secondary" tone="ink-3">
              {r.px} px
            </Text>
          </View>
        ))}
      </View>
      <Text weight="bold" className="mt-2">
        Spacing scale (px)
      </Text>
      <View className="flex-row flex-wrap items-end gap-x-3.5 gap-y-2.5">
        {space.map((sp) => (
          <View key={sp} className="items-center gap-1.5">
            <View className="rounded bg-accent" style={{ width: sp, height: sp }} />
            <Text mono variant="secondary" tone="ink-3">
              {sp}
            </Text>
          </View>
        ))}
      </View>
      <Text weight="bold" className="mt-2">
        Shadows
      </Text>
      <Text mono variant="secondary" tone="ink-2">
        sheet: {vars['--shadow-sheet']}
      </Text>
      <Text mono variant="secondary" tone="ink-2">
        card: {vars['--shadow-card']}
      </Text>
    </Card>
  );
}

const sceneLabels: Record<SceneName, string> = {
  morning: 'Morning',
  day: 'Day',
  evening: 'Evening',
  night: 'Night',
};

function ScenesCard() {
  return (
    <Card className="gap-3.5 p-[18px] wide:p-[22px] xl:flex-1">
      <Text variant="title">Backgrounds</Text>
      <Text variant="secondary" tone="ink-2">
        CSS stand-ins for the interior photos. The photo goes into --scene-photo.
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {sceneNames.map((name) => (
          <View key={name} className="min-w-[120px] flex-1 basis-[40%] gap-1.5">
            <Scene
              scene={name}
              className="h-24 overflow-hidden rounded-[20px] border border-line"
            />
            <Text weight="bold">{sceneLabels[name]}</Text>
            <Text variant="secondary" tone="ink-3">
              {sceneHours[name][0]} – {sceneHours[name][1]}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const tailwindSnippet = [
  '// packages/ui/src/tailwind.ts (NativeWind preset): colors are CSS variables, vars() on the theme root switches them',
  'theme: {',
  '  colors: {',
  '    ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },',
  '    accent: { DEFAULT: "var(--accent)", ink: "var(--accent-ink)", soft: "var(--accent-soft)", solid: "var(--accent-solid)" },',
  '    plate: { sheet: "var(--sheet-bg)", card: "var(--card-bg)" },',
  '    fill: { DEFAULT: "var(--fill)", 2: "var(--fill-2)" }, line: "var(--line)", …',
  '  },',
  '  extend: {',
  '    borderRadius: { sheet: "40px", "sheet-m": "32px", card: "28px", row: "16px", pill: "999px" },',
  '    fontSize: { greeting, summary, idea, title, body, secondary, caption },',
  '  },',
  '},',
  '// font-regular / font-medium / font-bold pick the Manrope face (one family per weight)',
].join('\n');
