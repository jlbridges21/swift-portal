-- Swift Portal V80 — per-business download gate (Delivered required)
-- Backfill every existing business to ON so unpaid projects stay locked.

DO $$
DECLARE
  v_before int;
  v_after int;
  v_off int;
BEGIN
  SELECT count(*) INTO v_before FROM business_settings;

  UPDATE business_settings
  SET
    settings = jsonb_set(
      COALESCE(settings, '{}'::jsonb),
      '{payments}',
      COALESCE(settings->'payments', '{}'::jsonb)
        || jsonb_build_object('requireDeliveredForDownloads', true)
    ),
    updated_at = now();

  INSERT INTO business_settings (business_id, settings, updated_at)
  SELECT
    b.id,
    jsonb_build_object(
      'payments',
      jsonb_build_object('requireDeliveredForDownloads', true)
    ),
    now()
  FROM businesses b
  WHERE NOT EXISTS (
    SELECT 1 FROM business_settings bs WHERE bs.business_id = b.id
  );

  SELECT count(*) INTO v_after FROM business_settings;

  SELECT count(*) INTO v_off
  FROM business_settings
  WHERE COALESCE((settings->'payments'->>'requireDeliveredForDownloads')::boolean, false) = false;

  IF v_off > 0 THEN
    RAISE EXCEPTION 'download gate backfill: % businesses still OFF', v_off;
  END IF;

  RAISE NOTICE 'download gate backfill: business_settings rows before % after % (all ON)', v_before, v_after;
END $$;
