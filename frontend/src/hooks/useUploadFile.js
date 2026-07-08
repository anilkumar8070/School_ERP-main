import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadFile } from '../api'

export default function useUploadFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formData, token }) => uploadFile(formData, token),
    onSuccess: (res) => {
      // file uploads don't usually require invalidations, but keep hook for reuse
      return res
    }
  })
}
