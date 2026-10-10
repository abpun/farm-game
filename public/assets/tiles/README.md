# Terrain tilesets

One PNG per season (`terrain-spring.png`, `terrain-summer.png`, ...). The game loads these at
boot; edit them in any pixel editor and reload. `npm run tiles` regenerates them from the
procedural painter and **overwrites** your edits.

## Layout (800×200 px)

- Every cell is a 40×20 isometric diamond with a 2 px transparent gutter around it.
- **Rows** are terrains, drawn as stacked layers in this order:
  0 sea, 1 sand, 2 rock, 3 grass, 4 woods, 5 path, 6 river.
  Row 7 is the second animation frame of sea, row 8 the second frame of the river.
- **Columns 0–15** are corner masks. A tile's corners sit on grid cells:
  N (top) = 1, E (right) = 2, S (bottom) = 4, W (left) = 8. The cell for mask `m` shows the
  terrain on those corners and is transparent elsewhere (the layer below shows through).
  Column 15 is the plain, full tile; column 0 is unused.
- **Columns 16–18** are extra plain tiles the map mixes in so large areas do not repeat.
- Sea is the bottom layer and is never transparent: its mask marks which corners are water,
  and the rest of the diamond should be shallows/foam under the land drawn on top.
