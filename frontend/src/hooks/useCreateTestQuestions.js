import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTestQuestions } from '../api'

export default function useCreateTestQuestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ testId, questions, token }) => createTestQuestions(testId, questions, token),
    onSuccess: () => {
      try { qc.invalidateQueries(['testQuestions']) } catch (e) {}
      try { qc.invalidateQueries(['myTests']) } catch (e) {}
    }
  })
}
