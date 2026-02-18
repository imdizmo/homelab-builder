import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Package, Calendar, MoreVertical, Edit, Trash } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { buildApi, type Build } from "../api/builds";
import { api } from "../../../lib/api";
import { useAuth } from "../../admin/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

export default function ProjectsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [builds, setBuilds] = useState<Build[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        loadBuilds();
    }, [user]);

    async function loadBuilds() {
        setLoading(true);
        try {
            const data = await buildApi.list();
            setBuilds(data);
        } catch (error) {
            console.error("Failed to load builds", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateNew() {
        try {
            // Ensure we have a token before creating
            if (!localStorage.getItem('auth_token')) {
                await api.devLogin("demo@homelab.com");
            }

            const newBuild = await buildApi.create({
                name: "New Project",
                data: JSON.stringify({}), // Empty state
                thumbnail: "",
            });
            navigate(`/builder/${newBuild.id}`);
        } catch (error) {
            console.error("Failed to create build", error);
            alert("Failed to create project. Please try again.");
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this project?")) return;
        try {
            await buildApi.delete(id);
            setBuilds(builds.filter(b => b.id !== id));
        } catch (error) {
            console.error("Failed to delete build", error);
        }
    }

    if (!user) return <div className="p-8 text-center">Please log in to view your projects.</div>;

    return (
        <div className="container py-10 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
                    <p className="text-muted-foreground mt-1">Manage all your homelab designs</p>
                </div>
                <Button onClick={handleCreateNew}>
                    <Plus className="mr-2 h-4 w-4" /> New Project
                </Button>
            </div>

            {loading ? (
                <div>Loading projects...</div>
            ) : builds.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-xl">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                    <p className="text-muted-foreground mb-6">Start designing your dream homelab today.</p>
                    <Button onClick={handleCreateNew}>Create First Project</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {builds.map((build) => (
                        <div key={build.id} className="group relative border rounded-xl overflow-hidden bg-card hover:shadow-md transition-all">
                            {/* Thumbnail area */}
                            <div className="aspect-video bg-muted relative">
                                {build.thumbnail ? (
                                    <img src={build.thumbnail} alt={build.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground/30">
                                        <Package className="h-12 w-12" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => navigate(`/builder/${build.id}`)}>
                                        Open Editor
                                    </Button>
                                </div>
                            </div>

                            <div className="p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-semibold truncate pr-2" title={build.name}>{build.name}</h3>
                                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {formatDistanceToNow(new Date(build.updated_at), { addSuffix: true })}
                                        </div>
                                    </div>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => navigate(`/builder/${build.id}`)}>
                                                <Edit className="h-4 w-4 mr-2" /> Open
                                            </DropdownMenuItem>
                                            {/* TODO: Implement Duplicate */}
                                            {/* <DropdownMenuItem>
                                                <Copy className="h-4 w-4 mr-2" /> Duplicate
                                            </DropdownMenuItem> */}
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(build.id)}>
                                                <Trash className="h-4 w-4 mr-2" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
