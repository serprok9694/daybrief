import type { Profile, ProfilePatch } from '@daybrief/core';
import { describe, expect, it, vi } from 'vitest';
import { createProfileStore, type ProfileStoreDeps } from './profile-store';

const profile: Profile = {
  userId: 'user-1',
  displayName: 'Alice',
  locale: null,
  theme: 'auto',
  scene: 'auto',
  timezone: 'Europe/Berlin',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(overrides: Partial<ProfileStoreDeps> = {}, initial: Profile = profile) {
  let server = initial;
  const deps = {
    fetchProfile: vi.fn(async () => server),
    saveProfile: vi.fn(async (patch: ProfilePatch) => (server = { ...server, ...patch })),
    apply: vi.fn<(p: Profile) => void>(),
    deviceTimeZone: vi.fn(() => 'Europe/Berlin'),
    ...overrides,
  };
  return { store: createProfileStore(deps), deps };
}

describe('load', () => {
  it('applies the loaded profile and notifies subscribers', async () => {
    const { store, deps } = setup({}, { ...profile, locale: 'ru', theme: 'dark' });
    const listener = vi.fn();
    store.subscribe(listener);

    await store.load();

    expect(store.get()).toMatchObject({ locale: 'ru', theme: 'dark' });
    expect(deps.apply).toHaveBeenLastCalledWith(store.get());
    expect(listener).toHaveBeenCalled();
  });

  it('reports the device time zone when the profile has none', async () => {
    const { store, deps } = setup(
      { deviceTimeZone: () => 'Asia/Tbilisi' },
      { ...profile, timezone: null },
    );
    await store.load();
    expect(deps.saveProfile).toHaveBeenCalledWith({ timezone: 'Asia/Tbilisi' });
    expect(store.get()?.timezone).toBe('Asia/Tbilisi');
  });

  it('keeps an existing time zone', async () => {
    const { store, deps } = setup({ deviceTimeZone: () => 'Asia/Tbilisi' });
    await store.load();
    expect(deps.saveProfile).not.toHaveBeenCalled();
    expect(store.get()?.timezone).toBe('Europe/Berlin');
  });

  it('does not report an unknown time zone', async () => {
    const { store, deps } = setup(
      { deviceTimeZone: () => undefined },
      { ...profile, timezone: null },
    );
    await store.load();
    expect(deps.saveProfile).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  it('applies the change before the save finishes', async () => {
    const save = deferred<Profile>();
    const { store, deps } = setup({ saveProfile: () => save.promise });
    await store.load();

    const pending = store.update({ theme: 'dark', locale: 'ru' });
    expect(store.get()).toMatchObject({ theme: 'dark', locale: 'ru' });
    expect(deps.apply).toHaveBeenLastCalledWith(expect.objectContaining({ locale: 'ru' }));

    save.resolve({ ...profile, theme: 'dark', locale: 'ru' });
    await pending;
    expect(store.get()).toMatchObject({ theme: 'dark', locale: 'ru' });
  });

  it('sends only the changed fields', async () => {
    const { store, deps } = setup();
    await store.load();
    await store.update({ scene: 'night' });
    expect(deps.saveProfile).toHaveBeenCalledWith({ scene: 'night' });
  });

  it('rolls back and rethrows when saving fails', async () => {
    const { store, deps } = setup({
      saveProfile: async () => {
        throw new Error('HTTP 500');
      },
    });
    await store.load();

    await expect(store.update({ theme: 'dark', locale: 'ru' })).rejects.toThrow('HTTP 500');
    expect(store.get()).toEqual(profile);
    expect(deps.apply).toHaveBeenLastCalledWith(profile);
  });

  it('keeps the newest choice when an older save answers last', async () => {
    const first = deferred<Profile>();
    const second = deferred<Profile>();
    const saves = [first, second];
    const { store } = setup({ saveProfile: () => saves.shift()!.promise });
    await store.load();

    const a = store.update({ scene: 'morning' });
    const b = store.update({ scene: 'night' });
    second.resolve({ ...profile, scene: 'night' });
    await b;
    first.resolve({ ...profile, scene: 'morning' });
    await a;

    expect(store.get()?.scene).toBe('night');
  });

  it('does not roll back over a newer choice when an older save fails', async () => {
    const first = deferred<Profile>();
    const saves = [first.promise, Promise.resolve({ ...profile, theme: 'light' as const })];
    const { store } = setup({ saveProfile: () => saves.shift()! });
    await store.load();

    const a = store.update({ theme: 'dark' });
    await store.update({ theme: 'light' });
    first.reject(new Error('offline'));
    await expect(a).rejects.toThrow('offline');

    expect(store.get()?.theme).toBe('light');
  });

  it('refuses changes before the profile is loaded', async () => {
    const fetched = deferred<Profile>();
    const { store } = setup({ fetchProfile: () => fetched.promise });
    const loading = store.load();
    // The settings screen only offers choices once the profile is in.
    await expect(store.update({ theme: 'dark' })).rejects.toThrow('not loaded');
    fetched.resolve(profile);
    await loading;
    expect(store.get()).toEqual(profile);
  });
});
