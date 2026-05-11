import Link from "next/link";
import Image from "next/image";

const PUBLIC_ONLY = process.env.NEXT_PUBLIC_PUBLIC_ONLY === "true";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <Image
          src="/logo-hyrox.png"
          alt="CrossFit Alkmaar"
          width={200}
          height={100}
          className="mx-auto mb-6"
          priority
        />
        <h1 className="text-5xl font-bold mb-2 tracking-tight">
          HYROX <span className="text-cfa-yellow">RACE SIMULATION</span>
        </h1>
        <p className="text-xl text-gray-400 mt-4">
          Zaterdag 30 mei 2026 - CrossFit Alkmaar
        </p>
      </div>

      <div
        className={`grid grid-cols-1 ${
          PUBLIC_ONLY ? "md:grid-cols-2 max-w-2xl" : "md:grid-cols-4 max-w-5xl"
        } gap-6 w-full`}
      >
        {!PUBLIC_ONLY && (
          <Link
            href="/admin"
            className="group bg-cfa-navy/80 border border-white/10 rounded-2xl p-8 hover:border-cfa-blue/50 transition-all hover:scale-[1.02]"
          >
            <div className="text-3xl mb-4">&#9881;</div>
            <h2 className="text-xl font-bold">Admin</h2>
          </Link>
        )}

        {!PUBLIC_ONLY && (
          <Link
            href="/race"
            className="group bg-cfa-navy/80 border border-white/10 rounded-2xl p-8 hover:border-cfa-yellow/50 transition-all hover:scale-[1.02]"
          >
            <div className="text-3xl mb-4">&#9201;</div>
            <h2 className="text-xl font-bold">Race Control</h2>
          </Link>
        )}

        <Link
          href="/startlijst"
          className="group bg-cfa-navy/80 border border-white/10 rounded-2xl p-8 hover:border-cfa-yellow/50 transition-all hover:scale-[1.02]"
        >
          <div className="text-3xl mb-4">&#128197;</div>
          <h2 className="text-xl font-bold">Startlijst</h2>
        </Link>

        <Link
          href="/leaderboard"
          className="group bg-cfa-navy/80 border border-white/10 rounded-2xl p-8 hover:border-cfa-green/50 transition-all hover:scale-[1.02]"
        >
          <div className="text-3xl mb-4">&#127942;</div>
          <h2 className="text-xl font-bold">Leaderboard</h2>
        </Link>
      </div>
    </div>
  );
}
