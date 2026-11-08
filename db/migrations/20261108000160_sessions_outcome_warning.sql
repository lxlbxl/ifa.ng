-- The consultation outcome form (SessionOutcomeModal) and the Babalawo consultation
-- queries read/write sessions.warning, but no earlier migration ever created it, so
-- recording an outcome failed with "column warning does not exist".
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS warning text;
