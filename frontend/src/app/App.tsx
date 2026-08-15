import { BrowserRouter as Router } from "react-router-dom"

import { PageMeta } from "@/app/PageMeta"
import { Providers } from "@/app/providers"
import { AppRoutes } from "@/app/router"

export default function App() {
    return (
        <Providers>
            <Router>
                <PageMeta />
                <AppRoutes />
            </Router>
        </Providers>
    )
}
