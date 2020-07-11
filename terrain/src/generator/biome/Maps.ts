import { Aridity, BiomeClassification } from "../../mesh/types";

export const mapBiome = (temperature: number, aridity: Aridity) => {
  const getException = (temperature: number, aridity: Aridity) => {
    if (temperature <= 0) {
      return BiomeClassification.PolarIce;
    }
    else if (temperature > 0 && aridity >= Aridity.SemiArid) {
      return BiomeClassification.MiscAridDesert;
    }
    else {
      return BiomeClassification.Unknown;
    }
  };

  switch (aridity) {
    case Aridity.SuperHumid:
      if (temperature >= 24) {
        return BiomeClassification.TropicalRainForest;
      }
      else if (temperature >= 18) {
        return BiomeClassification.SubtropicalRainForest;
      }
      else if (temperature >= 12) {
        return BiomeClassification.WarmTemperateRainForest;
      }
      else if (temperature >= 6) {
        return BiomeClassification.CoolTemperateRainForest;
      }
      else if (temperature >= 3) {
        return BiomeClassification.BorealRainForest;
      }
      else if (temperature >= 1.5) {
        return BiomeClassification.SubpolarRainTundra;
      }
      else {
        return BiomeClassification.PolarDesert;
      }
    case Aridity.PerHumid:
      if (temperature >= 24) {
        return BiomeClassification.TropicalWetForest;
      }
      else if (temperature >= 18) {
        return BiomeClassification.SubtropicalWetForest;
      }
      else if (temperature >= 12) {
        return BiomeClassification.WarmTemperateWetForest;
      }
      else if (temperature >= 6) {
        return BiomeClassification.CoolTemperateWetForest;
      }
      else if (temperature >= 3) {
        return BiomeClassification.BorealWetForest;
      }
      else if (temperature >= 1.5) {
        return BiomeClassification.SubpolarWetTundra;
      }
      else {
        return BiomeClassification.PolarDesert;
      }
    case Aridity.Humid:
      if (temperature >= 24) {
        return BiomeClassification.TropicalMoistForest;
      }
      else if (temperature >= 18) {
        return BiomeClassification.SubtropicalMoistForest;
      }
      else if (temperature >= 12) {
        return BiomeClassification.WarmTemperateMoistForest;
      }
      else if (temperature >= 6) {
        return BiomeClassification.CoolTemperateMoistForest;
      }
      else if (temperature >= 3) {
        return BiomeClassification.BorealMoistForest;
      }
      else if (temperature >= 1.5) {
        return BiomeClassification.SubpolarMoistTundra;
      }
      else {
        return BiomeClassification.PolarDesert;
      }
    case Aridity.SubHumid:
      if (temperature >= 24) {
        return BiomeClassification.TropicalDryForest;
      }
      else if (temperature >= 18) {
        return BiomeClassification.SubtropicalDryForest;
      }
      else if (temperature >= 12) {
        return BiomeClassification.WarmTemperateDryForest;
      }
      else if (temperature >= 6) {
        return BiomeClassification.CoolTemperateSteppe;
      }
      else if (temperature >= 3) {
        return BiomeClassification.BorealDryScrub;
      }
      else if (temperature >= 1.5) {
        return BiomeClassification.SubpolarDryTundra;
      }
      else {
        return getException(temperature, aridity);
        return BiomeClassification.Unknown;
      }
    case Aridity.SemiArid:
      if (temperature >= 24) {
        return BiomeClassification.TropicalVeryDryForest;
      }
      else if (temperature >= 18) {
        return BiomeClassification.SubtropicalThornWoodland;
      }
      else if (temperature >= 12) {
        return BiomeClassification.WarmTemperateThornScrub;
      }
      else if (temperature >= 6) {
        return BiomeClassification.CoolTemperateDesertScrub;
      }
      else if (temperature >= 3) {
        return BiomeClassification.BorealDesert;
      }
      else {
        return getException(temperature, aridity);
        return BiomeClassification.Unknown;
      }
    case Aridity.Arid:
      if (temperature >= 24) {
        return BiomeClassification.TropicalThornWoodland;
      }
      else if (temperature >= 18) {
        return BiomeClassification.SubtropicalDesertScrub;
      }
      else if (temperature >= 12) {
        return BiomeClassification.WarmTemperateDesertScrub;
      }
      else if (temperature >= 6) {
        return BiomeClassification.CoolTemperateDesert;
      }
      else {
        return getException(temperature, aridity);
        return BiomeClassification.Unknown;
      }
    case Aridity.Arid:
      if (temperature >= 24) {
        return BiomeClassification.TropicalThornWoodland;
      }
      else if (temperature >= 18) {
        return BiomeClassification.SubtropicalDesertScrub;
      }
      else if (temperature >= 12) {
        return BiomeClassification.WarmTemperateDesertScrub;
      }
      else if (temperature >= 6) {
        return BiomeClassification.CoolTemperateDesert;
      }
      else {
        return getException(temperature, aridity);
        return BiomeClassification.Unknown;
      }
    case Aridity.PerArid:
      if (temperature >= 24) {
        return BiomeClassification.TropicalDesertScrub;
      }
      else if (temperature >= 18) {
        return BiomeClassification.SubtropicalDesert;
      }
      else if (temperature >= 12) {
        return BiomeClassification.WarmTemperateDesert;
      }
      else {
        return getException(temperature, aridity);
        return BiomeClassification.Unknown;
      }
    case Aridity.SuperArid:
      if (temperature >= 24) {
        return BiomeClassification.TropicalDesert;
      }
      else if (temperature >= 18) {
        return BiomeClassification.SubtropicalDesert;
      }
      else {
        return getException(temperature, aridity);
        return BiomeClassification.Unknown;
      }
  }

  return BiomeClassification.Unknown;
};

