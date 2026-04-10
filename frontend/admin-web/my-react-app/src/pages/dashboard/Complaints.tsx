import { useState } from "react";
import { FaCalendarAlt, FaCamera, FaEllipsisV, FaSearch } from "react-icons/fa";

type Complaint = {
  id: string;
  priority: "High" | "Medium" | "Low";
  type: string;
  passenger: string;
  description: string;
  bookingId: string;
  bus: string;
  status: "Pending" | "Under Review" | "Resolved";
  created: string;
};

const complaints: Complaint[] = [
  {
    id: "#CP-8921",
    priority: "High",
    type: "Bus Condition",
    passenger: "Prashani Bhagya",
    description: "AC not working on route...",
    bookingId: "#BK-4821",
    bus: "ND-6398 / Kamal Perera",
    status: "Pending",
    created: "Oct 24, 10:30 AM",
  },
  {
    id: "#CP-8922",
    priority: "Medium",
    type: "Driver Behaviour",
    passenger: "Oshadi Liyanage",
    description: "Driver was rude during boarding...",
    bookingId: "#BK-4822",
    bus: "WP-2596 / Nimal Perera",
    status: "Under Review",
    created: "Oct 24, 09:15 AM",
  },
  {
    id: "#CP-8923",
    priority: "Low",
    type: "Payment Issue",
    passenger: "Janani Pitawala",
    description: "Double deduction on credit card...",
    bookingId: "#BK-4825",
    bus: "SP-2596 / Sunil Fernando",
    status: "Resolved",
    created: "Oct 23, 02:30 PM",
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "Pending":
      return "bg-red-100 text-red-700";
    case "Under Review":
      return "bg-yellow-100 text-yellow-700";
    case "Resolved":
      return "bg-green-100 text-green-700";
    default:
      return "";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "High":
      return "bg-red-500 text-white";
    case "Medium":
      return "bg-yellow-500 text-white";
    case "Low":
      return "bg-gray-500 text-white";
    default:
      return "";
  }
};

const ComplaintManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [priorityFilter, setPriorityFilter] = useState("All Priorities");
  const [bookingFilter, setBookingFilter] = useState("Booking ID");
  const [driverFilter, setDriverFilter] = useState("Bus Driver");
  const [dateFilter, setDateFilter] = useState("");

  const [showExportModal, setShowExportModal] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(false);

  // ✅ Dynamic stats
  const total = complaints.length;
  const pending = complaints.filter((c) => c.status === "Pending").length;
  const review = complaints.filter((c) => c.status === "Under Review").length;
  const resolved = complaints.filter((c) => c.status === "Resolved").length;

  const filteredComplaints = complaints.filter((c) => {
    return (
      (c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.passenger.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === "All Statuses" || c.status === statusFilter) &&
      (priorityFilter === "All Priorities" || c.priority === priorityFilter) &&
      (bookingFilter === "Booking ID" || c.bookingId === bookingFilter) &&
      (driverFilter === "Bus Driver" || c.bus.includes(driverFilter)) &&
      (!dateFilter || c.created.includes(dateFilter))
    );
  });

  return (
    <div className="w-full">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Complaints Management</h1>
          <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-medium mt-2 inline-block">
            {pending} high priority
          </span>
        </div>

        <button
          className="flex items-center gap-2 rounded-lg bg-[#1d3a8a] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#1a3175]"
          onClick={() => setShowExportModal(true)}
        >
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">Total Complaints</p>
          <h2 className="text-2xl font-semibold text-slate-900 mt-1">{total}</h2>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-rose-500">
          <p className="text-slate-500 text-sm">Pending</p>
          <h2 className="text-2xl font-semibold text-rose-500 mt-1">{pending}</h2>
          <p className="text-xs text-rose-600 mt-1">Action Required (&gt;20)</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">Under Review</p>
          <h2 className="text-2xl font-semibold text-slate-900 mt-1">{review}</h2>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <p className="text-slate-500 text-sm">Resolved</p>
          <h2 className="text-2xl font-semibold text-emerald-600 mt-1">{resolved}</h2>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-4 rounded-lg border border-slate-200 mb-6 shadow-sm">
        <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2 w-60">
          <FaSearch className="text-slate-400 mr-2" />
          <input
            className="outline-none w-full bg-transparent text-slate-900 placeholder-slate-400"
            placeholder="ID, Passenger..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:ring-1 focus:ring-[#1d3a8a] outline-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option>All Statuses</option>
          <option>Pending</option>
          <option>Under Review</option>
          <option>Resolved</option>
        </select>

        <select className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:ring-1 focus:ring-[#1d3a8a] outline-none" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option>All Priorities</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <select className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:ring-1 focus:ring-[#1d3a8a] outline-none" value={bookingFilter} onChange={(e) => setBookingFilter(e.target.value)}>
          <option>Booking ID</option>
          <option>#BK-4821</option>
          <option>#BK-4822</option>
          <option>#BK-4825</option>
        </select>

        <select className="border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:ring-1 focus:ring-[#1d3a8a] outline-none" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
          <option>Bus Driver</option>
          <option>Kamal Perera</option>
          <option>Nimal Perera</option>
          <option>Sunil Fernando</option>
        </select>

        <div className="flex items-center border border-slate-200 rounded-lg px-3 py-2">
          <input
            type="date"
            className="outline-none bg-transparent text-slate-900"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <FaCalendarAlt className="text-slate-400 ml-2" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50 text-sm text-slate-600 border-b border-slate-200">
            <tr>
              <th className="p-3 text-left font-semibold">ID</th>
              <th className="p-3 text-left font-semibold">Priority</th>
              <th className="p-3 text-left font-semibold">Type</th>
              <th className="p-3 text-left font-semibold">Passenger</th>
              <th className="p-3 text-left font-semibold">Description</th>
              <th className="p-3 text-left font-semibold">Booking ID</th>
              <th className="p-3 text-left font-semibold">Bus/Driver</th>
              <th className="p-3 text-left font-semibold">Images</th>
              <th className="p-3 text-left font-semibold">Status</th>
              <th className="p-3 text-left font-semibold">Created</th>
              <th className="p-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredComplaints.map((c, i) => (
              <tr key={i} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="p-3 text-[#1d3a8a] font-bold">{c.id}</td>

                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(c.priority)}`}>
                    {c.priority}
                  </span>
                </td>

                <td className="p-3 text-slate-900">{c.type}</td>
                <td className="p-3 text-slate-900">{c.passenger}</td>
                <td className="p-3 text-slate-500">{c.description}</td>
                <td className="p-3 text-[#1d3a8a] font-medium">{c.bookingId}</td>
                <td className="p-3 text-slate-900">{c.bus}</td>
                <td className="p-3"><FaCamera className="text-slate-400" /></td>

                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>
                    {c.status}
                  </span>
                </td>

                <td className="p-3 text-slate-600 text-sm">{c.created}</td>

                <td className="p-3 text-center">
                  <button onClick={() => setShowActions(true)}>
                    <FaEllipsisV className="text-slate-400 hover:text-slate-600" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-80 shadow-lg">
            <h2 className="mb-4 font-semibold text-slate-900">Export Report</h2>
            <button className="w-full bg-[#1d3a8a] text-white py-2 rounded-lg mb-3 font-medium hover:bg-[#1a3175]"
              onClick={() => alert("Downloading...")}>
              Download Preview
            </button>
            <button className="w-full bg-slate-200 text-slate-900 py-2 rounded-lg font-medium hover:bg-slate-300" onClick={() => setShowExportModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showActions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-80 shadow-lg">
            <button
              className="w-full bg-rose-500 text-white py-2 rounded-lg mb-2 font-medium hover:bg-rose-600"
              onClick={() => alert("Removed")}
            >
              Remove Complaint
            </button>

            <button
              className="w-full bg-[#1d3a8a] text-white py-2 rounded-lg mb-2 font-medium hover:bg-[#1a3175]"
              onClick={() => setUpdateStatus(true)}
            >
              Update Status
            </button>

            <button
              className="w-full bg-slate-200 text-slate-900 py-2 rounded-lg font-medium hover:bg-slate-300"
              onClick={() => setShowActions(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {updateStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded w-80">
            {["Pending", "Under Review", "Resolved"].map((s) => (
              <button
                key={s}
                className="w-full bg-gray-200 py-2 rounded mb-2"
                onClick={() => alert(`Set to ${s}`)}
              >
                {s}
              </button>
            ))}

            <button
              className="w-full bg-gray-300 py-2 rounded"
              onClick={() => setUpdateStatus(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ComplaintManagement;