"use client";

import { useMemo } from "react";
import { ParticlesProvider } from "@tsparticles/react";
import ParticleCanvas from "./ParticleCanvas";

export default function ParticleNetwork() {
  const init = useMemo(
    () => async (engine: unknown) => {
      const { loadSlim } = await import("@tsparticles/slim");
      await loadSlim(engine as Parameters<typeof loadSlim>[0]);
    },
    []
  );

  return (
    <ParticlesProvider init={init}>
      <ParticleCanvas />
    </ParticlesProvider>
  );
}
