import { useState } from "react";
import { FaUser, FaDownload, FaSearch } from "react-icons/fa";

interface buses {
  id: string;
  model: string;
  seats: number;
  driver: string;
  trips: number;
  revenue: number;
  status: string;
  type: string;
  image: string;
}

const buses = [
  {
    id: "ND-1151",
    model: "Ashok Leyland",
    seats: 42,
    driver: "Lahiru Mudalige",
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
    trips: 2,
    revenue: 1250,
    status: "Active",
    type: "AC",
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnKLB-72gujnV-MQnO2cS1-JECfq5faaKiCw&s",
  },
];

const BusManagement = () => {
  const [search, setSearch] = useState("");
  const [alltypes, setAllTypes] = useState("");
  const [active, setActive] = useState("");
  const [assigneddriver, setAssignedDriver] = useState("");
  const [capacity, setCapacity] = useState(30);
  const [showAddBus, setShowAddBus] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const filteredBuses = buses.filter((bus) => {
    const matchSearch =
      bus.id.toLowerCase().includes(search.toLowerCase()) ||
      bus.type.toLowerCase().includes(search.toLowerCase());

    const matchType = !alltypes || bus.type === alltypes;

    const matchStatus =
      !active ||
      (active === "Yes" && bus.status === "Active") ||
      (active === "No" && bus.status !== "Active");

    const matchDriver =
      !assigneddriver || bus.driver.includes(assigneddriver);

    const matchCapacity = bus.seats >= capacity;

    return (
      matchSearch &&
      matchType &&
      matchStatus &&
      matchDriver &&
      matchCapacity
    );
  });

  return (
    <div className="p-2 bg-gray-100 min-h-[70vh] min-w-[50vw]">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Bus Management</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm"
          >
            <FaDownload className="mr-2" /> Export
          </button>
          <button
            onClick={() => setShowAddBus(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
          >
            + Add Bus
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-5 mb-5">
        <StatCard title="Total Buses" value="04" />
        <StatCard title="Active" value="04" color="text-green-500" />
        <StatCard title="Maintenance" value="01" color="text-yellow-500" />
        <StatCard title="Inactive" value="00" color="text-red-500" />
      </div>

      {/* Filters */}
      <div className="flex justify-between mb-5 flex-wrap gap-4">
        {/* Search */}
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-2 bg-white w-60">
          <FaSearch className="text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by registration, type..."
            className="bg-white border-none outline-none w-full text-black text-sm"
          />
        </div>

        {/* Type */}
        <select
          value={alltypes}
          onChange={(e) => setAllTypes(e.target.value)}
          className="w-60 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-black cursor-pointer"
        >
          <option value="">All Types</option>
          <option value="AC">AC</option>
          <option value="Non-AC">Non-AC</option>
        </select>

        {/* Active */}
        <select
          value={active}
          onChange={(e) => setActive(e.target.value)}
          className="w-60 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-black cursor-pointer"
        >
          <option value="">Active</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>

        {/* Driver */}
        <select
          value={assigneddriver}
          onChange={(e) => setAssignedDriver(e.target.value)}
          className="w-60 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-black cursor-pointer"
        >
          <option value="">Assigned Driver</option>
          <option value="Yes">Lahiru Mudalige</option>
          <option value="No">Ashen Senarathna</option>
          <option value="No">David Ross</option>
        </select>

        {/* Capacity */}
        <div className="flex items-center gap-2 w-56 border border-gray-300 rounded-lg px-2">
          <span className="text-sm text-gray-700 whitespace-nowrap">
            Capacity: <span className="text-gray-500">{capacity}</span>
          </span>
          <input
            type="range"
            min="30"
            max="60"
            step="1"
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="flex-1 cursor-pointer"
          />
        </div>
      </div>

      {/* Bus Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {filteredBuses.map((bus) => (
          <div
            key={bus.id}
            className="bg-white text-blue-800 rounded-xl overflow-hidden shadow-sm"
          >
            <img
              src={bus.image}
              alt=""
              className="w-full h-40 object-cover"
            />
            <div className="p-4">
              <h4 className="text-md mb-1">{bus.id}</h4>
              <div className="text-sm text-gray-500">{bus.model}</div>

              <div className="flex justify-between mt-2 text-sm">
                <span>{bus.seats} Seats</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-bold ${
                    bus.type === "AC" ? "text-green-700 bg-gray-200" : "text-black bg-gray-200"
                  }`}
                >
                  {bus.type}
                </span>
              </div>

              <div className="flex items-center text-sm text-gray-600 mt-2">
                <FaUser className="mr-1" />
                Driver: {bus.driver}
              </div>

              <div className="flex justify-between mt-4 text-sm">
                <div>
                  <div>Today's Trips</div>
                  <strong>{bus.trips}</strong>
                </div>
                <div className="text-right">
                  <div>Revenue</div>
                  <strong className="text-green-500">
                    ${bus.revenue.toFixed(2)}
                  </strong>
                </div>
              </div>

              <button className="mt-4 w-full py-2 bg-white text-blue-800 text-sm text-right cursor-pointer">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Bus Modal */}
      {showAddBus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg flex flex-col">
            <h2 className="mb-4 text-gray-800 text-lg font-semibold">Add New Bus</h2>
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100 text-gray-700" placeholder="Bus ID" />
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100 text-gray-700" placeholder="Bus Number" />
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100 text-gray-700" placeholder="Model" />
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100 text-gray-700" placeholder="Amenities" />
            <input type="number" className="mb-2 p-2 rounded border border-gray-300 bg-gray-100" placeholder="Seats capacity" />
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100" placeholder="Registration Number" />
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100" placeholder="Condition" />
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100" placeholder="Insurance Details" />
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100" placeholder="Status" />
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100" placeholder="Type (AC / Non-AC)" />
            <input className="mb-2 p-2 rounded border border-gray-300 bg-gray-100" placeholder="Image URL" />

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddBus(false)} className="px-3 py-2 rounded border bg-gray-200 text-black">Cancel</button>
              <button className="px-3 py-2 rounded bg-blue-600 text-white">Save Bus</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 shadow-lg flex flex-col">
            <h2 className="mb-3 text-gray-800 text-lg font-semibold">Export Buses</h2>
            <div className="text-sm text-gray-600 mb-4">
              You can download a preview of all buses as CSV or PDF.
            </div>
            <button
              onClick={() => alert("Exported!")}
              className="mb-2 w-full py-2 rounded bg-blue-600 text-white"
            >
              Download Preview
            </button>
            <button
              onClick={() => setShowExportModal(false)}
              className="px-3 py-2 rounded border bg-gray-200 text-black"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({
  title,
  value,
  color = "text-blue-600",
}: {
  title: string;
  value: string;
  color?: string;
}) => {
  return (
    <div className="flex-1 bg-white p-5 rounded-xl shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
};

export default BusManagement;