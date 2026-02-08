import { useMemo, useState } from "react"

import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { CONFIG_DETAILS, ConfigType } from "@/shared/Configs"

import { IconForConfigType } from "../components/Integration"

interface AddOutputModalProps {
    isOpen: boolean
    onClose: () => void
    onSelectOutput: (config: ConfigType) => void
}

export function AddOutputModal({ isOpen, onClose, onSelectOutput }: AddOutputModalProps) {
    const [searchQuery, setSearchQuery] = useState("")

    // Get all output config types, excluding TERSE (always available, hidden from UI)
    const allConfigTypes = Object.values(ConfigType)
    const outputConfigTypes = allConfigTypes.filter(configType => CONFIG_DETAILS[configType].isOutput && configType !== ConfigType.TERSE)

    // Filter based on search query
    const filteredConfigTypes = useMemo(() => {
        if (!searchQuery.trim()) {
            return outputConfigTypes
        }
        const query = searchQuery.toLowerCase()
        return outputConfigTypes.filter(configType => {
            const configDetails = CONFIG_DETAILS[configType]
            return configDetails.name.toLowerCase().includes(query) || configDetails.description.toLowerCase().includes(query)
        })
    }, [outputConfigTypes, searchQuery])

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg h-[75vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Add Skill</DialogTitle>
                    <DialogDescription>Choose which skill integration to add</DialogDescription>
                </DialogHeader>

                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="text" placeholder="Search skills..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="grid grid-cols-2 gap-3">
                        {filteredConfigTypes.map(configType => {
                            const configDetails = CONFIG_DETAILS[configType]
                            return (
                                <button
                                    key={configType}
                                    onClick={() => onSelectOutput(configType)}
                                    className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all duration-200 group"
                                >
                                    <div className="w-16 h-16 flex items-center justify-center">
                                        <IconForConfigType type={configType} />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-medium text-foreground mb-1">{configDetails.name}</div>
                                        <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{configDetails.description}</div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                    {filteredConfigTypes.length === 0 && <div className="text-center text-muted-foreground py-8">No skills found matching "{searchQuery}"</div>}
                </div>

                <DialogFooter>
                    <Button onClick={onClose} variant="outline" className="w-full">
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
