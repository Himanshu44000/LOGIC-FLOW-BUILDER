import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CopyPlus, PencilLine, Trash2, Plus, BookOpen } from 'lucide-react'
import { flowApi } from '../services/api'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [flows, setFlows] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchFlows = async () => {
    try {
      setLoading(true)
      const data = await flowApi.list()
      setFlows(data)
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Failed to load flows')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFlows()
  }, [])

  const handleDelete = async (id) => {
    try {
      await flowApi.remove(id)
      toast.success('Flow deleted')
      fetchFlows()
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Delete failed')
    }
  }

  const handleDuplicate = async (id) => {
    try {
      const copy = await flowApi.duplicate(id)
      toast.success('Flow duplicated')
      navigate(`/builder/${copy.id}`)
    } catch (error) {
      toast.error(error.response?.data?.message ?? 'Duplicate failed')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Logic Flow Builder</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Visual programming workflows with execution history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/guide" className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            <BookOpen size={16} /> Guide
          </Link>
          <Link to="/builder/new" className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700">
            <Plus size={16} /> New Flow
          </Link>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        {loading ? (
          <p className="text-sm text-slate-500">Loading flows...</p>
        ) : flows.length === 0 ? (
          <p className="text-sm text-slate-500">No saved flows yet. Create your first flow.</p>
        ) : (
          <div className="space-y-2">
            {flows.map((flow) => (
              <div key={flow.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{flow.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Updated: {new Date(flow.updatedAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link className="toolbar-btn" to={`/builder/${flow.id}`}><PencilLine size={14} /> Open</Link>
                  <button className="toolbar-btn" onClick={() => handleDuplicate(flow.id)}><CopyPlus size={14} /> Duplicate</button>
                  <button className="toolbar-btn" onClick={() => handleDelete(flow.id)}><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
