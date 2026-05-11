-- Migration 0016: allow user_favorites to store both buy and rental listing IDs
--
-- buy listing IDs are small integers; rental listing IDs are large bigints
-- (e.g. 91914162500067) that overflow INTEGER and also don't exist in the
-- buy `listings` table, causing FK violations.
--
-- Fix: drop the FK constraint (JOINs remain correct because buy/rental IDs
-- don't overlap) and widen listing_id to TEXT so any ID fits.

-- 1. Drop FK to listings table if it exists
ALTER TABLE user_favorites DROP CONSTRAINT IF EXISTS user_favorites_listing_id_fkey;

-- 2. Widen column to TEXT (safe: existing integer values cast cleanly)
ALTER TABLE user_favorites ALTER COLUMN listing_id TYPE TEXT USING listing_id::text;
