
import { api } from "../../../lib/api";

export interface Build {
    id: string;
    user_id: string;
    name: string;
    thumbnail?: string;
    settings: any; // e.g. boughtItems, showBought
    created_at: string;
    updated_at: string;

    // Relational Data from Preloads
    nodes?: any[];
    edges?: any[];
    virtual_machines?: any[];
    service_instances?: any[];
}

export type CreateBuildParams = {
    name: string;
    thumbnail?: string;
    settings: any;
    nodes: any[];
    edges: any[];
    services: any[];
};

export const buildApi = {
    list: async () => {
        const response = await api.get<Build[]>("/api/builds");
        return response; // api.get returns data directly in this codebase's wrapper
    },
    get: async (id: string) => {
        const response = await api.get<Build>(`/api/builds/${id}`);
        return response;
    },
    create: async (params: CreateBuildParams) => {
        const response = await api.post<Build>("/api/builds", params);
        return response;
    },
    update: async (id: string, params: CreateBuildParams) => {
        const response = await api.put<Build>(`/api/builds/${id}`, params);
        return response;
    },
    delete: async (id: string) => {
        await api.del(`/api/builds/${id}`);
    },
    duplicate: async (id: string) => {
        const response = await api.post<Build>(`/api/builds/${id}/duplicate`, {});
        return response;
    },
    calculateNetwork: async (id: string) => {
        await api.post(`/api/builds/${id}/calculate-network`, {});
    },
    generateConfig: async (id: string) => {
        const response = await api.post<{ docker_compose: string, env: string, ansible_inventory: string, nginx: string }>(`/api/builds/${id}/generate-config`, {});
        return response;
    },
};
