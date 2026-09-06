"use client";

import { useMemo } from "react";
import Particles from "@tsparticles/react";
import { useParticlesProvider } from "@tsparticles/react";

export default function ParticleCanvas() {
  const { loaded } = useParticlesProvider();

  const options = useMemo(
    () => ({
      fullScreen: false,
      fpsLimit: 60,
      particles: {
        number: {
          value: 55,
          density: { enable: true, width: 1200, height: 800 },
        },
        color: { value: "#f59e0b" },
        opacity: {
          value: { min: 0.08, max: 0.2 },
          animation: {
            enable: true,
            speed: 0.5,
            sync: false,
          },
        },
        size: {
          value: { min: 1, max: 2.5 },
        },
        links: {
          enable: true,
          distance: 160,
          color: "#f59e0b",
          opacity: 0.07,
          width: 1,
        },
        move: {
          enable: true,
          speed: 0.4,
          direction: "none" as const,
          random: true,
          straight: false,
          outModes: { default: "out" as const },
        },
      },
      interactivity: {
        events: {
          onHover: {
            enable: true,
            mode: "grab",
          },
        },
        modes: {
          grab: {
            distance: 180,
            links: {
              opacity: 0.15,
              color: "#fbbf24",
            },
          },
        },
      },
      detectRetina: true,
    }),
    []
  );

  if (!loaded) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Particles
        id="hero-particles"
        options={options}
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: "auto",
        }}
      />
    </div>
  );
}
