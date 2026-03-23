import { useMemo, useState } from "react";
import {
  FaBan,
  FaBus,
  FaChair,
  FaCheckCircle,
  FaDownload,
  FaPlus,
  FaSearch,
  FaWrench,
} from "react-icons/fa";

interface Bus {
  id: string;
  model: string;
  seats: number;
  driver: string;
  driverAvatar: string;
  trips: number;
  revenue: number;
  status: "Active" | "Inactive" | "Maintenance";
  type: "AC" | "Non-AC";
  image: string;
}

const initialBusData: Bus[] = [
  {
    id: "ND-1151",
    model: "Ashok Leyland",
    seats: 42,
    driver: "Lahiru Mudalige",
    driverAvatar: "https://i.pravatar.cc/60?img=32",
    trips: 4,
    revenue: 840,
    status: "Active",
    type: "AC",
    image:
      "https://media.man.eu/is/image/MAN/man_lionscoach-e_model-overview_16x9?wid=2000&hei=1125&fit=stretch&fmt=webp&qlt=60",
  },
  {
    id: "NC-2344",
    model: "Ashok Leyland",
    seats: 54,
    driver: "Lahiru Mudalige",
    driverAvatar: "https://i.pravatar.cc/60?img=12",
    trips: 4,
    revenue: 840,
    status: "Active",
    type: "Non-AC",
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTGDl1N1f-N3RVM81RrEEd23Y6Bx-qnced1Vw&s",
  },
  {
    id: "NJ-1539",
    model: "Volvo 9600",
    seats: 36,
    driver: "Ashen Senarathna",
    driverAvatar: "https://i.pravatar.cc/60?img=22",
    trips: 2,
    revenue: 1250,
    status: "Active",
    type: "AC",
    image:
      "https://www.lectura-specs.com/models/renamed/orig/touring-coaches-comfortclass-s-517-hd-setra.jpg",
  },
  {
    id: "NC-1212",
    model: "Volvo 9600",
    seats: 40,
    driver: "David Ross",
    driverAvatar: "https://i.pravatar.cc/60?img=52",
    trips: 2,
    revenue: 1250,
    status: "Active",
    type: "AC",
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnKLB-72gujnV-MQnO2cS1-JECfq5faaKiCw&s",
  },
];

const stats = [
  {
    title: "Total Buses",
    value: "45",
    accent: "text-[#1d3a8a]",
    icon: FaBus,
    ring: "bg-[#e8eefc]",
  },
  {
    title: "Active",
    value: "38",
    accent: "text-emerald-600",
    icon: FaCheckCircle,
    ring: "bg-emerald-100",
  },
  {
    title: "Maintenance",
    value: "5",
    accent: "text-amber-600",
    icon: FaWrench,
    ring: "bg-amber-100",
  },
  {
    title: "Inactive",
    value: "2",
    accent: "text-rose-500",
    icon: FaBan,
    ring: "bg-rose-100",
  },
];

const emptyBusForm = {
  id: "",
  model: "",
  seats: "",
  driver: "",
  driverAvatar: "",
  trips: "",
  revenue: "",
  status: "Active" as Bus["status"],
  type: "AC" as Bus["type"],
  image: "",
};

