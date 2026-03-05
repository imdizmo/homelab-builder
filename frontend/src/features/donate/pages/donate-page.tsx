import { useDonationProgress } from "../api/use-donate"
import { useAuth } from "../../admin/hooks/use-auth"
import { useUpdateDonationProgress } from "../api/use-donate"
import { Heart, Server, Coffee, Github as GithubIcon } from "lucide-react"
import { Button } from "../../../components/ui/button"
import { useState } from "react"
import { toast } from "sonner"

export default function DonatePage() {
    const { data: progress, isLoading } = useDonationProgress()
    const { user } = useAuth()
    const updateMut = useUpdateDonationProgress()
    const [adminCurrent, setAdminCurrent] = useState("")

    const current = progress?.current || 0
    const target = progress?.target || 250
    const percentage = Math.min(100, Math.round((current / target) * 100))

    const handleAdminUpdate = () => {
        const val = parseInt(adminCurrent)
        if (isNaN(val) || val < 0) {
            toast.error("Invalid amount")
            return
        }
        updateMut.mutateAsync({ current: val }).then(() => setAdminCurrent(""))
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 lg:p-12 relative h-full">
            <div className="mx-auto max-w-3xl space-y-12 pb-24">
                
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center p-3 bg-pink-500/10 text-pink-500 rounded-full mb-2">
                        <Heart className="h-8 w-8" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Support HLBuilder</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Help cover the costs of the open beta and fuel the path to a fully free, open-source 1.0 release.
                    </p>
                </div>

                {/* Progress Card */}
                <div className="relative overflow-hidden rounded-2xl border bg-card/50 shadow-xl backdrop-blur-sm p-8">
                    {/* Glowing background blob */}
                    <div className="absolute -top-32 -left-32 w-64 h-64 bg-pink-500/20 blur-3xl rounded-full pointer-events-none" />
                    
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-end justify-between">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-bold tracking-tight">Open Source Goal</h3>
                                <p className="text-muted-foreground text-sm">If we hit this goal, I will release the full HLBuilder source code for everyone under the GNU Affero license.</p>
                            </div>
                            <div className="text-right">
                                <span className="text-4xl font-black text-primary">${current}</span>
                                <span className="text-muted-foreground"> / ${target}</span>
                            </div>
                        </div>

                        {/* Animated Progress Bar */}
                        <div className="relative h-6 w-full overflow-hidden rounded-full bg-secondary">
                            {isLoading ? (
                                <div className="absolute inset-0 bg-muted animate-pulse" />
                            ) : (
                                <div
                                    className="h-full bg-gradient-to-r from-pink-500 to-indigo-500 transition-all duration-1000 ease-out relative"
                                    style={{ width: `${percentage}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full" />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-pink-500">{percentage}% Funded</span>
                            <span className="text-muted-foreground">${Math.max(0, target - current)} to go</span>
                        </div>
                    </div>
                </div>

                {/* The Story */}
                <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-lg/relaxed">
                    <p>
                        Hi, my name is <strong>Miłosz</strong>, also known as <strong>Butters</strong> or <strong>Butterski</strong> on the internet. 
                        I study and work in IT here in Poland. My true passions lie in coding, AI, and homelabbing.
                    </p>
                    <p>
                        Even though I work, I often don't have enough spare funds to pursue these passions fully. 
                        I constantly find myself building my own tools from scratch to bypass expensive subscriptions or avoid spending money I don't have.
                    </p>
                    <p>
                        To host this open beta version of HLBuilder, I had to cover the server costs out of my own pocket. 
                        I've set a goal of <strong>$250</strong> to cover these ongoing beta hosting expenses, and to eventually buy a better, dedicated server for the official 1.0 release. 
                    </p>
                    <p>
                        <em>Full disclosure:</em> This app is about <strong>70% "vibecoded"</strong> with AI and <strong>30% organically coded</strong> by my own hands (especially those tricky parts I just had to wire up myself). Building all this with love requires funds to pay for AI subscriptions like Antigravity! 🚀
                    </p>
                    <div className="flex items-center gap-4 bg-accent/50 p-4 rounded-xl border border-accent">
                        <div className="p-2 bg-background rounded-lg shrink-0">🎮</div>
                        <p className="m-0 text-base">
                            Also... I really need to replace the network card in my PC. My current one keeps crashing constantly, and I just want to play Overwatch in peace! 😅
                        </p>
                    </div>
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl space-y-2">
                        <p className="font-semibold text-primary m-0">
                            If the $250 goal is reached, I promise to release the full source code of HLBuilder entirely for free so the community can self-host and contribute under the GNU Affero license.
                        </p>
                        <p className="text-sm text-foreground/80 m-0">
                            <em>Note: Even if the goal isn't fully met, the app will still go open source in a maximum of 1-3 months after the beta releases, depending on what the community thinks and says! 🤝</em>
                        </p>
                    </div>
                </div>

                {/* Donate Buttons */}
                <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t">
                    <a 
                        href="https://buymeacoffee.com/butterski" 
                        target="_blank" 
                        rel="noreferrer"
                        className="group relative overflow-hidden rounded-xl bg-[#FFDD00] p-6 text-[#000000] hover:bg-[#FFDD00]/90 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#FFDD00]/20 flex flex-col items-center gap-3"
                    >
                        <Coffee className="h-8 w-8 transition-transform group-hover:scale-110" />
                        <span className="font-bold text-lg">Buy me a coffee</span>
                    </a>
                    
                    <a 
                        href="https://github.com/sponsors/Butterski" 
                        target="_blank" 
                        rel="noreferrer"
                        className="group relative overflow-hidden rounded-xl bg-[#24292F] dark:bg-white p-6 text-white dark:text-[#24292F] hover:bg-[#24292F]/90 dark:hover:bg-white/90 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 flex flex-col items-center gap-3"
                    >
                        <GithubIcon className="h-8 w-8 transition-transform group-hover:scale-110" />
                        <span className="font-bold text-lg">GitHub Sponsor</span>
                    </a>
                </div>

                {/* Admin Update Controls */}
                {user?.is_admin && (
                    <div className="mt-12 p-6 border border-destructive/30 bg-destructive/5 rounded-xl space-y-4">
                        <div className="flex items-center gap-2 text-destructive font-semibold">
                            <Server className="h-5 w-5" />
                            Admin: Manually Update Progress
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={adminCurrent}
                                onChange={e => setAdminCurrent(e.target.value)}
                                placeholder="Enter current total $..."
                                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm max-w-[200px]"
                            />
                            <Button 
                                variant="destructive" 
                                onClick={handleAdminUpdate}
                                disabled={updateMut.isPending || !adminCurrent}
                            >
                                Update Total
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">This updates the progress bar for all users instantly.</p>
                    </div>
                )}
                
            </div>
        </div>
    )
}
