import { useNavigate } from "react-router-dom";
import { FiBell, FiChevronRight, FiLogOut, FiSearch } from "react-icons/fi";

type NavbarProps = {
  title: string;
  breadcrumb?: string[];
};

function Navbar({ title, breadcrumb }: NavbarProps) {
  const crumbs = breadcrumb ?? ["Home", title];
  const navigate = useNavigate();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {crumbs.map((item, index) => (
            <span key={`${item}-${index}`} className="flex items-center gap-1.5">
              <span>{item}</span>
              {index < crumbs.length - 1 ? (
                <FiChevronRight className="text-xs text-slate-400" />
              ) : null}
            </span>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[420px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <FiSearch className="text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Search buses, drivers, or routes..."
              className="w-full bg-transparent text-sm text-slate-600 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-2 rounded-lg bg-[#1d3a8a] px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            <FiLogOut className="text-sm" />
            Logout
          </button>
          <button className="relative flex h-8 w-8 items-center justify-center text-slate-500">
            <FiBell className="text-base" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
