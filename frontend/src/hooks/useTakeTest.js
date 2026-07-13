import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitTest, forfeitTest } from '../api'

export function useSubmitTest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ testId, body, token }) => submitTest(testId, body, token),
    onSuccess: () => {
      try { qc.invalidateQueries(['myTests']) } catch (e) {}
      try { qc.invalidateQueries(['testResults']) } catch (e) {}
    }
  })
}

export function useForfeitTest(testId, token) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => forfeitTest(testId, token),
    onSuccess: () => {
      try { qc.invalidateQueries(['myTests']) } catch (e) {}
    }
  })
}
