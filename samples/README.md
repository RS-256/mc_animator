# Samples

These sample JSON files can be loaded directly into MC Animator.

## Basic samples

- `01_single_block.json` - A minimal scene with a single block
- `02_move_with_easing.json` - Block movement with `easing`
- `03_relative_tick_and_state.json` - `tick_mode: "relative"` and block state updates
- `04_appear_change_disappear.json` - A block that appears, changes, and disappears
- `05_camera_motion.json` - Camera position, look-at target, and FOV interpolation

## Showcase

- `all_tags_showcase.json` - A broader scene using all currently supported core tags

## Tags used in the showcase

- Root: `metadata`, `objects`
- `metadata`: `format_version`, `mc_version`, `resolution`, `fps`, `ticks_per_second`, `duration_ticks`, `background_color`, `active_camera`
- Object: `id`, `type`, `keyframes`
- Block keyframe: `tick`, `tick_mode`, `block`, `state`, `pos`, `multiplier`, `easing`
- Camera keyframe: `tick`, `tick_mode`, `pos`, `look_at`, `fov`, `easing`

Use `block: null` to hide a block object. `multiplier` scales the block around its center as an absolute side-length multiplier; omitted values inherit the previous keyframe's multiplier.
