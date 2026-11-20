import { describe, expect, it } from 'vitest';
import { MAX_REEL_VIDEO_BYTES, validateReelUpload } from '../lib/reel-media';

describe('creator studio reel validation', () => {
  const video = { type: 'video/mp4', size: 1024 };
  it('accepts a valid video with an optional image cover', () => {
    expect(validateReelUpload(video, { type: 'image/jpeg', size: 5000 }, 45)).toBeNull();
  });
  it('enforces the exact 50 MB video cap', () => {
    expect(MAX_REEL_VIDEO_BYTES).toBe(50_000_000);
    expect(validateReelUpload({ ...video, size: MAX_REEL_VIDEO_BYTES }, null, 30)).toBeNull();
    expect(validateReelUpload({ ...video, size: MAX_REEL_VIDEO_BYTES + 1 }, null, 30)).not.toBeNull();
  });
  it('rejects non-video media and oversized covers', () => {
    expect(validateReelUpload({ type: 'image/png', size: 200 }, null, 30)).not.toBeNull();
    expect(validateReelUpload(video, { type: 'image/jpeg', size: 10_000_001 }, 30)).not.toBeNull();
  });
  it('rejects videos outside the supported duration range', () => {
    expect(validateReelUpload(video, null, 0)).not.toBeNull();
    expect(validateReelUpload(video, null, 601)).not.toBeNull();
  });
});
