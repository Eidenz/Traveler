const router = require('express').Router();
const { db } = require('../db/database');
const { getFallbackImageUrl } = require('../utils/ssrUtils');

// GET /api/oembed?url=...&format=json
// oEmbed endpoint for Traveler resources (trips)
router.get('/', (req, res) => {
  try {
    const { url, format } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'url parameter is required' });
    }

    if (format && format !== 'json') {
      return res.status(501).json({ error: 'Only JSON format is supported' });
    }

    // Parse the URL to identify the resource
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Match /trips/:tripId
    const tripMatch = parsedUrl.pathname.match(/^\/trips\/([^/]+)$/);
    // Match /trip/public/:token
    const publicTripMatch = parsedUrl.pathname.match(/^\/trip\/public\/([^/]+)$/);

    // Derive baseUrl from the url param's origin to ensure correct protocol
    // behind reverse proxies (req.protocol may be 'http' even when accessed via HTTPS)
    const baseUrl = parsedUrl.origin;

    if (tripMatch) {
      const tripId = tripMatch[1];
      return handleTrip(res, tripId, url, baseUrl);
    }

    if (publicTripMatch) {
      const token = publicTripMatch[1];
      return handlePublicTrip(res, token, url, baseUrl);
    }

    return res.status(404).json({ error: 'Resource not found' });
  } catch (err) {
    console.error('oEmbed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function handleTrip(res, tripId, originalUrl, baseUrl) {
  const trip = db.prepare(`
    SELECT t.id, t.name, t.description, t.location, t.start_date, t.end_date, t.cover_image,
      (SELECT COUNT(*) FROM trip_members WHERE trip_id = t.id) as member_count,
      (SELECT COUNT(*) FROM activities WHERE trip_id = t.id) as activity_count
    FROM trips t WHERE t.id = ?
  `).get(tripId);

  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  return res.json(buildTripOEmbed(trip, originalUrl, baseUrl));
}

function handlePublicTrip(res, token, originalUrl, baseUrl) {
  const trip = db.prepare(`
    SELECT t.id, t.name, t.description, t.location, t.start_date, t.end_date, t.cover_image,
      (SELECT COUNT(*) FROM trip_members WHERE trip_id = t.id) as member_count,
      (SELECT COUNT(*) FROM activities WHERE trip_id = t.id) as activity_count
    FROM trips t WHERE t.public_share_token = ?
  `).get(token);

  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  return res.json(buildTripOEmbed(trip, originalUrl, baseUrl));
}

function buildTripOEmbed(trip, originalUrl, baseUrl) {

  let thumbnailUrl = getFallbackImageUrl('trip');
  if (trip.cover_image) {
    thumbnailUrl = trip.cover_image.startsWith('http')
      ? trip.cover_image
      : `${baseUrl}${trip.cover_image}`;
  }

  const description = trip.description
    || `A trip to ${trip.location || 'an amazing place'}`;

  return {
    version: '1.0',
    type: 'rich',
    provider_name: 'Traveler',
    provider_url: baseUrl,
    provider_icon: `${baseUrl}/favicon.svg`,
    title: trip.name,
    description: description.substring(0, 200),
    author_name: null,
    thumbnail_url: thumbnailUrl,
    thumbnail_width: 800,
    thumbnail_height: 400,
    x_app: {
      app_type: 'traveler',
      resource_type: 'trip',
      color: '#10b981',
      data: {
        location: trip.location || null,
        start_date: trip.start_date || null,
        end_date: trip.end_date || null,
        member_count: trip.member_count || 0,
        activity_count: trip.activity_count || 0
      }
    }
  };
}

module.exports = router;
