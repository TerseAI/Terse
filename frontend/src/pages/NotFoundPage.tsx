import { Link } from "react-router-dom"

import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export default function NotFoundPage() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center bg-background p-6">
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>Page not found</EmptyTitle>
                    <EmptyDescription>This URL doesn&apos;t match anything in the app. Check the link or return to Home.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <Button asChild>
                        <Link to={FrontendRoutes.HOME}>Back to Home</Link>
                    </Button>
                </EmptyContent>
            </Empty>
        </div>
    )
}
