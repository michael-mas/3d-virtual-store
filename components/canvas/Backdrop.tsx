"use client";

/** Minimal store set: a display pedestal for the product and a few background fixtures. */
export default function Backdrop() {
  return (
    <group>
      {/* Pedestal top at y = -0.024, where the glasses rest. */}
      <mesh position={[0, -0.537, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 1.026, 48]} />
        <meshStandardNodeMaterial color="#a8a29e" roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
        <circleGeometry args={[6, 64]} />
        <meshStandardNodeMaterial color="#292524" roughness={0.9} />
      </mesh>
      {[-1, 1].map((x) => (
        <group key={x} position={[x, 0, -1.6]}>
          <mesh position={[0, -0.6, 0]}>
            <boxGeometry args={[0.35, 0.9, 0.35]} />
            <meshStandardNodeMaterial color="#a8a29e" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.08, 0]}>
            <torusKnotGeometry args={[0.07, 0.022, 96, 12]} />
            <meshStandardNodeMaterial color={x < 0 ? "#6366f1" : "#f59e0b"} roughness={0.3} metalness={0.4} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.9, -3.2]}>
        <planeGeometry args={[14, 4]} />
        <meshStandardNodeMaterial color="#44403c" roughness={1} />
      </mesh>
    </group>
  );
}
