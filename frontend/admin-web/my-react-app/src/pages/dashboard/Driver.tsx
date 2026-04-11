import { useNavigate } from 'react-router-dom'

function Driver() {
  const navigate = useNavigate()

  return (
    <section className="mx-auto w-full max-w-[1320px] rounded-2xl border border-[#dfe4ef] bg-white p-4">
      <h1 className="text-base font-extrabold text-[#111827]">Driver Accounts</h1>
      <p className="mt-2 text-sm text-[#64748b]">
        Dedicated driver content page. Use the Users page dropdown filters for in-table filtering.
      </p>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard/users')}
          className="rounded-lg bg-[#22449d] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Users
        </button>
      </div>
    </section>
  )
}

export default Driver
