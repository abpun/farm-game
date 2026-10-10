# Crop sheets

One PNG per crop (`<crop id>.png`, ids from `src/data/crops.json`). The game loads these at
boot; edit them in any pixel editor and reload. `npm run art -- crops` regenerates them from
the procedural painters and **overwrites** your edits.

## Layout

A single row of equal frames:

- **Frame 0** is the harvested produce. It becomes the crop's icon (trimmed to its pixels), so
  draw it anywhere in the frame.
- **Frames 1…n** are the growth stages (`stages` in crops.json), from sprout to ripe. The last
  frame is what the player harvests.

Frame size and ground point (where the plant meets the soil):

| Crop type                          | Frame | Ground point |
| ---------------------------------- | ----- | ------------ |
| Bed crops (carrot, wheat, ...)     | 20×32 | (10, 29)     |
| Orchard crops (apple, banana, ...) | 40×60 | (20, 50)     |

A garden bed shows four copies of a bed-crop frame in two furrows (two of them mirrored), so
draw one plant. An orchard plot shows the tree frame as is. Shadows are part of the art.
