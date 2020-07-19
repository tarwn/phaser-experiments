# Procedural Terrain Example

This uses a combination of Voronoi and Hexagonal meshes to generate procedural terrain.

Simulation steps:

* Creates a Voronoi mesh
* Generates a starting heightmap using Open Simplex 2D noise
* Adds peaks (input) to map and adjusts heightmap based on falloff rate
* Creates a hexagonal mesh from Voronoi mesh
* Pre-calculates slopes to all neighboring mesh tiles
* Identities Ocean tiles vs Land
* Propagates wind from starting edge values (input) across map
* Calculates humidity + precipitation based on wind map, ocean tiles
* Calculates drainage and rivers from precipitation and heightmap
* Recalculates slopes to account for lakes
* Recalculates humidity/precipitation to account for lakes
* Recalculates river to account for precipitation changes
* Calculates biomes from temperation (input + heightmap) and precipitation
* Calculates a shadow + highlight map from heightmap + rivers/lakes

This currently takes about 15 seconds on my local machine, with the wind proporagation being one of the heavier steps.

## Examples

4 peaks, 6mps Eastern trade winds, average coastal temp of 18 ℃, plus some built in settings (4km max height, 1 pixel = 2km ratio, fixed evaporation + transpiration rates)

**Heightmap**

![Heightmap](./examples/HeightMap.PNG)

Lighter is higher, blue is ocean.

**Wind**

![Wind map](./examples/WindMap.PNG)

Arrows indicate direction. Force is indicated by size, color, and alpha of the arrow.

General Mechanics:

* Wind travels in the prevailing direction
* It slows and turns aside when it runs into upward sloping land
* It expands into lower pressure neighboring cells
* It speeds up as it goes down hill
* Some turbulence effects in cases wheer lots of inputs with different directions

**Shadow + Highlights**

![Shadow + Highlights](./examples/ShadowMap.PNG)

Added some shadow and highlighting to try and make the height more visible.


**Humidity Propagation**

![Humidity](./examples/HumidityMap.PNG)

* Ocean and lake cells evaporate
* Rivers evaporate a little less
* The wind carries humidity
* Some is lost as precipitation (but assumes an even amount gains as transpiration/evaporation)
* A lot is lost going uphill (drives precipitation)

_Note: this is the final map, after lakes and rivers were calculated (not currently visible)_

**Drainage**

![Drainage](./examples/DrainageMap.PNG)

* Precipitation from humidity map drives inputs for drainage
* Water flows to lowest neighboring cell as a river
* Water floods into lakes when it has nowhere to go, until it finds an outlet to create a new river or merges with a larger lake

**Rivers and Lakes**

![Rivers and Lakes](./examples/RiversAndLakes.PNG)

* Lakes have amount/height from the pooling function of drainage
* "Rivers" are any drainage path that carries more than a certain amount of water

_There's a lot more to do here, but I need to upsample the tiles first_

**Biome Precipitation Rates (land only rates)**

![Precipitation Rates](./examples/BiomePrecipitation.PNG)


**Biome Classifications**

![Biome Classifications](./examples/Biomes.PNG)

* Based on the [Holdridge Life Zones model](https://en.wikipedia.org/wiki/Holdridge_life_zones#/media/File:Lifezones_Pengo.svg), using Precipitation and Temperature
* Added some extra biomes where numbers didn't quite work
* Temperature is a calculation of coastal temperature + height (no isual map available)

**Example #2**

Starting with a different set of assumptions generates a different map.

7 peaks (mostly low), 6mps SSW trade winds, average coastal temp of 18 ℃, and a new seed for the randomizer:

![Second Example](./examples/Example2-DiffSeedMorePeaksDiffWind.PNG)

