import { useState } from "react";
import { FaArrowLeft, FaSearch, FaEllipsisV } from "react-icons/fa";
import { FaStar, FaUserLarge } from "react-icons/fa6";

interface Driver {
  id: string;
  name: string;
  licenseNumber: string;
  phone: string;
  assignment: string | null;
  rating: number;
  experienceYears: number;
  trips: number;
  status: "Verified" | "Not Verified";
}

const DriverManagement = () => {
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [assignment, setAssignment] = useState("");
  const [experience, setExperience] = useState("");
  const [rating, setRating] = useState(0);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(false);

  const tabs = ["All", "Verified", "Not Verified"];

  const drivers: Driver[] = [
    {
      id: "DRV-2023-001",
      name: "Dinith Rathnayaka",
      licenseNumber: "B6160539",
      phone: "+94710803826",
      assignment: "ND-3590",
      rating: 3.8,
      experienceYears: 5,
      trips: 1200,
      status: "Verified",
    },
    {
      id: "DRV-2023-002",
      name: "Janani Pitawala",
      licenseNumber: "B1234567",
      phone: "+94771234567",
      assignment: "ND-3264",
      rating: 2.1,
      experienceYears: 3,
      trips: 800,
      status: "Verified",
    },
    {
      id: "DRV-2023-004",
      name: "Prashani Bhagya",
      licenseNumber: "B9876543",
      phone: "+94771876567",
      assignment: null,
      rating: 4.9,
      experienceYears: 6,
      trips: 880,
      status: "Not Verified",
    },
    {
      id: "DRV-2023-006",
      name: "Oshadhi Liyanage",
      licenseNumber: "B5555555",
      phone: "+94789734567",
      assignment: null,
      rating: 2.6,
      experienceYears: 1,
      trips: 470,
      status: "Not Verified",
    },
  ];

  const filteredDrivers = drivers.filter((d) => {
    const matchTab = activeTab === "All" || d.status === activeTab;

    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.licenseNumber.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search);

    const matchAssignment = !assignment || d.assignment === assignment;

    let matchExperience = true;
    if (experience === "1-2") {
      matchExperience = d.experienceYears >= 1 && d.experienceYears <= 2;
    } else if (experience === "3-5") {
      matchExperience = d.experienceYears >= 3 && d.experienceYears <= 5;
    } else if (experience === "5+") {
      matchExperience = d.experienceYears > 5;
    }

    const matchRating = d.rating >= rating;

    return (
      matchTab &&
      matchSearch &&
      matchAssignment &&
      matchExperience &&
      matchRating
    );
  });

  return (
    <>
      <div className="w-full">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <FaArrowLeft className="text-slate-900 mb-1" />
            <h1 className="text-xl font-semibold text-slate-900">
              Driver Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Total Drivers: {drivers.length}
            </p>
          </div>

          <button
            onClick={() => setShowAddDriver(true)}
            className="bg-[#1d3a8a] text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Add Driver
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm p-5 text-slate-900">

          {/* Tabs */}
          <div className="flex gap-6 border-b border-slate-200 mb-3">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 text-sm font-medium ${
                  activeTab === tab
                    ? "text-[#1d3a8a] border-b-2 border-[#1d3a8a]"
                    : "text-slate-500 border-b-2 border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-8 mt-5">

            {/* Search */}
            <div className="relative w-[280px]">
              <FaSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                type="text"
                placeholder="Search by name, license number, or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#1d3a8a]"
              />
            </div>

            {/* Assignment */}
            <select
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
              className="w-[240px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#1d3a8a] outline-none"
            >
              <option value="">Assignment Bus</option>
              <option value="ND-3590">ND-3590</option>
              <option value="ND-3264">ND-3264</option>
            </select>

            {/* Experience */}
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#1d3a8a] outline-none"
            >
              <option value="">Experience</option>
              <option value="1-2">1 - 2 Years</option>
              <option value="3-5">3 - 5 Years</option>
              <option value="5+">More than 5 Years</option>
            </select>

            {/* Rating */}
            <div className="flex items-center gap-2 w-[220px]">
              <span className="text-sm">
                Rating: <span>{rating}</span>
              </span>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="flex-1 cursor-pointer accent-[#1d3a8a]"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto mt-5">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="p-4">Driver Details</th>
                  <th className="p-4">License / Phone</th>
                  <th className="p-4">Assignment</th>
                  <th className="p-4">Stats</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredDrivers.map((d) => (
                  <tr key={d.id} className="border-t border-slate-200">
                    <td className="p-4 flex items-center">
                      <FaUserLarge className="text-[#1d3a8a] mr-2" />
                      <div>
                        <div className="font-semibold text-slate-900">{d.name}</div>
                        <div className="text-xs text-slate-500">
                          ID: {d.id}
                        </div>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="text-slate-900">{d.licenseNumber}</div>
                      <div className="text-xs text-slate-500">
                        {d.phone}
                      </div>
                    </td>

                    <td className="p-4 text-slate-900">
                      {d.assignment ?? (
                        <span className="text-slate-500">Unassigned</span>
                      )}
                    </td>

                    <td className="p-4">
                      <FaStar className="inline text-amber-400 mr-1" />
                      <span className="text-slate-900">{d.rating}</span>
                      <br />
                      <span className="text-xs text-slate-500">
                        {d.experienceYears}yr Exp • {d.trips} Trips
                      </span>
                    </td>

                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        d.status === "Verified"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {d.status}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <button onClick={() => setShowActions(true)}>
                        <FaEllipsisV className="text-slate-400 hover:text-slate-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 text-sm text-slate-600">
            Showing {filteredDrivers.length} of {drivers.length} drivers
          </div>
        </div>
      </div>

      {/* Add Driver Modal */}
      {showAddDriver && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-[400px] flex flex-col shadow-lg">
            <h2 className="mb-4 text-slate-900 font-semibold">
              Add New Driver
            </h2>

            {[
              "First Name",
              "Last Name",
              "License Number",
              "License Expiry",
              "Email Address",
              "Phone Number",
              "Account Number",
              "Status",
              "Driver ID",
              "Years of Experience",
              "Profile Picture URL (Optional)",
              "Assigned Bus (Optional)",
            ].map((p) => (
              <input
                key={p}
                placeholder={p}
                className="px-3 py-2 mb-2 border border-slate-200 rounded text-sm bg-slate-50 focus:ring-1 focus:ring-[#1d3a8a] outline-none"
              />
            ))}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowAddDriver(false)}
                className="bg-slate-200 text-slate-900 px-3 py-2 rounded font-medium hover:bg-slate-300"
              >
                Cancel
              </button>

              <button
                onClick={() => setShowAddDriver(false)}
                className="bg-[#1d3a8a] text-white px-3 py-2 rounded font-medium hover:bg-[#1a3175]"
              >
                Save Driver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions Modal */}
      {showActions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-[300px] shadow-lg">
            <button className="w-full bg-rose-500 text-white py-2 rounded mb-2 font-medium hover:bg-rose-600"
            onClick={() => alert("Driver Removed")}>
              Remove Driver
            </button>

            <button
              onClick={() => setUpdateStatus(true)}
              className="w-full bg-[#1d3a8a] text-white py-2 rounded mb-2 font-medium hover:bg-[#1a3175]"
            >
              Update Status
            </button>

            <button
              onClick={() => setShowActions(false)}
              className="w-full bg-slate-200 text-slate-900 py-2 rounded font-medium hover:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {updateStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-[300px] shadow-lg">
            <button className="w-full bg-emerald-500 text-white py-2 rounded mb-2 font-medium hover:bg-emerald-600"
            onClick={() => alert("Set to be verified")}>
              Verified
            </button>

            <button className="w-full bg-slate-400 text-white py-2 rounded mb-2 font-medium hover:bg-slate-500"
            onClick={() => alert("Updated")}>
              Not Verified
            </button>

            <button
              onClick={() => setUpdateStatus(false)}
              className="w-full bg-slate-200 text-slate-900 py-2 rounded font-medium hover:bg-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default DriverManagement;