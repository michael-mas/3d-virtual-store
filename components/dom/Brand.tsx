/**
 * The house's name, set as its wordmark: "Maison" small above "Prisma Aurum" (two tiers, so it holds on a phone).
 */
export default function Brand({ size = "text-lg sm:text-xl", small = "text-[0.55rem] sm:text-[0.6rem]" }: { size?: string; small?: string }) {
  return (
    <span className="flex flex-col items-center leading-none">
      <span className={`wordmark mb-1.5 tracking-[0.6em] opacity-80 ${small}`}>Maison</span>
      <span className={`wordmark ${size}`}>Prisma Aurum</span>
    </span>
  );
}
