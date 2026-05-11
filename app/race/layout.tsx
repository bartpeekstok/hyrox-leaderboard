import AdminGate from "../components/AdminGate";

export default function RaceLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
