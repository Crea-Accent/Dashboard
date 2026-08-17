/** @format */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function loadProjectsSettings() {
  const DATA_DIR = path.join(process.cwd(), "data");
  const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");
  const raw = fs.readFileSync(PROJECTS_PATH, "utf8");
  return JSON.parse(raw);
}

export async function GET(request: NextRequest) {
  try {
    const client = request.nextUrl.searchParams.get("client");
    if (!client)
      return NextResponse.json({ error: "Missing client" }, { status: 400 });

    const settings = loadProjectsSettings();
    const solarPath = path.resolve(
      process.cwd(),
      settings.path,
      client,
      "solar.json",
    );

    if (fs.existsSync(solarPath)) {
      const data = JSON.parse(fs.readFileSync(solarPath, "utf8"));
      return NextResponse.json(data);
    }

    // Fallback to metadata.json's solar if it exists for backwards compatibility
    const metadataPath = path.resolve(
      process.cwd(),
      settings.path,
      client,
      "metadata.json",
    );
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      if (metadata.solar) return NextResponse.json(metadata.solar);
    }

    return NextResponse.json(null);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load solar data" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { client, data } = await request.json();
    if (!client || !data)
      return NextResponse.json(
        { error: "Missing client or data" },
        { status: 400 },
      );

    const settings = loadProjectsSettings();
    const solarPath = path.resolve(
      process.cwd(),
      settings.path,
      client,
      "solar.json",
    );

    fs.writeFileSync(solarPath, JSON.stringify(data, null, "\t"));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to save solar data" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();

    if (!lat || !lng) {
      return NextResponse.json(
        {
          error: "Missing coordinates",
        },
        {
          status: 400,
        },
      );
    }

    const response = await fetch(
      `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=HIGH`,
      {
        headers: {
          "X-Goog-Api-Key": process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            response.status === 404
              ? "No solar data available for this location"
              : "Solar API request failed",
        },
        {
          status: response.status,
        },
      );
    }

    const data = await response.json();

    const potential = data.solarPotential;

    function getDirection(azimuth: number) {
      if (azimuth >= 337.5 || azimuth < 22.5) return "North";
      if (azimuth < 67.5) return "North-East";
      if (azimuth < 112.5) return "East";
      if (azimuth < 157.5) return "South-East";
      if (azimuth < 202.5) return "South";
      if (azimuth < 247.5) return "South-West";
      if (azimuth < 292.5) return "West";
      return "North-West";
    }

    const configs = potential.solarPanelConfigs ?? [];

    const bestYield =
      configs.length > 0
        ? configs[0].yearlyEnergyDcKwh / configs[0].panelsCount
        : 0;

    let recommended = configs[0];

    for (const config of configs) {
      const yieldPerPanel = config.yearlyEnergyDcKwh / config.panelsCount;

      if (yieldPerPanel >= bestYield * 0.95) {
        recommended = config;
      } else {
        break;
      }
    }

    const maximum = configs.at(-1);

    return NextResponse.json({
      recommended: {
        panelsCount: recommended?.panelsCount ?? 0,
        yearlyEnergyDcKwh: recommended?.yearlyEnergyDcKwh ?? 0,
      },

      maximum: {
        panelsCount: maximum?.panelsCount ?? 0,
        yearlyEnergyDcKwh: maximum?.yearlyEnergyDcKwh ?? 0,
      },

      configs: configs.map((config: any) => ({
        panelsCount: config.panelsCount,
        yearlyEnergyDcKwh: config.yearlyEnergyDcKwh,
        roofSegmentSummaries: config.roofSegmentSummaries,
      })),

      segments: (potential.roofSegmentStats ?? []).map(
        (segment: any, index: number) => ({
          index,
          direction: getDirection(segment.azimuthDegrees),
          pitch: segment.pitchDegrees,
          azimuth: segment.azimuthDegrees,
          area: segment.stats?.areaMeters2 ?? 0,
        }),
      ),

      roofArea: potential.wholeRoofStats?.areaMeters2 ?? 0,

      maxSunshineHoursPerYear: potential.maxSunshineHoursPerYear,

      panelCapacityWatts: potential.panelCapacityWatts,

      solarPanels: potential.solarPanels ?? [],

      imageryDate: data.imageryDate,
      imageryQuality: data.imageryQuality,
      imageryProcessedDate: data.imageryProcessedDate,

      raw: data,

      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to analyze roof",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const client = request.nextUrl.searchParams.get("client");
    if (!client)
      return NextResponse.json({ error: "Missing client" }, { status: 400 });

    const settings = loadProjectsSettings();
    const solarPath = path.resolve(
      process.cwd(),
      settings.path,
      client,
      "solar.json",
    );

    if (fs.existsSync(solarPath)) {
      fs.unlinkSync(solarPath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete solar data" },
      { status: 500 },
    );
  }
}
