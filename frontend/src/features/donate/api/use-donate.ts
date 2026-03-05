import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "../../../services/api"
import { toast } from "sonner"

export const DONATION_QUERY_KEY = ["donation-progress"]

export function useDonationProgress() {
    return useQuery({
        queryKey: DONATION_QUERY_KEY,
        queryFn: async () => {
            const res = await api.getDonationProgress()
            return res.data
        },
    })
}

export function useUpdateDonationProgress() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: { current: number; target?: number }) => api.updateDonationProgress(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: DONATION_QUERY_KEY })
            toast.success("Donation progress updated")
        },
        onError: (err: any) => {
            toast.error(err.message || "Failed to update progress")
        }
    })
}