export const mapAridityFromPetRatio = (petRatio: number) => {
  if (petRatio <= 0.25) {
    return Aridity.SuperHumid;
  }
  else if (petRatio <= 0.5) {
    return Aridity.PerHumid;
  }
  else if (petRatio <= 1) {
    return Aridity.Humid;
  }
  else if (petRatio <= 2) {
    return Aridity.SubHumid;
  }
  else if (petRatio <= 4) {
    return Aridity.SemiArid;
  }
  else if (petRatio <= 8) {
    return Aridity.Arid;
  }
  else if (petRatio <= 16) {
    return Aridity.PerArid;
  }
  else {
    return Aridity.SuperArid;
  }
};


export const mapAridityFromPrecipitation = (precipitation: number) => {
  if (precipitation > 8000) {
    return Aridity.SuperHumid;
  }
  else if (precipitation > 4000) {
    return Aridity.PerHumid;
  }
  else if (precipitation > 2000) {
    return Aridity.Humid;
  }
  else if (precipitation > 1000) {
    return Aridity.SubHumid;
  }
  else if (precipitation > 500) {
    return Aridity.SemiArid;
  }
  else if (precipitation > 250) {
    return Aridity.Arid;
  }
  else if (precipitation > 125) {
    return Aridity.PerArid;
  }
  else {
    return Aridity.SuperArid;
  }
};


const biomeColorMap = new Map<BiomeClassification, string>(
  [
    [BiomeClassification.Unknown, "000000"],
    [BiomeClassification.PolarIce, "FFFFFF"],
    [BiomeClassification.MiscAridDesert, "FFFFA0"],

    [BiomeClassification.PolarDesert, "C0C0C0"],
    [BiomeClassification.SubpolarMoistTundra, "608080"],
    [BiomeClassification.SubpolarWetTundra, "408080"],
    [BiomeClassification.SubpolarRainTundra, "2080C0"],
    [BiomeClassification.SubpolarDryTundra, "808080"],
    [BiomeClassification.BorealDesert, "A0A080"],
    [BiomeClassification.BorealDryScrub, "80A080"],
    [BiomeClassification.BorealMoistForest, "60A080"],
    [BiomeClassification.BorealWetForest, "40A090"],
    [BiomeClassification.BorealRainForest, "20A0C0"],
    [BiomeClassification.CoolTemperateMoistForest, "60C080"],
    [BiomeClassification.CoolTemperateWetForest, "40C090"],
    [BiomeClassification.CoolTemperateRainForest, "20C0C0"],
    [BiomeClassification.CoolTemperateSteppe, "80C080"],
    [BiomeClassification.CoolTemperateDesert, "C0C080"],
    [BiomeClassification.CoolTemperateDesertScrub, "A0C080"],
    [BiomeClassification.WarmTemperateMoistForest, "60E080"],
    [BiomeClassification.WarmTemperateWetForest, "40E090"],
    [BiomeClassification.WarmTemperateRainForest, "20E0C0"],
    [BiomeClassification.WarmTemperateThornScrub, "A0E080"],
    [BiomeClassification.WarmTemperateDryForest, "80E080"],
    [BiomeClassification.WarmTemperateDesert, "E0E080"],
    [BiomeClassification.WarmTemperateDesertScrub, "C0E080"],
    [BiomeClassification.SubtropicalDesert, "F0F080"],
    [BiomeClassification.SubtropicalDesertScrub, "D0F080"],
    [BiomeClassification.TropicalDesert, "FFFF80"],
    [BiomeClassification.TropicalDesertScrub, "E0FF80"],
    [BiomeClassification.SubtropicalThornWoodland, "B0F080"],
    [BiomeClassification.TropicalThornWoodland, "C0FF80"],
    [BiomeClassification.TropicalVeryDryForest, "A0FF80"],
    [BiomeClassification.SubtropicalDryForest, "80FF80"],
    [BiomeClassification.SubtropicalMoistForest, "60FF80"],
    [BiomeClassification.SubtropicalWetForest, "40F090"],
    [BiomeClassification.SubtropicalRainForest, "20F0B0"],
    [BiomeClassification.TropicalMoistForest, "60FF80"],
    [BiomeClassification.TropicalWetForest, "40FF90"],
    [BiomeClassification.TropicalRainForest, "20FFA0"],
  ]
);

export const mapBiomeToColor = (biome?: BiomeClassification): string => {
  if (biome !== undefined) {
    if (biomeColorMap.has(biome)) {
      return biomeColorMap.get(biome)!;
    }
    else {
      throw new Error("Biome missing from color map: " + BiomeClassification[biome]);
    }
  }
  else {
    return biomeColorMap.get(BiomeClassification.Unknown)!;
  }
};
