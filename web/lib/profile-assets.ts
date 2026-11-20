export type UploadedProfileAsset = { bucket: string; path: string };
export type SavedProfileAssetPaths = {
  avatar_path: string | null;
  cover_path: string | null;
  profile_music_path: string | null;
};

/**
 * Returns assets safe to remove after a failed profile save.
 * null means the database write outcome is ambiguous and cleanup must be skipped.
 */
export function planProfileAssetCleanup(
  uploaded: UploadedProfileAsset[],
  profileUpdateAttempted: boolean,
  savedProfile?: SavedProfileAssetPaths | null,
): UploadedProfileAsset[] | null {
  if (!profileUpdateAttempted) return uploaded;
  if (!savedProfile) return null;

  const referenced = new Set(
    [savedProfile.avatar_path, savedProfile.cover_path, savedProfile.profile_music_path]
      .filter((path): path is string => typeof path === 'string' && path.length > 0),
  );
  return uploaded.filter((asset) => !referenced.has(asset.path));
}
