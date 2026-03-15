import { useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaExclamationCircle,
  FaRegClock,
  FaTrash,
  FaEye,
} from "react-icons/fa";

interface Complaint {
  id: string;
  title: string;
  description: string;
  status: "Open" | "Resolved";
  priority: "Low" | "Medium" | "High";
  date: string;
  reporter: string;
}

const initialComplaints: Complaint[] = [
  {
    id: "CMP-1001",
    title: "Bus AC not working",
    description:
      "Passenger reported AC malfunction on route 115 during afternoon trip.",
    status: "Open",
    priority: "High",
    date: "2026-03-10",
    reporter: "Amaya Perera",
  },
  {
    id: "CMP-1002",
    title: "Late departure",
    description:
      "Bus departed 20 minutes late from the main station this morning.",
    status: "Open",
    priority: "Medium",
    date: "2026-03-12",
    reporter: "Kavindu Silva",
  },
  {
    id: "CMP-1003",
    title: "Dirty seats",
    description:
      "Seats were not cleaned properly after previous trip.",
    status: "Resolved",
    priority: "Low",
    date: "2026-03-08",
    reporter: "Nimali Fernando",
  },
];

const statusPill = (status: Complaint["status"]) =>
  status === "Resolved"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";

const priorityPill = (priority: Complaint["priority"]) => {
  if (priority === "High") return "bg-rose-100 text-rose-600";
  if (priority === "Medium") return "bg-sky-100 text-sky-600";
  return "bg-slate-100 text-slate-600";
};

function Complaints() {
  const [complaints, setComplaints] = useState(initialComplaints);
  const [filter, setFilter] = useState<"All" | "Open" | "Resolved">("All");
  const [selected, setSelected] = useState<Complaint | null>(null);

  const filteredComplaints = useMemo(() => {
    if (filter === "All") return complaints;
    return complaints.filter((item) => item.status === filter);
  }, [complaints, filter]);

  const handleToggleStatus = (id: string) => {
    setComplaints((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "Open" ? "Resolved" : "Open",
            }
          : item
      )
    );
  };

  const handleDelete = (id: string) => {
    setComplaints((prev) => prev.filter((item) => item.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Complaints
        </h1>
        <div className="flex items-center gap-2">
          {(["All", "Open", "Resolved"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                filter === value
                  ? "bg-[#1d3a8a] text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6">
        {filteredComplaints.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-800">
                    {item.title}
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPill(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityPill(
                      item.priority
                    )}`}
                  >
                    {item.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {item.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <FaRegClock /> {item.date}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FaExclamationCircle /> {item.id}
                  </span>
                  <span>Reported by {item.reporter}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelected(item)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  <FaEye />
                  View
                </button>
                <button
                  onClick={() => handleToggleStatus(item.id)}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  <FaCheckCircle />
                  {item.status === "Open" ? "Resolve" : "Reopen"}
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  <FaTrash />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredComplaints.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            No complaints found for this filter.
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                Complaint Details
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="text-sm text-slate-500"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-700">Title:</span>{" "}
                {selected.title}
              </p>
              <p>
                <span className="font-semibold text-slate-700">ID:</span>{" "}
                {selected.id}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Status:</span>{" "}
                {selected.status}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Priority:</span>{" "}
                {selected.priority}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Reported by:</span>{" "}
                {selected.reporter}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Date:</span>{" "}
                {selected.date}
              </p>
              <p className="text-slate-500">{selected.description}</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleToggleStatus(selected.id);
                  setSelected(null);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                {selected.status === "Open" ? "Resolve" : "Reopen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Complaints;
