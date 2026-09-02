import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeId,
  youtubeThumbnailUrl,
  mapBannerToSlideProps,
  selectActiveBanners,
  type CarouselBannerRecord,
} from './carouselBanner.ts';

test('YouTube id parsing', async (t) => {
  await t.test('accepts a bare 11-char video id', () => {
    assert.equal(parseYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  await t.test('parses youtube.com/watch?v=', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s'), 'dQw4w9WgXcQ');
  });

  await t.test('parses youtu.be short links', () => {
    assert.equal(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  await t.test('parses /embed/ links', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  await t.test('parses /shorts/ links', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  await t.test('returns null for garbage input', () => {
    assert.equal(parseYouTubeId('not a url'), null);
    assert.equal(parseYouTubeId(''), null);
    assert.equal(parseYouTubeId(null), null);
    assert.equal(parseYouTubeId('https://example.com/video/123'), null);
  });

  await t.test('builds the hqdefault thumbnail URL', () => {
    assert.equal(youtubeThumbnailUrl('dQw4w9WgXcQ'), 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });
});

test('mapBannerToSlideProps', async (t) => {
  await t.test('image banners pass the image URL straight through', () => {
    const banner: CarouselBannerRecord = {
      id: 'b1', type: 'image', enabled: true, order: 1,
      title: 'Grand opening', subtitle: 'This weekend only', imageUrl: 'https://cdn.example.com/x.jpg',
      ctaLabel: 'Book now', ctaLink: 'https://example.com/book',
    };
    const props = mapBannerToSlideProps(banner);
    assert.equal(props.imageUrl, 'https://cdn.example.com/x.jpg');
    assert.equal(props.youtubeId, null);
    assert.equal(props.title, 'Grand opening');
    assert.equal(props.ctaLabel, 'Book now');
  });

  await t.test('youtube banners resolve the thumbnail from the parsed id', () => {
    const banner: CarouselBannerRecord = {
      id: 'b2', type: 'youtube', enabled: true, order: 2,
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    };
    const props = mapBannerToSlideProps(banner);
    assert.equal(props.youtubeId, 'dQw4w9WgXcQ');
    assert.equal(props.imageUrl, 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  await t.test('youtube banners with an unparseable URL render no image rather than throwing', () => {
    const banner: CarouselBannerRecord = { id: 'b3', type: 'youtube', enabled: true, order: 3, youtubeUrl: 'garbage' };
    const props = mapBannerToSlideProps(banner);
    assert.equal(props.youtubeId, null);
    assert.equal(props.imageUrl, '');
  });

  await t.test('missing optional text fields default to empty strings, never "undefined"', () => {
    const banner: CarouselBannerRecord = { id: 'b4', type: 'image', enabled: true, order: 0 };
    const props = mapBannerToSlideProps(banner);
    assert.equal(props.title, '');
    assert.equal(props.subtitle, '');
    assert.equal(props.ctaLabel, '');
    assert.equal(props.ctaLink, '');
  });
});

test('selectActiveBanners', async (t) => {
  const banners: CarouselBannerRecord[] = [
    { id: 'c', type: 'image', enabled: true, order: 2 },
    { id: 'a', type: 'image', enabled: true, order: 0 },
    { id: 'disabled', type: 'image', enabled: false, order: -5 },
    { id: 'b', type: 'image', enabled: true, order: 1 },
  ];

  await t.test('excludes disabled banners entirely', () => {
    const active = selectActiveBanners(banners);
    assert.equal(active.some((b) => b.id === 'disabled'), false);
  });

  await t.test('sorts the remaining banners by admin-defined order ascending', () => {
    const active = selectActiveBanners(banners);
    assert.deepEqual(active.map((b) => b.id), ['a', 'b', 'c']);
  });

  await t.test('ties on order break stably by id', () => {
    const tied: CarouselBannerRecord[] = [
      { id: 'z', type: 'image', enabled: true, order: 5 },
      { id: 'y', type: 'image', enabled: true, order: 5 },
    ];
    assert.deepEqual(selectActiveBanners(tied).map((b) => b.id), ['y', 'z']);
  });

  await t.test('an empty or all-disabled list yields no active banners', () => {
    assert.deepEqual(selectActiveBanners([]), []);
    assert.deepEqual(selectActiveBanners([{ id: 'x', type: 'image', enabled: false, order: 0 }]), []);
  });
});
