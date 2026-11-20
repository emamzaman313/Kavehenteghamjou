import { describe, expect, it } from 'vitest';
import { planProfileAssetCleanup, type UploadedProfileAsset } from '../lib/profile-assets';

const uploaded: UploadedProfileAsset[] = [
  { bucket: 'profile-media', path: 'user-1/avatar-new.webp' },
  { bucket: 'profile-media', path: 'user-1/cover-new.webp' },
  { bucket: 'post-media', path: 'user-1/profile-music-new.mp3' },
];

describe('profile media rollback plan', () => {
  it('removes all new uploads when the profile update was never attempted', () => {
    expect(planProfileAssetCleanup(uploaded, false)).toEqual(uploaded);
  });

  it('preserves assets referenced by the saved profile and removes only abandoned uploads', () => {
    expect(planProfileAssetCleanup(uploaded, true, {
      avatar_path: 'user-1/avatar-new.webp',
      cover_path: null,
      profile_music_path: 'user-1/profile-music-new.mp3',
    })).toEqual([{ bucket: 'profile-media', path: 'user-1/cover-new.webp' }]);
  });

  it('skips cleanup when the profile update outcome cannot be verified', () => {
    expect(planProfileAssetCleanup(uploaded, true, null)).toBeNull();
    expect(planProfileAssetCleanup(uploaded, true)).toBeNull();
  });

  it('does not remove existing assets that were not part of this upload attempt', () => {
    const saved = {
      avatar_path: 'user-1/avatar-old.webp',
      cover_path: 'user-1/cover-old.webp',
      profile_music_path: null,
    };
    expect(planProfileAssetCleanup(uploaded, true, saved)).toEqual(uploaded);
  });
});
