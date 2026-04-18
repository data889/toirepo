-- Spatial index for fast geographic queries on Toilet.location (PostGIS GiST)
CREATE INDEX IF NOT EXISTS toilet_location_idx
  ON "Toilet"
  USING GIST (location);

-- Trigger: keep "location" in sync with "latitude" / "longitude".
-- Application code writes latitude/longitude only; location is maintained
-- here so that PostGIS spatial queries and the Unsupported type stay
-- consistent without requiring raw SQL from the application layer.
CREATE OR REPLACE FUNCTION update_toilet_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(
    ST_MakePoint(NEW.longitude, NEW.latitude),
    4326
  )::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS toilet_location_trigger ON "Toilet";

CREATE TRIGGER toilet_location_trigger
  BEFORE INSERT OR UPDATE OF latitude, longitude ON "Toilet"
  FOR EACH ROW
  EXECUTE FUNCTION update_toilet_location();
