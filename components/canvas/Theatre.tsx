"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { Group, Vector3, type WebGPURenderer } from "three/webgpu";
import { door } from "@/lib/explore/door";
import { player } from "@/lib/explore/player";
import { inGallery } from "@/lib/gallery/artworks";
import { aimFixture, buildFixtures } from "@/lib/gallery/beams";
import { applyPose, buildPerformers } from "@/lib/gallery/performers";
import { renderScore } from "@/lib/gallery/score";
import { cueAt, FIXTURES, MARKS, poseAt, POSES, SHOW_DURATION, STAGE_CENTER, STAGE_TOP, type Cue } from "@/lib/gallery/show";
import { show, showTime, stageUniforms as u, stopShow } from "@/lib/gallery/stage";
import { buildSwarm } from "@/lib/gallery/swarm";
import { isDebugEnabled } from "@/lib/debug";

const PALM = new Vector3(0, -0.06, 0);

/** Between performances: the automatons asleep in a dim top light, the swarm drifting and drawn to a visitor nearby. */
function idleCue(visitor: readonly [number, number]): Cue {
  const near = Math.max(0, 1 - Math.hypot(visitor[0] - STAGE_CENTER[0], visitor[1] - STAGE_CENTER[2]) / 5.5);
  return {
    house: 1,
    letterbox: 0,
    cyclo: { color: [0, 0, 0], level: 0 },
    beams: FIXTURES.map((_, i) => ({
      aim: [MARKS[Math.min(2, Math.floor(i / 2))][0], STAGE_TOP, MARKS[Math.min(2, Math.floor(i / 2))][1]],
      color: [1, 0.85, 0.65],
      intensity: i % 2 === 0 ? 0.22 : 0,
    })),
    swarm: { weights: [1, 0, 0, 0, 0], intensity: 0.3 + near * 0.3, color: [1, 0.72, 0.32], attract: near * 0.35 },
    rim: { color: [1, 0.7, 0.4], level: 0.25 },
    visor: 0.12,
    flash: 0,
  };
}

/**
 * The gallery's theatre: three automatons on the stage, six moving heads on the truss, the swarm of light, all driven
 * by the performance's score (lib/gallery/show.ts) while it plays, or resting between performances. Compiled in the
 * background before it joins the scene.
 */
export default function Theatre() {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const camera = useThree((s) => s.camera);
  const sceneRoot = useThree((s) => s.scene);
  const [compiled, setCompiled] = useState(false);

  const stage = useMemo(() => {
    const root = new Group();
    root.name = "theatre";
    const performers = buildPerformers();
    performers.forEach((p, i) => {
      applyPose(p.rig, POSES.rest, MARKS[i], STAGE_TOP);
      root.add(p.rig.root);
    });
    const fixtures = buildFixtures(FIXTURES);
    for (const f of fixtures) root.add(f.group, f.pool);
    const swarm = buildSwarm();
    root.add(swarm);
    return { root, performers, fixtures };
  }, []);

  useEffect(() => {
    let cancelled = false;
    gl.compileAsync(stage.root, camera, sceneRoot)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCompiled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [gl, camera, sceneRoot, stage]);

  useEffect(() => {
    // Debug-only: the show's state, and the score rendered offline (to listen to it and measure it).
    if (isDebugEnabled()) Object.assign(window, { __show: show, __renderScore: renderScore });
  }, []);

  useFrame(() => {
    if (show.playing && showTime() > SHOW_DURATION) stopShow();
    // Drawn only when the gallery can be seen.
    stage.root.visible = show.playing || inGallery(player.position) || door.amount > 0.01;
    if (!stage.root.visible) return;
    const visitor = player.position;
    const playing = show.playing && showTime() >= 0;
    const t = showTime();
    const cue = playing ? cueAt(t, visitor) : idleCue(visitor);

    stage.performers.forEach((p, i) => {
      const pose = playing ? poseAt(t, i, visitor) : { ...POSES.rest, lumbarX: POSES.rest.lumbarX + Math.sin(u.clock.value * 0.8 + i) * 0.015 };
      applyPose(p.rig, pose, MARKS[i], STAGE_TOP);
    });
    // The conductor's open hand, which the swarm flows to (between performances, the visitor draws it).
    const hand = stage.performers[1].rig.arms.right.wrist;
    hand.updateWorldMatrix(true, false);
    if (playing) u.swarmAttractor.value.copy(PALM).applyMatrix4(hand.matrixWorld);
    else u.swarmAttractor.value.set(visitor[0], STAGE_TOP + 1.3, Math.max(visitor[1], STAGE_CENTER[2] - 2.2));

    stage.fixtures.forEach((f, i) => aimFixture(f, cue.beams[i]));
    u.house.value = cue.house;
    u.cycloShow.value = playing ? 1 : 0;
    u.cycloColor.value.setRGB(...cue.cyclo.color);
    u.cycloLevel.value = cue.cyclo.level;
    u.rimColor.value.setRGB(...cue.rim.color);
    u.rimLevel.value = cue.rim.level;
    u.visorLevel.value = cue.visor;
    const visor = playing ? cue.rim.color : [1, 0.8, 0.5];
    u.visorColor.value.setRGB(visor[0], visor[1], visor[2]);
    const [cloud, ring, helix, sphere, rain] = cue.swarm.weights;
    u.swarmWeights.value.set(cloud, ring, helix, sphere);
    u.swarmRain.value = rain;
    u.swarmIntensity.value = cue.swarm.intensity;
    u.swarmColor.value.setRGB(...cue.swarm.color);
    u.swarmAttract.value = cue.swarm.attract;
  });

  return compiled ? <primitive object={stage.root} /> : null;
}
