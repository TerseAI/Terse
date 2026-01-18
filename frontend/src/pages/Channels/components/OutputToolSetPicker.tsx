import { IconForConfigType } from "./Integration";
import { CONFIG_DETAILS, ConfigType } from "@/shared/Configs";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function OutputToolSetPicker({ onSelectIntegration }: { onSelectIntegration: (configType: ConfigType) => void }) {
    const [searchQuery, setSearchQuery] = useState("");

    // Get all integration metadata with output-specific descriptions
    const allConfigTypes = Object.values(CONFIG_DETAILS).filter((config) => config.isOutput);

    // Filter based on search query
    const filteredConfigTypes = useMemo(() => {
        if (!searchQuery.trim()) {
            return allConfigTypes;
        }
        const query = searchQuery.toLowerCase();
        return allConfigTypes.filter((config) => {
            return (
                config.name.toLowerCase().includes(query) ||
                config.description.toLowerCase().includes(query)
            );
        });
    }, [allConfigTypes, searchQuery]);

    return (
        <div className="w-full space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Search skills..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>
            <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4 items-stretch">
                {filteredConfigTypes.map((config) => (
                    <button
                        type="button"
                        key={config.configType}
                        onClick={() => onSelectIntegration(config.configType)}
                        className="w-full aspect-square px-4 pb-4 pt-3 border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors flex flex-col gap-2 text-left"
                    >
                        {/* Top-left name (same as Trigger cards) */}
                        <div className="w-full flex flex-row justify-between items-center gap-2">
                            <div className="min-w-0 flex-1 text-sm font-medium leading-none truncate text-left">
                                {config.name}
                            </div>
                        </div>

                        {/* Big icon in the middle */}
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-16 h-16">
                                <IconForConfigType type={config.configType} />
                            </div>
                        </div>

                        {/* Description at the bottom (where chips live on Trigger cards) */}
                        <div className="mt-auto text-xs text-muted-foreground text-center leading-snug line-clamp-2">
                            {config.description}
                        </div>
                    </button>
                ))}
            </div>
            {filteredConfigTypes.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                    No skills found matching "{searchQuery}"
                </div>
            )}
        </div>
    );
}

