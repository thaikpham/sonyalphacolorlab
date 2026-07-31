-- Adds 'preset' to wb_mode. Nothing uses it yet — 0006 does.
--
-- This is one statement in its own file on purpose. Postgres refuses to *use* a
-- new enum label in the same transaction that added it ("unsafe use of new
-- value ... of enum type"), and the migration runner executes one file per
-- transaction. Merging this into 0006 fails against both PGlite and Supabase.
--
-- 0001 modelled White Balance as Kelvin-or-Auto, which covered every migrated
-- Picture Profile recipe. The Sony Asia Creative Look recipes use the third
-- branch of the same camera menu: a named light source ("WB Daylight",
-- "WB Cloudy A1.5, M0.5"), which takes a shift like the others but carries no
-- Kelvin number of its own.

alter type wb_mode add value if not exists 'preset';
