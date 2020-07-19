import { HexagonMesh } from "../../mesh/HexagonMesh";
import { roundTo } from "../hexUtils";
import { mapBiome, mapAridityFromPrecipitation } from "./Maps";

const TEMP_DECREASE_PER_KM = 6.5;

export const BiomeAssigner = {
  assignBiomes: (hexMesh: HexagonMesh, tempAtSeaLevel: number) => {
    hexMesh.apply(m => {
      // use humidity + height to identify biome
      //
      const temperature = tempAtSeaLevel - roundTo(m.height / 1000 * TEMP_DECREASE_PER_KM, 2);
      const humidity = m.humidity.state;
      // convert 0-100% to an exponential curve from wettest to driest (0.125 - 32) - faking a number to classify aridity
      // const petRatio = Math.pow(2, (1 - humidity) * 8 - 3);
      // const aridity = mapAridityFromPetRatio(petRatio);
      const precipitation = m.river.sim.waterIn * 16000;
      const aridity = mapAridityFromPrecipitation(precipitation);
      m.biome = {
        temperature,
        humidity,
        precipitation,
        aridity,
        classification: mapBiome(temperature, aridity)
      };
    });
  }
};
