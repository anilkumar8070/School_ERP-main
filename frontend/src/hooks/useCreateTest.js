import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTest, createTestBulk } from '../api'

export default function useCreateTest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ formData, bulk, token }) => {
      if (bulk) return createTestBulk(formData, token)
      return createTest(formData, token)
    },
    onSuccess: () => {
      try { qc.invalidateQueries(['myTests']) } catch (e) {}
    }
  })
}
