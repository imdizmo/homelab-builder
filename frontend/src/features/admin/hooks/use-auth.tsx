import { useEffect } from "react";
import { api } from "../../../lib/api";

// TODO: Replace with real auth logic
export function useAuth() {
    useEffect(() => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            // Auto-login as dev if no token exists
            api.devLogin("demo@homelab.com").catch(console.error);
        }
    }, []);

    return {
        user: { id: "user-1", name: "Test User", email: "test@example.com" },
        loading: false,
        logout: () => {
             console.log("Logout clicked");
             localStorage.removeItem('auth_token');
        }
    };
}
