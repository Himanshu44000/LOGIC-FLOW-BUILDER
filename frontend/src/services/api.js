import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

export const flowApi = {
  list: async () => (await api.get('/flows')).data,
  get: async (id) => (await api.get(`/flows/${id}`)).data,
  create: async (payload) => (await api.post('/flows', payload)).data,
  update: async (id, payload) => (await api.put(`/flows/${id}`, payload)).data,
  remove: async (id) => api.delete(`/flows/${id}`),
  duplicate: async (id) => (await api.post(`/flows/${id}/duplicate`)).data,
  recordings: {
    list: async (flowId) => (await api.get(`/flows/${flowId}/recordings`)).data,
    create: async (flowId, payload) => (await api.post(`/flows/${flowId}/recordings`, payload)).data,
    remove: async (flowId, recordingId) => api.delete(`/flows/${flowId}/recordings/${recordingId}`),
  },
}

export const executionApi = {
  run: async (payload) => (await api.post('/executions/run', payload)).data,
  history: async (flowId) => (await api.get('/executions/history', { params: { flowId } })).data,
}
