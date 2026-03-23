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
    <div className="p-6">

      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-xl font-semibold">Complaints Management</h1>
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
            {pending} high priority
          </span>
        </div>

        <button
          className="flex items-center gap-2 rounded-lg bg-[#1d3a8a] px-4 py-2 text-sm font-semibold text-white shadow-sm"
          onClick={() => setShowExportModal(true)}
        >
          Export Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-gray-500 text-sm">Total Complaints</p>
          <h2 className="text-2xl font-semibold">{total}</h2>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
          <p className="text-gray-500 text-sm">Pending</p>
          <h2 className="text-2xl font-semibold text-red-500">{pending}</h2>
          <p className="text-xs text-red-500">Action Required (&gt;20)</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-gray-500 text-sm">Under Review</p>
          <h2 className="text-2xl font-semibold">{review}</h2>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-gray-500 text-sm">Resolved</p>
          <h2 className="text-2xl font-semibold text-green-500">{resolved}</h2>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white p-4 rounded mb-5">
        <div className="flex items-center border rounded px-3 w-60">
          <FaSearch className="text-gray-400 mr-2" />
          <input
            className="outline-none w-full"
            placeholder="ID, Passenger..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select className="border rounded px-3 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option>All Statuses</option>
          <option>Pending</option>
          <option>Under Review</option>
          <option>Resolved</option>
        </select>

        <select className="border rounded px-3 py-2" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option>All Priorities</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>

        <select className="border rounded px-3 py-2" value={bookingFilter} onChange={(e) => setBookingFilter(e.target.value)}>
          <option>Booking ID</option>
          <option>#BK-4821</option>
          <option>#BK-4822</option>
          <option>#BK-4825</option>
        </select>

        <select className="border rounded px-3 py-2" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
          <option>Bus Driver</option>
          <option>Kamal Perera</option>
          <option>Nimal Perera</option>
          <option>Sunil Fernando</option>
        </select>

        <div className="flex items-center border rounded px-3">
          <input
            type="date"
            className="outline-none"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <FaCalendarAlt className="text-gray-400 ml-2" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 text-sm text-gray-500">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Type</th>
              <th className="p-3">Passenger</th>
              <th className="p-3">Description</th>
              <th className="p-3">Booking ID</th>
              <th className="p-3">Bus/Driver</th>
              <th className="p-3">Images</th>
              <th className="p-3">Status</th>
              <th className="p-3">Created</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredComplaints.map((c, i) => (
              <tr key={i} className="border-t">
                <td className="p-3 text-blue-600 font-bold">{c.id}</td>

                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(c.priority)}`}>
                    {c.priority}
                  </span>
                </td>

                <td className="p-3">{c.type}</td>
                <td className="p-3">{c.passenger}</td>
                <td className="p-3 text-gray-500">{c.description}</td>
                <td className="p-3 text-blue-600">{c.bookingId}</td>
                <td className="p-3">{c.bus}</td>
                <td className="p-3"><FaCamera className="text-gray-500" /></td>

                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(c.status)}`}>
                    {c.status}
                  </span>
                </td>

                <td className="p-3">{c.created}</td>

                <td className="p-3 text-center">
                  <button onClick={() => setShowActions(true)}>
                    <FaEllipsisV className="text-gray-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded w-80">
            <h2 className="mb-4 font-semibold">Export Report</h2>
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

      {showActions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded w-80">
            <button
              className="w-full bg-red-500 text-white py-2 rounded mb-2"
              onClick={() => alert("Removed")}
            >
              Remove Complaint
            </button>

            <button
              className="w-full bg-blue-700 text-white py-2 rounded mb-2"
              onClick={() => setUpdateStatus(true)}
            >
              Update Status
            </button>

            <button
              className="w-full bg-gray-200 py-2 rounded"
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