function Buses() {
  const [buses, setBuses] = useState<Bus[]>(initialBusData);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [activeStatus, setActiveStatus] = useState("Active");
  const [assignedDriver, setAssignedDriver] = useState("");
  const [capacity, setCapacity] = useState(30);
  const [showAddBus, setShowAddBus] = useState(false);
  const [newBus, setNewBus] = useState(emptyBusForm);

  const [showExportModal, setShowExportModal] = useState(false);

  const filteredBuses = useMemo(() => {
    return buses.filter((bus) => {
      const matchSearch =
        bus.id.toLowerCase().includes(search.toLowerCase()) ||
        bus.type.toLowerCase().includes(search.toLowerCase()) ||
        bus.model.toLowerCase().includes(search.toLowerCase());

      const matchType = !selectedType || bus.type === selectedType;
      const matchStatus = !activeStatus || bus.status === activeStatus;
      const matchDriver =
        !assignedDriver ||
        bus.driver.toLowerCase().includes(assignedDriver.toLowerCase());
      const matchCapacity = bus.seats >= capacity;

      return (
        matchSearch &&
        matchType &&
        matchStatus &&
        matchDriver &&
        matchCapacity
      );
    });
  }, [buses, search, selectedType, activeStatus, assignedDriver, capacity]);

  const handleAddBus = () => {
    if (!newBus.id.trim() || !newBus.model.trim()) return;

    const createdBus: Bus = {
      id: newBus.id.trim(),
      model: newBus.model.trim(),
      seats: Number(newBus.seats) || 40,
      driver: newBus.driver.trim() || "Unassigned",
      driverAvatar:
        newBus.driverAvatar.trim() || "https://i.pravatar.cc/60?img=1",
      trips: Number(newBus.trips) || 0,
      revenue: Number(newBus.revenue) || 0,
      status: newBus.status,
      type: newBus.type,
      image:
        newBus.image.trim() ||
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=60",
    };

    setBuses((prev) => [createdBus, ...prev]);
    setNewBus(emptyBusForm);
    setShowAddBus(false);
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Bus Management
        </h1>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300">
            <FaDownload />
            Export
          </button>
          <button
            onClick={() => setShowAddBus(true)}
            className="flex items-center gap-2 rounded-lg bg-[#1d3a8a] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a3175]"
          >
            <FaPlus />
            Add New Bus
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div>
              <p className="text-xs text-slate-500">{stat.title}</p>
              <p className={`mt-1 text-2xl font-semibold ${stat.accent}`}>
                {stat.value}
              </p>
            </div>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${stat.ring}`}
            >
              <stat.icon className={`text-lg ${stat.accent}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <FaSearch className="text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by registration, type..."
            className="w-full bg-transparent text-sm text-slate-700 outline-none"
          />
        </div>

        <select
          value={selectedType}
          onChange={(event) => setSelectedType(event.target.value)}
          className="min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="">All Types</option>
          <option value="AC">AC</option>
          <option value="Non-AC">Non-AC</option>
        </select>

        <select
          value={activeStatus}
          onChange={(event) => setActiveStatus(event.target.value)}
          className="min-w-[120px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Maintenance">Maintenance</option>
          <option value="">All Status</option>
        </select>

        <select
          value={assignedDriver}
          onChange={(event) => setAssignedDriver(event.target.value)}
          className="min-w-[150px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="">Assigned Driver</option>
          <option value="Lahiru Mudalige">Lahiru Mudalige</option>
          <option value="Ashen Senarathna">Ashen Senarathna</option>
          <option value="David Ross">David Ross</option>
        </select>

        <div className="flex min-w-[200px] flex-1 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] font-medium text-slate-500">
            Capacity
            <div className="text-xs text-slate-400">30 - 60</div>
          </div>
          <input
            type="range"
            min="30"
            max="60"
            step="1"
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
            className="h-1 flex-1 cursor-pointer accent-[#1d3a8a]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {filteredBuses.map((bus) => (
          <div
            key={bus.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="relative">
              <img
                src={bus.image}
                alt={bus.model}
                className="h-40 w-full object-cover"
              />
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                {bus.status}
              </span>
            </div>

            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1d3a8a]">
                    {bus.id}
                  </p>
                  <p className="text-xs text-slate-500">{bus.model}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    bus.type === "AC"
                      ? "bg-blue-50 text-[#1d3a8a]"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {bus.type}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <FaChair className="text-[11px] text-slate-400" />
                {bus.seats} Seats
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <img
                    src={bus.driverAvatar}
                    alt={bus.driver}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <p className="text-xs font-semibold text-slate-700">
                    {bus.driver}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400">Driver</span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <div className="flex w-full items-center justify-between">
                  <div className="pr-4">
                    <p className="text-[11px] text-slate-400">Today's Trips</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {bus.trips}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-slate-100" />
                  <div className="pl-4 text-right">
                    <p className="text-[11px] text-slate-400">Revenue</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      ${bus.revenue.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <button className="w-full text-right text-[11px] font-semibold text-[#1d3a8a]">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAddBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                Add New Bus
              </h3>
              <button
                onClick={() => setShowAddBus(false)}
                className="text-sm text-slate-500"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 text-sm">
              <input
                value={newBus.id}
                onChange={(event) =>
                  setNewBus((prev) => ({ ...prev, id: event.target.value }))
                }
                placeholder="Bus ID (e.g., ND-1151)"
                className="rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                value={newBus.model}
                onChange={(event) =>
                  setNewBus((prev) => ({ ...prev, model: event.target.value }))
                }
                placeholder="Bus model"
                className="rounded-lg border border-slate-200 px-3 py-2"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  value={newBus.seats}
                  onChange={(event) =>
                    setNewBus((prev) => ({
                      ...prev,
                      seats: event.target.value,
                    }))
                  }
                  placeholder="Seats"
                  className="rounded-lg border border-slate-200 px-3 py-2"
                />
                <input
                  value={newBus.driver}
                  onChange={(event) =>
                    setNewBus((prev) => ({
                      ...prev,
                      driver: event.target.value,
                    }))
                  }
                  placeholder="Assigned driver"
                  className="rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={newBus.type}
                  onChange={(event) =>
                    setNewBus((prev) => ({
                      ...prev,
                      type: event.target.value as Bus["type"],
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="AC">AC</option>
                  <option value="Non-AC">Non-AC</option>
                </select>
                <select
                  value={newBus.status}
                  onChange={(event) =>
                    setNewBus((prev) => ({
                      ...prev,
                      status: event.target.value as Bus["status"],
                    }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="number"
                  value={newBus.trips}
                  onChange={(event) =>
                    setNewBus((prev) => ({
                      ...prev,
                      trips: event.target.value,
                    }))
                  }
                  placeholder="Today's trips"
                  className="rounded-lg border border-slate-200 px-3 py-2"
                />
                <input
                  type="number"
                  value={newBus.revenue}
                  onChange={(event) =>
                    setNewBus((prev) => ({
                      ...prev,
                      revenue: event.target.value,
                    }))
                  }
                  placeholder="Revenue"
                  className="rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
              <input
                value={newBus.image}
                onChange={(event) =>
                  setNewBus((prev) => ({ ...prev, image: event.target.value }))
                }
                placeholder="Bus image URL"
                className="rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                value={newBus.driverAvatar}
                onChange={(event) =>
                  setNewBus((prev) => ({
                    ...prev,
                    driverAvatar: event.target.value,
                  }))
                }
                placeholder="Driver avatar URL"
                className="rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowAddBus(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBus}
                className="rounded-lg bg-[#1d3a8a] px-4 py-2 text-sm font-semibold text-white"
              >
                Save Bus
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded w-80">
            <h2 className="mb-4 font-semibold">Export</h2>
            <button className="w-full bg-[#1d3a8a] text-white py-2 rounded mb-3"
              onClick={() => alert("Downloading...")}>
              Download Preview
            </button>
            <button className="w-full bg-gray-200 py-2 rounded" onClick={() => setShowExportModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Buses;
