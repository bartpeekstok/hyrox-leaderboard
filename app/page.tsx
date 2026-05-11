import Link from "next/link";
import Image from "next/image";

const PUBLIC_ONLY = process.env.NEXT_PUBLIC_PUBLIC_ONLY === "true";

const IconBase = ({ children }: { children: React.ReactNode }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.75}
    stroke="currentColor"
    className="w-9 h-9 text-cfa-blue"
  >
    {children}
  </svg>
);

const CalendarIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V11.25A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </IconBase>
);

const TrophyIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
  </IconBase>
);

const CogIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </IconBase>
);

const ClockIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </IconBase>
);

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
            <div className="mb-4"><CogIcon /></div>
            <h2 className="text-xl font-bold text-gray-900">Admin</h2>
          </Link>
        )}

        {!PUBLIC_ONLY && (
          <Link
            href="/race"
            className="group bg-white border border-gray-200 rounded-lg shadow-sm p-8 hover:shadow-md hover:border-cfa-blue/40 transition-all"
          >
            <div className="mb-4"><ClockIcon /></div>
            <h2 className="text-xl font-bold text-gray-900">Race Control</h2>
          </Link>
        )}

        <Link
          href="/startlijst"
          className="group bg-white border border-gray-200 rounded-lg shadow-sm p-8 hover:shadow-md hover:border-cfa-blue/40 transition-all"
        >
          <div className="mb-4"><CalendarIcon /></div>
          <h2 className="text-xl font-bold text-gray-900">Startlijst</h2>
        </Link>

        <Link
          href="/leaderboard"
          className="group bg-white border border-gray-200 rounded-lg shadow-sm p-8 hover:shadow-md hover:border-cfa-blue/40 transition-all"
        >
          <div className="mb-4"><TrophyIcon /></div>
          <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
        </Link>
      </div>
    </div>
  );
}
