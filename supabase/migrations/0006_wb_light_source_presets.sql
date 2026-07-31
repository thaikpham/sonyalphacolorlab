-- The wb_preset column, and the three-way consistency check that replaces
-- 0001's two-way one. Depends on 0005 having committed 'preset' into wb_mode.
--
-- Preset list and menu order: ILCE-7M4 help guide, "White Balance
-- (still image/movie)"
-- https://helpguide.sony.net/ilc/2110/v1/en/contents/TP1000640840.html
--
-- Mirrors WB_PRESETS in src/lib/camera/constants.ts. Defence in depth, and
-- sql-drift.test.ts fails if the two lists stop agreeing.
--
-- Custom 1-3 are excluded on purpose — they replay a white card measured in one
-- photographer's room and cannot be reproduced by a reader, so they are not a
-- shareable recipe value.

alter table recipes
  add column if not exists wb_preset text
    check (wb_preset in (
      'Daylight',
      'Shade',
      'Cloudy',
      'Incandescent',
      'Fluor.: Warm White',
      'Fluor.: Cool White',
      'Fluor.: Day White',
      'Fluor.: Daylight',
      'Flash',
      'Underwater Auto'
    ));

alter table recipes drop constraint if exists recipes_wb_mode_consistent;

-- Exactly one of kelvin / auto / preset is set, and it must be the one wb_mode
-- names.
alter table recipes add constraint recipes_wb_mode_consistent check (
  (wb_mode = 'kelvin' and wb_kelvin is not null and wb_auto is null   and wb_preset is null) or
  (wb_mode = 'auto'   and wb_auto   is not null and wb_kelvin is null and wb_preset is null) or
  (wb_mode = 'preset' and wb_preset is not null and wb_kelvin is null and wb_auto is null)
);

comment on column recipes.wb_preset is
  'Light-source preset, e.g. Daylight / Cloudy / Underwater Auto. Null unless wb_mode = ''preset''.';
