import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitAssignmentApi } from '../api'

export default function useSubmitAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, formData, token }) => submitAssignmentApi(assignmentId, formData, token),
    onSuccess: (submission, vars) => {
      try { qc.invalidateQueries(['assignments']) } catch (e) {}
    }
  })
}
