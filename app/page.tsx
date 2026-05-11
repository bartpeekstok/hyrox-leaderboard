import Link from "next/link";
import Image from "next/image";

const PUBLIC_ONLY = process.env.NEXT_PUBLIC_PUBLIC_ONLY === "true";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-200">
      <div className="text-center mb-12">
        <Image
          src="/logo_dark.png"
          alt="CrossFit Alkmaar"
          width={200}
          height={100}
          className="mx-auto mb-6"
          priority
        />
        <h1 className="text-5xl font-bold mb-2 tracking-tight text-gray-900">
          HYROX <span className="text-cfa-blue">RACE SIMULATION</span>
        </h1>
        <p className="text-xl text-gray-600 mt-4">
          Zaterdag 30 mei 2026 &mdash; CrossFit Alkmaar
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
            className="group bg-white border border-gray-200 rounded-lg shadow-sm p-8 hover:shadow-md hover:border-cfa-blue/40 transition-all"
          >
            <div className="text-3xl mb-4">&#9881;</div>
            <h2 className="text-xl font-bold text-gray-900">Admin</h2>
          </Link>
        )}

        {!PUBLIC_ONLY && (
          <Link
            href="/race"
            className="group bg-white border border-gray-200 rounded-lg shadow-sm p-8 hover:shadow-md hover:border-cfa-blue/40 transition-all"
          >
            <div className="text-3xl mb-4">&#9201;</div>
            <h2 className="text-xl font-bold text-gray-900">Race Control</h2>
          </Link>
        )}

        <Link
          href="/startlijst"
          className="group bg-white border border-gray-200 rounded-lg shadow-sm p-8 hover:shadow-md hover:border-cfa-blue/40 transition-all"
        >
          <div className="text-3xl mb-4">&#128197;</div>
          <h2 className="text-xl font-bold text-gray-900">Startlijst</h2>
        </Link>

        <Link
          href="/leaderboard"
          className="group bg-white border border-gray-200 rounded-lg shadow-sm p-8 hover:shadow-md hover:border-cfa-blue/40 transition-all"
        >
          <div className="text-3xl mb-4">&#127942;</div>
          <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
        </Link>
      </div>
    </div>
  );
}
