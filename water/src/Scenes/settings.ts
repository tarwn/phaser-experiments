

export const WIDTH = 600;
export const HEIGHT = 600;
export const SCALE = 4; // how much scale to apply to tile x/y when calculating slope/accel
export const NOISE_SCALE = 1;
export const SEED = "abc";
// const DIM = { x: 256, y: 256 };
export const DIM = { x: 256, y: 256 };
export const TILE_SIZE = 4;
export const MAX_HEIGHT = 200;
// how much height does 1 drop add to a tile if it pools
export const DROP_VOLUME_TO_HEIGHT_FACTOR = 1;
// how much sediment can wash away rom a single tile as drop moves
export const SEDIMENT_EROSION_AS_HEIGHT_FACTOR = 0.18;
// how many drops to generate
export const LOOP_COUNT = 20000;
// frequency to log output - larger is less frequenct is faster
export const LOOP_LOG_COUNT = 100;
// frequency to update graphics
export const LOOP_GRAPHICS_COUNT = 100;
