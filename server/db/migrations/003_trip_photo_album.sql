-- Optional link to an external photo album (Google Photos, immich, …) shown
-- as a chip in the trip header. Validated server-side to http(s) only.
ALTER TABLE trips ADD COLUMN photo_album_url TEXT;
