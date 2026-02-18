import { useQuery } from "@tanstack/react-query"
import { api } from "../../../lib/api"
import type { Service } from "../../../types" // Assuming types are still in src/types or need to be moved

// We should probably move shared types to src/types or src/lib/types if global, or feature specific.
// For now, I'll rely on global types if they exist, or re-declare.
// Let's assume src/types/index.ts exists.

export const useServices = () => {
    return useQuery({
        queryKey: ["services"],
        queryFn: async () => {
            const response = await api.get<{ data: Service[] }>("/api/services")
            return response.data
        },
    })
}
