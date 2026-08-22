import * as XLSX from "xlsx";
import { Participant, Heat, getClassLabel } from "./types";

// Genereert client-side een Excel-bestand van de startlijst.
// Leest alleen data — schrijft niets terug naar de database.
export function exportStartlistToExcel(
  participants: Participant[],
  heats: Heat[],
  raceDate: string
) {
  const participantById = new Map(participants.map((p) => [p.id, p]));

  const rows: {
    Heat: number | string;
    Starttijd: string;
    Startnummer: number;
    Naam: string;
    Divisie: string;
  }[] = [];

  const sortedHeats = [...heats].sort((a, b) => a.heatNumber - b.heatNumber);
  const assigned = new Set<string>();

  for (const heat of sortedHeats) {
    const heatParticipants = heat.participantIds
      .map((id) => participantById.get(id))
      .filter((p): p is Participant => Boolean(p))
      .sort((a, b) => a.startNumber - b.startNumber);

    for (const p of heatParticipants) {
      assigned.add(p.id);
      rows.push({
        Heat: heat.heatNumber,
        Starttijd: heat.scheduledTime,
        Startnummer: p.startNumber,
        Naam: p.partnerName ? `${p.name} & ${p.partnerName}` : p.name,
        Divisie: getClassLabel(p),
      });
    }
  }

  // Deelnemers zonder heat onderaan, zodat de export compleet is
  const unassigned = participants
    .filter((p) => !assigned.has(p.id))
    .sort((a, b) => a.startNumber - b.startNumber);

  for (const p of unassigned) {
    rows.push({
      Heat: "",
      Starttijd: "",
      Startnummer: p.startNumber,
      Naam: p.partnerName ? `${p.name} & ${p.partnerName}` : p.name,
      Divisie: getClassLabel(p),
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["Heat", "Starttijd", "Startnummer", "Naam", "Divisie"],
  });
  worksheet["!cols"] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 12 },
    { wch: 40 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Startlijst");
  XLSX.writeFile(workbook, `startlijst-${raceDate}.xlsx`);
}
